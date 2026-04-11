/**
 * POST /api/payment/create-session
 *
 * KOMOJU決済セッション作成 (Vercel Serverless Function)
 * - 金額はサーバー側でplanKeyから決定（改竄防止）
 * - Firebase IDトークンで認証
 * - 0円運用: Vercel Hobby (100GB帯域), KOMOJU (テスト環境無料), Firestore (無料枠)
 */

const crypto = require('crypto');

// ============================================================
// PLAN DEFINITIONS (Single Source of Truth — サーバー側で金額決定)
// ============================================================
const PLANS = {
  monthly: {
    id: 'wanchan_premium_monthly',
    name: 'プレミアムプラン（月額）',
    amount: 480,
    currency: 'JPY'
  },
  yearly: {
    id: 'wanchan_premium_yearly',
    name: 'プレミアムプラン（年額）',
    amount: 3980,
    currency: 'JPY'
  }
};

// ============================================================
// Firebase Admin SDK (lazy init — cold start最適化)
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
// HANDLER
// ============================================================
module.exports = async function handler(req, res) {
  // CORS — restrict to known origins (wildcard * is dangerous for authenticated endpoints)
  const allowedOrigins = [
    'https://nbyk115.github.io',
    'https://wanchan-seichou-nikki.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- 1. Firebase IDトークン検証 ---
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const admin = getAdmin();
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (authErr) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const uid = decodedToken.uid;

    // --- 2. プラン検証 (金額はサーバー側で決定) ---
    const body = req.body || {};
    const allowedFields = ['planKey', 'metadata'];
    const bodyKeys = Object.keys(body);
    if (bodyKeys.some(k => !allowedFields.includes(k))) {
      return res.status(400).json({ error: 'Unexpected fields in request body' });
    }
    const { planKey } = body;
    if (!planKey || typeof planKey !== 'string') {
      return res.status(400).json({ error: 'planKey is required' });
    }
    const plan = PLANS[planKey];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan: ' + planKey });
    }

    // --- 3. 重複購入チェック ---
    const db = admin.firestore();
    const premiumDoc = await db.collection('premium').doc(uid).get();
    if (premiumDoc.exists) {
      const data = premiumDoc.data();
      if (data.expiresAt && data.expiresAt.toMillis() > Date.now()) {
        return res.status(409).json({
          error: 'Already premium',
          expiresAt: data.expiresAt.toDate().toISOString()
        });
      }
    }

    // --- 4. KOMOJU セッション作成 ---
    const KOMOJU_SECRET = process.env.KOMOJU_SECRET_KEY;
    if (!KOMOJU_SECRET) {
      return res.status(500).json({ error: 'Payment not configured' });
    }

    // idempotency key で重複セッション防止
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(uid + '_' + planKey + '_' + Math.floor(Date.now() / 60000))
      .digest('hex')
      .slice(0, 32);

    const komojuRes = await fetch('https://komoju.com/api/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(KOMOJU_SECRET + ':').toString('base64'),
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: plan.currency,
        default_locale: 'ja',
        return_url: (req.headers.origin || 'https://wanchan-diary.vercel.app')
          + '/?session_id={session_id}&status={status}&plan=' + planKey,
        metadata: {
          uid: uid,
          planKey: planKey,
          planId: plan.id,
          app: 'wanchan-diary'
        }
      })
    });

    if (!komojuRes.ok) {
      const errBody = await komojuRes.text();
      console.error('KOMOJU error:', komojuRes.status, errBody);
      return res.status(502).json({ error: 'Payment provider error' });
    }

    const session = await komojuRes.json();

    return res.status(200).json({
      session_id: session.id,
      session_url: session.session_url
    });

  } catch (err) {
    console.error('create-session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
