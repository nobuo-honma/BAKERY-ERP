import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 静的エクスポートを有効化（GitHub Pagesには必須） */
  output: 'export',

  /* リポジトリ名「BAKERY-ERP」をベースパスに設定 */
  basePath: '/BAKERY-ERP',

  /* 画像最適化の無効化（GitHub Pagesの制限対応） */
  images: {
    unoptimized: true,
  },

  /* URLの末尾にスラッシュを付与（ルーティングの安定化） */
  trailingSlash: true,
};

export default nextConfig;