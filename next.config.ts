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
};

export default nextConfig;
