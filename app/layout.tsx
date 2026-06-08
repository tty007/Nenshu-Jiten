import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PageViewTracker } from "@/components/PageViewTracker";
import { Toaster } from "@/components/Toaster";
import { CookieConsentBanner } from "@/components/consent/CookieConsentBanner";
import { PolicyReacknowledgementModal } from "@/components/consent/PolicyReacknowledgementModal";
import { getCookieConsent } from "@/lib/consent/cookie-consent";
import { CURRENT_POLICY_VERSION } from "@/lib/profile/consents";
import { shouldShowReacknowledgement } from "@/lib/profile/get-policy-acknowledgement";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "年収辞典 | 有価証券報告書から見る企業のリアルな数字",
    template: "%s | 年収辞典",
  },
  description:
    "金融庁EDINETに提出された有価証券報告書から、企業の平均年収・勤続年数・従業員数・業績を取得し、業界平均と比較できる無料の企業情報メディア。",
  robots: { index: true, follow: true },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cookieConsent, needsReack] = await Promise.all([
    getCookieConsent(),
    shouldShowReacknowledgement(),
  ]);
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${inter.variable}`}>
      <body>
        {children}
        <Toaster />
        {/*
          自社内 PV 集計は個人識別情報を一切持たない（path + date + count のみ、
          IP/UA/ユーザー ID は記録しない）。改正電気通信事業法 27条の12 が要求
          する「外部送信」に該当しないため Cookie 同意は不要。Vercel Analytics
          のように第三者送信を伴うものだけを analytics consent でゲートする。
        */}
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        {cookieConsent.analytics && (
          <>
            <Analytics />
            <GoogleAnalytics />
          </>
        )}
        <CookieConsentBanner initial={cookieConsent} />
        <PolicyReacknowledgementModal
          shouldShow={needsReack}
          policyVersion={CURRENT_POLICY_VERSION}
        />
      </body>
    </html>
  );
}
