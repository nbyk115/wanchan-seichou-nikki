/**
 * わんちゃん成長日記 - KOMOJU 決済モジュール
 *
 * セットアップ手順:
 * 1. https://komoju.com でアカウント作成
 * 2. ダッシュボード → 設定 → APIキー から取得
 * 3. 下の KOMOJU_CONFIG の publishableKey を自分の公開キーに置き換える
 * 4. Cloud Functions（または自前サーバー）に secretKey を設定
 */

// ============================================================
// CONFIG
// ============================================================
const KOMOJU_CONFIG = {
  publishableKey: 'pk_test_2egwjzbogaqk3c42rl78guhi',
  // セッション作成用エンドポイント（Vercel Serverless Functions）
  sessionEndpoint: '/api/payment/create-session',
  plans: {
    monthly: {
      id: 'wanchan_premium_monthly',
      name: 'プレミアムプラン（月額）',
      amount: 480,
      currency: 'JPY',
      interval: 'month',
      features: [
        'AI健康相談 無制限',
        '写真保存 無制限'
      ]
    },
    yearly: {
      id: 'wanchan_premium_yearly',
      name: 'プレミアムプラン（年額）',
      amount: 3980,
      currency: 'JPY',
      interval: 'year',
      features: [
        'AI健康相談 無制限',
        '写真保存 無制限',
        '2ヶ月分おトク！'
      ]
    }
  }
};

const isKomojuConfigured = KOMOJU_CONFIG.publishableKey !== 'YOUR_PUBLISHABLE_KEY';

// ============================================================
// PREMIUM STATE (Firestore参照 + localStorageキャッシュ)
//
// 信頼の源泉: Firestore `premium/{uid}` ドキュメント
// - Webhook/verify で書き込み → クライアントはリードオンリー
// - localStorageはオフラインキャッシュ用（改竄されてもFirestoreで上書き）
// ============================================================

// Firestoreからプレミアム状態をフェッチしてキャッシュに保存
var _premiumCache = null; // { planId, expiresAt, fetchedAt }

async function _fetchPremiumFromFirestore() {
  try {
    var fb = window.__wanchan && window.__wanchan.firebase;
    if (!fb || !fb.isConfigured) return null;
    // firebase-config.js が expose する Firestore doc/getDoc を利用
    // onAuth コールバック内で呼ぶため auth.currentUser は存在する前提
    var auth = fb._getAuth && fb._getAuth();
    if (!auth || !auth.currentUser) return null;

    var uid = auth.currentUser.uid;
    var db = fb._getDb && fb._getDb();
    if (!db) return null;

    // dynamic import はブラウザでキャッシュされるが明示的にモジュールキャッシュを利用
    if (!_fetchPremiumFromFirestore._firestoreModule) {
      _fetchPremiumFromFirestore._firestoreModule = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    }
    var firestore = _fetchPremiumFromFirestore._firestoreModule;
    var snap = await firestore.getDoc(firestore.doc(db, 'premium', uid));

    if (!snap.exists()) {
      _premiumCache = { planId: null, expiresAt: 0, fetchedAt: Date.now() };
      _syncCacheToLocalStorage();
      return _premiumCache;
    }

    var data = snap.data();
    var expiresAtMs = data.expiresAt
      ? (data.expiresAt.toMillis ? data.expiresAt.toMillis() : data.expiresAt)
      : 0;

    _premiumCache = {
      planId: data.planId || data.planKey || null,
      planKey: data.planKey || null,
      expiresAt: expiresAtMs,
      activatedAt: data.activatedAt
        ? (data.activatedAt.toMillis ? data.activatedAt.toMillis() : data.activatedAt)
        : 0,
      fetchedAt: Date.now()
    };
    _syncCacheToLocalStorage();
    return _premiumCache;
  } catch (e) {
    console.warn('Premium Firestore fetch failed, using cache:', e.message);
    return null;
  }
}

function _syncCacheToLocalStorage() {
  if (!_premiumCache) return;
  try {
    localStorage.setItem('wanchan_premium', JSON.stringify(_premiumCache));
  } catch (e) {}
}

