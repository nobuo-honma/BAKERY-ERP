"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, Truck, Calendar, Lock, Loader2, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// --- 型定義 ---
type Order = {
  id: string;
  desired_ship_date: string;
  status: string;
  quantity: number;
  customers?: { name: string };
  products?: { name: string; variant_name: string };
  // ★追加: 進捗と予定管理用のプロパティ
  progressPercent?: number;
  completedCs?: number;
  completionDateStr?: string;
  shipAvailableDateStr?: string;
  shipAvailableDateObj?: Date | null;
  isFullyPlanned?: boolean;
};

export default function Dashboard() {
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);

  // 表示用データState
  const [alerts, setAlerts] = useState<{ shortages: string[]; warnings: string[]; total: number }>({ shortages: [], warnings: [], total: 0 });
  const [todayProd, setTodayProd] = useState<{ totalCs: number; detail: string }>({ totalCs: 0, detail: "予定なし" });
  const [todayShip, setTodayShip] = useState<{ totalCs: number; detail: string }>({ totalCs: 0, detail: "予定なし" });
  const [ongoingOrders, setOngoingOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    try {
      // 1. 在庫アラート
      const { data: itemsData } = await supabase.from("items").select("name, safety_stock, item_stocks(quantity)");
      const shortages: string[] = []; const warnings: string[] = [];
      if (itemsData) {
        itemsData.forEach((item: any) => {
          const qty = Array.isArray(item.item_stocks) ? (item.item_stocks[0]?.quantity || 0) : (item.item_stocks?.quantity || 0);
          if (item.safety_stock > 0) {
            if (qty < item.safety_stock) shortages.push(item.name);
            else if (qty < item.safety_stock * 1.5) warnings.push(item.name);
          }
        });
      }
      setAlerts({ shortages, warnings, total: shortages.length + warnings.length });

      // 2. 本日の製造予定
      const { data: prodData } = await supabase.from("production_plans").select("planned_cs, products(name)").eq("production_date", todayStr);
      if (prodData && prodData.length > 0) {
        const totalCs = prodData.reduce((sum: number, p: any) => sum + p.planned_cs, 0);
        const names = Array.from(new Set(prodData.map((p: any) => p.products?.name)));
        const detail = names.slice(0, 2).join(", ") + (names.length > 2 ? " 他" : "");
        setTodayProd({ totalCs, detail });
      }

      // 3. 本日の出荷予定
      const { data: shipData } = await supabase.from("orders").select("quantity, customers(name)").eq("desired_ship_date", todayStr).neq("status", "shipped");
      if (shipData && shipData.length > 0) {
        const totalCs = shipData.reduce((sum: number, o: any) => sum + o.quantity, 0);
        const names = Array.from(new Set(shipData.map((o: any) => o.customers?.name)));
        const detail = names.slice(0, 2).join("様, ") + "様" + (names.length > 2 ? " 他" : " 宛");
        setTodayShip({ totalCs, detail });
      }

      // 4. ★変更: 進行中の受注と「それに紐づく全製造計画」を同時に取得して進捗を計算
      const { data: ordersData } = await supabase.from("orders")
        .select("id, desired_ship_date, status, quantity, customers(name), products(name, variant_name), production_plans(production_date, planned_cs, status)")
        .in("status", ["received", "in_production"])
        .order("desired_ship_date", { ascending: true })
        .limit(10);

      if (ordersData) {
        const processedOrders = ordersData.map((order: any) => {
          const plans = order.production_plans || [];

          // 製造「完了済」のケース数合計
          const completedCs = plans.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.planned_cs, 0);
          // 「計画済(未了含む)」の全ケース数合計
          const plannedCs = plans.reduce((sum: number, p: any) => sum + p.planned_cs, 0);

          // 進捗率 (0〜100%)
          const progressPercent = Math.min(100, Math.floor((completedCs / order.quantity) * 100));
          const isFullyPlanned = plannedCs >= order.quantity; // 全量分の計画が立っているか

          let completionDateStr = "未計画";
          let shipAvailableDateStr = "-";
          let shipAvailableDateObj = null;

          // 計画が1つでも存在する場合、一番最後の製造日を計算
          if (plans.length > 0) {
            const dates = plans.map((p: any) => new Date(p.production_date).getTime());
            const lastProdDate = new Date(Math.max(...dates));
            const formatDate = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

            if (isFullyPlanned) {
              // 全量計画されていれば、その最後の日が「製造完了予定日」になる
              completionDateStr = formatDate(lastProdDate);

              // 出荷可能日は「製造完了から1日のマージン」を持たせた翌日
              const shipAvailable = new Date(lastProdDate);
              shipAvailable.setDate(shipAvailable.getDate() + 1);
              shipAvailableDateStr = formatDate(shipAvailable);
              shipAvailableDateObj = shipAvailable;
            } else {
              // 計画がまだ全量分立っていない場合
              completionDateStr = "一部未計画";
            }
          }

          return { ...order, progressPercent, completedCs, completionDateStr, shipAvailableDateStr, shipAvailableDateObj, isFullyPlanned };
        });
        setOngoingOrders(processedOrders);
      }

    } catch (error) { console.error("Dashboard fetch error:", error); }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center items-center h-[80vh]"><Loader2 className="animate-spin h-10 w-10 text-slate-400" /></div>;

  const shortageText = alerts.shortages.length > 0 ? `不足: ${alerts.shortages.slice(0, 2).join(", ")}${alerts.shortages.length > 2 ? ' 他' : ''}` : "";
  const warningText = alerts.warnings.length > 0 ? `注意: ${alerts.warnings.slice(0, 2).join(", ")}${alerts.warnings.length > 2 ? ' 他' : ''}` : "";

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">ダッシュボード</h1>
        {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className={`${alerts.total > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'} shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className={`text-sm font-bold ${alerts.total > 0 ? 'text-red-800' : 'text-slate-600'}`}>在庫アラート</CardTitle><AlertCircle className={`h-5 w-5 ${alerts.total > 0 ? 'text-red-600' : 'text-slate-400'}`} /></CardHeader>
          <CardContent>
            <div className={`text-3xl font-black ${alerts.total > 0 ? 'text-red-700' : 'text-slate-700'}`}>{alerts.total} <span className="text-lg font-normal">件</span></div>
            <div className={`text-sm mt-2 font-bold ${alerts.total > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {alerts.total > 0 ? <>{shortageText && <div>{shortageText}</div>}{warningText && <div>{warningText}</div>}</> : "すべて安全在庫を満たしています"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-bold text-slate-600">本日の製造予定</CardTitle><Package className="h-5 w-5 text-blue-500" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-blue-900">{todayProd.totalCs} <span className="text-lg font-normal text-slate-600">c/s</span></div><p className="text-sm text-slate-500 mt-2 font-bold truncate" title={todayProd.detail}>{todayProd.detail}</p></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-bold text-slate-600">本日の出荷予定</CardTitle><Truck className="h-5 w-5 text-purple-500" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-purple-900">{todayShip.totalCs} <span className="text-lg font-normal text-slate-600">c/s</span></div><p className="text-sm text-slate-500 mt-2 font-bold truncate" title={todayShip.detail}>{todayShip.detail}</p></CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
        <Calendar className="h-5 w-5 text-blue-600" /> 進行中・未処理の受注
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {ongoingOrders.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {ongoingOrders.map(order => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const shipDate = new Date(order.desired_ship_date);
              const isLate = shipDate < today;

              // ★追加: 出荷可能日が希望納期に間に合わない場合の警告判定
              let isShipmentWarning = false;
              if (order.shipAvailableDateObj) {
                const available = new Date(order.shipAvailableDateObj);
                available.setHours(0, 0, 0, 0);
                if (available > shipDate) isShipmentWarning = true;
              }

              return (
                <div key={order.id} className="p-4 sm:p-5 flex flex-col gap-4 hover:bg-slate-50 transition-colors">

                  {/* --- 上段：基本情報 --- */}
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-500 mb-1">{order.id}</div>
                      <div className="font-bold text-lg text-slate-800 truncate" title={order.customers?.name}>{order.customers?.name}</div>
                      <div className="text-sm font-bold text-slate-600 mt-1 truncate" title={`${order.products?.name} (${order.products?.variant_name})`}>
                        {order.products?.name} <span className="font-normal">({order.products?.variant_name})</span>
                      </div>
                    </div>
                    <div className="md:text-right shrink-0 md:w-32 bg-slate-50 md:bg-transparent p-2 rounded-md border md:border-none">
                      <div className="text-[10px] font-bold text-slate-500 md:hidden mb-1">受注数</div>
                      <div className="font-black text-xl text-blue-700">{order.quantity} <span className="text-sm font-normal text-slate-500">c/s</span></div>
                    </div>
                    <div className="shrink-0 md:w-56 md:text-right flex flex-row md:flex-col items-center md:items-end justify-between gap-2">
                      <div>
                        <div className={`text-sm font-bold ${isLate ? 'text-red-600' : 'text-slate-700'}`}>希望納期: {shipDate.toLocaleDateString('ja-JP')}</div>
                        {isLate && <span className="block text-[10px] text-red-500 md:mt-0.5 font-bold">(期限超過!)</span>}
                        {isShipmentWarning && !isLate && <span className="block text-[10px] text-amber-600 md:mt-0.5 font-bold flex items-center justify-end gap-0.5"><AlertTriangle className="w-3 h-3" />出荷が間に合いません</span>}
                      </div>
                      {order.status === 'in_production' ? <Badge className="bg-blue-100 text-blue-800 border-none px-2 py-0.5 text-xs shadow-sm">製造中あり</Badge> : <Badge className="bg-amber-100 text-amber-800 border-none px-2 py-0.5 text-xs shadow-sm">未処理 (引当待)</Badge>}
                    </div>
                  </div>

                  {/* --- 下段：進捗可視化・日程情報 --- */}
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                    {/* プログレスバー */}
                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-end text-xs mb-1.5 font-bold text-slate-600">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> 製造の進捗</span>
                        {order.progressPercent === 100 ? (
                          <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 完成済</span>
                        ) : (
                          <span className="text-blue-700">{order.completedCs} / {order.quantity} c/s <span className="text-[10px] font-normal text-slate-500 ml-1">({order.progressPercent}%)</span></span>
                        )}
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                        <div className={`h-full transition-all duration-500 ${order.progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${order.progressPercent}%` }}></div>
                      </div>
                    </div>

                    {/* 日程情報 */}
                    <div className="flex gap-4 md:gap-8 shrink-0 text-xs text-slate-700 w-full md:w-auto">
                      <div className="flex-1 md:flex-none">
                        <div className="text-slate-500 mb-1 font-bold">製造完了(予定)</div>
                        <div className={`font-black text-sm ${!order.isFullyPlanned ? 'text-amber-600' : 'text-slate-800'}`}>{order.completionDateStr}</div>
                      </div>
                      <div className="flex-1 md:flex-none border-l pl-4 md:pl-8 border-slate-200">
                        <div className="text-slate-500 mb-1 font-bold">最短出荷可能日</div>
                        <div className={`font-black text-sm ${isShipmentWarning ? 'text-amber-600' : order.isFullyPlanned ? 'text-purple-700' : 'text-slate-400'}`}>
                          {order.shipAvailableDateStr}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 font-bold bg-slate-50">
            現在進行中の受注はありません。
          </div>
        )}
      </div>
    </>
  );
}