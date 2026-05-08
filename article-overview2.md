# 年収辞典 ― 企業×年収ページ ユニバーサルテンプレート v2

## 0. このドキュメントの位置づけ

`/companies/{edinetCode}` で「{社名} 年収」検索者を受け止めるページの**全社共通テンプレート**。

- **対象クエリ**: `{社名} 年収`、`{社名} 給料`、`{社名} 平均年収`、`{社名} 年収 30代`、`{社名} ボーナス` 等の派生
- **対象ペルソナ**: 転職検討者（最大）／ 就活生 ／ 現職者
- **設計の二大柱**:
  1. **エンティティ SEO / Knowledge Graph 統合** — 「{社名}」を Google が認識する企業エンティティとして年収辞典のページを参照源化
  2. **ペルソナ意思決定支援** — 平均値だけでなく分布・推移・派生値を提示

旧 `article-overview.md` は本ドキュメントで上書きする。examples / 派生プロンプトはここから再構築する。

---

## 1. 検索意図の構造

### 「{社名} 年収」のクエリ階層

```
{社名} 年収（main）
├─ {社名} 平均年収          ─┐
├─ {社名} 給料 / 給与 / 賃金  │ Tier 1：直接答える
├─ {社名} ボーナス            │
└─ {社名} 初任給             ─┘

├─ {社名} 30代 年収          ─┐
├─ {社名} 課長 / 部長 年収    │ Tier 2：派生計算で答える
├─ {社名} 手取り              │
└─ {社名} 生涯年収            ─┘

├─ {社名} 年収 推移            ─┐
├─ {社名} 年収 業界平均        │ Tier 3：時系列・比較で答える
├─ {社名} 年収 やばい / 低い／高い
├─ {社名} と {同業} 比較       │
└─ {社名} 男女 賃金 差         ─┘

├─ {社名} 残業 / 福利厚生 / 退職金 ── Tier 4：データなし、隣接ページへ誘導
```

**1 ページで Tier 1〜3 すべて回答**、Tier 4 は明示的に「データなし＋隣接ページへ」と書いて期待値を整える。

### ペルソナ × 求める情報マトリクス

| 情報カテゴリ | 転職検討 | 就活生 | 現職 |
|---|:---:|:---:|:---:|
| 平均年収（最新） | ⭕ | ⭕ | ⭕ |
| 経年推移（伸びるか） | ⭕⭕ | ⭕ | ⭕ |
| 業界平均との比較 | ⭕⭕ | ⭕ | ⭕⭕ |
| **年代別推定**（30代いくら） | ⭕⭕ | ⭕⭕ | ⭕ |
| **役職別推定**（課長いくら） | ⭕⭕ | △ | ⭕⭕ |
| 初任給 | △ | ⭕⭕ | ✗ |
| ボーナス推計 | ⭕ | ⭕ | ⭕ |
| 手取り推計 | ⭕⭕ | ⭕ | ⭕ |
| 男女賃金差 | ⭕（女性応募者） | ⭕（女子学生） | ⭕ |
| 業績連動性（伸びるか） | ⭕⭕ | ⭕ | ⭕ |
| 同業他社比較 | ⭕⭕ | ⭕ | ⭕⭕ |
| パーセンタイル位置 | ⭕ | △ | ⭕⭕ |
| 生涯年収推計 | ⭕ | ⭕⭕ | △ |
| 出典・データ取得方法 | ⭕（信頼性確認） | ⭕（親への説明） | △ |

→ **全ペルソナをカバーするには平均値 + 派生計算（年代別・役職別・手取り）+ 比較が必須**。

---

## 2. エンティティ SEO 戦略

### なぜ重要か

- 「{社名}」は Google が必ずエンティティ照合するクエリ。**Knowledge Graph 上の同社ノードに年収辞典のページが結びつかないと、AI Overview / ナレッジパネル / Sitelinks の参照源になれない**
- 2024-2026 の検索 / LLM 時代では、文字列マッチではなくエンティティマッチで結果が出る
- LLM の学習データは Wikidata / Wikipedia を強く参照 → ここに「年収辞典」が出典として書き込まれているかが将来の AI 回答精度を左右する

### エンティティ強化の必須要素

#### 識別子（identifier）

すべての企業ページの `<Organization>` に必ず含める：

| 識別子 | データ源 | 表示 |
|---|---|---|
| EDINET コード | `companies.edinet_code` | UI + JSON-LD |
| 証券コード（TSE） | `companies.securities_code` | UI + JSON-LD |
| 法人番号 | `companies.corporate_number` | JSON-LD のみ（UI は任意） |
| Wikidata Q-ID | 別途マッピング表（後述） | JSON-LD `sameAs` |

#### `sameAs`：外部権威への接続

```
sameAs:
  - https://www.wikidata.org/wiki/Q{wikidata_id}    ← LLM 学習源として最重要
  - https://ja.wikipedia.org/wiki/{社名}            ← 同上
  - https://disclosure.edinet-fsa.go.jp/E{edinet_code}/...  ← 一次出典
  - https://www2.jpx.co.jp/...{securities_code}     ← 上場市場の証跡
  - {公式サイト URL}                                  ← 自社ノード
  - https://www.houjin-bangou.nta.go.jp/{法人番号}   ← 国税庁法人番号公表サイト
```

