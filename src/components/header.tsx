"use client";

import { Button } from "@/components/ui/button";
import { Home, ShoppingCart, Factory, Package, ArrowDownToLine, Truck, Database, BookOpen, Sun, Moon, Beaker, Key, LogOut, LogIn, ShieldCheck, ShieldAlert, LineChart, Search } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const subscribeToMount = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;

export default function Header() {
  const { isLoggedIn, login, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(subscribeToMount, getClientMounted, getServerMounted);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const menuItems = [
    { title: "ダッシュボード", href: "/", label: "ホーム", icon: Home },
    { title: "受注管理", href: "/orders", label: "受注", icon: ShoppingCart },
    { title: "製造管理", href: "/production", label: "製造", icon: Factory },
    { title: "在庫管理", href: "/inventory", label: "在庫", icon: Package },
    { title: "キープサンプル", href: "/keep-samples", label: "サンプル", icon: Beaker },
    { title: "入荷管理", href: "/arrivals", label: "入荷", icon: ArrowDownToLine },
    { title: "出荷管理", href: "/shipments", label: "出荷", icon: Truck },
    { title: "加熱記録(フジスチーミー)", href: "/fuji-steamy", label: "加熱記録", icon: LineChart },
    { title: "トレース (追跡)", href: "/traceability", label: "トレース", icon: Search },
    { title: "マスタ管理", href: "/master", label: "マスタ", icon: Database },
    { title: "HACCP・衛生管理", href: "/haccp", label: "衛生管理", icon: ShieldCheck },
    { title: "マニュアル", href: "/manual", label: "マニュアル", icon: BookOpen },
  ];

  const handleLoginClick = () => {
    setPasswordModalOpen(true);
    setPasswordInput("");
    setPasswordError("");
  };

  const handlePasswordSubmit = () => {
    const ADMIN_PASSWORD = "7777";

    if (passwordInput === ADMIN_PASSWORD) {
      login();
      setPasswordModalOpen(false);
    } else {
      setPasswordError("パスワードが違います");
    }
  };

  return (
    <header className="app-header sticky top-0 z-50 text-white shadow-md print:static print:shadow-none">
      <div className="flex min-h-14 items-center px-4 sm:px-6">
        <Link href="/" className="font-bold tracking-wide">
          <span className="hidden sm:inline">災害備蓄用パン 製造・HACCP統合管理</span>
          <span className="sm:hidden">備蓄パン ERP</span>
        </Link>

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

        <div className="flex items-center">
          {isLoggedIn ? (
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
      </div>

      <nav aria-label="メインメニュー" className="app-navigation print:hidden">
        <div className="app-navigation-scroll">
          <div className="app-navigation-list">
            {menuItems.map((item) => {
              const isActive = item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  aria-label={item.title}
                  aria-current={isActive ? "page" : undefined}
                  className={`app-nav-link${isActive ? " is-active" : ""}`}
                >
                  <span className="app-nav-icon"><item.icon aria-hidden="true" /></span>
                  <span className="app-nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

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