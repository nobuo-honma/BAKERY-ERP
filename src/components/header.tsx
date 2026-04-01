"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Home, ShoppingCart, Factory, Package, ArrowDownToLine, Truck, Database, BookOpen, ShieldAlert, FileText, Sun, Moon, Beaker } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const { role, setRole } = useAuth();
  const [open, setOpen] = useState(false);

  const menuItems = [
    { title: "ダッシュボード", href: "/", icon: Home },
    { title: "受注管理", href: "/orders", icon: ShoppingCart },
    { title: "製造管理", href: "/production", icon: Factory },
    { title: "在庫管理", href: "/inventory", icon: Package },
    // ▼ 修正2: ここにキープサンプルを追加！
    { title: "キープサンプル", href: "/keep-samples", icon: Beaker },
    { title: "入荷管理", href: "/arrivals", icon: ArrowDownToLine },
    { title: "出荷管理", href: "/shipments", icon: Truck },
    { title: "マスタ管理", href: "/master", icon: Database },
    { title: "HACCP資料", href: "/haccp", icon: FileText },
    { title: "マニュアル", href: "/manual", icon: BookOpen },
  ];

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
          onChange={(e) => setRole(e.target.value as any)}
          className={`text-xs font-bold bg-transparent border-none focus:ring-0 cursor-pointer ${role === 'admin' ? 'text-amber-400' : 'text-slate-300'}`}
        >
          <option value="admin" className="text-black">👑 管理者 (編集可)</option>
          <option value="viewer" className="text-black">👀 閲覧者 (見るだけ)</option>
        </select>
      </div>
    </header>
  );
}