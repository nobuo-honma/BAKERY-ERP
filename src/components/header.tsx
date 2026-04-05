"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Home, ShoppingCart, Factory, Package, ArrowDownToLine, Truck, Database, BookOpen, FileText, Sun, Moon, Beaker, Key, LogOut, LogIn, ShieldCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Header() {
  // ★変更: login, logout関数を取得する
  const { role, isLoggedIn, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => setMounted(true), []);

  const menuItems = [
    { title: "ダッシュボード", href: "/", icon: Home },
    { title: "受注管理", href: "/orders", icon: ShoppingCart },
    { title: "製造管理", href: "/production", icon: Factory },
    { title: "在庫管理", href: "/inventory", icon: Package },
    { title: "キープサンプル", href: "/keep-samples", icon: Beaker },
    { title: "入荷管理", href: "/arrivals", icon: ArrowDownToLine },
    { title: "出荷管理", href: "/shipments", icon: Truck },
    { title: "マスタ管理", href: "/master", icon: Database },
    { title: "HACCP資料", href: "/haccp", icon: FileText },
    { title: "マニュアル", href: "/manual", icon: BookOpen },
  ];

  // ★追加: ログインボタンが押された時
  const handleLoginClick = () => {
    setPasswordModalOpen(true);
    setPasswordInput("");
    setPasswordError("");
  };

  // ★追加: パスワード判定処理
  const handlePasswordSubmit = () => {
    // ※今回は簡易的にシステム内にパスワードを設定しています。
    const ADMIN_PASSWORD = "7777"; // ← ★ここの文字がパスワードです。自由に変更してください。

    if (passwordInput === ADMIN_PASSWORD) {
      login(); // ★変更: ログイン処理を呼び出す
      setPasswordModalOpen(false);
    } else {
      setPasswordError("パスワードが違います");
    }
  };

  return (
    <header className="bg-slate-950 text-white h-16 flex items-center px-4 shadow-md sticky top-0 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800 hover:text-white"><Menu className="h-6 w-6" /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-slate-950 text-white border-r-slate-800 p-0">
          <SheetHeader className="p-6 border-b border-slate-800 text-left"><SheetTitle className="text-white font-bold text-xl">メニュー</SheetTitle><SheetDescription className="sr-only">ナビゲーション</SheetDescription></SheetHeader>
          <nav className="flex flex-col p-4 space-y-2">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-slate-800 transition-colors">
                <item.icon className="h-5 w-5 text-slate-400" /><span className="font-medium">{item.title}</span>
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="ml-4 font-bold tracking-wide hidden sm:block">災害備蓄用パン 製造・HACCP統合管理</div>
      <div className="ml-4 font-bold tracking-wide sm:hidden">備蓄パン ERP</div>

      <div className="ml-auto flex items-center gap-3 print:hidden">
        {mounted && (
          <Button
            variant="ghost" size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-full"
            title="テーマを切り替える"
          >
            {theme === "dark" ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-blue-200" />}
          </Button>
        )}

        {/* --- ★変更: ログイン / ログアウト ボタン --- */}
        <div className="flex items-center">
          {isLoggedIn ? (
            // ログイン中（管理者）の表示
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-sm">
              <div className="px-3 py-1.5 flex items-center gap-1.5 bg-slate-800 text-amber-400 font-bold text-xs border-r border-slate-700">
                <ShieldCheck className="h-4 w-4" /> <span className="hidden sm:inline">管理者</span>
              </div>
              <Button
                onClick={logout}
                variant="ghost"
                className="h-8 px-3 rounded-none text-slate-300 hover:bg-slate-700 hover:text-white text-xs font-bold"
              >
                <LogOut className="h-3 w-3 mr-1" /> ログアウト
              </Button>
            </div>
          ) : (
            // 未ログイン（閲覧者）の表示
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:flex items-center gap-1 bg-slate-800/50 border-slate-700 text-slate-400">
                <ShieldAlert className="h-3 w-3" /> 閲覧モード
              </Badge>
              <Button
                onClick={handleLoginClick}
                className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
              >
                <LogIn className="h-3 w-3 mr-1.5" /> ログイン
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-sm bg-white p-6 rounded-xl text-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Key className="w-5 h-5 text-amber-500" /> 管理者としてログイン
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600 font-bold">システムを編集するには、管理者パスワードを入力してください。</p>
            <div>
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                autoFocus
                placeholder="パスワード"
                className="font-bold h-10 border-slate-300"
              />
              {passwordError && <p className="text-xs text-red-600 font-bold mt-2">{passwordError}</p>}
            </div>
          </div>
          <DialogFooter className="mt-6 border-t pt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setPasswordModalOpen(false)} className="flex-1 border border-slate-200">キャンセル</Button>
            <Button onClick={handlePasswordSubmit} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold">ログイン</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}