"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Loader2, ArrowRight, Lock, Printer, ArrowLeft, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = {
  id: string; order_date: string; planned_ship_date: string; desired_ship_date: string;
  quantity: number; status: string; product_id: string; customer_id: string; customer_order_no?: string;
  customers?: { name: string };
  products?: { name: string; variant_name: string; unit_per_cs: number };
};
type ProductStock = {
  id: string; lot_code: string; product_id: string; total_pieces: number; expiry_date: string;
  products?: { name: string; variant_name: string; unit_per_cs: number };
};
type Shipment = {
  id: string; order_id: string; ship_date: string; lot_code: string;
  qty_cs: number; qty_piece: number; status: string;
  orders?: {
    product_id: string; desired_ship_date: string; planned_ship_date: string; customer_order_no?: string;
    customers?: { name: string };
    products?: { name: string; variant_name: string; unit_per_cs: number }
  }
};

type OrderGroup = {
  groupId: string; customerOrderNo: string; plannedShipDate: string; desiredShipDate: string;
  customerName: string; items: Order[]; isLate: boolean;
};
type PrintGroup = {
  orderIdPrefix: string; customerName: string; customerOrderNo: string;
  shipDate: string; desiredShipDate: string; shipments: Shipment[];
};

// ============================================================
// ユーティリティ
// ============================================================
function pcsToDisplay(totalPcs: number, unitPerCs: number): { cs: number; p: number } {
  const cs = Math.floor(totalPcs / unitPerCs);
  const remainder = totalPcs % unitPerCs;
  const p = Math.floor(remainder / 2);
  return { cs, p };
}

function displayToPcs(cs: number, p: number, unitPerCs: number): number {
  return (cs * unitPerCs) + (p * 2);
}

// 印刷用：登録された日時情報から「JSTローカル時間」を考慮して複数行表示 (13:00 などの時間も含めて動的描画)
function formatShipDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const year = `${d.getFullYear()}年`;
  const monthDay = `${d.getMonth() + 1}月${d.getDate()}日`;

  // 登録時に入力された時間を切り出す
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;

  return `${year}\n${monthDay}\n${time}`;
}

// 印刷用：着予定日（月日）のフォーマット
function formatDesiredDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 品目名やLot番号から「C3」などの短い実務用識別コードを抽出・マッピングするヘルパー
function getShortProductCode(productName: string, lotCode: string): string {
  const name = productName.toLowerCase();

  if (name.includes("チョコチップ") || name.includes("チョコ")) return "C3";
  if (name.includes("あすなろ")) return "A1";
  if (name.includes("角食") || name.includes("食パン")) return "K1";
  if (name.includes("菓子パン") || name.includes("p15")) return "P15";
  if (name.includes("全卵") || name.includes("卵")) return "E1";
  if (name.includes("オレンジ")) return "O1";
  if (name.includes("黒豆") || name.includes("かのこ")) return "B1";
  if (name.includes("キャラメル")) return "C2";
  if (name.includes("フルーツ")) return "F1";
  if (name.includes("アップル")) return "Ap";
  if (name.includes("イースト")) return "Y1";
  if (name.includes("ミルシア")) return "M1";

  if (lotCode) {
    const cleaned = lotCode.replace(/^\d+/, '').replace(/-\d+$/, '').trim();
    if (cleaned.length > 0 && cleaned.length <= 4) {
      return cleaned;
    }
    const alphaOnly = lotCode.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '');
    if (alphaOnly && alphaOnly.length <= 4) return alphaOnly;
    return lotCode.slice(-3);
  }

  return "";
}

