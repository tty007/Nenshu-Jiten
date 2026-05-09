/**
 * 同意の種別と表示メタデータ。
 * DB の user_consents.consent_type の check 制約と完全一致させる。
 *
 * 表示文言は UI と監査ログ・告知ページで再利用するため、ここを唯一の出典とする。
 */

export const CONSENT_TYPES = [
  "marketing_email",
  "personalized_ads",
  "third_party_advertising",
  "data_sharing",
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export type ConsentMeta = {
  type: ConsentType;
  label: string;
  description: string;
  /** 既定で OFF（任意）か、説明上の必須レベルか。今のところ全て任意 */
  required: boolean;
};

export const CONSENT_META: Record<ConsentType, ConsentMeta> = {
  marketing_email: {
    type: "marketing_email",
    label: "メールでのお知らせ・広告配信を受け取る",
    description:
      "新着記事やキャンペーン、提携企業からの製品・サービス情報をメールでお届けします。配信停止はいつでも可能です。",
    required: false,
  },
  personalized_ads: {
    type: "personalized_ads",
    label: "サイト内のパーソナライズ広告を許可する",
    description:
      "登録いただいた属性（年代・職業・年収バンド等）をもとに、サイト内に表示する広告や記事レコメンドを最適化します。同意しない場合は属性を使わない一般広告のみを表示します。",
    required: false,
  },
  third_party_advertising: {
    type: "third_party_advertising",
    label: "第三者広告ネットワークでの広告配信を許可する",
    description:
      "Google Ads など外部の広告事業者に Cookie 等の識別子を送信し、当サイト外でも関連性の高い広告を表示できるようにします。",
    required: false,
  },
  data_sharing: {
    type: "data_sharing",
    label: "属性データの第三者提供を許可する",
    description:
      "個人を特定できない形に集約・仮名化した属性情報を、提携先（DMP・調査事業者）へ提供することがあります。提供前に利用目的を必ず明示します。",
    required: false,
  },
};

export type ConsentState = Record<ConsentType, boolean>;

/**
 * 明示的な同意レコードがないユーザに対して適用する既定値。
 *
 * - personalized_ads は ON：プライバシーポリシーで「同意した利用者に対して
 *   属性ベースのレコメンドを行う」旨を開示しており、サーバ内処理に閉じる
 *   ため、黙示の同意で運用可能（個情法 16・17 条の利用目的内）。
 * - 他 3 種は OFF：
 *     marketing_email         …特定電子メール法でオプトイン必須
 *     third_party_advertising …個情法 31 条（個人関連情報の第三者提供）の同意必要
 *     data_sharing            …個情法 27 条（第三者提供）の同意必要
 *
 * いずれもマイページから即時撤回・追加同意できる前提でこの既定値を採用する。
 */
export const DEFAULT_CONSENT_STATE: ConsentState = {
  marketing_email: false,
  personalized_ads: true,
  third_party_advertising: false,
  data_sharing: false,
};

/**
 * プライバシーポリシーの版（同意取得時の証跡）。
 * ポリシー本文を改訂したら必ずバンプし、再同意フローを発火させる。
 */
export const CURRENT_POLICY_VERSION = "2026-05-09";
