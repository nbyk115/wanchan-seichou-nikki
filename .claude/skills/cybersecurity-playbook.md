# Cybersecurity Playbook — サイバーセキュリティ標準

## 概要
全エージェント・全プロジェクトに適用されるサイバーセキュリティの標準手法。
「セキュリティは専門部署の仕事」ではなく「全員の責任」として設計に組み込む。

---

## 1. シフトレフト原則 — 設計段階でセキュリティを組み込む

> **バグを本番で見つけるコストは、設計段階の100倍。セキュリティも同じ。**

### 各フェーズのセキュリティ責務
| フェーズ | 担当 | やること |
|---|---|---|
| 要件定義 | strategy-lead / product-manager | 脅威モデリング。「誰が・何を・どう攻撃するか」を事前定義 |
| 設計 | tech-lead | 認証・認可・データフロー・暗号化方針の決定 |
| 実装 | fullstack-dev / ai-engineer | OWASP Top 10準拠。入力バリデーション。シークレット管理 |
| テスト | /security-scan | 自動スキャン。CI/CDに組み込み |
| デプロイ | infra-devops | TLS強制・ヘッダー設定・WAF・ネットワークポリシー |
| 運用 | infra-devops / tech-lead | ログ監視・インシデント対応・パッチ管理 |

---

## 2. OWASP Top 10（2025年版準拠）

### チェックリスト（全プロジェクト必須）

```
□ A01 アクセス制御の不備
  - 全エンドポイントに認証・認可チェックがあるか
  - IDOR（他ユーザーのリソースへの直接アクセス）が防がれているか
  - 管理者機能に適切なロールチェックがあるか

□ A02 暗号化の失敗
  - パスワードはbcrypt/argon2でハッシュ化されているか
  - 通信はTLS 1.2以上か
  - 機密データがログに出力されていないか

□ A03 インジェクション
  - SQLインジェクション: パラメータ化クエリ/ORMを使用しているか
  - XSS: ユーザー入力をサニタイズしているか。dangerouslySetInnerHTML禁止
  - コマンドインジェクション: シェルコマンドにユーザー入力を直接渡していないか

□ A04 安全でない設計
  - 脅威モデリングを実施したか
  - ビジネスロジックの悪用パターンを検討したか
  - レート制限があるか

□ A05 セキュリティ設定ミス
  - CORS: ワイルドカード（*）を使っていないか
  - デバッグモードが本番で無効か
  - デフォルトパスワード/アカウントが残っていないか
  - 不要なHTTPメソッドが無効化されているか

□ A06 脆弱なコンポーネント
  - npm audit / pip audit で既知CVEがないか
  - ロックファイル（package-lock.json / poetry.lock）がコミットされているか
  - 依存パッケージの最終更新日が2年以内か

□ A07 認証の不備
  - 多要素認証（MFA）が利用可能か
  - セッション管理: 適切な有効期限・無効化処理があるか
  - パスワードポリシー: 最低8文字・ブルートフォース対策

□ A08 ソフトウェアとデータの整合性
  - CI/CDパイプラインが改ざんされていないか
  - SRI（Subresource Integrity）ハッシュがCDNリソースに付与されているか
  - 署名検証: パッケージ・コンテナイメージの署名確認

□ A09 ログとモニタリングの不備
  - 認証失敗・認可エラー・入力バリデーション失敗をログに記録しているか
  - ログに機密情報（パスワード・トークン・PII）が含まれていないか
  - アラート: 異常なパターン（大量ログイン失敗等）で通知が飛ぶか

□ A10 SSRF（サーバーサイドリクエストフォージェリ）
  - ユーザー入力のURLを内部ネットワークに転送していないか
  - URLのホワイトリスト/ブラックリストが設定されているか
```

---

## 3. シークレット管理

### 鉄則
- **ハードコード絶対禁止**: APIキー・トークン・パスワードをコードに書かない
- **環境変数で管理**: `.env`ファイルは`.gitignore`に必ず追加
- **ローテーション**: シークレットは90日ごとにローテーション
- **最小権限**: APIキーは必要最小限のスコープで発行

