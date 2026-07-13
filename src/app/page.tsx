"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, Truck, Calendar, Lock, Loader2, Clock, CheckCircle2, AlertTriangle, FileText, Trash2, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

type InventoryItem = {
  name: string;
  safety_stock: number;
  item_stocks?: Array<{ quantity: number | null }> | { quantity: number | null } | null;
};

type ProductionPlanRow = {
  planned_cs: number;
  products?: { name?: string | null } | null;
};

type OrderRow = {
  id: string;
  planned_ship_date: string;
  desired_ship_date: string;
  status: string;
  quantity: number;
  customer_order_no: string;
  customers?: { name?: string | null } | null;
  products?: { name?: string | null; variant_name?: string | null; unit_per_cs?: number | null } | null;
  production_plans?: Array<{ production_date: string; planned_cs: number; status: string }> | null;
};

type ProductStockRow = {
  lot_code: string;
  total_pieces: number;
  expiry_date: string;
  products?: { name?: string | null; unit_per_cs?: number | null } | null;
};

type KeepSampleRow = {
  management_no: string;
  saved_quantity: number;
  used_quantity: number;
  expiry_date: string;
  products?: { name?: string | null } | null;
};

type OrderGroup = {
  groupId: string;
  customerName: string;
  customerOrderNo: string;
  plannedShipDate: string;
  desiredShipDate: string;
  status: string;
  items: OrderRow[];
  totalProgress: number;
  totalCompletedCs: number;
  totalQuantityCs: number;
  isLate: boolean;
  shipWarning: boolean;
  completionDateStr: string;
  shipAvailableDateStr: string;
};

