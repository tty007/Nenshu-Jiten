import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ReopenCookieSettingsButton } from "@/components/consent/CookieConsentBanner";

export const metadata = {
  title: "外部送信に関する公表事項",
  description:
    "改正電気通信事業法 第27条の12 に基づき、年収辞典が利用者の閲覧情報を外部に送信する場合の送信先・送信情報・利用目的・停止方法を公表します。",
};

const EFFECTIVE_DATE = "2026年5月9日";

type Row = {
  recipient: string;
  category: "解析" | "認証/基盤" | "広告（予定）";
  fields: string;
  purpose: string;
  optOut: string;
  policyUrl?: string;
  enabledNow: boolean;
};

const ROWS: Row[] = [
  {
    recipient: "Vercel Inc.（米国）",
    category: "解析",
    fields:
      "Cookie 識別子、IPアドレス、ユーザーエージェント、参照元URL、閲覧URL、表示時刻",
    purpose:
      "ページ閲覧数・利用パターンの匿名集計によるサービス改善（Vercel Analytics）",
    optOut:
      "本ページ末尾の「Cookie設定を変更」から、解析カテゴリを OFF にすると以後送信されません。",
    policyUrl: "https://vercel.com/legal/privacy-policy",
    enabledNow: true,
  },
  {
    recipient: "Supabase, Inc.（米国）",
    category: "認証/基盤",
    fields: "認証セッショントークン、ログイン中ユーザの uid",
    purpose:
      "会員ログイン状態の維持、マイページや会員限定機能の提供（必須・無効化不可）",
    optOut:
      "サービスの基本動作に必要なため停止できません。退会するとアカウントとともに送信が停止します。",
    policyUrl: "https://supabase.com/privacy",
    enabledNow: true,
  },
  {
    recipient: "Google LLC（米国）",
    category: "認証/基盤",
    fields:
      "Google アカウントのメールアドレス（OAuth ログインを利用した場合のみ）",
    purpose: "Google アカウントによる認証",
    optOut:
      "メールアドレス + パスワードによる登録を利用していただくか、退会することで停止できます。",
    policyUrl: "https://policies.google.com/privacy",
    enabledNow: true,
  },
  {
    recipient: "Google LLC / Yahoo! JAPAN 等（予定）",
    category: "広告（予定）",
    fields:
      "Cookie 識別子、IPアドレス、ユーザーエージェント、閲覧URL、属性ハッシュ",
    purpose:
      "本サイト外を含むパーソナライズ広告配信、コンバージョン計測（同意者のみ）",
    optOut:
      "本ページ末尾の「Cookie設定を変更」から広告カテゴリを OFF、もしくはマイページの「通知・広告配信の設定」から「第三者広告ネットワーク」を OFF にすると停止されます。",
    enabledNow: false,
  },
];

export default function ExternalTransmissionPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          外部送信に関する公表事項
        </h1>
        <p className="mt-4 text-sm text-ink-muted">
          施行日：{EFFECTIVE_DATE}
        </p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-ink">
          <p>
            電気通信事業法第27条の12（外部送信規律）に基づき、年収辞典が利用者の端末から、利用者に関する情報を当社以外の第三者に送信する場合の送信先・送信される情報・利用目的・停止手段を以下のとおり公表します。
          </p>
          <p>
            本ページは、Cookie・SDK 等を介して利用者情報が外部送信されるケースを網羅的に開示する目的で設けています。送信先における取扱いは各社のプライバシーポリシーに従います。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">1. 外部送信の一覧</h2>
          <p className="text-xs text-ink-muted">
            「現状」欄が <span className="rounded bg-positive-50 px-1.5 py-0.5 font-medium text-positive-600">有効</span> のものは現在実際に送信されています。
            <span className="ml-2 rounded bg-surface-muted px-1.5 py-0.5 font-medium text-ink-muted">予定</span> のものは将来的な導入時に同意を得たうえで送信を開始します。
          </p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3 font-medium">送信先</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">区分</th>
                  <th className="py-2 pr-3 font-medium">送信される情報</th>
                  <th className="py-2 pr-3 font-medium">利用目的</th>
                  <th className="py-2 pr-3 font-medium">停止方法</th>
                  <th className="whitespace-nowrap py-2 font-medium">現状</th>
                </tr>
              </thead>
              <tbody className="text-ink align-top">
                {ROWS.map((r) => (
                  <tr
                    key={r.recipient}
                    className="border-b border-surface-border"
                  >
                    <td className="py-3 pr-3">
                      {r.policyUrl ? (
                        <a
                          href={r.policyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:underline"
                        >
                          {r.recipient}
                        </a>
                      ) : (
                        r.recipient
                      )}
                    </td>
                    <td className="py-3 pr-3 text-ink-muted">{r.category}</td>
                    <td className="py-3 pr-3">{r.fields}</td>
                    <td className="py-3 pr-3">{r.purpose}</td>
                    <td className="py-3 pr-3 text-ink-muted">{r.optOut}</td>
                    <td className="py-3">
                      {r.enabledNow ? (
                        <span className="rounded bg-positive-50 px-1.5 py-0.5 text-xs font-medium text-positive-600">
                          有効
                        </span>
                      ) : (
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-ink-muted">
                          予定
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">2. 停止方法のまとめ</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              解析・広告 Cookie の停止は{" "}
              <ReopenCookieSettingsButton className="text-brand underline hover:text-brand-700">
                Cookie設定を変更
              </ReopenCookieSettingsButton>{" "}
              から、いつでも切替えできます。
            </li>
            <li>
              会員向けのパーソナライズ広告・メール広告・第三者提供同意は、
              <Link href="/mypage" className="text-brand hover:underline">
                マイページ
              </Link>
              の「通知・広告配信の設定」から個別に切替えできます。
            </li>
            <li>
              ブラウザ側でも、Cookie の受け入れ拒否・サードパーティ Cookie のブロック・「Do Not Track」シグナル送信といった設定により、外部送信を拒否いただけます。
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">3. 改定について</h2>
          <p>
            送信先・送信情報・利用目的に変更が生じた場合は、本ページを更新したうえで、サービス上の合理的な方法で告知します。本ページは{" "}
            <Link href="/privacy-policy" className="text-brand hover:underline">
              プライバシーポリシー
            </Link>{" "}
            の補足資料として位置付けられます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">4. お問い合わせ窓口</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>運営者：年収辞典運営チーム</li>
            <li>
              メール：
              <a
                href="mailto:support@nenshu-jiten.com"
                className="text-brand hover:underline"
              >
                support@nenshu-jiten.com
              </a>
            </li>
          </ul>
        </section>

        <p className="mt-12 text-sm text-ink-muted">以上</p>
      </main>
      <Footer />
    </>
  );
}
