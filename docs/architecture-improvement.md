# わんちゃん成長日記 アーキテクチャ改善設計書

```
【技術方針】単一HTML 2,714行のモノリスを段階的に分解し、保守性・安全性・パフォーマンスを改善する
【選定理由】現行コードは動作しているが、メモリリーク・セキュリティ・アクセシビリティの技術的負債が蓄積しており、
　　　　　　放置するとユーザー離脱（特にモバイル長時間利用時のクラッシュ）とSEO/PWAスコア低下を招く
【コスト試算】即時改善: 0円（コード修正のみ）、中期: 0円（ビルドツール無料）、長期: Vite導入+テスト基盤で初期2-3人日
【リスク】即時改善は既存動作への影響が最小限。中期以降はリグレッションテストが必要
```

---

## 1. 即時改善（コード修正で対応可能）

### 1-1. setInterval クリーンアップ漏れの修正

**問題箇所**: 5箇所の `setInterval` のうち、`window.__wanchan._notifInterval`（行2040）がページ遷移時にクリアされない。モバイルで長時間利用すると120秒ごとにFirebase通知チェックが累積し、メモリリーク+不要な通信が発生する。

**工数**: 0.5h | **リスク**: 低 | **PLインパクト**: モバイルユーザーの離脱率改善（推定-5%バウンス）

**修正案** (行2039-2044付近):

```javascript
// 修正前:
window.__wanchan._notifInterval = setInterval(_checkNewNotifications, 120000);

// 修正後:
// 既存のintervalがあればクリア（重複防止）
if (window.__wanchan._notifInterval) {
  clearInterval(window.__wanchan._notifInterval);
}
window.__wanchan._notifInterval = setInterval(_checkNewNotifications, 120000);

// ページ離脱時にクリーンアップ
window.addEventListener('pagehide', function() {
  if (window.__wanchan._notifInterval) {
    clearInterval(window.__wanchan._notifInterval);
    window.__wanchan._notifInterval = null;
  }
});
```

他の4箇所の `setInterval`（行724, 1200, 2033, 2524）は最大試行回数で自律的に `clearInterval` しており、リーク度合いは低い。ただし行2524の `_aiReadyCheck` は行2600の `setTimeout` でフォールバッククリアしているが、これをより明示的にすべき。

---

### 1-2. ダークモード判定関数の共通化

**問題箇所**: `_isDark()` が行438に定義済みだが、行1548, 1832, 1899, 2152, 2332, 2538の6箇所で同一ロジックがインラインで重複している。

**工数**: 0.5h | **リスク**: 極低 | **PLインパクト**: 直接効果なし。保守コスト削減（バグ修正時に1箇所で済む）

**修正案**: 6箇所すべてを `_isDark()` 呼び出しに置換する。

```javascript
// 修正前 (行1548-1549等、全6箇所):
var isDark = document.body.classList.contains('ux-dark-on') ||
  (document.body.classList.contains('ux-dark-auto') && window.matchMedia('(prefers-color-scheme: dark)').matches);

// 修正後:
var isDark = _isDark();
```

対象行: 1548, 1831-1832, 2151-2152, 2332, 2537-2538。行1896は既に `_isDark()` を使用しており模範的。

---

### 1-3. 写真アップロード（データインポート）のバリデーション追加

**問題箇所**: 行977-1008の `importData()` 関数。JSONファイルの読み込みにサイズ制限がなく、MIMEタイプ検証もない。悪意あるファイルや巨大ファイルでブラウザがフリーズする可能性がある。

**工数**: 1h | **リスク**: 低 | **PLインパクト**: セキュリティインシデント防止（データ破損によるユーザー離脱回避）

**修正案** (行981-982の間に挿入):

```javascript
input.addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file) return;

  // --- バリデーション追加 ---
  // ファイルサイズ制限: 10MB
  var MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    showToast('ファイルが大きすぎます（10MB以下にしてね）', 'error');
    return;
  }
  // MIMEタイプ検証
  if (file.type && file.type !== 'application/json' && !file.name.endsWith('.json')) {
    showToast('JSONファイルを選んでね', 'error');
    return;
  }
  // --- バリデーション追加ここまで ---

  var reader = new FileReader();
  // ... 既存処理
});
```

補足: React側のバンドル内（行341-356付近のミニファイ済みコード）にも写真アップロード処理がある可能性があるが、ミニファイ済みのため修正にはビルドシステム導入（長期改善）が必要。

---

### 1-4. アクセシビリティ最低限対応

**問題箇所**: 行1905の通知パネルで `div#notif-close` に `onClick` 相当を設定しているが `role="button"` と `tabindex="0"` が未付与。キーボード操作不可。

