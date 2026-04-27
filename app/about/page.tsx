import Link from "next/link";
import { ArrowRight, BarChart3, Database, FileSearch } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata = {
  title: "サービスについて",
  description:
    "年収辞典は、金融庁EDINETの有価証券報告書をもとに、企業の年収・働き方・業績を比較できる無料・広告なしの情報サービスです。",
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          サービスについて
        </h1>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-ink">
          <p>
            「年収辞典」は、金融庁
            <a
              href="https://disclosure2.edinet-fsa.go.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              EDINET
            </a>
            に各社が提出した有価証券報告書を一次情報として、企業の平均年収・勤続年数・働き方・業績を比較できる無料・広告なしの情報サービスです。
          </p>
          <p>
            就職・転職を検討している人が、口コミではなく企業自身が公的に開示した数字をベースに比較・検討できることを目指しています。
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-ink">何ができるか</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Feature
              icon={FileSearch}
              title="企業を検索"
              description="企業名・証券コード・EDINETコードで検索。業界フィルタも可能。"
            />
            <Feature
              icon={BarChart3}
              title="数字で比較"
              description="平均年収・勤続年数・従業員数・業績を、業界平均と並べて確認。"
            />
            <Feature
              icon={Database}
              title="一次情報のみ"
              description="厚労省「女性活躍推進企業データベース」も取り込み、働き方の実態に迫る。"
            />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-ink">データの種類</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink">
            <li className="flex gap-2">
              <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
              <span>
                <strong>有価証券報告書から取得</strong>：平均年収、平均年齢、平均勤続年数、従業員数、売上高・営業利益・経常利益・純利益
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
              <span>
                <strong>女性活躍推進企業データベースから取得</strong>：月平均残業時間、有給休暇取得率、男女別育休取得率、女性管理職比率、男女の賃金差、各種認定（くるみん／えるぼし等）
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
              <span>
                <strong>役職別の推定年収</strong>：厚労省「賃金構造基本統計調査」と各社の平均年収から逆算した参考値
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
              <span>
                <strong>AI による企業概要</strong>：有価証券報告書の事業内容セクションを自動要約
              </span>
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-ink">運営方針</h2>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>広告は掲載しません。</li>
            <li>有料プランや会員登録はありません。</li>
            <li>主観的なランキングや独自評価は行いません。</li>
            <li>口コミや人事評価のような情報は扱いません（将来的に検討する可能性あり）。</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-ink">免責事項</h2>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>掲載情報は有価証券報告書および公的データベースを元に自動生成しており、最新性・正確性を完全に保証するものではありません。</li>
            <li>役職別年収やAI概要は推計・自動要約であり、実額や正式な企業説明ではありません。</li>
            <li>投資判断・採用判断には、必ず一次情報を直接ご確認ください。</li>
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap gap-3 text-sm">
          <Link
            href="/search"
            className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            企業を検索する
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/data-source"
            className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-4 py-2 font-medium text-ink hover:bg-surface-muted"
          >
            データ出典の詳細
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-5">
      <Icon className="h-5 w-5 text-brand-600" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
    </div>
  );
}