**Wikidata との連携が最優先**。年収辞典側に `companies.wikidata_id` カラムを追加し、運用初期に手動 / 半自動でマッピングする（4000 社全件は不要、まず時価総額上位 500 社）。

#### `alternateName`：別名・略称・英名・カナ

検索バリエーションすべてを Google に伝える：
- 正式名（株式会社含む）
- 略称（「トヨタ」など）
- カナ（「トヨタジドウシャ」）
- 英名（"Toyota Motor Corporation"）
- 旧社名（社名変更がある場合）

データ源：`companies.name` / `name_kana` / 別途追加するカラム。

#### 関連エンティティの内部リンク

ページ内・JSON-LD・本文どこかで必ず言及する：

| 関連 | リンク先 | スキーマ |
|---|---|---|
| 業界 | `/industries/{code}` | `industry` プロパティ + 内部リンク |
| 上場市場 | `/markets/{prime\|standard\|growth}` | `Place`（後実装） |
| 同業他社 | `/companies/{otherCode}` | `subjectOf` + 比較表内リンク |
| 親会社 / 子会社 | `/companies/{parentCode}` | `parentOrganization` / `subOrganization` |
| 業界年収ランキング | `/rankings/industries/{code}/salary` | 関連リンク |

---

## 3. URL / タイトル / メタディスクリプション

### URL パターン

```
/companies/{edinetCode}              ← 企業ハブ（このテンプレ。年収を主軸に）
/companies/{edinetCode}/salary       ← 年収特化（重複回避のため canonical 集約検討）
```

**MVP の方針**: ハブ URL `/companies/{edinetCode}` を「{社名} 年収」のメインランディングにする。`/salary` は後続の Layer 2 で派生 URL として使う場合のみ追加。

### タイトル（全角 30 字以内目標、モバイル切れ回避）

3 段階のテンプレ：

| データ充足度 | タイトル例 |
|---|---|
| 充実 | `{社名}の年収はいくら？平均{X}万円・30代推定{Y}万円【{年}最新】` |
| 普通 | `{社名}の年収【{年}】平均{X}万円・業界比{±Z}%・{N}年推移` |
| 最低限 | `{社名}（{業界}）の平均年収{X}万円｜年収辞典` |

**ルール**：
- 数値先頭可（CTR 高）→ 「年収{X}万円｜{社名}の給料・業績【{年}】」も可
- 「{社名}」は必ずタイトルの先頭か直後（エンティティ強化）
- 年度ラベル `【{年}】` は必須（鮮度シグナル）
- 煽り語禁止（「やばい」「驚愕」等）。辞典ブランドの品位

### メタディスクリプション（全角 70〜90 字）

```
{社名}の平均年収は{X}万円（{年}年度・業界平均比{±Z}%）。30代推定{Y}万円、課長級推定{P}万円。{N}年推移、男女別、{同業A}・{同業B}との比較を有報データで網羅。手取り・生涯年収も。
```

**含める要素**：
- 主数値 + 業界比
- 派生値 1-2 個（30 代年収、課長級年収）
- 比較する同業他社名（共起ワード）
- 出典（有報）
- 機能語（手取り・生涯年収）

---

## 4. ページ構造（ユニバーサル・テンプレート）

データ充足率に応じて節がフェード（後述「データ欠損時の挙動」）するが、**順序は固定**。Above the fold で結論、続いて Entity → Persona → Numbers → Comparison → Methodology の順。

### 4.0 ヘッダー（共通）

- パンくず：`年収辞典 > {業界} > {社名}`
- 社名 H1（社名のみ、「年収」を入れすぎない。エンティティ強化）
- 識別子バッジ：`EDINET E02144` / `TSE 7203` / `業界: 輸送用機器`
- 最終更新日 + 出典 EDINET 書類 ID

### 4.1 Hero（above the fold） ★最重要

**役割**：「{社名} 年収」検索者が**スクロール 0** で結論を得る。

```
┌────────────────────────────────────────────┐
│ 🏢 {社名}                                   │
│ {業界} ／ TSE {証券コード} ／ EDINET {EDINET} │
│ 最終更新: {date} ／ 出典: 第◯期有報         │
├────────────────────────────────────────────┤
│                                              │
│  ▶ {社名}の平均年収は ¥{X} 万円              │
│     {Y}年度・業界平均比 {±Z}%・{N}年で {±W}% │
│                                              │
│  KPI: [平均年収] [前年比] [業界比] [10年伸率] │
│       [30代推定] [課長級推定]                │
│                                              │
│  ペルソナナビ:                                │
│  [▶ 転職検討の方へ]                          │
│  [▶ 就活生の方へ]                            │
│  [▶ 現職社員の方へ]                          │
└────────────────────────────────────────────┘
```

要件：
- **40 字以内のリード文**で結論（数値 + 文脈）
- **6 KPI カード**：固有の数値だけ（「業界トップクラス」のような形容禁止）
- **ペルソナナビ**：3 つのアンカーリンク。クリックで該当セクションへスクロール
- データ欠損時：6 KPI のうち取れる分だけ表示、最低 3 つは出る前提

