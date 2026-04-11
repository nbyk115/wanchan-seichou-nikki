# API Design Patterns — API設計標準

## 原則
**「APIは契約。一度公開したら簡単には変えられない。」**
設計時に迷ったら「クライアント開発者が最も自然に使える形」を選ぶ。

---

## 1. REST API 設計規約

### URL設計
```
# リソースは複数形の名詞
GET    /api/v1/users          # 一覧取得
POST   /api/v1/users          # 作成
GET    /api/v1/users/{id}     # 詳細取得
PATCH  /api/v1/users/{id}     # 部分更新
DELETE /api/v1/users/{id}     # 削除

# ネストは1階層まで
GET    /api/v1/users/{id}/orders     # OK: ユーザーの注文一覧
GET    /api/v1/users/{id}/orders/{id}/items  # NG: 深すぎる
GET    /api/v1/orders/{id}/items     # OK: ordersを起点にする

# アクション（CRUD以外）はカスタムアクション
POST   /api/v1/orders/{id}/cancel    # 注文キャンセル
POST   /api/v1/users/{id}/activate   # アカウント有効化
```

### 命名規則
| 対象 | 規則 | 例 |
|---|---|---|
| URL パス | kebab-case | `/api/v1/user-profiles` |
| クエリパラメータ | snake_case | `?sort_by=created_at` |
| JSONフィールド | snake_case | `{ "user_name": "..." }` |
| ヘッダー | X-Custom-Header | `X-Request-Id` |

### HTTPメソッドの使い分け
| メソッド | 用途 | 冪等 | ボディ |
|---|---|---|---|
| GET | 取得 | Yes | なし |
| POST | 作成 / アクション実行 | No | あり |
| PUT | 全体置換 | Yes | あり |
| PATCH | 部分更新 | Yes | あり |
| DELETE | 削除 | Yes | なし |

---

## 2. レスポンス設計

### 成功レスポンス
```json
// 単一リソース
{
  "id": "usr_abc123",
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "created_at": "2026-01-15T09:30:00Z",
  "updated_at": "2026-03-20T14:22:00Z"
}

// 一覧（ページネーション付き）
{
  "data": [...],
  "pagination": {
    "total": 142,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  }
}
```

### エラーレスポンス（RFC 9457 Problem Details準拠）
```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "リクエストに不正なフィールドがあります",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "メールアドレスの形式が不正です",
      "code": "INVALID_FORMAT"
    }
  ]
}
```

### HTTPステータスコードの使い分け
| コード | 用途 | いつ使う |
|---|---|---|
| 200 | OK | GET/PATCH/DELETE成功 |
| 201 | Created | POST作成成功 |
| 204 | No Content | DELETE成功（ボディなし） |
| 400 | Bad Request | リクエスト形式が不正 |
| 401 | Unauthorized | 認証が必要/認証失敗 |
| 403 | Forbidden | 認証済みだが権限なし |
| 404 | Not Found | リソースが存在しない |
| 409 | Conflict | 競合（楽観ロック失敗等） |
| 422 | Unprocessable Entity | バリデーションエラー |
| 429 | Too Many Requests | レートリミット超過 |
| 500 | Internal Server Error | サーバー側の予期せぬエラー |

---

## 3. バージョニング

### 方針: URLパスバージョニング
```
/api/v1/users
/api/v2/users
```

### バージョンアップの判断基準
| 変更の種類 | バージョンアップ | 例 |
|---|---|---|
| フィールド追加 | 不要 | `phone` フィールド追加 |
| 新エンドポイント追加 | 不要 | `GET /api/v1/reports` 追加 |
| フィールド削除 | **必要** | `name` → 削除 |
| フィールド名変更 | **必要** | `user_name` → `name` |
| レスポンス構造変更 | **必要** | ネスト構造の変更 |
| 必須パラメータ追加 | **必要** | `tenant_id` が必須に |

### 非推奨化（Deprecation）フロー
```
1. 新バージョンのAPIをリリース
2. 旧バージョンにDeprecationヘッダーを追加
   Deprecation: true
   Sunset: Sat, 01 Jun 2026 00:00:00 GMT
   Link: <https://api.example.com/v2/docs>; rel="successor-version"
3. ドキュメント・変更通知を配信
4. 旧バージョンの利用状況を監視
5. 利用がゼロ or Sunset日到達で旧バージョンを削除
```

---

## 4. ページネーション

### オフセットベース（シンプルなUI向け）
```
GET /api/v1/users?page=2&per_page=20

Response:
{
  "data": [...],
  "pagination": {
    "total": 142,
    "page": 2,
    "per_page": 20,
    "total_pages": 8
  }
}
```

### カーソルベース（大量データ・リアルタイム向け）
```
GET /api/v1/events?cursor=eyJpZCI6MTAwfQ&limit=20

Response:
{
  "data": [...],
  "next_cursor": "eyJpZCI6MTIwfQ",
  "has_more": true
}
```

### 選定基準
| 条件 | 推奨 |
|---|---|
| 管理画面・ページ番号が必要 | オフセットベース |
| データ量が多い（10万件+） | カーソルベース |
| リアルタイムフィード | カーソルベース |
| データの追加・削除が頻繁 | カーソルベース |

---

## 5. 認証・認可

### 認証方式の選定
| 方式 | ユースケース | 特徴 |
|---|---|---|
| **Bearer Token (JWT)** | SPA/モバイルアプリ | ステートレス。有効期限短く設定 |
| **API Key** | サーバー間通信・外部連携 | シンプル。レートリミットと併用 |
| **OAuth 2.0** | サードパーティ連携 | 権限スコープの細分化が可能 |
| **Session Cookie** | SSR Webアプリ | CSRF対策必須 |