export default function ShipmentsPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'print'>('list');
  const [loading, setLoading] = useState(true);

  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);

  const [groupedStocks, setGroupedStocks] = useState<Record<string, ProductStock[]>>({});
  const [shipments, setShipments] = useState<Shipment[]>([]);

  // 印刷時に選択する絞り込み用出荷日のState
  const [filterPrintDate, setFilterPrintDate] = useState<string>("");

  const [shipInputs, setShipInputs] = useState<Record<string, { cs: number | ""; p: number | "" }>>({});
  const [shipDate, setShipDate] = useState("");
  const [shipTime, setShipTime] = useState("13:00"); // 実際の出荷予定時間のState (初期値 13:00)
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_cs)").in("status", ["received", "in_production"]).order("planned_ship_date", { ascending: true });

    if (data) {
      const groups: Record<string, OrderGroup> = {};
      const today = new Date(); today.setHours(0, 0, 0, 0);

      data.forEach((o: Order) => {
        const parts = o.id.split('-');
        const gId = o.customer_order_no
          ? `${o.customer_order_no}_${o.customer_id}_${o.planned_ship_date}`
          : (parts.length > 3 ? parts.slice(0, 3).join('-') : o.id);

        if (!groups[gId]) {
          groups[gId] = {
            groupId: gId, customerOrderNo: o.customer_order_no || "",
            plannedShipDate: o.planned_ship_date || o.desired_ship_date,
            desiredShipDate: o.desired_ship_date, customerName: o.customers?.name || "",
            items: [], isLate: new Date(o.planned_ship_date || o.desired_ship_date) < today
          };
        }
        groups[gId].items.push(o);
      });
      setOrderGroups(Object.values(groups));
    }

    const { data: sData } = await supabase.from("shipments").select("*, orders(product_id, desired_ship_date, planned_ship_date, customer_order_no, customers(name), products(name, variant_name, unit_per_cs))").order("ship_date", { ascending: false }).limit(100);
    if (sData) setShipments(sData as Shipment[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    setShipDate(new Date().toISOString().split('T')[0]);
  }, [fetchOrders]);

  // 実績から存在する出荷日(一意)を抽出し、降順で並び替え
  const availableShipDates = useMemo(() => {
    const dates = shipments.map(s => {
      // 登録されている日時文字列から「日付部分」のみを切り出す
      return s.ship_date.split('T')[0];
    });
    return Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  }, [shipments]);

  // 初期時に、実績内の最新の出荷日をデフォルトで選択するようにセット
  useEffect(() => {
    if (availableShipDates.length > 0 && !filterPrintDate) {
      setFilterPrintDate(availableShipDates[0]);
    }
  }, [availableShipDates, filterPrintDate]);

  // 選択された出荷日(日付部分のみで比較)に完全にフィルタリングされた出荷データ
  const filteredShipments = useMemo(() => {
    if (!filterPrintDate) return shipments;
    return shipments.filter(s => s.ship_date.startsWith(filterPrintDate));
  }, [shipments, filterPrintDate]);

  const handleSelectGroup = async (group: OrderGroup) => {
    setSelectedGroup(group);
    setShipInputs({});
    setIsOrderCompleted(true);
    setShipTime("13:00"); // 選択時に時間を13:00にリセット
    const productIds = group.items.map(i => i.product_id);
    setShipDate(group.plannedShipDate || new Date().toISOString().split('T')[0]);

    const { data, error } = await supabase.from("product_stocks").select("*, products(name, variant_name, unit_per_cs)").in("product_id", productIds).gt("total_pieces", 0).order("expiry_date", { ascending: true });
    if (error) {
      console.error("在庫取得エラー:", error);
      alert("在庫の取得に失敗しました。");
    } else if (data) {
      const gStocks: Record<string, ProductStock[]> = {};
      (data as ProductStock[]).forEach(s => {
        if (!gStocks[s.product_id]) gStocks[s.product_id] = [];
        gStocks[s.product_id].push(s);
      });
      setGroupedStocks(gStocks);
    }
  };

  const handleInputChange = (stockId: string, field: 'cs' | 'p', value: string) => {
    setShipInputs(prev => ({
      ...prev,
      [stockId]: { ...prev[stockId], [field]: value === "" ? "" : Number(value) }
    }));
  };

  const handleSaveShipment = async () => {
    if (!selectedGroup) return;
    const hasInput = Object.values(shipInputs).some(input => (Number(input?.cs) || 0) > 0 || (Number(input?.p) || 0) > 0);
    if (!hasInput) { alert("出荷する数量を入力してください。"); return; }

    setIsProcessing(true);
    try {
      const stockUpdates = [];
      const stockDeletes = [];
      const shipmentInserts = [];
      const historyInserts = [];
      const completedOrderIds = [];

      for (const order of selectedGroup.items) {
        const stocksForProduct = groupedStocks[order.product_id] || [];
        const unitPerCs = order.products?.unit_per_cs || 24;
        let totalShippedForThisOrder = 0;

        for (const stock of stocksForProduct) {
          const input = shipInputs[stock.id];
          const inputCs = Number(input?.cs) || 0;
          const inputP = Number(input?.p) || 0;

          const shipTotalPcs = displayToPcs(inputCs, inputP, unitPerCs);

          if (shipTotalPcs > 0) {
            if (shipTotalPcs > stock.total_pieces) {
              alert(`Lot[${stock.lot_code}] の出荷数(${shipTotalPcs}個)が現在庫(${stock.total_pieces}個)を超えています！`);
              setIsProcessing(false);
              return;
            }

            const newTotalPcs = stock.total_pieces - shipTotalPcs;
            if (newTotalPcs <= 0) {
              stockDeletes.push(stock.id);
            } else {
              stockUpdates.push({
                id: stock.id,
                lot_code: stock.lot_code,
                product_id: stock.product_id,
                expiry_date: stock.expiry_date,
                total_pieces: newTotalPcs
              });
            }

            const random4 = Math.floor(Math.random() * 10000).toString().padStart(4, "0");

            // 実際の出荷日と出荷時間を合成してISO規格に近い日次文字列として保存
            const shipDateTimeStr = `${shipDate}T${shipTime || "13:00"}:00`;

            shipmentInserts.push({
              id: `SHP-${shipDate.replace(/-/g, "")}-${random4}`,
              order_id: order.id,
              ship_date: shipDateTimeStr, // 日時を合体して格納
              lot_code: stock.lot_code,
              qty_cs: inputCs,
              qty_piece: inputP,
              status: "shipped"
            });
            historyInserts.push({
              product_id: stock.product_id,
              lot_code: stock.lot_code,
              before_qty: stock.total_pieces,
              after_qty: newTotalPcs,
              reason: `出荷 (${selectedGroup.customerName}様宛)`
            });

            totalShippedForThisOrder += shipTotalPcs;
          }
        }
        if (totalShippedForThisOrder > 0 || isOrderCompleted) completedOrderIds.push(order.id);
      }

      if (stockUpdates.length > 0) {
        const { error } = await supabase.from("product_stocks").upsert(stockUpdates, { onConflict: 'id' });
        if (error) throw error;
      }
      if (stockDeletes.length > 0) {
        const { error } = await supabase.from("product_stocks").delete().in('id', stockDeletes);
        if (error) throw error;
      }
      if (shipmentInserts.length > 0) {
        const { error } = await supabase.from("shipments").insert(shipmentInserts);
        if (error) throw error;
      }
      if (historyInserts.length > 0) {
        const { error } = await supabase.from("inventory_adjustments").insert(historyInserts);
        if (error) throw error;
      }

      if (isOrderCompleted && completedOrderIds.length > 0) {
        const { error } = await supabase.from("orders").update({ status: "shipped" }).in("id", completedOrderIds);
        if (error) throw error;
        setSelectedGroup(null);
      } else {
        handleSelectGroup(selectedGroup);
      }

      alert("出荷処理が完了し、在庫から正確に減算されました！");
      fetchOrders();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "不明なエラーです";
      alert("エラー: " + message);
    }
    setIsProcessing(false);
  };

  // ============================================================
  // 印刷（PDF管理票）モード (3段完全再現 ＋ 印鑑欄20mm ＋ 10行固定)
  // ============================================================
  if (viewMode === 'print') {
    const pGroups: Record<string, PrintGroup> = {};

    filteredShipments.forEach(s => {
      const parts = s.order_id.split('-');
      const oPrefix = parts.length > 3 ? parts.slice(0, 3).join('-') : s.order_id;
      const gKey = s.orders?.customer_order_no
        ? `${s.orders.customer_order_no}_${s.ship_date.split('T')[0]}`
        : `${oPrefix}_${s.ship_date.split('T')[0]}`;

      if (!pGroups[gKey]) {
        pGroups[gKey] = {
          orderIdPrefix: oPrefix, customerName: s.orders?.customers?.name || "",
          customerOrderNo: s.orders?.customer_order_no || "",
          shipDate: s.ship_date, desiredShipDate: s.orders?.desired_ship_date || "",
          shipments: []
        };
      }
      pGroups[gKey].shipments.push(s);
    });

    const printChunks = Object.values(pGroups);
    const itemsPerPage = 3;
    const pagesCount = Math.max(1, Math.ceil(printChunks.length / itemsPerPage));
    const chunkedPages = [];

    for (let p = 0; p < pagesCount; p++) {
      const pageChunks = [];
      for (let i = 0; i < itemsPerPage; i++) {
        const index = p * itemsPerPage + i;
        pageChunks.push(printChunks[index] || null); // 白紙を埋め込む
      }
      chunkedPages.push(pageChunks);
    }

    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{ __html: `@media print { header, nav { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; } @page { size: A4 portrait; margin: 8mm; } body { background-color: white !important; color: black !important; } .print-hide { display: none !important; } .page-break { page-break-after: always; } }` }} />

        <div className="w-[210mm] print:w-full flex justify-between items-center mb-4 print-hide gap-4">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300"><ArrowLeft className="h-4 w-4 mr-2" /> 戻る</Button>

          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm flex-1 max-w-sm justify-between">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">出荷日の選択:</span>
            <select
              value={filterPrintDate}
              onChange={(e) => setFilterPrintDate(e.target.value)}
              className="text-xs font-bold p-1 border rounded bg-white text-slate-800 focus:outline-none cursor-pointer w-full ml-2"
            >
              <option value="">すべての出荷実績（直近）</option>
              {availableShipDates.map(d => (
                <option key={d} value={d}>{new Date(d).toLocaleDateString('ja-JP')} の出荷実績</option>
              ))}
            </select>
          </div>

          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"><Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)</Button>
        </div>

        {chunkedPages.map((pageChunks, pageIdx) => (
          <div
            key={pageIdx}
            className={`w-[210mm] h-[297mm] bg-white p-6 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between ${pageIdx < chunkedPages.length - 1 ? 'page-break mb-8 print:mb-0' : ''}`}
          >
            {pageChunks.map((group, gIdx) => {
              const productSummary: Record<string, { product_id: string, name: string, variant: string, totalCs: number, totalP: number, lots: Shipment[] }> = {};

              if (group) {
                group.shipments.forEach(s => {
                  const pId = s.orders?.product_id || "";
                  if (!productSummary[pId]) {
                    productSummary[pId] = {
                      product_id: pId, // マスタの製品IDをマージ用キーとして活用
                      name: s.orders?.products?.name || "",
                      variant: s.orders?.products?.variant_name || "",
                      totalCs: 0,
                      totalP: 0,
                      lots: []
                    };
                  }
                  productSummary[pId].totalCs += s.qty_cs;
                  productSummary[pId].totalP += s.qty_piece;
                  productSummary[pId].lots.push(s);
                });
              }

              const rows = Object.values(productSummary);
              const shipNotes = group?.shipments[0]?.orders?.customer_order_no ? `発注注番: ${group.customerOrderNo}` : "";

              return (
                <div key={gIdx} className="flex-1 flex flex-col justify-between relative overflow-hidden py-1 border-b last:border-b-0 border-dashed border-slate-300">
                  {/* --- ヘッダー領域 --- */}
                  <div className="flex justify-between items-end shrink-0">
                    <h1 className="text-xl font-bold tracking-[0.4em] ml-2">出 荷 管 理 票</h1>
                    <table className="border-collapse border border-black text-center text-[7px] leading-tight w-48 shrink-0">
                      <tbody>
                        <tr>
                          <th className="border border-black px-1 py-0.5 font-medium bg-slate-50 w-24">ワークセンターやまびこ</th>
                          <th className="border border-black px-1 py-0.5 font-medium bg-slate-50 w-10">制定日</th>
                          <td className="border border-black px-1 py-0.5 font-bold w-16">2021/4/1</td>
                        </tr>
                        <tr>
                          <th className="border border-black px-1 py-0.5 font-medium bg-slate-50">文章No.　　YO-29</th>
                          <th className="border border-black px-1 py-0.5 font-medium bg-slate-50">改定日</th>
                          <td className="border border-black px-1 py-0.5 font-bold">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* --- 出荷情報テーブル (印鑑欄高さを20mm、出荷日を年月日時間表示) --- */}
                  <table className="w-full border-collapse border-2 border-black text-[10px] my-1 shrink-0">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-black py-0.5 w-[12%] font-medium">出荷日</th>
                        <th className="border border-black py-0.5 w-[12%] font-medium">着予定日</th>
                        <th className="border border-black py-0.5 w-[56%] font-medium">出荷先</th>
                        <th className="border border-black py-0.5 w-[10%] font-medium">施設長</th>
                        <th className="border border-black py-0.5 w-[10%] font-medium">担当</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ height: "18mm" }}>
                        <td className="border border-black text-center font-bold text-[15px] leading-tight whitespace-pre-wrap py-1">
                          {group ? formatShipDate(group.shipDate) : ""}
                        </td>
                        <td className="border border-black text-center font-bold text-[15px] leading-tight py-1">
                          {group ? formatDesiredDate(group.desiredShipDate) : ""}
                        </td>
                        {/* ★ 出荷先のフォントサイズを text-[15px] に引き上げ拡大表示 */}
                        <td className="border border-black px-2.5 font-black text-[25px] tracking-wide leading-tight truncate">
                          {group ? group.customerName : ""}
                        </td>
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* --- 明細テーブル (YO-29 本物仕様の「10行固定」) --- */}
                  <table className="w-full border-collapse border-2 border-black text-[9px] flex-1 table-fixed">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-black py-0.5 w-[10%] font-medium">注番</th>
                        <th className="border border-black py-0.5 w-[20%] font-medium">出荷種類</th>
                        <th className="border border-black py-0.5 w-[10%] font-medium">出荷数</th>
                        <th className="border border-black py-0.5 w-[15%] font-medium">LotNo.</th>
                        <th className="border border-black py-0.5 w-[10%] font-medium">数量</th>
                        <th className="border border-black py-0.5 w-[15%] font-medium">LotNo.</th>
                        <th className="border border-black py-0.5 w-[10%] font-medium">数量</th>
                        <th className="border border-black py-0.5 w-[10%] font-medium text-[8px] leading-tight">数量確認欄</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }).map((_, i) => {
                        const row = rows[i];
                        const lot1 = row?.lots[0];
                        const lot2 = row?.lots[1];

                        const productId = row ? row.product_id : "";
                        const productName = row ? (row.variant || row.name) : "";
                        const displayType = productId ? `${productId}（${productName}）` : productName;

                        const isRowEmpty = !row;

                        return (
                          <tr key={i} className="h-3.5">
                            {/* 注番 */}
                            <td className="border border-black text-center font-bold text-[8px] px-0.5 truncate overflow-hidden whitespace-nowrap">
                              {i === 0 && group ? (group.customerOrderNo || group.orderIdPrefix.slice(-4)) : ""}
                            </td>
                            {/* 出荷種類 */}
                            <td className="border border-black px-1 font-bold text-[9px] truncate overflow-hidden whitespace-nowrap">
                              {displayType}
                            </td>
                            {/* 出荷数 */}
                            <td className="border border-black text-right pr-4 font-bold relative text-[9px] h-3.5 py-0">
                              {row ? row.totalCs : ""}
                              {!isRowEmpty && <span className="absolute right-0.5 bottom-0 text-[6px] font-normal text-slate-400 scale-[0.8] origin-right">c/s</span>}
                            </td>
                            {/* LotNo 1 */}
                            <td className="border border-black text-center font-bold text-[8px] tracking-wider truncate overflow-hidden">
                              {lot1 ? lot1.lot_code : ""}
                            </td>
                            {/* 数量 1 */}
                            <td className="border border-black text-right pr-4 font-bold relative text-[9px] h-3.5 py-0">
                              {lot1 ? lot1.qty_cs : ""}
                              {!isRowEmpty && lot1 && <span className="absolute right-0.5 bottom-0 text-[6px] font-normal text-slate-400 scale-[0.8] origin-right">c/s</span>}
                            </td>
                            {/* LotNo 2 */}
                            <td className="border border-black text-center font-bold text-[8px] tracking-wider truncate overflow-hidden">
                              {lot2 ? lot2.lot_code : ""}
                            </td>
                            {/* 数量 2 */}
                            <td className="border border-black text-right pr-4 font-bold relative text-[9px] h-3.5 py-0">
                              {lot2 ? lot2.qty_cs : ""}
                              {!isRowEmpty && lot2 && <span className="absolute right-0.5 bottom-0 text-[6px] font-normal text-slate-400 scale-[0.8] origin-right">c/s</span>}
                            </td>
                            {/* 数量確認欄 */}
                            <td className="border border-black relative text-right pr-4 h-3.5 py-0 bg-slate-50/50 print:bg-transparent">
                              {row ? row.totalCs : ""}
                              {!isRowEmpty && <span className="absolute right-0.5 bottom-0 text-[6px] font-normal text-slate-400 scale-[0.8] origin-right">c/s</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* --- 備考枠 (テーブルの下部) --- */}
                  <div className="border border-black border-t-0 p-1 flex h-6 text-[8px] shrink-0">
                    <span className="font-bold mr-2 shrink-0">備考</span>
                    <span className="text-slate-700 truncate">{shipNotes}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))
        }
      </div>
    );
  }

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Truck className="h-6 w-6 text-blue-600" /> 出荷管理 (引当・実績登録)</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        <Button onClick={() => setViewMode('print')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-12 md:h-10">
          <FileText className="h-4 w-4 mr-2" /> 出荷実績から管理票(PDF)を作成
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 受注グループ選択 */}
        <div className="w-full lg:w-[35%]">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span> 出荷予定の注文書を選択
          </h2>
          <div className="space-y-3 h-[calc(100vh-150px)] overflow-y-auto pr-2 pb-10">
            {orderGroups.map((group) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const isLate = new Date(group.plannedShipDate) < today;

              return (
                <Card key={group.groupId} onClick={() => handleSelectGroup(group)} className={`cursor-pointer transition-all border-2 ${selectedGroup?.groupId === group.groupId ? "border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]" : "border-slate-200 hover:border-blue-300"}`}>
                  <CardHeader className="p-4 pb-2 bg-white rounded-t-lg border-b">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        {group.customerOrderNo && <Badge variant="outline" className="w-fit text-[10px] bg-white text-blue-700 font-bold border-blue-200 py-0 mb-1"><FileText className="w-3 h-3 mr-1" />発注: {group.customerOrderNo}</Badge>}
                        <CardTitle className="text-lg text-slate-800 leading-tight">{group.customerName}</CardTitle>
                      </div>
                      <Badge className={`${isLate ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-800'} border-none shadow-sm text-xs`}>
                        出荷予定: {new Date(group.plannedShipDate).toLocaleDateString()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 bg-slate-50 rounded-b-lg">
                    <div className="divide-y divide-slate-100">
                      {group.items.map((item) => {
                        const unitPerCs = item.products?.unit_per_cs || 24;
                        const { cs, p } = pcsToDisplay(item.quantity, unitPerCs);
                        return (
                          <div key={item.id} className="px-4 py-2.5 flex justify-between items-center text-sm bg-white">
                            <div className="font-bold text-slate-700 truncate mr-2">
                              {item.products?.name} <span className="text-xs font-normal text-slate-500">({item.products?.variant_name})</span>
                            </div>
                            <div className="font-black text-lg text-blue-600 shrink-0">
                              {cs} <span className="text-[10px] font-normal text-slate-500">c/s</span>
                              {p > 0 && <span className="text-slate-700 ml-1">{p} <span className="text-[10px] font-normal text-slate-500">p</span></span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {loading && orderGroups.length === 0 && <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></div>}
            {!loading && orderGroups.length === 0 && <div className="text-center py-12 text-slate-500 border border-dashed rounded-lg bg-white">出荷待ちのデータはありません。</div>}
          </div>
        </div>

        {/* 引当入力 */}
        <div className="w-full lg:w-[65%] flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span> 出荷するLotと数量を入力
          </h2>
          <Card className="border-slate-200 shadow-sm overflow-hidden shrink-0">
            {selectedGroup ? (
              <div className="p-0 flex flex-col h-[calc(100vh-180px)]">
                <div className="bg-slate-50 p-4 border-b border-slate-200 shrink-0">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                    <div>
                      {selectedGroup.customerOrderNo && <div className="text-xs text-slate-500 font-bold mb-1">発注番号: {selectedGroup.customerOrderNo}</div>}
                      <div className="font-black text-xl text-slate-800">{selectedGroup.customerName}</div>
                      <div className="text-xs font-bold text-slate-500 mt-1">納品(着)予定日: {new Date(selectedGroup.desiredShipDate).toLocaleDateString()}</div>
                    </div>
                    {/* ★ 時分秒の入力を追加（デフォルトは 13:00） */}
                    <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                      <label className="font-bold text-sm text-blue-800 ml-2">実際の出荷日時</label>
                      <Input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} disabled={!canEdit} className="bg-white w-36 font-bold text-xs h-9" />
                      <Input type="time" value={shipTime} onChange={e => setShipTime(e.target.value)} disabled={!canEdit} className="bg-white w-24 font-bold text-xs h-9" />
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 bg-slate-100/50 p-4 space-y-6">
                  {selectedGroup.items.map(order => {
                    const productStocks = groupedStocks[order.product_id] || [];
                    const unitPerCs = order.products?.unit_per_cs || 24;

                    const { cs: orderCs, p: orderP } = pcsToDisplay(order.quantity, unitPerCs);

                    const totalInputPcs = productStocks.reduce((sum, stock) => {
                      return sum + displayToPcs(Number(shipInputs[stock.id]?.cs) || 0, Number(shipInputs[stock.id]?.p) || 0, unitPerCs);
                    }, 0);
                    const { cs: inputCs, p: inputP } = pcsToDisplay(totalInputPcs, unitPerCs);

                    return (
                      <div key={order.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-blue-50 border-b border-blue-100 p-3 flex justify-between items-center">
                          <div className="font-bold text-blue-900">{order.products?.name} <span className="text-xs text-blue-600 font-normal">({order.products?.variant_name})</span></div>
                          <div className="flex items-center gap-4">
                            <div className="text-xs font-bold text-slate-500">注文: <span className="text-sm font-black text-slate-800">{orderCs} c/s {orderP > 0 && `${orderP} p`}</span></div>
                            <div className={`text-xs font-bold px-2 py-1 rounded ${totalInputPcs === order.quantity ? 'bg-green-100 text-green-700' : totalInputPcs > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                              入力計: {inputCs} c/s {inputP > 0 && `${inputP} p`}
                            </div>
                          </div>
                        </div>

                        <Table className="text-sm">
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="pl-4 w-[25%]">Lot番号</TableHead>
                              <TableHead className="w-[20%]">期限</TableHead>
                              <TableHead className="text-right bg-slate-50">現在庫</TableHead>
                              <TableHead className="text-center bg-blue-50 border-l">出荷数入力</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {productStocks.map(stock => {
                              const { cs: stockCs, p: stockP } = pcsToDisplay(stock.total_pieces, unitPerCs);

                              const inputCsVal = Number(shipInputs[stock.id]?.cs) || 0;
                              const inputPVal = Number(shipInputs[stock.id]?.p) || 0;
                              const inputTotalPcs = displayToPcs(inputCsVal, inputPVal, unitPerCs);

                              const isOver = inputTotalPcs > stock.total_pieces;
                              const isSelected = inputTotalPcs > 0;

                              return (
                                <TableRow key={stock.id} className={`${isSelected ? "bg-blue-50/30" : ""} transition-colors`}>
                                  <TableCell className="font-black text-slate-700 pl-4 tracking-wider">{stock.lot_code}</TableCell>
                                  <TableCell className="text-slate-500 text-xs">{new Date(stock.expiry_date).toLocaleDateString()}</TableCell>
                                  <TableCell className="text-right bg-slate-50/50">
                                    <span className="font-bold text-slate-700">{stockCs} <span className="text-[10px] font-normal">c/s</span></span>
                                    <span className="ml-1 font-bold text-slate-500">{stockP} <span className="text-[9px] font-normal">p</span></span>
                                  </TableCell>
                                  <TableCell className={`border-l p-1 ${isOver ? 'bg-red-50' : 'bg-blue-50/10'}`}>
                                    <div className="flex items-center justify-center gap-1">
                                      {canEdit ? (
                                        <>
                                          <div className="flex items-end">
                                            <Input type="number" min="0" value={shipInputs[stock.id]?.cs ?? ""} onChange={e => handleInputChange(stock.id, 'cs', e.target.value)} className={`w-14 text-right font-bold h-8 px-1 bg-white ${isOver ? 'border-red-400' : 'border-blue-300'}`} />
                                            <span className="text-[10px] text-slate-500 pb-0.5 pl-0.5">c/s</span>
                                          </div>
                                          <div className="flex items-end">
                                            <Input
                                              type="number" min="0"
                                              max={Math.floor((unitPerCs - 1) / 2)}
                                              value={shipInputs[stock.id]?.p ?? ""}
                                              onChange={e => handleInputChange(stock.id, 'p', e.target.value)}
                                              className={`w-12 text-right font-bold h-8 px-1 bg-white ${isOver ? 'border-red-400' : 'border-blue-300'}`}
                                            />
                                            <span className="text-[10px] text-slate-500 pb-0.5 pl-0.5">p</span>
                                          </div>
                                        </>
                                      ) : (<span className="text-xs text-slate-400">権限なし</span>)}
                                    </div>
                                    {isOver && <div className="text-[10px] text-red-600 font-bold text-center mt-1 leading-none">※在庫超過</div>}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {productStocks.length === 0 && (
                              <TableRow><TableCell colSpan={4} className="text-center py-4 text-xs text-slate-400 bg-slate-50">出荷可能な在庫がありません</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white border-t p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] shrink-0">
                  {canEdit ? (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-md border text-sm font-bold text-slate-700">
                        <input type="checkbox" checked={isOrderCompleted} onChange={e => setIsOrderCompleted(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                        この注文書全体の出荷を完了(リストから消去)にする
                      </label>
                      <Button
                        onClick={handleSaveShipment}
                        disabled={isProcessing
                          || Object.values(shipInputs).every(i => !i.cs && !i.p)
                          || Object.keys(shipInputs).some(stockId => {
                            const input = shipInputs[stockId];
                            const stock = Object.values(groupedStocks).flat().find(s => s.id === stockId);
                            if (!stock) return false;
                            const unitPerCs = stock.products?.unit_per_cs || 24;
                            return displayToPcs(Number(input.cs) || 0, Number(input.p) || 0, unitPerCs) > stock.total_pieces;
                          })
                        }
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 shadow-sm"
                      >
                        {isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ArrowRight className="w-5 h-5 mr-2" />}一括で出荷を確定
                      </Button>
                    </div>
                  ) : (
                    <div className="text-slate-500 font-bold text-center"><Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため出荷処理はできません</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center bg-slate-50">
                <Truck className="h-16 w-16 mb-4 opacity-30 text-blue-500 mx-auto" />
                <p className="text-xl font-bold text-slate-500">リストから注文書を選択してください</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}