### 4.2 企業エンティティ・パネル

**役割**：エンティティ SEO のための情報集約 + 読者への基本情報提供。

| 表示項目 | データ源 | 必須/任意 |
|---|---|---|
| 正式社名 / カナ / 英名 / 略称 | `companies.name` ほか | 必須 |
| 設立年月日 | `companies.founded_at` / `founded_year` | 任意 |
| 本社所在地 | `companies.headquarters` | 任意 |
| 代表者 | `companies.representative` | 任意 |
| 資本金 | `companies.capital_stock_yen` | 任意 |
| 従業員数（最新） | `financial_metrics.employee_count` | 必須 |
| 業界 | `industries.name`（リンク付）| 必須 |
| 上場市場 | `companies.listed_market` | 必須 |
| 証券コード | `companies.securities_code` | 必須 |
| EDINET コード | `companies.edinet_code` | 必須 |
| 法人番号 | `companies.corporate_number` | 任意 |
| 公式サイト | `companies.website_url`（外部リンク `rel="noopener"`）| 任意 |
| Wikipedia | `sameAs` JSON-LD（UI は任意で「Wikipedia →」リンク）| 任意 |

レイアウト：2 列の `<dl>` グリッド。データ無いフィールドは `<dt>` ごと省略（薄いダッシュ表示は SEO 上ノイズ）。

### 4.3 会社の輪郭（200〜400 字）

**役割**：「どんな会社か」の即時把握 + エンティティ強化（共起語の自然投入）。

`companies.summary`（ETL で AI 生成済み 250〜350 字）を表示。データ無い場合は `companies.description` をフォールバック。両方無ければセクション省略。

冒頭文の構造：「**{社名}は{設立年}年に{設立地}で設立された{業界}の{規模感}。{主力事業}を中心に展開する。**」のように **エンティティ + 関係 + 属性** を 1 文に詰めると Knowledge Graph に入りやすい。

### 4.4 平均年収（メイン・データセクション）

**役割**：Tier 1 クエリへの直接回答。

```
H2: {社名}の平均年収【{年}年度】

▶ 答え: {X} 万円。業界平均（{Y} 万円）より {±Z}% 高い水準。

[KPI 4 枚: 平均年収 / 平均年齢 / 平均勤続 / 従業員数]
[折れ線グラフ: 過去 5-10 年推移 + 業界平均オーバーレイ]
[業界内パーセンタイル: 上位 {P}%]

📝 編集部の視点（人手 or 数値駆動 AI 生成）
{社名} の年収は {過去N年} で {±W}% 上昇しており、業界平均（{業界年率}%）と
比べて{速い／同等／遅い}ペース。{近年の業績推移}と整合する動きと読めます。
```

要件：
- **冒頭「▶ 答え:」1 文** で AI Overview / 強調スニペット捕捉
- グラフは社固有 + 業界平均比較を 1 つに
- パーセンタイル（業界全社中の位置）は派生計算で必ず出す
- 編集部視点は短く（80〜150 字）

### 4.5 年代別の推定年収 ★転職検討・現職・就活生の核心

**役割**：「30 代でいくら？」「45 歳でいくら？」への回答。

```
H2: 年代別の推定年収

▶ 答え: 30 歳で約 {Y30} 万円、40 歳で約 {Y40} 万円、50 歳で約 {Y50} 万円。

[テーブル or 折れ線: 25 / 30 / 35 / 40 / 45 / 50 / 55 歳]
[各値に信頼区間 ±{σ} を表示]

🔍 計算式: 平均年齢 {avg_age}・平均年収 {avg_salary}・勤続年数分布 から
   ◯◯モデルで推計。詳細は /methodology/age-salary
```

派生計算は `/methodology/age-salary` で計算式を**全公開**（学術論文ライク、E-E-A-T シグナル）。

### 4.6 役職別の推定年収 ★転職交渉・現職ベンチマーク

**役割**：「課長になればいくら？」「部長で？」への回答。

```
H2: 役職別の推定年収

▶ 答え: 一般社員 {Yg} 万円 ／ 主任 {Ys} 万円 ／ 課長 {Yk} 万円 ／
        部長 {Yb} 万円 ／ 役員平均 {Yr} 万円。

[テーブル: 役職階層 × 推定年収]

📝 編集部の視点
役員平均と一般社員の比率は {比率}倍。業界中央値（{業界比率}倍）と比べると
{大きい／同等／小さい}部類です。

🔍 計算式: 役員報酬総額 / 役員数、平均年収・年齢分布から職位別を線形推計。
   詳細は /methodology/role-salary
```

### 4.7 初任給・ボーナス・手取り（ペルソナ別 quick reference）

