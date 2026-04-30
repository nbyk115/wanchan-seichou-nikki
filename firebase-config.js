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
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, GoogleAuthProvider }
  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, orderBy, limit, serverTimestamp, onSnapshot, deleteDoc, updateDoc, writeBatch, increment,
  persistentLocalCache, persistentSingleTabManager, initializeFirestore }
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
  appId: "1:151633084436:web:ac8ffa692e4ba1839a2701",
  measurementId: "G-G4YK4WGZPQ"
};

// Skip initialization if config is not set
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app, auth, db;
if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // enableIndexedDbPersistence は v10+ で非推奨。initializeFirestore + persistentLocalCache に移行。
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
    });
  } catch (persistErr) {
    // 永続化がサポートされないブラウザ or 既に初期化済みの場合はフォールバック
    console.warn('Firestore persistent cache unavailable, using default:', persistErr.message);
    db = getFirestore(app);
  }

  // リダイレクトログイン後の復帰処理（Safari等のポップアップブロック環境）
  getRedirectResult(auth).then(async (result) => {
    if (!result || !result.user) return;
    await setDoc(doc(db, 'users', result.user.uid), {
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      lastLogin: serverTimestamp()
    }, { merge: true });
    window.dispatchEvent(new CustomEvent('wanchan-login', { detail: { uid: result.user.uid } }));
  }).catch((err) => {
    // redirect-cancelled / no-redirect は正常系なので無視。それ以外はログ出力
    if (err && err.code !== 'auth/redirect-cancelled-by-user' && err.code !== 'auth/no-auth-event') {
      console.warn('getRedirectResult error:', err.code || err.message);
    }
  });
}

// ============================================================
// AUTH
// ============================================================
async function login() {
  if (!isConfigured) {
    _toast('アプリの準備がまだ完了していないよ。もう少し待ってみてね', 'error');
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
    if (e.code === 'auth/network-request-failed') {
      _toast('つながりにくいみたい。もう少ししてから試してね', 'error');
    } else if (e.code === 'auth/too-many-requests') {
      _toast('何度も試したためしばらく待ってね。少し時間をおいてから試してみてね', 'error');
    } else if (e.code !== 'auth/popup-closed-by-user') {
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

// Collect app data keys (only wanchan_ prefixed keys — prevent leaking other apps' data)
const APP_DATA_PREFIX = 'wanchan_';
function _getAppData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(APP_DATA_PREFIX)) {
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
      if (key && key.startsWith(APP_DATA_PREFIX) && !cloudKeys.has(key)) {
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
// INPUT SANITIZATION
// ============================================================
/** Strip HTML tags to prevent stored XSS when content is rendered with innerHTML elsewhere */
function _sanitizeText(text) {
  if (!text) return '';
  return text.replace(/[<>&"']/g, function(c) {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
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
// Ensure namespace exists without overwriting other modules' additions
if (!window.__wanchan) window.__wanchan = {};
window.__wanchan.firebase = {
    isConfigured: isConfigured,
    login: login,
    logout: logout,
    onAuth: onAuth,
    // 他モジュール（komoju-payment.js等）からFirestore/Authインスタンスを取得するためのヘルパー
    _getAuth: function() { return auth; },
    _getDb: function() { return db; },
    _getIdToken: async function() {
      try { return auth && auth.currentUser ? await auth.currentUser.getIdToken() : null; }
      catch (_) { return null; }
    },
    syncToCloud: syncToCloud,
    syncFromCloud: syncFromCloud,
  };

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
      // Only sync when tab is visible (save battery/Firestore costs)
      _syncInterval = setInterval(function() {
        if (document.visibilityState !== 'hidden') {
          syncToCloud(user.uid).catch(function() {});
        }
      }, 30000);
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
        if (json !== _lastSyncHash) {
          // Mark that we have unsent changes (will sync on next load)
          try { localStorage.setItem('ux_pending_sync', '1'); } catch (_) {}
        }
      } catch (_) {}
    }
  });
}
