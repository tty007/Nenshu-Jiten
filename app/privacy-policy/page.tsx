import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata = {
  title: "プライバシーポリシー",
  description:
    "年収辞典における利用者の個人情報の取得・利用・管理についての方針を定めたプライバシーポリシーです。",
};

const EFFECTIVE_DATE = "2026年4月29日";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          プライバシーポリシー
        </h1>
        <p className="mt-4 text-sm text-ink-muted">
          施行日：{EFFECTIVE_DATE}
        </p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-ink">
          <p>
            「年収辞典」（以下「本サービス」といいます）の運営者である年収辞典運営チーム（以下「当運営者」といいます）は、本サービスを通じて取得する利用者の個人情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">1. 取得する情報</h2>
          <p>本サービスでは、以下の情報を取得することがあります。</p>
          <h3 className="pt-2 text-sm font-semibold text-ink">
            (1) 会員登録時に利用者が提供する情報
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>メールアドレス</li>
            <li>表示名</li>
            <li>パスワード（不可逆な形式でハッシュ化して保管）</li>
          </ul>
          <h3 className="pt-2 text-sm font-semibold text-ink">
            (2) Google アカウント連携によるログインの場合
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Google アカウントのメールアドレス</li>
            <li>
              プロフィール情報（氏名、プロフィール画像URL等のうち Google から提供される範囲）
            </li>
          </ul>
          <h3 className="pt-2 text-sm font-semibold text-ink">
            (3) サービス利用に伴って自動的に取得される情報
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>アクセスログ（IPアドレス、ユーザーエージェント、参照元URL、アクセス日時）</li>
            <li>認証セッションCookie</li>
            <li>利用状況に関する統計情報</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">2. 利用目的</h2>
          <p>取得した情報は、以下の目的のために利用します。</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>会員認証および本人確認</li>
            <li>マイページその他の会員機能の提供</li>
            <li>利用者からのお問い合わせへの対応</li>
            <li>本サービスの不正利用防止、安全性の確保、システム保守</li>
            <li>アクセス解析および統計情報の作成によるサービス改善</li>
            <li>重要なお知らせやサービス変更の通知</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">3. 第三者への提供</h2>
          <p>
            当運営者は、法令に基づく場合または利用者本人の同意がある場合を除き、取得した個人情報を第三者に提供しません。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">
            4. 業務委託（外部サービスの利用）
          </h2>
          <p>
            本サービスは、運営にあたり以下の外部サービスを利用しています。これらの提供事業者は当運営者と業務委託の関係にあり、利用目的の範囲内で個人情報を取り扱います。当運営者は、各事業者のプライバシーポリシーおよびセキュリティ基準を確認のうえ利用しています。
          </p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-4 font-medium">提供事業者</th>
                  <th className="py-2 pr-4 font-medium">用途</th>
                  <th className="py-2 font-medium">所在国</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                <tr className="border-b border-surface-border">
                  <td className="py-2 pr-4">Supabase, Inc.</td>
                  <td className="py-2 pr-4">認証基盤・データベース</td>
                  <td className="py-2">米国</td>
                </tr>
                <tr className="border-b border-surface-border">
                  <td className="py-2 pr-4">Vercel Inc.</td>
                  <td className="py-2 pr-4">アプリケーションホスティング</td>
                  <td className="py-2">米国</td>
                </tr>
                <tr className="border-b border-surface-border">
                  <td className="py-2 pr-4">Google LLC</td>
                  <td className="py-2 pr-4">Google アカウントによる認証（OAuth）</td>
                  <td className="py-2">米国</td>
                </tr>
                <tr className="border-b border-surface-border">
                  <td className="py-2 pr-4">Resend, Inc.</td>
                  <td className="py-2 pr-4">システムメール送信</td>
                  <td className="py-2">米国</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">OpenAI, L.L.C.</td>
                  <td className="py-2 pr-4">
                    企業概要文の自動生成（公開済みの企業情報のみを送信し、利用者の個人情報は送信しません）
                  </td>
                  <td className="py-2">米国</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">5. Cookie 等の利用</h2>
          <p>
            本サービスは、ログインセッションの維持およびアクセス状況の把握のために
            Cookie を使用します。利用者はブラウザの設定により Cookie を無効化できますが、その場合は会員機能の一部を利用できないことがあります。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">6. 安全管理措置</h2>
          <p>
            当運営者は、取得した個人情報の漏えい・滅失・毀損の防止その他の安全管理のため、必要かつ適切な措置（通信の暗号化、アクセス権限の制限、パスワードのハッシュ化保管等）を講じます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">
            7. 保有個人データの開示・訂正・利用停止等
          </h2>
          <p>
            利用者は、当運営者に対し、自己の保有個人データの開示・訂正・追加・削除・利用停止等の請求を行うことができます。請求は本ポリシー末尾のお問い合わせ窓口までご連絡ください。本人確認のうえ、法令の定めに従い遅滞なく対応します。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">8. 退会</h2>
          <p>
            利用者は<Link href="/mypage" className="text-brand hover:underline">マイページ</Link>よりいつでも退会できます。退会後は、関連法令の定める保管義務がある場合を除き、当運営者は速やかにアカウントおよび紐づく個人情報を削除します。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">
            9. 個人情報保護法上の事項の開示
          </h2>
          <p>
            本サービスは個人により運営されています。個人情報保護法第32条1項に基づく個人情報取扱事業者の氏名・住所等の事項については、本人からの請求があった場合、本ポリシー末尾のお問い合わせ窓口より遅滞なく開示いたします。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">10. 本ポリシーの改定</h2>
          <p>
            当運営者は、法令の改正または本サービスの内容変更に伴い、本ポリシーを改定することがあります。重要な変更がある場合は、本サービス上で告知します。改定後の本ポリシーは、本サービス上に掲載した時点から効力を生じます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">11. お問い合わせ窓口</h2>
          <p>本ポリシーに関するお問い合わせは、以下の窓口までご連絡ください。</p>
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