```
H3: 初任給（就活生向け）
学部卒 {初任給学部} 万円 / 修士了 {初任給修士} 万円
→ 公式採用情報からの転載 or 業界平均からの推計
→ 出典明記必須

H3: ボーナス推計
平均年収から月例給を引いた額を年間賞与とみなし、
{X.X} ヶ月分相当と推計。

H3: 手取り推計（30 代モデル / 40 代モデル）
年収 {Y} 万円の場合、所得税・住民税・社保控除後で約 {手取り} 万円。
さらに / 計算ツールへ：年収シミュレーター → /tools/salary
```

### 4.8 男女別の年収・多様性

**役割**：女性応募者・現職女性向け + 多様性検索意図の捕捉。

データ：`financial_metrics.female_manager_ratio` + 必要なら別途取得する男女賃金差（2023 年義務化）。データ無ければセクションごと省略。

```
H2: 男女別の年収・多様性

▶ 答え: 女性平均 {女性年収} 万円、男女差 {±M}%（業界平均 {±M_industry}%）。
        女性管理職比率 {F}%。

[棒グラフ: 男性 / 女性 / 全体]
[経年推移（2023 年以降）]

📝 編集部の視点
男女差の主因は構造的（職種ミックス・役職分布）の可能性が高い。
当該データから読める範囲では断定できないので、相関の話として読んでください。
```

### 4.9 業績との関係

**役割**：「伸びるか」「業績連動か」への回答。

```
H2: 業績と年収の関係

▶ 答え: 売上が 10% 伸びると平均年収は約 {α}% 上がる関係。

[2 軸グラフ: 売上 vs 平均年収 経年]
[生産性指標: 売上÷従業員 = {productivity_revenue} 万円/人
              営業利益÷人件費 = {labor_efficiency}]

📝 編集部の視点
業績連動性は{強い／弱い／揺れる}。{近年の業績推移}を踏まえると、
今後の年収トレンドは{推測のみ、断定禁止}。
```

### 4.10 同業他社比較

**役割**：「{社名} と {他社} 比較」クエリの捕捉 + 内部リンク結節点。

```
H2: 同業他社の年収比較

[テーブル: 5-10 社]
| 社名（リンク） | 平均年収 | 業界比 | 10年伸率 | 男女差 |

▶ 答え: 同業 {N} 社中、{社名}は{順位}位（年収）。
        最上位は {最上位社名}（{最上位年収}万円）、最下位は {最下位社名}。

各社へのリンクで内部リンク結節点を作る → 同業全社の SEO 効果を相互強化
```

### 4.11 ペルソナ別アクションガイド ★

ページの「結論セクション」。各ペルソナがここで意思決定の道しるべを得る。

```
H2: あなたの立場で読み解く

H3: 転職を検討している方へ
  - 想定オファー: 30 歳 {Y30} 万円、35 歳 {Y35} 万円、40 歳 {Y40} 万円
  - 業界中央値 +{15}% が交渉の現実的レンジ
  - 同業他社オファーとの比較は同業比較表（§4.10）を参照
  - 実際の交渉では「キャリア年収との連続性」も汲んでもらえる傾向
  → [年収シミュレーターで自分のケースを試算]

H3: 就活生の方へ
  - 初任給 {学部} 万円 / {修士} 万円
  - 30 歳推定 {Y30} 万円、40 歳推定 {Y40} 万円
  - 業界の中での位置づけ: 上位{P}%
  - 業界の伸び率: 過去 5 年で平均 +{業界伸率}%
  → [業界年収ランキングで他社比較]

H3: 現職社員の方へ
  - 業界中央値 {業界中央値} 万円との差: ±{あなたとの差}
  - 業界内パーセンタイル: 上位{P}%
  - 5 年後・10 年後の推定（過去推移ベース）
  - 同業他社の同年代との比較
  → [年収パーセンタイル算出]
```

### 4.12 FAQ（FAQPage schema）★ AI Overview 必修

8〜15 問。すべての質問は「{社名}」を含めて検索者の自然な日本語に近づける。

```
H2: よくある質問

Q1. {社名}の平均年収はいくらですか？
A1. {即答1文}。{文脈1文}。{留保1文}。
  → 80〜200 字、3 層構造（即答・文脈・留保）

Q2. {社名}の年収は業界平均より高いですか？
Q3. {社名}の30代の年収はいくらですか？
Q4. {社名}と{同業}どちらが年収が高いですか？
Q5. {社名}の課長の年収はいくらですか？
Q6. {社名}の年収はここ5年で増えていますか？
Q7. {社名}の年収は手取りでいくらですか？
Q8. {社名}の男女年収差はありますか？
Q9. {社名}の役員報酬はいくらですか？
Q10. {社名}の新卒初任給はいくらですか？
Q11. {社名}は何の会社ですか？  ← エンティティ強化
Q12. {社名}の従業員数は？      ← エンティティ強化
Q13. {社名}の業績は伸びていますか？
Q14. {社名}は今からでも転職におすすめですか？  ← 留保強めに「個人判断」と書く
Q15. {社名}のボーナスは何ヶ月分？
```

`Q11` `Q12` のような**エンティティ属性質問**を入れることで、Knowledge Graph に「年収辞典が同社の基本情報の参照源」として登録されやすくなる。

### 4.13 データの読み方・出典・編集体制（YMYL / E-E-A-T）

