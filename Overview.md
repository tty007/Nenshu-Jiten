# 年収事典（Nenshu-Jiten）設計指示書

> このドキュメントは、Next.js + Supabase + Vercel 構成で開発している「企業年収・情報比較サービス『年収事典』」の現行設計をまとめたものです。AI コーディングツール（Cursor / Claude Code 等）に読ませて開発を進める前提で記述しています。コードと食い違いが出た場合は実装側を正とし、本書を更新してください。

---

## 1. プロダクト概要

### 1.1 サービスコンセプト

有価証券報告書（EDINET の XBRL ファイル）を中心に、上場企業の年収・勤続年数・従業員数・女性管理職比率・残業時間・業績などを **業界平均と比較できる形で可視化する** 公開 Web サービス。あわせて以下の公的データも統合し、一次情報のみで構成された企業ページを提供する。

- 金融庁 EDINET（有価証券報告書 XBRL）
- 経済産業省 gBizINFO（法人番号・設立日・資本金・代表者・公式 HP）
- 厚生労働省「女性の活躍推進企業データベース」（女性活躍・両立支援の取組）
- 厚生労働省「賃金構造基本統計調査」（役職別賃金）

### 1.2 ターゲットユーザー

- **メインターゲット**: 転職検討者
- **サブターゲット**: 就活生
- 年収・働きやすさの「客観的な数字」を重視する層

### 1.3 提供価値

- **一次情報のみを扱う**（有報・公的統計ベースなので客観・正確）
- **業界平均との比較**で「相対的にどうなのか」がわかる
- **完全無料・広告なし**でストレスなく閲覧可能
- 経年変化（年収推移、業績推移）が見える

### 1.4 収益化方針

- **MVP〜現状は完全無料・広告なし**
- 運用コストは個人負担を前提に、Supabase / Vercel の無料枠 〜 低価格枠で収まる設計

---

## 2. 技術スタック

| レイヤー         | 採用技術                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| フロントエンド   | Next.js 15（App Router, React 19）+ TypeScript                            |
| UI               | Tailwind CSS v3 + 自前コンポーネント（lucide-react アイコン）             |
| データベース     | Supabase（PostgreSQL）                                                    |
| 認証             | Supabase Auth — 一般会員（email/password + Google OAuth）と管理者で共通   |
| 管理者判定       | env `ADMIN_EMAILS`（カンマ区切りメール allowlist）                        |
| ホスティング     | Vercel（`@vercel/analytics`）                                             |
| ETL バッチ       | ローカル実行の `scripts/etl/*.ts`（tsx）— 現状は手動運用                  |
| XBRL パース      | EDINET の CSV 配布物 + `fast-xml-parser` / `jszip`（`scripts/etl/lib/xbrl.ts`） |
| グラフ描画       | visx（`@visx/scale` `axis` `shape` `group` `responsive` `tooltip` `grid` `curve` `event`） |
| 企業概要生成     | OpenAI（`gpt-4o-mini` 既定 / `OPENAI_MODEL` で切替可）                    |
| バリデーション   | zod                                                                       |

`package.json` も併せて確認のこと。LLM は当初 Anthropic Claude を想定していたが、コスト/品質/取り回しの観点で OpenAI に切り替えた経緯がある（`scripts/etl/06-generate-summaries.ts`）。`.env.example` の `ANTHROPIC_API_KEY` は将来の差し替え余地として残しているのみ。

---

## 3. データ設計

### 3.1 設計方針

- **生データ層と整形済みデータ層を分離**する
- フロント（`anon` キー）からは整形済みテーブルのみ参照、生データ層は `service_role` のみ書込・読込
- ETL から書込むテーブルはすべて RLS を有効化し、`service_role` でバイパスする運用

```
[EDINET API] → [raw_xbrl_documents（生データ）] → [ETL] → [companies / financial_metrics / industry_averages] → [Next.js]
[gBizINFO]   →                                  → companies の基本情報カラム
[厚労省 CSV] →                                  → mhlw_company_data
```

