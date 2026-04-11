## セッションサマリー
- **エージェント**: tech-lead / fullstack-dev
- **日時**: 2026-03-25
- **タスク**: index.html の TDZ (Temporal Dead Zone) エラー調査
- **主な判断/アウトプット**: TDZエラーは発見されず。コードは安全。
- **学んだこと**: 以下に詳述
- **引き継ぎ注意事項**: 今後の開発で以下のTDZ防止ルールを遵守すること

---

## TDZ防止ルール（今後の開発で必ず遵守）

### 1. const/let 宣言の順序ルール
- `const`/`let` で宣言した変数は、**宣言より前の行で参照してはならない**（TDZ発生）
- `function` 宣言はホイスティングされるが、その関数内で参照する `const`/`let` 変数が呼び出し時に初期化済みか必ず確認
- **危険パターン**:
  ```js
  function useFoo() { return FOO; } // ← 呼び出しタイミング次第でTDZ
  useFoo(); // ← ここで呼ぶとTDZ！
  const FOO = "bar";
  ```
- **安全パターン**:
  ```js
  function useFoo() { return FOO; } // 宣言はOK（ホイスティング）
  const FOO = "bar";
  useFoo(); // ← 初期化後に呼ぶので安全
  ```

### 2. try-catch ブロックでのスコープ
- `try` ブロック内で `const`/`let` 宣言した変数を `catch` や `try` 外で参照しない
- 外で使う変数は `let` で `try` の前に宣言する
- **危険パターン**:
  ```js
  try { const data = fetch(); } catch(e) { }
  console.log(data); // ← ReferenceError
  ```
- **安全パターン**:
  ```js
  let data;
  try { data = fetch(); } catch(e) { data = fallback; }
  console.log(data); // ← OK
  ```

### 3. クラス宣言
- `class` はホイスティングされない（`const`/`let` と同じTDZルール）
- クラスを使う前に必ず宣言を完了させる

### 4. 巨大な単一行スクリプトのリスク
- index.html は300KB超の単一行にミニファイされている
- 初期化エラーが起きるとデバッグが極めて困難
- **対策**: 開発時はソースマップを維持し、本番ビルドでのみミニファイ

### 5. React useState 初期化での注意
- `useState(() => { ... })` 内で他の state setter を呼ぶのはアンチパターン
- 初期値のロード（localStorage等）はuseEffect内で行うのが安全

---

## 今回の調査で確認した安全ポイント

| 項目 | 結果 |
|---|---|
| const/let 宣言順序 | 全て安全（参照は宣言後） |
| function宣言内のconst参照 | 安全（呼び出しは全て初期化後） |
| try内のconst/let | 安全（ブロック外で参照なし） |
| 自己参照const | なし |
| class宣言 | ErrorBoundary - 安全（使用前に宣言済み） |
| デストラクチャリング | 全てuseState - 安全 |

## 潜在的リスク（TDZ以外）
- CHARA_IMAGES の巨大base64データ初期化が失敗すると後続のconst宣言全てが未実行になる
- 300KB超の単一行スクリプトはブラウザ固有の問題を引き起こす可能性あり