### 検知パターン（/security-scan用）
```bash
# 以下のパターンがコードに含まれていたらCritical
sk-[a-zA-Z0-9]{32,}          # OpenAI/Anthropic APIキー
AKIA[A-Z0-9]{16}              # AWS Access Key
ghp_[a-zA-Z0-9]{36}           # GitHub Personal Access Token
xoxb-[0-9]{10,13}-[a-zA-Z0-9] # Slack Bot Token
-----BEGIN.*PRIVATE KEY-----   # 秘密鍵
password\s*[:=]\s*['"][^'"]{8,}  # ハードコードパスワード
```

---

## 4. 認証・認可設計パターン

### 認証
| 方式 | 用途 | セキュリティレベル |
|---|---|---|
| OAuth 2.0 + PKCE | Webアプリ・SPA | 高 |
| JWT + Refresh Token | API認証 | 高（Refresh Tokenの管理が鍵） |
| Magic Link | メール認証 | 中（メールセキュリティに依存） |
| パスワード + MFA | 従来型 | MFAありなら高 |
| API Key | サーバー間通信 | 中（スコープ制限必須） |

### 認可
- **RBAC**（Role-Based Access Control）: ユーザー → ロール → 権限
- **ABAC**（Attribute-Based Access Control）: 属性ベース（時間・場所・デバイス）
- **全エンドポイントに認可チェック**: デフォルト拒否。明示的に許可する

---

## 5. データ保護

### 分類
| レベル | 例 | 保護要件 |
|---|---|---|
| 極秘 | 決済情報・パスワード | 暗号化必須。アクセスログ。最小権限 |
| 機密 | PII（氏名・メール・電話） | 暗号化推奨。同意取得。削除対応 |
| 社内 | 売上データ・戦略文書 | アクセス制限。外部共有禁止 |
| 公開 | マーケ資料・ブログ | 制限なし |

### PII（個人識別情報）の取り扱い
- 収集は必要最小限（データミニマイゼーション）
- 利用目的を明示（プライバシーポリシー）
- 削除リクエストに対応（GDPR/個人情報保護法）
- ログにPIIを含めない

---

## 6. インフラセキュリティ

### ネットワーク
- TLS 1.2以上を強制（HTTP→HTTPSリダイレクト）
- セキュリティヘッダー: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- WAF（Web Application Firewall）の導入検討
- DDoS対策（Cloudflare / AWS Shield）

### コンテナ
- ベースイメージは最小構成（Alpine/Distroless）
- rootユーザーで実行しない
- イメージスキャン（Trivy/Snyk）をCI/CDに組み込み
- シークレットをDockerfile/docker-compose.ymlに書かない

### CI/CD
- パイプラインの改ざん防止（署名付きコミット）
- 依存関係スキャン（npm audit / pip audit）を自動実行
- SASt（静的解析）をPR時に自動実行

---

## 7. インシデント対応（セキュリティ版）

> `incident-response.md`の障害対応に加え、セキュリティ固有の対応手順。

### セキュリティインシデントの分類
| SEV | 例 | 対応時間 |
|---|---|---|
| SEV1 | データ漏洩・不正アクセス・ランサムウェア | 即時（1時間以内に初動） |
| SEV2 | 脆弱性の悪用（未遂含む）・DDoS | 4時間以内 |
| SEV3 | 脆弱性の発見（未悪用）・設定ミス | 24時間以内 |

### 対応フロー
```
1. 検知 → 即座に影響範囲を特定
2. 封じ込め → 攻撃経路を遮断（アカウント無効化/IP遮断/サービス隔離）
3. 証拠保全 → ログ・スナップショット・通信記録を保存（削除禁止）
4. 復旧 → パッチ適用/シークレットローテーション/サービス復旧
5. 報告 → 影響を受けたユーザーへの通知（法令に基づく期限内）
6. 事後分析 → 根本原因分析 + 再発防止策
```

---

## 8. AI固有のセキュリティ

> ConsultingOSの34エージェントが扱うAI固有のリスク。

