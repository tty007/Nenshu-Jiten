import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata = {
  title: "データ出典・更新頻度",
};

export default function DataSourcePage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          データ出典・更新頻度
        </h1>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">データの出典</h2>
          <p>
            本サイトに掲載しているすべての企業情報・財務指標・人事指標は、
            金融庁が運営する電子開示システム
            <a
              href="https://disclosure2.edinet-fsa.go.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              EDINET
            </a>
            に企業自身が提出した有価証券報告書（XBRL形式）から自動取得しています。
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">更新頻度</h2>
          <p>
            日次バッチで EDINET 新着書類を取得し、新しい有価証券報告書が提出された企業のページを更新します。
            業界平均は全件取り込み完了後に再集計されます。
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-ink">
          <h2 className="text-base font-semibold">注意事項</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>平均年収は臨時雇用者を除いた数値です。</li>
            <li>女性管理職比率・残業時間は任意開示項目のため、未開示企業は「データなし」と表示します。</li>
            <li>EDINETの保持期間は過去5年のため、それ以前のデータは取得できません。</li>
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
