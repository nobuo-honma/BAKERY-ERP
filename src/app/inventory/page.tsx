"use client";

import { useEffect, useState, useMemo, useCallback, useRef, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Package, ClipboardEdit, Save, Loader2, AlertCircle,
  CheckCircle2, Filter, Lock, Printer, ArrowLeft, Plus,
  UploadCloud, Download, FileSpreadsheet
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ==========================================================
// エディタの型解決不具合（windowやalertが見つからない等）を
// 完全に回避するための安全なグローバルヘルパー
// ==========================================================
const safeAlert = (message?: string) => {
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(message);
  }
};

const safeConfirm = (message?: string): boolean => {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm(message);
  }
  return false;
};

const safePrint = () => {
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }
};

type ItemStock = {
  id: string;
  name: string;
  item_type: 'raw_material' | 'material';
  unit: string;
  unit_size: number;
  unit_price: number;
  safety_stock: number;
  current_qty: number;
};

type ProductStock = {
  id: string;
  lot_code: string;
  product_id: string;
  total_pieces: number;
  expiry_date: string;
  products: { name: string; variant_name: string; unit_per_cs: number };
};

type AdjustmentHistory = {
  id: string;
  adjusted_at: string;
  item_id?: string;
  product_id?: string;
  items?: { name: string };
  products?: { name: string };
  lot_code?: string;
  before_qty: number;
  after_qty: number;
  diff: number;
  reason: string;
};

type ForecastFilter = 'all' | 'raw_material' | 'material';
type ForecastDay = {
  date: string;
  inQty: number;
  outQty: number;
  endQty: number;
};
type ForecastItemData = {
  item: ItemStock;
  days: Record<string, ForecastDay>;
};
type BomRow = {
  product_id: string;
  item_id: string;
  basis_type: 'production_qty' | 'planned_cs';
  usage_rate: number;
};
type ProductionPlanRow = {
  product_id: string;
  production_date: string;
  production_kg: number;
  planned_cs: number;
  status?: string;
};
type ArrivalRow = {
  item_id: string;
  expected_date: string;
  quantity: number;
  status?: string;
};
type ItemRecordFromDb = {
  id: string;
  name: string;
  item_type: ItemStock['item_type'];
  unit: string;
  unit_size?: number;
  unit_price?: number;
  safety_stock: number;
  item_stocks?: { quantity?: number } | Array<{ quantity?: number }> | null;
};
type ProductOption = {
  id: string;
  name: string;
  variant: string;
  unit: number;
};
type ParsedProductCsvRow = {
  lineNo: number;
  rawProduct: string;
  rawVariant: string;
  rawLot: string;
  rawExpiry: string;
  rawCs: number;
  rawP: number;
  matchedProductId?: string;
  matchedProductName?: string;
  unitPerCs?: number;
  totalPieces: number;
  error?: string;
};