### プロンプトインジェクション対策
- ユーザー入力とシステムプロンプトを明確に分離
- 外部データ（Web取得・ファイル読み込み）にはサニタイズフィルタを適用
- AI出力を直接eval/execしない
- 機密情報をシステムプロンプトに含めない

### データ汚染対策
- RAGのデータソースの信頼性を検証
- 学習データ/ナレッジベースの改ざん検知
- ユーザー入力がナレッジベースに直接書き込まれない設計

### AI出力のリスク
- AI生成コードのセキュリティレビュー必須（/security-scan）
- AI生成コンテンツのファクトチェック（ハルシネーション対策）
- AI生成の法的文書は必ず専門家レビュー（legal-compliance-checkerの免責事項）

---

## 8.5 サプライチェーンセキュリティ（npm / PyPI / GitHub Actions）

> **依存パッケージ経由の攻撃が2024-2026年で急増。OWASP A08「ソフトウェアとデータの整合性」の実装詳細。**

### 脅威モデル
- 悪意あるパッケージ（typosquatting: expres, loadsh 等）
- 既存パッケージの乗っ取り（メンテナアカウント侵害）
- preinstall / postinstall スクリプトでの任意コード実行
- ビルドパイプライン改ざん（GitHub Actions injection）

### 8つの防御設定

**1. ロックファイル強制コミット**
```
package-lock.json / yarn.lock / pnpm-lock.yaml / poetry.lock
→ 必ずgit管理。CI時は `npm ci` を使い `npm install` を禁止
```

**2. 自動脆弱性スキャン（CI組込）**
```yaml
# GitHub Actions例
- run: npm audit --audit-level=high
- run: pip-audit
```
`audit-level=high`以上でCIを落とす。

**3. Dependabot / Renovate で自動更新PR**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

**4. preinstallスクリプトをブロック**
```bash
# 新規パッケージ追加時
npm install --ignore-scripts <package>
# その後、信頼できるもののみscriptを手動実行
```

**5. GitHub Secret Scanning + Push Protection**
```
Settings → Code security and analysis → Secret scanning: Enabled
Push protection: Enabled
→ コミット時にシークレットを自動検知・ブロック
```

**6. Dependency Review Action（PR時の新規依存チェック）**
```yaml
# .github/workflows/dependency-review.yml
- uses: actions/dependency-review-action@v4
  with:
    fail-on-severity: high
```

**7. npm provenance / SLSA対応**
```bash
# パッケージ公開時にprovenanceを付与
npm publish --provenance

# インストール時に検証
npm install --auditlevel=high
```

