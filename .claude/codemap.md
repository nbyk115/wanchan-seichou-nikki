# コードマップ — よるのことば

> 最終更新: 2026-04-10

## ファイル構成

| ファイル | サイズ | 役割 |
|---|---|---|
| `index.html` | 634KB | メインアプリ（HTML+CSS+JS全てインライン） |
| `firebase-messaging-sw.js` | 6.5KB | Service Worker（キャッシュ+Push通知） |
| `vercel.json` | 2.7KB | デプロイ設定（ヘッダー・CSP・キャッシュ） |
| `manifest.json` | 1.5KB | PWAマニフェスト |
| `robots.txt` | 364B | クローラー制御 |
| `sitemap.xml` | 1.1KB | サイトマップ（4ページ） |
| `legal.html` | 4.4KB | 特定商取引法に基づく表記 |
| `privacy.html` | 6.0KB | プライバシーポリシー |
| `terms.html` | 6.1KB | 利用規約 |
| `CLAUDE.md` | 636行 | ConsultingOS司令塔（ルーティング・スキル・運用鉄則） |

### ConsultingOS構成（.claude/配下）

| ディレクトリ | ファイル数 | 内容 |
|---|---|---|
| `agents/consulting/` | 8 | 戦略・提案・KPI・法務・AI導入 |
| `agents/creative/` | 8 | デザイン・UX・コンテンツ・グロース |
| `agents/global/` | 4 | GTM・翻訳・海外事業 |
| `agents/marketing-research/` | 8 | 広告・SEO・CRM・PR・リサーチ |
| `agents/product/` | 2 | PM・フィードバック |
| `agents/service-dev/` | 4 | 技術・実装・AI・インフラ |
| `skills/` | 20 | 全エージェント共有のナレッジベース |
| `commands/` | 7 | スラッシュコマンド |
| `memory/` | 3 | セッション間メモリ・進化ログ |

## index.html 構造

| 行範囲 | セクション | 内容 |
|---|---|---|
| 1-7 | DOCTYPE・meta | charset, viewport, dns-prefetch |
| 8-14 | preconnect | gstatic, fonts, firestore |
| 15-42 | SEO・OGP | meta description, OGP, Twitter Card, canonical |
| 43-48 | 構造化データ | JSON-LD (WebApplication, WebSite) |
| 49-50 | GA/gtag | Google Analytics 4 |
| 51-53 | フォント | Zen Maru Gothic + Cormorant（非同期ロード） |
| 54-159 | CSS | 全スタイル（ライト/ダーク両テーマ） |
| 160-176 | SW管理 | Service Worker登録・更新ロジック |
| 179-201 | 追加JSON-LD | HowTo, FAQPage等の構造化データ |
| 203 | `</head>` | — |
| 204-206 | body開始 | skip-link, `#main-content`, `#root` |
| 208-212 | Firebase SDK | 5本（app→messaging→firestore→auth→functions） |
| 213-244 | Firebase初期化 | initializeApp, initPush, error handlers |
| 245-246 | React/ReactDOM | CDN読み込み（SRI付き） |
| 248 | **メインJS開始** | `<script>` — ミニファイ済み巨大ブロック |
| 248 (line内) | CHARA_IMAGES | 24キャラのbase64 WebP画像（~130KB） |
| 248 | DREAM_TYPES | 24キャラの夢タイプ定義 |
| 248 | RARITY_INFO | SSR/SR/R/Nのレア度設定 |
| 248 | SIGNS | 12星座データ |
| 248 | ユーティリティ関数 | getTodayMessage, getStreak, saveStreak等 |
| 248 | 占いロジック | makeSeededRandom, generateFortune, analyzeDream |
| 248 | UIコンポーネント | Particles, CharaAvatar, Tag, Card等 |
| 265 | YORUGO_CODES | 24キャラの夜語コード |
| 375 | Canvas描画 | FortuneTypeCard, saveImage, シェア画像生成 |
| 501-542 | App本体 | メインコンポーネント（23 useState） |
| 542 | ErrorBoundary | React エラー境界 |
| 542 | ReactDOM.render | `createRoot().render()` |
| 578-582 | 閉じタグ | `</script></body></html>` |

## 主要関数・コンポーネント

### データ・ロジック層

