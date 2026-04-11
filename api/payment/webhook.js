/**
 * POST /api/payment/webhook
 *
 * KOMOJU Webhook受信 (Vercel Serverless Function)
 * - HMAC-SHA256署名検証でリクエスト真正性を担保
 * - 決済完了イベントでFirestoreにプレミアム状態を書き込み
 * - verifyエンドポイントとの二重書き込みは冪等設計で安全
 *
 * KOMOJU Webhookイベント:
 * - payment.captured: 決済確定
 * - payment.refunded: 返金
 *
 * 環境変数:
 * - KOMOJU_SECRET_KEY: APIシークレットキー
 * - KOMOJU_WEBHOOK_SECRET: Webhook署名検証用シークレット (KOMOJU管理画面で設定)
 * - FIREBASE_SERVICE_ACCOUNT: サービスアカウントJSON
 */

const crypto = require('crypto');

// ============================================================
// Firebase Admin SDK (lazy init)
// ============================================================
let _admin = null;
function getAdmin() {
  if (_admin) return _admin;
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (parseErr) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON: ' + parseErr.message);
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  _admin = admin;
  return admin;
}

// ============================================================
// SIGNATURE VERIFICATION
// ============================================================
function verifySignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  // タイミング攻撃防止
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expected, 'utf8')
  );
}

// ============================================================
// Vercel: raw body取得のための設定
// ============================================================
module.exports.config = {
  api: {
    bodyParser: false
  }
};

// ============================================================
// HANDLER
// ============================================================
module.exports = async function handler(req, res) {
  // Security headers
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- 1. Raw bodyを取得 (署名検証のため) ---
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');

    // --- 2. 署名検証 ---
    const webhookSecret = process.env.KOMOJU_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-komoju-signature'] || '';
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        console.error('Webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } else {
      // 開発環境では署名検証をスキップ (本番では必ず設定すること)
      console.warn('KOMOJU_WEBHOOK_SECRET not set — skipping signature verification');
    }

    // --- 3. イベント解析 ---
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const eventType = event.type;
    console.log('Webhook received:', eventType);

    // --- 4. 決済完了: プレミアム状態をFirestoreに書き込み ---
    if (eventType === 'payment.captured') {
      const payment = event.data || {};
      const metadata = payment.metadata || {};
      const uid = metadata.uid;
      const planKey = metadata.planKey;

      if (!uid || !planKey) {
        console.error('Webhook missing metadata: uid or planKey');
        // 200を返してリトライを止める (メタデータ不足はリトライしても直らない)
        return res.status(200).json({ status: 'ignored', reason: 'missing metadata' });
      }

      const admin = getAdmin();
      const db = admin.firestore();

      const durationMs = planKey === 'yearly'
        ? 365 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

      const now = Date.now();
      // 既存プレミアムの残期間を引き継ぐ (冪等: 同じsessionIdなら上書き)
      const premiumRef = db.collection('premium').doc(uid);
      const existingDoc = await premiumRef.get();
      let baseTime = now;

      if (existingDoc.exists) {
        const existing = existingDoc.data();
        // 同一セッションIDの場合は冪等 (重複処理をスキップ)
        if (existing.sessionId === payment.session) {
          console.log('Duplicate webhook for session:', payment.session);
          return res.status(200).json({ status: 'duplicate' });
        }
        // 残期間引き継ぎ
        if (existing.expiresAt && existing.expiresAt.toMillis() > now) {
          baseTime = existing.expiresAt.toMillis();
        }
      }

      await premiumRef.set({
        planId: metadata.planId || planKey,
        planKey: planKey,
        activatedAt: admin.firestore.Timestamp.fromMillis(now),
        expiresAt: admin.firestore.Timestamp.fromMillis(baseTime + durationMs),
        sessionId: payment.session || '',
        paymentId: payment.id || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: false });

      console.log('Premium activated for uid:', uid, 'plan:', planKey);
      return res.status(200).json({ status: 'activated' });
    }

    // --- 5. 返金: プレミアム状態を無効化 ---
    if (eventType === 'payment.refunded') {
      const payment = event.data || {};
      const metadata = payment.metadata || {};
      const uid = metadata.uid;

      if (uid) {
        const admin = getAdmin();
        const db = admin.firestore();
        await db.collection('premium').doc(uid).update({
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now()),
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
          refundPaymentId: payment.id || ''
        });
        console.log('Premium revoked (refund) for uid:', uid);
      }

      return res.status(200).json({ status: 'refunded' });
    }

    // その他のイベントは無視
    return res.status(200).json({ status: 'ignored', event: eventType });

  } catch (err) {
    console.error('Webhook error:', err);
    // 500を返すとKOMOJUがリトライするので、処理不能なエラーは200で返す
    return res.status(200).json({ status: 'error', message: 'Internal error logged' });
  }
};
