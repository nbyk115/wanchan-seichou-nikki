# Creative Playbook — デザイン・コンテンツ・マルチツール連携

## 概要
Creative部門の全エージェントが参照するデザインプロセス・コンテンツ標準・デザインツール選定ガイド。
**デザインツールはFigma一択ではなく、リクエストに応じて最適ツールを自動選定する。全ツール無料枠で運用。**

---

## 1. デザインツール選定（リクエスト駆動）

### 鉄則: ニーズからツールを決める

> デザインタスクを受けたら「何を作るか」でツールを決定する。
> 全ツール無料枠で運用。有料プランは導入しない。

### ツール選定マトリクス

| ツール | 最適な用途 | コスト | 強み |
|---|---|---|---|
| **Google Stitch** | UI/アプリ画面の0→1生成・高速プロトタイプ・デザインシステム | 無料（月350回） | AI自動生成・コードエクスポート・Figma連携・Claude Code MCP対応 |
| **Canva** | SNS画像・バナー・簡易LP・名刺・プレゼン資料・ロゴ案 | 無料（Free） | テンプレート豊富・素材内蔵・高速制作 |
| **Figma** | UIデザインの仕上げ・コンポーネント管理・デザインシステム運用 | 無料（Starter） | 手動編集の精度・開発者連携・デザインシステム管理 |
| **Google Slides** | 提案書・ピッチデック・社内資料・ワークショップ資料 | 無料 | 共同編集・ビジネス標準・テキスト主体の資料 |
| **Claude Design** | プロトタイプ・スライド・ワンページャー・サマリー資料 | 無料（Pro/Max/Team/Enterprise） | プロンプト駆動生成・DOCX/PPTX/URL入力・PDF/PPTX/HTML/Canvaエクスポート・コードベース読取でデザインシステム自動適用・Claude Codeワンクリックハンドオフ |

### Claude Design 活用ガイド

> **プロンプト駆動でプロトタイプ・スライド・ワンページャー・ビジュアル資料を高速生成。Opus 4.7ベース。**

| 機能 | 説明 |
|---|---|
| プロンプト→生成 | テキスト指示でプロトタイプ・スライド・サマリーを生成 |
| 入力形式 | テキスト / DOCX / PPTX / XLSX / URL |
| エクスポート | Canva（SNS素材連携）/ PDF（クライアント納品）/ PPTX（プレゼン）/ HTML（Web実装） |
| デザインシステム自動適用 | コードベースを読み取りDESIGN.mdのトークンを自動反映 |
| Claude Codeハンドオフ | ワンクリックでClaude Codeに渡してHTML/React実装へ |
| インラインコメント・直接編集 | 生成後の微調整をUI上で即時実行 |

**Figma MCPとの使い分け**: Claude Designは高速プロトタイピング・資料生成に使い、Figmaはピクセルパーフェクトな本番デザイン・コンポーネント管理に使う。

**エクスポート形式の選定基準**:
- **Canva**: SNS素材・バナーとして再編集が必要な場合
- **PDF**: クライアント納品・最終資料
- **PPTX**: プレゼンテーション・ピッチデック
- **HTML**: Web実装・Claude Codeハンドオフ

### 自動選定ロジック（creative-directorが判断）

```
リクエスト受領
  ↓
何を作るか？
  ├── UI/アプリ画面（新規・ラフ） → Google Stitch（0→1生成）
  │     → 仕上げが必要なら → Figma or frontend-dev
  ├── 提案書・ピッチデック・社内資料 → Claude Design（PPTX/PDF）or Google Slides
  ├── プロトタイプ・ワンページャー・サマリー → Claude Design
  ├── SNS画像・バナー・チラシ・簡易ビジュアル → Canva
  ├── LP（高速プロトタイプ） → Google Stitch → frontend-dev
  ├── LP（テンプレベース・ノンコード） → Canva
  ├── LP（カスタム・仕上げ重視） → Figma → frontend-dev
  ├── デザインシステム構築 → Google Stitch（生成）→ Figma（管理）
  ├── ロゴ案・ブランド素材（ラフ） → Canva
  ├── プレゼン（ビジュアル重視） → Canva
  ├── プレゼン（データ・テキスト主体） → Google Slides
  └── 不明・複合 → creative-directorが判断して分割
```

### ツール併用パターン