**8. GitHub Actions のpin固定**
```yaml
# 悪い例: バージョンタグ（書き換え可能）
- uses: actions/checkout@v4

# 良い例: commit SHAで固定
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

### typosquatting対策
- 新規パッケージ追加前に GitHub Stars / ダウンロード数 / メンテナ履歴を確認
- 類似名（`lodash` vs `loadsh`, `express` vs `expres`）に注意
- `npm view <package>` で公開元・メンテナを確認

### ConsultingOS適用
- `fullstack-dev` / `frontend-dev` / `ai-engineer`: 新規パッケージ追加前に上記1-5を必ず確認
- `infra-devops`: CI/CDに2, 6, 8を組み込み
- `tech-lead`: 四半期ごとに全プロジェクトの依存監査

---

## 8.7 ガバナンスフレームワーク（経営層向け）

> **目的**: エンタープライズ案件・経営層向け提案で使うセキュリティガバナンスの共通言語。**エンジニアリング層（§1-8.5）とは別軸**で、組織運営・監査・経営判断の語彙を提供する。
> **出典**: IPA / NIST / METI / ISO 公式資料

### 主要5フレームワーク対応表

| フレームワーク | 発行元 | 目的 | 適用範囲 | 主要構成 |
|---|---|---|---|---|
| **ISMS (ISO/IEC 27001)** | ISO | 情報セキュリティマネジメントシステムの構築・認証 | 全組織 | 14ドメイン・114管理策・PDCAサイクル |
| **NIST CSF** | 米国NIST | リスクベースのサイバーセキュリティ管理 | 業界横断 | 6機能: Govern/Identify/Protect/Detect/Respond/Recover |
| **CPSF** | 経産省 | Society5.0時代の Cyber-Physical 統合対策 | 製造業・IoT・OT | 3層構造（企業間/フィジカル/サイバー）+ 6領域 |
| **経営ガイドライン** | 経産省 | 経営者が認識すべき「3原則・10の重要項目」 | 経営層 | CISO任命・リスク対応計画・サプライチェーン管理 |
| **ISO/IEC 27005** | ISO | 情報セキュリティリスクマネジメント | ISMS運用組織 | リスク特定→分析→評価→対応→モニタリング |

### 判断マトリクス（どれを使うか）

| クライアントの状況 | 推奨フレームワーク |
|---|---|
| B2B SaaS・国際展開・セキュリティ認証が必要 | ISMS (ISO 27001) |
| 官公庁案件・米国市場参入 | NIST CSF |
| 製造業・工場・IoT/OT統合 | CPSF |
| 経営層への説明資料・取締役会報告 | 経営ガイドライン |
| リスクアセスメント手法の標準化 | ISO 27005 |
| スタートアップ・リソース制約あり | NIST CSF（最軽量・リスクベース） |

### ガバナンス診断チェック（6カテゴリ集約）

エンタープライズ案件の初期診断で使う簡易チェックリスト。詳細な20項目版は IPA / 経産省資料を参照。

- [ ] **フレームワーク選定**: 事業特性に適したフレームワークを選定し、複数を組み合わせる場合の整合を取っているか
- [ ] **資産特定・責任者**: 情報資産を特定し、管理責任者を明確化しているか（ISMS要求）
- [ ] **PDCAサイクル**: ポリシー策定→運用→監査→改善のサイクルが定期的に回っているか
- [ ] **リスク管理プロセス**: リスク特定・分析・評価・対応を文書化し、残留リスクを経営層に報告しているか（ISO 27005）
- [ ] **教育・監査**: 全従業員へのセキュリティ教育と、外部監査または自己点検を年次で実施しているか
- [ ] **法令・基準追従**: 法令改正・ガイドライン更新時に自社のフレームワーク対応を更新しているか

### エージェント活用

| エージェント | ガバナンス責務 |
|---|---|
| `consulting/strategy-lead` | フレームワーク選定・経営層向けセキュリティ戦略立案 |
| `consulting/legal-compliance-checker` | ISMS/個人情報保護法/GDPR 整合性確認 |
| `consulting/ai-consultant` | AI導入時のガバナンス設計（NIST AI RMFとの接続） |
| `consulting/kpi-analytics` | セキュリティ投資対効果・残留リスクの定量化 |
| `marketing-research/marketing-director` | 1stParty データ運用の適法性・信頼構築 |

### 公式リソース
- IPA「中小企業の情報セキュリティ対策ガイドライン」
- NIST CSF 2.0: https://www.nist.gov/cyberframework
- 経産省「サイバーセキュリティ経営ガイドライン」: https://www.meti.go.jp/policy/netsecurity/mng_guide.html
- 経産省 CPSF: https://www.meti.go.jp/policy/netsecurity/wg1/cpsf.html

---

## 8.8 自律セキュリティテスト（Self-Pentesting）

> **目的**: 本番リリース前に「攻撃者視点」で自分のアプリを叩く。特に**決済・認証・個人情報**を扱う機能は必須。
> **出典**: workers.io/blog/autonomous-mobile-pentesting + Claude Code + Chrome DevTools MCP 連携パターン

### 🔺 倫理規定（絶対遵守）
- ✅ **自分が所有・運営するアプリ/サーバ/データに対してのみ実施**
- ✅ 検証環境・ステージング環境を優先。本番は関係者合意の下でのみ
- ❌ **他者のアプリ・他社サービス・第三者のデータを対象とする自律テストは禁止**（不正アクセス禁止法違反）
- ❌ 公開ゲーム/アプリの逆アセンブルや改変の方法を生成することは禁止
- ❌ 結果を第三者に無断で共有することは禁止

### テスト対象（優先順位）
| 優先度 | 対象 | 理由 |
|---|---|---|
| 🔴 Critical | 決済フロー（Stripe/Paddle webhook検証・金額改ざん） | 直接的な金銭被害 |
| 🔴 Critical | 認証バイパス（JWT改ざん・セッション固定化） | アカウント乗っ取り |
| 🟠 High | 入力バリデーション（SQLi・XSS・プロトタイプ汚染） | OWASP Top 10 |
| 🟠 High | 認可制御（IDOR・水平特権昇格） | データ漏洩 |
| 🟡 Medium | レートリミット・Botプロテクション | 悪用コスト |
| 🟡 Medium | セッション管理（有効期限・ログアウト処理） | 不正利用 |

### Claude Code 連携パターン
- **Chrome DevTools MCP**: Web アプリの動的検証。`browser-automation.md` と併用
- **curl/httpie + Claude Code**: API エンドポイントの境界テスト（認証/認可/入力）
- **OWASP ZAP / Burp Suite**: プロキシ経由でのリクエスト改変（手動連携）
- **/security-scan コマンド**: OWASP Top 10 + シークレット漏洩の静的検知

### 実施手順（ConsultingOS標準）
1. **範囲明確化**: 対象 URL/ホスト/アカウント/期間を書面化（自分宛でも書く）
2. **ステージング環境で試行**: 本番と同構成の検証環境で最初に実施
3. **脆弱性発見時**: 即座に `incident-response.md` の分類に従い対応
4. **修正→再テスト**: 修正後に同じテストを再実行し、緩和を確認
5. **記録**: ADR または `docs/security/pentest-NNNN.md` に結果を残す

### よるのことば/わんちゃん サブスク化での適用
- [ ] Stripe/Paddle webhook の署名検証が正しく実装されているか
- [ ] 未認証ユーザーが有料機能を呼び出せないか（認可制御）
- [ ] サブスクキャンセル後にアクセス権が即座に失効するか
- [ ] 無料 → 有料アップグレード時の金額計算が改ざん不能か
- [ ] 個人情報（占い履歴・ペット写真）が他ユーザーから見えないか

### 適用エージェント
| エージェント | 責務 |
|---|---|
| `service-dev/tech-lead` | テスト計画立案・リスク評価 |
| `service-dev/fullstack-dev` | テスト実行・脆弱性修正 |
| `service-dev/infra-devops` | ステージング環境構築・ネットワーク制御 |
| `service-dev/ai-engineer` | プロンプトインジェクション耐性検証 |

---

## 9. ConsultingOSエージェント別セキュリティ責務

| エージェント | セキュリティ責務 |
|---|---|
| tech-lead | 脅威モデリング・セキュリティ設計レビュー・依存関係監査 |
| fullstack-dev | OWASP Top 10準拠の実装・入力バリデーション・シークレット管理 |
| ai-engineer | プロンプトインジェクション対策・データ汚染防止・API認証設計 |
| infra-devops | TLS/ヘッダー設定・コンテナセキュリティ・監視・パッチ管理 |
| frontend-dev | XSS対策・CSP設定・SRI実装・認証フロー実装 |
| legal-compliance | GDPR/個人情報保護法準拠・データ漏洩時の法的対応 |
| brand-guardian | フィッシング/なりすまし対策・ブランド保護 |

---

## 禁止事項
- シークレットのリポジトリコミット（検知したら即ローテーション）
- 本番環境でのデバッグモード有効化
- rootユーザーでのコンテナ実行
- 入力バリデーションなしでのDB操作
- AI出力のセキュリティレビューなしでの本番適用
- ログへのPII/シークレット出力
- セキュリティインシデントの隠蔽（報告義務）


> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。

---

## 9.5 Claude Code 多層防御（Multi-Layer Defense）

> **Claude Code 環境では、モデルの「善意の判断ミス」が直接的なシステム操作につながる。** 単一層の制約では Opus 4.7+ 級モデルが「ユーザーの意図を汲んで」ルールを柔軟解釈するリスクがある。2層で防御する。

### 防御アーキテクチャ

```
Layer 1: CLAUDE.md（意図レベル）
├─ 自然言語で禁止事項を明示
├─ モデルの「判断」に依存する層
└─ リスク: モデルが例外を自己判断する可能性