### 3.2 テーブル一覧（マイグレーション順）

| マイグレーション | 追加内容 |
| --- | --- |
| `20260426000001_initial_schema.sql` | `industries` / `companies` / `financial_metrics` / `industry_averages` / `raw_xbrl_documents` + RLS + `set_updated_at()` |
| `20260430123836_add_user_profiles_table.sql` | `user_profiles` 新設、`profiles.display_name` を撤去して `user_profiles.nickname` へ移行、`handle_new_user()` 更新 |
| `20260503080740_company_basic_profile.sql` | `companies` に `representative` / `corporate_number` / `capital_stock_yen` / `founded_at` / `fiscal_year_end_month` を追加 |
| `20260505075310_user_favorites.sql` | `user_favorites`（会員のお気に入り企業）新設 |

> このほか、`profiles`（auth ユーザーの軽い拡張）と `mhlw_company_data`（厚労省データ）、`companies` のサマリ用カラム（`latest_avg_salary` / `latest_tenure_years` / `latest_submitted_at` 等）が Supabase 側に存在する。リポジトリ内マイグレーションには未収録のため、リモートを起点に整理する際は `mcp__supabase__list_tables` で実態を確認すること。

#### 3.2.1 `raw_xbrl_documents` — 生データ層

`id / edinet_code / doc_id(UNIQUE) / ordinance_code / form_code / doc_type_code / fiscal_year / period_start / period_end / submitted_at / filer_name / raw_xbrl(jsonb) / storage_path / parsed_at / parse_error / created_at`

XBRL ZIP 本体は Supabase Storage に置く想定（`storage_path` で参照）。XBRL 仕様変更時に再パースできる安全網として保持。

#### 3.2.2 `companies` — 企業マスタ

| カラム                  | 出典                            |
| ----------------------- | ------------------------------- |
| `edinet_code` (UNIQUE)  | EDINET                          |
| `securities_code`       | EDINET                          |
| `name` / `name_kana`    | EDINET                          |
| `industry_code`         | EDINET → `industries`           |
| `listed_market`         | EDINET（プライム/スタンダード/グロース） |
| `description`           | 有報原文の抜粋                  |
| `summary` / `summary_generated_at` / `summary_source_doc_id` | LLM 生成 |
| `website_url`           | gBizINFO                        |
| `headquarters`          | EDINET                          |
| `founded_year` / `founded_at` | 有報 / gBizINFO            |
| `representative`        | 有報                            |
| `corporate_number`      | gBizINFO（13 桁、UNIQUE）       |
| `capital_stock_yen`     | gBizINFO                        |
| `fiscal_year_end_month` | 有報（1〜12）                   |
| `logo_url` / `cover_image_url` | 任意                     |
| `created_at` / `updated_at`（トリガで自動更新） |             |

#### 3.2.3 `industries` — 業界マスタ

東証 33 業種ベース。`code` PK / `name` / `parent_code`（自己参照）。

#### 3.2.4 `financial_metrics` — 年度別の整形済み指標

`(company_id, fiscal_year)` UNIQUE。`average_annual_salary` / `average_age` / `average_tenure_years` / `employee_count` / `female_manager_ratio` / `average_overtime_hours` / `revenue` / `operating_income` / `ordinary_income` / `net_income` / `doc_id` / `submitted_at`。

`net_income` だけでなく **経常利益 (`ordinary_income`) も持つ**。企業詳細ページでは売上・営業利益・経常利益の 3 系列をグラフ化している。

#### 3.2.5 `industry_averages` — 業界平均

`(industry_code, fiscal_year)` PK。`avg_annual_salary / avg_tenure_years / avg_employee_count / avg_female_manager_ratio / avg_overtime_hours / sample_size`。`financial_metrics` から再集計（`scripts/etl/04-compute-industry-averages.ts`）。

