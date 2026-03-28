import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 静的エクスポートを有効化 */
  output: 'export',

  /* リポジトリ名に応じたベースパスの設定 */
  // 例: https://<username>.github.io/my-repo/ の場合、'/my-repo' と記述
  basePath: 'https://github.com/nobuo-honma/BAKERY-ERP.git',

  /* 画像最適化の無効化（GitHub PagesのサーバーではNext.jsの画像変換機能が動かないため） */
  images: {
    unoptimized: true,
  },

  /* 末尾のスラッシュを強制（ルーティングの整合性を保つため推奨） */
  trailingSlash: true,
};

export default nextConfig;