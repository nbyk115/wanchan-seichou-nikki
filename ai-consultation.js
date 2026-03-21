/**
 * わんちゃん成長日記 - AI健康相談モジュール
 *
 * 機能:
 * - 犬の健康に関するAI相談（プロキシ経由でClaude API）
 * - 月間利用回数カウント（フリーミアム制御）
 * - 相談履歴の保存
 *
 * セットアップ:
 * 1. Cloud Functions 等でプロキシエンドポイントを用意
 * 2. AI_CONFIG.endpoint に URL を設定
 */

// ============================================================
// CONFIG
// ============================================================
const AI_CONFIG = {
  // プロキシエンドポイント（Cloud Functions / Vercel 等）
  // ユーザーからのリクエストを受け取り、サーバー側で Claude API を呼ぶ
  endpoint: '',
  // 無料枠: 月5回
  freeLimit: 5,
  // モデル指定（プロキシ側で使用）
  model: 'claude-sonnet-4-20250514'
};

// ============================================================
// USAGE TRACKING
// ============================================================
function _getUsageKey() {
  var now = new Date();
  return 'wanchan_ai_usage_' + now.getFullYear() + '_' + (now.getMonth() + 1);
}

function getUsageCount() {
  try {
    return parseInt(localStorage.getItem(_getUsageKey()) || '0', 10);
  } catch (e) {
    return 0;
  }
}

function incrementUsage() {
  var key = _getUsageKey();
  var count = getUsageCount() + 1;
  localStorage.setItem(key, String(count));
  return count;
}

function getRemainingCount() {
  // プレミアム判定: wp フラグが立っていて2099年でない場合はプレミアム
  try {
    var wp = JSON.parse(localStorage.getItem('wp') || '{}');
    // 全機能無料開放中（2099年）は無料ユーザーとして扱う
    if (wp.on && wp.exp && !wp.exp.startsWith('2099')) {
      return Infinity; // プレミアムは無制限
    }
  } catch (e) {}
  return Math.max(0, AI_CONFIG.freeLimit - getUsageCount());
}

function canUseAI() {
  return getRemainingCount() > 0;
}

// ============================================================
// CONSULTATION HISTORY
// ============================================================
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('wanchan_ai_history') || '[]');
  } catch (e) {
    return [];
  }
}

function saveToHistory(question, answer) {
  var history = getHistory();
  history.unshift({
    q: question,
    a: answer,
    ts: Date.now()
  });
  // 最新50件のみ保持
  if (history.length > 50) history = history.slice(0, 50);
  localStorage.setItem('wanchan_ai_history', JSON.stringify(history));
}

// ============================================================
// DOG CONTEXT
// ============================================================
function _getDogContext() {
  try {
    var appData = JSON.parse(localStorage.getItem('wc2') || '{}');
    var ctx = [];
    if (appData.name) ctx.push('犬の名前: ' + appData.name);
    if (appData.breed) ctx.push('犬種: ' + appData.breed);
    if (appData.birthday) ctx.push('誕生日: ' + appData.birthday);
    if (appData.weights && appData.weights.length > 0) {
      var latest = appData.weights[appData.weights.length - 1];
      ctx.push('最新体重: ' + latest.weight + 'kg (' + latest.date + ')');
    }
    return ctx.length > 0 ? ctx.join('\n') : '';
  } catch (e) {
    return '';
  }
}

// ============================================================
// AI API CALL
// ============================================================
const SYSTEM_PROMPT = `あなたは犬の健康に詳しい優しいアドバイザーです。
飼い主からの相談に、わかりやすく丁寧に回答してください。

重要なルール:
- あなたは獣医師ではありません。「獣医療行為」は行えません
- 深刻な症状（意識がない、大量出血、けいれん等）の場合は「すぐに動物病院へ」と案内してください
- 回答の最後に必ず「※この回答はAIによる参考情報です。心配な場合は獣医師にご相談ください。」と付記してください
- 簡潔に、3〜5文程度で回答してください
- 専門用語は避け、飼い主にわかりやすい言葉を使ってください`;

async function askAI(question) {
  if (!question || !question.trim()) {
    return { error: '質問を入力してください' };
  }

  if (!canUseAI()) {
    return {
      error: '今月の無料相談回数（' + AI_CONFIG.freeLimit + '回）を使い切りました。\nプレミアムプランにアップグレードすると無制限でご利用いただけます。',
      limitReached: true
    };
  }

  var dogCtx = _getDogContext();
  var userMessage = dogCtx
    ? '【うちの子の情報】\n' + dogCtx + '\n\n【相談内容】\n' + question
    : question;

  // エンドポイント未設定の場合はローカルフォールバック
  if (!AI_CONFIG.endpoint) {
    return _localFallback(question);
  }

  try {
    var res = await fetch(AI_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        systemPrompt: SYSTEM_PROMPT,
        model: AI_CONFIG.model
      })
    });

    if (!res.ok) {
      throw new Error('API error: ' + res.status);
    }

    var data = await res.json();
    var answer = data.answer || data.content || data.text || '';

    if (answer) {
      incrementUsage();
      saveToHistory(question, answer);
      // Analytics event
      _trackEvent('ai_consultation', { question_length: question.length });
    }

    return { answer: answer };
  } catch (e) {
    console.error('AI consultation error:', e);
    return _localFallback(question);
  }
}

