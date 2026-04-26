import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getAllIndustries } from "@/lib/data/companies";

export const metadata = {
  title: "業界一覧",
};

export default async function IndustriesPage() {
  const industries = await getAllIndustries();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          業界から探す
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          業界を選ぶと、その業界に属する企業の一覧が表示されます。
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
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
      </main>
      <Footer />
    </>
  );
}