Layer 2: settings.json（技術レベル）
├─ permissions.deny でコマンドパターンを技術的にブロック
├─ モデルの判断に関係なく実行を阻止
└─ リスク: deny リストに無いパターンはすり抜ける

両方を組み合わせ → モデルの判断ミスを技術的にキャッチ
```

### Layer 1: CLAUDE.md に記載すべきルール（意図レベル）

| カテゴリ | ルール例 |
|---|---|
| 機密ファイル | `.env`, `credentials`, `secrets` の読み取り・出力・コミット禁止 |
| 破壊的 Git 操作 | `push --force`, `reset --hard` 禁止 |
| 外部通信 | POST/PUT/DELETE はユーザー承認なしに実行しない |
| MCP 書き込み | Figma 編集、GitHub push_files 等はタスク単位で承認 |
| ファイル破壊 | `rm -rf`, `chmod 777` 禁止 |

### Layer 2: settings.json に設定すべき deny パターン（技術レベル）

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(rm -rf ./*)",
      "Bash(chmod 777 *)",
      "Bash(git push --force *)",
      "Bash(git push * --force*)",
      "Bash(git reset --hard *)",
      "Bash(sudo *)",
      "Bash(cat *.env*)",
      "Bash(cat *credentials*)",
      "Bash(cat *secret*)",
      "Bash(*> .env*)",
      "Read(.env*)",
      "Read(*credentials*)",
      "Read(*secret*)"
    ]
  }
}
```