### JWT設計ガイド
```json
// ペイロードに含めるもの
{
  "sub": "usr_abc123",      // ユーザーID
  "role": "admin",          // ロール
  "tenant_id": "ten_xyz",   // テナントID（マルチテナント）
  "exp": 1711234567,        // 有効期限（短く: 15分〜1時間）
  "iat": 1711230967         // 発行時刻
}

// ペイロードに含めないもの
// - パスワード/シークレット
// - 個人情報（メール・電話番号）
// - 大量のパーミッション一覧（APIで別途取得）
```

### 認可パターン
```python
# RBAC（ロールベース）— シンプルなケース
@require_role("admin")
def delete_user(user_id): ...

# ABAC（属性ベース）— 複雑なケース
@require_permission("orders:read", resource_owner=True)
def get_order(order_id): ...

# マルチテナント — 必ずテナント境界をチェック
def get_users(tenant_id):
    # テナントIDがリクエスト元と一致するか必ず検証
    assert current_user.tenant_id == tenant_id
```

---

## 6. レートリミット

### レスポンスヘッダー
```
X-RateLimit-Limit: 1000        # 許容リクエスト数/時間窓
X-RateLimit-Remaining: 997     # 残りリクエスト数
X-RateLimit-Reset: 1711234567  # リセット時刻（Unix timestamp）
Retry-After: 60                # 429レスポンス時: 何秒後にリトライ可能
```

### レートリミット設計
| レイヤー | 対象 | 目安 |
|---|---|---|
| グローバル | 全体 | 10,000 req/min |
| テナント別 | テナントID | 1,000 req/min |
| ユーザー別 | ユーザーID / API Key | 100 req/min |
| エンドポイント別 | 重い処理（検索・生成） | 10 req/min |

---

## 7. 冪等性設計

### なぜ必要か
ネットワーク障害でクライアントがリトライした時、同じ操作が2回実行されるのを防ぐ。

### 実装パターン
```
# クライアントが一意のキーを送信
POST /api/v1/payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

# サーバー側
1. Idempotency-Key をDBに保存（TTL: 24時間）
2. 同じキーのリクエストが来たら保存済みのレスポンスを返す
3. 処理中のキーが来たら 409 Conflict を返す
```

### 冪等性が必要なエンドポイント
- 決済・課金処理（**必須**）
- リソース作成（推奨）
- 外部API呼び出しを伴う処理（推奨）

---

## 8. フィルタリング・ソート・検索

```
# フィルタリング
GET /api/v1/orders?status=active&created_after=2026-01-01

# ソート（-はDESC）
GET /api/v1/users?sort=created_at      # ASC
GET /api/v1/users?sort=-created_at     # DESC

# 検索（全文検索）
GET /api/v1/products?q=ワイヤレスイヤホン

# フィールド選択（レスポンスサイズ削減）
GET /api/v1/users?fields=id,name,email
```

---

## 9. GraphQL 採用判断

### REST で十分なケース（デフォルト）
- CRUD中心のAPI
- クライアントが1-2種類（Web + モバイル）
- リソース間の関連が単純
- チームがREST経験豊富

### GraphQL を検討すべきケース
- クライアントごとに必要なデータが大きく異なる
- N+1リクエスト問題が頻発（1画面で5-10 API叩く）
- リソース間の関連が複雑（グラフ構造）
- フロントエンドチームが独立して開発したい

### 両方使うパターン
```
内部API（BFF向け）: GraphQL — フロントの柔軟性重視
外部API（パートナー向け）: REST — シンプルさ・ドキュメント性重視
```

---

## 10. API設計チェックリスト

### 設計時
- [ ] URLがリソース（名詞）を表している
- [ ] HTTPメソッドが正しく使い分けられている
- [ ] レスポンス形式が統一されている
- [ ] エラーレスポンスが構造化されている
- [ ] ページネーションが実装されている（一覧API）
- [ ] バージョニング方針が決まっている

### セキュリティ
- [ ] 認証が必要なエンドポイントに認証チェックがある
- [ ] 認可（権限チェック）が実装されている
- [ ] レートリミットが設定されている
- [ ] 入力バリデーションが実装されている
- [ ] SQLインジェクション / XSS 対策済み
- [ ] CORS設定が適切

### 運用
- [ ] ヘルスチェックエンドポイントがある (`GET /health`)
- [ ] リクエスト/レスポンスのログが記録される
- [ ] レスポンスタイムの監視がある
- [ ] APIドキュメント（OpenAPI/Swagger）がある

---

## アンチパターン（これをやるな）

| ❌ やりがち | ✅ 正しい方法 |
|---|---|
| URLに動詞を使う `/api/getUsers` | リソース名詞 `/api/v1/users` + HTTPメソッドで表現 |
| 全APIで200を返す | 適切なステータスコード（201, 400, 404, 422等）を使い分け |
| エラーで内部情報を返す | RFC 9457形式で構造化。内部詳細はログのみ |
| バージョニングなしで破壊的変更 | URLバージョニング + Deprecationヘッダー + 移行期間 |
| 認証なしで公開API | 最低限API Key + レートリミット。決済系はBearer Token必須 |
| ページネーションなしで全件返却 | デフォルトで20件。cursor-basedを推奨 |

---

## 適用エージェント
- `service-dev/tech-lead` — API設計方針の策定・レビュー
- `service-dev/fullstack-dev` — API実装
- `service-dev/ai-engineer` — AI機能APIの設計（ストリーミング等）
- `creative/frontend-dev` — APIの呼び出し側の設計



> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。
---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-03-25 | 初版 | — | ベースライン |
