"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, Truck, Calendar, Lock, Loader2, Clock, CheckCircle2, AlertTriangle, FileText, ArrowRight, TrendingUp, TrendingDown, LayoutDashboard, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

type Order = {
  id: string;
  desired_ship_date: string;
  status: string;
  quantity: number;
  customers?: { name: string } | { name: string }[];
  products?: { name: string; variant_name: string };
};

type InventoryStats = {
  shortages: number;
  warnings: number;
  criticalItems: string[];
};

export default function Dashboard() {
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);

  const [inventoryStats, setInventoryStats] = useState<InventoryStats>({ shortages: 0, warnings: 0, criticalItems: [] });
  const [productionProgress, setProductionProgress] = useState({ total: 0, completed: 0, percent: 0 });
  const [shipmentSummary, setShipmentSummary] = useState({ todayCount: 0, totalCs: 0, customerNames: [] as string[] });
  const [upcomingOrders, setUpcomingOrders] = useState<Order[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. 在庫アラート取得
      const { data: items } = await supabase.from("items").select("name, min_qty, item_stocks(quantity)");
      if (items) {
        let shortages = 0;
        let warnings = 0;
        const critical: string[] = [];
        
        items.forEach((item: any) => {
          const qty = item.item_stocks?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
          const min = item.min_qty || 0;
          if (min > 0) {
            if (qty < min) {
              shortages++;
              critical.push(item.name);
            } else if (qty < min * 1.5) {
              warnings++;
            }
          }
        });
        setInventoryStats({ shortages, warnings, criticalItems: critical });
      }

      // 2. 製造進捗取得 (本日分)
      const { data: plans } = await supabase.from("production_plans").select("status, quantity").eq("plan_date", today);
      if (plans) {
        const total = plans.length;
        const completed = plans.filter(p => p.status === 'completed').length;
        setProductionProgress({ 
          total, 
          completed, 
          percent: total > 0 ? Math.round((completed / total) * 100) : 0 
        });
      }

      // 3. 出荷予定取得 (本日分)
      const { data: ships } = await supabase.from("orders").select("quantity, customers(name)").eq("desired_ship_date", today).neq("status", "shipped");
      if (ships) {
        const totalCs = ships.reduce((sum, s) => sum + (s.quantity || 0), 0);
        const names = Array.from(new Set(ships.map(s => {
          const customer = Array.isArray(s.customers) ? s.customers[0] : s.customers;
          return customer?.name;
        }).filter(Boolean))) as string[];
        setShipmentSummary({ todayCount: ships.length, totalCs, customerNames: names });
      }

      // 4. 直近の注文リスト
      const { data: orders } = await supabase
        .from("orders")
        .select("id, desired_ship_date, status, quantity, customers(name), products(name, variant_name)")
        .in("status", ["received", "in_production"])
        .order("desired_ship_date", { ascending: true })
        .limit(6);
      
      if (orders) setUpcomingOrders(orders as any);

    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600 opacity-50" />
        <p className="text-slate-400 font-black tracking-widest text-xs">LOADING REAL-TIME DATA...</p>
      </div>
    );
  }

  return (
    <div className="bg-transparent space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-blue-600" /> ダッシュボード概要
          </h1>
          <p className="text-slate-500 font-bold mt-1">現在の稼働状況と在庫アラートのリアルタイム確認</p>
        </div>
        {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-4 py-1.5 shadow-sm font-bold"><Lock className="w-4 h-4 mr-2" /> 閲覧制限モード</Badge>}
      </div>

      {/* メインステータスカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 在庫アラート */}
        <Card className={`border-none shadow-md overflow-hidden relative ${inventoryStats.shortages > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <div className={`absolute top-0 left-0 w-1 h-full ${inventoryStats.shortages > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex justify-between items-center text-slate-600 uppercase tracking-wider">
              在庫状況のアラート
              <AlertTriangle className={`w-5 h-5 ${inventoryStats.shortages > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-black tracking-tighter ${inventoryStats.shortages > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {inventoryStats.shortages} <span className="text-sm font-normal text-slate-500">品目の不足</span>
            </div>
            <div className="mt-3 space-y-1">
              {inventoryStats.criticalItems.length > 0 ? (
                inventoryStats.criticalItems.slice(0, 2).map((name, i) => (
                  <Badge key={i} variant="outline" className="bg-white/80 border-red-200 text-red-700 font-bold mr-1">{name}</Badge>
                ))
              ) : (
                <p className="text-sm font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> 全品目 安全在庫内で推移中</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 製造進捗 */}
        <Card className="border-none shadow-md bg-white overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex justify-between items-center text-slate-600 uppercase tracking-wider">
              本日の製造進捗
              <Package className="w-5 h-5 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black tracking-tighter text-slate-800">
              {productionProgress.percent}<span className="text-lg font-normal text-slate-400">%</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full mt-4 overflow-hidden border border-slate-50">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: `${productionProgress.percent}%` }} />
            </div>
            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase">予定: {productionProgress.total}件中 {productionProgress.completed}件完了</p>
          </CardContent>
        </Card>

        {/* 本日の出荷 */}
        <Card className="border-none shadow-md bg-white overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex justify-between items-center text-slate-600 uppercase tracking-wider">
              本日の出荷予定
              <Truck className="w-5 h-5 text-indigo-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black tracking-tighter text-slate-800">
              {shipmentSummary.totalCs} <span className="text-sm font-normal text-slate-400">c/s</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {shipmentSummary.customerNames.slice(0, 3).map((name, i) => (
                <Badge key={i} className="bg-indigo-50 text-indigo-700 border-none font-bold text-[10px]">{name}</Badge>
              ))}
              {shipmentSummary.customerNames.length > 3 && <span className="text-[10px] font-bold text-slate-400 self-center">外{shipmentSummary.customerNames.length - 3}件</span>}
              {shipmentSummary.customerNames.length === 0 && <span className="text-xs font-bold text-slate-400 italic">本日予定なし</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 下部: 詳細セクション */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 直近の注文スケジュール */}
        <div className="space-y-4">
          <div className="flex justify-between items-end px-2">
            <h2 className="text-xl font-black text-slate-700 flex items-center gap-2"><Calendar className="w-6 h-6 text-blue-600" /> 直近の出荷スケジュール</h2>
            <Button variant="ghost" size="sm" className="text-blue-600 font-bold text-xs" asChild><a href="/orders">全受注を表示 <ArrowRight className="w-3 h-3 ml-1" /></a></Button>
          </div>
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {upcomingOrders.length > 0 ? upcomingOrders.map(order => {
                const today = new Date(); today.setHours(0,0,0,0);
                const shipDate = new Date(order.desired_ship_date);
                const isLate = shipDate < today;
                return (
                  <div key={order.id} className="p-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{order.id}</span>
                        {order.status === 'in_production' && <Badge className="bg-blue-600 text-white border-none text-[8px] h-4 font-black">製造中</Badge>}
                      </div>
                      <div className="font-black text-slate-800 truncate">
                        {Array.isArray(order.customers) ? order.customers[0]?.name : order.customers?.name}
                      </div>
                      <div className="text-xs font-bold text-slate-500 mt-0.5 truncate">{order.products?.name} ({order.products?.variant_name})</div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className={`text-sm font-black ${isLate ? 'text-red-500' : 'text-slate-800'}`}>
                        {shipDate.toLocaleDateString('ja-JP')}
                      </div>
                      <div className="font-black text-lg text-blue-700 leading-none">{order.quantity} <span className="text-[10px] font-normal text-slate-400">c/s</span></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="p-10 text-center text-slate-400 font-bold bg-slate-50 underline decoration-slate-200 underline-offset-8">進行中の注文はありません</div>
              )}
            </div>
          </Card>
        </div>

        {/* クイック統計 / ショートカット */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-700 flex items-center gap-2 px-2"><TrendingUp className="w-6 h-6 text-emerald-600" /> クイック分析・ショートカット</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 border-slate-200 bg-white hover:border-blue-300 transition-all cursor-pointer group shadow-sm">
              <a href="/inventory" className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Box className="w-5 h-5" />
                </div>
                <div className="font-black text-slate-800">在庫移動履歴</div>
                <p className="text-[10px] font-bold text-slate-500 italic">最新の10件を確認</p>
              </a>
            </Card>
            <Card className="p-4 border-slate-200 bg-white hover:border-indigo-300 transition-all cursor-pointer group shadow-sm">
              <a href="/shipments" className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="font-black text-slate-800">管理票の作成</div>
                <p className="text-[10px] font-bold text-slate-500 italic">本日の出荷分を一括出力</p>
              </a>
            </Card>
            <Card className="p-4 border-slate-100 bg-slate-50/50 col-span-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-slate-800 text-sm italic">稼働効率 (BETA)</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">稼働率ベースシミュレーション</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-emerald-600 tracking-tighter">94.2%</div>
                <div className="text-[9px] font-black text-slate-400 flex items-center justify-end gap-1"><TrendingUp className="w-3 h-3 text-emerald-400" /> +1.2% VS PREV</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}