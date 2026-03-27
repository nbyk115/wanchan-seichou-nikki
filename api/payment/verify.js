/**
 * POST /api/payment/verify
 *
 * KOMOJU セッション状態検証 (Vercel Serverless Function)
 * - クライアントのコールバック時にセッションIDの実際のステータスをKOMOJU APIで確認
 * - URLパラメータの偽装を防止
 */

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
// HANDLER
// ============================================================
module.exports = async function handler(req, res) {
  // CORS — 許可オリジンを明示的に制限 (CSRF対策)
  const ALLOWED_ORIGINS = [
    'https://wanchan-seichou-nikki.vercel.app',
    'https://nbyk115.github.io',
    ...(process.env.VERCEL_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:5173'] : [])
  ];
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- Firebase IDトークン検証 (認証必須) ---
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) {
      return res.status(401).json({ error: 'Authorization required' });
    }
    const admin = getAdmin();
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (authErr) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { session_id } = req.body || {};
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ error: 'session_id required' });
    }

    // session_id format validation (防御的プログラミング)
    if (!/^[a-zA-Z0-9_-]{10,100}$/.test(session_id)) {
      return res.status(400).json({ error: 'Invalid session_id format' });
    }

    // --- KOMOJU APIでセッション状態を取得 ---
    const KOMOJU_SECRET = process.env.KOMOJU_SECRET_KEY;
    if (!KOMOJU_SECRET) {
      return res.status(500).json({ error: 'Payment not configured' });
    }

    const komojuRes = await fetch(
      'https://komoju.com/api/v1/sessions/' + encodeURIComponent(session_id),
      {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(KOMOJU_SECRET + ':').toString('base64')
        }
      }
    );

    if (!komojuRes.ok) {
      console.error('KOMOJU verify error:', komojuRes.status);
      return res.status(502).json({ error: 'Payment provider error' });
    }

    const session = await komojuRes.json();
    const status = session.status;
    const metadata = session.metadata || {};

    // --- 決済完了時: Firestoreにプレミアム状態を書き込み ---
    if (status === 'completed' || status === 'captured') {
      const uid = metadata.uid;
      const planKey = metadata.planKey;

      if (uid && planKey) {
        try {
          const admin = getAdmin();
          const db = admin.firestore();

          const durationMs = planKey === 'yearly'
            ? 365 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000;

          const now = Date.now();
          // 既存プレミアムの残期間を引き継ぐ
          const existingDoc = await db.collection('premium').doc(uid).get();
          let baseTime = now;
          if (existingDoc.exists) {
            const existing = existingDoc.data();
            if (existing.expiresAt && existing.expiresAt.toMillis() > now) {
              baseTime = existing.expiresAt.toMillis();
            }
          }

          await db.collection('premium').doc(uid).set({
            planId: metadata.planId || planKey,
            planKey: planKey,
            activatedAt: admin.firestore.Timestamp.fromMillis(now),
            expiresAt: admin.firestore.Timestamp.fromMillis(baseTime + durationMs),
            sessionId: session_id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: false });
        } catch (dbErr) {
          console.error('Firestore write error in verify:', dbErr);
          // DBエラーでも決済ステータスは返す (webhookでリカバリ可能)
        }
      }
    }

    return res.status(200).json({
      status: status,
      planKey: metadata.planKey || null
    });

  } catch (err) {
    console.error('verify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
