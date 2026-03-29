"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Loader2, PackageCheck, Save, Box, AlertCircle, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = { id: string; order_date: string; desired_ship_date: string; quantity: number; status: string; product_id: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_cs: number }; };
type ProductStock = { id: string; lot_code: string; product_id: string; total_pieces: number; expiry_date: string; };

export default function ShipmentsPage() {
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const[orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [stocks, setStocks] = useState<ProductStock[]>([]);
  
  const[shipInputs, setShipInputs] = useState<Record<string, { cs: number | ""; p: number | "" }>>({});
  const [shipDate, setShipDate] = useState("");
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_cs)").in("status", ["received", "in_production"]).order("desired_ship_date", { ascending: true });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  },[]);

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
      const stockUpdates = []; const shipmentInserts = []; const historyInserts =[];
      for (const stock of stocks) {
        const input = shipInputs[stock.id];
        const inputCs = Number(input?.cs) || 0; const inputP = Number(input?.p) || 0;
        const shipPieces = (inputCs * unitPerCs) + inputP;

        if (shipPieces > 0) {
          if (shipPieces > stock.total_pieces) { alert(`Lot[${stock.lot_code}] の出荷数が現在庫を超えています！`); setIsProcessing(false); return; }
          const newTotalPieces = stock.total_pieces - shipPieces;
          stockUpdates.push({ id: stock.id, total_pieces: newTotalPieces });
          
          const random4 = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
          shipmentInserts.push({ id: `SHP-${shipDate.replace(/-/g,"")}-${random4}`, order_id: selectedOrder.id, ship_date: shipDate, lot_code: stock.lot_code, qty_cs: inputCs, qty_piece: inputP, status: "shipped" });
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

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Truck className="h-6 w-6 text-blue-600" /> 出荷管理 (手入力引当)</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1"/> 閲覧モード</Badge>}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[35%]">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span> 出荷対象の受注を選択</h2>
          <div className="space-y-3 h-[calc(100vh-150px)] overflow-y-auto pr-2 pb-10">
            {orders.map((order) => {
              const isLate = new Date(order.desired_ship_date) < new Date(new Date().setHours(0,0,0,0));
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
          </div>
        </div>

        <div className="w-full lg:w-[65%] flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 mb-1 flex items-center gap-2"><span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span> 出荷するLotと数量を入力</h2>
          <Card className="border-slate-200 shadow-sm overflow-hidden shrink-0">
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
                                  <>
                                    <div className="flex items-end gap-1"><Input type="number" min="0" value={shipInputs[stock.id]?.cs ?? ""} onChange={e => handleInputChange(stock.id, 'cs', e.target.value)} className={`w-16 text-right font-bold h-9 bg-white shadow-sm ${isOver ? 'border-red-400 focus-visible:ring-red-500' : 'border-blue-300'}`} /><span className="text-xs font-bold text-slate-500 pb-1 w-4">c/s</span></div>
                                    <div className="flex items-end gap-1"><Input type="number" min="0" value={shipInputs[stock.id]?.p ?? ""} onChange={e => handleInputChange(stock.id, 'p', e.target.value)} className={`w-16 text-right font-bold h-9 bg-white shadow-sm ${isOver ? 'border-red-400 focus-visible:ring-red-500' : 'border-blue-300'}`} /><span className="text-xs font-bold text-slate-500 pb-1 w-4">p</span></div>
                                  </>
                                ) : (<span className="text-sm font-bold text-slate-400">権限なし</span>)}
                              </div>
                              {isOver && <div className="text-[10px] text-red-600 font-bold text-center mt-1">※在庫超過</div>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="bg-white border-t p-6 shadow-inner flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-6">
                    <div><div className="text-xs font-bold text-slate-500 mb-1">出荷合計入力</div><div className="flex items-baseline gap-2"><span className="font-black text-3xl text-blue-700">{totalDisplayCs}</span><span className="text-sm font-bold text-slate-500">c/s</span><span className="font-bold text-xl text-slate-600 ml-2">{totalDisplayP}</span><span className="text-xs font-bold text-slate-500">p</span></div></div>
                    {totalDisplayCs !== selectedOrder.quantity && totalShipPieces > 0 && <div className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded flex items-center gap-1"><AlertCircle className="w-4 h-4"/> 受注数と異なっています</div>}
                  </div>
                  {canEdit ? (
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-md border text-sm font-bold text-slate-700"><input type="checkbox" checked={isOrderCompleted} onChange={e => setIsOrderCompleted(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300"/>この受注を「出荷完了」にする</label>
                      <Button onClick={handleSaveShipment} disabled={isProcessing || totalShipPieces === 0} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 shadow-sm">{isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <ArrowRight className="w-5 h-5 mr-2"/>}出荷を確定</Button>
                    </div>
                  ) : (<div className="text-slate-500 font-bold"><Lock className="w-4 h-4 inline mr-1"/>閲覧モードのため処理できません</div>)}
                </div>
              </div>
            ) : (<div className="p-16 text-center text-slate-400"><Truck className="h-16 w-16 mb-4 opacity-30 text-blue-500 mx-auto" /><p className="text-xl font-bold text-slate-500">リストから出荷対象を選択してください</p></div>)}
          </Card>
        </div>
      </div>
    </div>
  );
}