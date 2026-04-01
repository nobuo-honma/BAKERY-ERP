"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Package, Wheat, Box, Boxes, ClipboardEdit, ArrowRight, Save, Loader2, AlertCircle, CheckCircle2, ListChecks, TrendingUp, Filter, Lock, Printer, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ItemStock = { id: string; name: string; item_type: string; unit: string; safety_stock: number; current_qty: number; };
type ProductStock = { id: string; lot_code: string; product_id: string; total_pieces: number; expiry_date: string; products: { name: string; variant_name: string; unit_per_cs: number }; };
type AdjustmentHistory = { id: string; adjusted_at: string; items?: { name: string }; products?: { name: string }; lot_code?: string; before_qty: number; after_qty: number; diff: number; reason: string; };

export default function InventoryPage() {
  const { canEdit } = useAuth();
  // ★追加: 印刷モード用のState
  const [viewMode, setViewMode] = useState<'list' | 'print'>('list');
  const [loading, setLoading] = useState(true);

  const [rawMaterials, setRawMaterials] = useState<ItemStock[]>([]);
  const [materials, setMaterials] = useState<ItemStock[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [histories, setHistories] = useState<AdjustmentHistory[]>([]);

  const [boms, setBoms] = useState<any[]>([]);
  const [pendingPlans, setPendingPlans] = useState<any[]>([]);
  const [pendingArrivals, setPendingArrivals] = useState<any[]>([]);
  const [forecastFilter, setForecastFilter] = useState<'all' | 'raw_material' | 'material'>('all');

  const [adjustmentModal, setAdjustmentModal] = useState<{ isOpen: boolean; type: 'item' | 'product'; targetId: string; targetName: string; currentQty: number; unit: string; lotCode?: string; productId?: string }>({ isOpen: false, type: 'item', targetId: '', targetName: '', currentQty: 0, unit: '' });
  const [actualQty, setActualQty] = useState<number | "">("");
  const [adjReason, setAdjReason] = useState("定例棚卸");
  const [isProcessing, setIsProcessing] = useState(false);

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchInputs, setBatchInputs] = useState<Record<string, number | "">>({});
  const [batchReason, setBatchReason] = useState("月末一斉棚卸");

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const { data: itemsData } = await supabase.from("items").select(`*, item_stocks ( quantity )`).order('id');
    const { data: pStocksData } = await supabase.from("product_stocks").select(`*, products ( name, variant_name, unit_per_cs )`).order("expiry_date", { ascending: true });
    const { data: histData } = await supabase.from("inventory_adjustments").select(`*, items(name), products(name)`).order("adjusted_at", { ascending: false }).limit(50);

    const { data: bData } = await supabase.from("bom").select("*");
    const { data: plData } = await supabase.from("production_plans").select("*").eq("status", "planned");
    const { data: aData } = await supabase.from("arrivals").select("*").eq("status", "pending");

    if (itemsData) {
      const formattedItems = itemsData.map((item: any) => {
        const qty = Array.isArray(item.item_stocks) ? (item.item_stocks[0]?.quantity || 0) : (item.item_stocks?.quantity || 0);
        return { id: item.id, name: item.name, item_type: item.item_type, unit: item.unit, safety_stock: item.safety_stock, current_qty: qty };
      });
      setRawMaterials(formattedItems.filter(i => i.item_type === 'raw_material'));
      setMaterials(formattedItems.filter(i => i.item_type === 'material'));
    }
    if (pStocksData) setProductStocks(pStocksData as any[]);
    if (histData) setHistories(histData as any[]);
    if (bData) setBoms(bData);
    if (plData) setPendingPlans(plData);
    if (aData) setPendingArrivals(aData);

    setLoading(false);
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const getStockStatus = (current: number, safety: number) => {
    if (safety === 0) return { label: "設定なし", color: "bg-slate-100 text-slate-600 border-none", icon: null };
    if (current < safety) return { label: "不足(発注!)", color: "bg-red-500 text-white border-none", icon: <AlertCircle className="w-3 h-3 mr-1" /> };
    if (current < safety * 1.5) return { label: "注意", color: "bg-amber-400 text-white border-none", icon: <AlertCircle className="w-3 h-3 mr-1" /> };
    return { label: "充足", color: "bg-green-100 text-green-800 border-none", icon: <CheckCircle2 className="w-3 h-3 mr-1" /> };
  };

  const handleAdjustmentSubmit = async () => {
    if (actualQty === "" || Number(actualQty) < 0) return;
    setIsProcessing(true);
    const { type, targetId, currentQty, lotCode, productId } = adjustmentModal;

    try {
      if (type === 'item') {
        await supabase.from("item_stocks").upsert({ item_id: targetId, quantity: Number(actualQty) }, { onConflict: 'item_id' });
        await supabase.from("inventory_adjustments").insert({ item_id: targetId, before_qty: currentQty, after_qty: Number(actualQty), reason: adjReason });
      } else {
        await supabase.from("product_stocks").update({ total_pieces: Number(actualQty) }).eq("id", targetId);
        await supabase.from("inventory_adjustments").insert({ product_id: productId, lot_code: lotCode, before_qty: currentQty, after_qty: Number(actualQty), reason: adjReason });
      }
      setAdjustmentModal({ ...adjustmentModal, isOpen: false }); setActualQty(""); setAdjReason("定例棚卸"); fetchInventory();
    } catch (e) { alert("エラーが発生しました"); }
    setIsProcessing(false);
  };

  const toggleBatchMode = () => {
    if (isBatchMode) {
      setIsBatchMode(false); setBatchInputs({});
    } else {
      const newInputs: Record<string, number> = {};
      rawMaterials.forEach(i => newInputs[i.id] = i.current_qty);
      materials.forEach(i => newInputs[i.id] = i.current_qty);
      productStocks.forEach(p => newInputs[p.id] = p.total_pieces);
      setBatchInputs(newInputs); setIsBatchMode(true);
    }
  };

  const handleBatchSubmit = async () => {
    setIsProcessing(true);
    try {
      const itemUpdates = []; const productUpdates = []; const historyInserts = [];

      for (const item of [...rawMaterials, ...materials]) {
        const newVal = batchInputs[item.id];
        if (newVal !== undefined && newVal !== "" && Number(newVal) !== item.current_qty) {
          itemUpdates.push({ item_id: item.id, quantity: Number(newVal) });
          historyInserts.push({ item_id: item.id, before_qty: item.current_qty, after_qty: Number(newVal), reason: batchReason });
        }
      }

      for (const stock of productStocks) {
        const newVal = batchInputs[stock.id];
        if (newVal !== undefined && newVal !== "" && Number(newVal) !== stock.total_pieces) {
          productUpdates.push({ id: stock.id, total_pieces: Number(newVal) });
          historyInserts.push({ product_id: stock.product_id, lot_code: stock.lot_code, before_qty: stock.total_pieces, after_qty: Number(newVal), reason: batchReason });
        }
      }

      if (itemUpdates.length === 0 && productUpdates.length === 0) {
        alert("変更された在庫はありません。"); setIsProcessing(false); return;
      }

      if (!confirm(`合計 ${itemUpdates.length + productUpdates.length} 件の在庫を一括で上書き更新しますか？\n(理由は「${batchReason}」として記録されます)`)) {
        setIsProcessing(false); return;
      }

      if (itemUpdates.length > 0) await supabase.from('item_stocks').upsert(itemUpdates, { onConflict: 'item_id' });
      if (productUpdates.length > 0) await supabase.from('product_stocks').upsert(productUpdates, { onConflict: 'id' });
      if (historyInserts.length > 0) await supabase.from('inventory_adjustments').insert(historyInserts);

      alert(`一括棚卸を完了しました！\n（${itemUpdates.length + productUpdates.length} 件の在庫を更新しました）`);
      setIsBatchMode(false); setBatchInputs({}); fetchInventory();
    } catch (err: any) { alert("エラー: " + err.message); }
    setIsProcessing(false);
  };

  const forecastResult = useMemo(() => {
    const dates = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });
    const todayStr = dates[0];

    const fData: Record<string, any> = {};
    [...rawMaterials, ...materials].forEach(item => {
      fData[item.id] = { item, days: {} };
      dates.forEach(date => { fData[item.id].days[date] = { date, inQty: 0, outQty: 0, endQty: 0 }; });
    });

    pendingArrivals.forEach(arr => {
      const itemF = fData[arr.item_id];
      if (itemF) {
        let targetDate = arr.expected_date < todayStr ? todayStr : arr.expected_date;
        if (itemF.days[targetDate]) itemF.days[targetDate].inQty += arr.quantity;
      }
    });

    pendingPlans.forEach(plan => {
      let targetDate = plan.production_date < todayStr ? todayStr : plan.production_date;
      const productBoms = boms.filter(b => b.product_id === plan.product_id);
      productBoms.forEach(bom => {
        const itemF = fData[bom.item_id];
        if (itemF && itemF.days[targetDate]) {
          const outQty = bom.basis_type === 'production_qty' ? plan.production_kg * bom.usage_rate : plan.planned_cs * bom.usage_rate;
          itemF.days[targetDate].outQty += outQty;
        }
      });
    });

    Object.values(fData).forEach((itemF: any) => {
      let current = itemF.item.current_qty;
      dates.forEach(date => {
        const day = itemF.days[date];
        current = current + day.inQty - day.outQty;
        day.endQty = current;
      });
    });

    return { dates, fData };
  }, [rawMaterials, materials, boms, pendingPlans, pendingArrivals]);

  const filteredForecastData = useMemo(() => {
    const allData = Object.values(forecastResult.fData) as any[];
    if (forecastFilter === 'all') return allData;
    return allData.filter((f) => f.item.item_type === forecastFilter);
  }, [forecastResult.fData, forecastFilter]);


  const renderItemTab = (itemList: ItemStock[]) => (
    <>
      <div className="hidden md:block bg-white border rounded-lg overflow-x-auto shadow-sm">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-slate-50"><TableRow>
            <TableHead className="w-24 pl-4">品目ID</TableHead><TableHead>品目名</TableHead><TableHead className="text-right">現在庫 {isBatchMode && <span className="text-xs text-blue-600 ml-1">※実数入力</span>}</TableHead>
            <TableHead className="w-16">単位</TableHead><TableHead className="text-right">安全在庫</TableHead><TableHead className="w-32 text-center">ステータス</TableHead><TableHead className="w-32 text-center pr-4">アクション</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {itemList.map((item) => {
              const status = getStockStatus(item.current_qty, item.safety_stock);
              const isChanged = isBatchMode && batchInputs[item.id] !== undefined && Number(batchInputs[item.id]) !== item.current_qty;
              return (
                <TableRow key={item.id} className={isChanged ? "bg-amber-50/70" : "hover:bg-slate-50"}>
                  <TableCell className="font-medium text-blue-600 pl-4">{item.id}</TableCell>
                  <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                  <TableCell className="text-right font-black text-xl text-slate-700">
                    {isBatchMode ? (
                      <div className="flex justify-end items-center gap-2">
                        <Input type="number" inputMode="decimal" min="0" step="0.1" value={batchInputs[item.id] !== undefined ? batchInputs[item.id] : ""} onChange={e => setBatchInputs({ ...batchInputs, [item.id]: e.target.value === "" ? "" : Number(e.target.value) })} className={`w-28 text-right font-bold h-10 ${isChanged ? 'border-amber-400 bg-white ring-2 ring-amber-200' : 'border-blue-300 shadow-sm'}`} />
                        {isChanged && <span className="text-xs text-amber-600 font-bold ml-1 w-6 block bg-amber-100 rounded px-1">変更</span>}
                      </div>
                    ) : item.current_qty.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs">{item.unit}</TableCell>
                  <TableCell className="text-right text-slate-500 text-sm">{item.safety_stock.toLocaleString()}</TableCell>
                  <TableCell className="text-center"><Badge className={`px-2 py-1 shadow-sm ${status.color}`}>{status.icon} {status.label}</Badge></TableCell>
                  <TableCell className="text-center pr-4">
                    {canEdit && <Button disabled={isBatchMode} variant="outline" size="sm" onClick={() => setAdjustmentModal({ isOpen: true, type: 'item', targetId: item.id, targetName: item.name, currentQty: item.current_qty, unit: item.unit })} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"><ClipboardEdit className="w-3 h-3" /> 個別棚卸</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="block md:hidden space-y-3 pb-24">
        {itemList.map((item) => {
          const status = getStockStatus(item.current_qty, item.safety_stock);
          const isChanged = isBatchMode && batchInputs[item.id] !== undefined && Number(batchInputs[item.id]) !== item.current_qty;
          return (
            <Card key={item.id} className={`p-4 shadow-sm border-2 ${isChanged ? 'bg-amber-50 border-amber-400' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-1">
                <div className="font-bold text-lg text-slate-800 leading-tight pr-2">{item.name}</div>
                <Badge className={`shrink-0 ${status.color} px-1.5 py-0.5 text-[10px]`}>{status.label}</Badge>
              </div>
              <div className="text-xs text-slate-500 mb-3 flex gap-3"><span>ID: {item.id}</span><span>安全在庫: {item.safety_stock}</span></div>
              {isBatchMode ? (
                <div className="bg-white p-3 rounded-lg border shadow-inner flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-600"><span>実数入力</span>{isChanged && <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-black">変更あり</span>}</div>
                  <div className="flex items-center gap-2"><Input type="number" inputMode="decimal" min="0" step="0.1" value={batchInputs[item.id] !== undefined ? batchInputs[item.id] : ""} onChange={e => setBatchInputs({ ...batchInputs, [item.id]: e.target.value === "" ? "" : Number(e.target.value) })} className={`flex-1 text-right font-black text-2xl h-14 ${isChanged ? 'border-amber-400 bg-amber-50 focus-visible:ring-amber-500' : 'border-blue-300'}`} /><span className="font-bold text-slate-500 text-lg w-8">{item.unit}</span></div>
                </div>
              ) : (
                <div className="flex justify-between items-end mt-2 pt-2 border-t">
                  <div className="font-black text-3xl text-blue-900">{item.current_qty.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-base font-normal text-slate-500">{item.unit}</span></div>
                  {canEdit && <Button variant="outline" size="sm" onClick={() => setAdjustmentModal({ isOpen: true, type: 'item', targetId: item.id, targetName: item.name, currentQty: item.current_qty, unit: item.unit })} className="border-blue-300 text-blue-700 bg-blue-50 shadow-sm"><ClipboardEdit className="w-4 h-4 mr-1" /> 棚卸</Button>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );

  // =======================================================================
  // ★追加: 在庫一覧（棚卸表）のPDFプレビュー・印刷画面
  // =======================================================================
  if (viewMode === 'print') {
    const todayStr = new Date().toLocaleDateString('ja-JP');

    // 原材料・資材・製品をすべて一つのリストにまとめる
    const printItems = [
      ...rawMaterials.map(i => ({ id: i.id, category: '原材料', name: i.name, qty: `${i.current_qty.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${i.unit}`, rawQty: i.current_qty, expiry: undefined as string | undefined })),
      ...materials.map(i => ({ id: i.id, category: '資材', name: i.name, qty: `${i.current_qty.toLocaleString()} ${i.unit}`, rawQty: i.current_qty, expiry: undefined as string | undefined })),
      ...productStocks.map(p => {
        const u = p.products.unit_per_cs || 24;
        const cs = Math.floor(p.total_pieces / u);
        const pc = p.total_pieces % u;
        return {
          id: p.lot_code, category: '製品 (Lot別)',
          name: `${p.products.name} (${p.products.variant_name})`,
          qty: `${cs} c/s${pc > 0 ? ` ${pc} p` : ''}`,
          rawQty: p.total_pieces,
          expiry: new Date(p.expiry_date).toLocaleDateString()
        };
      })
    ];

    // 1ページあたり約35行で分割
    const chunkedItems = [];
    for (let i = 0; i < printItems.length; i += 35) {
      chunkedItems.push(printItems.slice(i, i + 35));
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

        {chunkedItems.length === 0 ? (
          <div className="w-[210mm] bg-white p-8 text-center text-slate-500 font-bold shadow-xl">データがありません</div>
        ) : (
          chunkedItems.map((chunk, pageIdx) => (
            <div key={pageIdx} className={`w-[210mm] min-h-[297mm] bg-white p-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col ${pageIdx < chunkedItems.length - 1 ? 'page-break mb-8 print:mb-0' : ''}`}>

              <div className="flex justify-between items-end mb-4 border-b-2 border-black pb-2">
                <h1 className="text-2xl font-bold tracking-widest">在庫一覧 兼 実地棚卸表</h1>
                <div className="text-sm font-medium">作成日: {todayStr}　({pageIdx + 1} / {chunkedItems.length} ページ)</div>
              </div>

              <table className="w-full border-collapse border-[2px] border-black text-sm flex-1">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black py-1.5 w-[15%] font-medium">ID / Lot</th>
                    <th className="border border-black py-1.5 w-[12%] font-medium">区分</th>
                    <th className="border border-black py-1.5 w-[33%] font-medium">品目名 / 製品名</th>
                    <th className="border border-black py-1.5 w-[20%] font-medium">システム在庫</th>
                    <th className="border border-black py-1.5 w-[20%] font-medium">実数記入欄</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((item, idx) => (
                    <tr key={idx} className="h-7 text-[13px]">
                      <td className="border border-black px-2 text-center font-mono">{item.id}</td>
                      <td className="border border-black px-2 text-center text-xs">{item.category}</td>
                      <td className="border border-black px-2 font-bold">
                        {item.name}
                        {item.expiry && <span className="text-[10px] font-normal ml-2 text-gray-500">(期限: {item.expiry})</span>}
                      </td>
                      <td className="border border-black px-2 text-right font-medium">{item.qty}</td>
                      <td className="border border-black px-2 bg-gray-50/50"></td>
                    </tr>
                  ))}
                  {/* 空行を追加して表の下端を揃える */}
                  {Array.from({ length: Math.max(0, 35 - chunk.length) }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-7">
                      <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex justify-end gap-4 text-sm font-medium">
                <div className="border border-black w-48 h-20 flex flex-col">
                  <div className="border-b border-black text-center py-0.5 bg-gray-100">棚卸 担当者</div>
                </div>
                <div className="border border-black w-48 h-20 flex flex-col">
                  <div className="border-b border-black text-center py-0.5 bg-gray-100">システム入力 担当者</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }


  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-500" /></div>;

  return (
    <div className="bg-slate-50 min-h-screen md:bg-transparent -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6 pt-4 md:pt-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-2 text-slate-800"><Package className="h-6 w-6 text-blue-600" /> 在庫管理・棚卸</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        {/* ★追加: 在庫表の印刷ボタン */}
        <Button onClick={() => setViewMode('print')} className="w-full md:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-12 md:h-10">
          <Printer className="h-4 w-4 mr-2" /> 在庫表(PDF)を印刷
        </Button>
      </div>

      <Tabs defaultValue="raw" className="w-full">
        <div className="flex flex-col mb-4 md:mb-6 gap-3">
          <div className="overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
            <TabsList className="bg-slate-200/80 flex w-max h-auto p-1.5 rounded-xl">
              <TabsTrigger value="raw" className="font-bold py-2.5 px-4 md:px-6 text-sm md:text-md rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"><Wheat className="w-4 h-4 mr-1.5" /> 原材料</TabsTrigger>
              <TabsTrigger value="material" className="font-bold py-2.5 px-4 md:px-6 text-sm md:text-md rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"><Box className="w-4 h-4 mr-1.5" /> 資材</TabsTrigger>
              <TabsTrigger value="product" className="font-bold py-2.5 px-4 md:px-6 text-sm md:text-md rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"><Boxes className="w-4 h-4 mr-1.5" /> 製品</TabsTrigger>
              <TabsTrigger value="forecast" className="font-bold py-2.5 px-4 md:px-6 text-sm md:text-md rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm bg-blue-100 text-blue-800 ml-2"><TrendingUp className="w-4 h-4 mr-1.5" /> 在庫予測</TabsTrigger>
              <TabsTrigger value="history" className="font-bold py-2.5 px-4 md:px-6 text-sm md:text-md rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-700 data-[state=active]:shadow-sm ml-auto"><ClipboardEdit className="w-4 h-4 mr-1.5" /> 履歴</TabsTrigger>
            </TabsList>
          </div>

          {canEdit && (
            <div className={`flex flex-col sm:flex-row items-center gap-2 bg-white p-2 md:p-3 rounded-xl border-2 shadow-sm sticky top-16 z-40 transition-colors ${isBatchMode ? 'border-amber-400 bg-amber-50' : 'border-blue-100'}`}>
              {isBatchMode ? (
                <div className="flex flex-col sm:flex-row w-full items-center gap-2">
                  <div className="flex items-center justify-between w-full sm:w-auto"><span className="text-sm font-black text-amber-700 animate-pulse flex items-center"><ListChecks className="w-4 h-4 mr-1" />一括入力モード (変更箇所は黄色)</span></div>
                  <select value={batchReason} onChange={e => setBatchReason(e.target.value)} className="border rounded p-1.5 text-sm font-bold bg-white shadow-sm"><option value="月末一斉棚卸">月末一斉棚卸</option><option value="期末棚卸">期末棚卸</option><option value="定例棚卸">定例棚卸</option><option value="一括補正">一括補正</option></select>
                  <div className="flex w-full sm:w-auto gap-2 mt-2 sm:mt-0 ml-auto">
                    <Button onClick={toggleBatchMode} variant="outline" className="flex-1 sm:flex-none border-slate-300 text-slate-600 bg-white">キャンセル</Button>
                    <Button onClick={handleBatchSubmit} disabled={isProcessing} className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md">{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} 一括で上書き保存</Button>
                  </div>
                </div>
              ) : (
                <Button onClick={toggleBatchMode} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm h-10"><ListChecks className="w-5 h-5 mr-2" /> 一括棚卸を開始する</Button>
              )}
            </div>
          )}
        </div>

        <TabsContent value="raw" className="mt-0">{renderItemTab(rawMaterials)}</TabsContent>
        <TabsContent value="material" className="mt-0">{renderItemTab(materials)}</TabsContent>

        <TabsContent value="product" className="mt-0">
          <div className="hidden md:block bg-white border rounded-lg overflow-x-auto shadow-sm">
            <Table className="min-w-[1000px]">
              <TableHeader className="bg-slate-50"><TableRow>
                <TableHead className="pl-4">Lot番号</TableHead><TableHead>製品名 / 味</TableHead><TableHead>賞味期限</TableHead>
                <TableHead className="text-right">在庫 (c/s) {isBatchMode && <span className="text-xs text-blue-600 ml-1">※実数入力</span>}</TableHead>
                <TableHead className="text-right">端数 (p) {isBatchMode && <span className="text-xs text-blue-600 ml-1">※実数入力</span>}</TableHead>
                <TableHead className="w-32 text-center pr-4">アクション</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {productStocks.map((stock) => {
                  const unit_per_cs = stock.products.unit_per_cs || 24; const isExpired = new Date(stock.expiry_date) < new Date();
                  const displayTotal = isBatchMode && batchInputs[stock.id] !== undefined ? Number(batchInputs[stock.id]) : stock.total_pieces;
                  const cs = Math.floor(displayTotal / unit_per_cs); const piece = displayTotal % unit_per_cs;
                  const isChanged = isBatchMode && batchInputs[stock.id] !== undefined && Number(batchInputs[stock.id]) !== stock.total_pieces;

                  return (
                    <TableRow key={stock.id} className={isChanged ? "bg-amber-50/70" : isExpired ? 'bg-red-50' : 'hover:bg-slate-50'}>
                      <TableCell className="font-black text-blue-700 pl-4 text-base tracking-wider">{stock.lot_code}</TableCell>
                      <TableCell><div className="font-bold text-slate-800">{stock.products.name}</div><div className="text-xs text-slate-500">{stock.products.variant_name}</div></TableCell>
                      <TableCell><div className={`font-bold ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>{new Date(stock.expiry_date).toLocaleDateString()}</div>{isExpired && <Badge className="bg-red-500 text-white mt-1 border-none text-[10px] px-1 py-0 shadow-sm">期限切れ</Badge>}</TableCell>
                      <TableCell className="text-right">
                        {isBatchMode ? (
                          <div className="flex items-center justify-end gap-1">
                            {isChanged && <span className="text-xs text-amber-600 font-bold mr-2 bg-amber-100 rounded px-1">変更</span>}
                            <Input type="number" inputMode="numeric" min="0" value={cs} onChange={e => setBatchInputs({ ...batchInputs, [stock.id]: (Number(e.target.value === "" ? 0 : e.target.value) * unit_per_cs) + piece })} className={`w-20 text-right font-bold h-10 ${isChanged ? 'border-amber-400 bg-white ring-2 ring-amber-200' : 'border-blue-300'}`} />
                            <span className="text-xs text-slate-500 font-bold">c/s</span>
                          </div>
                        ) : <span className="font-black text-2xl text-blue-900">{cs.toLocaleString()} <span className="text-sm font-normal text-slate-500">c/s</span></span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isBatchMode ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input type="number" inputMode="numeric" min="0" max={unit_per_cs - 1} value={piece} onChange={e => setBatchInputs({ ...batchInputs, [stock.id]: (cs * unit_per_cs) + Number(e.target.value === "" ? 0 : e.target.value) })} className={`w-16 text-right font-bold h-10 ${isChanged ? 'border-amber-400 bg-white ring-2 ring-amber-200' : 'border-blue-300'}`} />
                            <span className="text-xs text-slate-500 font-bold">p</span>
                          </div>
                        ) : <span className="font-bold text-lg text-slate-600">{piece} <span className="text-xs font-normal text-slate-400">p</span></span>}
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        {canEdit && <Button disabled={isBatchMode} variant="outline" size="sm" onClick={() => setAdjustmentModal({ isOpen: true, type: 'product', targetId: stock.id, targetName: `${stock.products.name} (${stock.lot_code})`, currentQty: stock.total_pieces, unit: 'ピース(総数)', lotCode: stock.lot_code, productId: stock.product_id })} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"><ClipboardEdit className="w-3 h-3" /> 個別棚卸</Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="block md:hidden space-y-3 pb-24">
            {productStocks.map((stock) => {
              const unit_per_cs = stock.products.unit_per_cs || 24; const isExpired = new Date(stock.expiry_date) < new Date();
              const displayTotal = isBatchMode && batchInputs[stock.id] !== undefined ? Number(batchInputs[stock.id]) : stock.total_pieces;
              const cs = Math.floor(displayTotal / unit_per_cs); const piece = displayTotal % unit_per_cs;
              const isChanged = isBatchMode && batchInputs[stock.id] !== undefined && Number(batchInputs[stock.id]) !== stock.total_pieces;

              return (
                <Card key={stock.id} className={`p-4 shadow-sm border-2 ${isChanged ? 'bg-amber-50 border-amber-400' : isExpired ? 'bg-red-50/50 border-red-200' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-black text-xl text-blue-800 tracking-wider leading-none mb-1">{stock.lot_code}</div>
                      <div className="font-bold text-slate-800 leading-tight">{stock.products.name} <span className="text-xs font-normal text-slate-500">({stock.products.variant_name})</span></div>
                    </div>
                    {isExpired && <Badge className="bg-red-500 text-white shadow-sm shrink-0">期限切れ</Badge>}
                  </div>
                  <div className={`text-xs mb-3 font-bold ${isExpired ? 'text-red-600' : 'text-slate-500'}`}>賞味期限: {new Date(stock.expiry_date).toLocaleDateString()}</div>
                  {isBatchMode ? (
                    <div className="bg-white p-3 rounded-lg border shadow-inner flex flex-col gap-2">
                      <div className="flex justify-between items-center text-sm font-bold text-slate-600"><span>実数入力</span>{isChanged && <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-black">変更あり</span>}</div>
                      <div className="flex items-center gap-3">
                        <Input type="number" inputMode="numeric" min="0" value={cs} onChange={e => setBatchInputs({ ...batchInputs, [stock.id]: (Number(e.target.value === "" ? 0 : e.target.value) * unit_per_cs) + piece })} className={`flex-1 text-right font-black text-2xl h-14 ${isChanged ? 'border-amber-400 bg-amber-50 focus-visible:ring-amber-500' : 'border-blue-300'}`} />
                        <span className="font-bold text-slate-500 text-lg w-8">c/s</span>
                        <Input type="number" inputMode="numeric" min="0" max={unit_per_cs - 1} value={piece} onChange={e => setBatchInputs({ ...batchInputs, [stock.id]: (cs * unit_per_cs) + Number(e.target.value === "" ? 0 : e.target.value) })} className={`flex-1 text-right font-black text-2xl h-14 ${isChanged ? 'border-amber-400 bg-amber-50 focus-visible:ring-amber-500' : 'border-blue-300'}`} />
                        <span className="font-bold text-slate-500 text-lg w-4">p</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-end mt-2 pt-2 border-t">
                      <div className="font-black text-3xl text-blue-900">{cs} <span className="text-sm font-normal text-slate-500">c/s</span> <span className="text-xl text-slate-700 ml-1">{piece}</span><span className="text-xs font-normal text-slate-400">p</span></div>
                      {canEdit && <Button variant="outline" size="sm" onClick={() => setAdjustmentModal({ isOpen: true, type: 'product', targetId: stock.id, targetName: `${stock.products.name} (${stock.lot_code})`, currentQty: stock.total_pieces, unit: 'ピース(総数)', lotCode: stock.lot_code, productId: stock.product_id })} className="border-blue-300 text-blue-700 bg-blue-50 shadow-sm"><ClipboardEdit className="w-4 h-4 mr-1" /> 棚卸</Button>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="mt-0">
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="p-4 border-b bg-blue-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><h2 className="font-bold text-blue-900 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" />原料・資材 在庫推移予測 (30日間)</h2><p className="text-xs text-slate-600 mt-1">製造計画(未着手)と入荷予定から、将来の在庫不足を自動シミュレーションします。</p></div>
              <div className="flex bg-white rounded-lg border p-1 shadow-sm w-fit shrink-0"><button onClick={() => setForecastFilter('all')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-1 ${forecastFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-50'}`}><Filter className="w-3 h-3" />すべて</button><button onClick={() => setForecastFilter('raw_material')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${forecastFilter === 'raw_material' ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-50'}`}>原材料のみ</button><button onClick={() => setForecastFilter('material')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${forecastFilter === 'material' ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-50'}`}>資材のみ</button></div>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
              <Table className="min-w-max border-collapse">
                <TableHeader className="bg-slate-100 sticky top-0 z-20 shadow-sm"><TableRow><TableHead className="sticky left-0 bg-slate-100 border-r z-30 w-48 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-slate-700 font-bold">品目名</TableHead><TableHead className="w-24 text-right bg-slate-100 border-r z-20 text-slate-700 font-bold">現在庫</TableHead>{forecastResult.dates.map(date => { const d = new Date(date); const isWeekend = d.getDay() === 0 || d.getDay() === 6; return (<TableHead key={date} className={`text-center min-w-[80px] border-r px-2 py-1.5 leading-tight ${isWeekend ? 'text-red-600 bg-red-50/50' : 'text-slate-700'}`}><div className="font-bold">{d.getMonth() + 1}/{d.getDate()}</div><div className="text-[10px] font-normal">{['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}</div></TableHead>); })}</TableRow></TableHeader>
                <TableBody>
                  {filteredForecastData.map((f: any) => (
                    <TableRow key={f.item.id} className="hover:bg-slate-50"><TableCell className="sticky left-0 bg-white font-bold text-slate-800 border-r z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] truncate max-w-[200px]" title={f.item.name}>{f.item.name} <span className="text-[10px] font-normal text-slate-500 block">({f.item.unit})</span></TableCell><TableCell className="text-right font-black text-slate-700 border-r bg-slate-50">{f.item.current_qty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                      {forecastResult.dates.map(date => {
                        const day = f.days[date]; const isShort = day.endQty < 0; const isWarning = !isShort && f.item.safety_stock > 0 && day.endQty < f.item.safety_stock;
                        return (<TableCell key={date} className={`border-r p-1 align-top ${isShort ? 'bg-red-50 border-red-200' : isWarning ? 'bg-amber-50/50' : ''}`}><div className="flex flex-col justify-between h-full min-h-[3rem]"><div className="flex justify-between w-full text-[10px] px-1 font-bold"><span className="text-blue-600">{day.inQty > 0 ? `+${day.inQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : ''}</span><span className="text-red-500">{day.outQty > 0 ? `-${day.outQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : ''}</span></div><div className={`text-right font-black text-sm px-1 mt-1 ${isShort ? 'text-red-700' : 'text-slate-800'}`}>{day.endQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div></div></TableCell>);
                      })}
                    </TableRow>
                  ))}
                  {filteredForecastData.length === 0 && <TableRow><TableCell colSpan={32} className="text-center py-12 text-slate-500">該当する品目データがありません</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 bg-slate-50 border-t flex flex-wrap gap-4 text-xs text-slate-600"><div className="flex items-center gap-1.5"><span className="w-4 h-4 bg-red-50 border border-red-200 rounded-sm inline-block"></span>在庫がマイナス (欠品)</div><div className="flex items-center gap-1.5"><span className="w-4 h-4 bg-amber-50/80 border border-amber-200 rounded-sm inline-block"></span>安全在庫割れ</div><div className="flex items-center gap-1.5"><span className="text-blue-600 font-bold">+数値</span>入荷予定</div><div className="flex items-center gap-1.5"><span className="text-red-500 font-bold">-数値</span>消費予定</div></div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="bg-white border rounded-lg overflow-x-auto shadow-sm pb-10">
            <Table className="min-w-[600px] text-sm"><TableHeader className="bg-slate-50"><TableRow><TableHead className="pl-4 w-32">日時</TableHead><TableHead>対象</TableHead><TableHead className="text-right">前</TableHead><TableHead></TableHead><TableHead className="text-right">後</TableHead><TableHead className="text-right">差異</TableHead><TableHead className="pr-4">理由</TableHead></TableRow></TableHeader><TableBody>{histories.map((hist) => { const targetName = hist.items?.name || (hist.products ? `${hist.products.name} (${hist.lot_code})` : '不明'); const diffColor = hist.diff > 0 ? 'text-green-600' : hist.diff < 0 ? 'text-red-600' : 'text-slate-400'; return (<TableRow key={hist.id} className="hover:bg-slate-50"><TableCell className="text-slate-500 pl-4 text-xs">{new Date(hist.adjusted_at).toLocaleDateString()}<br />{new Date(hist.adjusted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell><TableCell className="font-bold text-slate-800 max-w-[150px] truncate" title={targetName}>{targetName}</TableCell><TableCell className="text-right text-slate-500">{hist.before_qty.toLocaleString()}</TableCell><TableCell className="text-center text-slate-300"><ArrowRight className="w-3 h-3 mx-auto" /></TableCell><TableCell className="text-right font-bold text-slate-800">{hist.after_qty.toLocaleString()}</TableCell><TableCell className={`text-right font-black ${diffColor}`}>{hist.diff > 0 ? '+' : ''}{hist.diff.toLocaleString()}</TableCell><TableCell className="text-slate-500 text-xs pr-4">{hist.reason}</TableCell></TableRow>); })}</TableBody></Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={adjustmentModal.isOpen} onOpenChange={(open) => !open && setAdjustmentModal({ ...adjustmentModal, isOpen: false })}>
        <DialogContent className="w-[95vw] max-w-md bg-white p-4 md:p-6 rounded-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardEdit className="w-5 h-5 text-blue-600" /> 実地棚卸の入力</DialogTitle></DialogHeader>
          <div className="space-y-6 mt-2">
            <div className="bg-slate-50 p-3 md:p-4 rounded-lg border text-center"><div className="text-xs font-bold text-slate-500 mb-1">対象品目</div><div className="text-base md:text-lg font-bold text-blue-900 leading-tight">{adjustmentModal.targetName}</div></div>
            <div className="flex items-center justify-between px-2">
              <div className="text-center"><div className="text-[10px] md:text-xs font-bold text-slate-500 mb-1">システム在庫</div><div className="text-xl md:text-2xl font-black text-slate-700">{adjustmentModal.currentQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">{adjustmentModal.unit}</span></div></div>
              <ArrowRight className="w-6 h-6 md:w-8 md:h-8 text-slate-300 mx-1" />
              <div className="text-center"><div className="text-[10px] md:text-xs font-bold text-blue-600 mb-1">実際の数 (入力)</div><div className="flex items-end gap-1"><Input type="number" inputMode="decimal" min="0" autoFocus value={actualQty} onChange={e => setActualQty(e.target.value === "" ? "" : Number(e.target.value))} className="w-20 md:w-24 h-12 text-2xl font-bold text-right border-blue-400 focus-visible:ring-blue-500" /><span className="text-[10px] md:text-xs font-bold text-slate-500 pb-2">{adjustmentModal.unit}</span></div></div>
            </div>
            {actualQty !== "" && (<div className={`text-center font-bold p-2 md:p-3 rounded-lg ${Number(actualQty) - adjustmentModal.currentQty === 0 ? "bg-slate-100 text-slate-500" : Number(actualQty) - adjustmentModal.currentQty > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>差異: {Number(actualQty) - adjustmentModal.currentQty > 0 ? "+" : ""}{(Number(actualQty) - adjustmentModal.currentQty).toLocaleString()} {adjustmentModal.unit}</div>)}
            <div><label className="block text-xs font-bold text-slate-500 mb-2">調整理由</label><select value={adjReason} onChange={e => setAdjReason(e.target.value)} className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white font-bold text-slate-700 focus:border-blue-400 focus:ring-0"><option value="定例棚卸">定例棚卸</option><option value="ロス・廃棄">ロス・廃棄による減算</option><option value="入力もれ補正">入力もれ補正</option><option value="その他">その他</option></select></div>
          </div>
          <DialogFooter className="mt-4 md:mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => setAdjustmentModal({ ...adjustmentModal, isOpen: false })} className="w-full md:w-auto h-12 md:h-10 mb-2 md:mb-0 font-bold">キャンセル</Button>
            <Button onClick={handleAdjustmentSubmit} disabled={isProcessing || actualQty === ""} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 md:h-10 text-lg md:text-base">{isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} 確定する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}