// ============================================================
// LOCAL FALLBACK (エンドポイント未設定時)
// ============================================================
function _localFallback(question) {
  var q = question.toLowerCase();
  var answer = '';

  // キーワードベースの簡易応答
  if (q.includes('下痢') || q.includes('軟便')) {
    answer = 'わんちゃんの下痢は、食べ過ぎ・ストレス・食事の変更などが一般的な原因です。\n\n水分をしっかり摂らせて、半日〜1日は食事を控えめにしてみてください。ただし、血便が混じる・元気がない・嘔吐も伴う場合は、すぐに動物病院を受診してください。\n\n※この回答はAIによる参考情報です。心配な場合は獣医師にご相談ください。';
  } else if (q.includes('嘔吐') || q.includes('吐')) {
    answer = 'わんちゃんが吐くのは比較的よくあることですが、注意が必要な場合もあります。\n\n1回だけで元気があれば、しばらく様子を見てください。ただし、何度も繰り返す・ぐったりしている・血が混じる・異物を飲み込んだ可能性がある場合は、すぐに動物病院を受診してください。\n\n※この回答はAIによる参考情報です。心配な場合は獣医師にご相談ください。';
  } else if (q.includes('食欲') || q.includes('食べない') || q.includes('ごはん')) {
    answer = 'わんちゃんの食欲低下は、体調不良・ストレス・フードの飽き・暑さなど様々な原因が考えられます。\n\n1〜2食分なら様子見でOKですが、丸1日以上食べない・水も飲まない・元気がない場合は動物病院に相談しましょう。フードを少し温めたり、トッピングを加えると食べてくれることもあります。\n\n※この回答はAIによる参考情報です。心配な場合は獣医師にご相談ください。';
  } else if (q.includes('散歩') || q.includes('運動')) {
    answer = '犬種や年齢によって必要な運動量は異なりますが、一般的には1日2回、各15〜30分程度のお散歩が目安です。\n\n子犬は無理させず短めに、シニア犬はゆっくりペースで。暑い日は早朝・夕方以降に、アスファルトの温度にも注意してあげてくださいね。\n\n※この回答はAIによる参考情報です。心配な場合は獣医師にご相談ください。';
  } else if (q.includes('皮膚') || q.includes('かゆ') || q.includes('フケ') || q.includes('湿疹')) {
    answer = 'わんちゃんの皮膚トラブルは、アレルギー・乾燥・ノミ/ダニ・真菌感染など原因は様々です。\n\nまずは患部を清潔に保ち、掻きすぎないよう注意してあげてください。広範囲に広がる・脱毛がある・悪臭がする場合は、早めに動物病院で診てもらいましょう。\n\n※この回答はAIによる参考情報です。心配な場合は獣医師にご相談ください。';
  } else if (q.includes('ワクチン') || q.includes('予防接種')) {
    answer = 'わんちゃんのワクチンは、混合ワクチン（5種〜9種）と狂犬病ワクチンがあります。\n\n子犬は生後2〜4ヶ月に2〜3回の混合ワクチン接種が推奨されます。狂犬病ワクチンは法律で年1回の接種が義務づけられています。かかりつけの動物病院でスケジュールを相談してくださいね。\n\n※この回答はAIによる参考情報です。心配な場合は獣医師にご相談ください。';
  } else {
    answer = 'ご相談ありがとうございます。\n\nお伝えいただいた内容について、一般的なアドバイスをさせていただきます。わんちゃんの体調で気になることがある場合は、症状の経過（いつから・どのくらいの頻度か）を記録して、かかりつけの動物病院に相談されることをおすすめします。\n\nこのアプリの日記機能で症状を記録しておくと、獣医さんに伝えやすくなりますよ。\n\n※この回答はAIによる参考情報です。心配な場合は獣医師にご相談ください。';
  }

  incrementUsage();
  saveToHistory(question, answer);
  _trackEvent('ai_consultation', { question_length: question.length, fallback: true });

  return { answer: answer };
}

// Analytics helper (graceful if not loaded)
function _trackEvent(name, params) {
  var fn = window.__wanchan && window.__wanchan.analytics && window.__wanchan.analytics.logEvent;
  if (fn) fn(name, params);
}