#### 3.2.6 `mhlw_company_data` — 厚労省 女性活躍 DB

会社単位 1 行。残業・育休取得率・有給取得率・女性係長/管理職/役員比率・男女賃金差・各種認定（くるみん／えるぼし／ユースエール／なでしこ）・諸制度（フレックス／テレワーク等）・データ集計範囲。詳細は `lib/data/mhlw-types.ts` の `MhlwCompanyData` 型を参照。

#### 3.2.7 会員系テーブル

- `profiles`（auth 拡張）— `id`(=auth.users.id), `email` 等。`handle_new_user()` トリガが新規登録時に作成。
- `user_profiles` — ニックネーム・生まれ年・性別・都道府県・キャリアステータス・年収帯。RLS は本人のみ全権。
- `user_favorites` — `(user_id, company_id)` PK。`/mypage/favorites` のソースで、企業ヒーロー右上のハートと連動。RLS は本人のみ全権。

### 3.3 ETL の責務

`scripts/etl/` 配下のローカル実行スクリプトで構成（管理画面からは起動しない）。`SUPABASE_SERVICE_ROLE_KEY` を利用するため Vercel 環境では実行しない。

| 番号 | スクリプト | 役割 |
| --- | --- | --- |
| 01 | `01-fetch-april-companies.ts` | 期間内に有報を提出した会社一覧を EDINET から取得し、`industry name → code` を解決して JSON へ吐く |
| 02 | `02-fetch-historical-docs.ts` | 各社の過去 5 年分の有報メタを EDINET から取得し JSON 化 |
| 03 | `03-load-companies-and-xbrl.ts` | XBRL CSV をダウンロード→解析→`companies` / `financial_metrics` / `raw_xbrl_documents` に upsert |
| 04 | `04-compute-industry-averages.ts` | `industry_averages` を再集計 |
| 05 | `05-import-mhlw.ts` | 厚労省 CSV を取り込み、`mhlw_company_data` に upsert + 残業/女性管理職比率の欠損補完 + `corporate_number` を埋める |
| 06 | `06-generate-summaries.ts` | 最新有報の事業内容テキストを抽出し、OpenAI で `companies.summary` を生成 |
| 07 | `07-import-gbizinfo.ts` | gBizINFO API から HP・設立日・資本金・代表者・法人番号を取得して `companies` に上書き |

並列実行ヘルパ（`fetch-quarterly-parallel.ts` / `generate-summaries-quarterly-parallel.ts` 等）と失敗リトライ用スクリプト（`retry-failures-2025q4.ts` 等）も備える。

> 将来的にはスケジューラ（GitHub Actions / Supabase pg_cron）で 04, 06, 07 を定期実行に寄せる方針。`data_ingestion_jobs` テーブルや管理画面からのジョブ起動 UI は **意図的に廃止** している（個人運用で過剰なため）。

---

## 4. 認可モデル

### 4.1 ロール

- **匿名ユーザー** — 公開ページ全般を閲覧可能。役職別年収・厚労省データの数値は HTML に出さない（後述のゲート参照）。
- **会員（ログイン済み）** — 上記 + ゲートされた数値の閲覧、お気に入り、マイページ。
- **管理者** — 会員の上位互換。`ADMIN_EMAILS` に含まれる email のユーザーのみ。`/admin` 配下にアクセス可能。

### 4.2 認証

- Supabase Auth（メール/パスワード + Google OAuth）。
- `middleware.ts` がほぼ全パスでセッションを更新する（静的ファイルと一部画像のみ除外）。
- 会員 UI: `/auth/sign-in` `/auth/sign-up` `/auth/verify-email` `/auth/forgot-password` `/auth/reset-password`、コールバックは `/auth/callback` `/auth/confirm`。

### 4.3 管理者判定

`lib/auth/is-admin.ts`:

