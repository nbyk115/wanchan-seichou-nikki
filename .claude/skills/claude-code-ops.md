# Claude Code Ops — 運用・自動化・パフォーマンス最適化

## 概要
Claude Codeの性能を最大化するための運用ガイド。
Hooks・MCP管理・並列ワークフロー・コンテキスト管理を網羅する。

### 4層アーキテクチャ（メタフレーム）

> **出典**: Claude Code Workflow Cheatsheet 2026 Edition
> ConsultingOS は以下の4層で構成される。各層の役割を混同しないこと。

| Layer | 役割 | 実装箇所 |
|---|---|---|
| **L1: Rules** | 永続的なルールと方針（司令塔） | `CLAUDE.md`（ブランドルール・ルーティング・反証モード・外科的変更原則・冗長性禁止） |
| **L2: Skills** | 自動起動される知識パック | `.claude/skills/*.md`（22スキル） |
| **L3: Hooks** | 安全ゲートと機械的自動化 | `settings.json` の hooks セクション |
| **L4: Agents** | 独自コンテキストを持つサブエージェント | `.claude/agents/**/*.md`（34エージェント） |

**判断の原則**: 「全体の方針」→ L1 / 「特定ドメインの知識」→ L2 / 「機械的な強制」→ L3 / 「専門役割の切り出し」→ L4

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

### Exit Code 仕様
| Exit Code | 意味 |
|---|---|
| `0` | allow（処理を継続） |
| `2` | block（処理を停止） |

→ PreToolUse で `exit 2` を返すと該当ツール呼び出しがブロックされる。安全ゲートとして利用する。

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

### Optional MCPs（案件発生時に有効化する候補リスト）

> **原則**: 今は入れない。該当案件が発生した瞬間に settings.json に追加する。投機的抽象化を避けるため事前設定しない。

