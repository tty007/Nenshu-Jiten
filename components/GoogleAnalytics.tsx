import Script from "next/script";

/**
 * Google Analytics 4 (GA4) のローダ。
 *
 * - 環境変数 `NEXT_PUBLIC_GA_ID`（例: "G-XXXXXXXXXX"）が設定されている場合のみ出力する。
 * - 呼び出し側で analytics consent を確認したうえで `<GoogleAnalytics />` をレンダー
 *   するため、ここでは consent チェックは行わない（layout 側でゲート済み）。
 * - `next/script` の `strategy="afterInteractive"` で TTI 後にロード。
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
