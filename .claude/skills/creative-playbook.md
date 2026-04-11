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

### 自動選定ロジック（creative-directorが判断）

```
リクエスト受領
  ↓
何を作るか？
  ├── UI/アプリ画面（新規・ラフ） → Google Stitch（0→1生成）
  │     → 仕上げが必要なら → Figma or frontend-dev
  ├── 提案書・ピッチデック・社内資料 → Google Slides
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
| 提案書 + デモUI | Google Slides（資料）+ Google Stitch（UIモック） |
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

## 3. デザインツール連携ガイド

### 対応エージェントとツール
| エージェント | Canva | Figma | Google Slides |
|---|---|---|---|
| `creative-director` 🎨 | ✅ 方針指示・レビュー | ✅ デザインレビュー | ✅ 資料レビュー |
| `ux-designer` 🎨 | ✅ 簡易LP・モック | ✅ UX/UI設計 | — |
| `frontend-dev` 🎨 | — | ✅ Figma→コード変換 | — |
| `proposal-writer` | — | — | ✅ 提案書作成 |

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

## 9. DESIGN.md（リポジトリの見た目の憲法）

> **Figmaで画面を作って終わりではない。その裏のデザインルールをMarkdownに落とし、AIが安定した出力を出せる状態を作る。AI時代の成果物は「Figma + DESIGN.md」のセット。**

### DESIGN.mdとは
プロジェクトルートに配置するデザインシステム定義ファイル。Claude Codeが自動で読み込み、ブランド準拠のコードを生成する。
`brand-guidelines.md`（思想・ルール）を**機械可読な実装仕様**に変換したもの。

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
