import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-surface-border bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-base font-semibold text-ink">年収辞典</p>
            <p className="mt-2 text-sm text-ink-muted">
              有価証券報告書の一次情報のみを使った、企業の年収・働き方の比較メディア。
              <br />
              広告なし・完全無料。
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">サービス</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              <li>
                <Link href="/about" className="hover:text-ink">
                  サービスについて
                </Link>
              </li>
              <li>
                <Link href="/data-source" className="hover:text-ink">
                  データ出典・更新頻度
                </Link>
              </li>
              <li>
                <Link href="/industries" className="hover:text-ink">
                  業界一覧
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">規約</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              <li>
                <Link href="/terms-of-service" className="hover:text-ink">
                  利用規約
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-ink">
                  プライバシーポリシー
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">出典</p>
            <p className="mt-2 text-sm text-ink-muted">
              本サイトのデータは
              <a
                href="https://disclosure2.edinet-fsa.go.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                {" "}
                金融庁 EDINET{" "}
              </a>
              に提出された有価証券報告書から取得しています。
            </p>
          </div>
        </div>
        <p className="mt-10 border-t border-surface-border pt-6 text-base text-ink-subtle">
          © {new Date().getFullYear()} 年収辞典.
        </p>
      </div>
    </footer>
  );
}
