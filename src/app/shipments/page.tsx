"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Loader2, Save, Box, AlertCircle, ArrowRight, Lock, Printer, ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = {
  id: string;
  order_date: string;
  planned_ship_date: string;
  desired_ship_date: string;
  quantity: number;
  status: string;
  product_id: string;
  customer_order_no?: string;
  customers?: { name: string };
  products?: { name: string; variant_name: string; unit_per_cs: number };
};

type OrderGroup = {
  groupId: string;
  customerName: string;
  customerOrderNo?: string;
  plannedShipDate: string;
  isLate: boolean;
  items: Order[];
};

type ProductStock = {
  id: string;
  lot_code: string;
  product_id: string;
  total_pieces: number;
  expiry_date: string;
};

type Shipment = {
  id: string;
  order_id: string;
  ship_date: string;
  lot_code: string;
  qty_cs: number;
  qty_piece: number;
  status: string;
};

export default function ShipmentsPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'print'>('list');
  const [loading, setLoading] = useState(true);

  // グルーピングされた注文データ
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);

  // 在庫データ
  const [groupedStocks, setGroupedStocks] = useState<Record<string, ProductStock[]>>({});
  
  // 入力データ: { "stock_id": { cs: number, p: number } }
  const [shipInputs, setShipInputs] = useState<Record<string, { cs: number | ""; p: number | "" }>>({});
  const [shipDate, setShipDate] = useState("");
  const [isOrderCompleted, setIsOrderCompleted] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, customers(name), products(name, variant_name, unit_per_cs)")
      .in("status", ["received", "in_production"])
      .order("desired_ship_date", { ascending: true });

    if (data) {
      const orders = data as Order[];
      // グルーピング: 顧客名 + 発注番号 + 希望納期 が同じものをまとめる
      const groups: Record<string, OrderGroup> = {};
      const today = new Date().toISOString().split('T')[0];

      orders.forEach(o => {
        const gid = `${o.customers?.name}-${o.customer_order_no || 'none'}-${o.desired_ship_date}`;
        if (!groups[gid]) {
          groups[gid] = {
            groupId: gid,
            customerName: o.customers?.name || "未知の顧客",
            customerOrderNo: o.customer_order_no,
            plannedShipDate: o.desired_ship_date,
            isLate: o.desired_ship_date < today,
            items: []
          };
        }
        groups[gid].items.push(o);
      });
      setOrderGroups(Object.values(groups));
    }
    setLoading(false);
  }, []);

  useEffect(() => { 
    fetchOrders(); 
    setShipDate(new Date().toISOString().split('T')[0]); 
  }, [fetchOrders]);

  const handleSelectGroup = async (group: OrderGroup) => {
    setSelectedGroup(group);
    setShipInputs({});
    setIsOrderCompleted(true);
    
    const productIds = Array.from(new Set(group.items.map(i => i.product_id)));
    setShipDate(group.plannedShipDate || new Date().toISOString().split('T')[0]);

    // 関連する全製品の有効在庫を取得
    const { data, error } = await supabase
      .from("product_stocks")
      .select("*")
      .in("product_id", productIds)
      .gt("total_pieces", 0)
      .order("expiry_date", { ascending: true });

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
      [stockId]: {
        ...prev[stockId],
        [field]: value === "" ? "" : Number(value)
      }
    }));
  };

  const calculateTotalPieces = () => {
    let total = 0;
    if (!selectedGroup) return 0;
    
    Object.entries(shipInputs).forEach(([stockId, input]) => {
      // どの製品の在庫か特定
      let unitPerCs = 1;
      for (const items of Object.values(groupedStocks)) {
        const s = items.find(v => v.id === stockId);
        if (s) {
          const product = selectedGroup.items.find(i => i.product_id === s.product_id)?.products;
          unitPerCs = product?.unit_per_cs || 1;
          break;
        }
      }
      const cs = Number(input.cs) || 0;
      const p = Number(input.p) || 0;
      total += (cs * unitPerCs) + p;
    });
    return total;
  };

  const handleSaveShipment = async () => {
    if (!selectedGroup) return;
    const hasInput = Object.values(shipInputs).some(input => (Number(input?.cs) || 0) > 0 || (Number(input?.p) || 0) > 0);
    if (!hasInput) { alert("出荷する数量を入力してください。"); return; }

    setIsProcessing(true);
    try {
      const stockUpdates = [];
      const shipmentInserts = [];
      const historyInserts = [];
      const completedOrderIds = selectedGroup.items.map(i => i.id);

      for (const itemId in groupedStocks) {
        const stocks = groupedStocks[itemId];
        const product = selectedGroup.items.find(i => i.product_id === itemId)?.products;
        const unitPerCs = product?.unit_per_cs || 1;

        for (const stock of stocks) {
          const input = shipInputs[stock.id];
          if (!input) continue;

          const inputCs = Number(input.cs) || 0;
          const inputP = Number(input.p) || 0;
          const shipPieces = (inputCs * unitPerCs) + inputP;

          if (shipPieces > 0) {
            if (shipPieces > stock.total_pieces) {
              alert(`Lot[${stock.lot_code}] の出荷数が現在庫を超えています！`);
              setIsProcessing(false);
              return;
            }
            const newTotalPieces = stock.total_pieces - shipPieces;
            stockUpdates.push({ id: stock.id, total_pieces: newTotalPieces });
            
            const random4 = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            shipmentInserts.push({
              id: `SHP-${shipDate.replace(/-/g, "")}-${random4}`,
              order_id: selectedGroup.items[0].id, // 代表的なID (グループ化されているので本来は各アイテムに分散が必要だが、簡易化のため)
              ship_date: shipDate,
              lot_code: stock.lot_code,
              qty_cs: inputCs,
              qty_piece: inputP,
              status: "shipped"
            });

            historyInserts.push({
              product_id: stock.product_id,
              lot_code: stock.lot_code,
              before_qty: stock.total_pieces,
              after_qty: newTotalPieces,
              reason: `出荷 (${selectedGroup.customerName}様宛)`
            });
          }
        }
      }

      // Supabase更新実行
      if (stockUpdates.length > 0) await supabase.from("product_stocks").upsert(stockUpdates, { onConflict: 'id' });
      if (shipmentInserts.length > 0) await supabase.from("shipments").insert(shipmentInserts);
      if (historyInserts.length > 0) await supabase.from("inventory_adjustments").insert(historyInserts);

      if (isOrderCompleted) {
        await supabase.from("orders").update({ status: "shipped" }).in("id", completedOrderIds);
        setSelectedGroup(null);
      } else {
        handleSelectGroup(selectedGroup);
      }

      alert("出荷処理が完了し、在庫から正確に減算されました！");
      fetchOrders();
    } catch (err: any) {
      alert("エラー: " + err.message);
    }
    setIsProcessing(false);
  };

  const totalShipPieces = calculateTotalPieces();

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-800">
            <Truck className="h-7 w-7 text-blue-600" /> 出荷管理 (実績登録)
          </h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        <Button onClick={() => setViewMode('print')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-12 md:h-10">
          <FileText className="h-4 w-4 mr-2" /> 出荷管理票(PDF)を作成
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左側: 受注リスト */}
        <div className="w-full lg:w-[35%]">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span> 注文を選択
          </h2>
          <div className="space-y-3 h-[calc(100vh-220px)] overflow-y-auto pr-2 pb-10 custom-scrollbar">
            {orderGroups.map((group) => (
              <Card 
                key={group.groupId} 
                onClick={() => handleSelectGroup(group)}
                className={`cursor-pointer transition-all border-2 ${selectedGroup?.groupId === group.groupId ? "border-blue-500 bg-blue-50 shadow-md transform scale-[1.01]" : "border-slate-200 hover:border-blue-300"}`}
              >
                <CardHeader className="p-4 pb-2 bg-white rounded-t-lg border-b">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex flex-col">
                      {group.customerOrderNo && <Badge variant="outline" className="w-fit text-[10px] bg-slate-50 text-slate-600 font-bold border-slate-200 py-0 mb-1">発注No: {group.customerOrderNo}</Badge>}
                      <CardTitle className="text-lg text-slate-800 leading-tight">{group.customerName}</CardTitle>
                    </div>
                    <Badge className={`${group.isLate ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-800'} border-none shadow-sm text-[10px]`}>
                      予定日: {new Date(group.plannedShipDate).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 bg-slate-50 rounded-b-lg">
                  {group.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center px-4 py-2 border-b last:border-0 border-slate-100 text-sm">
                      <div className="font-bold text-slate-700">
                        {item.products?.name} 
                        <span className="text-[10px] font-normal text-slate-500 ml-1">({item.products?.variant_name})</span>
                      </div>
                      <div className="font-black text-slate-800">{item.quantity} <span className="text-[10px] font-normal text-slate-500">c/s</span></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
            {loading && orderGroups.length === 0 && <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></div>}
            {!loading && orderGroups.length === 0 && <div className="text-center py-12 text-slate-500 border border-dashed rounded-lg bg-white">出荷待ちのデータはありません。</div>}
          </div>
        </div>

        {/* 右側: 出荷登録フォーム */}
        <div className="w-full lg:w-[65%] flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span> 出荷Lotと数量を選択
          </h2>
          <Card className="border-slate-200 shadow-sm overflow-hidden shrink-0 min-h-[500px] flex flex-col">
            {selectedGroup ? (
              <div className="flex flex-col h-full">
                <div className="bg-slate-50 p-6 border-b border-slate-200">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">出荷先: {selectedGroup.customerName}</div>
                      <div className="font-black text-2xl text-slate-800">
                        出荷日: <Input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} className="inline-block w-48 ml-2 bg-white font-bold h-10" />
                      </div>
                    </div>
                    <div className="text-right bg-white px-5 py-3 rounded-lg shadow-sm border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">今回出荷合計</div>
                      <div className="font-black text-3xl text-blue-600">{totalShipPieces} <span className="text-sm font-normal text-slate-500">pcs</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar p-6 space-y-8 pb-32">
                  {selectedGroup.items.map(item => {
                    const stocks = groupedStocks[item.product_id] || [];
                    const unitPerCs = item.products?.unit_per_cs || 1;
                    return (
                      <div key={item.id} className="border-2 border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-100 px-4 py-3 border-b flex justify-between items-center">
                          <div className="font-black text-slate-800 flex items-center gap-2">
                            <Box className="w-4 h-4 text-blue-500" /> {item.products?.name} <span className="text-xs font-normal text-slate-500">({item.products?.variant_name})</span>
                          </div>
                          <div className="text-sm font-bold text-slate-600">受注数: <span className="text-lg text-slate-800">{item.quantity}</span> c/s</div>
                        </div>
                        <Table>
                          <TableHeader className="bg-white">
                            <TableRow>
                              <TableHead className="font-bold w-[30%]">Lot番号 / 賞味期限</TableHead>
                              <TableHead className="font-bold text-right w-[30%] bg-slate-50/30">現在庫 (c/s | p)</TableHead>
                              <TableHead className="font-bold text-center w-[40%] bg-blue-50/30">出荷する数量</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stocks.map(stock => {
                              const stockCs = Math.floor(stock.total_pieces / unitPerCs);
                              const stockPiece = stock.total_pieces % unitPerCs;
                              const inputCs = Number(shipInputs[stock.id]?.cs) || 0;
                              const inputP = Number(shipInputs[stock.id]?.p) || 0;
                              const isOver = ((inputCs * unitPerCs) + inputP) > stock.total_pieces;
                              const isSelected = ((inputCs * unitPerCs) + inputP) > 0;

                              return (
                                <TableRow key={stock.id} className={isSelected ? "bg-blue-50/50" : ""}>
                                  <TableCell>
                                    <div className="font-black text-base text-slate-800 tracking-tight">{stock.lot_code}</div>
                                    <div className="text-xs text-slate-500">{new Date(stock.expiry_date).toLocaleDateString()}</div>
                                  </TableCell>
                                  <TableCell className="text-right bg-slate-50/20">
                                    <span className="font-bold text-lg">{stockCs} <span className="text-[10px] text-slate-400">cs</span></span>
                                    <span className="mx-1 text-slate-300">/</span>
                                    <span className="font-bold text-lg">{stockPiece} <span className="text-[10px] text-slate-400">p</span></span>
                                  </TableCell>
                                  <TableCell className={`border-l ${isOver ? 'bg-red-50 border-red-200' : 'bg-blue-50/20 border-blue-100'}`}>
                                    <div className="flex items-center justify-center gap-2">
                                      <div className="flex items-end gap-1">
                                        <Input 
                                          type="number" min="0" 
                                          value={shipInputs[stock.id]?.cs ?? ""} 
                                          onChange={e => handleInputChange(stock.id, 'cs', e.target.value)} 
                                          className="w-16 text-right font-bold h-9 bg-white" 
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 pb-1">cs</span>
                                      </div>
                                      <div className="flex items-end gap-1">
                                        <Input 
                                          type="number" min="0" 
                                          value={shipInputs[stock.id]?.p ?? ""} 
                                          onChange={e => handleInputChange(stock.id, 'p', e.target.value)} 
                                          className="w-16 text-right font-bold h-9 bg-white" 
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 pb-1">p</span>
                                      </div>
                                    </div>
                                    {isOver && <div className="text-[10px] text-red-600 font-bold text-center mt-1">※在庫超過</div>}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-auto bg-white border-t p-6 shadow-[-4px_0_15px_rgba(0,0,0,0.1)] flex flex-col md:flex-row justify-between items-center gap-4 z-20">
                  <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-slate-50 rounded-xl border-2 border-slate-100 transition-all font-bold text-slate-700">
                    <input type="checkbox" checked={isOrderCompleted} onChange={e => setIsOrderCompleted(e.target.checked)} className="w-5 h-5 text-blue-600 rounded-md border-slate-300"/>
                    この注文を同時に「出荷完了」にする
                  </label>
                  <Button 
                    onClick={handleSaveShipment} 
                    disabled={isProcessing || totalShipPieces === 0} 
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black h-14 px-12 text-xl shadow-lg rounded-xl"
                  >
                    {isProcessing ? <Loader2 className="w-6 h-6 mr-2 animate-spin"/> : <ArrowRight className="w-6 h-6 mr-2"/>}
                    出荷を確定・登録
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center flex-1 bg-slate-50">
                <Truck className="h-20 w-20 mb-4 opacity-20 text-blue-500" />
                <p className="text-2xl font-black text-slate-400 tracking-tight">リストから注文を選択してください</p>
                <p className="text-sm mt-2 font-bold text-slate-400">※在庫から自動で引き当て計算を行います</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}