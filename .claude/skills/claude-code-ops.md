# Claude Code Ops — 運用・自動化・パフォーマンス最適化

## 概要
Claude Codeの性能を最大化するための運用ガイド。
Hooks・MCP管理・並列ワークフロー・コンテキスト管理を網羅する。

---

## 1. Hooks（自動化トリガー）

Hooksはツール呼び出しやライフサイクルイベントに紐づく自動処理。
settings.jsonに定義する。

### Hook種別

| Hook | タイミング | 用途 |
|---|---|---|
| **PreToolUse** | ツール実行前 | バリデーション・警告・ブロック |
| **PostToolUse** | ツール実行後 | フォーマット・フィードバック |
| **UserPromptSubmit** | メッセージ送信時 | 入力チェック・コンテキスト付加 |
| **Stop** | Claude応答完了時 | 品質チェック・残タスク確認 |
| **PreCompact** | コンテキスト圧縮前 | 重要情報の保全 |

### ConsultingOS推奨Hooks

#### PostToolUse: TypeScript/TSX編集後にPrettier自動実行
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(echo \"$CLAUDE_TOOL_INPUT\" | jq -r '.file_path // empty'); if [[ \"$file\" == *.ts || \"$file\" == *.tsx ]]; then npx prettier --write \"$file\" 2>/dev/null; fi"
          }
        ]
      }
    ]
  }
}
```

#### PreToolUse: 長時間コマンド実行前にtmux警告
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cmd=$(echo \"$CLAUDE_TOOL_INPUT\" | jq -r '.command // empty'); if echo \"$cmd\" | grep -qE '(npm run dev|yarn dev|next dev|uvicorn|gunicorn)'; then echo 'WARN: 長時間コマンドです。tmux内で実行してください。' >&2; fi"
          }
        ]
      }
    ]
  }
}
```

#### Stop: console.log残留チェック
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "count=$(grep -r 'console\\.log' src/ --include='*.ts' --include='*.tsx' -l 2>/dev/null | grep -v test | grep -v spec | wc -l); if [ \"$count\" -gt 0 ]; then echo \"⚠️ console.logが${count}ファイルに残っています\"; fi"
          }
        ]
      }
    ]
  }
}
```

#### Stop: ブランドガイドライン違反チェック
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if git diff --cached --name-only 2>/dev/null | grep -qE '\\.(md|html|tsx)$'; then echo 'REMINDER: コンテンツファイルが変更されています。ブランドガイドライン準拠を確認してください。'; fi"
          }
        ]
      }
    ]
  }
}
```

---

## 2. MCP・Plugin管理（コンテキスト節約が最重要）

### 鉄則: コンテキストウィンドウは命

> MCPを入れすぎると200kのコンテキストが実質70kまで縮小する。
> パフォーマンスに直結するため管理が超重要。

### 管理ルール

| ルール | 内容 |
|---|---|
| **全MCPデフォルト無効が原則** | MCPは追加しても `disabledMcpServers` に即登録。必要時のみ有効化 |
| **有効化は最大5〜6個まで** | ツール総数80以下を目安。超過でコンテキスト壊滅 |
| **タスク単位でON/OFF** | タスク開始時に有効化→完了時に無効化 |
| **使っていないものは即オフ** | 定期的に `/mcp` で状態確認 |
| **APIやCLIで足りるならMCP不要** | `gh` CLI、`curl` 等で代替可能ならMCPは追加しない |
| **無料運用が前提** | 有料APIを必要とするMCPは導入前にコスト確認必須 |

### MCP導入判断フロー
```
1. 本当にMCPが必要か？ → CLI/APIで代替できるなら不要
2. 無料で使えるか？ → 有料なら導入しない（明示的な許可がない限り）
3. 追加 → 即 disabledMcpServers に登録
4. 使うとき → 有効化 → タスク完了 → 無効化
```

### 現在のMCP構成

> **このプロジェクトではMCPを使用していません。**
> GitHub操作は `gh` CLI、API呼び出しは `curl`/Bash で代替。
> MCPが必要になった場合のみ、上記フローに従って導入する。

---

## 3. Agent Teams（セッション間チーム協調）

> **Agent Teams = 複数のClaude Codeセッションがチームとして協調動作する実験的機能。**
> サブエージェントとの最大の違い: **チームメイト同士が直接メッセージをやり取りし、発見を共有し、互いの仮説を反証できる。**

