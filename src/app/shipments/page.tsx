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

type Order = { id: string; order_date: string; desired_ship_date: string; quantity: number; status: string; product_id: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_cs: number }; };
type ProductStock = { id: string; lot_code: string; product_id: string; total_pieces: number; expiry_date: string; };

export default function ShipmentsPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'print'>('list');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [stocks, setStocks] = useState<ProductStock[]>([]);

  const [shipInputs, setShipInputs] = useState<Record<string, { cs: number | ""; p: number | "" }>>({});
  const [shipDate, setShipDate] = useState("");
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_cs)").in("status", ["received", "in_production"]).order("desired_ship_date", { ascending: true });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders(); setShipDate(new Date().toISOString().split('T')[0]);
  }, [fetchOrders]);

  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order); setShipInputs({}); setIsOrderCompleted(true);
    const { data } = await supabase.from("product_stocks").select("*").eq("product_id", order.product_id).gt("total_pieces", 0).order("expiry_date", { ascending: true });
    if (data) setStocks(data as ProductStock[]);
  };

  const handleInputChange = (stockId: string, field: 'cs' | 'p', value: string) => {
    setShipInputs(prev => ({ ...prev, [stockId]: { ...prev[stockId], [field]: value === "" ? "" : Number(value) } }));
  };

  const unitPerCs = selectedOrder?.products?.unit_per_cs || 24;
  const totalShipPieces = Object.values(shipInputs).reduce((sum, input) => sum + ((Number(input?.cs) || 0) * unitPerCs) + (Number(input?.p) || 0), 0);
  const totalDisplayCs = Math.floor(totalShipPieces / unitPerCs);
  const totalDisplayP = totalShipPieces % unitPerCs;

  const handleSaveShipment = async () => {
    if (!selectedOrder) return;
    if (totalShipPieces === 0) { alert("出荷する数量を入力してください。"); return; }

    setIsProcessing(true);
    try {
      const stockUpdates = []; const shipmentInserts = []; const historyInserts = [];
      for (const stock of stocks) {
        const input = shipInputs[stock.id];
        const inputCs = Number(input?.cs) || 0; const inputP = Number(input?.p) || 0;
        const shipPieces = (inputCs * unitPerCs) + inputP;

        if (shipPieces > 0) {
          if (shipPieces > stock.total_pieces) { alert(`Lot[${stock.lot_code}] の出荷数が現在庫を超えています！`); setIsProcessing(false); return; }
          const newTotalPieces = stock.total_pieces - shipPieces;
          stockUpdates.push({ id: stock.id, total_pieces: newTotalPieces });

          const random4 = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
          shipmentInserts.push({ id: `SHP-${shipDate.replace(/-/g, "")}-${random4}`, order_id: selectedOrder.id, ship_date: shipDate, lot_code: stock.lot_code, qty_cs: inputCs, qty_piece: inputP, status: "shipped" });
          historyInserts.push({ product_id: stock.product_id, lot_code: stock.lot_code, before_qty: stock.total_pieces, after_qty: newTotalPieces, reason: `出荷 (${selectedOrder.customers?.name}様宛)` });
        }
      }

      await supabase.from("product_stocks").upsert(stockUpdates, { onConflict: 'id' });
      await supabase.from("shipments").insert(shipmentInserts);
      await supabase.from("inventory_adjustments").insert(historyInserts);

      if (isOrderCompleted) {
        await supabase.from("orders").update({ status: "shipped" }).eq("id", selectedOrder.id);
        setSelectedOrder(null);
      } else handleSelectOrder(selectedOrder);

      alert("出荷処理が完了し、在庫が引き落とされました！"); fetchOrders();
    } catch (err: any) { alert("エラー: " + err.message); }
    setIsProcessing(false);
  };

  // =======================================================================
  // ★追加: 出荷管理票 (PDFプレビュー・印刷画面)
  // =======================================================================
  if (viewMode === 'print') {
    // 3件ずつページに分割
    const chunkedOrders = [];
    for (let i = 0; i < orders.length; i += 3) {
      chunkedOrders.push(orders.slice(i, i + 3));
    }

    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            header, nav { display: none !important; }
            main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
            @page { size: A4 portrait; margin: 10mm; }
            body { background-color: white !important; color: black !important; }
            .print-hide { display: none !important; }
            .page-break { page-break-after: always; }
          }
        `}} />

        <div className="w-[210mm] print:w-full flex justify-between mb-4 print-hide">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300">
            <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
          </Button>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
            <Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)
          </Button>
        </div>

        {chunkedOrders.length === 0 ? (
          <div className="w-[210mm] bg-white p-8 text-center text-slate-500 font-bold shadow-xl">出力可能な出荷待ちデータがありません</div>
        ) : (
          chunkedOrders.map((chunk, pageIdx) => (
            <div key={pageIdx} className={`w-[210mm] min-h-[297mm] bg-white p-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between gap-8 ${pageIdx < chunkedOrders.length - 1 ? 'page-break mb-8 print:mb-0' : ''}`}>

              {chunk.map((order, idx) => (
                <div key={order.id} className="flex-1 flex flex-col border-b-2 border-dashed border-slate-400 pb-6 print:pb-4 last:border-b-0 last:pb-0">

                  {/* ヘッダー部分 */}
                  <div className="flex justify-between items-end mb-2">
                    <h1 className="text-3xl font-bold tracking-[0.5em] ml-8">出 荷 管 理 票</h1>
                    <table className="border-collapse border border-black text-center text-[10px]">
                      <tbody>
                        <tr>
                          <th className="border border-black px-2 py-0.5 font-medium">ワークセンターやまびこ</th>
                          <th className="border border-black px-2 py-0.5 font-medium">制定日</th>
                          <td className="border border-black px-3 py-0.5">2021/4/1</td>
                        </tr>
                        <tr>
                          <th className="border border-black px-2 py-0.5 font-medium">文章No.　　YO-29</th>
                          <th className="border border-black px-2 py-0.5 font-medium">改定日</th>
                          <td className="border border-black px-3 py-0.5">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 出荷情報テーブル */}
                  <table className="w-full border-collapse border-[2px] border-black text-sm mb-2 mt-2">
                    <thead>
                      <tr>
                        <th className="border border-black py-1 w-[12%] font-medium">出荷日</th>
                        <th className="border border-black py-1 w-[12%] font-medium">着予定日</th>
                        <th className="border border-black py-1 w-[52%] font-medium">出荷先</th>
                        <th className="border border-black py-1 w-[12%] font-medium">施設長</th>
                        <th className="border border-black py-1 w-[12%] font-medium">担当</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black h-8 text-center font-bold text-xs"></td>
                        <td className="border border-black text-center font-bold text-xs tracking-wider">{new Date(order.desired_ship_date).toLocaleDateString('ja-JP')}</td>
                        <td className="border border-black px-2 font-bold text-base tracking-wide">{order.customers?.name}</td>
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* 明細テーブル (全10行固定) */}
                  <table className="w-full border-collapse border-[2px] border-black text-[13px] flex-1">
                    <thead>
                      <tr>
                        <th className="border border-black py-1 w-[8%] font-medium">注番</th>
                        <th className="border border-black py-1 w-[20%] font-medium">出荷種類</th>
                        <th className="border border-black py-1 w-[8%] font-medium">出荷数</th>
                        <th className="border border-black py-1 w-[18%] font-medium">LotNo.</th>
                        <th className="border border-black py-1 w-[9%] font-medium">数量</th>
                        <th className="border border-black py-1 w-[18%] font-medium">LotNo.</th>
                        <th className="border border-black py-1 w-[9%] font-medium">数量</th>
                        <th className="border border-black py-1 w-[10%] font-medium text-[11px] leading-tight">数量確認欄</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="h-6">
                        <td className="border border-black text-center text-xs font-mono">{order.id.slice(-4)}</td>
                        <td className="border border-black px-1 font-bold truncate max-w-[120px]" title={order.products?.name}>{order.products?.name}</td>
                        <td className="border border-black text-right pr-1 font-bold text-base">{order.quantity}<span className="text-[9px] ml-0.5 font-normal">c/s</span></td>
                        <td className="border border-black"></td>
                        <td className="border border-black text-right pr-1 pt-2 leading-none"><span className="text-[9px] text-slate-400">c/s</span></td>
                        <td className="border border-black"></td>
                        <td className="border border-black text-right pr-1 pt-2 leading-none"><span className="text-[9px] text-slate-400">c/s</span></td>
                        <td className="border border-black text-right pr-1 pt-2 leading-none"><span className="text-[9px] text-slate-400">c/s</span></td>
                      </tr>
                      {Array.from({ length: 9 }).map((_, i) => (
                        <tr key={i} className="h-6">
                          <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black text-right pr-1 pt-2 leading-none text-slate-400 text-[9px]">c/s</td>
                          <td className="border border-black"></td><td className="border border-black text-right pr-1 pt-2 leading-none text-slate-400 text-[9px]">c/s</td>
                          <td className="border border-black"></td><td className="border border-black text-right pr-1 pt-2 leading-none text-slate-400 text-[9px]">c/s</td>
                          <td className="border border-black text-right pr-1 pt-2 leading-none text-slate-400 text-[9px]">c/s</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={8} className="border border-black h-10 px-2 py-1 text-xs align-top bg-slate-50 print:bg-transparent">
                          備考
                        </td>
                      </tr>
                    </tbody>
                  </table>

                </div>
              ))}

              {/* 3件に満たない場合の空枠 */}
              {Array.from({ length: 3 - chunk.length }).map((_, idx) => (
                <div key={`empty-${idx}`} className="flex-1 flex flex-col border-b-2 border-dashed border-slate-400 pb-4 last:border-b-0 opacity-10">
                  <div className="w-full h-full border-2 border-black rounded-md"></div>
                </div>
              ))}

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
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Truck className="h-6 w-6 text-blue-600" /> 出荷管理 (手動引き当て)</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        {/* ★追加: 出荷管理票(PDF)作成ボタン */}
        <Button onClick={() => setViewMode('print')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-12 md:h-10">
          <FileText className="h-4 w-4 mr-2" /> 出荷管理票(PDF)作成
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[35%]">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span> 出荷対象の受注を選択</h2>
          <div className="space-y-3 h-[calc(100vh-150px)] overflow-y-auto pr-2 pb-10">
            {orders.map((order) => {
              const isLate = new Date(order.desired_ship_date) < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <Card key={order.id} onClick={() => handleSelectOrder(order)} className={`cursor-pointer transition-all border-2 ${selectedOrder?.id === order.id ? "border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]" : "border-slate-200 hover:border-blue-300"}`}>
                  <CardHeader className="p-4 pb-2 bg-white rounded-t-lg"><div className="flex justify-between items-start"><div className="text-xs text-slate-500">{order.id}</div><Badge className={`${isLate ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-800'} border-none shadow-sm text-xs`}>納期: {new Date(order.desired_ship_date).toLocaleDateString()}</Badge></div><CardTitle className="text-base text-slate-800 leading-tight mt-1">{order.customers?.name}</CardTitle></CardHeader>
                  <CardContent className="p-4 pt-2 text-sm text-slate-600 bg-white rounded-b-lg">
                    <div className="font-bold text-slate-800 mb-2">{order.products?.name} ({order.products?.variant_name})</div>
                    <div className="flex items-center justify-between border-t pt-2"><span className="text-xs text-slate-500">状態: {order.status === 'in_production' ? <span className="text-amber-600 font-bold">製造中あり</span> : "在庫引当"}</span><div className="flex items-baseline gap-1"><span className="text-xs text-slate-500">受注数:</span><span className="font-black text-xl text-blue-600">{order.quantity}</span><span className="text-xs font-normal text-slate-500">c/s</span></div></div>
                  </CardContent>
                </Card>
              );
            })}
            {loading && orders.length === 0 && <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></div>}
            {!loading && orders.length === 0 && <div className="text-center py-12 text-slate-500 border border-dashed rounded-lg bg-white">出荷待ちのデータはありません。</div>}
          </div>
        </div>

        <div className="w-full lg:w-[65%] flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 mb-1 flex items-center gap-2"><span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span> 出荷するLotと数量を入力</h2>
          <Card className="border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
            {selectedOrder ? (
              <div className="p-0">
                <div className="bg-slate-50 p-6 border-b border-slate-200">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div><div className="text-xs text-slate-500 mb-1">出荷先: {selectedOrder.customers?.name}</div><div className="font-bold text-xl text-slate-800">{selectedOrder.products?.name} <span className="text-base font-normal text-slate-600">({selectedOrder.products?.variant_name})</span></div></div>
                    <div className="text-right bg-white px-4 py-2 rounded-md shadow-sm border border-slate-200"><div className="text-xs text-slate-500 mb-1">受注合計</div><div className="font-black text-2xl text-blue-600">{selectedOrder.quantity} <span className="text-sm font-normal text-slate-500">c/s</span></div></div>
                  </div>
                  <div className="flex items-center gap-4"><label className="font-bold text-sm text-slate-700">出荷日</label><Input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} disabled={!canEdit} className="bg-white w-48 shadow-sm" /></div>
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  <Table className="min-w-[700px]">
                    <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm"><TableRow><TableHead className="pl-6 w-[20%]">Lot番号</TableHead><TableHead className="w-[20%]">賞味期限</TableHead><TableHead className="w-[25%] text-right bg-slate-50">現在庫</TableHead><TableHead className="w-[35%] text-center bg-blue-50 text-blue-900 font-bold border-l border-blue-200">今回出荷する数量</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {stocks.map((stock) => {
                        const stockCs = Math.floor(stock.total_pieces / unitPerCs); const stockPiece = stock.total_pieces % unitPerCs;
                        const inputCs = Number(shipInputs[stock.id]?.cs) || 0; const inputP = Number(shipInputs[stock.id]?.p) || 0;
                        const isOver = ((inputCs * unitPerCs) + inputP) > stock.total_pieces; const isSelected = ((inputCs * unitPerCs) + inputP) > 0;
                        return (
                          <TableRow key={stock.id} className={`${isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"} transition-colors`}>
                            <TableCell className="font-black text-slate-800 pl-6 text-base tracking-wider">{stock.lot_code}</TableCell>
                            <TableCell className="font-bold text-slate-600">{new Date(stock.expiry_date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right bg-slate-50/50"><span className="font-bold text-lg text-slate-800">{stockCs} <span className="text-xs font-normal text-slate-500">c/s</span></span><span className="ml-2 font-bold text-slate-600">{stockPiece} <span className="text-[10px] font-normal text-slate-400">p</span></span></TableCell>
                            <TableCell className={`border-l ${isOver ? 'bg-red-50 border-red-200' : 'bg-blue-50/30 border-blue-100'}`}>
                              <div className="flex items-center justify-center gap-2">
                                {canEdit ? (
                                  <><div className="flex items-end gap-1"><Input type="number" min="0" value={shipInputs[stock.id]?.cs ?? ""} onChange={e => handleInputChange(stock.id, 'cs', e.target.value)} className={`w-16 text-right font-bold h-9 bg-white shadow-sm ${isOver ? 'border-red-400 focus-visible:ring-red-500' : 'border-blue-300'}`} /><span className="text-xs font-bold text-slate-500 pb-1 w-4">c/s</span></div><div className="flex items-end gap-1"><Input type="number" min="0" value={shipInputs[stock.id]?.p ?? ""} onChange={e => handleInputChange(stock.id, 'p', e.target.value)} className={`w-16 text-right font-bold h-9 bg-white shadow-sm ${isOver ? 'border-red-400 focus-visible:ring-red-500' : 'border-blue-300'}`} /><span className="text-xs font-bold text-slate-500 pb-1 w-4">p</span></div></>
                                ) : (<span className="text-sm font-bold text-slate-400">権限なし</span>)}
                              </div>
                              {isOver && <div className="text-[10px] text-red-600 font-bold text-center mt-1">※在庫超過</div>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {stocks.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-16 text-slate-500 bg-slate-50"><Box className="w-12 h-12 text-slate-300 mx-auto mb-2" />この製品の完成品在庫がありません。<br />製造を完了するか、在庫棚卸を行ってください。</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
                <div className="bg-white border-t p-6 shadow-inner flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-6">
                    <div><div className="text-xs font-bold text-slate-500 mb-1">出荷合計入力</div><div className="flex items-baseline gap-2"><span className="font-black text-3xl text-blue-700">{totalDisplayCs}</span><span className="text-sm font-bold text-slate-500">c/s</span><span className="font-bold text-xl text-slate-600 ml-2">{totalDisplayP}</span><span className="text-xs font-bold text-slate-500">p</span></div></div>
                    {totalDisplayCs !== selectedOrder.quantity && totalShipPieces > 0 && <div className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded flex items-center gap-1"><AlertCircle className="w-4 h-4" /> 受注数と異なっています</div>}
                  </div>
                  {canEdit ? (
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-md border text-sm font-bold text-slate-700"><input type="checkbox" checked={isOrderCompleted} onChange={e => setIsOrderCompleted(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />この受注を「出荷完了」にする</label>
                      <Button onClick={handleSaveShipment} disabled={isProcessing || totalShipPieces === 0} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 shadow-sm"><ArrowRight className="w-5 h-5 mr-2" />出荷を確定して在庫から減算</Button>
                    </div>
                  ) : (<div className="text-slate-500 font-bold"><Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため出荷処理はできません</div>)}
                </div>
              </div>
            ) : (<div className="p-16 text-center text-slate-400 flex flex-col items-center bg-slate-50"><Truck className="h-16 w-16 mb-4 opacity-30 text-blue-500" /><p className="text-xl font-bold text-slate-500">リストから出荷対象を選択してください</p></div>)}
          </Card>
        </div>
      </div>
    </div>
  );
}