| ケース | 組み合わせ |
|---|---|
| UI新規制作 | Google Stitch（0→1生成）→ Figma（仕上げ）→ frontend-dev（実装） |
| 提案書 + デモUI | Claude Design（資料PPTX）+ Google Stitch（UIモック） |
| SNSキャンペーン + LP | Canva（SNS素材）+ Google Stitch or frontend-dev（LP） |
| ピッチ + ブランド素材 | Google Slides（ピッチ）+ Canva（ロゴ・素材） |
| LP + OGP画像 | Google Stitch/frontend-dev（LP）+ Canva（OGP画像） |
| デザインシステム構築 | Google Stitch（DESIGN.md生成）→ Figma（運用・管理） |

### 各ツールの出力と納品

| ツール | 主な出力形式 | 納品方法 |
|---|---|---|
| Google Stitch | HTML / CSS / React / Figmaエクスポート / DESIGN.md | 共有リンク / コードコピー |
| Canva | PNG / PDF / SVG / MP4 | 共有リンク or ダウンロード |
| Figma | デザイン仕様 → コード化 | 共有リンク / Dev Mode |
| Google Slides | PDF / PPTX | 共有リンク or エクスポート |

### Google Stitch 活用ガイド

> **UI/アプリ画面の0→1はStitchが最速。仕上げはFigma。**
> stitch.withgoogle.com にGoogleアカウントでサインイン。ブラウザだけで動作。

| 機能 | 説明 |
|---|---|
| テキスト→UI生成 | 自然言語でUIを記述→完全なデザイン生成 |
| 画像→UI変換 | スケッチ・スクショからUIを再生成 |
| コードエクスポート | HTML/CSS/Reactコードを直接コピー |
| Figmaエクスポート | 生成デザインをFigmaに直接送信 |
| DESIGN.md | デザインシステムをファイルとして抽出・インポート |
| 音声操作 | Voice Canvasで音声指示・リアルタイム修正 |
| プロトタイプ | 画面遷移・インタラクションを自動生成 |

**月間制限**: Standard（Gemini Flash）月350回 / Experimental（Gemini Pro）月50回

---

## 1.8 Video Use 活用ガイド（動画編集自動化）

> **アセットフォルダを渡すだけで完成mp4を生成。** `pip install -e .` でセットアップ。

| 用途 | 説明 |
|---|---|
| SNSリール・ショート動画 | フィラーワード・無音自動除去、字幕バーンイン |
| プロモ動画・チュートリアル | シーン別AI色補正、カット境界の自動フェード |
| アニメーション挿入 | Manim/Remotion/PILアニメーションを動画に合成 |

- **ワークフロー**: アセットフォルダ → Claude Code「動画編集して」 → 完成mp4
- **TTS機能**: ElevenLabs APIキーが必要（有料）。TTS不要の編集は無料

---

## 2. デザインプロセス

### ワークフロー
```
ブリーフ → リサーチ → UX設計 → UI設計 → 実装 → レビュー → リリース
   ↑                                                    ↓
   └──────────── フィードバックループ ────────────────┘
```

### 各フェーズの担当
| フェーズ | 担当エージェント | 成果物 |
|---|---|---|
| ブリーフ | creative-director | クリエイティブブリーフ |
| UX設計 | ux-designer | ユーザーフロー, ワイヤーフレーム |
| UI設計 | ux-designer + creative-director | Figmaデザイン |
| 実装 | frontend-dev | HTML/CSS/React コード |
| コンテンツ | content-strategist | コピー, 記事, SNS |
| 品質チェック | brand-guardian | ブランド適合判定 |

---

## 2.3 品性と高級感のデザイン原則

> **「煌びやかさ = 高級感」ではない。品性は抑制から生まれる。**

### 品性を生む5つの抑制
1. **色数を絞る**: プライマリ+ニュートラルの2-3色。グラデーション・蛍光色を避ける
2. **余白を広く取る**: 情報密度を下げる。1スライド=1メッセージ
3. **タイポを静かに**: 装飾フォント禁止。ウェイトの強弱で階層を作る
4. **写真を控えめに**: 全面ビジュアルより、余白を活かした小さめの配置
5. **エリア分けをさりげなく**: 強い区切り線より、余白とトーン差で区切る

### 業界別の品性トーン
| 業界 | 推奨配色 | 避けるもの |
|---|---|---|
| B2B SaaS / コンサル | グレー × 水色 / ネイビー × 白 | 蛍光色・強いグラデーション |
| 高級ブランド / ラグジュアリー | モノクロ × 金 / 黒 × ベージュ | カラフルな装飾 |
| 医療・金融 | ネイビー × 白 / グレー × アクセント1色 | 派手な色使い |
| 占い・スピリチュアル | 淡いローズ × 紫 / ネイビー × 金 | 原色・過剰な装飾 |

