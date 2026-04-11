# Browser Automation — ブラウザ自動化スキル

## 概要
Browser Use CLI 2.0 + CDP直接接続によるブラウザ自動化。
エージェントが自律的にWebページを操作・情報収集・フォーム入力を行う。

---

## 推奨ツールスタック

| ツール | 用途 | 接続方式 |
|---|---|---|
| **Browser Use CLI** | メイン自動化エンジン | MCP (stdio/HTTP) |
| **Chrome DevTools MCP** | 軽量CDP直接操作 | MCP (stdio) |
| **Playwright MCP** | テスト・検証ワークフロー | MCP (stdio) |

### 選定基準
- **Browser Use**: 3ブラウザモード対応・永続セッション・クラウド並列。汎用性最高
- **Chrome DevTools MCP**: トークン効率重視の軽量操作
- **Playwright MCP**: テスト自動化・E2E検証に特化

---

## セットアップ

### Browser Use CLI（推奨）

#### ローカル版（stdio・無料）
```bash
# Claude Codeに追加
claude mcp add browser-use -- uvx --from "browser-use[cli]" browser-use --mcp

# uvxのパスが通らない場合
claude mcp add browser-use -- $(which uvx) --from "browser-use[cli]" browser-use --mcp
```

#### クラウド版（HTTP・有料）
```bash
claude mcp add --transport http browser-use https://api.browser-use.com/mcp
```

### Chrome DevTools MCP（軽量補助）
```bash
# Chrome起動（リモートデバッグ有効）
google-chrome --remote-debugging-port=9222

# MCP追加
claude mcp add chrome-devtools -- npx @anthropic-ai/chrome-devtools-mcp
```

### Playwright MCP（テスト用）
```bash
claude mcp add playwright -- npx @playwright/mcp --browser chromium
```

---

## 使用パターン

### パターン1: 競合サイト調査（consulting連携）
```
competitive-analyst が Browser Use で競合サイトを巡回
→ 価格・機能・UIを自動キャプチャ
→ 分析結果を strategy-lead に渡す
```

**指示例:**
> Browser Useで以下の競合サイト3つを巡回し、価格表・機能一覧・導線を取得してください

### パターン2: フォーム入力テスト（service-dev連携）
```
fullstack-dev が Playwright MCP でフォームのE2Eテスト
→ バリデーション・送信・エラーハンドリングを自動検証
```

**指示例:**
> Playwright MCPで会員登録フォームのE2Eテストを実行してください

### パターン3: LP品質チェック（creative連携）
```
ux-designer が Browser Use でLP表示確認
→ レスポンシブ・表示崩れ・リンク切れを自動チェック
→ brand-guardian がスクリーンショットでブランド準拠確認
```

**指示例:**
> Browser UseでLPをモバイル/デスクトップで開き、表示崩れとリンク切れを確認してください

### パターン4: データ収集・スクレイピング（kpi-analytics連携）
```
kpi-analytics が Browser Use で公開データを収集
→ 市場レポート・業界データを自動取得
→ 数値分析に反映
```

---

## トークン効率の最適化

### Browser Use CLI 2.0の優位点
- **2倍速**: v1比で処理速度2倍
- **半額**: トークン消費50%削減
- **CDP直接接続**: 中間レイヤーなしで低レイテンシ
- **Claude Code連携**: トークン効率さらに2倍（合計4倍改善）

### コンテキスト節約ルール
1. **必要時のみ有効化**: `disabledMcpServers` でデフォルト無効
2. **セッション管理**: 永続セッションを使い回し、起動コストを削減
3. **スクリーンショットは最小限**: テキスト抽出優先、画像は必要時のみ
4. **バッチ処理**: 複数ページの巡回は1セッションにまとめる

---

## セキュリティ注意事項

| リスク | 対策 |
|---|---|
| 認証情報の露出 | ログイン操作は環境変数経由、プロンプトにパスワード直書き禁止 |
| 意図しない操作 | 購入・送信・削除など不可逆操作は事前確認必須 |
| スクレイピング規約 | robots.txt・ToS確認。過剰アクセス禁止 |
| セッション漏洩 | 作業後はセッション破棄 |

---

## 実戦テンプレート

### ブラウザ自動化タスク設計シート（コピペ用）
```
【タスク名】___
【目的】情報収集 / フォーム入力 / スクリーンショット / テスト
【対象URL】___
【実行頻度】1回 / 定期（___間隔）

手順:
1. ___にアクセス
2. ___を実行
3. ___を取得/保存
4. 結果を___に出力

エラー処理:
- ページ未読み込み → ___秒待機後リトライ（最大3回）
- 要素未検出 → 代替セレクタを試行
- 認証エラー → 処理中断して報告

使用ツール: □ Browser Use CLI □ CDP直接接続 □ Playwright
```

---

## 適用エージェント

| 部門 | エージェント | 主な用途 |
|---|---|---|
| Consulting | competitive-analyst | 競合サイト調査 |
| Consulting | kpi-analytics | 公開データ収集 |
| Service Dev | fullstack-dev | E2Eテスト |
| Service Dev | infra-devops | デプロイ後の動作確認 |
| Creative | ux-designer | LP表示確認・レスポンシブチェック |
| Creative | brand-guardian | ビジュアル品質確認 |
| Creative | growth-hacker | A/Bテスト結果の自動取得 |



> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。
---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-03-25 | 初版 | — | ベースライン |
