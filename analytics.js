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

// PII保護: UIDを先頭8文字に切り詰めてGA4送信用匿名IDを生成
function _anonId(uid) {
  return uid ? uid.substring(0, 8) : '';
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
function trackFootprintView(source, variant, count) {
  logEvent('footprint_view', {
    source: source || 'notification',
    variant: variant || 'none',
    count: count || 0
  });
}

// 7. 犬友リクエスト
function trackFriendRequest(source, variant) {
  logEvent('friend_request', {
    source: source || 'unknown',
    variant: variant || 'none'
  });
}

// 8. コメント投稿
function trackComment(entryId, wordCount, isReply) {
  logEvent('comment_post', {
    entry_id: entryId || '',
    word_count: wordCount || 0,
    is_reply: isReply ? 'true' : 'false'
  });
}

// ============================================================
// A/B TEST FRAMEWORK
// ============================================================

// テスト群の割り当て（Deterministic hashing by user_id）
function getTestVariant(testId, userId) {
  if (!userId) return 'control';
  var hash = 0;
  var str = testId + '_' + userId;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return (Math.abs(hash) % 100) < 50 ? 'control' : 'treatment';
}

function trackTestExposure(testId, variant) {
  logEvent('ab_test_exposure', {
    test_id: testId,
    variant: variant,
    timestamp: Date.now()
  });
}

// ============================================================
// COMMUNITY EVENTS (犬友ひろば計測)
// ============================================================

function trackCommunityTabOpen(tabName, variant) {
  logEvent('community_tab_open', {
    tab_name: tabName,
    variant: variant || 'none'
  });
}

function trackCommunityTabSwitch(fromTab, toTab, variant) {
  logEvent('community_tab_switch', {
    from_tab: fromTab,
    to_tab: toTab,
    variant: variant || 'none'
  });
}

function trackFootprintLeave(targetUserId, source) {
  logEvent('footprint_leave', {
    target_user_id: _anonId(targetUserId),
    source: source || 'profile'
  });
}

function trackFootprintListView(countShown, variant) {
  logEvent('footprint_list_view', {
    count_shown: countShown || 0,
    variant: variant || 'none'
  });
}

function trackFootprintTap(targetUserId) {
  logEvent('footprint_tap', { target_user_id: _anonId(targetUserId) });
}

function trackProfileView(source, targetUserId, variant) {
  logEvent('profile_view', {
    source: source || 'unknown',
    target_user_id: _anonId(targetUserId),
    variant: variant || 'none'
  });
}

function trackCarouselSwipe(direction, positionIndex) {
  logEvent('carousel_swipe', {
    direction: direction || 'right',
    position_index: positionIndex || 0
  });
}

function trackCommentExpand(entryId, expandedCount) {
  logEvent('comment_expand', {
    entry_id: entryId || '',
    expanded_count: expandedCount || 0
  });
}

function trackFriendSearchView(variant, resultCount) {
  logEvent('friend_search_view', {
    variant: variant || 'none',
    result_count: resultCount || 0
  });
}

function trackFriendRequestAccept(requestId) {
  logEvent('friend_request_accept', { request_id: requestId || '' });
}

function trackDiaryFeedScroll(scrollDepthPct, itemsViewed) {
  logEvent('diary_feed_scroll', {
    scroll_depth_pct: scrollDepthPct || 0,
    items_viewed: itemsViewed || 0
  });
}

function trackBlockReport(targetUserId, reason) {
  logEvent('block_report', {
    target_user_id: _anonId(targetUserId),
    reason: reason || 'other'
  });
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
// LOGIN EVENT BRIDGE
// firebase-config.js が dispatch する CustomEvent を受け取り
// setUser + trackLogin を実行（循環依存を避けるための疎結合設計）
// ============================================================
window.addEventListener('wanchan-login', function(e) {
  if (e.detail && e.detail.uid) {
    setUser(e.detail.uid);
    trackLogin();
  }
});

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
    trackPageView: trackPageView,
    // A/B Test
    getTestVariant: getTestVariant,
    trackTestExposure: trackTestExposure,
    // Community
    trackCommunityTabOpen: trackCommunityTabOpen,
    trackCommunityTabSwitch: trackCommunityTabSwitch,
    trackFootprintLeave: trackFootprintLeave,
    trackFootprintListView: trackFootprintListView,
    trackFootprintTap: trackFootprintTap,
    trackProfileView: trackProfileView,
    trackCarouselSwipe: trackCarouselSwipe,
    trackCommentExpand: trackCommentExpand,
    trackFriendSearchView: trackFriendSearchView,
    trackFriendRequestAccept: trackFriendRequestAccept,
    trackDiaryFeedScroll: trackDiaryFeedScroll,
    trackBlockReport: trackBlockReport
  }
});
