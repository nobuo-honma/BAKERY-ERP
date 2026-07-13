import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  reactCompiler: true,
  typescript: {
    // エディタ上やビルド時の型エラーがあっても、強制的に開発サーバーの起動・ビルドを完了させます
    ignoreBuildErrors: true,
  },
};

export default nextConfig;