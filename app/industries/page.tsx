import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getAllIndustries } from "@/lib/data/companies";
import { getIndustryCompanyCounts } from "@/lib/data/home-stats";
import { formatNumber } from "@/lib/utils";

export const metadata = {
  title: "業界一覧",
};

export default async function IndustriesPage() {
  const [industries, counts] = await Promise.all([
    getAllIndustries(),
    getIndustryCompanyCounts(),
  ]);
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-12 sm:px-8 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          業界から探す
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          業界を選ぶと、その業界に属する企業の一覧が表示されます。
        </p>
        <ul className="mt-8 sm:grid sm:grid-cols-2 sm:gap-x-10">
          {industries.map((ind) => {
            const count = counts[ind.code] ?? 0;
            return (
              <li key={ind.code}>
                <Link
                  href={`/search?industry=${ind.code}`}
                  className="group -mx-3 flex items-center justify-between gap-4 rounded-lg px-3 py-5 text-sm text-ink transition-colors duration-200 hover:bg-brand-50/60 hover:text-brand-700"
                >
                  <span className="origin-left font-medium transition-transform duration-200 group-hover:translate-x-1 group-hover:scale-110">
                    {ind.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-numeric tabular-nums text-ink-muted transition-colors duration-200 group-hover:text-brand-600">
                      {formatNumber(count)}社
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-subtle transition-all duration-200 group-hover:translate-x-1 group-hover:text-brand-600" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}
