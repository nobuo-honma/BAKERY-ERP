import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 先ほど作った Header 部品を読み込む
import Header from "@/components/header";

const inter = Inter({ subsets: ["latin"] });

// ここはサーバー側で処理されるSEOやタイトル設定
export const metadata: Metadata = {
  title: "備蓄パン 製造・HACCP管理システム",
  description: "災害備蓄用パンのERPシステム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50 flex flex-col text-slate-900">
          
          {/* 切り出したヘッダー部品をここに配置 */}
          <Header />

          {/* 各ページのメインコンテンツ */}
          <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}