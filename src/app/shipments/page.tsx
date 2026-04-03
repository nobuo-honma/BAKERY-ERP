"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Loader2, PackageCheck, Save, Box, AlertCircle, ArrowRight, Lock, Printer, ArrowLeft, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = { id: string; order_date: string; planned_ship_date: string; desired_ship_date: string; quantity: number; status: string; product_id: string; customer_order_no?: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_cs: number }; };
type ProductStock = { id: string; lot_code: string; product_id: string; total_pieces: number; expiry_date: string; };

// ★変更: 出荷実績の型に product_id を追加
type Shipment = { id: string; order_id: string; ship_date: string; lot_code: string; qty_cs: number; qty_piece: number; status: string; orders?: { product_id: string; desired_ship_date: string; planned_ship_date: string; customer_order_no?: string; customers?: { name: string }; products?: { name: string; variant_name: string } } };

type OrderGroup = { groupId: string; customerOrderNo: string; plannedShipDate: string; desiredShipDate: string; customerName: string; items: Order[]; isLate: boolean; };

export default function ShipmentsPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'print'>('list');
  const [loading, setLoading] = useState(true);

  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);

  const [groupedStocks, setGroupedStocks] = useState<Record<string, ProductStock[]>>({});
  const [shipments, setShipments] = useState<Shipment[]>([]);

  const [shipInputs, setShipInputs] = useState<Record<string, { cs: number | ""; p: number | "" }>>({});
  const [shipDate, setShipDate] = useState("");
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_cs)").in("status", ["received", "in_production"]).order("planned_ship_date", { ascending: true });

    if (data) {
      const groups: Record<string, OrderGroup> = {};
      const today = new Date(new Date().setHours(0, 0, 0, 0));

      data.forEach((o: any) => {
        const groupKey = o.customer_order_no ? `${o.customer_order_no}_${o.customer_id}_${o.planned_ship_date}` : `${o.id}`;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            groupId: groupKey, customerOrderNo: o.customer_order_no || "",
            plannedShipDate: o.planned_ship_date || o.desired_ship_date,
            desiredShipDate: o.desired_ship_date, customerName: o.customers?.name || "",
            items: [], isLate: new Date(o.planned_ship_date || o.desired_ship_date) < today
          };
        }
        groups[groupKey].items.push(o);
      });
      setOrderGroups(Object.values(groups));
    }

    // ★変更: product_id を追加で取得する
    const { data: sData } = await supabase.from("shipments").select("*, orders(product_id, desired_ship_date, planned_ship_date, customer_order_no, customers(name), products(name, variant_name))").order("ship_date", { ascending: false }).limit(30);
    if (sData) setShipments(sData as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); setShipDate(new Date().toISOString().split('T')[0]); }, [fetchOrders]);

  const handleSelectGroup = async (group: OrderGroup) => {
    setSelectedGroup(group); setShipInputs({}); setIsOrderCompleted(true);
    const productIds = group.items.map(i => i.product_id);
    setShipDate(group.plannedShipDate || new Date().toISOString().split('T')[0]);

    const { data, error } = await supabase.from("product_stocks").select("*").in("product_id", productIds).gt("total_pieces", 0).order("expiry_date", { ascending: true });
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
    setShipInputs(prev => ({ ...prev, [stockId]: { ...prev[stockId], [field]: value === "" ? "" : Number(value) } }));
  };

  const handleSaveShipment = async () => {
    if (!selectedGroup) return;
    const hasInput = Object.values(shipInputs).some(input => (Number(input?.cs) || 0) > 0 || (Number(input?.p) || 0) > 0);
    if (!hasInput) { alert("出荷する数量を入力してください。"); return; }

    setIsProcessing(true);
    try {
      const stockUpdates = []; const stockDeletes = []; const shipmentInserts = []; const historyInserts = [];
      const completedOrderIds = [];

      for (const order of selectedGroup.items) {
        const stocksForProduct = groupedStocks[order.product_id] || [];
        const unitPerCs = order.products?.unit_per_cs || 24;
        let totalShippedForThisOrder = 0;

        for (const stock of stocksForProduct) {
          const input = shipInputs[stock.id];
          const inputCs = Number(input?.cs) || 0; const inputP = Number(input?.p) || 0;
          const shipPieces = (inputCs * unitPerCs) + inputP;

          if (shipPieces > 0) {
            if (shipPieces > stock.total_pieces) { alert(`Lot[${stock.lot_code}] の出荷数が現在庫を超えています！`); setIsProcessing(false); return; }

            const newTotalPieces = stock.total_pieces - shipPieces;
            if (newTotalPieces <= 0) stockDeletes.push(stock.id);
            else stockUpdates.push({ id: stock.id, total_pieces: newTotalPieces });

            const random4 = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            shipmentInserts.push({ id: `SHP-${shipDate.replace(/-/g, "")}-${random4}`, order_id: order.id, ship_date: shipDate, lot_code: stock.lot_code, qty_cs: inputCs, qty_piece: inputP, status: "shipped" });
            historyInserts.push({ product_id: stock.product_id, lot_code: stock.lot_code, before_qty: stock.total_pieces, after_qty: newTotalPieces, reason: `出荷 (${selectedGroup.customerName}様宛)` });

            totalShippedForThisOrder += shipPieces;
          }
        }
        if (totalShippedForThisOrder > 0 || isOrderCompleted) completedOrderIds.push(order.id);
      }

      if (stockUpdates.length > 0) await supabase.from("product_stocks").upsert(stockUpdates, { onConflict: 'id' });
      if (stockDeletes.length > 0) await supabase.from("product_stocks").delete().in('id', stockDeletes);
      if (shipmentInserts.length > 0) await supabase.from("shipments").insert(shipmentInserts);
      if (historyInserts.length > 0) await supabase.from("inventory_adjustments").insert(historyInserts);

      if (isOrderCompleted && completedOrderIds.length > 0) {
        await supabase.from("orders").update({ status: "shipped" }).in("id", completedOrderIds);
        setSelectedGroup(null);
      } else {
        handleSelectGroup(selectedGroup);
      }

      alert("出荷処理が完了し、在庫から正確に減算されました！");
      fetchOrders();
    } catch (err: any) { alert("エラー: " + err.message); }
    setIsProcessing(false);
  };

  // =======================================================================
  // ★変更: 出荷管理票 (PDFプレビュー) のレイアウト調整
  // =======================================================================
  if (viewMode === 'print') {
    const groupedShipments: Record<string, Shipment[]> = {};
    shipments.forEach(s => {
      if (!groupedShipments[s.order_id]) groupedShipments[s.order_id] = [];
      groupedShipments[s.order_id].push(s);
    });

    // ★追加: 1つの受注に紐づく複数のLotを、Lot番号順（古い順）に並べ替える
    const orderChunks = Object.values(groupedShipments).map(group => {
      return group.sort((a, b) => a.lot_code.localeCompare(b.lot_code));
    });

    const chunkedOrders = [];
    for (let i = 0; i < orderChunks.length; i += 3) chunkedOrders.push(orderChunks.slice(i, i + 3));

    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{ __html: `@media print { header, nav { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; } @page { size: A4 portrait; margin: 10mm; } body { background-color: white !important; color: black !important; } .print-hide { display: none !important; } .page-break { page-break-after: always; } }` }} />
        <div className="w-[210mm] print:w-full flex justify-between mb-4 print-hide">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300"><ArrowLeft className="h-4 w-4 mr-2" /> 戻る</Button>
          <div className="flex gap-2">
            <span className="text-sm font-bold bg-white px-3 py-2 rounded border border-slate-300 text-slate-600">※直近の出荷実績から管理票を作成します</span>
            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"><Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)</Button>
          </div>
        </div>

        {chunkedOrders.length === 0 ? (
          <div className="w-[210mm] bg-white p-8 text-center text-slate-500 font-bold shadow-xl">出力可能な出荷実績がありません</div>
        ) : (
          chunkedOrders.map((chunk, pageIdx) => (
            <div key={pageIdx} className={`w-[210mm] min-h-[297mm] bg-white p-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between gap-8 ${pageIdx < chunkedOrders.length - 1 ? 'page-break mb-8 print:mb-0' : ''}`}>
              {chunk.map((group, gIdx) => {
                const first = group[0];
                const totalCs = group.reduce((sum, s) => sum + s.qty_cs, 0);
                const totalP = group.reduce((sum, s) => sum + s.qty_piece, 0);

                return (
                  <div key={gIdx} className="flex-1 flex flex-col border-b-2 border-dashed border-slate-400 pb-6 print:pb-4 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-end mb-2">
                      <h1 className="text-3xl font-bold tracking-[0.5em] ml-8">出 荷 管 理 票</h1>
                      <table className="border-collapse border border-black text-center text-[10px]">
                        <tbody><tr><th className="border border-black px-2 py-0.5 font-medium">ワークセンターやまびこ</th><th className="border border-black px-2 py-0.5 font-medium">制定日</th><td className="border border-black px-3 py-0.5">2021/4/1</td></tr><tr><th className="border border-black px-2 py-0.5 font-medium">文章No.　　YO-29</th><th className="border border-black px-2 py-0.5 font-medium">改定日</th><td className="border border-black px-3 py-0.5">-</td></tr></tbody>
                      </table>
                    </div>
                    <table className="w-full border-collapse border-[2px] border-black text-sm mb-2 mt-2">
                      <thead><tr><th className="border border-black py-1 w-[12%] font-medium">出荷日</th><th className="border border-black py-1 w-[12%] font-medium">着予定日</th><th className="border border-black py-1 w-[52%] font-medium">出荷先</th><th className="border border-black py-1 w-[12%] font-medium">施設長</th><th className="border border-black py-1 w-[12%] font-medium">担当</th></tr></thead>
                      <tbody><tr>
                        {/* ★変更: 高さを h-16 (印鑑が押せるサイズ) に固定 */}
                        <td className="border border-black h-16 text-center font-bold text-xs tracking-wider">{new Date(first.ship_date).toLocaleDateString('ja-JP')}</td>
                        <td className="border border-black text-center font-bold text-xs tracking-wider">{new Date(first.orders?.desired_ship_date || "").toLocaleDateString('ja-JP')}</td>
                        <td className="border border-black px-2 font-bold text-base tracking-wide">{first.orders?.customers?.name}</td>
                        <td className="border border-black"></td><td className="border border-black"></td>
                      </tr></tbody>
                    </table>
                    <table className="w-full border-collapse border-[2px] border-black text-[13px] flex-1">
                      <thead><tr>
                        {/* ★変更: 注番の幅を広く、出荷種類の幅を少し狭く調整 */}
                        <th className="border border-black py-1 w-[14%] font-medium">注番</th>
                        <th className="border border-black py-1 w-[13%] font-medium">出荷種類</th>
                        <th className="border border-black py-1 w-[8%] font-medium">出荷数</th>
                        <th className="border border-black py-1 w-[18%] font-medium">LotNo.</th>
                        <th className="border border-black py-1 w-[9%] font-medium">数量</th>
                        <th className="border border-black py-1 w-[18%] font-medium">LotNo.</th>
                        <th className="border border-black py-1 w-[9%] font-medium">数量</th>
                        <th className="border border-black py-1 w-[11%] font-medium text-[11px] leading-tight">数量確認欄</th>
                      </tr></thead>
                      <tbody>
                        <tr className="h-6">
                          {/* ★変更: 発注番号が長くても入るように break-all を指定し、フォントサイズを微調整 */}
                          <td className="border border-black text-center text-[11px] font-bold px-1 break-all">{first.orders?.customer_order_no ? first.orders.customer_order_no : first.order_id.slice(-4)}</td>

                          {/* ★変更: 出荷種類に product_id (例: C3, MA-C3) を印字 */}
                          <td className="border border-black text-center font-bold text-xs">{first.orders?.product_id}</td>

                          <td className="border border-black text-right pr-1 font-bold text-base">{totalCs}<span className="text-[9px] ml-0.5 font-normal">c/s</span></td>

                          <td className="border border-black text-center font-bold text-xs tracking-wider">{first.lot_code}</td>
                          <td className="border border-black text-right pr-1 font-bold leading-none">{first.qty_cs}<span className="text-[9px] font-normal ml-0.5">c/s</span>{first.qty_piece > 0 && <span className="text-[9px] font-normal ml-0.5">{first.qty_piece}p</span>}</td>

                          <td className="border border-black text-center font-bold text-xs tracking-wider">{group.length > 1 ? group[1].lot_code : ""}</td>
                          <td className="border border-black text-right pr-1 font-bold leading-none">{group.length > 1 ? <>{group[1].qty_cs}<span className="text-[9px] font-normal ml-0.5">c/s</span>{group[1].qty_piece > 0 && <span className="text-[9px] font-normal ml-0.5">{group[1].qty_piece}p</span>}</> : <><span className="text-[9px] text-slate-300">c/s</span></>}</td>

                          <td className="border border-black text-right pr-1 font-bold text-base leading-none pt-1.5">{totalCs}<span className="text-[9px] font-normal ml-0.5">c/s</span>{totalP > 0 && <span className="text-[9px] font-normal ml-0.5">{totalP}p</span>}</td>
                        </tr>
                        {Array.from({ length: 9 }).map((_, i) => {
                          const lotLeft = group[i * 2 + 2]; const lotRight = group[i * 2 + 3];
                          return (
                            <tr key={i} className="h-6">
                              <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black text-right pr-1 pt-2 leading-none text-slate-400 text-[9px]">c/s</td>
                              <td className="border border-black text-center font-bold text-xs tracking-wider">{lotLeft ? lotLeft.lot_code : ""}</td>
                              <td className="border border-black text-right pr-1 font-bold leading-none">{lotLeft ? <>{lotLeft.qty_cs}<span className="text-[9px] font-normal ml-0.5">c/s</span>{lotLeft.qty_piece > 0 && <span className="text-[9px] font-normal ml-0.5">{lotLeft.qty_piece}p</span>}</> : <><span className="text-[9px] text-slate-300">c/s</span></>}</td>
                              <td className="border border-black text-center font-bold text-xs tracking-wider">{lotRight ? lotRight.lot_code : ""}</td>
                              <td className="border border-black text-right pr-1 font-bold leading-none">{lotRight ? <>{lotRight.qty_cs}<span className="text-[9px] font-normal ml-0.5">c/s</span>{lotRight.qty_piece > 0 && <span className="text-[9px] font-normal ml-0.5">{lotRight.qty_piece}p</span>}</> : <><span className="text-[9px] text-slate-300">c/s</span></>}</td>
                              <td className="border border-black"></td>
                            </tr>
                          )
                        })}
                        <tr><td colSpan={8} className="border border-black h-10 px-2 py-1 text-xs align-top bg-slate-50 print:bg-transparent">備考</td></tr>
                      </tbody>
                    </table>
                  </div>
                )
              })}
              {Array.from({ length: 3 - chunk.length }).map((_, idx) => (<div key={`empty-${idx}`} className="flex-1 flex flex-col border-b-2 border-dashed border-slate-400 pb-4 last:border-b-0 opacity-10"><div className="w-full h-full border-2 border-black rounded-md"></div></div>))}
            </div>
          ))
        )}
      </div>
    );
  }

  // =======================================================================
  // 通常のリスト入力画面
  // =======================================================================
  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Truck className="h-6 w-6 text-blue-600" /> 出荷管理 (引当・実績登録)</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        <Button onClick={() => setViewMode('print')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-12 md:h-10"><FileText className="h-4 w-4 mr-2" /> 出荷実績から管理票(PDF)を作成</Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[35%]">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span> 出荷予定の注文書を選択</h2>
          <div className="space-y-3 h-[calc(100vh-150px)] overflow-y-auto pr-2 pb-10">
            {orderGroups.map((group) => (
              <Card key={group.groupId} onClick={() => handleSelectGroup(group)} className={`cursor-pointer transition-all border-2 ${selectedGroup?.groupId === group.groupId ? "border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]" : "border-slate-200 hover:border-blue-300"}`}>
                <CardHeader className="p-4 pb-2 bg-white rounded-t-lg border-b">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      {group.customerOrderNo && <Badge variant="outline" className="w-fit text-[10px] bg-white text-blue-700 font-bold border-blue-200 py-0 mb-1"><FileText className="w-3 h-3 mr-1" />発注: {group.customerOrderNo}</Badge>}
                      <CardTitle className="text-lg text-slate-800 leading-tight">{group.customerName}</CardTitle>
                    </div>
                    <Badge className={`${group.isLate ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-800'} border-none shadow-sm text-xs`}>
                      出荷予定: {new Date(group.plannedShipDate).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 bg-slate-50 rounded-b-lg">
                  {group.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center px-4 py-2 border-b last:border-0 border-slate-100 text-sm">
                      <div className="font-bold text-slate-700">{item.products?.name} <span className="text-xs font-normal text-slate-500">({item.products?.variant_name})</span></div>
                      <div className="font-black text-slate-700">{item.quantity} <span className="text-[10px] font-normal text-slate-500">c/s</span></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
            {loading && orderGroups.length === 0 && <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></div>}
            {!loading && orderGroups.length === 0 && <div className="text-center py-12 text-slate-500 border border-dashed rounded-lg bg-white">出荷待ちのデータはありません。</div>}
          </div>
        </div>

        <div className="w-full lg:w-[65%] flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 mb-1 flex items-center gap-2"><span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span> 出荷するLotと数量を入力</h2>
          <Card className="border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
            {selectedGroup ? (
              <div className="p-0 flex flex-col h-[calc(100vh-180px)]">

                <div className="bg-slate-50 p-4 border-b border-slate-200 shrink-0">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                    <div>
                      {selectedGroup.customerOrderNo && <div className="text-xs text-slate-500 font-bold mb-1">発注番号: {selectedGroup.customerOrderNo}</div>}
                      <div className="font-black text-xl text-slate-800">{selectedGroup.customerName}</div>
                      <div className="text-xs font-bold text-slate-500 mt-1">納品(着)予定日: {new Date(selectedGroup.desiredShipDate).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm">
                      <label className="font-bold text-sm text-blue-800 ml-2">実際の出荷日</label>
                      <Input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} disabled={!canEdit} className="bg-white w-40 font-bold" />
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 bg-slate-100/50 p-4 space-y-6">
                  {selectedGroup.items.map(order => {
                    const productStocks = groupedStocks[order.product_id] || [];
                    const unitPerCs = order.products?.unit_per_cs || 24;
                    const totalPiecesForThisProduct = productStocks.reduce((sum, stock) => sum + ((Number(shipInputs[stock.id]?.cs) || 0) * unitPerCs) + (Number(shipInputs[stock.id]?.p) || 0), 0);
                    const displayCs = Math.floor(totalPiecesForThisProduct / unitPerCs);
                    const displayP = totalPiecesForThisProduct % unitPerCs;

                    return (
                      <div key={order.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-blue-50 border-b border-blue-100 p-3 flex justify-between items-center">
                          <div className="font-bold text-blue-900">{order.products?.name} <span className="text-xs text-blue-600 font-normal">({order.products?.variant_name})</span></div>
                          <div className="flex items-center gap-4">
                            <div className="text-xs font-bold text-slate-500">注文: <span className="text-sm font-black text-slate-800">{order.quantity} c/s</span></div>
                            <div className={`text-xs font-bold px-2 py-1 rounded ${displayCs === order.quantity ? 'bg-green-100 text-green-700' : totalPiecesForThisProduct > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                              入力計: {displayCs} c/s {displayP > 0 && `${displayP} p`}
                            </div>
                          </div>
                        </div>

                        <Table className="text-sm">
                          <TableHeader className="bg-slate-50"><TableRow><TableHead className="pl-4 w-[25%]">Lot番号</TableHead><TableHead className="w-[20%]">期限</TableHead><TableHead className="text-right bg-slate-50">現在庫</TableHead><TableHead className="text-center bg-blue-50 border-l">出荷数入力</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {productStocks.map(stock => {
                              const stockCs = Math.floor(stock.total_pieces / unitPerCs); const stockPiece = stock.total_pieces % unitPerCs;
                              const inputCs = Number(shipInputs[stock.id]?.cs) || 0; const inputP = Number(shipInputs[stock.id]?.p) || 0;
                              const isOver = ((inputCs * unitPerCs) + inputP) > stock.total_pieces; const isSelected = ((inputCs * unitPerCs) + inputP) > 0;
                              return (
                                <TableRow key={stock.id} className={`${isSelected ? "bg-blue-50/30" : ""} transition-colors`}>
                                  <TableCell className="font-black text-slate-700 pl-4 tracking-wider">{stock.lot_code}</TableCell>
                                  <TableCell className="text-slate-500 text-xs">{new Date(stock.expiry_date).toLocaleDateString()}</TableCell>
                                  <TableCell className="text-right bg-slate-50/50"><span className="font-bold text-slate-700">{stockCs} <span className="text-[10px] font-normal">c/s</span></span><span className="ml-1 font-bold text-slate-500">{stockPiece} <span className="text-[9px] font-normal">p</span></span></TableCell>
                                  <TableCell className={`border-l p-1 ${isOver ? 'bg-red-50' : 'bg-blue-50/10'}`}>
                                    <div className="flex items-center justify-center gap-1">
                                      {canEdit ? (
                                        <><div className="flex items-end"><Input type="number" min="0" value={shipInputs[stock.id]?.cs ?? ""} onChange={e => handleInputChange(stock.id, 'cs', e.target.value)} className={`w-14 text-right font-bold h-8 px-1 bg-white ${isOver ? 'border-red-400' : ''}`} /><span className="text-[10px] text-slate-500 pb-0.5 pl-0.5">c/s</span></div><div className="flex items-end"><Input type="number" min="0" value={shipInputs[stock.id]?.p ?? ""} onChange={e => handleInputChange(stock.id, 'p', e.target.value)} className={`w-12 text-right font-bold h-8 px-1 bg-white ${isOver ? 'border-red-400' : ''}`} /><span className="text-[10px] text-slate-500 pb-0.5 pl-0.5">p</span></div></>
                                      ) : (<span className="text-xs text-slate-400">権限なし</span>)}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {productStocks.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-xs text-slate-400 bg-slate-50">出荷可能な在庫がありません</TableCell></TableRow>}
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
                      <Button onClick={handleSaveShipment} disabled={isProcessing || Object.values(shipInputs).every(i => !i.cs && !i.p)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 shadow-sm">
                        {isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ArrowRight className="w-5 h-5 mr-2" />}一括で出荷を確定
                      </Button>
                    </div>
                  ) : (<div className="text-slate-500 font-bold text-center"><Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため出荷処理はできません</div>)}
                </div>
              </div>
            ) : (<div className="p-16 text-center text-slate-400 flex flex-col items-center bg-slate-50"><Truck className="h-16 w-16 mb-4 opacity-30 text-blue-500 mx-auto" /><p className="text-xl font-bold text-slate-500">リストから注文書を選択してください</p></div>)}
          </Card>
        </div>
      </div>
    </div>
  );
}