### 参考事例の探し方
- slideland.tech 等の企業IR・会社紹介デックを定点観測
- Apple / Stripe / Linear 等の洗練されたB2Bデザインを参照
- 「煌びやか」ではなく「さりげなさ」を評価基準にする

### ConsultingOSでの適用
- `creative-director`: プレゼン・提案書のビジュアル方針策定時に参照
- `proposal-writer`: 高単価クライアント向けの提案書で必須
- `brand-guardian`: 「派手すぎないか」を品性スコアに含める

---

## 2.5 デザイン品質管理 — L1/L2/L3 × Wave方式

> **「品質を落とさない」の定義が曖昧なまま進めると破綻する。品質を3層に分け、Wave方式で全体を波のようになぞる。**

### 品質の3層定義

| 層 | 名称 | 対象 | 基準 | AI分業 |
|---|---|---|---|---|
| **L1** | 機能品質 | 全画面必須 | コンポーネント準拠・トークン参照・Auto Layout・5状態定義 | AI主導（DESIGN.md準拠で高速生成） |
| **L2** | 体験品質 | 主要画面 | 状態遷移フィードバック・プログレッシブディスクロージャー・余白バランス・トーン統一 | AI+人間協業 |
| **L3** | 感動品質 | 特定画面のみ | 予想を超える体験・マイクロインタラクション・エモーショナルデザイン | 人間主導（方針は人間、実装はAI） |

### L1品質基準（全画面で必須）
```
□ コンポーネントはDESIGN.mdのトークンに準拠（直打ち禁止）
□ Auto Layoutで組む（固定高さはスクロールコンテナのみ例外）
□ 5状態定義: Default / Hover / Focus / Error / Disabled
□ セマンティックカラー参照（hex直書き禁止）
□ レスポンシブ対応（DESIGN.mdのブレークポイントに従う）
```

### Wave方式（作り方の順序）
```
第一波（L1）: 全画面の構造を作る → 全体の30%
  → 全画面のワイヤーフレーム + 画面遷移確定
  → コンポーネントの種類と数が確定
  → frontend-dev がDESIGN.md準拠で高速生成

第二波（L2）: 主要画面の体験を仕上げる → 全体の40%
  → ホーム・検索・詳細から着手
  → ここで確立したパターンが他画面に波及
  → ux-designer + frontend-dev の協業

第三波（L3）: 特定画面に感動を入れる → 全体の30%
  → オンボーディング・初回体験・エラー体験に集中
  → creative-director が方針決定 → frontend-dev が実装
```

### 画面別品質レベルの配分例（40画面の場合）
```
L3: 5画面（12%）→ オンボーディング, ホーム, 初回体験, 料金, エラー
L2: 15画面（36%）→ 検索結果, 詳細, 設定トップ, メッセージ主要
L1: 20画面（52%）→ サブ設定, 管理画面, 補助リスト
```
**配分を最初に決める。** 「この画面はL1でいい」と判断するのが最も難しいが、全画面にL3を求めると永遠に終わらない。

---

## 2.6 業界別デザイン参照（外部カタログ）

> **原則**: ConsultingOS は「原則から導出」が本質。カタログは**参考書**であり SSOT ではない。案件の tokens.json/rules.json は必ず案件ごとに作る。

