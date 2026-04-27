import Link from "next/link";
import { ArrowRight, BarChart3, FileSearch, Search } from "lucide-react";
import { CompanyCard } from "@/components/CompanyCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MarqueeRow } from "@/components/MarqueeRow";
import { SearchBox } from "@/components/SearchBox";
import { getAllIndustries, getRecentCompanies } from "@/lib/data/companies";

export const revalidate = 3600;

const steps = [
  {
    icon: Search,
    title: "1. 検索する",
    description: "気になる企業を企業名や証券コードで検索。",
  },
  {
    icon: FileSearch,
    title: "2. 企業ページを見る",
    description: "平均年収・勤続年数・働き方の指標を一覧で確認。",
  },
  {
    icon: BarChart3,
    title: "3. 業界平均と比較する",
    description: "「業界の中で相対的にどうか」が一目でわかる。",
  },
];

export default async function HomePage() {
  const [featured, industries] = await Promise.all([
    getRecentCompanies(30),
    getAllIndustries(),
  ]);

  return (
    <>
      <Header showSearch={false} />
      <main>
        <section className="relative overflow-hidden border-b border-surface-border bg-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(30,58,138,0.08),_transparent_60%)]"
          />
          <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
            <h1 className="bg-gradient-to-r from-brand-700 via-brand-500 to-brand-400 bg-clip-text text-3xl font-bold leading-[1.5] tracking-tight text-transparent sm:text-5xl sm:leading-[1.6]">
              有価証券報告書から見る、
              <br className="hidden sm:block" />
              企業のリアルな数字。
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium text-ink sm:text-lg">
              年収・働き方・業績まで。
              <span className="text-ink-muted">気になる企業を、まるごとデータで読み解く。</span>
            </p>
            <div className="mt-8 flex justify-center">
              <SearchBox />
            </div>
            <p className="mt-4 text-base text-ink-subtle">
              例：「積水ハウス」「2217」「ダイドー」
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            使い方
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.title}
                className="rounded-xl border border-surface-border bg-white p-5"
              >
                <s.icon className="h-5 w-5 text-brand-600" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                注目の企業
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                直近で有価証券報告書が更新された企業
              </p>
            </div>
            <Link
              href="/search"
              className="hidden text-sm font-medium text-brand hover:text-brand-700 sm:inline-flex sm:items-center sm:gap-1"
            >
              すべて見る
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6">
            <MarqueeRow>
              {featured.map((c) => (
                <div key={c.id} className="w-80 shrink-0">
                  <CompanyCard company={c} />
                </div>
              ))}
            </MarqueeRow>
          </div>
        </section>

        <section className="border-y border-surface-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              業界から探す
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              業界平均と比較しながら企業を見ていきましょう
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {industries.map((ind) => (
                <li key={ind.code}>
                  <Link
                    href={`/search?industry=${ind.code}`}
                    className="flex items-center justify-between rounded-xl border border-surface-border bg-white px-5 py-4 text-sm font-medium text-ink transition hover:border-brand-100 hover:bg-brand-50/40"
                  >
                    <span>{ind.name}</span>
                    <ArrowRight className="h-4 w-4 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
