# Debug Methodology — 反証ベース根本原因特定

## 概要
「推測で直すな。証拠で語れ」を原則とする、構造的デバッグ手法。
Agent Team の反証パターンと組み合わせて使う。

---

## 1. OODA デバッグループ

```
Observe（観察）→ Orient（仮説立案）→ Decide（反証設計）→ Act（検証実行）
     ↑                                                        │
     └────────────── 仮説が棄却されたらループ ──────────────────┘
```

### Step 1: Observe — 症状の正確な記録
```
【症状記録テンプレート】
- 何が起きたか: （期待値 vs 実際の値）
- いつから: （最終正常動作の時点）
- 再現条件: （100%再現 / 確率的 / 特定環境のみ）
- 影響範囲: （全ユーザー / 特定条件 / 特定環境）
- エラーログ: （スタックトレース・HTTPステータス・コンソール出力）
```

### Step 2: Orient — 仮説の列挙と優先順位
```
【仮説列挙ルール】
1. 最低3つの仮説を立てる（1つだけだと確証バイアスに陥る）
2. 各仮説に「これが原因なら観測されるはずの現象」を書く
3. 各仮説に「これが原因なら観測されないはずの現象」を書く
4. 実際の観測事実と照合して優先順位をつける
```

| 仮説 | 予測される現象 | 予測されない現象 | 観測事実との整合 |
|---|---|---|---|
| 仮説A: ... | ... | ... | ○/× |
| 仮説B: ... | ... | ... | ○/× |
| 仮説C: ... | ... | ... | ○/× |

### Step 3: Decide — 反証テストの設計
```
【反証テスト設計ルール】
- 仮説を「証明」するのではなく「棄却」するテストを設計する
- 「Xが原因なら、Yを変えても症状は変わらないはず」→ Yを変えて確認
- 「Xが原因なら、Zの条件では必ず再現するはず」→ Zで試す
- 1つのテストで1つの仮説だけを検証する（変数を1つだけ変える）
```

### Step 4: Act — 最小限の修正
```
【修正ルール】
- 反証テストで生き残った仮説のみに基づいて修正する
- 修正は1箇所ずつ（複数同時変更は因果関係が不明になる）
- 修正後に元の再現条件で症状が消えることを確認
- 修正がリグレッションを起こさないことをテストで確認
```

---

## 2. レイヤー別調査チェックリスト

### フロントエンド
- [ ] コンソールエラー・警告の確認
- [ ] Network タブでリクエスト/レスポンスの確認
- [ ] React DevTools でステート・プロップスの確認
- [ ] イベントリスナーの競合・バブリング
- [ ] CSS の z-index・overflow・pointer-events
- [ ] ブラウザキャッシュ・Service Worker の影響

### バックエンド
- [ ] リクエストログ（入力値の確認）
- [ ] レスポンスコード・ボディの確認
- [ ] DB クエリログ（実行されたSQL・実行時間）
- [ ] 外部API呼び出しのレスポンス確認
- [ ] メモリ・CPU使用量の確認
- [ ] 環境変数・設定値の確認

### インフラ
- [ ] DNS解決の確認
- [ ] TLS証明書の有効性
- [ ] ネットワーク到達性（ping, traceroute）
- [ ] コンテナ・プロセスの状態
- [ ] ディスク容量・inode
- [ ] ログローテーション・ファイルディスクリプタ

### データベース
- [ ] スロークエリログの確認
- [ ] インデックスの使用状況（EXPLAIN）
- [ ] ロック競合・デッドロック
- [ ] コネクション数の確認
- [ ] レプリケーション遅延
- [ ] マイグレーション状態の整合性

---

## 3. Agent Team 連携プロンプト