```
H2: データの読み方
- 「平均年収」の定義（有報の従業員の状況セクション、連結 / 単体の違い）
- 派生計算の限界（推計値であること、信頼区間の意味）
- 公表値のバイアス（パートタイム、海外子会社等）

H2: 出典
- EDINET 書類 ID: {doc_id}（リンク付）
- 取得日: {date}
- 次回更新予定: {年}年6月（次年度有報公開後 24 時間以内）

H2: 編集体制
- 著者: 年収辞典編集部
- 監修: {社労士 / 公認会計士 名前 + Person schema}
- 編集方針: /editorial-policy
- 訂正履歴: /corrections
```

「年収」は経済 YMYL なので**著者 / 監修者の Person schema は必須**。`reviewedBy` プロパティで Article schema に紐付ける。

### 4.14 関連リンク（内部リンク密度を上げる）

```
H2: 関連ページ

🔗 同業他社の年収
  - {同業A}の年収（年収{XA}万円）
  - {同業B}の年収（年収{XB}万円）
  - …

🔗 業界
  - {業界}の年収ランキング
  - {業界}の中央値・分布

🔗 ツール
  - 年収シミュレーター（年代×役職）
  - 年収パーセンタイル算出
  - 手取り計算機
  - 住宅ローン上限算出

🔗 編集記事
  - 有価証券報告書から年収を読む方法
  - 30 代 年収ランキング上位 100 社
```

各リンクの**アンカーテキストに数値を含める**と CTR も SEO も向上。

---

## 5. JSON-LD 完全版テンプレート

`@graph` で 5 つのスキーマを 1 ページに集約。

```jsonld
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://nenshu-jiten.jp/companies/{edinet_code}#org",
      "name": "{正式社名}",
      "alternateName": [
        "{略称}",
        "{カナ}",
        "{英名}"
      ],
      "url": "{公式サイト}",
      "logo": "{logo_url}",
      "foundingDate": "{founded_at YYYY-MM-DD}",
      "numberOfEmployees": {
        "@type": "QuantitativeValue",
        "value": {employee_count},
        "unitText": "person"
      },
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "JP",
        "addressLocality": "{headquarters}"
      },
      "industry": "{業界名}",
      "identifier": [
        { "@type": "PropertyValue", "name": "EDINET", "value": "{edinet_code}" },
        { "@type": "PropertyValue", "name": "TSE",    "value": "{securities_code}" },
        { "@type": "PropertyValue", "name": "法人番号", "value": "{corporate_number}" }
      ],
      "sameAs": [
        "https://www.wikidata.org/wiki/{wikidata_id}",
        "https://ja.wikipedia.org/wiki/{社名 URL エンコード}",
        "https://disclosure.edinet-fsa.go.jp/{edinet_code}/...",
        "https://www2.jpx.co.jp/.../{securities_code}",
        "{公式サイト URL}",
        "https://www.houjin-bangou.nta.go.jp/{法人番号}"
      ],
      "subjectOf": [
        { "@id": "https://nenshu-jiten.jp/companies/{edinet_code}#article" },
        { "@id": "https://nenshu-jiten.jp/companies/{edinet_code}#dataset" }
      ]
    },

    {
      "@type": "Article",
      "@id": "https://nenshu-jiten.jp/companies/{edinet_code}#article",
      "headline": "{社名}の年収はいくら？平均{X}万円・30代推定{Y}万円【{年}最新】",
      "datePublished": "{first_published_iso}",
      "dateModified": "{updated_iso}",
      "inLanguage": "ja",
      "author": {
        "@type": "Organization",
        "name": "年収辞典 編集部",
        "url": "https://nenshu-jiten.jp/about"
      },
      "publisher": {
        "@type": "Organization",
        "@id": "https://nenshu-jiten.jp/#publisher",
        "name": "年収辞典",
        "logo": {
          "@type": "ImageObject",
          "url": "https://nenshu-jiten.jp/logo.png"
        }
      },
      "reviewedBy": {
        "@type": "Person",
        "name": "{監修者}",
        "jobTitle": "{資格・肩書}",
        "url": "https://nenshu-jiten.jp/authors/{slug}"
      },
      "about": { "@id": "https://nenshu-jiten.jp/companies/{edinet_code}#org" },
      "mainEntity": { "@id": "https://nenshu-jiten.jp/companies/{edinet_code}#dataset" },
      "isBasedOn": "https://disclosure.edinet-fsa.go.jp/{doc_id}"
    },

    {
      "@type": "Dataset",
      "@id": "https://nenshu-jiten.jp/companies/{edinet_code}#dataset",
      "name": "{社名}の従業員給与データ",
      "description": "{社名}の有価証券報告書由来の平均年収・年齢・勤続・従業員数の経年データ（{from_year}〜{to_year}）",
      "creator": { "@id": "https://nenshu-jiten.jp/#publisher" },
      "isBasedOn": "https://disclosure.edinet-fsa.go.jp/{doc_id}",
      "license": "https://nenshu-jiten.jp/data-source",
      "temporalCoverage": "{from_year}/{to_year}",
      "spatialCoverage": "JP",
      "variableMeasured": [
        { "@type": "PropertyValue", "name": "平均年収", "value": "{X}", "unitText": "万円" },
        { "@type": "PropertyValue", "name": "平均年齢", "value": "{age}", "unitText": "歳" },
        { "@type": "PropertyValue", "name": "平均勤続年数", "value": "{tenure}", "unitText": "年" },
        { "@type": "PropertyValue", "name": "従業員数", "value": "{employee_count}", "unitText": "人" }
      ]
    },

    {
      "@type": "FAQPage",
      "@id": "https://nenshu-jiten.jp/companies/{edinet_code}#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "{社名}の平均年収はいくらですか？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "{即答1文}。{文脈1文}。{留保1文}。"
          }
        }
        /* 8-15 問繰り返し */
      ]
    },

    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://nenshu-jiten.jp/" },
        { "@type": "ListItem", "position": 2, "name": "{業界}", "item": "https://nenshu-jiten.jp/industries/{industry_code}" },
        { "@type": "ListItem", "position": 3, "name": "{社名}", "item": "https://nenshu-jiten.jp/companies/{edinet_code}" }
      ]
    }
  ]
}
```

