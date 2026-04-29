import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata = {
  title: "利用規約",
  description:
    "年収辞典の利用条件を定めた利用規約です。本サービスを利用するすべての利用者に適用されます。",
};

const EFFECTIVE_DATE = "2026年4月29日";

export default function TermsOfServicePage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          利用規約
        </h1>
        <p className="mt-4 text-sm text-ink-muted">施行日：{EFFECTIVE_DATE}</p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-ink">
          <p>
            本利用規約（以下「本規約」といいます）は、年収辞典運営チーム（以下「当運営者」といいます）が提供するウェブサービス「年収辞典」（以下「本サービス」といいます）の利用条件を定めるものです。利用者は、本規約に同意のうえ本サービスを利用するものとします。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第1条（適用）</h2>
          <p>
            本規約は、利用者と当運営者との間の本サービス利用に関わる一切の関係に適用されます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第2条（定義）</h2>
          <p>本規約において、以下の各号に掲げる用語はそれぞれ当該各号に定める意味を有します。</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>「利用者」とは、本サービスを利用するすべての者をいいます。</li>
            <li>
              「会員」とは、本規約に同意のうえ本サービスのアカウント登録を行った利用者をいいます。
            </li>
            <li>
              「コンテンツ」とは、本サービスを通じて提供されるテキスト・画像・図表・データその他一切の情報をいいます。
            </li>
          </ol>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第3条（サービスの内容）</h2>
          <p>
            本サービスは、金融庁
            <a
              href="https://disclosure2.edinet-fsa.go.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              EDINET
            </a>
            に各社が提出した有価証券報告書および公的データベースを一次情報として、企業の年収・働き方・業績等の情報を提供します。本サービスは無料で提供されます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第4条（アカウント登録）</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              会員登録を希望する者は、当運営者の定める方法により申請するものとします。
            </li>
            <li>
              当運営者は、登録申請者に以下の事由があると判断した場合、登録を承認しないことがあります。
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>虚偽の情報を申請した場合</li>
                <li>過去に本規約に違反したことがある場合</li>
                <li>その他当運営者が登録を不適当と判断した場合</li>
              </ul>
            </li>
            <li>利用者は、登録情報を最新かつ正確な状態に保つものとします。</li>
          </ol>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第5条（アカウントの管理）</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              利用者は、自己の責任においてアカウント情報（メールアドレス・パスワード等）を適切に管理するものとします。
            </li>
            <li>
              アカウントの不正利用により利用者または第三者に生じた損害について、当運営者は故意または重過失がない限り責任を負いません。
            </li>
          </ol>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第6条（禁止事項）</h2>
          <p>
            利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>
              当運営者または第三者の知的財産権、肖像権、プライバシー、名誉、その他の権利または利益を侵害する行為
            </li>
            <li>他の利用者になりすます行為</li>
            <li>本サービスのサーバーまたはネットワークに過度な負荷をかける行為</li>
            <li>
              本サービスのコンテンツを自動的な手段で大量に取得する行為（スクレイピング、クローリング等。ただし当運営者が別途許可した場合を除きます）
            </li>
            <li>本サービスの運営を妨害する行為</li>
            <li>不正アクセスまたはこれを試みる行為</li>
            <li>
              本サービスを通じて取得した情報を、本規約および法令に反する目的で利用する行為
            </li>
            <li>その他、当運営者が不適切と判断する行為</li>
          </ol>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第7条（知的財産権）</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              本サービスにおいて表示される個別の財務情報・人事情報は、各企業が公的機関に提出した公開情報に由来します。
            </li>
            <li>
              本サービスの編集・整理・表示に関する著作権その他の知的財産権は、当運営者または正当な権利者に帰属します。
            </li>
            <li>
              利用者は、私的利用の範囲を超えて、コンテンツを複製・転載・再配布・販売することはできません。
            </li>
          </ol>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第8条（免責事項）</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              本サービスに掲載する情報は、有価証券報告書および公的データベースから自動取得・自動生成しており、当運営者はその完全性・正確性・最新性を保証しません。
            </li>
            <li>
              AI による企業概要、役職別推定年収その他の推計値は参考情報であり、実際の数値・公式な企業説明とは異なる場合があります。
            </li>
            <li>
              利用者は、投資判断・採用判断・転職判断にあたっては、必ず一次情報を直接ご自身でご確認ください。
            </li>
            <li>
              当運営者は、本サービスの利用または利用不能により利用者に生じた損害について、当運営者の故意または重過失による場合を除き、一切責任を負いません。
            </li>
            <li>
              当運営者は、利用者間または利用者と第三者との間で生じた紛争について、一切関与せず、責任を負いません。
            </li>
          </ol>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">
            第9条（サービスの変更・停止・終了）
          </h2>
          <p>
            当運営者は、利用者への事前通知なく、本サービスの内容を変更し、または本サービスの提供を停止・終了することができます。これにより利用者または第三者に生じた損害について、当運営者は責任を負いません。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第10条（退会）</h2>
          <p>
            会員は、
            <Link href="/mypage" className="text-brand hover:underline">
              マイページ
            </Link>
            の所定の方法により、いつでも退会できます。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第11条（規約の変更）</h2>
          <p>
            当運営者は、必要と判断した場合に、利用者への事前の予告なく本規約を変更できるものとします。変更後の規約は、本サービス上に掲載した時点から効力を生じます。重要な変更については、合理的な方法で利用者に通知します。
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第12条（準拠法・合意管轄）</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              本規約の解釈および本サービスの利用に関しては、日本法を準拠法とします。
            </li>
            <li>
              本サービスに関連して当運営者と利用者との間で紛争が生じた場合、当運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
            </li>
          </ol>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">第13条（お問い合わせ）</h2>
          <p>本規約に関するお問い合わせは、以下までご連絡ください。</p>
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