function _loadCacheFromLocalStorage() {
  try {
    var data = localStorage.getItem('wanchan_premium');
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

/**
 * プレミアム判定（同期版 — UIレンダリング用）
 * キャッシュがあればキャッシュを参照。なければlocalStorageフォールバック。
 * 正確な判定が必要な場合は isPremiumAsync() を使用。
 */
function isPremium() {
  var cache = _premiumCache || _loadCacheFromLocalStorage();
  if (!cache || !cache.expiresAt) return false;
  return Date.now() < cache.expiresAt;
}

/**
 * プレミアム判定（非同期版 — Firestoreから最新状態を取得）
 * 決済完了後のコールバックやゲーティング処理で使用。
 */
async function isPremiumAsync() {
  var cache = await _fetchPremiumFromFirestore();
  if (!cache) {
    // Firestore到達不能時はローカルキャッシュにフォールバック
    return isPremium();
  }
  return Date.now() < cache.expiresAt;
}

function getPremiumInfo() {
  return _premiumCache || _loadCacheFromLocalStorage();
}

// ログイン時にFirestoreからプレミアム状態を自動取得
window.addEventListener('wanchan-login', function() {
  _fetchPremiumFromFirestore().catch(function() {});
});

// ============================================================
// KOMOJU SESSION
// ============================================================
async function createSession(planKey) {
  if (!isKomojuConfigured) {
    _toast('決済機能はただいま準備中だよ。もう少し待ってね', 'info');
    return null;
  }

  var plan = KOMOJU_CONFIG.plans[planKey];
  if (!plan) {
    _toast('ごめんね、このプランは今利用できないみたい', 'error');
    return null;
  }

  if (!KOMOJU_CONFIG.sessionEndpoint) {
    _toast('決済機能はただいま準備中だよ。もう少し待ってね', 'info');
    return null;
  }

  try {
    // 金額はサーバー側でplanKeyから決定すべき（クライアント送信の金額は改竄リスクあり）
    var headers = { 'Content-Type': 'application/json' };
    // Firebase IDトークンがあれば認証ヘッダーに追加
    try {
      var fb = window.__wanchan && window.__wanchan.firebase;
      if (fb && fb._getIdToken) {
        var idToken = await fb._getIdToken();
        if (idToken) headers['Authorization'] = 'Bearer ' + idToken;
      }
    } catch (_authErr) {}

    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 30000);

    var res = await fetch(KOMOJU_CONFIG.sessionEndpoint, {
      method: 'POST',
      headers: headers,
      signal: controller.signal,
      body: JSON.stringify({
        planKey: planKey,
        metadata: {
          app: 'wanchan-diary',
          plan: planKey
        }
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error('Session creation failed: ' + res.status);
    }

    var session = await res.json();
    return session;
  } catch (e) {
    console.error('KOMOJU session error:', e);
    _toast('お支払いの準備がうまくいかなかったよ。もう一度試してみてね', 'error');
    return null;
  }
}

// ============================================================
// PAYMENT FLOW
// ============================================================
async function startPayment(planKey) {
  var session = await createSession(planKey);
  if (!session || !session.session_url) return;

  // KOMOJU hosted payment page に遷移（URLドメインをホワイトリスト検証）
  try {
    var url = new URL(session.session_url);
    if (!url.hostname.endsWith('komoju.com') && !url.hostname.endsWith('degica.com')) {
      console.error('Unexpected payment URL domain:', url.hostname);
      _toast('お支払いページにうまく進めなかったよ。もう一度試してみてね', 'error');
      return;
    }
  } catch (e) {
    console.error('Invalid payment URL:', session.session_url);
    _toast('お支払いページにうまく進めなかったよ。もう一度試してみてね', 'error');
    return;
  }
  window.location.href = session.session_url;
}

async function handlePaymentCallback() {
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get('session_id');
  var status = params.get('status');

  if (!sessionId) return;

  // URLからパラメータをクリーン
  var cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);

  if (status === 'completed' || status === 'captured') {
    // サーバーサイドでセッションを検証（URLパラメータだけでは偽装可能）
    if (KOMOJU_CONFIG.sessionEndpoint) {
      try {
        // 認証ヘッダーを付与（サーバー側でユーザー特定に必要）
        var verifyHeaders = { 'Content-Type': 'application/json' };
        try {
          var fb = window.__wanchan && window.__wanchan.firebase;
          if (fb && fb._getIdToken) {
            var idToken = await fb._getIdToken();
            if (idToken) verifyHeaders['Authorization'] = 'Bearer ' + idToken;
          }
        } catch (_authErr) {}
        var verifyController = new AbortController();
        var verifyTimeoutId = setTimeout(function() { verifyController.abort(); }, 15000);
        var verifyRes = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: verifyHeaders,
          signal: verifyController.signal,
          body: JSON.stringify({ session_id: sessionId })
        });
        clearTimeout(verifyTimeoutId);
        if (!verifyRes.ok) {
          _toast('お支払いの確認がうまくいかなかったよ。サポートに相談してね', 'error');
          console.error('Payment verification failed:', verifyRes.status);
          return;
        }
        var verifyData = await verifyRes.json();
        if (verifyData.status !== 'completed' && verifyData.status !== 'captured') {
          _toast('お支払いがまだ完了していないみたい。もう一度確認してね', 'error');
          return;
        }
      } catch (e) {
        console.error('Payment verification error:', e);
        // サーバー検証が失敗した場合、プレミアム付与しない（決済偽装防止）
        _toast('お支払いの確認がうまくいかなかったよ。しばらくしてからもう一度アプリを開いてね', 'error');
        return;
      }
    } else {
      console.error('SECURITY ERROR: No sessionEndpoint configured. Cannot verify payment.');
      _toast('お支払いの確認ができませんでした。サポートに相談してね', 'error');
      return;
    }

    // verify API が Firestore に書き込み済み → クライアントはFirestoreからキャッシュ更新
    await _fetchPremiumFromFirestore();
    _toast('プレミアムプランに登録しました！', 'success');
  } else if (status === 'cancelled') {
    _toast('お支払いがキャンセルされたよ', 'info');
  } else if (status === 'failed') {
    _toast('お支払いがうまくいかなかったみたい。もう一度試してみてね', 'error');
  }
}

// ============================================================
// PREMIUM UI
// ============================================================
function renderPremiumBadge() {
  if (!isPremium()) return '';
  return '<span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#FFD700,#FFA500);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;">★ プレミアム</span>';
}

function showPremiumModal() {
  // ファネル計測: モーダル表示イベントを自動送信
  try {
    var analytics = window.__wanchan && window.__wanchan.analytics;
    if (analytics && typeof analytics.trackPremiumView === 'function') {
      analytics.trackPremiumView();
    }
  } catch (_e) {}

  // 既存のモーダルがあれば削除
  var existing = document.getElementById('wanchan-premium-modal');
  if (existing) existing.remove();

  var currentPlan = isPremium() ? getPremiumInfo() : null;
  var plans = KOMOJU_CONFIG.plans;

  var overlay = document.createElement('div');
  overlay.id = 'wanchan-premium-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;animation:ux-fade-in .2s ease;';

  var modal = document.createElement('div');
  var _isDarkMode = document.body.classList.contains('ux-dark-on') ||
    (document.body.classList.contains('ux-dark-auto') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  modal.style.cssText = 'background:' + (_isDarkMode ? '#1e1e2e' : '#fff') + ';border-radius:24px;max-width:380px;width:100%;padding:32px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto;color:' + (_isDarkMode ? '#e0e0e0' : '#333') + ';';

  var html = '';
  html += '<div style="font-size:48px;margin-bottom:12px;">🐾✨</div>';
  html += '<h2 style="font-size:22px;font-weight:900;color:#333;margin-bottom:6px;">プレミアムプラン</h2>';
  html += '<p style="font-size:14px;color:#888;margin-bottom:24px;line-height:1.6;">もっと便利に、もっと楽しく<br>わんちゃんとの毎日を記録</p>';

  if (currentPlan) {
    var expDate = new Date(currentPlan.expiresAt);
    html += '<div style="background:#FFF8F0;border:1.5px solid #FFD700;border-radius:16px;padding:16px;margin-bottom:20px;">';
    html += '<div style="font-size:14px;font-weight:700;color:#F59E0B;">★ プレミアム会員</div>';
    html += '<div style="font-size:12px;color:#888;margin-top:4px;">有効期限: ' + expDate.toLocaleDateString('ja-JP') + '</div>';
    html += '</div>';
  }

  // 月額プラン
  html += '<div id="plan-monthly" style="border:2px solid #FF7B9C;border-radius:18px;padding:20px;margin-bottom:12px;cursor:pointer;transition:transform .15s;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
  html += '<div style="text-align:left;">';
  html += '<div style="font-size:15px;font-weight:700;color:#333;">' + plans.monthly.name + '</div>';
  html += '<div style="font-size:12px;color:#888;margin-top:4px;">月々のお支払い</div>';
  html += '</div>';
  html += '<div style="font-size:24px;font-weight:900;color:#FF7B9C;">¥' + plans.monthly.amount.toLocaleString() + '</div>';
  html += '</div>';
  html += '</div>';

  // 年額プラン
  html += '<div id="plan-yearly" style="border:2px solid #16A34A;border-radius:18px;padding:20px;margin-bottom:20px;cursor:pointer;position:relative;transition:transform .15s;">';
  html += '<div style="position:absolute;top:-10px;right:16px;background:#16A34A;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;">おトク</div>';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
  html += '<div style="text-align:left;">';
  html += '<div style="font-size:15px;font-weight:700;color:#333;">' + plans.yearly.name + '</div>';
  html += '<div style="font-size:12px;color:#888;margin-top:4px;">月あたり約¥' + Math.round(plans.yearly.amount / 12).toLocaleString() + '</div>';
  html += '</div>';
  html += '<div style="font-size:24px;font-weight:900;color:#16A34A;">¥' + plans.yearly.amount.toLocaleString() + '</div>';
  html += '</div>';
  html += '</div>';

  // 機能リスト
  html += '<div style="text-align:left;margin-bottom:24px;">';
  plans.monthly.features.forEach(function(f) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:14px;color:#555;">';
    html += '<span style="color:#16A34A;font-weight:700;">✓</span> ' + f;
    html += '</div>';
  });
  html += '</div>';

  if (!isKomojuConfigured) {
    html += '<div style="background:#FEF3C7;border-radius:12px;padding:12px;margin-bottom:16px;font-size:12px;color:#92400E;line-height:1.5;">';
    html += '⚠️ 決済機能は現在準備中です。<br>もうしばらくお待ちください。';
    html += '</div>';
  }

  // 閉じるボタン
  html += '<button id="premium-close" style="width:100%;padding:14px;border:none;border-radius:14px;background:#f0f0f0;color:#888;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">閉じる</button>';

  modal.innerHTML = html;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // イベント
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  var closeBtn = document.getElementById('premium-close');
  if (closeBtn) closeBtn.addEventListener('click', function() { overlay.remove(); });

  function _trackPlanSelect(planKey) {
    try {
      var a = window.__wanchan && window.__wanchan.analytics;
      if (a && typeof a.trackPremiumPlanSelect === 'function') a.trackPremiumPlanSelect(planKey);
    } catch (_e) {}
  }

  var monthlyBtn = document.getElementById('plan-monthly');
  if (monthlyBtn) {
    monthlyBtn.addEventListener('click', function() {
      if (!isKomojuConfigured) { _toast('決済機能はただいま準備中だよ', 'info'); return; }
      if (currentPlan) { _toast('もうプレミアムを使っているよ', 'info'); return; }
      _trackPlanSelect('monthly');
      startPayment('monthly');
    });
    monthlyBtn.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.02)'; });
    monthlyBtn.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
  }

  var yearlyBtn = document.getElementById('plan-yearly');
  if (yearlyBtn) {
    yearlyBtn.addEventListener('click', function() {
      if (!isKomojuConfigured) { _toast('決済機能はただいま準備中だよ', 'info'); return; }
      if (currentPlan) { _toast('もうプレミアムを使っているよ', 'info'); return; }
      _trackPlanSelect('yearly');
      startPayment('yearly');
    });
    yearlyBtn.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.02)'; });
    yearlyBtn.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
  }
}

