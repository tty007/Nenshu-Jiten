import { z } from "zod";

export const PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export const GENDERS = ["male", "female", "other", "no_answer"] as const;
export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  male: "男性",
  female: "女性",
  other: "その他",
  no_answer: "回答しない",
};

export const CAREER_STATUSES = ["student", "working"] as const;
export const CAREER_STATUS_LABELS: Record<(typeof CAREER_STATUSES)[number], string> = {
  student: "学生",
  working: "社会人",
};

export const SALARY_BANDS = [
  "under_300",
  "300_400",
  "400_500",
  "500_600",
  "600_700",
  "700_800",
  "800_900",
  "900_1000",
  "1000_1200",
  "1200_1500",
  "1500_2000",
  "2000_3000",
  "over_3000",
] as const;

export const SALARY_BAND_LABELS: Record<(typeof SALARY_BANDS)[number], string> = {
  under_300: "300万円未満",
  "300_400": "300〜400万円",
  "400_500": "400〜500万円",
  "500_600": "500〜600万円",
  "600_700": "600〜700万円",
  "700_800": "700〜800万円",
  "800_900": "800〜900万円",
  "900_1000": "900〜1000万円",
  "1000_1200": "1000〜1200万円",
  "1200_1500": "1200〜1500万円",
  "1500_2000": "1500〜2000万円",
  "2000_3000": "2000〜3000万円",
  over_3000: "3000万円以上",
};

const currentYear = new Date().getFullYear();

const optionalString = (v: FormDataEntryValue | null) =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

const optionalNumber = (v: FormDataEntryValue | null) => {
  const s = optionalString(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : s; // 数値化失敗時は文字列のまま渡し z 側で reject
};

export const userProfileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, "1文字以上で入力してください")
    .max(30, "ニックネームは30文字以内で入力してください")
    .nullable(),
  birthYear: z
    .number()
    .int()
    .min(1920, "1920年以降を入力してください")
    .max(currentYear - 10, `${currentYear - 10}年以前を入力してください`)
    .nullable(),
  gender: z.enum(GENDERS).nullable(),
  prefecture: z.enum(PREFECTURES).nullable(),
  careerStatus: z.enum(CAREER_STATUSES).nullable(),
  salaryBand: z.enum(SALARY_BANDS).nullable(),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;

export function parseUserProfileFormData(formData: FormData) {
  return userProfileSchema.safeParse({
    nickname: optionalString(formData.get("nickname")),
    birthYear: optionalNumber(formData.get("birthYear")),
    gender: optionalString(formData.get("gender")),
    prefecture: optionalString(formData.get("prefecture")),
    careerStatus: optionalString(formData.get("careerStatus")),
    salaryBand: optionalString(formData.get("salaryBand")),
  });
}
