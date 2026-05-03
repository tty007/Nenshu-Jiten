// 厚労省「女性の活躍推進企業データベース」の取り込みデータ型と
// 共有ユーティリティ。Server / Client いずれからも import 可能（server-only 無し）。

export type MhlwCompanyData = {
  avgOvertimeHours: number | null;
  overtimeTargetScope: string | null;
  parentalLeaveMalePct: number | null;
  parentalLeaveFemalePct: number | null;
  paidLeaveUptakePct: number | null;
  femaleChiefRatio: number | null;
  femaleManagerRatio: number | null;
  femaleManagerCount: number | null;
  managerTotalCount: number | null;
  femaleOfficerRatio: number | null;
  femaleOfficerCount: number | null;
  officerTotalCount: number | null;
  payGapAllPct: number | null;
  payGapRegularPct: number | null;
  payGapNonregularPct: number | null;
  certKurumin: string | null;
  certKuruminPlus: string | null;
  certTryKurumin: string | null;
  certPlatinumKurumin: string | null;
  certEruboshi: string | null;
  certPlatinumEruboshi: string | null;
  certYouthYell: string | null;
  certNadeshiko: string | null;
  systemCareerChange: string | null;
  systemRehireMidcareer: string | null;
  systemTraining: string | null;
  systemCareerConsulting: string | null;
  systemFlextime: string | null;
  systemTelework: string | null;
  systemShortHours: string | null;
  systemFertilityLeave: string | null;
  systemPaidLeaveHourly: string | null;
  dataTargetPeriod: string | null;
  dataAggregationPoint: string | null;
  dataTargetScope: string | null;
  dataUpdatedAt: string | null;
};

// 認定取得済みかどうか（"認定あり" / "認定段階N" / "受賞" を真とみなす）
export function isCertified(value: string | null): boolean {
  if (!value) return false;
  return /認定あり|認定段階|受賞|選定/.test(value) && !/^受賞なし$/.test(value);
}