### Schema 設計のポイント

- **`@id` で各エンティティに canonical URL を持たせ、`subjectOf` / `mainEntity` / `about` で相互参照**。Google Knowledge Graph はこれを高く評価する
- **`isBasedOn` で EDINET 書類 URL を直接指す** → 出典の機械可読化、AI Overview の引用率向上
- **`reviewedBy` の Person schema は YMYL 対策の核心**。経済 YMYL なので必須
- **`Dataset.variableMeasured` で各メトリクスを定義** → Google Dataset Search に登録される
- **`Organization.sameAs` の Wikidata と Wikipedia は LLM 引用源として最重要**。ここをサボると AI 検索時代の流入が伸びない

---

## 6. データ欠損時の挙動（フォールバック設計）

「どの企業にも合う」を実現するため、データ無いセクションは**消す/置換する**ルール：

| データの欠損 | 挙動 |
|---|---|
| `companies.summary` 無い | §4.3「会社の輪郭」を `description` フォールバック → それも無ければ節ごと省略 |
| `financial_metrics` 1 年分のみ | §4.4 平均年収のみ表示。経年推移チャート省略、§4.9 業績との関係も省略 |
| `financial_metrics` 全く無い | **全体を `noindex`**。空ページとしての評価リスクを避ける |
| 年代別推定が出せない（年齢分布データ無い） | §4.5 セクション省略 + 「データ取得中」表示せず |
| 役員報酬が無い | §4.6 役員行を省略、注釈「役員報酬は当該年度有報に記載なし」 |
| 男女賃金差データ無い（2022 年以前） | §4.8 セクション省略 |
| 同業他社が 1 社も無い（業界不明） | §4.10 省略 + 全業界年収ランキングへの誘導のみ |
| Wikidata ID 未マッピング | JSON-LD `sameAs` から該当行のみ削除、他は維持 |

**重要**: 欠損データを「-」「データなし」で埋めると Thin Content 判定リスク。**節ごと消すか、`noindex` する**のが鉄則。

`page_quality_metrics` テーブルで充足率を計算し、`should_index` を生成列で算出（既存設計を継承）：

```sql
should_index boolean generated always as (
  data_completeness >= 0.5
  and word_count >= 2500
  and has_chart
  and has_faq
) stored
```

---

## 7. 派生計算フィールドの設計指針

### MVP で必須

- **年代別推定年収**（25/30/35/40/45/50/55 歳）
- **役職別推定年収**（一般・主任・課長・部長・役員）
- **業界内パーセンタイル位置**
- **業界平均との差（金額換算 + パーセント）**
- **手取り推計**（30 代・40 代モデル）

### Phase 2 候補

- **生涯年収推計**
- **昇給率（年代別の年収伸び）**
- **賞与比率推計**
- **男女賃金差の経年推移**
- **業績連動係数**（売上 1% 増加に対する年収伸び）

### 計算ロジックの透明化

派生フィールドは**必ず `/methodology/{field}` で計算式を全公開**：

- 数式（LaTeX or 平易な日本語）
- 入力データ
- 信頼区間の根拠
- バイアスと限界

これは **YMYL 信頼シグナル**として効くと同時に、**他社が真似しにくい競争力**になる。

---

## 8. 内部リンク戦略

### リンク方向

| from | to | 役割 | アンカーテキスト例 |
|---|---|---|---|
| 業界ページ | 企業ページ | 業界 → 個社誘導 | 「{社名}の年収（{X}万円）」 |
| ランキングページ | 企業ページ | ランキング → 個社誘導 | 「{社名}（{X}万円）」 |
| 同業他社ページ | このページ | 業界横断 | 「{社名}の年収」 |
| このページ | 同業他社ページ | §4.10 比較表 | 「{他社}の年収（{Y}万円）」 |
| このページ | 業界ページ | §4.10 リード | 「{業界}の年収ランキング」 |
| このページ | ツール | §4.11 ペルソナナビ | 「年収シミュレーター」 |
| 編集記事 | このページ | コンテキスト引用 | 「{社名}の年収データを見る」 |

