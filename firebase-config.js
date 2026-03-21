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
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider }
  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, orderBy, limit, serverTimestamp, onSnapshot, deleteDoc, updateDoc }
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
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    // Create/update user profile in Firestore
    await setDoc(doc(db, 'users', result.user.uid), {
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      lastLogin: serverTimestamp()
    }, { merge: true });
    return result.user;
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      _toast('ログインに失敗しました', 'error');
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
  await setDoc(doc(db, 'userData', uid), {
    data: json,
    updatedAt: serverTimestamp()
  }, { merge: true });
  _lastSyncHash = json;
  // Record successful sync time locally
  try { localStorage.setItem('ux_last_sync_at', Date.now().toString()); } catch (_) {}
}

async function syncFromCloud(uid) {
  if (!isConfigured || !uid) return false;
  const snap = await getDoc(doc(db, 'userData', uid));
  if (!snap.exists()) return false;
  const snapData = snap.data();
  const raw = snapData.data;
  if (!raw) return false;
  try {
    const cloudData = JSON.parse(raw);

    // Timestamp comparison: skip cloud pull if local is newer
    const cloudUpdatedAt = snapData.updatedAt ? snapData.updatedAt.toMillis() : 0;
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
// SOCIAL: Footprints (あしあと)
// ============================================================
async function leaveFootprint(targetUid) {
  if (!isConfigured || !auth.currentUser) return;
  await addDoc(collection(db, 'footprints'), {
    from: auth.currentUser.uid,
    fromName: auth.currentUser.displayName,
    fromPhoto: auth.currentUser.photoURL,
    to: targetUid,
    createdAt: serverTimestamp()
  });
}

async function getFootprints(uid, max) {
  if (!isConfigured) return [];
  max = max || 30;
  const q = query(
    collection(db, 'footprints'),
    where('to', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
}

// ============================================================
// SOCIAL: Friends (フレンド)
// ============================================================
async function sendFriendRequest(targetUid) {
  if (!isConfigured || !auth.currentUser) return;
  await setDoc(doc(db, 'friendRequests', auth.currentUser.uid + '_' + targetUid), {
    from: auth.currentUser.uid,
    fromName: auth.currentUser.displayName,
    to: targetUid,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

async function acceptFriendRequest(requestId, fromUid) {
  if (!isConfigured || !auth.currentUser) return;
  const uid = auth.currentUser.uid;
  // Update request status
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'accepted' });
  // Create bidirectional friend records
  await setDoc(doc(db, 'friends', uid + '_' + fromUid), {
    users: [uid, fromUid], createdAt: serverTimestamp()
  });
  await setDoc(doc(db, 'friends', fromUid + '_' + uid), {
    users: [fromUid, uid], createdAt: serverTimestamp()
  });
}

async function getFriends(uid) {
  if (!isConfigured) return [];
  const q = query(collection(db, 'friends'), where('users', 'array-contains', uid));
  const snap = await getDocs(q);
  const friendUids = [];
  snap.docs.forEach(function(d) {
    const users = d.data().users;
    const friendUid = users[0] === uid ? users[1] : users[0];
    if (friendUids.indexOf(friendUid) === -1) friendUids.push(friendUid);
  });
  // Fetch friend profiles
  const friends = [];
  for (const fuid of friendUids) {
    const uSnap = await getDoc(doc(db, 'users', fuid));
    if (uSnap.exists()) friends.push({ uid: fuid, ...uSnap.data() });
  }
  return friends;
}

// ============================================================
// SOCIAL: Diary Comments (日記コメント)
// ============================================================
async function postComment(entryId, text) {
  if (!isConfigured || !auth.currentUser) return;
  await addDoc(collection(db, 'comments'), {
    entryId: entryId,
    uid: auth.currentUser.uid,
    displayName: auth.currentUser.displayName,
    photoURL: auth.currentUser.photoURL,
    text: text,
    createdAt: serverTimestamp()
  });
}

async function getComments(entryId, max) {
  if (!isConfigured) return [];
  max = max || 50;
  const q = query(
    collection(db, 'comments'),
    where('entryId', '==', entryId),
    orderBy('createdAt', 'asc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
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
  onAuth(async function(user) {
    // Clear previous sync interval on any auth state change
    if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
    if (user) {
      // Only show toast on actual login, not on page reload with cached session
      if (!_isFirstAuth) {
        _toast(user.displayName + 'でログイン中', 'success');
      }
      _isFirstAuth = false;
      const synced = await syncFromCloud(user.uid);
      if (synced) {
        _toast('クラウドからデータを同期しました', 'info');
      }
      _syncInterval = setInterval(function() { syncToCloud(user.uid).catch(function() {}); }, 30000);
    } else {
      _isFirstAuth = false;
    }
  });
}
