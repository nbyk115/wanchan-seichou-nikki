/**
 * わんちゃん成長日記 - Firebase Backend
 *
 * セットアップ手順:
 * 1. https://console.firebase.google.com/ でプロジェクト作成
 * 2. Authentication → Google ログインを有効化
 * 3. Firestore Database → 本番モードで作成
 * 4. 下の firebaseConfig を自分のプロジェクトの値に置き換える
 * 5. Firestore ルール を firestore.rules の内容に設定
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, GoogleAuthProvider }
  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, orderBy, limit, serverTimestamp, onSnapshot, deleteDoc, updateDoc, writeBatch }
  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// ============================================================
// Firebase project config (wanchan-diary)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDiQeQW9EgAI8BbZ9Z030ADJsLeA64VzAs",
  authDomain: "wanchan-diary.firebaseapp.com",
  projectId: "wanchan-diary",
  storageBucket: "wanchan-diary.firebasestorage.app",
  messagingSenderId: "151633084436",
  appId: "1:151633084436:web:ac8ffa692e4ba1839a2701"
};

// Skip initialization if config is not set
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app, auth, db;
if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// ============================================================
// AUTH
// ============================================================
async function login() {
  if (!isConfigured) {
    _toast('Firebase未設定です', 'error');
    return null;
  }
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    // Create/update user profile in Firestore
    await setDoc(doc(db, 'users', result.user.uid), {
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      lastLogin: serverTimestamp()
    }, { merge: true });
    window.dispatchEvent(new CustomEvent('wanchan-login', { detail: { uid: result.user.uid } }));
    return result.user;
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
      // Popup blocked — fall back to redirect
      await signInWithRedirect(auth, provider);
      return null;
    }
    if (e.code !== 'auth/popup-closed-by-user') {
      _toast('ログインがうまくいかなかったみたい。もう一度試してね', 'error');
    }
    return null;
  }
}

async function logout() {
  if (!isConfigured) return;
  try { await signOut(auth); } catch (_) { /* network error ok */ }
}

function onAuth(cb) {
  if (!isConfigured) { cb(null); return function() {}; }
  return onAuthStateChanged(auth, cb);
}

// ============================================================
// DATA SYNC: localStorage ↔ Firestore
// ============================================================
let _lastSyncHash = '';

// Collect app data keys (exclude ux_ prefix which is UX-only state)
function _getAppData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !key.startsWith('ux_')) {
      data[key] = localStorage.getItem(key);
    }
  }
  return data;
}

async function syncToCloud(uid) {
  if (!isConfigured || !uid) return;
  const data = _getAppData();
  const json = JSON.stringify(data);
  // Skip sync if nothing changed
  if (json === _lastSyncHash) return;
  try {
    await setDoc(doc(db, 'userData', uid), {
      data: json,
      updatedAt: serverTimestamp()
    }, { merge: true });
    _lastSyncHash = json;
    // Record successful sync time locally
    try { localStorage.setItem('ux_last_sync_at', Date.now().toString()); } catch (_) {}
  } catch (e) {
    console.error('syncToCloud failed:', e);
  }
}

async function syncFromCloud(uid) {
  if (!isConfigured || !uid) return false;
  try {
  const snap = await getDoc(doc(db, 'userData', uid));
  if (!snap.exists()) return false;
  const snapData = snap.data();
  const raw = snapData.data;
  if (!raw) return false;
    const cloudData = JSON.parse(raw);

    // Timestamp comparison: skip cloud pull if local is newer
    const cloudUpdatedAt = snapData.updatedAt && typeof snapData.updatedAt.toMillis === 'function'
      ? snapData.updatedAt.toMillis() : 0;
    const localSyncAt = parseInt(localStorage.getItem('ux_last_sync_at') || '0', 10);
    if (localSyncAt > cloudUpdatedAt && cloudUpdatedAt > 0) {
      // Local data is newer than cloud — don't overwrite, let syncToCloud push later
      return false;
    }

    // Apply cloud data to localStorage
    const cloudKeys = new Set(Object.keys(cloudData));
    for (const key of cloudKeys) {
      try { localStorage.setItem(key, cloudData[key]); } catch (_) { /* quota */ }
    }

    // Remove local app keys that no longer exist in cloud (handles deletions)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && !key.startsWith('ux_') && !cloudKeys.has(key)) {
        localStorage.removeItem(key);
      }
    }

    // Update sync hash to match cloud state (prevents immediate re-upload)
    _lastSyncHash = JSON.stringify(_getAppData());
    try { localStorage.setItem('ux_last_sync_at', Date.now().toString()); } catch (_) {}
    return true;
  } catch (e) {
    console.warn('syncFromCloud parse error:', e);
    return false;
  }
}