### 標準デバッグチーム（4名）
```
[症状を記述]。Agent Teamを作成:

- 調査A（フロント）: UI・ステート・レンダリング・ネットワーク
- 調査B（バックエンド）: API・ロジック・DB・外部連携
- 調査C（インフラ）: 環境・設定・ネットワーク・リソース
- 反証担当: 他の3名が出した仮説に対して以下を実行:
  1. 「それが原因ならなぜXXは起きないのか？」
  2. 「その修正だけで本当に直るか？他環境でも？」
  3. 反例を1つも出せなかった仮説だけを採用

【共通ルール】
- 仮説は必ず3つ以上立てる
- 推測で修正するな。ログ・データ・再現テストで証拠を示せ
- 修正は1箇所ずつ。複数同時変更禁止
```

### 高速デバッグ（2名）
```
[症状を記述]。Agent Teamを作成:

- 調査: 上記チェックリストに沿って全レイヤーを調査。仮説を3つ立てろ
- 反証: 調査が出した仮説を片っ端から壊せ。壊せなかったものだけ報告

推測禁止。証拠のみで語れ。
```

---

## 4. アンチパターン（やってはいけないこと）

| アンチパターン | なぜダメか | 代わりにやること |
|---|---|---|
| printfデバッグだけで調査 | 仮説なしの総当たりは時間を浪費 | 先に仮説を立て、必要な箇所だけログを入れる |
| 「前に似た問題があったからこれだろう」 | 確証バイアス。前回と今回は違う問題かもしれない | 類似性は仮説の1つとし、他の仮説も立てる |
| 複数箇所を同時に修正 | どの修正が効いたか分からなくなる | 1箇所ずつ修正し、都度確認 |
| 「とりあえず再起動」 | 根本原因が不明のまま再発する | 再起動前にログ・状態を保全する |
| エラーメッセージを読まない | 答えが書いてあることが多い | まずエラーメッセージを正確に読む |
| 「環境の問題」で片付ける | 環境が原因ならその環境差分を特定すべき | 何の設定・バージョンが違うのか具体的に |
| **実データなしで推測 patch を連発** | 4-7連続で commit しても直らず時間を溶かす | **Step 1（再現）を必ず通す・実機 devtools/Console/スクショを要求してから着手** |

---

## 5. 実戦ケーススタディ — よるのことば Shake/Scroll 回帰（2026-04-12 複数ラウンド）

### ラウンド 3 の追加学び (2026-04-12 後半)

**CSS attribute selector の wildcard trap**:
- 当初 `img[style*="pulse"], img[style*="float"]` で shake を潰した
- ユーザーが「ロゴが高速で震えてる」と再報告 → 原因:
  - ロゴ上の moon SVG は `<div style="animation:float 4s">` (div, not img)
  - img 限定セレクタは div をマッチせず、shake が残り続けた
- **教訓**: shake 対策は要素タグに依存しない selector (`[style*="infinite"]`) で広く捕捉すべき
- **反省**: 一度 fix した後「画面上の別要素」で再発した時、同じクラスの原因を疑う reasoning が弱かった (抽象化された原因を具体要素ごとに適用しきれていない)

**許可リスト (allow list) パターン**:
- `[style*="infinite"] { animation: none !important }` で全滅 → 必要なもの (spinner, twinkle) だけ後続ルールで復活させる
- `.spin-loader, [style*="spin 0.8s"] { animation: spin 2s linear infinite !important }` のように具体的な allow 条件を書く
- 汎用 deny → 具体 allow の順序で CSS 書く原則

### 発生した問題
1. ヘッダー「🌙 よるのことば」ロゴとホロスコープ結果のキャラ画像が高速シェイク
2. Surgical fix 連発 → スクロール不能が何度も再発
3. 7 連続 commit でも shake が完全に止まらず、最終的に nuclear CSS override + revert を経て収束

### 根本原因（後から判明）
1. **CSS animation + React inline style の相性問題**
   - `<img style={{animation:"float 3s"}} />` のように inline で書くと、親コンポーネントが state 変更で re-render するたびに style 属性が再適用される
   - ブラウザは `animation` プロパティの再代入を「新規アニメーション開始」と解釈し、開始フレーム（例: `rarityReveal 0%{scale(0.3) rotate(-10deg)}`）に巻き戻す
   - re-render 頻度が animation duration より短いと、常に開始フレーム付近で固定 → 高速シェイクに見える