### なぜ 2 層が必要か

| 防御 | 攻撃パターン | 結果 |
|---|---|---|
| Layer 1 のみ | モデルが「この .env は開発用だから読んで良い」と自己判断 | 機密漏洩 |
| Layer 2 のみ | 新ツール `Bash(base64 .env)` が deny に未登録 | すり抜け |
| **両方** | Layer 1 で意図を理解 + Layer 2 で技術ブロック | **安全** |

### 運用チェックリスト

- [ ] CLAUDE.md にルール追加 → settings.json の deny にも対応パターンを追加
- [ ] `/security-scan` 実行時に deny パターンの網羅性を確認
- [ ] 新 MCP 追加時にセキュリティ影響を評価
- [ ] deny リストのバイパスパターン（base64, xxd, od 等の間接読み取り）を定期チェック

### ConsultingOS 適用

- **全 34 エージェント**: Layer 1 ルールは CLAUDE.md の「セキュリティ多層防御」セクションに集約
- **settings.json**: プロジェクトルートの `.claude/settings.json` に deny パターンを定義（チームで共有）
- **settings.local.json**: 個人の追加制約は `.claude/settings.local.json` に定義（gitignore 対象）

---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-04-10 | 初版 | サイバーセキュリティの体系的スキル欠如 | ベースライン |
| 1.1.0 | 2026-04-12 | §8.7 ガバナンスフレームワーク（ISMS/NIST CSF/CPSF/経営ガイドライン/ISO 27005）追加 | IPA/NIST/METI/ISO 公式資料 + 企業経営サイバーセキュリティ診断チェック | エンジニアリング層とガバナンス層の分離・エンタープライズ案件の共通言語提供 |
| 1.2.0 | 2026-04-12 | §8.8 自律セキュリティテスト（Self-Pentesting）追加 | workers.io/blog/autonomous-mobile-pentesting + Chrome DevTools MCP 連携 | 本番前の動的検証を体系化・倫理規定で悪用防止・サブスク化前の必須チェック明確化 |
| 1.3.0 | 2026-04-18 | §9.5 Claude Code 多層防御（CLAUDE.md + settings.json 2層防御）追加 | Opus 4.7+ モデルの単一層バイパスリスク | 意図レベル + 技術レベルの defense-in-depth 確立 |