| 関数名 | 行(概算) | 説明 |
|---|---|---|
| `makeSeededRandom` | 248 | シード付き擬似乱数生成器 |
| `getDailySeed` | 248 | 日付ベースのシード値計算 |
| `generateFortune` | 248 | 星座占い結果生成 |
| `analyzeDream` | 248 | 夢診断ロジック（キーワードマッチ+シード乱数） |
| `calcCompatibility` | 501 | 相性診断計算 |
| `calcGogyoType` | 501 | 五行タイプ計算 |
| `generateMonthlyLetter` | 501 | 月間レター生成 |
| `simpleHash` | 248 | 文字列ハッシュ関数 |
| `getStreak` | 248 | 連続ログインカウント取得 |
| `saveStreak` | 248 | 連続ログインデータ保存 |

### 認証・課金

| 関数名 | 行(概算) | 説明 |
|---|---|---|
| `signInWithGoogle` | 501 | Google OAuth認証 |
| `sendEmailLink` | 501 | メールリンク認証 |
| `handlePremiumAction` | 501 | プレミアムゲート（11箇所で使用） |
| `cancelSubscription` | 501 | サブスクリプション解約 |
| `openCheckout` | 501 | KOMOJU決済画面表示 |

### UIコンポーネント

| コンポーネント名 | 行(概算) | 説明 |
|---|---|---|
| `App` | 501 | メインコンポーネント（23 useState, 5 useEffect） |
| `FortuneTypeCard` | 375 | 占い結果カード（Canvas描画含む） |
| `CharacterCarousel` | 501 | キャラクターカルーセル |
| `FtueOverlay` | 501 | 初回ユーザー体験オーバーレイ |
| `Particles` | 248 | パーティクルアニメーション |
| `CharaAvatar` | 248 | キャラクターアバター表示 |
| `BottomTabBar` | 501 | 下部タブバー |
| `PremiumCTA` | 501 | プレミアムCTAバナー |
| `ErrorBoundary` | 542 | Reactエラー境界（componentDidCatch付き） |

## データ構造

### localStorage キー

| キー | 型 | 用途 | スキーマ検証 |
|---|---|---|---|
| `ynk_streak` | JSON | 連続ログイン `{count, last, collection}` | typeof + フィールド型チェック |
| `ynk_profile` | JSON | ユーザープロフィール `{name, sign, gender, ...}` | typeof + フィールド型チェック |
| `ynk_dream_archive` | JSON | 夢占いアーカイブ `[{...}]` | Array.isArray |
| `ynk_ftue_done` | string | FTUE完了フラグ `"1"` | — |
| `ynk_night_mode` | string | ダークモード `"on"/"off"` | — |
| `ynk_banner_dismissed` | string | バナー非表示タイムスタンプ | parseInt |
| `ynk_push_token` | string | FCMトークン | — |
| `ynk_email_for_signin` | string | メールリンク認証用 | — |

### Firebase コレクション

| コレクション | 用途 |
|---|---|
| `tokens` | FCMプッシュ通知トークン管理 |

### Firebase Cloud Functions

| 関数名 | リージョン | 用途 |
|---|---|---|
| `cancelSubscription` | asia-northeast1 | サブスクリプション解約処理 |

## firebase-messaging-sw.js 構造

| 行範囲 | セクション |
|---|---|
| 1-2 | Firebase SDK importScripts |
| 4-8 | キャッシュ定数（3ストア） |
| 10-35 | install/activate イベント |
| 37-93 | キャッシュ戦略（cache-first, stale-while-revalidate） |
| 95-131 | fetchルーティング（4パターン分岐） |
| 133-91 | Firebase Messaging（onBackgroundMessage） |
| 93-111 | notificationclick（URLホワイトリスト検証付き） |

## 開発ガイド

### ミニファイコードの検索方法
```bash
# 関数定義を探す
grep -o 'function analyzeDream.\{0,200\}' index.html

# 変数名の出現箇所を数える
grep -o 'YORUGO_CODES' index.html | wc -l

# 前後のコンテキストを見る
grep -o '.\{50\}handlePremiumAction.\{50\}' index.html
```

### 主要データフロー
```
ユーザー入力 → generateFortune/analyzeDream
  → makeSeededRandom(getDailySeed(...))
  → SIGNS/DREAM_TYPES参照
  → saveStreak(localStorage)
  → FortuneTypeCard(Canvas描画)
  → doShare(SNSシェア/画像保存)
```

### 注意事項
- line 248 は ~300KB の単一行（全データ+ロジック+コンポーネント）
- line 501 は ~230KB の単一行（App本体）
- 編集時は `grep -o` で正確な文字列を特定してからEditツールを使用
- `getDailySeed` と `calcGogyoType` で月の計算方法が異なる（getMonth() vs getMonth()+1）