// ============================================================
// UI: CONSULTATION MODAL
// ============================================================
function showConsultationModal() {
  var existing = document.getElementById('wanchan-ai-modal');
  if (existing) existing.remove();

  var remaining = getRemainingCount();
  var isUnlimited = remaining === Infinity;

  var overlay = document.createElement('div');
  overlay.id = 'wanchan-ai-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10001;display:flex;align-items:flex-end;justify-content:center;padding:0;animation:ux-fade-in .2s ease;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:24px 24px 0 0;max-width:500px;width:100%;padding:24px 20px env(safe-area-inset-bottom,20px);box-shadow:0 -10px 40px rgba(0,0,0,.15);max-height:85vh;display:flex;flex-direction:column;';

  // ダークモード対応
  var isDark = document.body.classList.contains('ux-dark-on') ||
    (document.body.classList.contains('ux-dark-auto') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    modal.style.background = '#1e1e2e';
    modal.style.color = '#e0e0e0';
  }

  var html = '';

  // ヘッダー
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
  html += '<div style="display:flex;align-items:center;gap:10px;">';
  html += '<span style="font-size:28px;">🩺</span>';
  html += '<div>';
  html += '<div style="font-size:18px;font-weight:900;">AI健康相談</div>';
  html += '<div style="font-size:12px;color:#888;">わんちゃんの気になることを聞いてみよう</div>';
  html += '</div>';
  html += '</div>';
  html += '<div id="ai-close" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:' + (isDark ? '#333' : '#f0f0f0') + ';cursor:pointer;font-size:16px;">✕</div>';
  html += '</div>';

  // 残り回数
  html += '<div style="background:' + (isDark ? '#2a2a3e' : '#FFF8F0') + ';border-radius:12px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;font-size:13px;">';
  if (isUnlimited) {
    html += '<span style="color:#16A34A;font-weight:700;">★ プレミアム — 無制限</span>';
  } else {
    html += '<span>今月の残り回数</span>';
    html += '<span style="font-weight:900;color:' + (remaining <= 1 ? '#EF4444' : '#F59E0B') + ';">' + remaining + ' / ' + AI_CONFIG.freeLimit + ' 回</span>';
  }
  html += '</div>';

  // よくある相談（クイックボタン）
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">';
  var quickQuestions = [
    { label: '🤢 吐いた', q: 'うちの犬が吐いてしまいました。どうしたらいいですか？' },
    { label: '💩 下痢', q: 'うちの犬が下痢をしています。対処法を教えてください。' },
    { label: '🍽 食欲がない', q: 'うちの犬が食欲がありません。考えられる原因は？' },
    { label: '🦴 皮膚が荒れた', q: 'うちの犬の皮膚が荒れています。何が原因でしょうか？' }
  ];
  quickQuestions.forEach(function(qq, i) {
    html += '<button id="qq-' + i + '" style="padding:8px 14px;border-radius:20px;border:1.5px solid ' + (isDark ? '#444' : '#e0e0e0') + ';background:' + (isDark ? '#2a2a3e' : '#fff') + ';font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:' + (isDark ? '#ccc' : '#555') + ';">' + qq.label + '</button>';
  });
  html += '</div>';

  // 回答エリア
  html += '<div id="ai-answer-area" style="flex:1;overflow-y:auto;margin-bottom:16px;min-height:80px;max-height:300px;"></div>';

  // 入力エリア
  html += '<div style="display:flex;gap:8px;align-items:flex-end;">';
  html += '<textarea id="ai-input" placeholder="わんちゃんの気になることを書いてね..." style="flex:1;padding:12px 16px;border-radius:16px;border:1.5px solid ' + (isDark ? '#444' : '#e0e0e0') + ';background:' + (isDark ? '#2a2a3e' : '#f8f8f8') + ';font-size:14px;font-family:inherit;resize:none;min-height:48px;max-height:120px;outline:none;color:' + (isDark ? '#e0e0e0' : '#333') + ';" rows="1"></textarea>';
  html += '<button id="ai-send" style="width:48px;height:48px;border-radius:50%;border:none;background:linear-gradient(135deg,#FF7B9C,#FF5A85);color:#fff;font-size:20px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;">➤</button>';
  html += '</div>';

  // 過去の相談履歴リンク
  var history = getHistory();
  if (history.length > 0) {
    html += '<div id="ai-history-toggle" style="text-align:center;margin-top:12px;font-size:12px;color:#888;cursor:pointer;text-decoration:underline;">過去の相談履歴を見る（' + history.length + '件）</div>';
  }

  modal.innerHTML = html;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // --- Event Handlers ---
  var closeBtn = document.getElementById('ai-close');
  closeBtn.addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  var input = document.getElementById('ai-input');
  var sendBtn = document.getElementById('ai-send');
  var answerArea = document.getElementById('ai-answer-area');

  // Auto-resize textarea
  input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // Quick question buttons
  quickQuestions.forEach(function(qq, i) {
    var btn = document.getElementById('qq-' + i);
    if (btn) {
      btn.addEventListener('click', function() {
        input.value = qq.q;
        input.dispatchEvent(new Event('input'));
        _submitQuestion();
      });
    }
  });

  // Send button
  sendBtn.addEventListener('click', _submitQuestion);

  // Enter to send (Shift+Enter for newline)
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      _submitQuestion();
    }
  });

  // History toggle
  var historyToggle = document.getElementById('ai-history-toggle');
  if (historyToggle) {
    historyToggle.addEventListener('click', function() {
      _showHistory(answerArea, isDark);
    });
  }

  // Focus input
  setTimeout(function() { input.focus(); }, 300);

  async function _submitQuestion() {
    var question = input.value.trim();
    if (!question) return;

    // Show loading
    answerArea.innerHTML = '<div style="text-align:center;padding:24px;"><div class="ux-spinner" style="width:32px;height:32px;border-width:3px;color:#FF7B9C;margin:0 auto 12px;"></div><div style="font-size:13px;color:#888;">考え中...</div></div>';
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    input.disabled = true;

    var result = await askAI(question);

    sendBtn.disabled = false;
    sendBtn.style.opacity = '1';
    input.disabled = false;
    input.value = '';
    input.style.height = 'auto';

    if (result.error) {
      answerArea.innerHTML = '<div style="padding:16px;background:' + (isDark ? '#3a2020' : '#FEF2F2') + ';border-radius:16px;font-size:14px;color:' + (isDark ? '#fca5a5' : '#DC2626') + ';line-height:1.7;white-space:pre-wrap;">' + _escapeHtml(result.error) + '</div>';
      if (result.limitReached) {
        answerArea.innerHTML += '<div style="text-align:center;margin-top:12px;"><button id="ai-upgrade" style="padding:12px 24px;border-radius:14px;border:none;background:linear-gradient(135deg,#FFD700,#FFA500);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">プレミアムにアップグレード</button></div>';
        var upgradeBtn = document.getElementById('ai-upgrade');
        if (upgradeBtn) {
          upgradeBtn.addEventListener('click', function() {
            overlay.remove();
            var payment = window.__wanchan && window.__wanchan.payment;
            if (payment && payment.showPremiumModal) payment.showPremiumModal();
          });
        }
      }
    } else {
      // 残り回数を更新
      var newRemaining = getRemainingCount();
      var countEl = answerArea.closest('#wanchan-ai-modal').querySelector('[style*="今月の残り"]');
      if (countEl) {
        countEl.parentElement.innerHTML = '<span>今月の残り回数</span><span style="font-weight:900;color:' + (newRemaining <= 1 ? '#EF4444' : '#F59E0B') + ';">' + newRemaining + ' / ' + AI_CONFIG.freeLimit + ' 回</span>';
      }

      answerArea.innerHTML = '<div style="padding:16px;background:' + (isDark ? '#1a2a1a' : '#F0FFF4') + ';border-radius:16px;font-size:14px;line-height:1.8;color:' + (isDark ? '#a7f3d0' : '#166534') + ';white-space:pre-wrap;">' + _escapeHtml(result.answer) + '</div>';
    }

    input.focus();
  }
}

