import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発時のオーバーレイバッジを非表示(スクリーンショット/デモ用)
  devIndicators: false,
  // Metadata and access checks must finish before HTML is streamed (including real 404s).
  htmlLimitedBots: /.*/,
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