// ============================================================
// TOAST HELPER
// ============================================================
function _toast(msg, type) {
  var fn = window.__wanchan && window.__wanchan.showToast;
  if (fn) fn(msg, type);
}

// ============================================================
// EXPOSE TO APP
// ============================================================
window.__wanchan = window.__wanchan || {};
Object.assign(window.__wanchan, {
  payment: {
    isConfigured: isKomojuConfigured,
    isPremium: isPremium,
    isPremiumAsync: isPremiumAsync,
    getPremiumInfo: getPremiumInfo,
    showPremiumModal: showPremiumModal,
    renderPremiumBadge: renderPremiumBadge,
    startPayment: startPayment
  }
});

// ============================================================
// AUTO: Check payment callback on load (IIFEでエラー伝播を遮断)
// ============================================================
(async function _bootPaymentCallback() {
  try {
    await handlePaymentCallback();
  } catch (e) {
    console.error('handlePaymentCallback failed:', e);
  }
})();

// ============================================================
// AUTO: premium.html の ?plan=monthly / ?plan=yearly 遷移を検知
// → モーダルを自動表示して決済フローへ誘導（ログイン必須の場合はindex.html側でガード）
// ============================================================
(function _openModalFromQuery() {
  try {
    var params = new URLSearchParams(window.location.search);
    var plan = params.get('plan');
    if (plan !== 'monthly' && plan !== 'yearly') return;

    // URLをクリーン（リロードで何度も開かないため）
    var clean = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', clean);

    // DOMContentLoaded後に表示（モーダルDOM挿入のため）
    function open() {
      try { showPremiumModal(); } catch (_e) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', open, { once: true });
    } else {
      setTimeout(open, 300);
    }
  } catch (_e) {}
})();