### 有効化

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```
> Claude Code v2.1.32以降が必要。

### サブエージェント vs Agent Teams

| | サブエージェント | Agent Teams |
|---|---|---|
| **通信** | 結果を呼び出し元に返すのみ | チームメイト同士が直接通信 |
| **調整** | メインエージェントが全管理 | 共有タスクリスト＋自己調整 |
| **適用** | 集中した単発タスク | 議論・反証・協調が必要な複雑タスク |
| **トークン** | 低（結果要約のみ戻る） | 高（各メンバーが独立コンテキスト） |

### ConsultingOS推奨チーム構成

#### パターンA: デバッグ・バグ修正チーム（★最重要）
> **「一回で直らない」問題を解決するための競合仮説パターン**

```
チームリード → 3-5名のチームメイトを起動

チームメイト1: フロントエンド調査（UI/状態管理のバグ）
チームメイト2: バックエンド調査（API/DB/ロジックのバグ）
チームメイト3: テスト・再現確認（再現手順の特定）
チームメイト4: デビルズアドボケイト（他の仮説を反証）
```

**プロンプト例:**
```
ユーザーがログイン後に画面が白くなる問題を調査。
Agent Teamを作成:
- フロントエンド調査: React状態管理・レンダリングエラー
- バックエンド調査: 認証API・セッション管理
- テスト再現: 複数ブラウザ・デバイスで再現条件特定
- 反証担当: 他のチームメイトの仮説を積極的に否定

互いに議論して、最も確度の高い原因に収束させて。
```

#### パターンB: コードレビュー・品質チーム
```
チームメイト1: セキュリティ観点
チームメイト2: パフォーマンス観点
チームメイト3: テストカバレッジ観点
```

#### パターンC: デザイン・UI/UX検証チーム
```
チームメイト1: UXフロー検証（ユーザー操作の整合性）
チームメイト2: レスポンシブ・アクセシビリティ検証
チームメイト3: ブランドガイドライン整合性
チームメイト4: パフォーマンス（Core Web Vitals）
```

#### パターンD: 新機能開発チーム（クロスレイヤー）
```
チームメイト1: フロントエンド実装
チームメイト2: バックエンドAPI実装
チームメイト3: テスト作成
```

### 品質ゲート（Hooks連携）

```json
// settings.json — チームメイトの作業品質を自動チェック
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo 'テスト通過を確認してからタスク完了にしてください'"
          }
        ]
      }
    ]
  }
}
```

### 運用ルール

| ルール | 内容 |
|---|---|
| **チーム規模は3-5名** | それ以上は調整コストが利点を上回る |
| **1メンバー5-6タスク** | 生産性と管理のバランス |
| **ファイル競合を避ける** | 各メンバーが異なるファイル群を担当 |
| **リードは実装しない** | リードは調整・統合に専念。実装はチームメイトに委譲 |
| **トークンコスト注意** | 定常タスクにはサブエージェント、複雑タスクにはAgent Teams |
| **終了時はクリーンアップ** | リードから `Clean up the team` を実行 |

### 操作方法

| 操作 | キー/コマンド |
|---|---|
| チームメイト切り替え | `Shift+Down` |
| タスクリスト表示 | `Ctrl+T` |
| チームメイトに直接メッセージ | 切り替え後にタイプ |
| チームメイト中断 | `Enter`（セッション表示）→ `Escape` |

---

## 4. 並列ワークフロー

### /fork: 会話を分岐して並列タスクを非干渉で実行
```
メインセッション: API設計・実装
  → /fork → フォーク1: テスト作成
  → /fork → フォーク2: ドキュメント更新
```
- 各フォークは独立したコンテキストで動作
- メインセッションのコンテキストを汚さない
- 完了後にメインに戻って統合

### git worktree: ブランチ並列作業
```bash
# メインの作業ディレクトリとは別に、独立したチェックアウトを作成
git worktree add ../project-feature-a feature/auth
git worktree add ../project-feature-b feature/payment

# それぞれ別のClaude Codeセッションを起動
cd ../project-feature-a && claude
cd ../project-feature-b && claude
```
- コンフリクトなく複数機能を並列開発
- 各worktreeに別々のClaudeインスタンスを割り当て

### tmux: 長時間コマンドのデタッチ
```bash
# 新しいtmuxセッションでサーバー起動
tmux new-session -d -s dev "npm run dev"