export default function Dashboard() {
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);

  const [alerts, setAlerts] = useState<{ shortages: string[]; warnings: string[]; total: number }>({ shortages: [], warnings: [], total: 0 });
  const [todayProd, setTodayProd] = useState<{ totalCs: number; detail: string }>({ totalCs: 0, detail: "予定なし" });
  const [todayShip, setTodayShip] = useState<{ totalCs: number; detail: string }>({ totalCs: 0, detail: "予定なし" });
  const [ongoingGroups, setOngoingGroups] = useState<OrderGroup[]>([]);

  // ★追加: アラート用State
  const [expiringProducts, setExpiringProducts] = useState<ProductStockRow[]>([]); // 賞味期限間近
  const [expiredSamples, setExpiredSamples] = useState<KeepSampleRow[]>([]); // 廃棄対象サンプル
  const [missingHaccp, setMissingHaccp] = useState<string[]>([]); // 未入力のHACCP記録

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    try {
      // 1. 原材料アラート
      const { data: itemsData } = await supabase.from("items").select("name, safety_stock, item_stocks(quantity)");
      const shortages: string[] = []; const warnings: string[] = [];
      if (itemsData) {
        itemsData.forEach((item: InventoryItem) => {
          const qty = Array.isArray(item.item_stocks) ? (item.item_stocks[0]?.quantity || 0) : (item.item_stocks?.quantity || 0);
          if (item.safety_stock > 0) {
            if (qty < item.safety_stock) shortages.push(item.name);
            else if (qty < item.safety_stock * 1.5) warnings.push(item.name);
          }
        });
      }
      setAlerts({ shortages, warnings, total: shortages.length + warnings.length });

      // 2. 本日の製造
      const { data: prodData } = await supabase.from("production_plans").select("planned_cs, products(name)").eq("production_date", todayStr);
      if (prodData && prodData.length > 0) {
        const totalCs = prodData.reduce((sum: number, p: ProductionPlanRow) => sum + p.planned_cs, 0);
        const names = Array.from(new Set(prodData.map((p: ProductionPlanRow) => p.products?.name)));
        const detail = names.slice(0, 2).join(", ") + (names.length > 2 ? " 他" : "");
        setTodayProd({ totalCs, detail });
      }

      // 3. 本日の出荷
      const { data: shipData } = await supabase.from("orders").select("quantity, customers(name), products(unit_per_cs)").eq("planned_ship_date", todayStr).neq("status", "shipped");
      if (shipData && shipData.length > 0) {
        const totalCs = shipData.reduce((sum: number, o: OrderRow) => sum + Math.floor(o.quantity / (o.products?.unit_per_cs || 24)), 0);
        const names = Array.from(new Set(shipData.map((o: OrderRow) => o.customers?.name)));
        const detail = names.slice(0, 2).join("様, ") + "様" + (names.length > 2 ? " 他" : " 宛");
        setTodayShip({ totalCs, detail });
      }

      // 4. 進行中の受注
      const { data: ordersData } = await supabase.from("orders").select("id, planned_ship_date, desired_ship_date, status, quantity, customer_order_no, customers(name), products(name, variant_name, unit_per_cs), production_plans(production_date, planned_cs, status)").in("status", ["received", "in_production"]).order("planned_ship_date", { ascending: true });
      if (ordersData) {
        const groups: Record<string, OrderGroup> = {};
        ordersData.forEach((order: OrderRow) => {
          const parts = order.id.split('-'); const gId = parts.length > 3 ? parts.slice(0, 3).join('-') : order.id;
          const plans = order.production_plans || []; const unitPerCs = order.products?.unit_per_cs || 24;
          const completedPieces = plans.filter((p) => p.status === 'completed').reduce((sum: number, p) => sum + (p.planned_cs * unitPerCs), 0);
          const plannedPieces = plans.reduce((sum: number, p) => sum + (p.planned_cs * unitPerCs), 0);
          const progressPercent = Math.min(100, Math.floor((completedPieces / order.quantity) * 100));
          const isFullyPlanned = plannedPieces >= order.quantity;

          let completionDateStr = "未計画"; let shipAvailableDateStr = "-"; let shipAvailableDateObj = null;
          if (plans.length > 0) {
            const dates = plans.map((p) => new Date(p.production_date).getTime());
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
            groups[gId] = { groupId: gId, customerName: order.customers?.name, customerOrderNo: order.customer_order_no, plannedShipDate: order.planned_ship_date, desiredShipDate: order.desired_ship_date, status: order.status, items: [], totalProgress: 0, totalCompletedCs: 0, totalQuantityCs: 0, isLate: new Date(order.planned_ship_date) < new Date(todayStr), shipWarning: false, completionDateStr: "-", shipAvailableDateStr: "-" };
          }
          groups[gId].items.push(processedOrder);
        });

        Object.values(groups).forEach(g => {
          let totalPieces = 0; let totalCompletedPieces = 0; let latestCompletionTime = 0; let allPlanned = true;
          g.items.forEach(item => {
            const unit = item.products?.unit_per_cs || 24;
            totalPieces += item.quantity; totalCompletedPieces += (item.completedCs || 0) * unit;
            g.totalQuantityCs += Math.floor(item.quantity / unit); g.totalCompletedCs += (item.completedCs || 0);
            if (!item.isFullyPlanned) allPlanned = false;
            if (item.shipAvailableDateObj && item.shipAvailableDateObj.getTime() > latestCompletionTime) {
              latestCompletionTime = item.shipAvailableDateObj.getTime();
              g.completionDateStr = item.completionDateStr || ""; g.shipAvailableDateStr = item.shipAvailableDateStr || "";
            }
          });
          g.totalProgress = totalPieces > 0 ? Math.min(100, Math.floor((totalCompletedPieces / totalPieces) * 100)) : 0;
          if (!allPlanned) g.completionDateStr = "一部未計画";
          if (latestCompletionTime > 0 && new Date(latestCompletionTime) > new Date(g.plannedShipDate)) g.shipWarning = true;
          if (g.items.some(i => i.status === 'in_production')) g.status = 'in_production';
        });
        setOngoingGroups(Object.values(groups).slice(0, 10));
      }

      // ★追加 5. 賞味期限間近の製品 (3ヶ月以内)
      const threeMonthsLater = new Date(); threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
      const limitStr = threeMonthsLater.toISOString().split('T')[0];
      const { data: expProducts } = await supabase.from("product_stocks").select("lot_code, total_pieces, expiry_date, products(name, unit_per_cs)").lte("expiry_date", limitStr).gt("total_pieces", 0).order("expiry_date", { ascending: true });
      if (expProducts) setExpiringProducts(expProducts);

      // ★追加 6. 廃棄対象のキープサンプル (期限切れ かつ 残数あり)
      const { data: expSamples } = await supabase.from("keep_samples").select("management_no, saved_quantity, used_quantity, expiry_date, products(name)").lt("expiry_date", todayStr).order("expiry_date", { ascending: true });
      if (expSamples) {
        const toDiscard = expSamples.filter((s: KeepSampleRow) => (s.saved_quantity - s.used_quantity) > 0);
        setExpiredSamples(toDiscard);
      }

      // ★追加 7. HACCP記録の未入力チェック
      const haccpCheck = [];
      const [yo21, yo22, yo26, yo41] = await Promise.all([
        supabase.from("area_cleaning_checks").select("id").eq("check_date", todayStr).maybeSingle(),
        supabase.from("cleaning_checks").select("id").eq("check_date", todayStr).maybeSingle(),
        supabase.from("facility_checks").select("id").eq("check_date", todayStr).maybeSingle(),
        supabase.from("waste_checks").select("id").eq("check_date", todayStr).maybeSingle()
      ]);
      if (!yo21.data) haccpCheck.push("清掃チェック(YO-21)");
      if (!yo22.data) haccpCheck.push("清掃・点検(YO-22)");
      if (!yo26.data) haccpCheck.push("施設設備(YO-26)");
      if (!yo41.data) haccpCheck.push("廃棄物(YO-41)");
      setMissingHaccp(haccpCheck);

    } catch (error) { console.error("Dashboard fetch error:", error); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboardData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchDashboardData]);

  if (loading) return <div className="flex justify-center items-center h-[80vh]"><Loader2 className="animate-spin h-10 w-10 text-slate-400" /></div>;

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">ダッシュボード</h1>
        {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
      </div>

      {/* --- 上段: KPIカード --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className={`${alerts.total > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'} shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className={`text-sm font-bold ${alerts.total > 0 ? 'text-red-800' : 'text-slate-600'}`}>原料在庫アラート</CardTitle><AlertCircle className={`h-5 w-5 ${alerts.total > 0 ? 'text-red-600' : 'text-slate-400'}`} /></CardHeader>
          <CardContent>
            <div className={`text-3xl font-black ${alerts.total > 0 ? 'text-red-700' : 'text-slate-700'}`}>{alerts.total} <span className="text-lg font-normal">件</span></div>
            <div className={`text-xs mt-2 font-bold truncate ${alerts.total > 0 ? 'text-red-600' : 'text-slate-400'}`}>{alerts.total > 0 ? "安全在庫を下回っています" : "適正水準です"}</div>
          </CardContent>
        </Card>

        {/* ★追加: HACCP未入力アラート */}
        <Link href="/haccp" className="block cursor-pointer">
          <Card className={`${missingHaccp.length > 0 ? 'border-orange-300 bg-orange-50 hover:bg-orange-100' : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'} shadow-sm transition-colors h-full`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className={`text-sm font-bold ${missingHaccp.length > 0 ? 'text-orange-800' : 'text-emerald-800'}`}>本日のHACCP記録</CardTitle><ClipboardCheck className={`h-5 w-5 ${missingHaccp.length > 0 ? 'text-orange-600' : 'text-emerald-600'}`} /></CardHeader>
            <CardContent>
              <div className={`text-3xl font-black ${missingHaccp.length > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>{missingHaccp.length > 0 ? missingHaccp.length : "0"} <span className="text-sm font-bold">件 未入力</span></div>
              <div className={`text-[10px] mt-2 font-bold truncate ${missingHaccp.length > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{missingHaccp.length > 0 ? missingHaccp.join(", ") : "すべて入力完了しています！"}</div>
            </CardContent>
          </Card>
        </Link>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-bold text-slate-600">本日の製造予定</CardTitle><Package className="h-5 w-5 text-blue-500" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-blue-900">{todayProd.totalCs} <span className="text-lg font-normal text-slate-600">c/s</span></div><p className="text-sm text-slate-500 mt-2 font-bold truncate" title={todayProd.detail}>{todayProd.detail}</p></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-bold text-slate-600">本日の出荷予定</CardTitle><Truck className="h-5 w-5 text-purple-500" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-purple-900">{todayShip.totalCs} <span className="text-lg font-normal text-slate-600">c/s</span></div><p className="text-sm text-slate-500 mt-2 font-bold truncate" title={todayShip.detail}>{todayShip.detail}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- 左側: 進行中の受注 --- */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800"><Calendar className="h-5 w-5 text-blue-600" /> 進行中・出荷予定の受注</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {ongoingGroups.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {ongoingGroups.map(group => (
                  <div key={group.groupId} className="p-4 sm:p-5 flex flex-col gap-4 hover:bg-slate-50 transition-colors">
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
                          {group.shipWarning && !group.isLate && <span className="flex text-[10px] text-amber-600 mt-1 font-bold items-center justify-end gap-0.5"><AlertTriangle className="w-3 h-3" />出荷が間に合いません</span>}
                        </div>
                        {group.status === 'in_production' ? <Badge className="bg-blue-100 text-blue-800 border-none px-2 py-0.5 text-xs shadow-sm">製造中あり</Badge> : <Badge className="bg-amber-100 text-amber-800 border-none px-2 py-0.5 text-xs shadow-sm">未処理 (引当待)</Badge>}
                      </div>
                    </div>
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 font-bold bg-slate-50">現在進行中の受注はありません。</div>
            )}
          </div>
        </div>

        {/* --- 右側: 賞味期限・廃棄アラート --- */}
        <div className="flex flex-col gap-6">

          {/* 廃棄対象サンプル */}
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800"><Trash2 className="h-5 w-5 text-red-600" /> 廃棄対象のサンプル</h2>
            <Card className="border-red-200 shadow-sm overflow-hidden">
              {expiredSamples.length > 0 ? (
                <div className="divide-y divide-red-100 max-h-[300px] overflow-y-auto">
                  {expiredSamples.map(sample => (
                    <div key={sample.management_no} className="p-3 bg-red-50 hover:bg-red-100 transition-colors flex justify-between items-center">
                      <div>
                        <div className="font-bold text-red-800 text-sm">{sample.products?.name}</div>
                        <div className="text-[10px] font-mono text-red-600">管理No: {sample.management_no}</div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-red-600 text-white border-none shadow-sm text-[10px] mb-1">期限: {new Date(sample.expiry_date).toLocaleDateString()}</Badge>
                        <div className="text-xs font-bold text-slate-700">残: <span className="text-red-700 text-base">{sample.saved_quantity - sample.used_quantity}</span> 個</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 font-bold bg-slate-50">廃棄期限を過ぎたサンプルはありません。</div>
              )}
            </Card>
          </div>

          {/* 期限間近の製品在庫 */}
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800"><AlertTriangle className="h-5 w-5 text-amber-500" /> 賞味期限間近 (3ヶ月以内)</h2>
            <Card className="border-amber-200 shadow-sm overflow-hidden">
              {expiringProducts.length > 0 ? (
                <div className="divide-y divide-amber-100 max-h-[300px] overflow-y-auto">
                  {expiringProducts.map(product => {
                    const cs = Math.floor(product.total_pieces / (product.products?.unit_per_cs || 24));
                    const p = Math.floor((product.total_pieces % (product.products?.unit_per_cs || 24)) / 2);
                    return (
                      <div key={product.lot_code} className="p-3 bg-amber-50 hover:bg-amber-100 transition-colors flex justify-between items-center">
                        <div>
                          <div className="font-bold text-amber-900 text-sm truncate max-w-[150px]">{product.products?.name}</div>
                          <div className="text-[10px] font-mono text-amber-700">Lot: {product.lot_code}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-amber-800 mb-0.5">期限: {new Date(product.expiry_date).toLocaleDateString()}</div>
                          <div className="text-sm font-black text-amber-900">
                            {cs > 0 && <>{cs} <span className="text-[9px] font-normal">c/s</span></>}
                            {p > 0 && <span className="ml-1">{p} <span className="text-[9px] font-normal">p</span></span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 font-bold bg-slate-50">賞味期限が近い製品在庫はありません。</div>
              )}
            </Card>
          </div>

        </div>

      </div>
    </>
  );
}