2. **transform:translateZ(0) の副作用**
   - GPU layer 昇格のために `header, main, nav` に `transform:translateZ(0)` を適用
   - transform を持つ要素は新規 containing block を作る
   - 内部の `position:fixed` や body scroll と相互作用し、iOS Safari で momentum scroll が破綻
   - **結果: shake は止まるがスクロールが壊れる**

### 得られた教訓

| 教訓 | ルール化 |
|---|---|
| CSS animation は className で掛けて inline style を避ける | React/SPA で infinite animation を掛ける際は必ず className 経由。inline `style={{animation:...}}` は禁止 |
| 親が頻繁に re-render する環境では inline style 自体を避ける | 再描画コスト + animation 再起動の二重問題 |
| `transform:translateZ(0)` をタグセレクタ（`header,main,nav`）に広く掛けない | scrollable ancestor or position:fixed descendant を壊す。必要なら `.gpu-layer` のような特定クラスに限定 |
| nuclear CSS override (`* { transition:none }` 等) は html/body/#root を **必ず除外** | scroll 関連プロパティに触れないようにする |
| defense-in-depth (keyframes no-op 化) は surgical fix の代替にならない | 真の root cause を devtools で確認してから直すのが本線 |
| 実機データなしの blind patch は禁止 | 環境制約で devtools 取れない場合は user に Console コマンド実行を依頼 |

### 推奨ワークフロー（同種バグ再発時）

1. **データ収集** (Step 1)
   - ブラウザ devtools → Console で以下を実行してもらう:
     ```js
     Array.from(document.querySelectorAll('*')).filter(el=>{const a=getComputedStyle(el).animationName;return a&&a!=='none'}).map(el=>({tag:el.tagName,cls:(el.className||'').toString().slice(0,40),anim:getComputedStyle(el).animationName,dur:getComputedStyle(el).animationDuration}))
     ```
   - スクリーンショット（動画なお可）
   - Performance タブで Paint/Layout が繰り返し発火していないか

2. **仮説列挙** (Step 2)
   - CSS animation の inline style 再適用
   - Transform で containing block 生成
   - Re-render loop (setState in render body, useEffect 無限ループ)
   - Scroll-linked transform / rAF loop
   - Font loading shift

3. **局所化** (Step 3)
   - 該当要素をピンポイントで特定してから変更
   - tag セレクタ (`*`, `header`, `nav`) への CSS 広範囲適用は最終手段

4. **修正** (Step 4)
   - className ベースで animation を掛け直す
   - `transform:translateZ(0)` は特定クラスに限定
   - scroll を壊さないため html/body/#root を除外

5. **防止** (Step 5)
   - 本ケーススタディに追記（今ここ）
   - code-quality-gates.md Gate 0 に「inline animation 禁止」を追加
   - コードレビューで `style={{animation:...}}` パターンを grep で検出

---

### ラウンド 4 の追加学び (2026-04-17) — Modal overflow lock の脆性

**症状**: UI 編集（header padding / SVG 削除 / textarea 拡大）後に「スクロールができない」が再発。

**原因候補（再現できず確証なし。ただし構造的に脆弱）**:
- `document.body.style.overflow="hidden"` が FTUE / Paywall / CancelConfirm の useEffect で掛かる
- 依存配列が `[showFtue,showPaywall,showCancelConfirm]` のため、依存外の更新（例: StrictMode 二重実行、HMR、error boundary による unmount / remount）で cleanup が走らず body に `overflow:hidden` が残留する可能性
- さらに、**初訪時の FTUE = true が React render エラーで invisible だと、overlay 見えないのに scroll だけロックされる** という最悪パターンが起きうる

**対処**: mount 時と 300ms 後に `document.body.style.overflow=""` を強制リセットする insurance effect を追加。副作用ゼロ、下流 modal の正常動作を妨げない。

```js
React.useEffect(function(){
  document.body.style.overflow="";
  var t=setTimeout(function(){document.body.style.overflow=""},300);
  return function(){clearTimeout(t)}
},[]);
```

**教訓**（汎用化）:

