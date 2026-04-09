import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
// ▼ 追加: 権限プロバイダーを読み込む
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

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
        {/* ▼ 追加: AuthProvider で全体を囲む */}
        <AuthProvider>
          <div className="min-h-screen bg-gray-50 flex flex-col text-slate-900">
            <Header />
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}