- DB ベースの `admin_users` テーブルは使わない。
- `process.env.ADMIN_EMAILS` を `,` 分割し trim + lowercase で比較。
- `isCurrentUserAdmin()` は React の `cache()` でリクエスト内 1 回に絞る。
- 未認証で `/admin` を開くと `getCurrentUser()` 由来で `/auth/sign-in?next=/admin` へリダイレクト。
- 認証済みでも非管理者なら `notFound()` を返し **404 で存在自体を隠す**。

### 4.4 ゲート（数値の段階的開示）

役職別年収と厚労省データは「あるかどうか」だけ HTML に出し、**実数値は会員専用 API で配信** する：

- `app/api/companies/[edinetCode]/position-estimate/route.ts` — 役職別年収（`lib/data/position-salary.ts` の `estimatePositionSalaries`）
- `app/api/companies/[edinetCode]/mhlw/route.ts` — 厚労省データ
- 画面側のラッパーは `components/GatedPositionSalary.tsx` / `components/GatedMhlwSection.tsx`

---

## 5. ページ構成

### 5.1 サイトマップ

```
公開ページ
/                              トップ
/search                        検索結果
/companies/[edinetCode]        企業詳細 ★メインコンテンツ
/industries                    業界一覧
/about                         サービスについて
/data-source                   データ出典・更新頻度
/privacy-policy                プライバシーポリシー
/terms-of-service              利用規約

会員系（要ログイン、middleware で誘導）
/mypage                        プロフィール表示・編集の起点
/mypage/favorites              お気に入り企業一覧
/mypage/settings               メアド・パスワード変更・退会

認証フロー
/auth/sign-in / sign-up / verify-email / forgot-password / reset-password
/auth/callback / confirm       OAuth・メール確認

管理画面（リンクなし。/admin を直打ち + ADMIN_EMAILS）
/admin                         ダッシュボード
/admin/users                   ユーザー一覧・削除

API
/api/search/suggest                                インクリメンタル検索
/api/companies/[edinetCode]/position-estimate      役職別年収（要ログイン）
/api/companies/[edinetCode]/mhlw                   厚労省データ（要ログイン）
```

`/industries/[code]`（業界詳細）は **未実装**。`/industries` は業界の一覧と各業界の上位企業のショートカットのみ。

### 5.2 トップ `/`

`app/page.tsx`。`revalidate = 3600` の ISR。

- ヒーロー：キャッチコピー + 大型検索ボックス + サービスのバレットポイント
- 使い方カード 3 枚（転職比較 / 企業研究 / 相場感）
- 直近で更新された企業のマーキー
- ランキングタブ（年収 / 勤続年数 / 従業員数 / 売上高 / 直近更新）
- 業界から探す
- 年収分布のヒストグラム

データは `getRecentCompanies` / `searchCompaniesPaged` / `getHomeStats` / `getSalaryDistribution` を `Promise.all` で並列取得。

### 5.3 検索結果 `/search`

`searchParams` ベースで Server Component から Supabase に直接クエリ。クエリ・業界・年収レンジ・上場市場・並び順で絞り込み。フィルタはモーダル（`SearchFilterModal.tsx`）で SP/PC 共通 UI。

### 5.4 企業詳細 `/companies/[edinetCode]` ★最重要

`app/companies/[edinetCode]/page.tsx`。Header の `<UserMenu />` が `cookies()` を読むため **`dynamic = "force-dynamic"`**。SEO はビルド時 `app/sitemap.ts` が全 EDINET コードを列挙するのでクロール経路は維持される。

セクション構成（上から）:

