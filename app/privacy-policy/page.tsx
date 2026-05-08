import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata = {
  title: "プライバシーポリシー",
  description:
    "年収辞典における利用者の個人情報の取得・利用・管理についての方針を定めたプライバシーポリシーです。",
};

const EFFECTIVE_DATE = "2026年5月9日";
const LAST_REVISED = "2026年5月9日（広告配信・個人関連情報の取扱いに関する条項を追加）";

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
        <p className="mt-1 text-xs text-ink-muted">最終改定：{LAST_REVISED}</p>

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
            <li>ニックネーム（本名以外の任意の表示名）</li>
            <li>パスワード（不可逆な形式でハッシュ化して保管）</li>
          </ul>
          <h3 className="pt-2 text-sm font-semibold text-ink">
            (2) Google アカウント連携によるログインの場合
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Google アカウントのメールアドレス</li>
          </ul>
          <p className="pl-1 text-xs text-ink-muted">
            Google から提供される氏名・プロフィール画像等は本サービスでは保存しません。サイト内の表示には別途設定したニックネームを使用します。
          </p>
          <h3 className="pt-2 text-sm font-semibold text-ink">
            (3) 利用者がマイページで任意に登録できる属性情報
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>生まれ年（年単位のみ。誕生日は収集しません）</li>
            <li>性別（男性／女性／その他／回答しない の自己申告）</li>
            <li>都道府県（市区町村以下は収集しません）</li>
            <li>キャリアステータス（学生／社会人）</li>
            <li>年収レンジ（所定の段階から選択）</li>
          </ul>
          <p className="pl-1 text-xs text-ink-muted">
            上記 (3) はすべて<strong className="font-semibold">任意</strong>であり、未入力でも本サービスを利用できます。
          </p>
          <h3 className="pt-2 text-sm font-semibold text-ink">
            (4) サービス利用に伴って自動的に取得される情報
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
            <li>
              広告・マーケティング情報の表示および配信（同意した利用者に限ります）
            </li>
            <li>
              利用者属性に基づく記事・広告のパーソナライズ（同意した利用者に限ります）
            </li>
            <li>
              提携事業者からの製品・サービス情報の電子メールによる提供（同意した利用者に限ります）
            </li>
          </ul>
          <p className="text-xs text-ink-muted">
            広告・マーケティング目的の利用は、いずれも会員登録時または<Link
              href="/mypage"
              className="text-brand hover:underline"
            >
              マイページ
            </Link>
            の「通知・広告配信の設定」での同意を要件とし、同意がない場合は行いません。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">3. 第三者への提供</h2>
          <p>
            当運営者は、法令に基づく場合または利用者本人の同意がある場合を除き、取得した個人情報を第三者に提供しません。
          </p>
          <p>
            利用者本人の同意は、会員登録時のチェックボックスまたは
            <Link href="/mypage" className="text-brand hover:underline">マイページ</Link>
            の「通知・広告配信の設定」画面（以下「同意管理画面」といいます）にて取得します。同意の撤回も同画面からいつでも行うことができ、撤回の意思表示を受け付けた時点以降、当該目的での提供を停止します。撤回前の提供分の取り扱いについては、提供先における取扱いに従います。
          </p>
          <p>
            個人関連情報（Cookie 等の識別子に紐付く閲覧履歴等で、それ単独では個人を特定できない情報）を第三者に提供する場合で、提供先において個人データとして取得することが想定されるときは、個人情報保護法第31条に基づく同意を別途取得します。
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
                  <td className="py-2 pr-4">
                    アプリケーションホスティングおよびアクセス解析（匿名集計のみ。個人を特定する情報は送信されません）
                  </td>
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
                <tr className="border-b border-surface-border">
                  <td className="py-2 pr-4">OpenAI, L.L.C.</td>
                  <td className="py-2 pr-4">
                    企業概要文の自動生成（公開済みの企業情報のみを送信し、利用者の個人情報は送信しません）
                  </td>
                  <td className="py-2">米国</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">経済産業省 gBizINFO</td>
                  <td className="py-2 pr-4">
                    企業基本情報（設立年月日・公式サイト・資本金・法人番号等）の取得（公開済みの法人情報のみを照会し、利用者の個人情報は送信しません）
                  </td>
                  <td className="py-2">日本</td>
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
          <p>
            広告配信およびパーソナライズに用いる Cookie・類似技術については、本ポリシー第7条をご確認ください。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">
            6. 個人関連情報（Cookie 等）の取扱い
          </h2>
          <p>
            本サービスは、Cookie・IP アドレス・ユーザーエージェント・閲覧履歴その他の個人関連情報を、以下の目的で取得・利用することがあります。
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>本サービスの利用状況の解析および機能改善</li>
            <li>
              広告配信および本サービス内コンテンツのパーソナライズ（パーソナライズ広告に同意した利用者に限ります）
            </li>
            <li>
              第三者の広告配信事業者を経由した広告配信（第三者広告ネットワークに同意した利用者に限ります）
            </li>
          </ul>
          <p>
            これらの情報を第三者に送信する場合は、改正電気通信事業法第27条の12に基づき、外部送信先・送信される情報・利用目的等を本ポリシーまたは別途設ける外部送信規律告知ページにおいて公表します。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">
            7. 広告配信に関する利用目的および撤回手段
          </h2>
          <p>
            本サービスは、利用者が同意した場合に限り、以下の方法で広告を配信または表示することがあります。
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              <strong className="font-semibold text-ink">
                サイト内のオンサイト広告：
              </strong>
              利用者が任意で登録した属性情報（年代・キャリアステータス・年収レンジ等）に基づき、本サービス内に表示する広告や記事レコメンドを最適化します。属性は当運営者の管理サーバ内でのみ利用し、第三者に送信しません。
            </li>
            <li>
              <strong className="font-semibold text-ink">
                電子メールによる広告配信：
              </strong>
              特定電子メール法に基づき事前同意のうえ、ニュースレターおよび提携事業者からの製品・サービス情報を送信します。各メール末尾の配信停止リンクからいつでも停止できます。
            </li>
            <li>
              <strong className="font-semibold text-ink">
                第三者広告ネットワーク：
              </strong>
              Google LLC 等の広告配信事業者に Cookie 識別子等を送信し、本サービス外でも利用者の関心に沿った広告を表示できるようにします。送信先における取扱いは各事業者のポリシーに従います。
            </li>
            <li>
              <strong className="font-semibold text-ink">
                属性データの提携先への提供：
              </strong>
              個人を特定できない形式に集約・仮名化した属性情報を、調査・分析事業者へ提供することがあります。提供前に利用目的・提供先カテゴリを明示します。
            </li>
          </ul>
          <p>
            利用者は、上記いずれの利用についても{" "}
            <Link href="/mypage" className="text-brand hover:underline">
              マイページ
            </Link>{" "}
            の同意管理画面から個別に ON / OFF を切り替えることができ、本サービスの利用に支障は生じません。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">8. 安全管理措置</h2>
          <p>
            当運営者は、取得した個人情報の漏えい・滅失・毀損の防止その他の安全管理のため、必要かつ適切な措置（通信の暗号化、アクセス権限の制限、パスワードのハッシュ化保管等）を講じます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">
            9. 保有個人データの開示・訂正・利用停止等
          </h2>
          <p>
            利用者は、当運営者に対し、自己の保有個人データの開示・訂正・追加・削除・利用停止等の請求を行うことができます。請求は本ポリシー末尾のお問い合わせ窓口までご連絡ください。本人確認のうえ、法令の定めに従い遅滞なく対応します。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">10. 退会</h2>
          <p>
            利用者は<Link href="/mypage" className="text-brand hover:underline">マイページ</Link>よりいつでも退会できます。退会後は、関連法令の定める保管義務がある場合を除き、当運営者は速やかにアカウントおよび紐づく個人情報を削除します。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">
            11. 個人情報保護法上の事項の開示
          </h2>
          <p>
            本サービスは個人により運営されています。個人情報保護法第32条1項に基づく個人情報取扱事業者の氏名・住所等の事項については、本人からの請求があった場合、本ポリシー末尾のお問い合わせ窓口より遅滞なく開示いたします。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">12. 本ポリシーの改定</h2>
          <p>
            当運営者は、法令の改正または本サービスの内容変更に伴い、本ポリシーを改定することがあります。重要な変更がある場合は、本サービス上で告知します。改定後の本ポリシーは、本サービス上に掲載した時点から効力を生じます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">13. お問い合わせ窓口</h2>
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
