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
  publishableKey: 'YOUR_PUBLISHABLE_KEY',
  // セッション作成用エンドポイント（自前サーバーまたは Cloud Functions）
  sessionEndpoint: '',
  plans: {
    monthly: {
      id: 'wanchan_premium_monthly',
      name: 'プレミアムプラン（月額）',
      amount: 480,
      currency: 'JPY',
      interval: 'month',
      features: [
        'AI健康相談 無制限',
        '写真保存 無制限',
        '広告なし',
        'クラウド同期'
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
        '広告なし',
        'クラウド同期',
        '2ヶ月分おトク！'
      ]
    }
  }
};

const isKomojuConfigured = KOMOJU_CONFIG.publishableKey !== 'YOUR_PUBLISHABLE_KEY';

// ============================================================
// PREMIUM STATE
// ============================================================
function isPremium() {
  try {
    var data = localStorage.getItem('wanchan_premium');
    if (!data) return false;
    var parsed = JSON.parse(data);
    if (!parsed || !parsed.expiresAt) return false;
    return Date.now() < parsed.expiresAt;
  } catch (e) {
    return false;
  }
}

function setPremiumStatus(planId, expiresAt) {
  localStorage.setItem('wanchan_premium', JSON.stringify({
    planId: planId,
    activatedAt: Date.now(),
    expiresAt: expiresAt
  }));
}

function getPremiumInfo() {
  try {
    var data = localStorage.getItem('wanchan_premium');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// KOMOJU SESSION
// ============================================================
async function createSession(planKey) {
  if (!isKomojuConfigured) {
    _toast('KOMOJU未設定です', 'error');
    return null;
  }

  var plan = KOMOJU_CONFIG.plans[planKey];
  if (!plan) {
    _toast('プランが見つかりません', 'error');
    return null;
  }

  if (!KOMOJU_CONFIG.sessionEndpoint) {
    _toast('決済サーバーが未設定です', 'error');
    return null;
  }

  try {
    var res = await fetch(KOMOJU_CONFIG.sessionEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: plan.amount,
        currency: plan.currency,
        planId: plan.id,
        planKey: planKey,
        metadata: {
          app: 'wanchan-diary',
          plan: planKey
        }
      })
    });

    if (!res.ok) {
      throw new Error('Session creation failed: ' + res.status);
    }

    var session = await res.json();
    return session;
  } catch (e) {
    console.error('KOMOJU session error:', e);
    _toast('決済セッションの作成に失敗しました', 'error');
    return null;
  }
}

// ============================================================
// PAYMENT FLOW
// ============================================================
async function startPayment(planKey) {
  var session = await createSession(planKey);
  if (!session || !session.session_url) return;

  // KOMOJU hosted payment page に遷移
  window.location.href = session.session_url;
}

function handlePaymentCallback() {
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get('session_id');
  var status = params.get('status');

  if (!sessionId) return;

  // URLからパラメータをクリーン
  var cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);

  if (status === 'completed' || status === 'captured') {
    // 決済成功
    var planKey = params.get('plan') || 'monthly';
    var plan = KOMOJU_CONFIG.plans[planKey];
    var duration = planKey === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    setPremiumStatus(plan ? plan.id : planKey, Date.now() + duration);
    _toast('プレミアムプランに登録しました！', 'success');
  } else if (status === 'cancelled') {
    _toast('決済がキャンセルされました', 'info');
  } else if (status === 'failed') {
    _toast('決済に失敗しました。もう一度お試しください', 'error');
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
  // 既存のモーダルがあれば削除
  var existing = document.getElementById('wanchan-premium-modal');
  if (existing) existing.remove();

  var currentPlan = isPremium() ? getPremiumInfo() : null;
  var plans = KOMOJU_CONFIG.plans;

  var overlay = document.createElement('div');
  overlay.id = 'wanchan-premium-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;animation:ux-fade-in .2s ease;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:24px;max-width:380px;width:100%;padding:32px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto;';

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

  var monthlyBtn = document.getElementById('plan-monthly');
  if (monthlyBtn) {
    monthlyBtn.addEventListener('click', function() {
      if (!isKomojuConfigured) { _toast('決済機能は準備中です', 'info'); return; }
      if (currentPlan) { _toast('すでにプレミアム会員です', 'info'); return; }
      startPayment('monthly');
    });
    monthlyBtn.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.02)'; });
    monthlyBtn.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
  }

  var yearlyBtn = document.getElementById('plan-yearly');
  if (yearlyBtn) {
    yearlyBtn.addEventListener('click', function() {
      if (!isKomojuConfigured) { _toast('決済機能は準備中です', 'info'); return; }
      if (currentPlan) { _toast('すでにプレミアム会員です', 'info'); return; }
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
    getPremiumInfo: getPremiumInfo,
    showPremiumModal: showPremiumModal,
    renderPremiumBadge: renderPremiumBadge,
    startPayment: startPayment
  }
});

// ============================================================
// AUTO: Check payment callback on load
// ============================================================
handlePaymentCallback();