// ============================================================
// SOCIAL: Footprints v2 (あしあと — マージ対応)
// ============================================================

/**
 * 足あとを残す（同一訪問者はマージ — mixi仕様準拠）
 * ドキュメントID: {targetUid}_{visitorUid}
 */
async function leaveFootprint(targetUid) {
  if (!isConfigured || !auth.currentUser) return;
  if (auth.currentUser.uid === targetUid) return; // 自分には足あとを残さない

  const docId = targetUid + '_' + auth.currentUser.uid;
  const ref = doc(db, 'footprints', docId);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        updatedAt: serverTimestamp(),
        visitCount: (existing.data().visitCount || 1) + 1,
        fromName: auth.currentUser.displayName,
        fromPhoto: auth.currentUser.photoURL
      });
    } else {
      await setDoc(ref, {
        from: auth.currentUser.uid,
        fromName: auth.currentUser.displayName,
        fromPhoto: auth.currentUser.photoURL,
        to: targetUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        visitCount: 1
      });
    }
  } catch (e) {
    console.error('leaveFootprint failed:', e);
  }
}

/**
 * 足あとを取得（日付グルーピング対応）
 * 返り値: { today: [...], yesterday: [...], thisWeek: [...], all: [...] }
 */
async function getFootprints(uid, max) {
  if (!isConfigured) return { today: [], yesterday: [], thisWeek: [], all: [] };
  try {
    max = max || 30;
    const q = query(
      collection(db, 'footprints'),
      where('to', '==', uid),
      orderBy('updatedAt', 'desc'),
      limit(max)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });

    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var yesterdayStart = todayStart - 86400000;
    var weekStart = todayStart - (now.getDay() * 86400000);
    var grouped = { today: [], yesterday: [], thisWeek: [], all: items };

    items.forEach(function(fp) {
      var ts = fp.updatedAt
        ? (fp.updatedAt.seconds ? fp.updatedAt.seconds * 1000 : fp.updatedAt)
        : 0;
      if (ts >= todayStart) grouped.today.push(fp);
      else if (ts >= yesterdayStart) grouped.yesterday.push(fp);
      else if (ts >= weekStart) grouped.thisWeek.push(fp);
    });

    return grouped;
  } catch (e) {
    console.error('getFootprints failed:', e);
    return { today: [], yesterday: [], thisWeek: [], all: [] };
  }
}

/**
 * 新着足あと数を取得（既読管理）
 */
async function getUnreadFootprintCount(uid) {
  if (!isConfigured) return 0;
  try {
    var statusSnap = await getDoc(doc(db, 'footprintReadStatus', uid));
    var lastReadAt = (statusSnap.exists() && statusSnap.data().lastReadAt)
      ? statusSnap.data().lastReadAt : null;

    var q;
    if (lastReadAt) {
      q = query(
        collection(db, 'footprints'),
        where('to', '==', uid),
        where('updatedAt', '>', lastReadAt),
        orderBy('updatedAt', 'desc'),
        limit(30)
      );
    } else {
      q = query(
        collection(db, 'footprints'),
        where('to', '==', uid),
        orderBy('updatedAt', 'desc'),
        limit(30)
      );
    }
    var snap = await getDocs(q);
    return snap.size;
  } catch (e) {
    console.error('getUnreadFootprintCount failed:', e);
    return 0;
  }
}

/**
 * 足あとを既読にする
 */
async function markFootprintsRead(uid) {
  if (!isConfigured) return;
  try {
    await setDoc(doc(db, 'footprintReadStatus', uid), { lastReadAt: serverTimestamp() });
  } catch (e) {
    console.error('markFootprintsRead failed:', e);
  }
}

// ============================================================
// SOCIAL: Introductions (ひとこと紹介文)
// ============================================================

/**
 * ひとこと紹介文を投稿・更新（1ユーザーにつき1件、100文字以内）
 */
