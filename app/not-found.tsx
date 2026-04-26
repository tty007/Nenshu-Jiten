import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
        <p className="font-numeric text-6xl font-bold text-brand-600">404</p>
        <h1 className="mt-3 text-xl font-bold text-ink">
          お探しのページが見つかりませんでした
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          URLが正しいかご確認ください。
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          トップに戻る
        </Link>
      </main>
      <Footer />
    </>
  );
}
