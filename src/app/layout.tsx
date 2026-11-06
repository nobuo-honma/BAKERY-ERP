import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
// ▼ 追加: 権限プロバイダーを読み込む
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatAssistant } from "@/components/chat-assistant";
import { ThemeProvider } from "@/components/theme-provider";

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
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <div className="app-shell min-h-screen flex flex-col">
              <Header />
              <main className="app-main flex-1 p-4 md:px-8 md:py-10 max-w-screen-2xl mx-auto w-full">
                {children}
              </main>
              <ChatAssistant />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}