| 教訓 | ルール化 |
|---|---|
| グローバルな DOM mutation (body / documentElement の style 変更) は state 依存で掛けるな | state と無関係な leak が起きうる。掛けるなら `ref` + 明示的 enter/exit API に寄せる |
| モーダル閉じ切った状態の保証は `else { overflow="" }` だけでは弱い | mount 時 insurance reset を必ず併記。依存外 remount 経路を想定 |
| UI 編集後の scroll 破綻は「content 量不足で scroll 不要」の可能性も疑う | 画面高より content が短ければ scroll は発生しない。「壊れた」に見えるだけ |
| scroll 回帰は UI コミット毎に手動検証すべき | vercel preview で実機スクロールを 1 回必ず触る。CI にはキャッチ不能 |

**未解決**: 実機 devtools 出力なしなので「真因」は確定できていない。insurance は保険。ユーザー報告再発時は必ず以下を依頼:
```js
getComputedStyle(document.body).overflow
```
→ 値が "hidden" なら本ラウンドの原因、"visible"/"" なら別の scroll-ancestor を辿る。

---

## アンチパターン（これをやるな）

| ❌ やりがち | ✅ 正しい方法 |
|---|---|
| 「たぶんここが原因」で修正開始 | 仮説を3つ立て、反証ベースで棄却してから修正 |
| 直前の変更だけを疑う | レイヤー別チェックリストで網羅的に確認 |
| 「動いたからOK」で終わり | 根本原因を特定し、再発防止策を実装 |
| ログを足して再現待ち | 既存ログから仮説を立て、能動的に検証 |
| 一人で4時間以上デバッグ | 30分で進展なければエスカレーション/ペアデバッグ |

---

## 適用エージェント
- `service-dev/tech-lead` — デバッグ方針の判断
- `service-dev/fullstack-dev` — 実装レベルの調査・修正
- `service-dev/ai-engineer` — AI機能固有の問題調査
- `service-dev/infra-devops` — インフラレイヤーの調査



> 反証モード（トリプルチェック）の共通ルールは CLAUDE.md を参照。
---

## バージョン履歴

| Ver | 日付 | 変更内容 | 根拠 | 効果 |
|---|---|---|---|---|
| 1.0.0 | 2026-03-25 | 初版 | — | ベースライン |
| 1.1.0 | 2026-04-12 | §5 実戦ケーススタディ (よるのことば shake/scroll) 追加 + アンチパターンに「実データなしの推測 patch 連発」を追記 | 本セッション 7 連続 commit の失敗経験 | React inline animation + transform の落とし穴を永続記録し同種バグを再発防止 |
### ラウンド 5 の学び (2026-04-18) — deny-all CSS パターンの構造的失敗

**症状**: SHAKE v4 `[style*="infinite"]{animation:none !important}` + allow list パターンが 5 セッションにわたり対症療法の連鎖を生んだ。spinner 止まる → allow list 追加 → float 止まる → allow list 追加 → 速度変更で allow list 不一致 → 止まる → の無限ループ。

**根本原因**: deny-all + allow-list は CSS の正しいパターンだが、**inline style の animation 値が JS 側で変更される環境では allow list が追従できない**。0.8s→2.5s に変えた瞬間に allow list が壊れるのは構造的必然。

**教訓**:

| 教訓 | ルール化 |
|---|---|
| CSS deny-all は inline style 環境で使うな | JS 側の値変更が allow list を壊す。個別 disable のみ |
| 対症療法を 2 回繰り返したら構造を疑え | 同じカテゴリの修正が 2 回続いたら設計判断ミス |
| 反証モードを CSS 変更にも適用せよ | 「この CSS 変更で他のどの要素が影響を受けるか」を変更前に列挙 |

---

| 1.2.0 | 2026-04-17 | §5 ラウンド 4 追加: modal body overflow lock の state 依存脆性 + mount 時 insurance reset パターン | よるのことば UI 編集後の scroll 再発（再現不能だが構造的に脆弱） | 依存配列外 remount で scroll 死蔵するケースを永続記録 |
