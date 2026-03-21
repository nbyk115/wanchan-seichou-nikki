/**
 * わんちゃん成長日記 - Analytics モジュール
 *
 * Firebase Analytics (GA4) によるイベント計測
 * 主要KPI: WAD (Weekly Active Diarists), DAU/MAU, 機能利用率
 *
 * セットアップ:
 * 1. Firebase Console → Analytics を有効化
 * 2. measurementId を設定（GA4の測定ID）
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAnalytics, logEvent as _logEvent, setUserId, setUserProperties }
  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js';

// ============================================================
// CONFIG
// ============================================================
const ANALYTICS_CONFIG = {
  // GA4 Measurement ID（Firebase Console → プロジェクト設定 → 全般 で確認）
  measurementId: ''
};

// ============================================================
// INIT
// ============================================================
let analytics = null;

function init() {
  try {
    // Firebase app は firebase-config.js で既に初期化済みのはず
    var apps = getApps();
    if (apps.length === 0) return;
    analytics = getAnalytics(apps[0]);
  } catch (e) {
    // Analytics SDK が読み込めない場合は graceful に無視
    console.warn('Analytics init skipped:', e.message);
  }
}

// ページロード時に初期化
init();

// ============================================================
// EVENT LOGGING
// ============================================================
function logEvent(name, params) {
  if (!analytics) return;
  try {
    _logEvent(analytics, name, params || {});
  } catch (e) {
    // fail silently
  }
}

function setUser(uid) {
  if (!analytics || !uid) return;
  try { setUserId(analytics, uid); } catch (e) {}
}

function setProperties(props) {
  if (!analytics) return;
  try { setUserProperties(analytics, props); } catch (e) {}
}

// ============================================================
// PREDEFINED EVENTS (Top 10)
// ============================================================

// 1. 日記投稿
function trackDiaryEntry(wordCount) {
  logEvent('diary_entry', { word_count: wordCount || 0 });
}

// 2. 体重記録
function trackWeightLog(weight, dogBreed) {
  logEvent('weight_log', { weight: weight, breed: dogBreed || '' });
}

// 3. 写真アップロード
function trackPhotoUpload(count) {
  logEvent('photo_upload', { count: count || 1 });
}

// 4. AI健康相談
function trackAIConsultation(questionLength, isFallback) {
  logEvent('ai_consultation', {
    question_length: questionLength || 0,
    fallback: isFallback ? 'true' : 'false'
  });
}

// 5. SNSシェア
function trackShare(platform, contentType) {
  logEvent('content_share', {
    platform: platform || 'unknown',
    content_type: contentType || 'diary'
  });
}

// 6. 足あと閲覧
function trackFootprintView() {
  logEvent('footprint_view');
}

// 7. 犬友リクエスト
function trackFriendRequest() {
  logEvent('friend_request');
}

// 8. コメント投稿
function trackComment() {
  logEvent('comment_post');
}

// 9. ログイン
function trackLogin() {
  logEvent('login', { method: 'google' });
}

// 10. ページビュー
function trackPageView(pageName) {
  logEvent('page_view', { page_name: pageName || 'home' });
}

// ============================================================
// AUTO-TRACKING: Session & Page Views
// ============================================================
(function autoTrack() {
  // Session start
  logEvent('session_start');

  // Track dog profile info for user properties
  try {
    var appData = JSON.parse(localStorage.getItem('wc2') || '{}');
    if (appData.name) {
      setProperties({
        has_dog_profile: 'true',
        dog_breed: appData.breed || 'unknown'
      });
    }
  } catch (e) {}

  // Track when user has used the app this week (WAD calculation)
  var today = new Date().toISOString().slice(0, 10);
  var lastActive = localStorage.getItem('ux_last_active_date');
  if (lastActive !== today) {
    localStorage.setItem('ux_last_active_date', today);
    logEvent('daily_active');
  }
})();

// ============================================================
// EXPOSE TO APP
// ============================================================
window.__wanchan = window.__wanchan || {};
Object.assign(window.__wanchan, {
  analytics: {
    logEvent: logEvent,
    setUser: setUser,
    setProperties: setProperties,
    trackDiaryEntry: trackDiaryEntry,
    trackWeightLog: trackWeightLog,
    trackPhotoUpload: trackPhotoUpload,
    trackAIConsultation: trackAIConsultation,
    trackShare: trackShare,
    trackFootprintView: trackFootprintView,
    trackFriendRequest: trackFriendRequest,
    trackComment: trackComment,
    trackLogin: trackLogin,
    trackPageView: trackPageView
  }
});
