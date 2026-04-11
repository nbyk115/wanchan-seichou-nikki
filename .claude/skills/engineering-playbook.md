# Engineering Playbook — 開発プロセス・技術標準

## 概要
Service Dev部門の全エージェントが参照する開発プロセス・技術標準・Claude Code活用原則。

---

## 1. 技術スタック標準

### フロントエンド
| 用途 | 推奨技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js (App Router) | Pages Router は新規では使わない |
| 言語 | TypeScript (strict) | any 禁止 |
| スタイル | Tailwind CSS | CSS Modules も許容 |
| UIライブラリ | shadcn/ui + Radix UI | カスタムコンポーネント最小化 |
| 状態管理 | Zustand / React Query | Redux は新規では使わない |
| フォーム | React Hook Form + Zod | バリデーションは Zod で統一 |
| テスト | Vitest + Testing Library | Jest も許容 |

### バックエンド
| 用途 | 推奨技術 | 備考 |
|---|---|---|
| API | Next.js API Routes / FastAPI | 用途に応じて選択 |
| 言語 | TypeScript / Python | 型安全必須 |
| ORM | Prisma / SQLAlchemy | 生SQL最小化 |
| 認証 | NextAuth.js / Supabase Auth | 自前実装禁止 |
| バリデーション | Zod / Pydantic | 入力は必ずバリデーション |

### インフラ
| 用途 | 推奨技術 |
|---|---|
| ホスティング | Vercel / AWS |
| DB | PostgreSQL (Supabase / RDS) |
| キャッシュ | Redis / Upstash |
| ファイル | S3 / Cloudflare R2 |
| CI/CD | GitHub Actions |
| 監視 | Datadog / Vercel Analytics |

---

## 2. 開発プロセス

### ブランチ戦略
```
main (本番)
  └── develop (開発統合)
       ├── feature/xxx (機能開発)
       ├── fix/xxx (バグ修正)
       └── refactor/xxx (リファクタリング)
```

### コミットメッセージ規約
```
<type>(<scope>): <description>

type: feat | fix | refactor | docs | test | chore | perf
scope: 変更対象のモジュール名
description: 変更内容（日本語OK）
```

### コードレビュー基準
1. **正確性**: ロジックは正しいか
2. **セキュリティ**: OWASP Top 10 に該当しないか
3. **パフォーマンス**: N+1, メモリリーク, 不要な再レンダリング
4. **可読性**: 他の開発者が理解できるか
5. **テスト**: テストが書かれているか

---

## 3. 設計原則

### アーキテクチャ
- **モノリスファースト**: 早すぎるマイクロサービス化を避ける
- **APIファースト**: フロント/バックの契約をOpenAPIで先に定義
- **データモデルファースト**: スキーマ設計を最初に固める
- **12-Factor App**: 環境変数, ステートレス, ログストリーム

### コーディング
- **YAGNI**: 必要になるまで作らない
- **DRY**: ただし早すぎる抽象化は避ける（3回繰り返すまで待つ）
- **KISS**: 最もシンプルな解決策を選ぶ
- **型安全**: TypeScript strict / Pydantic で型を保証
- **エラーハンドリング**: システム境界（API, DB, 外部サービス）で実装

### セキュリティ
- [ ] 入力バリデーション（Zod / Pydantic）
- [ ] SQLインジェクション対策（ORM使用）
- [ ] XSS対策（React のエスケープ + CSP）
- [ ] CSRF対策（トークン）
- [ ] 認証・認可の分離
- [ ] シークレットの環境変数管理
- [ ] HTTPS強制
- [ ] レート制限

---

## 4. Claude Code 活用原則

### Claude Code はService Dev部門の実行エンジン
エージェントファイルは「技術判断ナレッジ」として起動時に自動参照される。

### 活用パターン
| パターン | 説明 |
|---|---|
| **実装** | コード生成・機能開発・バグ修正 |
| **レビュー** | コードレビュー・設計レビュー |
| **リファクタリング** | コード品質改善・パフォーマンス最適化 |
| **テスト** | テストコード生成・テスト実行 |
| **デバッグ** | エラー分析・原因特定・修正 |
| **ドキュメント** | API仕様書・READMEの生成（明示的に依頼時のみ） |