1. **`<CompanyHero />`** — ロゴ・社名・業界タグ・上場区分・本社・公式 HP・業界内ランキング・お気に入り（`<FavoriteButton />`）。年収業界平均比 / 前年比もここで出す。
2. **企業概要（LLM 生成）** — `companies.summary` をそのまま `whitespace-pre-line` で表示。末尾に「※{年度}年度提出の有価証券報告書から自動生成」と注記。`null` のときはセクション自体を非表示。
3. **働き方の主要指標（5 枚カード）** — 平均勤続年数 / 従業員数 / 平均年齢 / 女性管理職比率 / 平均残業時間（月）。`<MetricCard />` で業界平均比と前年比を色 + 矢印で表現。任意開示項目は `unavailableLabel` で「データなし」を明示。
4. **平均年収の推移** — `<SalaryTrendChart />`（visx）。会社実績 vs 業界平均（点線）。`<details>` で生データテーブルも併記（SR 対応）。
5. **業績の推移** — `<EarningsTrendChart />`。売上・営業利益・経常利益の 3 系列。
6. **役職別年収（ゲート）** — データがあれば `<GatedPositionSalary />` を描画。HTML には実数値を含めず、ログイン後 API から取得。算出ロジックは `lib/data/position-salary.ts`（賃金構造基本統計調査の役職別賃金比×会社平均年齢→非役職者推定→各役職の年収）。
7. **厚労省データ（ゲート）** — `mhlw_company_data` がある会社のみ `<GatedMhlwSection />` を描画。本体 `<MhlwSection />` は残業時間・育休取得率・有給取得率・女性比率・男女賃金差・認定マーク・諸制度を表示。
8. **企業基本情報テーブル** — `<CompanyBasicInfoTable />`。代表者・法人番号・資本金・設立日・決算月・事業内容（有報抜粋）等。
9. **同業他社** — 同 `industry_code` の他社を `getCompaniesByIndustry` で 5 件取得し `<CompanyCard variant="compact" />` で並べる。
10. **データ出典** — 提出先（EDINET）・doc_id・提出年月・EDINET の該当書類への外部リンク。

### 5.5 マイページ `/mypage` 系

- `/mypage` — ニックネーム・基本属性（生まれ年・性別・都道府県・キャリア・年収帯）の表示と編集モーダル（`<EditProfileButton />` → `<UserProfileForm />`）。プロフィール完了バッジあり。
- `/mypage/favorites` — お気に入り一覧。`<FavoriteButton />` で個別解除可能。
- `/mypage/settings` — メアド変更（要再認証）・パスワード変更・退会（`<DeleteAccountForm />` で email 再入力を強制）。

`app/mypage/layout.tsx` でヘッダ・フッタ・サイドナビをまとめている。

### 5.6 管理画面 `/admin` 系

- `/admin` — ダッシュボード。会員数・直近 7 日新規 / 24h アクティブ / 30 日アクティブ・メール認証率・プロフィール完了率・登録推移（30 日のスパークライン）・企業データ網羅率（法人番号・設立日・公式 HP・資本金・代表者・AI 概要・平均年収・勤続年数）・お気に入りトップ 10・直近更新企業一覧・ETL ヘルス（最新取込・直近 7 日パース件数・直近 30 日エラー件数）。
- `/admin/users` — auth.users + user_profiles の集約一覧。検索・フィルタ・1 件ごとの削除（`<DeleteUserDialog />` で email 再入力確認、`adminDeleteUser` Server Action がサーバ側でも一致を再検証して `auth.admin.deleteUser` を呼ぶ）。
- `app/admin/layout.tsx` — Header（検索ボックス非表示）+ サイドナビ + Footer。`metadata.robots = { index: false, follow: false }` + `referrer: same-origin` を明示。
- ジョブ管理 UI / 企業詳細 UI / 概要再生成 UI は **持たない**。ETL はすべてローカル CLI から手動で叩く。

### 5.7 共通コンポーネント

