"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Home, ShoppingCart, Factory, Package, ArrowDownToLine, Truck, Database, BookOpen, ShieldAlert, FileText, Beaker, Key } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function Header() {
  const { role, setRole } = useAuth();
  const [open, setOpen] = useState(false);

  // ★追加: パスワード入力モーダル用のState
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

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

  // ★追加: 権限プルダウンが操作された時の処理
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRole = e.target.value;
    if (selectedRole === "admin") {
      // 管理者を選ぼうとしたら、パスワードモーダルを開く
      setPasswordModalOpen(true);
      setPasswordInput("");
      setPasswordError("");
    } else {
      // 閲覧者に戻す時はパスワード不要で即時変更
      setRole("viewer");
    }
  };

  // ★追加: パスワードの判定処理
  const handlePasswordSubmit = () => {
    // ※今回は簡易的にシステム内にパスワードを設定しています。
    const ADMIN_PASSWORD = "7777"; // ← ★ここの文字がパスワードです。自由に変更してください。

    if (passwordInput === ADMIN_PASSWORD) {
      setRole("admin");
      setPasswordModalOpen(false);
    } else {
      setPasswordError("パスワードが違います");
    }
  };

  return (
    <header className="bg-slate-900 text-white h-16 flex items-center px-4 shadow-md sticky top-0 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800 hover:text-white">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-slate-900 text-white border-r-slate-800 p-0">
          <SheetHeader className="p-6 border-b border-slate-800 text-left">
            <SheetTitle className="text-white font-bold text-xl">メニュー</SheetTitle>
            <SheetDescription className="sr-only">ナビゲーション</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col p-4 space-y-2">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-slate-800 transition-colors">
                <item.icon className="h-5 w-5 text-slate-400" />
                <span className="font-medium">{item.title}</span>
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="ml-4 font-bold tracking-wide hidden sm:block">災害備蓄用パン 製造・HACCP統合管理</div>
      <div className="ml-4 font-bold tracking-wide sm:hidden">備蓄パン ERP</div>

      {/* 右上の権限切り替えスイッチ */}
      <div className="ml-auto flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-700 print:hidden">
        <ShieldAlert className={`h-4 w-4 hidden sm:block ${role === 'admin' ? 'text-amber-400' : 'text-slate-400'}`} />
        <select
          value={role}
          onChange={handleRoleChange} // ★変更: handleRoleChange を呼び出す
          className={`text-xs font-bold bg-transparent border-none focus:ring-0 cursor-pointer ${role === 'admin' ? 'text-amber-400' : 'text-slate-300'}`}
        >
          <option value="admin" className="text-black">👑 管理者 (編集可)</option>
          <option value="viewer" className="text-black">👀 閲覧者 (見るだけ)</option>
        </select>
      </div>

      {/* --- ★追加: パスワード入力ダイアログ --- */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-sm bg-white p-6 rounded-xl text-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Key className="w-5 h-5 text-amber-500" /> 管理者ロックの解除
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600 font-bold">管理者モードに切り替えるには、パスワードを入力してください。</p>
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
            <Button onClick={handlePasswordSubmit} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold">ロック解除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}