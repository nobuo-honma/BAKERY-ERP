"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, Truck, Calendar, Loader2 } from "lucide-react";

// --- 型定義 ---
type DashboardSummary = {
  inventoryAlerts: { count: number; items: string[] };
  todayProduction: { cs: number; products: string[] };
  todayShipment: { cs: number; customers: string[] };
};

type OngoingOrder = {
  id: string;
  customer_name: string;
  desired_ship_date: string;
  status: string;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary>({
    inventoryAlerts: { count: 0, items: [] },
    todayProduction: { cs: 0, products: [] },
    todayShipment: { cs: 0, customers: [] },
  });
  const [ongoingOrders, setOngoingOrders] = useState<OngoingOrder[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    try {
      // 1. 在庫アラート (安全在庫を下回っているアイテム)
      const { data: itemsData } = await supabase
        .from("items")
        .select("name, safety_stock, item_stocks(quantity)");
      
      const alerts = itemsData?.filter(item => {
        const qty = item.item_stocks?.[0]?.quantity || 0;
        return qty < item.safety_stock;
      }) || [];

      // 2. 本日の製造予定
      const { data: prodData } = await supabase
        .from("production_plans")
        .select("planned_cs, products(name)")
        .eq("production_date", today);
      
      const totalProdCs = prodData?.reduce((acc, curr) => acc + (curr.planned_cs || 0), 0) || 0;
      const prodNames = Array.from(new Set(prodData?.map(p => (p.products as any)?.name).filter(Boolean))) as string[];

      // 3. 本日の出荷予定 (受注の希望納期が今日)
      const { data: shipData } = await supabase
        .from("orders")
        .select("quantity, customers(name)")
        .eq("desired_ship_date", today);
      
      const totalShipCs = shipData?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
      const shipCustNames = Array.from(new Set(shipData?.map(s => (s.customers as any)?.name).filter(Boolean))) as string[];

      // 4. 進行中の受注 (出荷完了以外、直近5件)
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, status, desired_ship_date, customers(name)")
        .neq("status", "shipped")
        .order("desired_ship_date", { ascending: true })
        .limit(5);

      setSummary({
        inventoryAlerts: { 
          count: alerts.length, 
          items: alerts.slice(0, 3).map(a => a.name) 
        },
        todayProduction: { 
          cs: totalProdCs, 
          products: prodNames 
        },
        todayShipment: { 
          cs: totalShipCs, 
          customers: shipCustNames 
        },
      });

      setOngoingOrders(orderData?.map(o => ({
        id: o.id,
        customer_name: (o.customers as any)?.name || "不明",
        desired_ship_date: o.desired_ship_date,
        status: o.status
      })) || []);

    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "received": return { text: "未計画", color: "bg-slate-100 text-slate-800" };
      case "planned": return { text: "計画済", color: "bg-blue-50 text-blue-700 border-blue-100" };
      case "in_production": return { text: "製造中", color: "bg-amber-100 text-amber-800" };
      default: return { text: status, color: "bg-slate-50 text-slate-600" };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-blue-500" />
        <p className="text-slate-500 font-bold">データを読み込み中...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">ダッシュボード</h1>
        <Badge variant="outline" className="bg-white text-slate-500 border-slate-200">
          更新日: {new Date().toLocaleDateString('ja-JP')}
        </Badge>
      </div>

      {/* サマリーカードのグリッド配置 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* 在庫アラート */}
        <Card className={`shadow-sm ${summary.inventoryAlerts.count > 0 ? "border-red-200 bg-red-50" : "border-slate-200"}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={`text-sm font-bold ${summary.inventoryAlerts.count > 0 ? "text-red-800" : "text-slate-600"}`}>在庫アラート</CardTitle>
            <AlertCircle className={`h-5 w-5 ${summary.inventoryAlerts.count > 0 ? "text-red-600" : "text-slate-400"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-black ${summary.inventoryAlerts.count > 0 ? "text-red-700" : "text-slate-800"}`}>
              {summary.inventoryAlerts.count} <span className="text-lg font-normal">件</span>
            </div>
            <p className={`text-sm mt-2 font-medium truncate ${summary.inventoryAlerts.count > 0 ? "text-red-600" : "text-slate-500"}`}>
              {summary.inventoryAlerts.count > 0 ? `不足: ${summary.inventoryAlerts.items.join(", ")}` : "全品目 充足"}
            </p>
          </CardContent>
        </Card>

        {/* 本日の製造予定 */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-600">本日の製造予定</CardTitle>
            <Package className="h-5 w-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">
              {summary.todayProduction.cs} <span className="text-lg font-normal text-slate-600">c/s</span>
            </div>
            <p className="text-sm text-slate-500 mt-2 truncate">
              {summary.todayProduction.products.length > 0 ? summary.todayProduction.products.join(", ") : "予定なし"}
            </p>
          </CardContent>
        </Card>

        {/* 本日の出荷予定 */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-600">本日の出荷予定</CardTitle>
            <Truck className="h-5 w-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">
              {summary.todayShipment.cs} <span className="text-lg font-normal text-slate-600">c/s</span>
            </div>
            <p className="text-sm text-slate-500 mt-2 truncate">
              {summary.todayShipment.customers.length > 0 ? `${summary.todayShipment.customers.join(", ")} 他` : "予定なし"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 進行中の受注エリア */}
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
        <Calendar className="h-5 w-5 text-blue-600" />
        進行中の受注状況
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {ongoingOrders.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {ongoingOrders.map((order) => {
              const status = getStatusLabel(order.status);
              return (
                <div key={order.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-bold text-lg text-slate-800">{order.customer_name}</div>
                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-slate-500">{order.id.slice(0, 8)}</span>
                      納品希望: {new Date(order.desired_ship_date).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge className={`${status.color} border-none px-3 py-1 text-sm font-bold w-fit shadow-sm`}>
                    {status.text}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center text-slate-400">
            進行中の受注はありません。
          </div>
        )}
      </div>
    </>
  );
}