| コンポーネント                         | 用途                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| `<Header />`                           | 全ページ共通。ロゴ + 検索 + `<UserMenu />`                          |
| `<Footer />`                           | データ出典・運営情報・利用規約・プライバシーポリシー                |
| `<SearchBox />` / `<SearchFilterModal />` | インクリメンタル検索とフィルタ                                  |
| `<CompanyCard />` / `<CompanyHero />`  | 企業カード（一覧 / 関連企業）と企業詳細ヒーロー                    |
| `<MetricCard />`                       | KPI カード（数値 + 業界平均比 + YoY）                              |
| `<HomeRankingTabs />` / `<MarqueeRow />` | トップのランキング切替・直近更新マーキー                          |
| `<FavoriteButton />` / `<Toaster />`   | お気に入り操作と toast                                              |
| `<MhlwSection />` / `<GatedMhlwSection />` | 厚労省データの表示とゲート                                     |
| `<PositionSalaryEstimate />` / `<GatedPositionSalary />` | 役職別年収とゲート                              |
| `<CompanyBasicInfoTable />`            | 企業基本情報の dl/table                                            |
| `<IndustryBadge />`                    | 業界タグ                                                            |
| `components/admin/*`                   | `StatCard` / `ProgressBar` / `SparkBarChart` / `UserTable`         |
| `components/auth/*`                    | サインイン・サインアップ・パスワード/メール変更・Google OAuth・退会・ユーザーメニュー |
| `components/profile/*`                 | プロフィール属性編集モーダル                                        |
| `components/charts/*`                  | `SalaryTrendChart` / `EarningsTrendChart`（visx）                  |

### 5.8 グラフ実装方針（visx）

採用パッケージ: `@visx/scale axis shape group responsive tooltip grid curve event`。

- すべて `<ParentSize>` でラップしてレスポンシブ化、Client Component で動かす。
- `components/charts/` 配下にラッパーを置き、ページからは props で呼ぶだけ。visx の詳細は閉じ込める。
- ツールチップは `useTooltip` + `<TooltipWithBounds>` + `localPoint`。
- アクセシビリティ確保のため、生データの `<table>` を `<details>` で併記する（年収推移セクションを参照）。

---

## 6. デザイン方針

### 6.1 トーン & マナー

- **信頼感重視**: 一次情報を扱うサービスなので、誇張表現は使わない
- **数字を主役に**: 装飾は最小限、数値の視認性を最優先
- **客観中立**: 「ホワイト企業」「ブラック企業」のような主観評価語は使わない

### 6.2 カラー

`tailwind.config.ts` でブランド色 / surface / ink / positive / negative の役割色を定義。企業ページのアクセントは `lib/data/brand-color.ts` の `brandColorFor(industryCode)` で業界ごとに決定する（`<CompanyHero />` のグラデーションや `<EarningsTrendChart />` の主要色に流用）。

### 6.3 タイポ

- 日本語: Noto Sans JP
- 数値: `font-numeric` クラスで tabular-nums を適用

### 6.4 レスポンシブ

- モバイルファースト
- 企業詳細ページの主要指標カードは PC で 5 列、SP では 1〜2 列

---

## 7. SEO・パフォーマンス

- `app/sitemap.ts` で全 EDINET コードを列挙
- `app/robots.ts` で `/admin` `/mypage` `/auth` 配下は `Disallow`
- 企業詳細は `dynamic = "force-dynamic"`（cookies を使うため）。トップは ISR 1 時間。
- `generateMetadata` でタイトル・description を動的生成
- Vercel Analytics で計測

---

## 8. 企業概要の自動生成

### 8.1 方針

四季報の「会社概要」のように、**第三者目線で客観的にまとめた 200〜300 字程度のテキスト**を有報から自動生成し、企業詳細ページに表示する。

### 8.2 ソースとモデル

- 入力テキスト: 有報 XBRL の以下フィールド（`scripts/etl/06-generate-summaries.ts`）
  - `jpcrp_cor:DescriptionOfBusinessTextBlock`
  - `jpcrp_cor:CompanyHistoryTextBlock`
  - `jpcrp_cor:BusinessPolicyBusinessEnvironmentIssuesToAddressEtcTextBlock`
  - context は `FilingDateInstant` を優先、無ければ `CurrentYearDuration`