# 別のペインでClaude作業
tmux new-session -d -s claude "claude"

# 後からログ確認
tmux attach -t dev
```

---

## 4.5 Monitor（イベント駆動型バックグラウンド監視）

> **`sleep`ポーリングを廃止し、イベント発火で即反応する効率的な監視。トークンを大幅に節約する。**

### Monitorとは
バックグラウンドでプロセスの出力（stdout）を監視し、**条件に合致した行が出た瞬間にClaudeを起こす**仕組み。
`sleep`ループや`/loop`によるポーリングと違い、何も起きていない間はトークンを消費しない。

### 基本パターン

```
# Monitorの起動イメージ
Monitor({
  command: "tail -f /var/log/app.log",        # 監視対象コマンド
  pattern: "ERROR|CRITICAL|FATAL",             # 通知条件（正規表現）
  description: "アプリログのエラー監視"
})
```

### ConsultingOS活用シーン

| シーン | 監視コマンド | パターン | 起動エージェント |
|---|---|---|---|
| デプロイ監視 | `tail -f deploy.log` | `ERROR\|FAILED\|ROLLBACK` | infra-devops |
| テスト実行 | `npm test 2>&1` | `FAIL\|Error` | fullstack-dev |
| ビルド監視 | `npm run build 2>&1` | `error\|BUILD FAILED` | frontend-dev |
| CI/CD結果 | `gh run watch` | `completed\|failure` | infra-devops |
| サーバーログ | `docker logs -f app` | `500\|503\|timeout` | tech-lead |
| DB監視 | `tail -f slow-query.log` | `Query_time: [0-9]{2,}` | fullstack-dev |

### Monitor vs 従来手法の比較

| 項目 | sleep ループ | /loop | Monitor |
|---|---|---|---|
| トークン消費 | 毎回フル消費 | 定期的に消費 | イベント時のみ |
| 反応速度 | sleepの間隔に依存 | 間隔に依存 | 即時（行単位） |
| CPU使用率 | 高い | 中 | 低い |
| 用途 | 汎用 | 定期チェック | ログ・ストリーム監視 |
| 推奨 | 非推奨 | 定期レポート向き | リアルタイム監視向き |

### 使い分けガイド

```
監視タスクが来たら:
├─ 「定期的に結果を見たい」（毎5分のレポート等）
│   └─ /loop を使う
├─ 「何か起きたら即教えて」（エラー検知・完了通知等）
│   └─ Monitor を使う
└─ 「1回だけ完了を待ちたい」（ビルド完了待ち等）
    └─ Bash の run_in_background を使う
```

### 障害対応での活用（infra-devops / tech-lead 連携）

```
1. 障害発生 → tech-lead が SEV判定
2. Monitor起動:
   - Monitor(command: "kubectl logs -f pod/app", pattern: "ERROR|OOM|CrashLoop")
   - Monitor(command: "curl -s -o /dev/null -w '%{http_code}' https://app.example.com", pattern: "^[45]")
3. Monitorが異常を検知 → 即座に原因仮説の検証に入る
4. 修正デプロイ後もMonitorを継続 → 再発がないことを確認
5. 30分間異常なし → Monitor停止 → ポストモーテム実施
```

---

## 5. コンテキスト管理

### /compact: 手動コンテキスト圧縮
長いセッションで応答が遅くなったら `/compact` を実行。
重要な情報はCLAUDE.mdやスキルファイルに残っているため、圧縮しても失われない。

### /rewind & /checkpoints: 巻き戻し
- `/rewind`: 会話を以前の状態に巻き戻し
- `/checkpoints`: ファイル単位のUndo管理

### コードマップの活用
`/codemap` コマンドで `.claude/codemap.md` を生成しておくと、
巨大コードベースでもコンテキストを消費せずにClaudeがナビゲートできる。

---

## 6. ショートカット早見表

| キー | 機能 |
|---|---|
| `Ctrl+U` | 1行丸ごと削除 |
| `!` | bashコマンドをクイック実行 |
| `@` | ファイルをインクリメンタル検索 |
| `/` | スラッシュコマンド起動 |
| `Shift+Enter` | 複数行入力 |
| `Tab` | 思考表示の切り替え |
| `Esc Esc` | Claude中断 & コード復元 |

---

## 適用エージェント
全34エージェント共通（運用基盤）



> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。
---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-03-25 | 初版 | — | ベースライン |