async function postIntroduction(targetUid, text) {
  if (!isConfigured || !auth.currentUser) return false;
  if (auth.currentUser.uid === targetUid) {
    _toast('自分にひとことは書けません', 'error');
    return false;
  }
  if (!text || text.length === 0 || text.length > 100) {
    _toast('1〜100文字で書いてね', 'error');
    return false;
  }

  var docId = targetUid + '_' + auth.currentUser.uid;
  var ref = doc(db, 'introductions', docId);

  try {
    var existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        text: text,
        updatedAt: serverTimestamp(),
        authorName: auth.currentUser.displayName,
        authorPhoto: auth.currentUser.photoURL
      });
    } else {
      await setDoc(ref, {
        targetUid: targetUid,
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName,
        authorPhoto: auth.currentUser.photoURL,
        text: text,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    _toast('ひとことを投稿しました', 'success');
    return true;
  } catch (e) {
    console.error('postIntroduction failed:', e);
    _toast('ひとことがうまく届かなかったよ。もう一度試してみてね', 'error');
    return false;
  }
}

/**
 * 対象ユーザーの紹介文一覧を取得
 */
async function getIntroductions(targetUid, max) {
  if (!isConfigured) return [];
  try {
    max = max || 20;
    var q = query(
      collection(db, 'introductions'),
      where('targetUid', '==', targetUid),
      orderBy('updatedAt', 'desc'),
      limit(max)
    );
    var snap = await getDocs(q);
    return snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
  } catch (e) {
    console.error('getIntroductions failed:', e);
    return [];
  }
}

/**
 * 紹介文を削除（著者本人 or 対象ユーザー本人）
 */
async function deleteIntroduction(targetUid, authorUid) {
  if (!isConfigured || !auth.currentUser) return;
  var uid = auth.currentUser.uid;
  if (uid !== authorUid && uid !== targetUid) return;

  try {
    var docId = targetUid + '_' + authorUid;
    await deleteDoc(doc(db, 'introductions', docId));
    _toast('ひとことを削除しました', 'info');
  } catch (e) {
    console.error('deleteIntroduction failed:', e);
    _toast('うまく削除できなかったよ。もう一度試してみてね', 'error');
  }
}

// ============================================================
// SOCIAL: Friends (フレンド)
// ============================================================
async function sendFriendRequest(targetUid) {
  if (!isConfigured || !auth.currentUser) return;
  try {
    await setDoc(doc(db, 'friendRequests', auth.currentUser.uid + '_' + targetUid), {
      from: auth.currentUser.uid,
      fromName: auth.currentUser.displayName,
      to: targetUid,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  } catch (e) {
    _toast('犬友申請がうまくいかなかったよ。もう一度試してみてね', 'error');
    console.error('sendFriendRequest failed:', e);
  }
}

async function acceptFriendRequest(requestId, fromUid) {
  if (!isConfigured || !auth.currentUser) return;
  const uid = auth.currentUser.uid;
  try {
    const batch = writeBatch(db);
    // Update request status
    batch.update(doc(db, 'friendRequests', requestId), { status: 'accepted' });
    // Create bidirectional friend records
    batch.set(doc(db, 'friends', uid + '_' + fromUid), {
      users: [uid, fromUid], createdAt: serverTimestamp()
    });
    batch.set(doc(db, 'friends', fromUid + '_' + uid), {
      users: [fromUid, uid], createdAt: serverTimestamp()
    });
    await batch.commit();
  } catch (e) {
    _toast('犬友承認がうまくいかなかったよ。もう一度試してみてね', 'error');
    console.error('acceptFriendRequest failed:', e);
  }
}

async function getFriends(uid) {
  if (!isConfigured) return [];
  try {
    const q = query(collection(db, 'friends'), where('users', 'array-contains', uid));
    const snap = await getDocs(q);
    const friendUids = [];
    snap.docs.forEach(function(d) {
      const users = d.data().users;
      const friendUid = users[0] === uid ? users[1] : users[0];
      if (friendUids.indexOf(friendUid) === -1) friendUids.push(friendUid);
    });
    const friends = await Promise.all(friendUids.map(async function(fuid) {
      try {
        const uSnap = await getDoc(doc(db, 'users', fuid));
        if (uSnap.exists()) return { uid: fuid, ...uSnap.data() };
      } catch (_) {}
      return null;
    }));
    return friends.filter(Boolean);
  } catch (e) {
    console.error('getFriends failed:', e);
    return [];
  }
}

// ============================================================
// SOCIAL: Diary Comments (日記コメント)
// ============================================================
async function postComment(entryId, text) {
  if (!isConfigured || !auth.currentUser) return;
  try {
    await addDoc(collection(db, 'comments'), {
      entryId: entryId,
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL,
      text: text,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    _toast('コメントがうまく届かなかったよ。もう一度試してみてね', 'error');
    console.error('postComment failed:', e);
  }
}

async function getComments(entryId, max) {
  if (!isConfigured) return [];
  try {
    max = max || 50;
    const q = query(
      collection(db, 'comments'),
      where('entryId', '==', entryId),
      orderBy('createdAt', 'asc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
  } catch (e) {
    console.error('getComments failed:', e);
    return [];
  }
}

function onCommentsUpdate(entryId, cb) {
  if (!isConfigured) return function() {};
  const q = query(
    collection(db, 'comments'),
    where('entryId', '==', entryId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, function(snap) {
    cb(snap.docs.map(function(d) { return { id: d.id, ...d.data() }; }));
  });
}

// Safe toast helper (guards against race with inline script)
function _toast(msg, type) {
  var fn = window.__wanchan && window.__wanchan.showToast;
  if (fn) fn(msg, type);
}

// ============================================================
// EXPOSE TO APP
// ============================================================
window.__wanchan = window.__wanchan || {};
Object.assign(window.__wanchan, {
  firebase: {
    isConfigured: isConfigured,
    login: login,
    logout: logout,
    onAuth: onAuth,
    syncToCloud: syncToCloud,
    syncFromCloud: syncFromCloud,
    leaveFootprint: leaveFootprint,
    getFootprints: getFootprints,
    getUnreadFootprintCount: getUnreadFootprintCount,
    markFootprintsRead: markFootprintsRead,
    postIntroduction: postIntroduction,
    getIntroductions: getIntroductions,
    deleteIntroduction: deleteIntroduction,
    sendFriendRequest: sendFriendRequest,
    acceptFriendRequest: acceptFriendRequest,
    getFriends: getFriends,
    postComment: postComment,
    getComments: getComments,
    onCommentsUpdate: onCommentsUpdate
  }
});

// ============================================================
// AUTO-SYNC ON LOGIN
// ============================================================
if (isConfigured) {
  let _syncInterval = null;
  let _isFirstAuth = true;
  let _currentUid = null;
  onAuth(async function(user) {
    // Clear previous sync interval on any auth state change
    if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
    if (user) {
      _currentUid = user.uid;
      // Only show toast on actual login, not on page reload with cached session
      if (!_isFirstAuth) {
        _toast(user.displayName + 'でログイン中', 'success');
      }
      _isFirstAuth = false;
      // Flush any pending sync from previous session's beforeunload
      if (localStorage.getItem('ux_pending_sync') === '1') {
        try { localStorage.removeItem('ux_pending_sync'); } catch (_) {}
        await syncToCloud(user.uid);
      }
      const synced = await syncFromCloud(user.uid);
      if (synced) {
        _toast('クラウドからデータを同期しました', 'info');
      }
      _syncInterval = setInterval(function() { syncToCloud(user.uid).catch(function() {}); }, 30000);
    } else {
      _currentUid = null;
      _isFirstAuth = false;
    }
  });

  // Sync on page visibility change (tab switch / minimize)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden' && _currentUid) {
      syncToCloud(_currentUid).catch(function() {});
    }
  });

  // Last-resort sync on page unload — use sendBeacon for reliability
  window.addEventListener('beforeunload', function() {
    if (_currentUid) {
      // sendBeacon is the only reliable way to send data during unload
      try {
        var data = _getAppData();
        var json = JSON.stringify(data);
        if (json !== _lastSyncHash && navigator.sendBeacon) {
          // Send a minimal beacon to indicate data needs sync on next load
          navigator.sendBeacon('data:text/plain,sync');
          // Mark that we have unsent changes
          try { localStorage.setItem('ux_pending_sync', '1'); } catch (_) {}
        }
      } catch (_) {}
    }
  });
}