- モデル: OpenAI（既定 `gpt-4o-mini`、`OPENAI_MODEL` env で切替）
- 出力先: `companies.summary` / `summary_generated_at` / `summary_source_doc_id`

### 8.3 文体ガイドライン

- 事実のみ、主観評価（優良/ブラック/有望等）禁止
- である調・自然な一段落（見出し / 箇条書き / 区切り記号は使わない）
- 投資勧誘・転職勧誘につながる表現禁止
- 数値は有報のものをそのまま使用

### 8.4 失敗ハンドリング

生成失敗時は `summary` を `null` のまま残し、企業詳細ページではセクションごと非表示にする。再生成は CLI から `--edinet=...` で個別、または `--force` で一括再生成。

---

## 9. データ取得の運用

### 9.1 取り込みの考え方

- **対象決定**: 期間を指定して `01-fetch-april-companies.ts` を回し、その期間に有報を提出した事業会社（`formCode=030000`）の一覧を JSON 化する。
- **新規企業**: 過去 5 年分の有報を `02 → 03` で取り込む（EDINET の保持期間に合わせる）。
- **既存企業**: 最新分のみ追加取り込み。過去データは保持。
- **集計**: `04-compute-industry-averages.ts` を最後に走らせる。

### 9.2 EDINET API 利用上の注意

- 利用規約とレートリミットを必ず確認（推奨：1 リクエスト/秒以下）
- API 保持期間は過去 5 年のみ
- フッターに「金融庁 EDINET」を明記
- レート制限対策として企業間に最低 1 秒の sleep（`scripts/etl/lib/edinet.ts` の `sleep`）

### 9.3 データ品質

- 有報の項目は企業によって粒度が違う（女性管理職比率・残業時間は任意項目）
- パース失敗時は `null` を許容、フロント側で「データなし」表示
- 平均年収は「臨時雇用者を除く」前提
- 最新年度の特定フィールドが欠けているときは `lib/data/companies.ts` の `computeLatestWithFallback` で過去年度の最新非 NULL 値を埋める

### 9.4 法的配慮

- 有報・公的統計は公開情報。ロゴは商標扱い、表示は控えめに
- ネガティブ評価表現は使わず数値で語る
- LLM 生成サマリには「自動生成・参考情報」の注記を必ず付ける
- プライバシーポリシー（`/privacy-policy`）と利用規約（`/terms-of-service`）を公開

---

## 10. 開発ロードマップ

### 完了済み（現状）

- [x] Supabase スキーマ（companies / financial_metrics / industry_averages / raw_xbrl_documents / industries）
- [x] EDINET ETL（期間指定 + 過去 5 年バックフィル）
- [x] LLM 企業概要の自動生成
- [x] 業界平均の集計
- [x] gBizINFO 連携（HP・設立日・資本金・代表者・法人番号）
- [x] 厚労省 女性活躍 DB の取り込みと `<MhlwSection />`
- [x] 役職別年収推定（賃金構造基本統計調査）
- [x] トップ / 検索結果 / 企業詳細
- [x] 業界一覧
- [x] 会員機能（サインイン・サインアップ・Google OAuth・パスワード再設定・メール変更・退会）
- [x] プロフィール属性 + マイページ
- [x] お気に入り（ハート + マイページ一覧）
- [x] ゲート（役職別年収・厚労省データの数値は API 経由で会員配信）
- [x] 管理画面（ダッシュボード + ユーザー管理）

### 次に着手したい

- [ ] `/industries/[code]`（業界詳細・分布ヒストグラム・TOP30 ランキング）
- [ ] 複数企業の横並び比較ページ
- [ ] 経年変化のより詳細な可視化（5 年超の蓄積を見越して）
- [ ] スケジューラ化（GitHub Actions / Supabase pg_cron で 04 / 06 / 07 を自動化）