**工数**: 1h | **リスク**: 極低 | **PLインパクト**: PWA Lighthouseスコア改善（現状推定60台 -> 80台目標）、App Store審査通過率向上

**修正案** (行1905):

```javascript
// 修正前:
'<div id="notif-close" style="width:44px;height:44px;...'

// 修正後:
'<button id="notif-close" aria-label="閉じる" style="width:44px;height:44px;border:none;background:' + (isDark ? '#333' : '#f0f0f0') + ';border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">✕</button>'
```

同様のパターンが複数箇所に存在する。`enhanceAccessibility()` 関数（行764付近で呼び出し）がMutationObserverで自動補正しているが、発生源で正しいHTML要素を使うべき。`<div onClick>` は全て `<button>` に置換が原則。

---

### 1-5. setTimeout マジックナンバーの定数化

**工数**: 0.5h | **リスク**: 極低 | **PLインパクト**: なし（保守性改善）

```javascript
// ファイル冒頭（行363付近の即時実行関数内）に定数を追加:
var TIMING = {
  TOAST_SHOW: 2500,
  TOAST_REMOVE: 2800,
  HAPTIC_FEEDBACK: 150,
  DEBOUNCE: 150,
  PAGE_INIT: 500,
  RELOAD_DELAY: 1500,
  LAZY_FALLBACK: 3000
};
```

---

## 2. 中期改善（リファクタリング）

### 2-1. UXレイヤースクリプトのモジュール分割

**現状**: 行363-2714（約2,350行）がすべて単一の即時実行関数内。

**設計案**:

```
/src/ux/
  index.js          -- エントリポイント（MutationObserver、初期化）
  dark-mode.js      -- _isDark(), applyDarkMode(), toggleDarkMode()
  toast.js          -- showToast()
  backup.js         -- exportData(), importData(), FAB
  accessibility.js  -- enhanceAccessibility()
  notifications.js  -- 通知パネル、足あと機能
  share.js          -- シェアシート
  growth-card.js    -- 成長まとめカード
  dog-switcher.js   -- 犬切替UI
  onboarding.js     -- 初回チュートリアル
  symptoms.js       -- 症状チップUI
  constants.js      -- TIMING定数、犬種リスト
```

**工数**: 3人日 | **リスク**: 中（動作確認範囲が広い） | **PLインパクト**: 開発速度2-3倍改善（機能追加時の影響範囲が局所化）

---

### 2-2. useState群の構造化

**現状**: React側が完全にミニファイされており（行334-356、推定1,500行+のバンドル）、ソースコードが存在しない。

**撤退基準**: ミニファイ済みバンドルのリバースエンジニアリングはROIが合わない。

**推奨戦略**:
1. 現在のReactバンドルはそのまま維持
2. UXレイヤー（行363-2714）を先にモジュール化
3. Reactアプリのソースコードが復元できた場合のみ、以下の設計を適用:

```
// 状態設計案（React側ソースが利用可能になった場合）
const AppContext = createContext();

const initialState = {
  dogs: [],           // 犬プロフィール群
  activeDogId: null,  // 選択中の犬
  diary: [],          // 日記エントリ
  ui: {
    darkMode: 'auto', // 'auto' | 'on' | 'off'
    currentPage: 'home',
    loading: false,
  },
  health: {
    weights: [],
    symptoms: [],
  },
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE_DOG': ...
    case 'ADD_DIARY_ENTRY': ...
    case 'UPDATE_WEIGHT': ...
    case 'TOGGLE_DARK_MODE': ...
    default: return state;
  }
}
```

**工数**: Reactソース復元なしでは不可。ソースありで5人日 | **リスク**: 高（全画面に影響） | **PLインパクト**: バグ発生率-50%（状態不整合の根本解消）

---

### 2-3. 犬種データの外部化

**現状**: 行1542に19品種がハードコード。React側にも別の犬種リスト（`xf`、推定10KB+）がミニファイ内に存在。

```javascript
// /public/data/breeds.json として外部化
// 遅延読み込み:
async function loadBreeds() {
  if (window.__wanchan._breeds) return window.__wanchan._breeds;
  const res = await fetch('./data/breeds.json');
  window.__wanchan._breeds = await res.json();
  return window.__wanchan._breeds;
}
```

**工数**: 1人日 | **リスク**: 低 | **PLインパクト**: 初期ロード-10KB（LCP改善、モバイル3G環境で体感0.3s短縮）

---

## 3. 長期改善（アーキテクチャ刷新）

### 3-1. ビルドシステム導入

**推奨**: Vite（理由: React 19.2.4対応済み、ゼロコンフィグに近い、開発サーバーのHMRが高速）