### アンカーテキスト規律

- 「{社名}の年収」は**必ずこのページにしか向けない**（カニバリ防止）
- 数値を入れる（CTR・SEO 双方プラス）
- 「ここをクリック」「詳しくはこちら」は禁止

---

## 9. 品質 / E-E-A-T チェックリスト（公開前）

### コンテンツ

- [ ] H1 が「{社名}」で始まり、エンティティを明確に提示
- [ ] Above the fold で「平均年収 X 万円」が即読める
- [ ] 6 KPI カードのうち最低 3 つが社固有数値で埋まっている
- [ ] 各 H2 セクション冒頭に「▶ 答え:」の即答 1 文がある
- [ ] FAQ が 8 問以上ある
- [ ] FAQ の最低 1 問は「{社名}は何の会社ですか？」（エンティティ強化）
- [ ] 同業他社比較表に **5 社以上**載っている

### エンティティ SEO

- [ ] JSON-LD に `Organization` `Article` `Dataset` `FAQPage` `BreadcrumbList` が `@graph` で含まれる
- [ ] `Organization.identifier` に EDINET / 証券コード / 法人番号
- [ ] `Organization.sameAs` に Wikidata と公式サイトを含む
- [ ] `Article.reviewedBy` に Person schema
- [ ] `Article.isBasedOn` で EDINET 書類 URL を指す

### 文章品質

- [ ] 「〜することができます」「と言えるでしょう」「非常に」「いかがでしたか」が 0 件
- [ ] パーセント数値の最低 1 つに金額換算が併記されている（「+12%」→「100 万円ほど多い」）
- [ ] 編集部視点コメントが段落として書かれている（箇条書きラベル禁止）
- [ ] 因果断定がない（「相関の話として読んでください」相当の留保あり）

### 信頼性 / E-E-A-T

- [ ] 出典 EDINET 書類 ID が明示
- [ ] 最終更新日が H1 直下に表示
- [ ] 監修者 Person schema が JSON-LD に含まれる
- [ ] `/methodology/{派生フィールド}` へのリンクがある
- [ ] `/editorial-policy` `/corrections` への内部リンクがフッタにある

### 技術 SEO

- [ ] sitemap に登録 + `lastmod` 正確
- [ ] CWV 目標（LCP < 2.0s、INP < 200ms、CLS < 0.05）達成
- [ ] モバイルでヒーロー領域が 600px 以下に収まる
- [ ] 画像 OGP に主要数値入り（`{社名}の平均年収 X 万円`）

---

## 10. データソース / カラム → セクション 対応表

| ページセクション | 必要カラム | テーブル |
|---|---|---|
| §4.0 ヘッダー | name, edinet_code, securities_code, industry_code | companies + industries |
| §4.0 最終更新 | doc_id, submitted_at | financial_metrics + raw_xbrl_documents |
| §4.1 Hero KPI | average_annual_salary（最新）+ 業界平均 + 派生 | financial_metrics + industry_averages + 計算 |
| §4.2 Entity panel | name_kana, founded_at, headquarters, representative, capital_stock_yen, listed_market, corporate_number, website_url, employee_count | companies + financial_metrics |
| §4.3 会社の輪郭 | summary | companies |
| §4.4 平均年収 | average_annual_salary, average_age, average_tenure_years（5-10 年）+ 業界平均 | financial_metrics + industry_averages |
| §4.5 年代別推定 | 派生計算（avg_age, avg_salary, tenure 分布から推計） | 計算層 |
| §4.6 役職別推定 | 派生計算（役員報酬総額 / 役員数 + 平均年収） | 計算層 |
| §4.7 初任給 | 別途追加（公式採用情報からの取得） | 新規 `recruitment_info` テーブル候補 |
| §4.8 男女・多様性 | female_manager_ratio + 男女賃金差（別途取得） | financial_metrics + 新規 |
| §4.9 業績との関係 | revenue, operating_income, employee_count（経年） | financial_metrics |
| §4.10 同業他社比較 | 同 industry_code の上位 5-10 社の平均年収 | companies + financial_metrics |
| §4.11 ペルソナガイド | 派生フィールド総合 | 計算層 |
| §4.12 FAQ | 上記の数値を組み合わせて自動生成 | 計算層 + AI |
| §4.13 データの読み方 | doc_id, methodology 共通文 | 静的 + companies |
| §4.14 関連リンク | 同業他社、業界ランキング、ツール | 内部ルーティング |
| JSON-LD | 上記すべて + Wikidata ID（新規追加カラム） | 全テーブル + 新規マッピング |

### 新規追加すべきカラム / テーブル