### Claude Code との協働ルール
1. **コンテキストを与える**: 関連ファイル・要件・制約を明示する
2. **段階的に進める**: 大きなタスクは分割して依頼
3. **テストで検証**: 生成されたコードは必ずテストで確認
4. **レビューする**: 自動生成コードも必ず人間がレビュー

### Claude Code 定期タスク（Scheduled Tasks）

ローカル不要でクラウド上で自動実行できる定期タスク機能を活用する。

#### セッション内スケジューリング（/loop）
```text
/loop 5m デプロイ状況を確認して結果を教えて
/loop 20m /review-pr 1234
/loop 1h テストスイートを実行して失敗があれば報告
```
- セッション中のみ有効（終了で消える）
- 最大50タスク/セッション、3日で自動期限切れ
- 間隔: `s`秒 `m`分 `h`時 `d`日

#### ConsultingOS × 定期タスクの活用パターン

| パターン | /loop設定例 | 起動エージェント |
|---|---|---|
| **競合モニタリング** | `/loop 1d 競合3社の価格・機能変更をチェック` | competitive-analyst |
| **KPIアラート** | `/loop 1h 主要KPIの閾値超えを監視` | kpi-analytics |
| **デプロイ監視** | `/loop 5m ステージング環境のヘルスチェック` | infra-devops |
| **PR自動レビュー** | `/loop 30m 未レビューPRを確認してレビュー` | tech-lead |
| **コンテンツ監査** | `/loop 1d 公開コンテンツのブランドガイドライン準拠チェック` | brand-guardian |
| **法務チェック** | `/loop 1d 新規LPの景表法・特商法チェック` | legal-compliance-checker |
| **グロース実験** | `/loop 1h A/Bテスト結果の統計的有意差を確認` | growth-hacker |
| **フィードバック収集** | `/loop 1d 新着レビュー・問い合わせの分類・要約` | feedback-synthesizer |

#### GitHub Actions 連携（完全自動化）
```yaml
# .github/workflows/scheduled-review.yml
on:
  schedule:
    - cron: '0 9 * * 1-5'  # 平日9時
jobs:
  daily-review:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: "過去24時間のコミットをレビューして、バグ・セキュリティ・パフォーマンスの問題を報告"
```
- クラウド実行（ローカル起動不要）
- リポジトリ + スケジュール + プロンプトを設定するだけ
- バッチ処理・監視・定期更新に最適

---

## 5. テスト戦略

### テストピラミッド
```
        /  E2E  \        ← 少数（重要フローのみ）
       /  統合   \       ← 中程度（API, DB連携）
      / ユニット  \      ← 多数（ビジネスロジック）
```

### テストカバレッジ目標
| 種別 | カバレッジ | 対象 |
|---|---|---|
| ユニットテスト | 80%+ | ビジネスロジック, ユーティリティ |
| 統合テスト | 主要パス | API エンドポイント, DB操作 |
| E2Eテスト | クリティカルパス | ログイン, 決済, コアフロー |

---

## 6. デプロイ・運用

### デプロイプロセス
```
feature branch → PR → レビュー → develop → staging検証 → main → 本番
```

### 運用チェックリスト
- [ ] ヘルスチェックエンドポイント
- [ ] エラーモニタリング（Sentry等）
- [ ] パフォーマンスモニタリング
- [ ] ログ収集・集約
- [ ] バックアップ（DB）
- [ ] ロールバック手順の準備
- [ ] インシデント対応フロー

---

## スキル横断リファレンス

本スキルと他スキルの使い分け:
| 状況 | 参照スキル |
|---|---|
| API設計の詳細（命名・認証・冪等性） | → `api-design-patterns.md` |
| PR前の品質チェック | → `code-quality-gates.md` |
| バグの根本原因特定 | → `debug-methodology.md` |
| DBスキーマ変更 | → `migration-safety.md` |
| 本番障害が発生 | → `incident-response.md` |
| プロンプト/RAG設計 | → `prompt-engineering.md` |

---

## 適用エージェント
- `service-dev/tech-lead` — 設計判断・技術選定
- `service-dev/fullstack-dev` — 実装・テスト
- `service-dev/ai-engineer` — AI機能の技術標準
- `service-dev/infra-devops` — インフラ・CI/CD
- `creative/frontend-dev` — フロントエンド実装標準



> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。
---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-03-25 | 初版 | — | ベースライン |