```
wanchan-seichou-nikki/
  index.html          -- Viteエントリ（軽量、<script type="module" src="/src/main.jsx">のみ）
  vite.config.js
  package.json
  public/
    manifest.json
    sw.js
    icons/
    data/breeds.json
  src/
    main.jsx           -- Reactアプリエントリ
    App.jsx
    context/AppContext.jsx
    pages/              -- 10画面を個別コンポーネント化
    components/         -- 共通UI（Toast, Modal, DogSwitcher等）
    hooks/              -- useDarkMode, useLocalStorage, useDog等
    ux/                 -- UXレイヤー（2-1の分割結果）
    utils/              -- 定数、ヘルパー
    styles/             -- CSS Modules or Tailwind
```

**工数**: 初期構築2人日 + 移行5人日 = 7人日
**リスク**: 高（全面書き換え） | **撤退基準**: 移行開始後3日で既存機能の50%が動作しなければ中止
**PLインパクト**:
- 開発速度: 機能追加が現在の3倍速（HMR + コンポーネント分割）
- バンドルサイズ: Tree-shakingで推定-30%（現在のReactバンドルに未使用コードが含まれている可能性）
- 月次ランニング: 変化なし（静的ホスティングのまま）

---

### 3-2. コンポーネント分割戦略

```
src/pages/
  HomePage.jsx        -- M0相当
  GrowthPage.jsx      -- _0相当（体重グラフ）
  AlbumPage.jsx       -- H0相当
  DiaryPostPage.jsx   -- O0相当
  DiaryDetailPage.jsx -- R0相当
  SettingsPage.jsx    -- U0相当
  SymptomsPage.jsx    -- q0相当
  AIHealthPage.jsx    -- N0相当
  MemoryPage.jsx      -- k0相当
  FriendsPage.jsx     -- Y0相当

src/components/
  Layout.jsx          -- 共通ヘッダー/フッター/ナビゲーション
  DogSwitcher.jsx     -- 犬切替ドロップダウン
  Toast.jsx           -- トースト通知
  Modal.jsx           -- 汎用モーダル
  BackupFab.jsx       -- バックアップFAB
  GrowthCard.jsx      -- 成長まとめカード
```

ルーティングは `react-router-dom` v6+ を使用し、現在のハッシュベースルーティング（G0）を正規化。

---

### 3-3. テスト戦略

```
テストピラミッド:
  E2E (Playwright)  : 10ケース -- 主要ユーザーフロー（日記投稿、体重記録、犬追加）
  Integration (RTL) : 30ケース -- ページ単位の結合テスト
  Unit (Vitest)     : 50ケース -- ユーティリティ、reducer、hooks

優先度:
  1. データ永続化（localStorage read/write）のユニットテスト
  2. 犬追加/切替フローのインテグレーションテスト
  3. オフライン動作のE2Eテスト
```

**工数**: テスト基盤構築1人日 + テスト記述5人日 = 6人日
**リスク**: 低（テスト追加は既存コードを変更しない）
**PLインパクト**: リグレッションバグ-70%（現在は手動テストのみと推定）

---

## マイルストーン

| フェーズ | 期限 | デリバラブル | 工数 |
|---------|------|-------------|------|
| Phase 0: 即時改善 | 1週間 | setIntervalクリーンアップ、_isDark()共通化、バリデーション追加、a11y修正 | 3.5h |
| Phase 1: UXレイヤー分割 | 2-3週間 | 10モジュールに分割、ES Modules化 | 3人日 |
| Phase 2: ビルドシステム導入 | 1-2ヶ月 | Vite構成、犬種データ外部化、SW更新 | 3人日 |
| Phase 3: React再構築 | 2-3ヶ月 | ソースコード復元 or 再実装、Context/Reducer導入 | 7人日 |
| Phase 4: テスト基盤 | Phase 3と並行 | Vitest + RTL + Playwright | 6人日 |

---

## 重要な注意事項

**Reactバンドルのソースコードが存在しない**ことが最大のリスクである。行334-356にミニファイされたReact 19.2.4アプリがインラインで埋め込まれており、元のソースコード（.jsx/.tsx）がリポジトリに見当たらない。

**対策の優先順位**:
1. ビルド前のソースコードの所在を確認する（別リポジトリ、ローカル等）
2. ソースが喪失している場合、UXレイヤー（行363-2714の生JavaScript）の改善を先行する
3. React部分は「触らない」を原則とし、UXレイヤーからの外部制御（DOM操作、StorageEvent）で機能拡張を継続する

Phase 0（即時改善）は現状のファイル構造のまま即日着手可能。Phase 1以降はソースコードの有無によって戦略が分岐する。

**対象ファイル**: `/home/user/wanchan-seichou-nikki/index.html`（全2,714行、うちReactバンドル行334-356、UXレイヤー行363-2714）