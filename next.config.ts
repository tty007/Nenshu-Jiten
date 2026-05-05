import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // 企業の公式サイトのスクリーンショット（プロトタイプ用）
      // 本番ではバッチで自前ストレージに保存し、Supabase Storage / R2 等に移行する
      { protocol: "https", hostname: "image.thum.io" },
    ],
  },
  async headers() {
    return [
      {
        // 管理画面の URL（user_id を含む詳細ページ等）が referrer 経由で
        // 外部に流出しないようにする (S3) + 検索エンジンに index されないようにする (S2)。
        source: "/admin/:path*",
        headers: [
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
