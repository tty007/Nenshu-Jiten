// {社名} 年収 記事テンプレ：セクション定義
// クライアント / サーバ両方から import 可能（server-only を付けない）

export type SalarySectionKind =
  | "deterministic" // DB / 派生計算のみ。AI 不要
  | "ai" // AI による解釈段落が必要
  | "hybrid" // 計算 + AI 解釈
  | "placeholder"; // CSV パイプライン未整備で雛形のみ

export type SalarySectionDef = {
  id: string; // article-salary.md の §番号
  title: string;
  description: string;
  kind: SalarySectionKind;
  /** 推定 AI コスト（USD）。決定論的なら 0 */
  est_cost_usd: number;
  /**
   * メンバー限定（属性情報入力者のみ閲覧可）であることを示す。
   * - true: セクション全体がメンバー限定
   * - "partial": セクション内に部分的にメンバー限定が含まれる
   * - undefined: 通常公開
   */
  member_only?: true | "partial";
};

export const SALARY_SECTIONS: SalarySectionDef[] = [
  {
    id: "4.0",
    title: "ヘッダー",
    description: "発行日・最終更新・出典書類 ID",
    kind: "deterministic",
    est_cost_usd: 0,
  },
  {
    id: "4.1",
    title: "ヒーロー（結論文 + KPI カード）",
    description: "ひと目で分かる結論と 6 枚の KPI",
    kind: "hybrid",
    est_cost_usd: 0.0003,
  },
  {
    id: "4.2",
    title: "企業基本情報",
    description: "商号 / EDINET / 業界 / 本社 / 設立等",
    kind: "deterministic",
    est_cost_usd: 0,
  },
  {
    id: "4.3",
    title: "{社名} について",
    description: "会社概要・在籍メリット・キャリアパス",
    kind: "ai",
    est_cost_usd: 0.0008,
  },
  {
    id: "4.4",
    title: "平均年収（経年推移）",
    description: "5 年表 + 業界平均比 + 解釈段落",
    kind: "hybrid",
    est_cost_usd: 0.0006,
  },
  {
    id: "4.5",
    title: "年代別の推定年収",
    description: "賃金センサス × 平均年収係数で推計",
    kind: "hybrid",
    est_cost_usd: 0.0005,
    member_only: true,
  },
  {
    id: "4.6",
    title: "役職別の推定年収",
    description: "役職別賃金 × 加重平均比で推計",
    kind: "hybrid",
    est_cost_usd: 0.0005,
    member_only: true,
  },
  {
    id: "4.6.5",
    title: "生涯年収",
    description: "在職中 + 退職金の合算推計",
    kind: "hybrid",
    est_cost_usd: 0.0005,
    member_only: true,
  },
  {
    id: "4.7",
    title: "初任給・賞与・手取り",
    description: "手取りは累進税で試算、初任給/賞与は公式採用 HP 誘導",
    kind: "deterministic",
    est_cost_usd: 0,
    member_only: "partial",
  },
  {
    id: "4.8",
    title: "男女別の年収・多様性",
    description: "女性管理職比率 + 賃金センサス男女カーブ",
    kind: "hybrid",
    est_cost_usd: 0.0004,
  },
  {
    id: "4.9",
    title: "業績との関係",
    description: "売上 / 営利 / 純利と年収の経年関係",
    kind: "hybrid",
    est_cost_usd: 0.0006,
  },
  {
    id: "4.10",
    title: "同業他社との比較",
    description: "同業界の上位企業ランキング",
    kind: "hybrid",
    est_cost_usd: 0.0006,
  },
  {
    id: "4.11",
    title: "ペルソナ別アクションガイド",
    description: "転職 / 就活 / 現職の 3 視点",
    kind: "ai",
    est_cost_usd: 0.0009,
  },
  {
    id: "4.12",
    title: "FAQ（よくある質問）",
    description: "18 問前後の Q&A",
    kind: "ai",
    est_cost_usd: 0.0017,
  },
  {
    id: "4.13",
    title: "出典・編集体制",
    description: "EDINET 書類 ID・更新日・編集ポリシー",
    kind: "deterministic",
    est_cost_usd: 0,
  },
  // §4.14 関連リンクは将来再実装するためテンプレからは除外。
];

export const SALARY_SECTION_BY_ID: Record<string, SalarySectionDef> =
  SALARY_SECTIONS.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {} as Record<string, SalarySectionDef>);

/** 全セクション合計の AI コスト推定（USD） */
export const SALARY_TOTAL_EST_COST_USD = SALARY_SECTIONS.reduce(
  (sum, s) => sum + s.est_cost_usd,
  0
);

export const SALARY_KIND_LABEL: Record<SalarySectionKind, string> = {
  deterministic: "計算のみ",
  ai: "AI 生成",
  hybrid: "計算 + AI",
  placeholder: "雛形のみ",
};