function _showHistory(container, isDark) {
  var history = getHistory();
  if (history.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#888;font-size:13px;">まだ相談履歴がありません</div>';
    return;
  }

  var html = '<div style="font-size:14px;font-weight:700;margin-bottom:12px;">相談履歴</div>';
  history.slice(0, 10).forEach(function(item) {
    var date = new Date(item.ts).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    html += '<div style="border-radius:12px;padding:12px;margin-bottom:8px;background:' + (isDark ? '#2a2a3e' : '#f8f8f8') + ';">';
    html += '<div style="font-size:12px;color:#888;margin-bottom:4px;">' + date + '</div>';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">' + _escapeHtml(item.q.substring(0, 60)) + (item.q.length > 60 ? '...' : '') + '</div>';
    html += '<div style="font-size:12px;color:' + (isDark ? '#aaa' : '#666') + ';line-height:1.5;">' + _escapeHtml(item.a.substring(0, 100)) + (item.a.length > 100 ? '...' : '') + '</div>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function _escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// EXPOSE TO APP
// ============================================================
window.__wanchan = window.__wanchan || {};
Object.assign(window.__wanchan, {
  ai: {
    showConsultation: showConsultationModal,
    askAI: askAI,
    getUsageCount: getUsageCount,
    getRemainingCount: getRemainingCount,
    canUseAI: canUseAI,
    getHistory: getHistory
  }
});
