"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, Truck, Calendar, Lock, Loader2, Clock, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = { id: string; planned_ship_date: string; desired_ship_date: string; status: string; quantity: number; customer_order_no?: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_cs: number }; progressPercent?: number; completedCs?: number; completionDateStr?: string; shipAvailableDateStr?: string; shipAvailableDateObj?: Date | null; isFullyPlanned?: boolean; };

// ★追加: まとめたグループの型
type OrderGroup = { groupId: string; customerName: string; customerOrderNo: string; plannedShipDate: string; desiredShipDate: string; status: string; items: Order[]; totalProgress: number; totalCompletedCs: number; totalQuantityCs: number; isLate: boolean; shipWarning: boolean; completionDateStr: string; shipAvailableDateStr: string; };

export default function Dashboard() {
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);

  const [alerts, setAlerts] = useState<{ shortages: string[]; warnings: string[]; total: number }>({ shortages: [], warnings: [], total: 0 });
  const [todayProd, setTodayProd] = useState<{ totalCs: number; detail: string }>({ totalCs: 0, detail: "予定なし" });
  const [todayShip, setTodayShip] = useState<{ totalCs: number; detail: string }>({ totalCs: 0, detail: "予定なし" });
  const [ongoingGroups, setOngoingGroups] = useState<OrderGroup[]>([]);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    try {
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

      const { data: prodData } = await supabase.from("production_plans").select("planned_cs, products(name)").eq("production_date", todayStr);
      if (prodData && prodData.length > 0) {
        const totalCs = prodData.reduce((sum: number, p: any) => sum + p.planned_cs, 0);
        const names = Array.from(new Set(prodData.map((p: any) => p.products?.name)));
        const detail = names.slice(0, 2).join(", ") + (names.length > 2 ? " 他" : "");
        setTodayProd({ totalCs, detail });
      }

      const { data: shipData } = await supabase.from("orders").select("quantity, customers(name), products(unit_per_cs)").eq("planned_ship_date", todayStr).neq("status", "shipped");
      if (shipData && shipData.length > 0) {
        const totalCs = shipData.reduce((sum: number, o: any) => sum + Math.floor(o.quantity / (o.products?.unit_per_cs || 24)), 0);
        const names = Array.from(new Set(shipData.map((o: any) => o.customers?.name)));
        const detail = names.slice(0, 2).join("様, ") + "様" + (names.length > 2 ? " 他" : " 宛");
        setTodayShip({ totalCs, detail });
      }

      const { data: ordersData } = await supabase.from("orders")
        .select("id, planned_ship_date, desired_ship_date, status, quantity, customer_order_no, customers(name), products(name, variant_name, unit_per_cs), production_plans(production_date, planned_cs, status)")
        .in("status", ["received", "in_production"]).order("planned_ship_date", { ascending: true });

      if (ordersData) {
        // ★変更: 注文書の単位(同じ登録タイミング)でグループ化する
        const groups: Record<string, OrderGroup> = {};
        const today = new Date(); today.setHours(0, 0, 0, 0);

        ordersData.forEach((order: any) => {
          // IDから枝番を外してグループキーを作る (例: ORD-20260406-123-0 -> ORD-20260406-123)
          const parts = order.id.split('-');
          const gId = parts.length > 3 ? parts.slice(0, 3).join('-') : order.id;

          const plans = order.production_plans || [];
          const unitPerCs = order.products?.unit_per_cs || 24;
          const completedPieces = plans.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + (p.planned_cs * unitPerCs), 0);
          const plannedPieces = plans.reduce((sum: number, p: any) => sum + (p.planned_cs * unitPerCs), 0);
          const progressPercent = Math.min(100, Math.floor((completedPieces / order.quantity) * 100));
          const isFullyPlanned = plannedPieces >= order.quantity;

          let completionDateStr = "未計画"; let shipAvailableDateStr = "-"; let shipAvailableDateObj = null;
          if (plans.length > 0) {
            const dates = plans.map((p: any) => new Date(p.production_date).getTime());
            const lastProdDate = new Date(Math.max(...dates));
            if (isFullyPlanned) {
              completionDateStr = `${lastProdDate.getFullYear()}/${lastProdDate.getMonth() + 1}/${lastProdDate.getDate()}`;
              const shipAvailable = new Date(lastProdDate); shipAvailable.setDate(shipAvailable.getDate() + 1);
              shipAvailableDateStr = `${shipAvailable.getFullYear()}/${shipAvailable.getMonth() + 1}/${shipAvailable.getDate()}`;
              shipAvailableDateObj = shipAvailable;
            } else { completionDateStr = "一部未計画"; }
          }

          const processedOrder = { ...order, progressPercent, completedCs: Math.floor(completedPieces / unitPerCs), completionDateStr, shipAvailableDateStr, shipAvailableDateObj, isFullyPlanned };

          if (!groups[gId]) {
            const plannedShipDate = new Date(order.planned_ship_date);
            const isLate = plannedShipDate < today;
            groups[gId] = {
              groupId: gId, customerName: order.customers?.name, customerOrderNo: order.customer_order_no,
              plannedShipDate: order.planned_ship_date, desiredShipDate: order.desired_ship_date,
              status: order.status, items: [], totalProgress: 0, totalCompletedCs: 0, totalQuantityCs: 0,
              isLate, shipWarning: false, completionDateStr: "-", shipAvailableDateStr: "-"
            };
          }
          groups[gId].items.push(processedOrder);
        });

        // グループ全体の集計
        Object.values(groups).forEach(g => {
          let totalPieces = 0; let totalCompletedPieces = 0;
          let latestCompletionTime = 0; let allPlanned = true;

          g.items.forEach(item => {
            const unit = item.products?.unit_per_cs || 24;
            totalPieces += item.quantity;
            totalCompletedPieces += (item.completedCs || 0) * unit;
            g.totalQuantityCs += Math.floor(item.quantity / unit);
            g.totalCompletedCs += (item.completedCs || 0);

            if (!item.isFullyPlanned) allPlanned = false;
            if (item.shipAvailableDateObj && item.shipAvailableDateObj.getTime() > latestCompletionTime) {
              latestCompletionTime = item.shipAvailableDateObj.getTime();
              g.completionDateStr = item.completionDateStr || "";
              g.shipAvailableDateStr = item.shipAvailableDateStr || "";
            }
          });

          g.totalProgress = totalPieces > 0 ? Math.min(100, Math.floor((totalCompletedPieces / totalPieces) * 100)) : 0;
          if (!allPlanned) g.completionDateStr = "一部未計画";
          if (latestCompletionTime > 0) {
            const avail = new Date(latestCompletionTime); avail.setHours(0, 0, 0, 0);
            const ship = new Date(g.plannedShipDate); ship.setHours(0, 0, 0, 0);
            if (avail > ship) g.shipWarning = true;
          }
          // グループ内に「製造中」があれば、グループのステータスを製造中にする
          if (g.items.some(i => i.status === 'in_production')) g.status = 'in_production';
        });

        // 10グループだけ表示
        setOngoingGroups(Object.values(groups).slice(0, 10));
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
        <Calendar className="h-5 w-5 text-blue-600" /> 進行中・出荷予定の受注
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {ongoingGroups.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {ongoingGroups.map(group => (
              <div key={group.groupId} className="p-4 sm:p-5 flex flex-col gap-4 hover:bg-slate-50 transition-colors">

                {/* --- 上段：基本情報 --- */}
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 border-b pb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                      {group.groupId.slice(-6)}
                      {group.customerOrderNo && <Badge variant="outline" className="text-[10px] bg-white text-slate-500 py-0"><FileText className="w-3 h-3 mr-1" /> 発注: {group.customerOrderNo}</Badge>}
                    </div>
                    <div className="font-bold text-lg text-slate-800 truncate" title={group.customerName}>{group.customerName}</div>
                  </div>
                  <div className="md:text-right shrink-0 md:w-32 bg-slate-50 md:bg-transparent p-2 rounded-md border md:border-none">
                    <div className="text-[10px] font-bold text-slate-500 md:hidden mb-1">受注総数</div>
                    <div className="font-black text-xl text-blue-700">{group.totalQuantityCs} <span className="text-sm font-normal text-slate-500">c/s</span></div>
                  </div>
                  <div className="shrink-0 md:w-56 md:text-right flex flex-row md:flex-col items-center md:items-end justify-between gap-2">
                    <div>
                      <div className={`text-sm font-bold ${group.isLate ? 'text-red-600' : 'text-blue-800'}`}>出荷予定: {new Date(group.plannedShipDate).toLocaleDateString('ja-JP')} {group.isLate && <span className="block text-[10px] text-red-500 md:mt-0.5 font-bold">(期限超過!)</span>}</div>
                      <div className="text-xs text-slate-500 font-bold mt-1">着予定(納期): {new Date(group.desiredShipDate).toLocaleDateString('ja-JP')}</div>
                      {group.shipWarning && !group.isLate && <span className="block text-[10px] text-amber-600 mt-1 font-bold flex items-center justify-end gap-0.5"><AlertTriangle className="w-3 h-3" />出荷が間に合いません</span>}
                    </div>
                    {group.status === 'in_production' ? <Badge className="bg-blue-100 text-blue-800 border-none px-2 py-0.5 text-xs shadow-sm">製造中あり</Badge> : <Badge className="bg-amber-100 text-amber-800 border-none px-2 py-0.5 text-xs shadow-sm">未処理 (引当待)</Badge>}
                  </div>
                </div>

                {/* --- 中段：明細リスト --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {group.items.map(item => {
                    const unitPerCs = item.products?.unit_per_cs || 24;
                    const cs = Math.floor(item.quantity / unitPerCs);
                    const p = Math.floor((item.quantity % unitPerCs) / 2);
                    return (
                      <div key={item.id} className="bg-white border rounded p-2 text-sm flex justify-between items-center shadow-sm">
                        <div className="font-bold text-slate-700 truncate">{item.products?.name} <span className="text-[10px] font-normal text-slate-500">({item.products?.variant_name})</span></div>
                        <div className="font-black text-slate-800 shrink-0 ml-2">{cs} <span className="text-[10px] font-normal">c/s</span> {p > 0 && <span>{p} <span className="text-[10px] font-normal">p</span></span>}</div>
                      </div>
                    )
                  })}
                </div>

                {/* --- 下段：進捗可視化 --- */}
                <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 mt-2">
                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-end text-xs mb-1.5 font-bold text-slate-600">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> 全体の製造進捗</span>
                      {group.totalProgress === 100 ? (
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 完成済</span>
                      ) : (
                        <span className="text-blue-700">{group.totalCompletedCs} / {group.totalQuantityCs} c/s <span className="text-[10px] font-normal text-slate-500 ml-1">({group.totalProgress}%)</span></span>
                      )}
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div className={`h-full transition-all duration-500 ${group.totalProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${group.totalProgress}%` }}></div>
                    </div>
                  </div>

                  <div className="flex gap-4 md:gap-8 shrink-0 text-xs text-slate-700 w-full md:w-auto">
                    <div className="flex-1 md:flex-none">
                      <div className="text-slate-500 mb-1 font-bold">全製造完了(予定)</div>
                      <div className={`font-black text-sm ${group.completionDateStr === "一部未計画" ? 'text-amber-600' : 'text-slate-800'}`}>{group.completionDateStr}</div>
                    </div>
                    <div className="flex-1 md:flex-none border-l pl-4 md:pl-8 border-slate-200">
                      <div className="text-slate-500 mb-1 font-bold">最短出荷可能日</div>
                      <div className={`font-black text-sm ${group.shipWarning ? 'text-amber-600' : group.completionDateStr !== "一部未計画" ? 'text-purple-700' : 'text-slate-400'}`}>
                        {group.shipAvailableDateStr}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ))}
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