export default function InventoryPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'print' | 'print_forecast' | 'print_usage'>('list');
  const [loading, setLoading] = useState(true);
  const [rawMaterials, setRawMaterials] = useState<ItemStock[]>([]);
  const [materials, setMaterials] = useState<ItemStock[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [histories, setHistories] = useState<AdjustmentHistory[]>([]);

  // 予測(MRP)用
  const [boms, setBoms] = useState<BomRow[]>([]);
  const [pendingPlans, setPendingPlans] = useState<ProductionPlanRow[]>([]);
  const [pendingArrivals, setPendingArrivals] = useState<ArrivalRow[]>([]);
  const [forecastFilter, setForecastFilter] = useState<ForecastFilter>('all');
  const [showOnlyScheduled, setShowOnlyScheduled] = useState(false);
  const [forecastPaperSize, setForecastPaperSize] = useState<'A4' | 'A3'>('A3');

  // 棚卸(調整)用
  const [adjustmentModal, setAdjustmentModal] = useState<{
    isOpen: boolean;
    type: 'item' | 'product';
    targetId: string;
    targetName: string;
    currentQty: number;
    unit: string;
    itemType?: 'raw_material' | 'material';
    lotCode?: string;
    productId?: string;
  }>({ isOpen: false, type: 'item', targetId: "", targetName: "", currentQty: 0, unit: "" });

  const [actualQty, setActualQty] = useState<number | "">("");
  const [adjReason, setAdjReason] = useState("定例棚卸");
  const [isProcessing, setIsProcessing] = useState(false);

  // 一括棚卸用
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchInputs, setBatchInputs] = useState<Record<string, number | "">>({});
  const [batchReason, setBatchReason] = useState("月末一斉棚卸");

  // 新規 Lot 登録用
  const [newStockModalOpen, setNewStockModalOpen] = useState(false);
  const [productsList, setProductsList] = useState<ProductOption[]>([]);
  const [newStockData, setNewStockData] = useState({ lotCode: "", productId: "", expiryDate: "", cs: 0, p: 0 });

  // CSV 一括登録用
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvParsedRows, setCsvParsedRows] = useState<ParsedProductCsvRow[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<'add' | 'overwrite'>('add');
  const [csvLoading, setCsvLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 数値フォーマットヘルパー
  const formatQty = useCallback((qty: number, itemType?: 'raw_material' | 'material' | 'product') => {
    if (itemType === 'raw_material') {
      return qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return Math.round(qty).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: itemsData } = await supabase.from("items").select(`*, item_stocks(quantity)`).order('id');
      const { data: pStocksData } = await supabase.from("product_stocks").select(`*, products(name, variant_name, unit_per_cs)`).order("expiry_date", { ascending: true });
      const { data: histData } = await supabase.from("inventory_adjustments").select(`*, items(name), products(name)`).order("adjusted_at", { ascending: false }).limit(50);
      const { data: bData } = await supabase.from("bom").select("*");
      const { data: plData } = await supabase.from("production_plans").select("*").eq("status", "planned");
      const { data: aData } = await supabase.from("arrivals").select("*").eq("status", "pending");
      const { data: prData } = await supabase.from("products").select("id, name, variant_name, unit_per_cs");

      if (itemsData) {
        const formattedItems = itemsData.map((item: ItemRecordFromDb) => {
          const itemStocks = Array.isArray(item.item_stocks) ? item.item_stocks[0] : item.item_stocks;
          const qty = itemStocks?.quantity ?? 0;
          return {
            id: item.id,
            name: item.name,
            item_type: item.item_type,
            unit: item.unit,
            unit_size: item.unit_size || 1,
            unit_price: item.unit_price || 0,
            safety_stock: item.safety_stock,
            current_qty: qty
          } satisfies ItemStock;
        });
        setRawMaterials(formattedItems.filter((i) => i.item_type === 'raw_material'));
        setMaterials(formattedItems.filter((i) => i.item_type === 'material'));
      }
      if (pStocksData) setProductStocks(pStocksData as ProductStock[]);
      if (histData) setHistories(histData as AdjustmentHistory[]);
      if (bData) setBoms(bData as BomRow[]);
      if (plData) setPendingPlans(plData as ProductionPlanRow[]);
      if (aData) setPendingArrivals(aData as ArrivalRow[]);
      if (prData) setProductsList(prData.map((p) => ({ id: p.id, name: p.name, variant: p.variant_name, unit: p.unit_per_cs })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
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
    const { type, targetId, currentQty, lotCode, productId, itemType } = adjustmentModal;

    const finalQty = itemType === 'raw_material' ? Number(actualQty) : Math.round(Number(actualQty));

    try {
      if (type === 'item') {
        await supabase.from("item_stocks").upsert({ item_id: targetId, quantity: finalQty }, { onConflict: 'item_id' });
        await supabase.from("inventory_adjustments").insert({
          item_id: targetId,
          before_qty: currentQty,
          after_qty: finalQty,
          reason: adjReason
        });
      } else {
        if (finalQty <= 0) {
          await supabase.from("product_stocks").delete().eq("id", targetId);
        } else {
          await supabase.from("product_stocks").update({ total_pieces: finalQty }).eq("id", targetId);
        }
        await supabase.from("inventory_adjustments").insert({
          product_id: productId,
          lot_code: lotCode,
          before_qty: currentQty,
          after_qty: finalQty,
          reason: adjReason
        });
      }
      setAdjustmentModal({ isOpen: false, type: 'item', targetId: "", targetName: "", currentQty: 0, unit: "" });
      setActualQty("");
      setAdjReason("定例棚卸");
      fetchInventory();
    } catch (error) {
      console.error(error);
      safeAlert("エラーが発生しました");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleBatchMode = () => {
    if (isBatchMode) {
      setIsBatchMode(false);
      setBatchInputs({});
    } else {
      const newInputs: Record<string, number> = {};
      rawMaterials.forEach(i => newInputs[i.id] = i.current_qty);
      materials.forEach(i => newInputs[i.id] = i.current_qty);
      productStocks.forEach(p => newInputs[p.id] = p.total_pieces);
      setBatchInputs(newInputs);
      setIsBatchMode(true);
    }
  };

  const handleBatchSubmit = async () => {
    setIsProcessing(true);
    try {
      const itemUpdates: { item_id: string; quantity: number }[] = [];
      const productUpdates: { id: string; total_pieces: number }[] = [];
      const productDeletes: string[] = [];
      const historyInserts: { item_id?: string; product_id?: string; lot_code?: string; before_qty: number; after_qty: number; reason: string }[] = [];

      for (const item of [...rawMaterials, ...materials]) {
        const newVal = batchInputs[item.id];
        if (newVal !== undefined && newVal !== "" && Number(newVal) !== item.current_qty) {
          const finalVal = item.item_type === 'raw_material' ? Number(newVal) : Math.round(Number(newVal));
          itemUpdates.push({ item_id: item.id, quantity: finalVal });
          historyInserts.push({ item_id: item.id, before_qty: item.current_qty, after_qty: finalVal, reason: batchReason });
        }
      }

      for (const stock of productStocks) {
        const newVal = batchInputs[stock.id];
        if (newVal !== undefined && newVal !== "" && Number(newVal) !== stock.total_pieces) {
          const finalVal = Math.round(Number(newVal));
          if (finalVal <= 0) {
            productDeletes.push(stock.id);
          } else {
            productUpdates.push({ id: stock.id, total_pieces: finalVal });
          }
          historyInserts.push({ product_id: stock.product_id, lot_code: stock.lot_code, before_qty: stock.total_pieces, after_qty: finalVal, reason: batchReason });
        }
      }

      if (itemUpdates.length === 0 && productUpdates.length === 0 && productDeletes.length === 0) {
        safeAlert("変更された在庫はありません。");
        setIsProcessing(false);
        return;
      }

      if (!safeConfirm(`合計 ${itemUpdates.length + productUpdates.length + productDeletes.length} 件の在庫を一括で上書き更新しますか?\n(理由は「${batchReason}」として記録されます)`)) {
        setIsProcessing(false);
        return;
      }

      if (itemUpdates.length > 0) await supabase.from('item_stocks').upsert(itemUpdates, { onConflict: 'item_id' });
      if (productUpdates.length > 0) await supabase.from('product_stocks').upsert(productUpdates, { onConflict: 'id' });
      if (productDeletes.length > 0) await supabase.from('product_stocks').delete().in('id', productDeletes);
      if (historyInserts.length > 0) await supabase.from('inventory_adjustments').insert(historyInserts);

      safeAlert(`一括棚卸を完了しました!\n(${itemUpdates.length + productUpdates.length + productDeletes.length} 件の在庫を更新しました)`);
      setIsBatchMode(false);
      setBatchInputs({});
      fetchInventory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      safeAlert("エラー: " + message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddNewStock = async () => {
    if (!newStockData.lotCode || !newStockData.productId || !newStockData.expiryDate) {
      safeAlert("必須項目を入力してください。");
      return;
    }
    if (newStockData.cs === 0 && newStockData.p === 0) {
      safeAlert("在庫数を入力してください。");
      return;
    }
    setIsProcessing(true);
    try {
      const selectedProduct = productsList.find(p => p.id === newStockData.productId);
      const unitPerCs = selectedProduct?.unit || 24;
      const totalPieces = Math.round((newStockData.cs * unitPerCs) + newStockData.p);

      const { data: existingStock } = await supabase.from('product_stocks').select('id, total_pieces').eq('lot_code', newStockData.lotCode).maybeSingle();

      if (existingStock) {
        const existingCs = Math.floor(existingStock.total_pieces / unitPerCs);
        if (!safeConfirm(`Lot番号「${newStockData.lotCode}」は既に存在します。\n現在の在庫(${existingCs}c/s)に、入力した数を追加加算しますか?`)) {
          setIsProcessing(false);
          return;
        }
        await supabase.from('product_stocks').update({ total_pieces: existingStock.total_pieces + totalPieces }).eq('id', existingStock.id);
        await supabase.from('inventory_adjustments').insert({
          lot_code: newStockData.lotCode,
          product_id: newStockData.productId,
          before_qty: existingStock.total_pieces,
          after_qty: existingStock.total_pieces + totalPieces,
          reason: `既存Lotへの追加登録`
        });
      } else {
        await supabase.from('product_stocks').insert({
          lot_code: newStockData.lotCode,
          product_id: newStockData.productId,
          total_pieces: totalPieces,
          expiry_date: newStockData.expiryDate
        });
        await supabase.from('inventory_adjustments').insert({
          product_id: newStockData.productId,
          lot_code: newStockData.lotCode,
          before_qty: 0,
          after_qty: totalPieces,
          reason: `システム導入前在庫の新規登録`
        });
      }
      safeAlert("在庫の追加登録が完了しました!");
      setNewStockModalOpen(false);
      setNewStockData({ lotCode: "", productId: "", expiryDate: "", cs: 0, p: 0 });
      fetchInventory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      safeAlert("エラーが発生しました:" + message);
    } finally {
      setIsProcessing(false);
    }
  };

  // CSV テンプレートダウンロード
  const downloadCsvTemplate = () => {
    const templateHeader = "製品名,バリエーション,Lot番号,賞味期限,ケース数,バラ数\n";
    let sampleRows = "";
    if (productsList.length > 0) {
      const p1 = productsList[0];
      const p2 = productsList[1] || productsList[0];
      sampleRows += `"${p1.name}","${p1.variant}","260723A","2026-08-15",10,0\n`;
      sampleRows += `"${p2.name}","${p2.variant}","260723B","2026-08-20",5,12\n`;
    } else {
      sampleRows += `"食パン","角食 2斤","260723A","2026-08-15",10,0\n`;
      sampleRows += `"フランスパン","バゲット","260723B","2026-08-20",5,12\n`;
    }

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
    const blob = new Blob([bom, templateHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "製品在庫一括登録テンプレート.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV 読込処理 (Shift_JIS / UTF-8 対応)
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text.includes("")) {
          const utf8Reader = new FileReader();
          utf8Reader.onload = (e2) => resolve(e2.target?.result as string);
          utf8Reader.onerror = () => resolve(text);
          utf8Reader.readAsText(file, "UTF-8");
        } else {
          resolve(text);
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, "Shift_JIS");
    });
  };

  const handleCsvFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setCsvLoading(true);

    try {
      const text = await readFileAsText(files[0]);
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        safeAlert("CSVファイルにデータ行が含まれていません。");
        setCsvLoading(false);
        return;
      }

      const parseCsvLine = (line: string) => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"(.*)"$/, '$1'));
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"(.*)"$/, '$1'));
        return result;
      };

      const headers = parseCsvLine(lines[0]);

      const idxProductId = headers.findIndex(h => /製品ID|product_id|ID/i.test(h));
      const idxProductName = headers.findIndex(h => /製品名|品名|product_name|product/i.test(h));
      const idxVariant = headers.findIndex(h => /バリエーション|規格|変種|variant|variant_name/i.test(h));
      const idxLot = headers.findIndex(h => /Lot|ロット|lot_code|lot_number/i.test(h));
      const idxExpiry = headers.findIndex(h => /賞味期限|有効期限|期限|expiry_date|expiry/i.test(h));
      const idxCs = headers.findIndex(h => /ケース|ケース数|cs|cs_qty/i.test(h));
      const idxP = headers.findIndex(h => /バラ|バラ数|個数|p|p_qty|piece/i.test(h));

      const parsed: ParsedProductCsvRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length === 0 || cols.every(c => c === "")) continue;

        const rawProductId = idxProductId >= 0 ? cols[idxProductId] || "" : "";
        const rawProduct = idxProductName >= 0 ? cols[idxProductName] || "" : "";
        const rawVariant = idxVariant >= 0 ? cols[idxVariant] || "" : "";
        const rawLot = idxLot >= 0 ? cols[idxLot] || "" : "";
        const rawExpiry = idxExpiry >= 0 ? cols[idxExpiry] || "" : "";
        const rawCsStr = idxCs >= 0 ? cols[idxCs] || "0" : "0";
        const rawPStr = idxP >= 0 ? cols[idxP] || "0" : "0";

        const csVal = Number(rawCsStr.replace(/[^0-9.]/g, '')) || 0;
        const pVal = Number(rawPStr.replace(/[^0-9.]/g, '')) || 0;

        let matchedProduct = productsList.find(p => p.id === rawProductId);

        if (!matchedProduct && rawProduct) {
          matchedProduct = productsList.find(p => {
            const nameMatch = p.name.trim().toLowerCase() === rawProduct.trim().toLowerCase();
            const variantMatch = !rawVariant || p.variant.trim().toLowerCase() === rawVariant.trim().toLowerCase();
            return nameMatch && variantMatch;
          });

          if (!matchedProduct) {
            matchedProduct = productsList.find(p => {
              const fullName = `${p.name} (${p.variant})`.toLowerCase();
              const fullName2 = `${p.name}${p.variant}`.toLowerCase();
              const target = rawProduct.toLowerCase();
              return fullName === target || fullName2 === target || p.name.trim().toLowerCase() === target;
            });
          }
        }

        let formattedExpiry = rawExpiry.replace(/\//g, '-').trim();
        if (/^\d{8}$/.test(formattedExpiry)) {
          formattedExpiry = `${formattedExpiry.substring(0, 4)}-${formattedExpiry.substring(4, 6)}-${formattedExpiry.substring(6, 8)}`;
        }

        let error = "";
        if (!matchedProduct) {
          error = `製品が見つかりません (${rawProduct || rawProductId || '未指定'})`;
        } else if (!rawLot) {
          error = "Lot番号が未入力です";
        } else if (!formattedExpiry || isNaN(Date.parse(formattedExpiry))) {
          error = `賞味期限が不正です (${rawExpiry})`;
        } else if (csVal <= 0 && pVal <= 0) {
          error = "ケース数またはバラ数を入力してください";
        }

        const unitPerCs = matchedProduct?.unit || 24;
        const totalPieces = Math.round((csVal * unitPerCs) + pVal);

        parsed.push({
          lineNo: i + 1,
          rawProduct,
          rawVariant,
          rawLot,
          rawExpiry: formattedExpiry,
          rawCs: csVal,
          rawP: pVal,
          matchedProductId: matchedProduct?.id,
          matchedProductName: matchedProduct ? `${matchedProduct.name} (${matchedProduct.variant})` : undefined,
          unitPerCs,
          totalPieces,
          error
        });
      }

      setCsvParsedRows(parsed);
    } catch (err) {
      console.error(err);
      safeAlert("CSVファイルの解析中にエラーが発生しました。");
    } finally {
      setCsvLoading(false);
    }
  };

  const handleCsvSubmit = async () => {
    const validRows = csvParsedRows.filter(r => !r.error);
    if (validRows.length === 0) {
      safeAlert("登録可能な有効データがありません。");
      return;
    }

    if (!safeConfirm(`${validRows.length} 件の製品在庫を一括登録しますか?\n(重複Lot処理: ${duplicateMode === 'add' ? '既存在庫へ加算' : '既存在庫を上書き'})`)) {
      return;
    }

    setIsProcessing(true);
    try {
      let successCount = 0;

      for (const row of validRows) {
        if (!row.matchedProductId || !row.rawLot || !row.rawExpiry) continue;

        const { data: existingStock } = await supabase
          .from('product_stocks')
          .select('id, total_pieces')
          .eq('lot_code', row.rawLot)
          .maybeSingle();

        if (existingStock) {
          if (duplicateMode === 'add') {
            const newTotal = existingStock.total_pieces + row.totalPieces;
            await supabase.from('product_stocks').update({
              total_pieces: newTotal,
              expiry_date: row.rawExpiry
            }).eq('id', existingStock.id);

            await supabase.from('inventory_adjustments').insert({
              lot_code: row.rawLot,
              product_id: row.matchedProductId,
              before_qty: existingStock.total_pieces,
              after_qty: newTotal,
              reason: `CSV一括登録 (既存Lot加算)`
            });
          } else {
            await supabase.from('product_stocks').update({
              total_pieces: row.totalPieces,
              expiry_date: row.rawExpiry
            }).eq('id', existingStock.id);

            await supabase.from('inventory_adjustments').insert({
              lot_code: row.rawLot,
              product_id: row.matchedProductId,
              before_qty: existingStock.total_pieces,
              after_qty: row.totalPieces,
              reason: `CSV一括登録 (既存Lot上書き)`
            });
          }
        } else {
          await supabase.from('product_stocks').insert({
            lot_code: row.rawLot,
            product_id: row.matchedProductId,
            total_pieces: row.totalPieces,
            expiry_date: row.rawExpiry
          });

          await supabase.from('inventory_adjustments').insert({
            lot_code: row.rawLot,
            product_id: row.matchedProductId,
            before_qty: 0,
            after_qty: row.totalPieces,
            reason: `CSV一括登録 (新規Lot)`
          });
        }

        successCount++;
      }

      safeAlert(`${successCount} 件の製品在庫一括登録が完了しました!`);
      setCsvModalOpen(false);
      setCsvParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchInventory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      safeAlert("一括登録中にエラーが発生しました: " + message);
    } finally {
      setIsProcessing(false);
    }
  };

  // MRP 計算ロジック
  const forecastResult = useMemo(() => {
    const dates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
    const todayStr = dates[0];
    const fData: Record<string, ForecastItemData> = {};

    [...rawMaterials, ...materials].forEach(item => {
      fData[item.id] = { item, days: {} };
      dates.forEach(date => {
        fData[item.id].days[date] = { date, inQty: 0, outQty: 0, endQty: 0 };
      });
    });

    pendingArrivals.forEach(arr => {
      const itemF = fData[arr.item_id];
      if (itemF) {
        const targetDate = arr.expected_date < todayStr ? todayStr : arr.expected_date;
        if (itemF.days[targetDate]) {
          itemF.days[targetDate].inQty += itemF.item.item_type === 'raw_material' ? arr.quantity : Math.round(arr.quantity);
        }
      }
    });

    pendingPlans.forEach(plan => {
      const targetDate = plan.production_date < todayStr ? todayStr : plan.production_date;
      const productBoms = boms.filter(b => b.product_id === plan.product_id);
      productBoms.forEach(bom => {
        const itemF = fData[bom.item_id];
        if (itemF && itemF.days[targetDate]) {
          const calculatedOut = bom.basis_type === 'production_qty'
            ? plan.production_kg * bom.usage_rate
            : plan.planned_cs * bom.usage_rate;

          const outQty = itemF.item.item_type === 'raw_material' ? calculatedOut : Math.round(calculatedOut);
          itemF.days[targetDate].outQty += outQty;
        }
      });
    });

    Object.values(fData).forEach((itemF) => {
      let current = itemF.item.current_qty;
      dates.forEach(date => {
        const day = itemF.days[date];
        const rawNext = current + day.inQty - day.outQty;
        current = itemF.item.item_type === 'raw_material' ? rawNext : Math.round(rawNext);
        day.endQty = current;
      });
    });

    return { dates, fData };
  }, [rawMaterials, materials, boms, pendingPlans, pendingArrivals]);

  const filteredForecastData = useMemo(() => {
    let allData = Object.values(forecastResult.fData);
    if (forecastFilter !== 'all') {
      allData = allData.filter((f) => f.item.item_type === forecastFilter);
    }
    if (showOnlyScheduled) {
      allData = allData.filter((f) => forecastResult.dates.some(date => f.days[date].outQty > 0));
    }
    return allData;
  }, [forecastResult.fData, forecastFilter, showOnlyScheduled, forecastResult.dates]);

  // 原材料・資材テーブル
  const renderItemTab = (itemList: ItemStock[]) => (
    <>
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table className="min-w-250 w-full border-collapse">
          <TableHeader className="bg-slate-50/80 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-24 pl-4 text-slate-600 font-bold">品目 ID</TableHead>
              <TableHead className="text-slate-600 font-bold">品目名</TableHead>
              <TableHead className="text-right w-32 text-slate-600 font-bold">現在庫</TableHead>
              <TableHead className="text-center w-24 text-slate-600 font-bold">規格</TableHead>
              <TableHead className="text-right w-28 text-slate-600 font-bold">規格換算</TableHead>
              <TableHead className="text-right w-28 text-slate-600 font-bold">単価</TableHead>
              <TableHead className="text-right w-32 text-slate-600 font-bold">在庫金額</TableHead>
              <TableHead className="w-28 text-center text-slate-600 font-bold">状態</TableHead>
              <TableHead className="w-28 text-center pr-4 text-slate-600 font-bold">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemList.map((item) => {
              const status = getStockStatus(item.current_qty, item.safety_stock);
              const isChanged = isBatchMode && batchInputs[item.id] !== undefined && Number(batchInputs[item.id]) !== item.current_qty;
              const displayQty = isBatchMode && batchInputs[item.id] !== undefined ? Number(batchInputs[item.id]) : item.current_qty;
              const specCount = displayQty / item.unit_size;
              const totalPrice = displayQty * item.unit_price;

              return (
                <TableRow key={item.id} className={`${isChanged ? "bg-amber-50/70 hover:bg-amber-100/50" : "hover:bg-slate-50/70"} border-b border-slate-100 transition-colors`}>
                  <TableCell className="font-mono text-xs text-blue-600 font-medium pl-4">{item.id}</TableCell>
                  <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                  <TableCell className="text-right">
                    {isBatchMode ? (
                      <div className="flex justify-end items-center gap-2">
                        <Input
                          type="number"
                          inputMode={item.item_type === 'raw_material' ? "decimal" : "numeric"}
                          min="0"
                          step={item.item_type === 'raw_material' ? "0.01" : "1"}
                          value={batchInputs[item.id] !== undefined ? batchInputs[item.id] : ""}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setBatchInputs({ ...batchInputs, [item.id]: e.currentTarget.value === "" ? "" : Number(e.currentTarget.value) })}
                          className={`w-28 text-right font-mono font-bold h-9 ${isChanged ? 'border-amber-400 bg-white ring-2 ring-amber-200' : 'border-slate-300 shadow-sm'}`}
                        />
                        {isChanged && <span className="text-[10px] text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 font-bold shrink-0">変更</span>}
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-slate-900 text-base">
                        {formatQty(item.current_qty, item.item_type)}
                        <span className="text-xs font-normal text-slate-500 ml-1">{item.unit}</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-slate-600 bg-slate-50/50 font-medium">
                    {item.unit_size}<span className="text-xs font-normal text-slate-400 ml-0.5">{item.unit}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-emerald-700 bg-emerald-50/30">
                    {specCount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    <span className="text-[10px] font-normal text-emerald-600 ml-0.5">入</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-600 font-medium">
                    ¥{item.unit_price.toLocaleString()}
                    <span className="text-[10px] font-normal text-slate-400 block">/{item.unit}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                    ¥{Math.floor(totalPrice).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`px-2 py-0.5 text-xs shadow-none border ${status.color}`}>{status.icon} {status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-center pr-4">
                    {canEdit && (
                      <Button
                        disabled={isBatchMode}
                        variant="outline"
                        size="sm"
                        onClick={() => setAdjustmentModal({ isOpen: true, type: 'item', targetId: item.id, targetName: item.name, currentQty: item.current_qty, unit: item.unit, itemType: item.item_type })}
                        className="h-8 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <ClipboardEdit className="w-3.5 h-3.5 mr-1" /> 個別調整
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* スマホ表示カード */}
      <div className="block md:hidden space-y-3 pb-24">
        {itemList.map((item) => {
          const status = getStockStatus(item.current_qty, item.safety_stock);
          const isChanged = isBatchMode && batchInputs[item.id] !== undefined && Number(batchInputs[item.id]) !== item.current_qty;
          const displayQty = isBatchMode && batchInputs[item.id] !== undefined ? Number(batchInputs[item.id]) : item.current_qty;
          const specCount = displayQty / item.unit_size;
          const totalPrice = displayQty * item.unit_price;

          return (
            <Card key={item.id} className={`p-4 shadow-sm border ${isChanged ? 'bg-amber-50/50 border-amber-300' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-slate-800 text-base">{item.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {item.id}</div>
                </div>
                <Badge className={`px-1.5 py-0.5 text-[10px] ${status.color}`}>{status.label}</Badge>
              </div>

              {isBatchMode ? (
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-inner flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                    <span>実現在庫入力</span>
                    {isChanged && <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">変更あり</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode={item.item_type === 'raw_material' ? "decimal" : "numeric"}
                      min="0"
                      step={item.item_type === 'raw_material' ? "0.01" : "1"}
                      value={batchInputs[item.id] !== undefined ? batchInputs[item.id] : ""}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setBatchInputs({ ...batchInputs, [item.id]: e.currentTarget.value === "" ? "" : Number(e.currentTarget.value) })}
                      className="text-right font-mono font-bold text-xl h-11 border-slate-300"
                    />
                    <span className="font-medium text-slate-600 text-sm">{item.unit}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-end mt-2 pt-2 border-t border-slate-100">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">現在庫</div>
                    <div className="font-mono font-bold text-2xl text-slate-800">
                      {formatQty(item.current_qty, item.item_type)}
                      <span className="text-xs font-normal text-slate-500 ml-1">{item.unit}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjustmentModal({ isOpen: true, type: 'item', targetId: item.id, targetName: item.name, currentQty: item.current_qty, unit: item.unit, itemType: item.item_type })}
                      className="border-slate-200 text-slate-700 bg-white shadow-sm"
                    >
                      <ClipboardEdit className="w-3.5 h-3.5 mr-1" /> 調整
                    </Button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                <div className="space-y-1 text-slate-500">
                  <div>規格: <span className="font-medium text-slate-700">{item.unit_size}{item.unit}</span></div>
                  <div>単価: <span className="font-medium text-slate-700">¥{item.unit_price.toLocaleString()}</span></div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-emerald-700 font-medium">
                    換算数: {specCount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} 入
                  </div>
                  <div className="font-bold text-blue-700">
                    評価額: ¥{Math.floor(totalPrice).toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );

  // 実地棚卸票 PDF (在庫一覧)
  if (viewMode === 'print') {
    const todayStr = new Date().toLocaleDateString('ja-JP');
    const printItems = [
      ...rawMaterials.map(i => ({
        id: i.id,
        category: ' 原材料 ',
        name: i.name,
        qty: `${formatQty(i.current_qty, 'raw_material')} ${i.unit}`,
        rawQty: i.current_qty,
        expiry: undefined
      })),
      ...materials.map(i => ({
        id: i.id,
        category: ' 資材 ',
        name: i.name,
        qty: `${formatQty(i.current_qty, 'material')} ${i.unit}`,
        rawQty: i.current_qty,
        expiry: undefined
      })),
      ...productStocks.map(p => {
        const u = p.products.unit_per_cs || 24;
        const cs = Math.floor(p.total_pieces / u);
        const pc = Math.round(p.total_pieces % u);
        return {
          id: p.lot_code,
          category: '製品 (Lot 別)',
          name: `${p.products.name} (${p.products.variant_name})`,
          qty: `${cs.toLocaleString()} c/s${pc > 0 ? ` ${pc.toLocaleString()} p` : ''}`,
          rawQty: p.total_pieces,
          expiry: new Date(p.expiry_date).toLocaleDateString('ja-JP')
        };
      })
    ];

    const chunkedItems = [];
    for (let i = 0; i < printItems.length; i += 35) {
      chunkedItems.push(printItems.slice(i, i + 35));
    }

    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{ __html: `@media print { header, nav { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; } @page { size: A4 portrait; margin: 10mm; } body { background-color: white !important; color: black !important; } .print-hide { display: none !important; } .page-break { page-break-after: always; } }` }} />
        <div className="w-[210mm] print:w-full flex justify-between mb-4 print-hide">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300">
            <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
          </Button>
          <Button onClick={() => { safePrint(); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
            <Printer className="h-5 w-5 mr-2" /> 印刷する
          </Button>
        </div>

        {chunkedItems.length === 0 ? (
          <div className="w-[210mm] bg-white p-8 text-center text-slate-500 font-bold shadow-xl">データがありません</div>
        ) : (
          chunkedItems.map((chunk, pageIdx) => (
            <div key={pageIdx} className={`w-[210mm] min-h-[297mm] bg-white p-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col ${pageIdx < chunkedItems.length - 1 ? 'page-break mb-8 print:mb-0' : ''}`}>
              <div className="flex justify-between items-end mb-4 border-b-2 border-black pb-2">
                <h1 className="text-xl font-bold tracking-widest">在庫一覧 兼 実地棚卸表</h1>
                <div className="text-xs font-mono">作成日: {todayStr} ({pageIdx + 1} / {chunkedItems.length} ページ)</div>
              </div>
              <table className="w-full border-collapse border border-slate-800 text-xs flex-1">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-800 py-2 w-[18%] font-bold text-center">ID / Lot</th>
                    <th className="border border-slate-800 py-2 w-[12%] font-bold text-center">区分</th>
                    <th className="border border-slate-800 py-2 w-[35%] font-bold text-left px-2">品目名 / 製品名</th>
                    <th className="border border-slate-800 py-2 w-[15%] font-bold text-right px-2">帳簿現在庫</th>
                    <th className="border border-slate-800 py-2 w-[20%] font-bold text-center">実数記入欄</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((item, idx) => (
                    <tr key={idx} className="h-7 text-[12px] hover:bg-slate-50/50">
                      <td className="border border-slate-300 px-2 text-center font-mono">{item.id}</td>
                      <td className="border border-slate-300 px-1 text-center text-[10px] text-slate-600">{item.category}</td>
                      <td className="border border-slate-300 px-2 font-medium">
                        {item.name}{item.expiry && <span className="text-[10px] font-normal ml-2 text-gray-500">(期限: {item.expiry})</span>}
                      </td>
                      <td className="border border-slate-300 px-2 text-right font-mono font-medium">{item.qty}</td>
                      <td className="border border-slate-400 px-2 bg-slate-50/30"></td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 35 - chunk.length) }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-7 border-b border-slate-300">
                      <td className="border-r border-slate-300"></td>
                      <td className="border-r border-slate-300"></td>
                      <td className="border-r border-slate-300"></td>
                      <td className="border-r border-slate-300"></td>
                      <td className="border-r border-slate-300"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-end gap-6 text-xs">
                <div className="border border-slate-800 w-44 h-16 flex flex-col"><div className="border-b border-slate-800 text-center py-0.5 bg-slate-100 font-bold">棚卸 担当者</div></div>
                <div className="border border-slate-800 w-44 h-16 flex flex-col"><div className="border-b border-slate-800 text-center py-0.5 bg-slate-100 font-bold">システム入力 担当者</div></div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // 在庫推移予測 PDF (A4 横) - ★数字の重なり問題を解消したバージョン
  if (viewMode === 'print_forecast') {
    const printDate = new Date().toLocaleDateString('ja-JP');
    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            header, nav { display: none !important; }
            main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
            @page {
              size: ${forecastPaperSize === 'A3' ? 'A3 portrait' : 'A4 landscape'};
              margin-top: 30mm;
              margin-bottom: 20mm;
              margin-left: 10mm;
              margin-right: 10mm;
              @top-left {
                content: "在庫推移予測 (MRP カレンダー)";
                font-size: 11pt;
                font-weight: bold;
                font-family: sans-serif;
                vertical-align: bottom;
                padding-bottom: 4mm;
                border-bottom: 1pt solid black;
              }
              @top-right {
                content: "作成日: ${printDate}";
                font-size: 8pt;
                font-family: monospace;
                vertical-align: bottom;
                padding-bottom: 4mm;
              }
              @bottom-center {
                content: counter(page) " / " counter(pages);
                font-size: 9pt;
                font-family: sans-serif;
                padding-top: 3mm;
                border-top: 0.5pt solid #888;
                vertical-align: top;
              }
            }
            body { background-color: white !important; color: black !important; }
            .print-hide { display: none !important; }
            .print-doc-header { display: none !important; }
            thead { display: table-header-group !important; }
            tfoot { display: table-footer-group !important; }
          }
        `}} />
        <div className="w-[297mm] print:w-full flex justify-between items-center mb-4 print-hide">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300">
            <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
          </Button>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-md p-1 shadow-sm mr-4">
              <span className="text-xs font-bold text-slate-500 pl-2">用紙:</span>
              <Button
                variant={forecastPaperSize === 'A4' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setForecastPaperSize('A4')}
                className={`h-7 px-3 text-xs ${forecastPaperSize === 'A4' ? 'bg-slate-700 hover:bg-slate-800' : 'text-slate-600'}`}
              >
                A4横
              </Button>
              <Button
                variant={forecastPaperSize === 'A3' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setForecastPaperSize('A3')}
                className={`h-7 px-3 text-xs ${forecastPaperSize === 'A3' ? 'bg-slate-700 hover:bg-slate-800' : 'text-slate-600'}`}
              >
                A3縦
              </Button>
            </div>
            <Button onClick={() => { safePrint(); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
              <Printer className="h-5 w-5 mr-2" /> 印刷する
            </Button>
          </div>
        </div>
        <div className="w-[297mm] bg-white py-8 px-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between">
          {/* 画面表示用ヘッダー（印刷時は @page margin-box で代替されるため非表示） */}
          <div className="print-doc-header flex justify-between items-end mb-4 border-b-2 border-black pb-2">
            <h1 className="text-xl font-bold tracking-widest">在庫推移予測 (MRP カレンダー)</h1>
            <div className="text-xs font-mono">作成日: {printDate}</div>
          </div>
          <table className="w-full border-collapse border border-slate-800 text-[9px] table-fixed">
            <thead>
              <tr className="bg-slate-100 h-8">
                <th className="border border-slate-800 py-1 w-[14%] font-bold text-center text-[10px]">品目名</th>
                <th className="border border-slate-800 py-1 w-[6%] font-bold text-right px-1.5 text-[9px]">現在庫</th>
                {forecastResult.dates.map(date => {
                  const d = new Date(date);
                  return <th key={date} className="border border-slate-800 py-1 leading-tight font-bold text-center w-[2.6%] text-[8px]">{d.getMonth() + 1}/{d.getDate()}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {filteredForecastData.map((f) => (
                <tr key={f.item.id} className="h-12 hover:bg-slate-50 border-b border-slate-300">
                  <td className="border-r border-slate-300 px-1.5 font-semibold truncate whitespace-nowrap text-slate-800 text-[10px]">{f.item.name}</td>
                  <td className="border-r border-slate-300 text-right pr-1.5 font-mono font-bold bg-slate-50/50 text-slate-900 text-[9px]">{formatQty(f.item.current_qty, f.item.item_type)}</td>
                  {forecastResult.dates.map(date => {
                    const day = f.days[date];
                    const isShort = day.endQty < 0;
                    const hasChange = day.inQty > 0 || day.outQty > 0;
                    return (
                      <td key={date} className={`border-r border-slate-300 p-0.5 text-center ${isShort ? 'bg-red-50' : ''}`}>
                        <div className="flex flex-col justify-between h-full min-h-10 py-0.5">
                          {/* 入出荷の変動表示 (重なりを防ぐために縦に並べる、幅が極小なのでtracking-tighterを適用) */}
                          <div className="flex flex-col text-[7px] leading-none tracking-tighter">
                            {day.inQty > 0 && <span className="text-blue-600 font-bold">+{formatQty(day.inQty, f.item.item_type)}</span>}
                            {day.outQty > 0 && <span className="text-red-500 font-bold">-{formatQty(day.outQty, f.item.item_type)}</span>}
                            {!hasChange && <div className="h-1.75 opacity-0">-</div>}
                          </div>
                          {/* 最終在庫 (下部に固定して、トラッキングを詰める) */}
                          <div className={`font-mono text-[8px] font-bold tracking-tighter leading-none mt-auto ${isShort ? 'text-red-600 font-black' : 'text-slate-800'}`}>
                            {formatQty(day.endQty, f.item.item_type)}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-[10px] text-slate-500 flex gap-4 border-t pt-3">
            <div><span className="text-blue-600 font-bold">+N</span> は入荷予定</div>
            <div><span className="text-red-500 font-bold">-N</span> は製造使用予定</div>
            <div className="bg-red-50 px-1 border border-red-200 text-red-600 font-medium">背景薄赤は在庫不足(マイナス)警告</div>
          </div>
        </div>
      </div>
    );
  }

  // 使用予定(消費予定のみ) PDF (A4 横)
  if (viewMode === 'print_usage') {
    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{ __html: `@media print { header, nav { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; } @page { size: A4 landscape; margin: 10mm; } body { background-color: white !important; color: black !important; } .print-hide { display: none !important; } }` }} />
        <div className="w-[297mm] print:w-full flex justify-between mb-4 print-hide">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300">
            <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
          </Button>
          <Button onClick={() => { safePrint(); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
            <Printer className="h-5 w-5 mr-2" /> 印刷する
          </Button>
        </div>
        <div className="w-[297mm] h-[210mm] bg-white pt-8 pb-6 px-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between">
          <div className="flex justify-between items-end mb-4 border-b-2 border-black pb-2">
            <h1 className="text-xl font-bold tracking-widest">使用予測カレンダー (原料・資材 消費予定)</h1>
            <div className="text-xs font-mono">作成日: {new Date().toLocaleDateString('ja-JP')}</div>
          </div>
          <table className="w-full border-collapse border border-slate-800 text-[10px] flex-1 table-fixed">
            <thead>
              <tr className="bg-slate-100 h-8">
                <th className="border border-slate-800 py-1 w-[14%] font-bold text-center">品目名</th>
                <th className="border border-slate-800 py-1 w-[4%] font-bold text-center bg-white">単位</th>
                {forecastResult.dates.map(date => {
                  const d = new Date(date);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return <th key={date} className={`border border-slate-800 py-0.5 leading-tight font-bold text-center w-[2.7%] ${isWeekend ? 'bg-red-50 text-red-600' : 'text-slate-800'}`}>{d.getMonth() + 1}/{d.getDate()}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {filteredForecastData.filter((f) => {
                return forecastResult.dates.some(date => f.days[date].outQty > 0);
              }).map((f) => (
                <tr key={f.item.id} className="h-8 hover:bg-slate-50">
                  <td className="border-r border-slate-300 px-1.5 font-medium truncate whitespace-nowrap text-slate-800">{f.item.name}</td>
                  <td className="border-r border-slate-300 text-center text-[10px] text-slate-500 bg-slate-50/50">{f.item.unit}</td>
                  {forecastResult.dates.map(date => {
                    const outQty = f.days[date].outQty;
                    return (
                      <td key={date} className="border-r border-slate-300 text-center font-mono font-bold tracking-tighter text-[9px]">
                        {outQty > 0 ? <span className="text-red-600">{formatQty(outQty, f.item.item_type)}</span> : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[10px] text-slate-500">※ この表には、製造計画に基づいて「消費(使用)」される数量のみが印字されています。</div>
        </div>
      </div>
    );
  }

  // 通常の画面レンダリング開始
  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>;

  return (
    <div className="bg-slate-50 min-h-screen md:bg-transparent -mx-4 px-4 md:mx-0 md:px-0 pt-4 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-2 text-slate-800"><Package className="h-6 w-6 text-blue-600" /> 在庫管理・棚卸</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {canEdit && (
            <>
              <Button onClick={() => setCsvModalOpen(true)} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm h-11 md:h-10 text-sm">
                <UploadCloud className="h-4 w-4 mr-1.5" /> CSV一括登録
              </Button>
              <Button onClick={() => setNewStockModalOpen(true)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm h-11 md:h-10 text-sm">
                <Plus className="h-4 w-4 mr-1.5" /> 新規 Lot 登録
              </Button>
            </>
          )}
          <Button onClick={() => setViewMode('print')} className="w-full md:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-11 md:h-10 text-sm">
            <Printer className="h-4 w-4 mr-1.5" /> 在庫表印刷(PDF)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="product" className="w-full">
        <div className="flex flex-col mb-4 md:mb-6 gap-3">
          <TabsList className="bg-slate-200/80 p-1 rounded-xl h-12 w-full md:w-auto self-start shadow-inner">
            <TabsTrigger value="product" className="rounded-lg font-bold px-4">製品在庫 (Lot別)</TabsTrigger>
            <TabsTrigger value="raw_material" className="rounded-lg font-bold px-4">原材料一覧</TabsTrigger>
            <TabsTrigger value="material" className="rounded-lg font-bold px-4">資材一覧</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg font-bold px-4">棚卸・調整履歴</TabsTrigger>
            <TabsTrigger value="forecast" className="rounded-lg font-bold px-4">在庫推移予測 (MRP)</TabsTrigger>
          </TabsList>

          {/* 一括操作バー */}
          {canEdit && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={isBatchMode ? "default" : "outline"} className={isBatchMode ? "bg-blue-600 border-none" : ""}>
                  {isBatchMode ? "一括棚卸モード中" : "通常モード"}
                </Badge>
                <p className="text-xs text-slate-500 font-medium">
                  {isBatchMode ? "各品目の実数を入力し「一括保存」を押してください。資材・製品は自動で整数に丸められます。" : "個別、または一斉に棚卸更新を行うことができます。"}
                </p>
              </div>
              <div className="flex items-center gap-2 self-end md:self-auto w-full md:w-auto justify-end">
                {isBatchMode && (
                  <select
                    value={batchReason}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setBatchReason(e.currentTarget.value)}
                    className="border border-slate-300 rounded-lg text-xs font-bold p-2 bg-slate-50 h-9"
                  >
                    <option value="月末一斉棚卸">月末一斉棚卸</option>
                    <option value="中間棚卸">中間棚卸</option>
                    <option value="データ補正">データ補正</option>
                  </select>
                )}
                <Button variant={isBatchMode ? "ghost" : "outline"} size="sm" onClick={toggleBatchMode} className="font-bold shrink-0 h-9">
                  {isBatchMode ? "キャンセル" : "一括棚卸を始める"}
                </Button>
                {isBatchMode && (
                  <Button size="sm" onClick={handleBatchSubmit} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shrink-0 h-9">
                    {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4 mr-1" />} 一括保存
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 製品在庫タブ */}
        <TabsContent value="product" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <Table className="min-w-250 w-full border-collapse">
              <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-32 pl-4 text-slate-600 font-bold">Lot 番号</TableHead>
                  <TableHead className="text-slate-600 font-bold">製品名</TableHead>
                  <TableHead className="w-32 text-center text-slate-600 font-bold">有効期限</TableHead>
                  <TableHead className="text-right w-44 text-slate-600 font-bold">現在庫 (総バラ数)</TableHead>
                  <TableHead className="text-right w-44 text-slate-600 font-bold">ケース換算 (入数)</TableHead>
                  <TableHead className="w-28 text-center pr-4 text-slate-600 font-bold">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productStocks.map((stock) => {
                  const u = stock.products.unit_per_cs || 24;
                  const isChanged = isBatchMode && batchInputs[stock.id] !== undefined && Number(batchInputs[stock.id]) !== stock.total_pieces;
                  const displayQty = isBatchMode && batchInputs[stock.id] !== undefined ? Number(batchInputs[stock.id]) : stock.total_pieces;

                  const finalDisplayQty = Math.round(displayQty);
                  const cs = Math.floor(finalDisplayQty / u);
                  const pc = finalDisplayQty % u;

                  return (
                    <TableRow key={stock.id} className={`${isChanged ? "bg-amber-50/70 hover:bg-amber-100/50" : "hover:bg-slate-50/70"} border-b border-slate-100 transition-colors`}>
                      <td className="font-mono text-xs font-bold pl-4 text-slate-700">{stock.lot_code}</td>
                      <td className="font-bold text-slate-800">
                        {stock.products.name}
                        <span className="text-xs font-normal text-slate-500 ml-2">({stock.products.variant_name})</span>
                      </td>
                      <td className="text-center font-mono text-xs text-slate-600 font-medium">{stock.expiry_date}</td>
                      <td className="text-right">
                        {isBatchMode ? (
                          <div className="flex justify-end items-center gap-2">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              value={batchInputs[stock.id] !== undefined ? batchInputs[stock.id] : ""}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => setBatchInputs({ ...batchInputs, [stock.id]: e.currentTarget.value === "" ? "" : Number(e.currentTarget.value) })}
                              className={`w-28 text-right font-mono font-bold h-9 ${isChanged ? 'border-amber-400 bg-white ring-2 ring-amber-200' : 'border-slate-300 shadow-sm'}`}
                            />
                            <span className="text-xs font-normal text-slate-500 w-8 text-left">P</span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-900 text-lg">
                            {finalDisplayQty.toLocaleString()}
                            <span className="text-xs font-normal text-slate-500 ml-1">P</span>
                          </span>
                        )}
                      </td>
                      <td className="text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                        {cs.toLocaleString()} <span className="text-xs font-normal text-slate-500">c/s</span>
                        {pc > 0 ? (
                          <>
                            <span className="mx-1 text-slate-300">/</span>
                            {pc} <span className="text-xs font-normal text-slate-500">p</span>
                          </>
                        ) : ''}
                        <span className="text-[9px] font-normal text-slate-400 block mt-0.5">({u}入)</span>
                      </td>
                      <td className="text-center pr-4">
                        {canEdit && (
                          <Button
                            disabled={isBatchMode}
                            variant="outline"
                            size="sm"
                            onClick={() => setAdjustmentModal({ isOpen: true, type: 'product', targetId: stock.id, targetName: `${stock.products.name} (${stock.products.variant_name})`, currentQty: stock.total_pieces, unit: "ピース", lotCode: stock.lot_code, productId: stock.product_id })}
                            className="h-8 border-slate-200 text-slate-700 hover:bg-slate-50"
                          >
                            <ClipboardEdit className="w-3.5 h-3.5 mr-1" /> 個別調整
                          </Button>
                        )}
                      </td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* スマホ用製品リスト */}
          <div className="block md:hidden space-y-3 pb-24">
            {productStocks.map((stock) => {
              const u = stock.products.unit_per_cs || 24;
              const isChanged = isBatchMode && batchInputs[stock.id] !== undefined && Number(batchInputs[stock.id]) !== stock.total_pieces;
              const displayQty = isBatchMode && batchInputs[stock.id] !== undefined ? Number(batchInputs[stock.id]) : stock.total_pieces;

              const finalDisplayQty = Math.round(displayQty);
              const cs = Math.floor(finalDisplayQty / u);
              const pc = finalDisplayQty % u;

              return (
                <Card key={stock.id} className={`p-4 shadow-sm border ${isChanged ? 'bg-amber-50/50 border-amber-300' : 'border-slate-200'}`}>
                  <div className="font-bold text-slate-800 leading-snug">{stock.products.name} ({stock.products.variant_name})</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1 flex justify-between">
                    <span>Lot: {stock.lot_code}</span>
                    <span>期限: {stock.expiry_date}</span>
                  </div>

                  {isBatchMode ? (
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-inner mt-2 flex flex-col gap-1.5">
                      <div className="text-xs font-bold text-slate-500">実在庫入力 (バラP単位)</div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          value={batchInputs[stock.id] !== undefined ? batchInputs[stock.id] : ""}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setBatchInputs({ ...batchInputs, [stock.id]: e.currentTarget.value === "" ? "" : Number(e.currentTarget.value) })}
                          className="text-right font-mono font-bold text-xl h-11 border-slate-300"
                        />
                        <span className="font-medium text-slate-600 text-sm">P</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-end border-t border-slate-100 pt-2.5 mt-3">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold">ケース換算 ({u}入)</div>
                        <div className="text-base font-bold text-blue-800 bg-blue-50/50 px-2 py-0.5 rounded inline-block mt-0.5">
                          {cs} <span className="text-xs font-normal">c/s</span> {pc > 0 ? ` ${pc} p` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-bold">総計</div>
                        <div className="font-mono font-bold text-slate-700">
                          {finalDisplayQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">P</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* 原材料タブ */}
        <TabsContent value="raw_material" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          {renderItemTab(rawMaterials)}
        </TabsContent>

        {/* 資材タブ */}
        <TabsContent value="material" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          {renderItemTab(materials)}
        </TabsContent>

        {/* 履歴タブ */}
        <TabsContent value="history" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <Table className="w-full border-collapse">
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="pl-4 w-44 text-slate-600 font-bold">調整日時</TableHead>
                  <TableHead className="text-slate-600 font-bold">対象品目 / Lot</TableHead>
                  <TableHead className="text-right w-28 text-slate-600 font-bold">調整前</TableHead>
                  <TableHead className="text-right w-28 text-slate-600 font-bold">調整後</TableHead>
                  <TableHead className="text-right w-28 text-slate-600 font-bold">在庫差異</TableHead>
                  <TableHead className="pl-6 text-slate-600 font-bold">調整理由</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {histories.map((h) => {
                  const name = h.items?.name || h.products?.name || "不明な品目";
                  const suffix = h.lot_code ? ` (Lot: ${h.lot_code})` : "";
                  const isRaw = !h.product_id && rawMaterials.some(r => r.name === h.items?.name);
                  const typeLabel = isRaw ? 'raw_material' : 'material';
                  const diff = h.after_qty - h.before_qty;

                  return (
                    <TableRow key={h.id} className="text-xs hover:bg-slate-50 border-b border-slate-100 last:border-none transition-colors">
                      <td className="pl-4 text-slate-500 font-mono">{new Date(h.adjusted_at).toLocaleString('ja-JP')}</td>
                      <td className="font-bold text-slate-700">{name}{suffix}</td>
                      <td className="text-right font-mono text-slate-600">{formatQty(h.before_qty, typeLabel)}</td>
                      <td className="text-right font-mono font-semibold text-slate-800">{formatQty(h.after_qty, typeLabel)}</td>
                      <td className={`text-right font-mono font-bold ${diff > 0 ? 'text-green-600 bg-green-50/30' : diff < 0 ? 'text-red-600 bg-red-50/30' : 'text-slate-400'}`}>
                        {diff > 0 ? "+" : ""}{formatQty(diff, typeLabel)}
                      </td>
                      <td className="pl-6 text-slate-600 font-medium">{h.reason}</td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 在庫推移予測タブ (画面表示用) - ★フレックス構成による重なりバグ解消 */}
        <TabsContent value="forecast" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={forecastFilter}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setForecastFilter(e.currentTarget.value as ForecastFilter)}
                    className="border border-slate-200 rounded-lg p-1.5 text-xs font-bold bg-white text-slate-700 h-9"
                  >
                    <option value="all">すべての品目</option>
                    <option value="raw_material">原材料のみ</option>
                    <option value="material">資材のみ</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg h-9 hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={showOnlyScheduled}
                    onChange={(e) => setShowOnlyScheduled(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-700">使用予定の品目のみ表示</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewMode('print_forecast')} className="border-slate-200 font-bold text-xs h-9">
                  <Printer className="w-3.5 h-3.5 mr-1" /> 推移表(PDF)
                </Button>
                <Button size="sm" variant="outline" onClick={() => setViewMode('print_usage')} className="border-slate-200 font-bold text-xs h-9">
                  <Printer className="w-3.5 h-3.5 mr-1" /> 消費カレンダー(PDF)
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <Table className="text-[11px] min-w-300 table-fixed w-full border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="w-48 font-bold pl-3 text-slate-600">品目名</TableHead>
                    <TableHead className="w-24 text-right font-bold bg-slate-100/60 pr-3 text-slate-700 border-r border-slate-200">現在庫</TableHead>
                    {forecastResult.dates.map(date => {
                      const d = new Date(date);
                      return <TableHead key={date} className="w-16 text-center font-bold p-1 text-slate-600 border-r border-slate-100 last:border-0">{d.getMonth() + 1}/{d.getDate()}</TableHead>;
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredForecastData.map((f) => (
                    <TableRow key={f.item.id} className="hover:bg-slate-50/80 border-b border-slate-100 last:border-none transition-colors">
                      <td className="font-bold text-slate-800 truncate pl-3">{f.item.name}</td>
                      <td className="text-right font-mono font-bold bg-slate-50/50 pr-3 text-blue-800 border-r border-slate-200">{formatQty(f.item.current_qty, f.item.item_type)}</td>
                      {forecastResult.dates.map(date => {
                        const day = f.days[date];
                        const isShort = day.endQty < 0;
                        const hasChange = day.inQty > 0 || day.outQty > 0;
                        return (
                          <td key={date} className={`text-center p-1 border-r border-slate-100 last:border-0 h-12 ${isShort ? 'bg-red-50/70' : ''}`}>
                            <div className="flex flex-col justify-between h-full min-h-10 py-0.5">
                              {/* 上部：入出荷の変動数値 */}
                              <div className="flex flex-col text-[7px] leading-none tracking-tighter">
                                {day.inQty > 0 && <span className="text-blue-600 font-bold">+{formatQty(day.inQty, f.item.item_type)}</span>}
                                {day.outQty > 0 && <span className="text-red-500 font-bold">-{formatQty(day.outQty, f.item.item_type)}</span>}
                                {!hasChange && <div className="h-1.75 opacity-0">-</div>}
                              </div>
                              {/* 下部：計算後在庫数量 */}
                              <div className={`font-mono text-[8px] font-bold tracking-tighter leading-none mt-auto ${isShort ? 'text-red-600 font-black' : 'text-slate-700'}`}>
                                {formatQty(day.endQty, f.item.item_type)}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* 凡例 */}
            <div className="mt-3 text-[10px] text-slate-500 flex flex-wrap gap-4 border-t border-slate-100 pt-3">
              <div><span className="text-blue-600 font-bold">+N</span> は入荷予定</div>
              <div><span className="text-red-500 font-bold">-N</span> は製造使用予定</div>
              <div className="bg-red-50 px-1 border border-red-200 text-red-600 font-medium">背景薄赤は在庫不足(マイナス)警告</div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 個別棚卸ダイアログ */}
      <Dialog open={adjustmentModal.isOpen} onOpenChange={(open) => !open && setAdjustmentModal({ ...adjustmentModal, isOpen: false })}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle className="font-black text-slate-800 text-lg">実地棚卸・在庫調整</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-400 font-bold mb-1">対象品目</div>
              <div className="font-bold text-slate-800 text-base leading-tight">{adjustmentModal.targetName}</div>
              {adjustmentModal.lotCode && <div className="text-xs font-mono text-blue-600 mt-1 font-bold">Lot: {adjustmentModal.lotCode}</div>}
              <div className="text-xs text-slate-500 mt-2.5 font-medium">
                理論現在庫: <span className="font-mono font-bold text-slate-800">{formatQty(adjustmentModal.currentQty, adjustmentModal.itemType || 'product')} {adjustmentModal.unit}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500">棚卸実数入力 ({adjustmentModal.unit})</label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  inputMode={adjustmentModal.itemType === 'raw_material' ? "decimal" : "numeric"}
                  min="0"
                  step={adjustmentModal.itemType === 'raw_material' ? "0.01" : "1"}
                  placeholder="実数量を入力"
                  value={actualQty}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setActualQty(e.currentTarget.value === "" ? "" : Number(e.currentTarget.value))}
                  className="text-right font-mono font-bold text-2xl h-12 border-slate-300"
                />
                <span className="font-bold text-slate-500 shrink-0 w-8">{adjustmentModal.unit}</span>
              </div>
              {actualQty !== "" && (
                <div className={`text-xs font-bold p-2.5 rounded-lg flex justify-between ${Number(actualQty) - adjustmentModal.currentQty === 0 ? 'bg-slate-100 text-slate-600' : Number(actualQty) - adjustmentModal.currentQty > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <span>在庫差異:</span>
                  <span className="font-mono">
                    {Number(actualQty) - adjustmentModal.currentQty > 0 ? "+" : ""}
                    {formatQty(Number(actualQty) - adjustmentModal.currentQty, adjustmentModal.itemType || 'product')} {adjustmentModal.unit}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500">調整理由</label>
              <select
                value={adjReason}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setAdjReason(e.currentTarget.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-bold text-slate-700 text-sm h-11"
              >
                <option value="定例棚卸">定例棚卸</option>
                <option value="ロス・廃棄">ロス・廃棄による減算</option>
                <option value="入力もれ補正">入力もれ補正</option>
                <option value="その他">その他</option>
              </select>
            </div>
          </div>
          <DialogFooter className="mt-2 border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={() => setAdjustmentModal({ ...adjustmentModal, isOpen: false })} className="font-bold h-10">キャンセル</Button>
            <Button onClick={handleAdjustmentSubmit} disabled={isProcessing || actualQty === ""} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10">
              {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : "確定する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新規 Lot 登録ダイアログ */}
      <Dialog open={newStockModalOpen} onOpenChange={setNewStockModalOpen}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader><DialogTitle className="font-black text-slate-800">既存製品 Lot の追加登録</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">製品選択</label>
              <select
                value={newStockData.productId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewStockData({ ...newStockData, productId: e.currentTarget.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-bold text-slate-700 text-sm h-11"
              >
                <option value="">製品を選択してください</option>
                {productsList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.variant})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Lot 番号</label>
              <Input type="text" placeholder="例: 2026A" value={newStockData.lotCode} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewStockData({ ...newStockData, lotCode: e.currentTarget.value })} className="font-bold h-10" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">賞味・有効期限</label>
              <Input type="date" value={newStockData.expiryDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewStockData({ ...newStockData, expiryDate: e.currentTarget.value })} className="font-bold font-mono h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3 bg-blue-50/30 p-3 rounded-lg border border-blue-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-blue-700">追加ケース数 (cs)</label>
                <Input type="number" min="0" step="1" value={newStockData.cs || ""} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewStockData({ ...newStockData, cs: e.currentTarget.value === "" ? 0 : Math.round(Number(e.currentTarget.value)) })} className="text-right font-mono font-bold bg-white h-10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-blue-700">追加バラ数 (p)</label>
                <Input type="number" min="0" step="1" value={newStockData.p || ""} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewStockData({ ...newStockData, p: e.currentTarget.value === "" ? 0 : Math.round(Number(e.currentTarget.value)) })} className="text-right font-mono font-bold bg-white h-10" />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={() => setNewStockModalOpen(false)} className="font-bold h-10">閉じる</Button>
            <Button onClick={handleAddNewStock} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10">登録保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 製品在庫 CSV 一括登録ダイアログ */}
      <Dialog open={csvModalOpen} onOpenChange={(open) => {
        if (!open) {
          setCsvModalOpen(false);
          setCsvParsedRows([]);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black text-slate-800 flex items-center justify-between text-lg border-b pb-3 pr-6">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                製品在庫 CSV一括登録
              </span>
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="text-xs font-bold text-slate-600 border-slate-300">
                <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" /> CSVテンプレート（雛形）をダウンロード
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1 text-sm">
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center bg-slate-50/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleCsvFileUpload}
                className="hidden"
              />
              <UploadCloud className="w-10 h-10 mx-auto text-emerald-600 mb-2 animate-bounce" />
              <div className="font-bold text-slate-700 text-base">
                {csvLoading ? "ファイルを読み込み中..." : "ここをクリックしてCSVファイルを選択"}
              </div>
              <p className="text-xs text-slate-400 mt-1">Excel等から書き出したCSV（Shift_JIS / UTF-8）に対応しています</p>
            </div>

            {csvParsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-100 p-3 rounded-lg border border-slate-200 gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600 text-white font-bold">総行数: {csvParsedRows.length} 件</Badge>
                    <Badge className="bg-emerald-600 text-white font-bold">登録可能: {csvParsedRows.filter(r => !r.error).length} 件</Badge>
                    {csvParsedRows.some(r => r.error) && (
                      <Badge className="bg-red-600 text-white font-bold">エラー: {csvParsedRows.filter(r => r.error).length} 件</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span>同一Lotが存在する場合:</span>
                    <select
                      value={duplicateMode}
                      onChange={(e) => setDuplicateMode(e.target.value as 'add' | 'overwrite')}
                      className="border border-slate-300 rounded p-1 bg-white font-bold text-slate-800"
                    >
                      <option value="add">既存在庫に加算する</option>
                      <option value="overwrite">既存在庫を上書きする</option>
                    </select>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table className="text-xs w-full">
                    <TableHeader className="bg-slate-100 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-12 text-center">行</TableHead>
                        <TableHead className="w-24 text-center">判定</TableHead>
                        <TableHead className="w-28 font-bold">Lot番号</TableHead>
                        <TableHead className="font-bold">対象製品</TableHead>
                        <TableHead className="w-24 text-center font-bold">賞味期限</TableHead>
                        <TableHead className="w-24 text-right font-bold">ケース/バラ</TableHead>
                        <TableHead className="w-24 text-right font-bold">換算総数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvParsedRows.map((r, idx) => (
                        <TableRow key={idx} className={r.error ? "bg-red-50/70" : "hover:bg-slate-50"}>
                          <TableCell className="text-center font-mono text-slate-400">{r.lineNo}</TableCell>
                          <TableCell className="text-center">
                            {r.error ? (
                              <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0.5">{r.error}</Badge>
                            ) : (
                              <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5">正常</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono font-bold">{r.rawLot}</TableCell>
                          <TableCell className="font-bold text-slate-800">
                            {r.matchedProductName ? (
                              r.matchedProductName
                            ) : (
                              <span className="text-red-500">{r.rawProduct || '未指定'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono">{r.rawExpiry}</TableCell>
                          <TableCell className="text-right font-mono">
                            {r.rawCs}cs / {r.rawP}p
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-blue-700">
                            {r.totalPieces.toLocaleString()} P
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2 border-t border-slate-100 pt-3 flex justify-between items-center">
            <Button variant="outline" onClick={() => {
              setCsvModalOpen(false);
              setCsvParsedRows([]);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }} className="font-bold h-10">
              キャンセル
            </Button>
            <Button
              onClick={handleCsvSubmit}
              disabled={isProcessing || csvParsedRows.filter(r => !r.error).length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 shadow-md"
            >
              {isProcessing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {csvParsedRows.filter(r => !r.error).length} 件を一括登録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}