- **外部参照**: [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — 161業界ルール × 67スタイル × 161パレット × 57フォントペア × 15技術スタック
- **使用シーン**: 新規クライアント案件で業界の標準的なデザイン傾向を素早く把握したい時（fintech/medtech/SaaS/e-commerce/wellness 等）
- **使用者**: `creative-director`（起点）→ `ux-designer`（具体化）
- **使い方**: 丸写ししない。**業界傾向の地図**として参照し、そこから佐藤×小野寺 + アイブ/ハットフィールドの視点で再解釈する
- **禁止事項**: パレット/フォント/ルールをカタログから直接プロジェクトに持ち込む。必ず案件 tokens.json に翻訳してから使う

---

## 3. デザインツール連携ガイド

### 対応エージェントとツール
| エージェント | Canva | Figma | Google Slides | html2pptx |
|---|---|---|---|---|
| `creative-director` 🎨 | ✅ 方針指示・レビュー | ✅ デザインレビュー | ✅ 資料レビュー | ✅ PPTX出力指示 |
| `ux-designer` 🎨 | ✅ 簡易LP・モック | ✅ UX/UI設計 | — | — |
| `frontend-dev` 🎨 | — | ✅ Figma→コード変換 | — | — |
| `proposal-writer` | — | — | ✅ 提案書作成 | ✅ 提案書PPTX変換 |

### html2pptx（HTML→PowerPoint変換）
> **HTMLスライドをPPTXに変換。提案書・ピッチデックをデザイン付きで納品可能に。**

- **サービス**: html2pptx.app（MCP/API/Skills対応）
- **フロー**: proposal-writerが構成→HTMLスライド生成→html2pptxでPPTX変換→納品
- **DESIGN.md連携**: HTMLスライドにDESIGN.mdのカラー・フォントを適用→ブランド準拠PPTX

### markdown-viewer/skills（Markdown→汎用図表自動生成）
> **100+の図例・6000+のベクターアイコンを持つ図表生成スキル。Markdownの内容から一言で自動カスタマイズ。**

```bash
npx skills add markdown-viewer/skills
```

- **対応図**: アーキテクチャ図・フローチャート・ワークフロー図・状態図・展開図・クラス図・ユースケース図・インフォグラフィック
- **フロー**: テキスト→図→html2pptx→PPTXの一気通貫納品
- **活用エージェント**:
  - `proposal-writer`: 提案書にアーキテクチャ図・フローチャート自動生成
  - `product-manager`: ユーザーストーリー図・ロードマップ図
  - `creative-director`: インフォグラフィック・プレゼン資料
  - `marketing-director`: ファネル図・チャネルミックス可視化

### fireworks-tech-graph（AI/技術アーキテクチャ図特化）
> **技術アーキテクチャ図専用スキル。AI/Agentパターン（RAG/Mem0/Multi-Agent/Tool Call等）を内蔵。自然言語1文で図が出る。**

- **対応図**: 8種類（Multi-Agent / RAG / Agentic Search / Tool Call / データフロー / デプロイ / メモリアーキテクチャ 等）
- **ビジュアルスタイル**: 5種類（ガラス質・ミニマル・カラフル 等）
- **出力**: SVG + 1920px PNG自動エクスポート
- **特徴**: セマンティック形状（六角形=Orchestrator、円筒=ストレージ）・セマンティックカラー（青=主フロー、オレンジ=制御、緑=読み書き）を自動割当
- **活用エージェント**:
  - `tech-lead`: システム設計書・マイクロサービス構成図
  - `ai-engineer`: RAGパイプライン・Multi-Agent設計図・Mem0メモリ階層図
  - `infra-devops`: デプロイ図・Kubernetes構成図

### 使い分けルール
```
技術/AI/Agentの設計図 → fireworks-tech-graph
汎用図表（ファネル/ユーザーストーリー/インフォグラフィック）→ markdown-viewer/skills
両方欲しい → 両方インストール（競合しない）
```

### Figma連携フロー（UI/UX・コンポーネント設計時）
```
1. FigmaリンクをURLで共有
2. MCP経由でデザインデータを取得（MCP有効時のみ）
3. コンポーネント構造を解析
4. デザイントークン抽出（色・フォント・スペーシング）
5. Reactコンポーネントとして実装
```

### デザイントークン変換ルール
| Figma | Tailwind CSS |
|---|---|
| カラースタイル | colors in tailwind.config |
| テキストスタイル | fontSize + fontWeight |
| エフェクト | shadow / blur |
| Auto Layout | flex / grid |
| Spacing | spacing scale (4px基準) |

---

## 4. コンポーネント設計

### Atomic Design階層
```
Atoms → Molecules → Organisms → Templates → Pages
```

### コンポーネント命名規約
```
{カテゴリ}/{コンポーネント名}.tsx

例:
  ui/Button.tsx
  ui/Input.tsx
  layout/Header.tsx
  layout/Footer.tsx
  features/LoginForm.tsx
  features/ProductCard.tsx
```

### コンポーネント品質基準
- [ ] TypeScript props定義（interface）
- [ ] デフォルトprops設定
- [ ] アクセシビリティ（ARIA, キーボード操作）
- [ ] レスポンシブ対応
- [ ] ダーク/ライトモード対応（該当する場合）
- [ ] Storybook ストーリー（該当する場合）

---

## 5. レスポンシブデザイン

### ブレークポイント（Tailwind標準）
| ブレークポイント | サイズ | デバイス |
|---|---|---|
| sm | 640px | モバイル横 |
| md | 768px | タブレット |
| lg | 1024px | ラップトップ |
| xl | 1280px | デスクトップ |
| 2xl | 1536px | ワイドスクリーン |

### モバイルファースト原則
1. デフォルトスタイルはモバイル向け
2. `sm:` `md:` `lg:` で段階的に拡張
3. タッチターゲット最小 44x44px
4. フォントサイズ最小 16px（入力フィールド）

---

## 6. コンテンツ制作標準

### 文体ガイド
- **トーン**: 専門的だが親しみやすい
- **文長**: 1文40文字以内を推奨
- **段落**: 3〜4文で改行
- **見出し**: 読者のベネフィットを含める

### SEO/AIO 最適化
- タイトルタグ: 30〜35文字
- メタディスクリプション: 120文字以内
- H1: ページに1つ
- 画像alt属性: 必須
- 構造化データ: FAQ/HowTo/Article

### コンテンツタイプ別テンプレート
| タイプ | 構成 | 文字数目安 |
|---|---|---|
| ブログ記事 | 導入→本文(3-5セクション)→まとめ→CTA | 2000-4000字 |
| ケーススタディ | 課題→施策→結果→学び | 1500-2500字 |
| LP | ヒーロー→課題→解決→特徴→証明→CTA | セクション×100-200字 |
| SNS投稿 | フック→本文→CTA | 140-280字 |

---

## 7. パフォーマンス基準

### Core Web Vitals 目標
| 指標 | 目標 |
|---|---|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| TTFB | < 800ms |

### 画像最適化
- フォーマット: WebP / AVIF 優先
- 遅延読み込み: viewport外の画像
- レスポンシブ画像: srcset + sizes
- 最大ファイルサイズ: 200KB/画像

---

## 8. アクセシビリティ（WCAG 2.1 AA）

### 必須対応項目
- [ ] カラーコントラスト比 4.5:1 以上（テキスト）
- [ ] キーボード操作対応（Tab, Enter, Escape）
- [ ] スクリーンリーダー対応（ARIA）
- [ ] フォーカスインジケーター
- [ ] 代替テキスト（画像・アイコン）
- [ ] フォームラベル
- [ ] エラーメッセージの明示

---

## 9. DESIGN.md（リポジトリの見た目の憲法）+ AI-Ready 3層構造

> **Figmaで画面を作って終わりではない。その裏のデザインルールをMarkdownに落とし、AIが安定した出力を出せる状態を作る。AI時代の成果物は「Figma + DESIGN.md + contracts」のセット。**

### AI-Ready 3層構造（維持可能な設計）

DESIGN.mdだけでは壊れる。JSON契約とCI検証をセットにして初めて「維持できる仕組み」になる。

```
Layer 1: 憲法（人間とAIが最初に読む入口）
  DESIGN.md        ← Brand Identity + 原則 + Quick Reference
  CLAUDE.md        ← AI作業手順書・読み込みガイド

Layer 2: 仕様（Machine-Readable SSOT）
  design/contracts/
    ├── tokens.json      ← デザイントークン（値・意図・使用箇所）
    ├── rules.json       ← 禁止ルール（ID + severity + detector）
    └── components/      ← コンポーネント契約（variant + size + a11y + rules）

Layer 3: 検証（破っても通さない）
  scripts/design/
    ├── validate.ts      ← Schema検証・トークン使用チェック
    └── drift-check.ts   ← DESIGN.mdとcontractsの乖離検知
  tests/                 ← Playwright + axe-core（アクセシビリティ）
  .github/workflows/
    └── design-validation.yml  ← CI で自動実行
```

| レイヤー | 形式 | 読み手 | 役割 |
|---|---|---|---|
| DESIGN.md | Markdown | AI（全エージェント）+ 人間 | デザイン憲法 + Quick Reference |
| CLAUDE.md | Markdown | AI (Claude Code) | 作業手順・読み込みガイド |
| contracts/ | JSON | AI + 検証ハーネス | 厳密仕様（ID + severity + detector） |
| validate.ts | TypeScript | CI | Schema検証・drift検出 |
| components/*.md | Markdown | 人間 | 設計意図・判断基準を自然言語で記述 |

### なぜ3層構造が必要か

**DESIGN.mdだけで維持できない理由:**
1. AIがmdを誤解釈しても気づけない
2. 新規メンバーがdrift（逸脱）しても検知できない
3. レビュー担当者の主観に依存する

**JSON契約 + CI検証が加わると:**
1. validate.tsが機械的に検証 → ドリフトをCIで止める
2. tokens.jsonの値を使っていないコードを自動検知
3. rules.jsonで禁止パターンをsevertyレベルで定義
4. Playwright + axe-coreでアクセシビリティを自動テスト

### DESIGN.mdとは

### DESIGN.mdとは
プロジェクトルートに配置するデザインシステム定義ファイル。Claude Codeが自動で読み込み、ブランド準拠のコードを生成する。
`brand-guidelines.md`（思想・ルール）を**機械可読な実装仕様**に変換したもの。

### 重要原則: 「値」と「意図（Why）」を必ずセットで記述する

> **themeファイル/tokens.jsonは「値」だけ。DESIGN.mdは「意図」を明文化したもの。両者は競合しない、補完関係。**

`color-primary: #0066CC` と書いてあっても「なぜ青なのか」は伝わらない。
人間が実装していた時代は暗黙知で補完できていたが、AIには意図を明示しないとブランドがドリフトする。

**全トークンに「Why」を併記する**:

```markdown
| Token | Value | Usage | Why |
|---|---|---|---|
| `--rose` | `#E8627C` | Primary accent, CTA | コーラルピンクで夜明け前の空を連想。占いの神秘性と親しみやすさを両立 |
| `--radius-card` | `18px` | Card border-radius | 角を丸めることで「柔らかさ・包容感」を表現。シャープな角は使わない |
| `font-heading` | `Zen Maru Gothic` | 見出し | 丸ゴシックで警戒心を解き、占いの「話を聞いてもらえる」安心感を作る |
```

### DESIGN.mdの必須セクション

```markdown
# DESIGN.md

## Colors
- Primary: #XXXX
- Secondary: #XXXX
- Neutral: gray scale
- Semantic: success/warning/error/info

## Typography
- Heading: font-family, weight, sizes (h1-h6)
- Body: font-family, line-height, sizes
- 日本語フォントスタック: Noto Sans JP → Hiragino → sans-serif
- Monospace: JetBrains Mono

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96

## Components
- Button: variants, sizes, states (default/hover/active/disabled)
- Card: padding, border-radius, shadow
- Form: input height, label position, error states
- Navigation: header height, mobile breakpoint

## Do / Don't
- Do: [守るべきルール]
- Don't: [やってはいけないこと]

## Hover / Interaction
- ホバー時の挙動（transition duration, opacity変化）
- フォーカスリングのスタイル
- アニメーションの原則（duration, easing）

## Responsive
- Breakpoints: sm(640) / md(768) / lg(1024) / xl(1280)
- モバイルファースト
```

### DESIGN.md生成フロー

```
1. brand-guidelines.md からトーン・カラー・フォント基準を抽出
2. 既存のFigmaデザインがあれば、デザイントークンをエクスポート
3. creative-director がプロジェクトのDESIGN.mdをドラフト
4. brand-guardian がbrand-guidelinesとの整合性を検証
5. frontend-dev が実装時にDESIGN.mdを自動参照
```

### 注意事項
- **getdesign.md等の外部DESIGN.mdはお手本として参照するのみ**。そのまま本番利用は権利的にNG
- 自社プロダクトは**自社のbrand-guidelinesをもとにDESIGN.mdを書く**のが本筋
- Figmaは消えない。画面を見ながら詰める工程は人間に必要。DESIGN.mdはAIへの指示書
- 複雑なコンポーネント（カルーセル・モーダル・アニメーション）はDESIGN.md単独ではカバーしきれない。追加指示が必要

---

## スキル横断リファレンス

| 状況 | 参照スキル |
|---|---|
| トーン・表現の品質チェック | → `brand-guidelines.md` |
| AIに選ばれるコンテンツ設計 | → `prompt-engineering.md` §3 RAG設計 |
| フロントエンドの品質ゲート | → `code-quality-gates.md` |
| API連携画面の設計 | → `api-design-patterns.md` |
| 収益に直結するコンテンツ | → `revenue-growth-framework.md` §3 アセット蓄積 |
| 出力の事実検証が必要 | → `falsification-check.md` + `/check-hallucination` |

---

## 適用エージェント
- `creative/creative-director` — デザイン方針・レビュー
- `creative/ux-designer` — UX/UI設計
- `creative/frontend-dev` — フロントエンド実装
- `creative/content-strategist` — コンテンツ制作
- `creative/campaign-planner` — キャンペーンクリエイティブ
- `creative/brand-guardian` — 品質チェック
- `creative/agentic-content` — AIO最適化



> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。
---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-03-25 | 初版 | — | ベースライン |
