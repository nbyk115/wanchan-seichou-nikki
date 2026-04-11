# /security-scan — セキュリティスキャン

コードベース全体をスキャンし、以下のセキュリティリスクを検出・報告してください。

## チェック項目

### 1. ハードコードされたシークレット
- API キー、トークン、パスワードが直書きされていないか
- `.env` ファイルが `.gitignore` に含まれているか

### 2. OWASP Top 10
- SQLインジェクション（生SQL、テンプレートリテラル内のSQL）
- XSS（dangerouslySetInnerHTML、sanitize未使用の入力表示）
- CSRF（トークン未使用のPOST/PUT/DELETE）
- 認証・認可の不備

### 3. 依存関係
- `package.json` / `requirements.txt` の既知CVE（バージョン確認）
- ロックファイルの存在確認

### 4. 設定ファイル
- CORS設定（`*` の使用）
- デバッグモードが本番で有効になっていないか
- HTTPS強制の設定

## 出力
| 重要度 | ファイル:行 | 問題 | 推奨修正 |
|---|---|---|---|

重要度: 🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low
