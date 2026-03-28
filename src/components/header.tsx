"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
// ▼ 修正1: 'BookOpen' アイコンを追加で読み込む
import { Menu, Home, ShoppingCart, Factory, Package, ArrowDownToLine, Truck, Database, BookOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const menuItems =[
    { title: "ダッシュボード", href: "/", icon: Home },
    { title: "受注管理", href: "/orders", icon: ShoppingCart },
    { title: "製造管理", href: "/production", icon: Factory },
    { title: "在庫管理", href: "/inventory", icon: Package },
    { title: "入荷管理", href: "/arrivals", icon: ArrowDownToLine },
    { title: "出荷管理", href: "/shipments", icon: Truck },
    { title: "マスタ管理", href: "/master", icon: Database },
    // ▼ 修正2: メニューの一番下にマニュアルを追加
    { title: "マニュアル", href: "/manual", icon: BookOpen },
  ];

  const [open, setOpen] = useState(false);

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
            <SheetTitle className="text-white font-bold text-xl">
              メニュー
            </SheetTitle>
            {/* 音声読み上げ専用の説明文 (sr-only で画面からは隠す) */}
            <SheetDescription className="sr-only">
              システム内の各機能へ移動するためのナビゲーションメニューです。
            </SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col p-4 space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-slate-800 transition-colors"
              >
                <item.icon className="h-5 w-5 text-slate-400" />
                <span className="font-medium">{item.title}</span>
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="ml-4 font-bold tracking-wide hidden sm:block">
        災害備蓄用パン 製造・HACCP統合管理
      </div>
      <div className="ml-4 font-bold tracking-wide sm:hidden">
        備蓄パン ERP
      </div>
    </header>
  );
}