```sql
-- companies に追加
alter table public.companies
  add column wikidata_id text,
  add column english_name text,
  add column short_name text,
  add column alternate_names text[];  -- 旧社名・略称等

-- 男女賃金差（2023 年義務化）
create table public.gender_pay_gap (
  company_id uuid references public.companies(id) on delete cascade,
  fiscal_year int not null,
  pay_gap_all_pct numeric(5,2),
  pay_gap_regular_pct numeric(5,2),
  pay_gap_nonregular_pct numeric(5,2),
  female_manager_ratio numeric(5,2),
  parental_leave_male_pct numeric(5,2),
  parental_leave_female_pct numeric(5,2),
  primary key (company_id, fiscal_year)
);

-- 派生計算結果のキャッシュ
create table public.company_derived_metrics (
  company_id uuid references public.companies(id) on delete cascade,
  fiscal_year int not null,
  metric_key text not null,  -- 'salary_age_30' 'salary_role_kacho' 等
  value numeric,
  confidence_lower numeric,
  confidence_upper numeric,
  calculation_version text,
  primary key (company_id, fiscal_year, metric_key)
);

-- ページ品質メトリクス（既存設計を踏襲、再掲）
create table public.page_quality_metrics (
  url_path text primary key,
  data_completeness numeric(4,3),
  word_count int,
  has_chart boolean default false,
  has_peers boolean default false,
  has_derived boolean default false,
  has_faq boolean default false,
  should_index boolean generated always as (
    coalesce(data_completeness,0) >= 0.5
    and coalesce(word_count,0) >= 2500
    and has_chart and has_faq
  ) stored,
  updated_at timestamptz not null default now()
);
```

---

## 11. 競合との差別化（このテンプレが効く理由）

| 競合 | 強み | 弱み | 年収辞典の差別化 |
|---|---|---|---|
| OpenWork / 転職会議 | UGC（口コミ）、ボリューム | 数値の客観性低、データ取得日不明 | 一次データ + 経年 + 派生計算で「客観・透明・検証可能」 |
| 年収ガイド / 平均年収.jp | 数値ベース、派生計算あり | エンティティ SEO 弱、Knowledge Graph 連携無 | Wikidata 連携 + 完全 JSON-LD で AI 検索時代に強い |
| 各社採用情報サイト | 公式の権威性 | 比較不可、推移なし | 全社横断比較 + 経年トレンド |
| Wikipedia | 権威性、Knowledge Graph 直結 | 数値が古い、年収専用ではない | **Wikipedia / Wikidata に出典提供** することで補完関係 |

### 年収辞典固有の武器

1. **EDINET 一次データ + 24 時間以内反映**
2. **派生計算フィールドの計算式公開**（学術論文ライク）
3. **男女賃金差の経年データ**（2023 年義務化以降の蓄積）
4. **エンティティ SEO 完全実装**（Wikidata sameAs、Knowledge Graph 統合）
5. **3 ペルソナ全員を 1 ページで満たす UX**

これら 5 つを愚直にやり切れば、AI 検索 / 従来型検索 / Knowledge Graph すべてで参照源化できる。

---

## 12. 実装の優先順位

### Phase 1（MVP・1〜2 ヶ月）

1. §4.0 ヘッダー + §4.1 Hero
2. §4.2 Entity Panel + §4.3 会社の輪郭
3. §4.4 平均年収（経年グラフ）
4. §4.10 同業他社比較
5. §4.12 FAQ（8 問）
6. §4.13 データの読み方
7. JSON-LD（Organization + Article + Dataset + FAQPage + BreadcrumbList）

### Phase 2（+1 ヶ月）

8. §4.5 年代別推定
9. §4.6 役職別推定
10. §4.7 手取り推計
11. §4.11 ペルソナ別アクションガイド
12. Wikidata ID マッピング（時価総額上位 500 社）

### Phase 3（+2 ヶ月）

13. §4.7 初任給（公式採用情報からの取得パイプライン）
14. §4.8 男女別・多様性（gender_pay_gap テーブルへの取込み）
15. §4.9 業績との関係（生産性指標の派生計算）
16. 監修者 Person schema（社労士・公認会計士の依頼）
17. `/methodology/*` 計算式公開ページ

### Phase 4（+3 ヶ月）

18. ツール（年収シミュレーター・パーセンタイル算出・手取り計算）
19. 編集記事（Layer 5）
20. 多言語（英語版、海外投資家向け）

---

## 付録：ペルソナナビゲーション UI 詳細

ヒーロー直下の 3 つのアンカーリンクは UI 上重要なので別途仕様：

```html
<nav class="persona-nav" aria-label="あなたの立場で読む">
  <a href="#for-job-seekers" class="persona-card">
    <span class="persona-icon">💼</span>
    <span class="persona-title">転職を検討中の方</span>
    <span class="persona-hint">想定オファー・交渉ヒント</span>
  </a>
  <a href="#for-students" class="persona-card">
    <span class="persona-icon">🎓</span>
    <span class="persona-title">就活生の方</span>
    <span class="persona-hint">初任給・将来推計</span>
  </a>
  <a href="#for-current-employees" class="persona-card">
    <span class="persona-icon">📊</span>
    <span class="persona-title">現職社員の方</span>
    <span class="persona-hint">業界中央値・市場価値</span>
  </a>
</nav>
```

各カードは `min-h-[100px]` 程度、ホバーで brand-50 背景に変化。クリックで該当 §4.11 セクションへ smooth scroll。

これでヒーローを離脱せずに目的地まで一発で飛べる。