| MCP | 有効化する案件条件 | 対応エージェント |
|---|---|---|
| **Shopify AI Toolkit** ([shopify.dev](https://shopify.dev/docs/apps/build/ai-toolkit)) | D2C/EC コンサル案件・商品管理/在庫/SEO自動化 | `performance-marketer` / `fullstack-dev` / `seo-specialist` |
| **Stripe MCP** | 決済統合実装・サブスク設計（よるのことば等） | `fullstack-dev` / `ai-engineer` |
| **Notion MCP** | クライアント案件のドキュメント同期・ナレッジ管理 | `proposal-writer` / `product-manager` |
| **Slack MCP** | チームコミュニケーション統合（長期プロジェクト運営） | `client-success` / `strategy-lead` |
| **Linear/Jira MCP** | プロダクトバックログ連携 | `product-manager` / `tech-lead` |

→ いずれも有効化する場合は「5-6個上限」のルールを守り、使用完了後は無効化する。

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

### /ultraplan: Web上で計画立案→ローカルで実行

> **計画立案をクラウド（Web）で完結。ターミナルが詰まらず、計画中も別作業が並行可能。**

```
/ultraplan「新サービスのGTM戦略を設計して」
  → Web上でコード全体を読み込み、計画を生成
  → ブラウザで確認・編集（見やすいUI）
  → 承認後にローカルで実行 or Webで実行
```

- **従来の/planとの違い**: /planはターミナルで計画→実行が一体。/ultraplanは計画をWebに分離
- **ConsultingOSとの相性**: Consulting系エージェント（調査・分析・戦略立案）の作業をWeb側に逃がし、Service Dev系エージェント（実装）はローカルで並行実行
- **トークン消費**: 通常planとほぼ同じ
- **使い分け**:
  - `/plan`: 小〜中規模。すぐ実行したいとき
  - `/ultraplan`: 大規模計画。じっくり確認・編集したいとき。並行作業が必要なとき

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

### Dynamic Looping（動的ループ）★新機能

> **間隔を指定せず `/loop` だけ打てば、Claudeが最適な間隔を自動判断する。**

```bash
# 従来: 自分で間隔を指定
/loop 5m check for feedback in bug-hunter channel

# Dynamic Looping: Claudeが自動で間隔決定
/loop check for feedback in bug-hunter channel
  → Claudeが「最初のチェックは5分後」と判断
  → 静かだったら「次は20分後にバックオフ」と自動調整
  → 活動が多ければ間隔を短縮
```

- **効果**: 無駄な定期チェックが激減。トークン節約 + レスポンス爆速
- **使いどころ**: 大規模監視・CIチェック・フィードバック監視
- **ConsultingOSとの相性**: growth-hackerのA/Bテスト監視、infra-devopsの本番監視、client-successのヘルススコア定期チェックに最適

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

## 4.7 notebooklm-py（外部リサーチ委譲）

> **大量の資料分析をNotebookLMに丸投げし、ConsultingOS側はコンテキストを消費せずに要点だけ受け取る。**

### 何ができるか
- URL/PDF/YouTube動画を一括取り込み
- NotebookLMが自動でソース間を横断分析
- 音声・動画・スライド・クイズをプログラムで生成
- Web UIでは不可能な一括ダウンロード

### 導入
```bash
pip install notebooklm-py
# or
npm install notebooklm
```

### ConsultingOSでの活用

| エージェント | 用途 |
|---|---|
| global-journalist | 海外ニュース100記事を一括投入→要約取得 |
| market-researcher | 業界レポート10本を一括分析 |
| competitive-analyst | 競合IR/プレスリリースを一括処理 |
| content-strategist | 長文執筆時の参考資料をNotebookLMに蓄積 |
| strategy-lead | M&A対象企業の全公開資料を一括分析 |

### 効果
- 大量資料分析でもConsultingOS側のコンテキストが汚染されない
- トークン消費大幅削減
- NotebookLM側に分析結果が保持されるため、再利用可能

---

## 4.8 OpenDataLoader PDF（ローカルPDF高精度抽出）

> **用途**: Claude Code 標準の Read では扱いきれない長文・表・OCR対象 PDF を Markdown/JSON/HTML に変換する。
> **出典**: https://github.com/adlnet/OpenDataLoader-PDF（Apache 2.0・GPU不要・無料）

### 何ができるか
- **100ページ/秒** の高速パース
- **テーブル抽出 92.8% 精度**（#1 benchmark・200 real-world PDFs）
- **OCR対応**（80+言語、300 DPI scan にも対応）
- **LaTeX数式・画像・チャート** 抽出
- **RAG向け構造化Markdown** 出力（bounding box 付き JSON も可）
- **LangChain統合** 済み

### 導入
```bash
pip install opendataloader-pdf
# 3行で使える
```

### Claude Code からの呼び出し
```bash
# Bashツール経由で実行
opendataloader-pdf input.pdf --format markdown > output.md
# その後 Claude Code の Read で output.md を読む
```

### ConsultingOSでの活用シーン

| エージェント | 活用場面 |
|---|---|
| `competitive-analyst` | 競合の annual report / IR資料の一括パース |
| `global-journalist` | WEF / McKinsey / Edelman 等の長文レポート |
| `market-researcher` | 市場調査 PDF の表データ抽出 |
| `legal-compliance-checker` | 契約書・利用規約 PDF の構造化 |
| `proposal-writer` | 過去提案書からの要素再利用 |
| `ai-consultant` | 技術ホワイトペーパーの精読 |

### Claude Code 標準 Read との使い分け
| PDFサイズ/複雑度 | 推奨 |
|---|---|
| 1-20ページ・単純レイアウト | Claude Code 標準 Read |
| 20ページ超 または 表重視 | OpenDataLoader → Markdown化 → Read |
| OCR必要（scan PDF） | OpenDataLoader のみ |
| RAG構築・bounding box必要 | OpenDataLoader の JSON出力 |

### 効果
- 長文 PDF のコンテキスト消費を大幅削減（構造化後は必要な章だけ読める）
- テーブルが表として保持される（Claude Code Read では崩れがち）
- コストゼロ・API非依存・ローカル完結

---

## 5. コンテキスト管理

### rtk（コマンド出力圧縮）★Service Dev / Creative部門で推奨

> **git status, ls, find等のコマンド出力を事前圧縮し、トークン消費を最大90%削減。**
> **ただし効果があるのはBashコマンドを多用する用途のみ。**

```bash
# 導入
cargo install rtk
```

- **仕組み**: Bashコマンドの出力がコンテキストに流れる前に、rtkが自動で圧縮・フィルタ
- **効果**: git status, ls, find, npm, docker, kubectl等の冗長な出力を最小限に
- **claude-memとの使い分け**: rtkは「今のセッション内」のトークン節約、claude-memは「セッション間」のメモリ

#### 効果があるエージェント（Service Dev / Creative）
| エージェント | rtkが効くコマンド |
|---|---|
| fullstack-dev | npm, git, ls, find, grep |
| frontend-dev | ビルド出力, lint, テスト結果 |
| tech-lead | grep, find, code review系 |
| infra-devops | docker, kubectl, ログ確認 |
| ai-engineer | pip, ビルド, 評価実行 |

#### 効果が薄いエージェント
Consulting / Marketing / Global / Product系はBashコマンドをほぼ使わないため、
rtkの削減率は3%以下。**これらの部門では導入不要。**

### claude-mem（永続メモリ圧縮）★推奨

> **セッション間の記憶を自動保存・自動注入。トークン消費を削減し、使用料到達を遅らせる。**

```bash
# 導入（1行）
npx claude-mem install
```

- **自動保存**: セッション終了時に会話内容を圧縮して保存
- **自動注入**: 次のセッション開始時に必要な部分だけ読み込む
- **トークン節約**: 毎回「このプロジェクトは…」の説明が不要。長く使うほど差が大きい
- **claude-subconsciousとの関係**: claude-memが自動メモリ、claude-subconsciousが構造化メモリ。補完関係

### /compact: 手動コンテキスト圧縮
長いセッションで応答が遅くなったら `/compact` を実行。
重要な情報はCLAUDE.mdやスキルファイルに残っているため、圧縮しても失われない。

### claude --resume: 中断セッションの再開
前回のセッションが途中で終了した場合、新しいセッションを開くのではなく `claude --resume` で再開する。
会話履歴・コンテキスト・作業中のファイルが全て復元される。毎回「このプロジェクトは…」の説明が不要になる。

```bash
# ターミナルで中断したClaude Codeセッションを再開
claude --resume
```

- **claude-memとの関係**: claude-memはセッション終了時に自動保存・次回注入。`--resume`は同一セッションの直接継続。両方併用で二重に守られる
- **使い分け**:
  - 同じ作業を続ける → `--resume`
  - 前のセッションの知見を踏まえて別の作業をする → 新セッション（claude-memが自動注入）

### /rewind & /checkpoints: 巻き戻し
- `/rewind`: 会話を以前の状態に巻き戻し
- `/checkpoints`: ファイル単位のUndo管理

### コードマップの活用
`/codemap` コマンドで `.claude/codemap.md` を生成しておくと、
巨大コードベースでもコンテキストを消費せずにClaudeがナビゲートできる。

### code-review-graph（Tree-sitter AST解析・精度重視）★Service Dev向け上位版

> **/codemapは手動Markdown、code-review-graphはAST自動解析。トークン削減6.8倍の実測値あり。**

```bash
# 導入（100%ローカル・ゼロクラウド）
pip install code-review-graph
# MCP経由でClaude Codeに接続
```

- **仕組み**: Tree-sitterでAST解析 → ファイル依存関係を構造的にマッピング → 差分追跡で増分更新
- **効果**: Claudeがクエリする時だけ関連ファイルを返す。全コードベース読み込みを回避
- **実測**: 13,205トークン → 1,928トークン（6.8倍削減）、レビュー品質7.2 → 8.8
- **claude-mem:smart-exploreとの違い**: smart-exploreは汎用構造検索。code-review-graphはレビュー特化で依存関係グラフを構築

### 使い分け
```
小規模プロジェクト → /codemap で十分
中〜大規模（100ファイル超）→ code-review-graph
コードレビュー特化 → code-review-graph
汎用構造検索 → claude-mem:smart-explore
```

### 対応エージェント
- `tech-lead` — コードレビュー・技術負債分析
- `fullstack-dev` — 大規模リファクタリング時の影響範囲特定
- `frontend-dev` — コンポーネント依存関係の把握
- `infra-devops` — Infrastructure as Codeの依存関係分析

### backlog/フォルダ習慣（大量の指摘・TODO管理）

> **システム分析や長文レビューで出てきた大量の指摘・タスクを、まずmdに吐かせてから1つずつ処理する。**

AIに分析させると5-10個の重要な指摘が一気に出ることが多い。そのまま順番に処理するとコンテキストが詰まる。
代わりに `backlog/` フォルダに全タスクをmdとして吐かせてから処理する。

```
project/
├── backlog/
│   ├── 001-security-audit-findings.md    # セキュリティ監査の指摘5件
│   ├── 002-performance-bottleneck.md     # パフォーマンス改善タスク
│   ├── 003-ux-issues.md                  # UX問題点
│   └── done/                             # 完了したものを移動
│       └── 000-initial-setup.md
```

**活用方法**:
1. AIに「分析結果を`backlog/`にmdで吐いて」と指示
2. 1つのmdを開いて新しいスレッドで処理開始
3. 完了したら`backlog/done/`に移動 or 削除
4. フォローアップ項目があれば既存mdに追記
5. 別モデル（Opus/Sonnet/外部AI）にレビュー依頼する際もmdを渡すだけで文脈が伝わる

**ConsultingOSとの相性**: `/evolve` 実行結果、`/review-agent-essence` 実行結果、`agent-evaluation` のC判定タスクを `backlog/` に吐き出せば、段階的に処理できる。

**鉄則**: 何でもmdに吐かせまくる。これが最強のコンテキスト管理。

---

## 5.5 推奨settings.json設定

> **settings.jsonは4層ある。User（全プロジェクト共通）→ Project（チーム共有）→ Local（個人gitignore）→ Managed（組織ポリシー）の順で上書き。**

### 思考予算（最も体感が変わる設定）
```json
{
  "extendedThinking": true,
  "effortLevel": "high"
}
```
- デフォルトがmediumに変更されている。high常時ONにすると修正のやり直しが減り、結果的にトークン節約
- 環境変数 `MAX_THINKING_TOKENS=31999` で上限を引き上げ

### Tool Search（MCP多すぎ対策）
```json
{
  "env": {
    "ENABLE_TOOL_SEARCH": "auto:5"
  }
}
```
- MCPツール定義がコンテキストの5%を超えたら自動有効化
- ツールは名前だけコンテキストに入り、使用時にスキーマを動的取得

### セッション管理
```json
{
  "cleanupPeriodDays": 365
}
```
- デフォルト30日 → 365日に延長。過去セッションの検索が可能に

### 危険操作のdenyリスト
```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(chmod 777 *)",
      "Bash(git push --force *)",
      "Bash(git reset --hard *)"
    ]
  }
}
```

### /advisor（公式Advisor Strategy）★推奨

> **Opusがセカンドオピニオンとしてメインエージェントの作業をレビューする公式機能。**

```bash
/advisor opus    # Opusをアドバイザーに設定（推奨）
/advisor sonnet  # Sonnetをアドバイザーに
/advisor off     # アドバイザー無効化
```

- **発火タイミング**: 作業開始前・タスク完了時・エラー解決不能時に自動レビュー
- **ConsultingOSとの関係**: エージェントファイルの`model: opus/sonnet`は「どのモデルで動くか」の設定。`/advisor`はそれに加えて「Opusが上位からレビューする」機能。併用する
- **推奨**: `/advisor opus` を常時ON。Sonnetで実行→Opusがレビュー→品質ガードが1層追加される

### 必須環境変数
```bash
export MAX_THINKING_TOKENS=31999
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```
- Agent Teams: 複数Claudeインスタンスの並列協調作業を有効化

---

## 5.7 Anthropic公式マルチエージェントパターン × ConsultingOS対応表

> **出典**: Anthropic "Building Effective Agents" (2024) / claude.com/blog/multi-agent-coordination-patterns
> Anthropic公式が定義する5つの協調パターンに対し、ConsultingOSの実装箇所を明示する。**答え合わせ**であり、不足があればここに追記する。

| # | Anthropic公式パターン | 概要 | ConsultingOS実装箇所 |
|---|---|---|---|
| 1 | **Prompt Chaining** | タスクを直列ステップに分解し、各ステップの出力を次の入力に | `CLAUDE.md` エージェント連携パターン1-18（例: competitive-analyst → strategy-lead → kpi-analytics） |
| 2 | **Routing** | 入力を分類して最適なエージェント/プロンプトにディスパッチ | `CLAUDE.md` スマートルーティング判定ツリー（Step 1→2a-2f） |
| 3 | **Parallelization** | Sectioning（独立サブタスク並列）/ Voting（同一タスクを複数実行し合議） | `/fork` / `git worktree` / Agent Teams（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`）/ 反証モードStep 2の逆説テスト |
| 4 | **Orchestrator-Workers** | 中央オーケストレーターがサブタスクを動的に生成・委譲 | `strategy-lead` / `marketing-director` / `creative-director` が起点となる連携パターン、Agent Teamsの3-5名編成 |
| 5 | **Evaluator-Optimizer** | 生成→評価→改善のループで品質を段階的に向上 | 反証モード3段階（自己/構造/実用）+ `agent-evaluation.md`（25点評価カード）+ `skill-evolution.md`（A/Bテスト）+ `/advisor opus` |

### 追加パターン（ConsultingOS独自拡張）
| # | パターン | 概要 | 実装箇所 |
|---|---|---|---|
| 6 | **Governance Overlay** | 干渉原則として経営視点（佐藤×小野寺）が全エージェントを統制 | `CLAUDE.md` 干渉原則セクション |
| 7 | **Thought Leader Embedding** | 各エージェントに業界第一人者を憑依（ティール/ポーター/アイブ等） | 全34エージェントファイルの冒頭 |
| 8 | **Self-Evolution Loop** | 評価→原因分析→改善→A/Bテスト→採用/ロールバック | `/evolve` コマンド + `evolution-log.jsonl` |

### ギャップ診断（反証モード適用）
- ✅ Anthropic公式5パターンは全てカバー済み
- ⚠️ **Voting（同一タスク複数実行の合議）は形式化されていない**: 反証モードで代替しているが、「重要判断時は同エージェントを3回実行し多数決」のような明示的Votingプロトコルはない。→ 将来追加候補
- ⚠️ **Prompt Chainingのgate check**: 公式では各ステップ後に「gate」を置いて次に進むかを判定する。ConsultingOSのハンドオフプロトコルに品質ゲートはあるが、自動gate判定は未実装 → 将来追加候補

---

## 5.8 Iterative Refinement Prompt（反復改善プロンプト）

> **どのエージェントの出力に対しても使える汎用改善一言。** バズ記事（"10 Claude prompts for mobile apps"）から採用した唯一の実用要素。

```
Now improve this for a real production app.
Be more specific, more opinionated, and show tradeoffs.
```

**日本語版（ConsultingOS標準）**:
```
これを本番運用レベルに引き上げて。
より具体的に、より断定的に、トレードオフを明示して。
```

**使用シーン**:
- エージェントの初回出力が抽象的・総花的だった時
- 「無難な正解」で止まっている時
- 反証モードStep 3（実用反証）で物足りない時

**効果**: 抽象論→具体・両論併記→断定・メリットのみ→トレードオフ明示、の3方向で同時に出力が引き締まる。単独プロンプトとしても、反証モードの補助としても機能。

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
| `Shift+Tab` → `Tab` | Auto Accept モード |
| `Shift+Tab` → `Shift+Tab` | **Plan Mode**（計画のみ、実行しない） |
| `Esc Esc` | Claude中断 & コード復元 |
| `/init` | 初期化・スターターメモリ生成 |
| `/doctor` | インストール・設定診断 |
| `/compact` | コンテキスト手動圧縮 |

---

## 適用エージェント
全34エージェント共通（運用基盤）



> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。
---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-03-25 | 初版 | — | ベースライン |
| 1.1.0 | 2026-04-12 | §5.7 Anthropic公式5パターン対応表・§5.8 反復改善プロンプト追加 | Anthropic "Building Effective Agents" / claude.com/blog/multi-agent-coordination-patterns | 公式パターンとの差分可視化・Voting/Gate未実装を特定 |
| 1.2.0 | 2026-04-12 | 4層アーキテクチャメタフレーム・Hook exit code仕様・Plan Mode/doctor追加 | Claude Code Workflow Cheatsheet 2026 Edition | L1-L4の役割混同防止・安全ゲート明確化 |
| 1.3.0 | 2026-04-12 | §4.8 OpenDataLoader PDF追加 | github.com/adlnet/OpenDataLoader-PDF (#1 PDF benchmark, Apache 2.0) | 長文/表/OCR PDFをローカル高精度パースしコンテキスト消費削減 |
