# Code Quality Gates — PR前自動品質チェック

## 概要
PRを出す前に通すべき品質ゲートの定義。
「レビューで指摘される前に自分で潰す」ための構造的チェックリスト。

---

## 1. 品質ゲート一覧

### Gate 1: コンパイル・型チェック（自動）
```bash
# TypeScript
npx tsc --noEmit

# Python
mypy . --strict
```
**判定**: エラー0件で通過。警告は許容するが新規追加は不可。

### Gate 2: Lint・フォーマット（自動）
```bash
# TypeScript/JavaScript
npx eslint . --max-warnings=0
npx prettier --check .

# Python
ruff check .
ruff format --check .
```
**判定**: エラー0件・既存警告数を増やさない。

### Gate 3: テスト（自動）
```bash
# ユニットテスト
npm test -- --coverage

# Python
pytest --cov --cov-fail-under=80
```
**判定**: 全テスト通過 + カバレッジが閾値以上。

### Gate 4: セキュリティ（自動 + 手動）
```bash
# 依存関係の脆弱性
npm audit --audit-level=high
pip-audit

# シークレット漏洩チェック
git diff --cached | grep -E '(password|secret|api.?key|token)\s*[:=]'
```
**判定**: HIGH以上の脆弱性0件。シークレットのハードコードなし。

### Gate 5: 変更影響の確認（手動）
| チェック項目 | 確認方法 |
|---|---|
| 破壊的変更がないか | 公開API/型の変更を `git diff` で確認 |
| マイグレーションは安全か | `migration-safety.md` のチェックリスト参照 |
| パフォーマンス劣化がないか | N+1クエリ・不要な再レンダリングの確認 |
| エラーハンドリング | システム境界（API/DB/外部サービス）にtry-catch |

---

## 2. PRセルフレビューチェックリスト

PRを出す前に自分で確認する項目。

### コード品質
- [ ] 不要な `console.log` / `print` / `debugger` が残っていない
- [ ] コメントアウトされたコードが残っていない
- [ ] TODO/FIXMEがある場合はIssue番号が紐づいている
- [ ] 変数名・関数名が意図を表している
- [ ] マジックナンバーが定数化されている

### ロジック
- [ ] エッジケース（null, 空配列, 0, 空文字）を考慮している
- [ ] 境界値（off-by-one）を確認した
- [ ] 並行処理の競合条件を考慮した（該当する場合）
- [ ] エラーパスが正しく処理される

### セキュリティ
- [ ] ユーザー入力はバリデーション済み
- [ ] SQLはパラメータ化クエリを使用
- [ ] HTMLエスケープ / XSS対策
- [ ] 認証・認可チェックが必要な箇所に入っている
- [ ] シークレットが環境変数になっている

### テスト
- [ ] 新しいロジックにテストが書かれている
- [ ] 既存テストが壊れていない
- [ ] エッジケースのテストがある
- [ ] テストが他のテストに依存していない（独立実行可能）

### PR自体
- [ ] PRの説明に「何を」「なぜ」変更したか書いた
- [ ] 変更が大きすぎないか（目安: 400行以内）
- [ ] 関連Issueがリンクされている

---

## 3. 自動化スクリプト

### pre-commit hook（推奨設定）
```bash
#!/bin/bash
# .git/hooks/pre-commit

set -e

echo "🔍 Gate 1: 型チェック..."
npx tsc --noEmit

echo "🔍 Gate 2: Lint..."
npx eslint --max-warnings=0 $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$')

echo "🔍 Gate 3: フォーマット..."
npx prettier --check $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|json|css)$')

echo "🔍 Gate 4: シークレットチェック..."
if git diff --cached | grep -iE '(password|secret|api.?key|token)\s*[:=]\s*["\x27][^"\x27]{8,}'; then
  echo "❌ シークレットがハードコードされている可能性があります"
  exit 1
fi

echo "✅ 全ゲート通過"
```

### Claude Code Hooks 連携
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "if echo '$TOOL_INPUT' | grep -qE '\\.(ts|tsx)$'; then npx prettier --write \"$(echo '$TOOL_INPUT' | jq -r '.file_path')\"; fi"
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "command": "git diff --cached --name-only | head -20 && echo '--- console.log check ---' && git diff --cached | grep -n 'console\\.log' || true"
      }
    ]
  }
}
```

---

## 4. Agent Team 連携プロンプト

### PRレビュー強化チーム
```
PR #[番号]のレビュー。Agent Teamを作成:

- セキュリティ: OWASP Top 10に該当する問題はないか。入力検証・認証認可・SQLi/XSS
- パフォーマンス: N+1クエリ・不要なre-render・メモリリーク・計算量
- テスト品質: カバレッジ・エッジケース漏れ・テストの壊れやすさ
- 反証: 各レビュアーが「問題なし」と判断した箇所に「この入力なら壊れないか？」と攻撃せよ

【ルール】
- 「問題なし」は反証担当が攻撃して壊せなかった場合のみ認める
- 指摘にはファイル名・行番号・修正案を含めること
- 重要度（MUST FIX / SHOULD FIX / NIT）を明記
```

### コミット前クイックチェック
```
今の差分を品質チェック:

1. 型エラー・Lintエラーがないか
2. console.log / デバッグコードが残っていないか
3. シークレットのハードコードがないか
4. テストが通るか
5. セキュリティ上の問題がないか

問題があればファイル名・行番号とともに報告。問題なければ「全ゲート通過」と報告。
```

---

## 5. 品質メトリクス（チーム運用時）

| メトリクス | 目標値 | 計測方法 |
|---|---|---|
| PRレビュー指摘数 | 3件以下/PR | GitHub PR comments |
| レビュー差し戻し率 | 10%以下 | 差し戻しPR数 / 全PR数 |
| 本番バグ率 | 月1件以下 | バグチケット数 |
| 型エラー | 0件 | CI `tsc --noEmit` |
| Lintエラー | 0件 | CI ESLint/Ruff |
| テストカバレッジ | 80%以上 | CI coverage report |
| 依存脆弱性(HIGH+) | 0件 | `npm audit` / `pip-audit` |

---

## アンチパターン（これをやるな）

| ❌ やりがち | ✅ 正しい方法 |
|---|---|
| 「急ぎだから品質ゲートスキップ」 | 急ぎこそゲートを通す。ホットフィックスでも最低限Gate1-4 |
| PR 1,000行超えの巨大PR | 400行以内に分割。大きいPRはレビュー品質が指数的に低下 |
| 「テスト通ったからOK」 | テストカバレッジ + セルフレビューチェックリストの両方を通す |
| console.logでデバッグしてそのままコミット | pre-commit hookで自動検出。残留させない仕組みを作る |
| レビューで「LGTM」だけ | 最低1つは改善提案を出す。問題なしでも「ここが良い」を言語化 |

---

## 適用エージェント
- `service-dev/tech-lead` — 品質基準の策定・レビュー方針
- `service-dev/fullstack-dev` — ゲート通過の実行・修正
- `service-dev/infra-devops` — CI/CD パイプラインへの組み込み
- `creative/frontend-dev` — フロントエンド固有の品質チェック



> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。
---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-03-25 | 初版 | — | ベースライン |
