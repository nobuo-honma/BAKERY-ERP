"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, Truck, Calendar, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = {
  id: string; desired_ship_date: string; status: string; quantity: number;
  customers?: { name: string }; products?: { name: string; variant_name: string };
};

export default function Dashboard() {
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);

  const [alerts, setAlerts] = useState<{ shortages: string[]; warnings: string[]; total: number }>({ shortages: [], warnings: [], total: 0 });
  const [todayProd, setTodayProd] = useState<{ totalCs: number; detail: string }>({ totalCs: 0, detail: "予定なし" });
  const [todayShip, setTodayShip] = useState<{ totalCs: number; detail: string }>({ totalCs: 0, detail: "予定なし" });
  const [ongoingOrders, setOngoingOrders] = useState<Order[]>([]);

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
          // ★修正: 配列で返ってきた場合と、オブジェクトで返ってきた場合の両方に対応
          const qty = Array.isArray(item.item_stocks)
            ? (item.item_stocks[0]?.quantity || 0)
            : (item.item_stocks?.quantity || 0);

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
        const names = Array.from(new Set(prodData.map((p: any) => {
          const product = Array.isArray(p.products) ? p.products[0] : p.products;
          return product?.name;
        }).filter(Boolean)));
        const detail = names.slice(0, 2).join(", ") + (names.length > 2 ? " 他" : "");
        setTodayProd({ totalCs, detail });
      }

      const { data: shipData } = await supabase.from("orders").select("quantity, customers(name)").eq("desired_ship_date", todayStr).neq("status", "shipped");
      if (shipData && shipData.length > 0) {
        const totalCs = shipData.reduce((sum: number, o: any) => sum + o.quantity, 0);
        const names = Array.from(new Set(shipData.map((o: any) => {
          const customer = Array.isArray(o.customers) ? o.customers[0] : o.customers;
          return customer?.name;
        }).filter(Boolean)));
        const detail = names.slice(0, 2).join("様, ") + "様" + (names.length > 2 ? " 他" : " 宛");
        setTodayShip({ totalCs, detail });
      }

      const { data: ordersData } = await supabase.from("orders")
        .select("id, desired_ship_date, status, quantity, customers(name), products(name, variant_name)")
        .in("status", ["received", "in_production"]).order("desired_ship_date", { ascending: true }).limit(10);

      if (ordersData) {
        const formattedOrders = (ordersData as any[]).map(o => ({
          ...o,
          customers: Array.isArray(o.customers) ? o.customers[0] : o.customers,
          products: Array.isArray(o.products) ? o.products[0] : o.products,
        }));
        setOngoingOrders(formattedOrders as Order[]);
      }
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center items-center h-[80vh]"><Loader2 className="animate-spin h-10 w-10 text-slate-400" /></div>;

  const shortageText = alerts.shortages.length > 0 ? `不足: ${alerts.shortages.slice(0, 2).join(", ")}${alerts.shortages.length > 2 ? ' 他' : ''}` : "";
  const warningText = alerts.warnings.length > 0 ? `注意: ${alerts.warnings.slice(0, 2).join(", ")}${alerts.warnings.length > 2 ? ' 他' : ''}` : "";

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">ダッシュボード</h1>
        {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className={`${alerts.total > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'} shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={`text-sm font-bold ${alerts.total > 0 ? 'text-red-800' : 'text-slate-600'}`}>在庫アラート</CardTitle><AlertCircle className={`h-5 w-5 ${alerts.total > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </CardHeader>
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

      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800"><Calendar className="h-5 w-5 text-blue-600" /> 進行中・未処理の受注</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {ongoingOrders.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {ongoingOrders.map(order => {
              const today = new Date(); today.setHours(0, 0, 0, 0); const shipDate = new Date(order.desired_ship_date); const isLate = shipDate < today;
              return (
                <div key={order.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 mb-1">{order.id}</div>
                    <div className="font-bold text-lg text-slate-800 truncate" title={order.customers?.name}>{order.customers?.name}</div>
                    <div className="text-sm font-bold text-slate-600 mt-1 truncate" title={`${order.products?.name} (${order.products?.variant_name})`}>{order.products?.name} <span className="font-normal">({order.products?.variant_name})</span></div>
                  </div>
                  <div className="md:text-right shrink-0 md:w-32 bg-slate-50 md:bg-transparent p-2 rounded-md border md:border-none">
                    <div className="text-[10px] font-bold text-slate-500 md:hidden mb-1">受注数</div>
                    <div className="font-black text-xl text-blue-700">{order.quantity} <span className="text-sm font-normal text-slate-500">c/s</span></div>
                  </div>
                  <div className="shrink-0 md:w-48 md:text-right flex flex-row md:flex-col items-center md:items-end justify-between gap-2">
                    <div className={`text-sm font-bold ${isLate ? 'text-red-600' : 'text-slate-700'}`}>出荷: {shipDate.toLocaleDateString('ja-JP')}{isLate && <span className="block text-[10px] text-red-500 md:mt-0.5">(期限超過)</span>}</div>
                    {order.status === 'in_production' ? <Badge className="bg-blue-100 text-blue-800 border-none px-2 py-0.5 text-xs shadow-sm">製造中あり</Badge> : <Badge className="bg-amber-100 text-amber-800 border-none px-2 py-0.5 text-xs shadow-sm">計画・引当待</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (<div className="p-8 text-center text-slate-500 font-bold bg-slate-50">現在進行中の受注はありません。</div>)}
      </div>
    </>
  );
}

