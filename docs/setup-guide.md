# わんちゃん成長日記 — 本番稼働セットアップガイド

所要時間: 約25分 / コスト: 0円

---

## Step 1: Firebase Analytics 有効化（5分）

1. https://console.firebase.google.com/ にアクセス
2. `wanchan-diary` プロジェクトを選択
3. 左メニュー「Analytics」→ 未有効なら「有効にする」
4. 歯車アイコン → プロジェクト設定 → 全般タブ
5. 「マイアプリ」→ ウェブアプリ → 「SDK の設定と構成」
6. `measurementId` の値（`G-XXXXXXXXXX` 形式）をコピー

### コード変更（2箇所）

**analytics.js 28行目:**
```javascript
measurementId: 'G-XXXXXXXXXX'  // ← ここにペースト
```

**firebase-config.js 22-29行目に追加:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDiQeQW9EgAI8BbZ9Z030ADJsLeA64VzAs",
  authDomain: "wanchan-diary.firebaseapp.com",
  projectId: "wanchan-diary",
  storageBucket: "wanchan-diary.firebasestorage.app",
  messagingSenderId: "151633084436",
  appId: "1:151633084436:web:ac8ffa692e4ba1839a2701",
  measurementId: "G-XXXXXXXXXX"  // ← ここにペースト
};
```

→ これで全30イベントの計測が即座に開始されます。

---

## Step 2: Vercel 環境変数設定（10分）

1. https://vercel.com/dashboard にアクセス
2. `wanchan-seichou-nikki` プロジェクトを選択
3. Settings → Environment Variables

### 設定する環境変数

| 変数名 | 取得場所 | 必須 |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → プロジェクト設定 → サービスアカウント → 「新しい秘密鍵を生成」→ JSONファイルの中身をそのままペースト | 必須 |
| `KOMOJU_SECRET_KEY` | KOMOJUダッシュボード → APIキー → シークレットキー (`sk_test_...`) | 必須 |
| `KOMOJU_WEBHOOK_SECRET` | Step 3で取得 | 必須 |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ → APIキー → 新しいキー作成 (`sk-ant-...`) | 任意（未設定でもフォールバック動作） |

### Firebase サービスアカウント取得手順

1. Firebase Console → プロジェクト設定（歯車アイコン）
2. 「サービスアカウント」タブ
3. 「新しい秘密鍵を生成」ボタン
4. ダウンロードされたJSONファイルの中身を**まるごと**コピー
5. Vercelの `FIREBASE_SERVICE_ACCOUNT` にペースト

---

## Step 3: KOMOJU Webhook URL 登録（5分）

1. https://komoju.com/dashboard にアクセス
2. 設定 → Webhook
3. 「新しいWebhook」をクリック
4. URL: `https://あなたのドメイン.vercel.app/api/payment/webhook`
5. イベント: `payment.captured`, `payment.refunded` を選択
6. 「保存」→ 表示されるシークレットをコピー
7. Vercelの `KOMOJU_WEBHOOK_SECRET` にペースト

---

## Step 4: デプロイ & 動作確認（5分）

1. Vercelダッシュボードで「Redeploy」（環境変数反映のため）
2. 以下を確認:
   - [ ] トップページが表示される
   - [ ] Googleログインが動作する
   - [ ] AI健康相談で質問できる（APIキー設定時→Claude回答、未設定時→定型文）
   - [ ] Firebase Analytics のリアルタイムビューにイベントが表示される

---

## 本番キー切替（売上が出始めたら）

| 変更箇所 | テスト → 本番 |
|---|---|
| `komoju-payment.js` L15 | `pk_test_...` → `pk_live_...` |
| Vercel環境変数 `KOMOJU_SECRET_KEY` | `sk_test_...` → `sk_live_...` |

---

## コスト見通し

| MAU | Firebase | Vercel | Claude API | KOMOJU手数料 | 合計 |
|---|---|---|---|---|---|
| ~100 | 0円 | 0円 | ~750円 | ~84円 | ~834円 |
| ~1,000 | 0円 | 0円 | ~7,500円 | ~840円 | ~8,340円 |
| ~10,000 | 0円 | 0円 | ~75,000円 | ~8,400円 | ~83,400円 |

※ ANTHROPIC_API_KEY未設定なら全て0円で運用可能
