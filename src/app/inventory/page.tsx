"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Wheat, Box, Boxes, ClipboardEdit, ArrowRight, Save, Loader2, AlertCircle, CheckCircle2, ListChecks } from "lucide-react";

// --- 型定義 ---
type ItemStock = { id: string; name: string; item_type: string; unit: string; safety_stock: number; current_qty: number; };
type ProductStock = { id: string; lot_code: string; product_id: string; total_pieces: number; expiry_date: string; products: { name: string; variant_name: string; unit_per_cs: number }; };
type AdjustmentHistory = { id: string; adjusted_at: string; items?: { name: string }; products?: { name: string }; lot_code?: string; before_qty: number; after_qty: number; diff: number; reason: string; };

export default function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [rawMaterials, setRawMaterials] = useState<ItemStock[]>([]);
  const [materials, setMaterials] = useState<ItemStock[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [histories, setHistories] = useState<AdjustmentHistory[]>([]);

  // 1件ずつの棚卸（調整）用State
  const [adjustmentModal, setAdjustmentModal] = useState<{ isOpen: boolean; type: 'item' | 'product'; targetId: string; targetName: string; currentQty: number; unit: string; lotCode?: string; productId?: string }>({ isOpen: false, type: 'item', targetId: '', targetName: '', currentQty: 0, unit: '' });
  const [actualQty, setActualQty] = useState<number | "">("");
  const [adjReason, setAdjReason] = useState("定例棚卸");
  const [isProcessing, setIsProcessing] = useState(false);

  // ★追加：一括棚卸モード用State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchInputs, setBatchInputs] = useState<Record<string, number | "">>({});
  const [batchReason, setBatchReason] = useState("定例棚卸");

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const { data: itemsData } = await supabase.from("items").select(`*, item_stocks ( quantity )`);
    const { data: pStocksData } = await supabase.from("product_stocks").select(`*, products ( name, variant_name, unit_per_cs )`).order("expiry_date", { ascending: true });
    const { data: histData } = await supabase.from("inventory_adjustments").select(`*, items(name), products(name)`).order("adjusted_at", { ascending: false }).limit(50);

    if (itemsData) {
      const formattedItems = itemsData.map((item: any) => ({
        id: item.id, name: item.name, item_type: item.item_type, unit: item.unit, safety_stock: item.safety_stock,
        current_qty: item.item_stocks && item.item_stocks.length > 0 ? item.item_stocks[0].quantity : 0
      }));
      setRawMaterials(formattedItems.filter(i => i.item_type === 'raw_material'));
      setMaterials(formattedItems.filter(i => i.item_type === 'material'));
    }

    if (pStocksData) setProductStocks(pStocksData as any[]);
    if (histData) setHistories(histData as any[]);

    setLoading(false);
  };

  const getStockStatus = (current: number, safety: number) => {
    if (safety === 0) return { label: "設定なし", color: "bg-slate-100 text-slate-600 border-none", icon: null };
    if (current < safety) return { label: "不足 (発注!)", color: "bg-red-500 text-white border-none", icon: <AlertCircle className="w-3 h-3 mr-1" /> };
    if (current < safety * 1.5) return { label: "注意", color: "bg-amber-400 text-white border-none", icon: <AlertCircle className="w-3 h-3 mr-1" /> };
    return { label: "充足", color: "bg-green-100 text-green-800 border-none", icon: <CheckCircle2 className="w-3 h-3 mr-1" /> };
  };

  // 1件保存処理
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

      setAdjustmentModal({ ...adjustmentModal, isOpen: false });
      setActualQty(""); setAdjReason("定例棚卸"); fetchInventory();
      alert("在庫数を更新しました！");
    } catch (e) {
      alert("エラーが発生しました");
    }
    setIsProcessing(false);
  };

  // ★追加：一括棚卸モードのON/OFF切り替え
  const toggleBatchMode = () => {
    if (isBatchMode) {
      setIsBatchMode(false);
      setBatchInputs({});
    } else {
      // ONにした瞬間に、現在の在庫数をInputの初期値としてすべてセットする
      const newInputs: Record<string, number> = {};
      rawMaterials.forEach(i => newInputs[i.id] = i.current_qty);
      materials.forEach(i => newInputs[i.id] = i.current_qty);
      productStocks.forEach(p => newInputs[p.id] = p.total_pieces);
      setBatchInputs(newInputs);
      setIsBatchMode(true);
    }
  };

  // ★追加：一括棚卸データの保存処理
  const handleBatchSubmit = async () => {
    setIsProcessing(true);
    try {
      const itemUpdates = [];
      const productUpdates = [];
      const historyInserts = [];

      // 原材料・資材の変更をチェック
      for (const item of [...rawMaterials, ...materials]) {
        const newVal = batchInputs[item.id];
        if (newVal !== undefined && newVal !== "" && Number(newVal) !== item.current_qty) {
          itemUpdates.push({ item_id: item.id, quantity: Number(newVal) });
          historyInserts.push({ item_id: item.id, before_qty: item.current_qty, after_qty: Number(newVal), reason: batchReason });
        }
      }

      // 製品(Lot別)の変更をチェック
      for (const stock of productStocks) {
        const newVal = batchInputs[stock.id];
        if (newVal !== undefined && newVal !== "" && Number(newVal) !== stock.total_pieces) {
          productUpdates.push({ id: stock.id, total_pieces: Number(newVal) });
          historyInserts.push({ product_id: stock.product_id, lot_code: stock.lot_code, before_qty: stock.total_pieces, after_qty: Number(newVal), reason: batchReason });
        }
      }

      if (itemUpdates.length === 0 && productUpdates.length === 0) {
        alert("変更された在庫はありません。");
        setIsProcessing(false); return;
      }

      // データベースを一括更新 (Supabaseのupsertは配列を渡すだけで複数件同時に処理できます)
      if (itemUpdates.length > 0) await supabase.from('item_stocks').upsert(itemUpdates, { onConflict: 'item_id' });
      if (productUpdates.length > 0) await supabase.from('product_stocks').upsert(productUpdates, { onConflict: 'id' });
      if (historyInserts.length > 0) await supabase.from('inventory_adjustments').insert(historyInserts);

      alert(`合計 ${itemUpdates.length + productUpdates.length} 件の在庫を一括更新しました！`);
      setIsBatchMode(false); setBatchInputs({}); fetchInventory();
    } catch (err: any) {
      alert("エラーが発生しました: " + err.message);
    }
    setIsProcessing(false);
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-500" /></div>;

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
          <Package className="h-6 w-6 text-blue-600" />
          在庫管理・棚卸
        </h1>
      </div>

      <Tabs defaultValue="raw" className="w-full">
        {/* ★変更：タブと一括棚卸ボタンを横並びに配置 */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <TabsList className="bg-slate-100 flex flex-wrap h-auto shadow-sm p-1 rounded-lg">
            <TabsTrigger value="raw" className="font-bold py-2 px-6 gap-2 text-md data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"><Wheat className="w-4 h-4" /> 原材料</TabsTrigger>
            <TabsTrigger value="material" className="font-bold py-2 px-6 gap-2 text-md data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"><Box className="w-4 h-4" /> 資材</TabsTrigger>
            <TabsTrigger value="product" className="font-bold py-2 px-6 gap-2 text-md data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"><Boxes className="w-4 h-4" /> 製品 (Lot別)</TabsTrigger>
            <TabsTrigger value="history" className="font-bold py-2 px-6 gap-2 text-md"><ClipboardEdit className="w-4 h-4" /> 調整履歴</TabsTrigger>
          </TabsList>

          {/* ★追加：一括棚卸UI */}
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-lg border shadow-sm">
            {isBatchMode ? (
              <>
                <div className="text-sm font-bold text-blue-700 ml-2 animate-pulse">一括棚卸モード入力中...</div>
                <select value={batchReason} onChange={e => setBatchReason(e.target.value)} className="border rounded p-1.5 text-sm bg-slate-50 border-blue-200 ml-2">
                  <option value="定例棚卸">定例棚卸 (一括)</option>
                  <option value="入力もれ補正">入力もれ補正</option>
                  <option value="その他">その他</option>
                </select>
                <Button onClick={handleBatchSubmit} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white h-9 px-4 gap-1 font-bold shadow-sm">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 変更を一括保存
                </Button>
                <Button onClick={toggleBatchMode} variant="ghost" className="h-9 px-3 text-slate-500 hover:bg-slate-100">キャンセル</Button>
              </>
            ) : (
              <Button onClick={toggleBatchMode} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 h-9 px-4 gap-2 font-bold shadow-sm">
                <ListChecks className="w-4 h-4" /> 一括棚卸モード開始
              </Button>
            )}
          </div>
        </div>

        {/* 1. 原材料タブ */}
        <TabsContent value="raw">
          <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-24 pl-4">品目ID</TableHead>
                  <TableHead>品目名</TableHead>
                  <TableHead className="text-right">現在庫 (実数入力)</TableHead>
                  <TableHead className="w-16">単位</TableHead>
                  <TableHead className="text-right">安全在庫</TableHead>
                  <TableHead className="w-32 text-center">ステータス</TableHead>
                  <TableHead className="w-32 text-center pr-4">アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawMaterials.map((item) => {
                  const status = getStockStatus(item.current_qty, item.safety_stock);
                  const isChanged = isBatchMode && batchInputs[item.id] !== undefined && Number(batchInputs[item.id]) !== item.current_qty;
                  return (
                    // 変更があった行は黄色っぽくハイライトされる
                    <TableRow key={item.id} className={isChanged ? "bg-amber-50" : "hover:bg-slate-50"}>
                      <TableCell className="font-medium text-blue-600 pl-4">{item.id}</TableCell>
                      <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                      <TableCell className="text-right font-black text-xl text-slate-700">
                        {isBatchMode ? (
                          <div className="flex justify-end items-center gap-2">
                            <Input
                              type="number" min="0" step="0.1"
                              value={batchInputs[item.id] !== undefined ? batchInputs[item.id] : ""}
                              onChange={e => setBatchInputs({ ...batchInputs, [item.id]: e.target.value === "" ? "" : Number(e.target.value) })}
                              className={`w-28 text-right font-bold h-9 ${isChanged ? 'border-amber-400 bg-white ring-2 ring-amber-200' : 'border-blue-300 shadow-sm'}`}
                            />
                            {isChanged && <span className="text-xs text-amber-600 font-bold ml-1 w-6 block">変更</span>}
                          </div>
                        ) : (
                          item.current_qty.toLocaleString(undefined, { maximumFractionDigits: 1 })
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">{item.unit}</TableCell>
                      <TableCell className="text-right text-slate-500 text-sm">{item.safety_stock.toLocaleString()}</TableCell>
                      <TableCell className="text-center"><Badge className={`px-2 py-1 shadow-sm ${status.color}`}>{status.icon} {status.label}</Badge></TableCell>
                      <TableCell className="text-center pr-4">
                        <Button disabled={isBatchMode} variant="outline" size="sm" onClick={() => setAdjustmentModal({ isOpen: true, type: 'item', targetId: item.id, targetName: item.name, currentQty: item.current_qty, unit: item.unit })} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50">
                          <ClipboardEdit className="w-3 h-3" /> 個別棚卸
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 2. 資材タブ (原材料とほぼ同じ構成) */}
        <TabsContent value="material">
          <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-24 pl-4">品目ID</TableHead>
                  <TableHead>品目名</TableHead>
                  <TableHead className="text-right">現在庫 (実数入力)</TableHead>
                  <TableHead className="w-16">単位</TableHead>
                  <TableHead className="text-right">安全在庫</TableHead>
                  <TableHead className="w-32 text-center">ステータス</TableHead>
                  <TableHead className="w-32 text-center pr-4">アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((item) => {
                  const status = getStockStatus(item.current_qty, item.safety_stock);
                  const isChanged = isBatchMode && batchInputs[item.id] !== undefined && Number(batchInputs[item.id]) !== item.current_qty;
                  return (
                    <TableRow key={item.id} className={isChanged ? "bg-amber-50" : "hover:bg-slate-50"}>
                      <TableCell className="font-medium text-blue-600 pl-4">{item.id}</TableCell>
                      <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                      <TableCell className="text-right font-black text-xl text-slate-700">
                        {isBatchMode ? (
                          <div className="flex justify-end items-center gap-2">
                            <Input
                              type="number" min="0"
                              value={batchInputs[item.id] !== undefined ? batchInputs[item.id] : ""}
                              onChange={e => setBatchInputs({ ...batchInputs, [item.id]: e.target.value === "" ? "" : Number(e.target.value) })}
                              className={`w-28 text-right font-bold h-9 ${isChanged ? 'border-amber-400 bg-white ring-2 ring-amber-200' : 'border-blue-300 shadow-sm'}`}
                            />
                            {isChanged && <span className="text-xs text-amber-600 font-bold ml-1 w-6 block">変更</span>}
                          </div>
                        ) : (
                          item.current_qty.toLocaleString()
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">{item.unit}</TableCell>
                      <TableCell className="text-right text-slate-500 text-sm">{item.safety_stock.toLocaleString()}</TableCell>
                      <TableCell className="text-center"><Badge className={`px-2 py-1 shadow-sm ${status.color}`}>{status.icon} {status.label}</Badge></TableCell>
                      <TableCell className="text-center pr-4">
                        <Button disabled={isBatchMode} variant="outline" size="sm" onClick={() => setAdjustmentModal({ isOpen: true, type: 'item', targetId: item.id, targetName: item.name, currentQty: item.current_qty, unit: item.unit })} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50">
                          <ClipboardEdit className="w-3 h-3" /> 個別棚卸
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 3. 製品 (Lot別) タブ */}
        <TabsContent value="product">
          <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
            <Table className="min-w-[1000px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">Lot番号</TableHead>
                  <TableHead>製品名 / 味</TableHead>
                  <TableHead>賞味期限</TableHead>
                  <TableHead className="text-right">在庫 (ケース) {isBatchMode && <span className="text-xs text-blue-600 block">※実数入力</span>}</TableHead>
                  <TableHead className="text-right">端数 (ピース) {isBatchMode && <span className="text-xs text-blue-600 block">※実数入力</span>}</TableHead>
                  <TableHead className="w-32 text-center pr-4">アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productStocks.map((stock) => {
                  const unit_per_cs = stock.products.unit_per_cs || 24;
                  const isExpired = new Date(stock.expiry_date) < new Date();

                  // 表示用と入力用の計算
                  const displayTotal = isBatchMode && batchInputs[stock.id] !== undefined ? Number(batchInputs[stock.id]) : stock.total_pieces;
                  const cs = Math.floor(displayTotal / unit_per_cs);
                  const piece = displayTotal % unit_per_cs;
                  const isChanged = isBatchMode && batchInputs[stock.id] !== undefined && Number(batchInputs[stock.id]) !== stock.total_pieces;

                  return (
                    <TableRow key={stock.id} className={isChanged ? "bg-amber-50" : isExpired ? 'bg-red-50' : 'hover:bg-slate-50'}>
                      <TableCell className="font-black text-blue-700 pl-4 text-base tracking-wider">{stock.lot_code}</TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-800">{stock.products.name}</div>
                        <div className="text-xs text-slate-500">{stock.products.variant_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className={`font-bold ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>{new Date(stock.expiry_date).toLocaleDateString()}</div>
                        {isExpired && <Badge className="bg-red-500 text-white mt-1 border-none text-[10px] px-1 py-0 shadow-sm">期限切れ</Badge>}
                      </TableCell>

                      {/* 製品の一括入力エリア (c/sとpを分けて入力させる神対応) */}
                      <TableCell className="text-right">
                        {isBatchMode ? (
                          <div className="flex items-center justify-end gap-1">
                            {isChanged && <span className="text-xs text-amber-600 font-bold mr-2">変更</span>}
                            <Input
                              type="number" min="0" value={cs}
                              onChange={e => setBatchInputs({ ...batchInputs, [stock.id]: (Number(e.target.value === "" ? 0 : e.target.value) * unit_per_cs) + piece })}
                              className={`w-20 text-right font-bold h-9 ${isChanged ? 'border-amber-400 bg-white' : 'border-blue-300'}`}
                            />
                            <span className="text-xs text-slate-500 font-bold">c/s</span>
                          </div>
                        ) : (
                          <span className="font-black text-2xl text-blue-900">{cs.toLocaleString()} <span className="text-sm font-normal text-slate-500">c/s</span></span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {isBatchMode ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number" min="0" max={unit_per_cs - 1} value={piece}
                              onChange={e => setBatchInputs({ ...batchInputs, [stock.id]: (cs * unit_per_cs) + Number(e.target.value === "" ? 0 : e.target.value) })}
                              className={`w-16 text-right font-bold h-9 ${isChanged ? 'border-amber-400 bg-white' : 'border-blue-300'}`}
                            />
                            <span className="text-xs text-slate-500 font-bold">p</span>
                          </div>
                        ) : (
                          <span className="font-bold text-lg text-slate-600">{piece} <span className="text-xs font-normal text-slate-400">p</span></span>
                        )}
                      </TableCell>

                      <TableCell className="text-center pr-4">
                        <Button disabled={isBatchMode} variant="outline" size="sm" onClick={() => setAdjustmentModal({ isOpen: true, type: 'product', targetId: stock.id, targetName: `${stock.products.name} (${stock.lot_code})`, currentQty: stock.total_pieces, unit: 'ピース(総数)', lotCode: stock.lot_code, productId: stock.product_id })} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50">
                          <ClipboardEdit className="w-3 h-3" /> 個別棚卸
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 4. 棚卸履歴タブ (変更なし) */}
        <TabsContent value="history">
          <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
            <Table className="min-w-[800px] text-sm">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">調整日時</TableHead>
                  <TableHead>対象</TableHead>
                  <TableHead className="text-right">変更前</TableHead>
                  <TableHead></TableHead>
                  <TableHead className="text-right">変更後</TableHead>
                  <TableHead className="text-right">差異</TableHead>
                  <TableHead className="pr-4">調整理由</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {histories.map((hist) => {
                  const targetName = hist.items?.name || (hist.products ? `${hist.products.name} (Lot: ${hist.lot_code})` : '不明');
                  const diffColor = hist.diff > 0 ? 'text-green-600' : hist.diff < 0 ? 'text-red-600' : 'text-slate-400';
                  return (
                    <TableRow key={hist.id} className="hover:bg-slate-50">
                      <TableCell className="text-slate-500 pl-4">{new Date(hist.adjusted_at).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-slate-800">{targetName}</TableCell>
                      <TableCell className="text-right text-slate-500">{hist.before_qty.toLocaleString()}</TableCell>
                      <TableCell className="text-center text-slate-300"><ArrowRight className="w-4 h-4 mx-auto" /></TableCell>
                      <TableCell className="text-right font-bold text-slate-800">{hist.after_qty.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-black ${diffColor}`}>{hist.diff > 0 ? '+' : ''}{hist.diff.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-600 pr-4">{hist.reason}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* --- 1件ずつの棚卸（調整）入力モーダル (変更なし) --- */}
      <Dialog open={adjustmentModal.isOpen} onOpenChange={(open) => !open && setAdjustmentModal({ ...adjustmentModal, isOpen: false })}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardEdit className="w-5 h-5 text-blue-600" /> 実地棚卸の入力</DialogTitle></DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="bg-slate-50 p-4 rounded-md border text-center"><div className="text-xs font-bold text-slate-500 mb-1">対象品目</div><div className="text-lg font-bold text-blue-900">{adjustmentModal.targetName}</div></div>
            <div className="flex items-center justify-between px-4">
              <div className="text-center"><div className="text-xs font-bold text-slate-500 mb-1">システム在庫</div><div className="text-2xl font-black text-slate-700">{adjustmentModal.currentQty.toLocaleString()} <span className="text-sm font-normal text-slate-500">{adjustmentModal.unit}</span></div></div>
              <ArrowRight className="w-8 h-8 text-slate-300" />
              <div className="text-center">
                <div className="text-xs font-bold text-blue-600 mb-1">実際の在庫数 (入力)</div>
                <div className="flex items-end gap-1">
                  <Input type="number" min="0" autoFocus value={actualQty} onChange={e => setActualQty(e.target.value === "" ? "" : Number(e.target.value))} className="w-24 h-12 text-2xl font-bold text-right border-blue-400 focus-visible:ring-blue-500" />
                  <span className="text-sm font-normal text-slate-500 pb-1">{adjustmentModal.unit}</span>
                </div>
              </div>
            </div>
            {actualQty !== "" && (<div className={`text-center font-bold p-2 rounded ${Number(actualQty) - adjustmentModal.currentQty === 0 ? "bg-slate-100 text-slate-500" : Number(actualQty) - adjustmentModal.currentQty > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>差異: {Number(actualQty) - adjustmentModal.currentQty > 0 ? "+" : ""}{(Number(actualQty) - adjustmentModal.currentQty).toLocaleString()} {adjustmentModal.unit}</div>)}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">調整理由</label>
              <select value={adjReason} onChange={e => setAdjReason(e.target.value)} className="w-full border rounded p-2 bg-white"><option value="定例棚卸">定例棚卸</option><option value="ロス・廃棄">ロス・廃棄による減算</option><option value="入力もれ補正">入力もれ補正</option><option value="その他">その他</option></select>
            </div>
          </div>
          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => setAdjustmentModal({ ...adjustmentModal, isOpen: false })}>キャンセル</Button>
            <Button onClick={handleAdjustmentSubmit} disabled={isProcessing || actualQty === ""} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">{isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 在庫を確定する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}