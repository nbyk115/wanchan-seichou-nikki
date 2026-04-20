# /security-scan — セキュリティスキャン

コードベース全体をスキャンし、`.claude/skills/cybersecurity-playbook.md` に基づいてセキュリティリスクを検出・報告してください。

## スキャン手順

### Phase 1: シークレット検知（Critical）
```bash
# 以下のパターンをgrepで検出
grep -rn 'sk-[a-zA-Z0-9]\{32,\}' --include='*.ts' --include='*.js' --include='*.py' --include='*.env*'
grep -rn 'AKIA[A-Z0-9]\{16\}' --include='*.ts' --include='*.js' --include='*.py'
grep -rn 'ghp_[a-zA-Z0-9]\{36\}' --include='*.ts' --include='*.js' --include='*.py'
grep -rn 'password\s*[:=]\s*["\x27][^"\x27]\{8,\}' --include='*.ts' --include='*.js' --include='*.py'
grep -rn 'BEGIN.*PRIVATE KEY' .
```

### Phase 2: OWASP Top 10チェック
- `cybersecurity-playbook.md` セクション2のチェックリストを全項目実行
- 特にA03（インジェクション）とA05（設定ミス）を重点的に

### Phase 3: 依存関係
```bash
npm audit 2>/dev/null || echo "npm not configured"
pip audit 2>/dev/null || echo "pip not configured"
```

### Phase 4: 設定ファイル
- CORS設定（ワイルドカード使用チェック）
- CSP（Content Security Policy）ヘッダー
- HTTPS強制設定
- デバッグモードの本番無効化

### Phase 5: AI固有
- プロンプトインジェクション脆弱性
- シークレットがプロンプトに含まれていないか
- AI出力が直接eval/execされていないか

## 出力フォーマット

```
# セキュリティスキャン結果
日時: YYYY-MM-DD HH:MM
対象: [プロジェクト名]

## サマリー
🔴 Critical: X件
🟠 High: X件
🟡 Medium: X件
🔵 Low: X件

## 詳細
| 重要度 | カテゴリ | ファイル:行 | 問題 | 推奨修正 |
|---|---|---|---|---|

## 推奨アクション
1. [最優先] ...
2. [次回対応] ...
```