### 将来構想

- [ ] 求人媒体 API との連携
- [ ] 連結子会社・関連会社の情報統合
- [ ] 通知機能（お気に入り企業の有報更新メール）

---

## 11. ディレクトリ構成（実態）

```
.
├── app/
│   ├── layout.tsx
│   ├── page.tsx                       # トップ
│   ├── not-found.tsx
│   ├── robots.ts / sitemap.ts
│   ├── about/ data-source/ privacy-policy/ terms-of-service/
│   ├── search/page.tsx
│   ├── industries/page.tsx
│   ├── companies/[edinetCode]/page.tsx
│   ├── auth/
│   │   ├── sign-in/ sign-up/ verify-email/
│   │   ├── forgot-password/ reset-password/
│   │   └── callback/route.ts  confirm/route.ts
│   ├── mypage/
│   │   ├── layout.tsx  page.tsx
│   │   ├── favorites/page.tsx
│   │   └── settings/page.tsx
│   ├── admin/
│   │   ├── layout.tsx                 # 認可ガード（ADMIN_EMAILS）+ サイドナビ
│   │   ├── page.tsx                   # ダッシュボード
│   │   └── users/page.tsx
│   └── api/
│       ├── search/suggest/route.ts
│       └── companies/[edinetCode]/
│           ├── mhlw/route.ts
│           └── position-estimate/route.ts
├── components/
│   ├── Header.tsx Footer.tsx Toaster.tsx
│   ├── SearchBox.tsx SearchFilterModal.tsx
│   ├── CompanyCard.tsx CompanyHero.tsx CompanyBasicInfoTable.tsx
│   ├── MetricCard.tsx IndustryBadge.tsx HomeRankingTabs.tsx MarqueeRow.tsx
│   ├── FavoriteButton.tsx
│   ├── MhlwSection.tsx GatedMhlwSection.tsx
│   ├── PositionSalaryEstimate.tsx GatedPositionSalary.tsx
│   ├── admin/  auth/  profile/  charts/
├── lib/
│   ├── utils.ts toast.ts
│   ├── supabase/  (server / client / admin / middleware)
│   ├── auth/      (get-user / is-admin / actions / schemas)
│   ├── profile/   (actions / schemas / get-user-profile)
│   ├── favorites/ (actions / get-favorites)
│   ├── admin/     (get-admin-stats / get-admin-users / actions / data-mappers)
│   └── data/      (companies / industry-averages / mhlw / mhlw-types /
│                   home-stats / position-salary / brand-color)
├── scripts/etl/
│   ├── 01-fetch-april-companies.ts
│   ├── 02-fetch-historical-docs.ts
│   ├── 03-load-companies-and-xbrl.ts
│   ├── 04-compute-industry-averages.ts
│   ├── 05-import-mhlw.ts
│   ├── 06-generate-summaries.ts
│   ├── 07-import-gbizinfo.ts
│   ├── (並列化・リトライ用ヘルパ各種)
│   └── lib/  data/  logs/
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
├── types/index.ts
├── middleware.ts
├── tailwind.config.ts
└── next.config.ts
```

---

## 12. 環境変数

`.env.example` を参照。実運用に必要な最低限：

| 変数 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | sitemap / robots / OG の絶対 URL |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | フロントの Supabase クライアント |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理画面サーバ処理 + ETL 用 |
| `EDINET_API_KEY` | EDINET 取得用 |
| `GBIZINFO_API_TOKEN` | gBizINFO 連携用 |
| `OPENAI_API_KEY` / `OPENAI_MODEL?` | 企業概要生成 |
| `ADMIN_EMAILS` | `/admin` を開けるメールの allowlist |

---

**このドキュメントは生きた仕様書です。実装を変えたらここも更新してください。**
