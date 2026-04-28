"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Beaker, Loader2, Save, Lock, Edit, Printer, ArrowLeft, Trash2, Plus, AlertTriangle, QrCode, UploadCloud, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import HaccpPrintHeader from "@/components/HaccpPrintHeader";
import { generateLotNumber } from "@/lib/lot-generator";

type KeepSample = { id: string; lot_code: string; product_id: string; management_no: string; saved_quantity: number; production_date: string; expiry_date: string; used_quantity: number; usage_purpose: string; used_date: string; products?: { name: string; variant_name: string }; };
type Product = { id: string; name: string; variant_name: string; };

// CSVパース用
type ParsedSample = {
  product_id: string;
  lot_code: string;
  calculated_lot_code: string;
  production_date: string;
  expiry_date: string;
  saved_quantity: number | "";
  used_quantity: number | "";
  usage_purpose: string;
  used_date: string;
  _error?: string;
};

export default function KeepSamplesPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'print' | 'print_label'>('list');
  const [samples, setSamples] = useState<KeepSample[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingSample, setEditingSample] = useState<KeepSample | null>(null);

  // 編集用State
  const [editSavedQty, setEditSavedQty] = useState<number | "">("");
  const [editUsedQty, setEditUsedQty] = useState<number | "">("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editUsedDate, setEditUsedDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 新規登録(単発)用State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newLotCode, setNewLotCode] = useState("");
  const [newSavedQty, setNewSavedQty] = useState<number | "">(10);
  const [newProductionDate, setNewProductionDate] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");

  // 複数選択用のState
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set());

  // CSV一括登録用のState
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedList, setParsedList] = useState<ParsedSample[]>([]);

  // 印刷時の月指定用State
  const [printMonth, setPrintMonth] = useState(new Date());

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    const { data: sData } = await supabase.from("keep_samples").select("*, products(name, variant_name)").order("production_date", { ascending: false });
    if (sData) setSamples(sData as KeepSample[]);

    const { data: pData } = await supabase.from("products").select("id, name, variant_name").order("name", { ascending: true });
    if (pData) setProducts(pData as Product[]);

    setLoading(false);
  }, []);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  const openEditModal = (sample: KeepSample) => {
    setEditingSample(sample);
    setEditSavedQty(sample.saved_quantity);
    setEditUsedQty(sample.used_quantity === 0 ? "" : sample.used_quantity);
    setEditPurpose(sample.usage_purpose || "官能検査・菌検査");
    setEditUsedDate(sample.used_date || new Date().toISOString().split('T')[0]);
  };

  const handleSaveUsage = async () => {
    if (!editingSample) return;
    const sQty = Number(editSavedQty) || 0;
    const uQty = Number(editUsedQty) || 0;

    if (sQty <= 0) { alert("保存数は1以上にしてください。"); return; }
    if (uQty > sQty) { alert("エラー: 使用数が保存数を超えています！"); return; }

    setIsProcessing(true);
    const updates = {
      saved_quantity: sQty,
      used_quantity: uQty,
      usage_purpose: uQty > 0 ? editPurpose : null,
      used_date: uQty > 0 ? editUsedDate : null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("keep_samples").update(updates).eq("id", editingSample.id);
    if (!error) {
      setEditingSample(null); fetchSamples(); alert("記録を更新しました！");
    } else {
      alert("エラー: " + error.message);
    }
    setIsProcessing(false);
  };

  const handleDeleteSample = async () => {
    if (!editingSample) return;
    if (!confirm(`管理番号: ${editingSample.management_no} のキープサンプル記録を完全に削除しますか？\n（※製品在庫は戻りません。記録のみ削除されます）`)) return;

    setIsProcessing(true);
    const { error } = await supabase.from("keep_samples").delete().eq("id", editingSample.id);
    if (!error) {
      setEditingSample(null); fetchSamples();
    } else {
      alert("削除エラー: " + error.message);
    }
    setIsProcessing(false);
  };

  const handleSaveNewSample = async () => {
    if (!newProductId || !newLotCode || !newSavedQty || !newProductionDate || !newExpiryDate) {
      alert("すべての必須項目を入力してください。");
      return;
    }

    setIsProcessing(true);
    try {
      const { data: existing } = await supabase.from("keep_samples").select("id").eq("lot_code", newLotCode).maybeSingle();
      if (existing) {
        if (!confirm(`エラーの警告: 既にこのLot番号（${newLotCode}）のキープサンプルが存在します。\n強制的に追加登録してよろしいですか？`)) {
          setIsProcessing(false); return;
        }
      }

      const randomManageNo = `KS-${newLotCode}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const newSampleData = {
        lot_code: newLotCode,
        product_id: newProductId,
        management_no: randomManageNo,
        saved_quantity: Number(newSavedQty),
        used_quantity: 0,
        production_date: newProductionDate,
        expiry_date: newExpiryDate
      };

      const { error } = await supabase.from("keep_samples").insert(newSampleData);

      if (error) throw error;

      alert(`管理番号: ${randomManageNo} で新規サンプルを手動登録（補填）しました！`);
      setIsAddModalOpen(false);

      setNewProductId(""); setNewLotCode(""); setNewSavedQty(10); setNewProductionDate(""); setNewExpiryDate("");
      fetchSamples();

    } catch (err: any) {
      alert("登録エラー: " + err.message);
    }
    setIsProcessing(false);
  };

  const toggleSelectSample = (id: string) => {
    const newSet = new Set(selectedSampleIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSampleIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedSampleIds.size === samples.length) {
      setSelectedSampleIds(new Set());
    } else {
      setSelectedSampleIds(new Set(samples.map(s => s.id)));
    }
  };

  // =======================================================================
  // CSV 一括登録ロジック
  // =======================================================================
  const readFileAsSJIS = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, "Shift_JIS");
    });
  };

  const normalizeDate = (dStr: string) => {
    if (!dStr) return "";
    return dStr.replace(/\//g, '-');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    const newList: ParsedSample[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await readFileAsSJIS(file);
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) continue;

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

        const idxId = headers.findIndex(h => h.includes("製品ID") || h.includes("product_id"));
        const idxLot = headers.findIndex(h => h.includes("Lot") || h.includes("lot_code"));
        const idxPDate = headers.findIndex(h => h.includes("製造日") || h.includes("production_date"));
        const idxEDate = headers.findIndex(h => h.includes("賞味期限") || h.includes("expiry_date"));
        const idxSQty = headers.findIndex(h => h.includes("保存数") || h.includes("saved_quantity"));
        const idxUQty = headers.findIndex(h => h.includes("使用数") || h.includes("used_quantity"));
        const idxPurp = headers.findIndex(h => h.includes("使用用途") || h.includes("usage_purpose"));
        const idxUDate = headers.findIndex(h => h.includes("使用日") || h.includes("used_date"));

        for (let j = 1; j < lines.length; j++) {
          const row = lines[j].split(',').map(v => v.replace(/"/g, '').trim());
          if (row.length < headers.length) continue;

          const productId = idxId >= 0 ? row[idxId] : "";
          const rawLotCode = idxLot >= 0 ? row[idxLot] : "";
          const pDate = idxPDate >= 0 ? normalizeDate(row[idxPDate]) : "";
          const eDate = idxEDate >= 0 ? normalizeDate(row[idxEDate]) : "";
          const sQty = idxSQty >= 0 ? Number(row[idxSQty]) : 10;
          const uQty = idxUQty >= 0 && row[idxUQty] !== "" ? Number(row[idxUQty]) : 0;
          const purp = idxPurp >= 0 ? row[idxPurp] : "";
          const uDate = idxUDate >= 0 ? normalizeDate(row[idxUDate]) : "";

          let calculatedLot = "";
          if (productId && pDate) {
            calculatedLot = generateLotNumber(pDate, productId, 1);
          }

          let error = "";
          if (!productId || !pDate || !eDate || isNaN(sQty)) {
            error = "必須項目(製品ID, 製造日, 賞味期限, 保存数)が不足";
          }

          newList.push({
            product_id: productId,
            lot_code: rawLotCode,
            calculated_lot_code: calculatedLot,
            production_date: pDate,
            expiry_date: eDate,
            saved_quantity: sQty,
            used_quantity: uQty,
            usage_purpose: purp,
            used_date: uDate,
            _error: error
          });
        }
      } catch (err) {
        console.error(err);
        alert(`${file.name} の解析に失敗しました。`);
      }
    }

    setParsedList(prev => [...prev, ...newList]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(false);
  };

  const handleUpdateParsed = (idx: number, field: keyof ParsedSample, value: any) => {
    const updated = [...parsedList];
    updated[idx] = { ...updated[idx], [field]: value, _error: "" };

    if (field === 'product_id' || field === 'production_date') {
      const pId = field === 'product_id' ? value : updated[idx].product_id;
      const pDate = field === 'production_date' ? value : updated[idx].production_date;
      if (pId && pDate) {
        updated[idx].calculated_lot_code = generateLotNumber(pDate, pId, 1);
      } else {
        updated[idx].calculated_lot_code = "";
      }
    }

    setParsedList(updated);
  };

  const handleSaveBulkImport = async () => {
    const invalidItems = parsedList.filter(item => !item.product_id || !item.calculated_lot_code || !item.production_date || !item.expiry_date || item.saved_quantity === "");
    if (invalidItems.length > 0) {
      alert("必須項目が入力されていない、または自動計算できない行があります。");
      return;
    }

    setIsProcessing(true);
    try {
      const inserts = parsedList.map(item => {
        const randomManageNo = `KS-${item.calculated_lot_code}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        return {
          product_id: item.product_id,
          lot_code: item.calculated_lot_code,
          management_no: randomManageNo,
          production_date: item.production_date,
          expiry_date: item.expiry_date,
          saved_quantity: Number(item.saved_quantity) || 0,
          used_quantity: Number(item.used_quantity) || 0,
          usage_purpose: item.usage_purpose || null,
          used_date: item.used_date || null
        };
      });

      const { error } = await supabase.from('keep_samples').insert(inserts);
      if (error) throw error;

      alert(`${inserts.length} 件の過去データを一括登録しました！`);
      setParsedList([]);
      fetchSamples();

    } catch (err: any) {
      alert("一括保存エラー: " + err.message);
    }
    setIsProcessing(false);
  };

  // ★無限ループを防ぐため、レンダリング時に計算結果をメモ化
  const chunkedSamples = useMemo(() => {
    if (viewMode !== 'print') return [];
    const chunks = [];
    for (let i = 0; i < samples.length; i += 4) {
      chunks.push(samples.slice(i, i + 4));
    }
    return chunks;
  }, [samples, viewMode]);

  // =======================================================================
  // ラベル印刷画面
  // =======================================================================
  if (viewMode === 'print_label') {
    // 選択されたサンプルのデータを取得
    const selectedSamplesData = samples.filter(s => selectedSampleIds.has(s.id));

    if (selectedSamplesData.length === 0) {
      return (
        <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center justify-center">
          <p className="font-bold text-slate-500 mb-4">印刷するサンプルが選択されていません。</p>
          <Button onClick={() => setViewMode('list')}>戻る</Button>
        </div>
      );
    }

    const lotCodes = selectedSamplesData.map(s => s.lot_code).join(',');
    const qrData = encodeURIComponent(lotCodes);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

    const dates = selectedSamplesData.map(s => new Date(s.production_date).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const dateRangeStr = minDate.getTime() === maxDate.getTime()
      ? minDate.toLocaleDateString('ja-JP')
      : `${minDate.toLocaleDateString('ja-JP')} 〜 ${maxDate.toLocaleDateString('ja-JP')}`;

    const expiryDates = selectedSamplesData.map(s => new Date(s.expiry_date).getTime());
    const minExpiryDate = new Date(Math.min(...expiryDates));

    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{
          __html: `
                @media print { 
                    header, nav { display: none !important; } 
                    main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; } 
                    @page { size: A4 portrait; margin: 15mm; } 
                    body { background-color: white !important; color: black !important; } 
                    .print-hide { display: none !important; } 
                }
            ` }} />
        <div className="w-[210mm] print:w-full flex justify-between mb-4 print-hide">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300"><ArrowLeft className="h-4 w-4 mr-2" /> 戻る</Button>
          <div className="flex gap-2">
            <span className="text-sm font-bold bg-white px-3 py-2 rounded border border-slate-300 text-slate-600">※A4用紙に印刷し、点線で切り取って段ボールに貼り付けてください。</span>
            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"><Printer className="h-5 w-5 mr-2" /> 印刷する</Button>
          </div>
        </div>

        <div className="w-[210mm] min-h-[297mm] bg-white p-8 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col items-center pt-12">
          <div className="border-[3px] border-dashed border-slate-400 w-[160mm] p-6 rounded-2xl relative">
            <div className="absolute -top-3 left-4 bg-white px-2 text-sm font-bold text-slate-400 flex items-center gap-1"><Beaker className="w-4 h-4" /> 段ボール保管用ラベル</div>

            <div className="text-center border-b-2 border-black pb-4 mb-4 flex justify-between items-end">
              <div className="text-left">
                <h1 className="text-3xl font-black tracking-widest text-slate-800">キープサンプル保管箱</h1>
                <p className="text-sm font-bold text-slate-500 mt-1">品質検査・トレーサビリティ用</p>
              </div>
              <div className="shrink-0 flex flex-col items-center justify-center p-1.5 border-2 border-slate-300 rounded-lg bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR Code" className="w-20 h-20 mix-blend-multiply" />
                <div className="text-[8px] font-bold text-slate-500 mt-1 text-center leading-tight">スキャンして検索</div>
              </div>
            </div>

            <div className="flex justify-between items-end mb-2">
              <div className="font-bold text-slate-700">保管されている製品 ({selectedSamplesData.length} ロット)</div>
              <div className="text-sm font-bold text-slate-600">製造期間: <span className="text-black font-black">{dateRangeStr}</span></div>
            </div>

            <div className="border-2 border-slate-400 rounded-lg overflow-hidden mb-4 max-h-[120mm] overflow-y-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="py-1.5 px-3 text-left border-b border-slate-300 w-[45%]">製品名 (味)</th>
                    <th className="py-1.5 px-3 text-left border-b border-slate-300 w-[30%]">Lot番号</th>
                    <th className="py-1.5 px-3 text-center border-b border-slate-300 w-[10%]">個数</th>
                    <th className="py-1.5 px-3 text-center border-b border-slate-300 w-[15%]">製造日</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSamplesData.map(s => (
                    <tr key={s.id} className="border-b border-slate-200 last:border-b-0">
                      <td className="py-1.5 px-3 font-bold text-slate-800 truncate max-w-[200px]">{s.products?.name} <span className="text-xs text-slate-500">({s.products?.variant_name})</span></td>
                      <td className="py-1.5 px-3 font-mono font-black text-blue-800">{s.lot_code}</td>
                      <td className="py-1.5 px-3 text-center font-bold">{s.saved_quantity}</td>
                      <td className="py-1.5 px-3 text-center text-xs text-slate-600">{new Date(s.production_date).toLocaleDateString('ja-JP')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t-2 border-slate-200 pt-4">
              <div className="text-right bg-red-50 px-4 py-2 border border-red-200 rounded-lg">
                <div className="text-xs font-bold text-red-600 mb-0.5">※この箱の最短保管期限 (賞味期限)</div>
                <div className="text-xl font-black text-red-700">{minExpiryDate.toLocaleDateString('ja-JP')} まで保管</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // =======================================================================
  // 管理記録 印刷画面 (A4横・1ページ4データ表示)
  // =======================================================================
  if (viewMode === 'print') {
    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{ __html: `@media print { header, nav { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; } @page { size: A4 landscape; margin: 10mm; } body { background-color: white !important; color: black !important; } .print-hide { display: none !important; } .page-break { page-break-after: always; } }` }} />
        <div className="w-[297mm] print:w-full flex justify-between mb-4 print-hide">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300"><ArrowLeft className="h-4 w-4 mr-2" /> 戻る</Button>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm">
            <span className="text-sm font-bold text-slate-600">表示月:</span>
            <Input
              type="month"
              value={`${printMonth.getFullYear()}-${String(printMonth.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => { if (e.target.value) setPrintMonth(new Date(e.target.value + "-01")); }}
              className="w-36 h-8 font-bold border-none shadow-none focus-visible:ring-0 px-0"
            />
          </div>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"><Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)</Button>
        </div>

        {chunkedSamples.length === 0 ? (
          <div className="w-[297mm] bg-white p-8 text-center text-slate-500 font-bold shadow-xl">データがありません</div>
        ) : (
          chunkedSamples.map((chunk, pageIdx) => (
            <div key={pageIdx} className={`w-[297mm] h-[210mm] bg-white pt-8 pb-4 px-12 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between ${pageIdx < chunkedSamples.length - 1 ? 'page-break mb-8 print:mb-0' : ''}`}>

              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <HaccpPrintHeader
                    title="キープサンプル管理記録"
                    docNo="YO-28"
                    establishedDate="2021/4/1"
                    revisedDate=""
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-4 mt-2">
                {chunk.map(sample => {
                  const dP = new Date(sample.production_date); const pStr = `${dP.getFullYear()}.${String(dP.getMonth() + 1).padStart(2, '0')}.${String(dP.getDate()).padStart(2, '0')}`;
                  const dE = new Date(sample.expiry_date); const eStr = `${dE.getFullYear()}.${String(dE.getMonth() + 1).padStart(2, '0')}.${String(dE.getDate()).padStart(2, '0')}`;

                  return (
                    <div key={sample.id} className="flex border-2 border-black h-[35mm] text-[13px] w-full box-border">
                      <div className="w-[60mm] flex flex-col border-r-2 border-black shrink-0">
                        <div className="flex-1 flex border-b border-black"><div className="w-[20mm] bg-gray-50 p-1 font-medium border-r border-black flex items-center justify-center text-xs">ロット</div><div className="flex-1 p-1 flex items-center justify-center font-bold text-base tracking-widest">{sample.lot_code}</div></div>
                        <div className="flex-1 flex border-b border-black"><div className="w-[20mm] bg-gray-50 p-1 font-medium border-r border-black flex flex-col items-center justify-center leading-tight text-xs"><span>賞味</span><span>期限</span></div><div className="flex-1 p-1 flex items-center justify-center font-bold tracking-widest">{eStr}</div></div>
                        <div className="flex-1 flex"><div className="w-[20mm] bg-gray-50 p-1 font-medium border-r border-black flex flex-col items-center justify-center leading-tight text-xs"><span>管理</span><span>番号</span></div><div className="flex-1 p-1 flex items-center justify-center font-bold text-sm text-slate-700">{sample.management_no}</div></div>
                      </div>
                      <div className="w-[70mm] flex flex-col border-r-2 border-black shrink-0">
                        <div className="flex-1 flex border-b border-black"><div className="w-[20mm] bg-gray-50 p-1 font-medium border-r border-black flex flex-col items-center justify-center leading-tight text-xs"><span>製造</span><span>種類</span></div><div className="flex-1 p-1 flex flex-col items-center justify-center text-center text-xs font-bold leading-tight"><div>{sample.products?.name}</div><div className="text-[10px] text-slate-600">({sample.products?.variant_name})</div></div></div>
                        <div className="flex-1 flex border-b border-black"><div className="w-[20mm] bg-gray-50 p-1 font-medium border-r border-black flex flex-col items-center justify-center leading-tight text-xs"><span>製造</span><span>年月日</span></div><div className="flex-1 p-1 flex items-center justify-center font-bold tracking-widest">{pStr}</div></div>
                        <div className="flex-1 flex"><div className="w-[20mm] bg-gray-50 p-1 font-medium border-r border-black flex items-center justify-center text-xs">保存数</div><div className="flex-1 p-1 pr-4 flex items-center justify-end font-bold text-lg">{sample.saved_quantity} <span className="text-[10px] font-normal ml-1">個</span></div></div>
                      </div>
                      <div className="w-[12mm] bg-gray-50 border-r border-black flex items-center justify-center font-medium text-[10px] shrink-0" style={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.2em' }}>使用用途名</div>

                      <div className="flex-1 flex flex-col border-r-2 border-black">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const isUsed = i === 0 && sample.used_quantity > 0;
                          const uDate = isUsed ? new Date(sample.used_date).toLocaleDateString('ja-JP') : "";
                          const uQty = isUsed ? sample.used_quantity : "";
                          const rQty = isUsed ? (sample.saved_quantity - sample.used_quantity) : "";

                          return (
                            <div key={i} className="flex-1 flex border-b border-black last:border-b-0 h-1/4">
                              <div className="w-[24mm] border-r border-black flex flex-col items-center justify-center bg-gray-50 print:bg-transparent leading-tight shrink-0"><span className="text-[9px]">使用</span><span className="text-[9px]">年月日</span></div>
                              <div className="w-[38mm] border-r border-black flex items-center justify-center text-xs tracking-wider shrink-0 font-mono">{uDate || "　　 .　　 ."}</div>
                              <div className="w-[16mm] border-r border-black flex items-center justify-center bg-gray-50 print:bg-transparent text-[10px] shrink-0">使用数</div>
                              <div className="w-[24mm] border-r border-black flex items-center justify-end pr-2 text-sm font-bold shrink-0">{uQty} <span className="text-[9px] font-normal ml-1 mt-1">個</span></div>
                              <div className="w-[16mm] border-r border-black flex items-center justify-center bg-gray-50 print:bg-transparent text-[10px] shrink-0">現在数</div>
                              <div className="flex-1 flex items-center justify-end pr-3 text-sm font-bold">{rQty} <span className="text-[9px] font-normal ml-1 mt-1">個</span></div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="w-[12mm] flex flex-col shrink-0">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex-1 border-b border-black last:border-b-0 flex items-center justify-center text-[9px] font-medium text-slate-300 print:text-black/30">印</div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* 空行補完 */}
                {Array.from({ length: 4 - chunk.length }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="flex border-2 border-black h-[35mm] text-sm opacity-20 w-full box-border">
                    <div className="w-[70mm] border-r-2 border-black"></div>
                    <div className="w-[70mm] border-r-2 border-black"></div>
                    <div className="w-[12mm] border-r border-black"></div>
                    <div className="flex-1 border-r-2 border-black flex flex-col">
                      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex-1 border-b border-black last:border-b-0"></div>)}
                    </div>
                    <div className="w-[12mm] flex flex-col">
                      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex-1 border-b border-black last:border-b-0"></div>)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-between items-end">
                <div className="text-[10px] text-slate-500 italic">
                  ※ この記録はシステムによって生成されたものです。
                </div>
                {chunkedSamples.length > 1 && (
                  <div className="text-xs font-bold text-slate-500 shrink-0 ml-4">
                    {pageIdx + 1} / {chunkedSamples.length} ページ
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // =======================================================================
  // 通常のリスト画面
  // =======================================================================
  return (
    <div className="bg-transparent">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Beaker className="h-6 w-6 text-blue-600" /> キープサンプル管理</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {selectedSampleIds.size > 0 && (
            <Button onClick={() => setViewMode('print_label')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-10">
              <QrCode className="h-4 w-4 mr-2" /> 選択した {selectedSampleIds.size} 件のラベルを作成
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm h-10 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> 新規登録(補填)
            </Button>
          )}
          <Button onClick={() => setViewMode('print')} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold shadow-sm h-10 w-full sm:w-auto">
            <Printer className="h-4 w-4 mr-2" /> 管理記録(PDF)作成
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-6 bg-slate-200/80 p-1.5 rounded-xl flex w-max">
          <TabsTrigger value="list" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">記録一覧 ＆ 手動登録</TabsTrigger>
          {canEdit && <TabsTrigger value="import" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">過去データ一括登録 (CSV)</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="mt-0">
          {canEdit && (
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm h-10">
                <Plus className="h-4 w-4 mr-2" /> 手動で1件追加する
              </Button>
            </div>
          )}
          <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-center border-r">
                    <input
                      type="checkbox"
                      checked={samples.length > 0 && selectedSampleIds.size === samples.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                  </TableHead>
                  <TableHead className="w-12 text-center">No.</TableHead>
                  <TableHead className="w-36 pl-2">管理番号<br /><span className="text-[10px] text-slate-400">Lot番号</span></TableHead>
                  <TableHead className="w-48">製品名 / 種類</TableHead>
                  <TableHead className="w-24 text-center">製造日<br /><span className="text-[10px] text-slate-400">賞味期限</span></TableHead>
                  <TableHead className="w-20 text-right">保存数</TableHead>
                  <TableHead className="w-20 text-right text-red-600">使用数</TableHead>
                  <TableHead className="w-20 text-right font-bold text-blue-700">残数</TableHead>
                  <TableHead className="w-40">使用用途<br /><span className="text-[10px] text-slate-400">使用日</span></TableHead>
                  <TableHead className="w-24 text-center">状態</TableHead>
                  <TableHead className="w-20 text-center pr-4">アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {samples.map((sample, index) => {
                  const remainQty = sample.saved_quantity - sample.used_quantity;
                  const isUsedUp = remainQty === 0;
                  const isPartiallyUsed = sample.used_quantity > 0 && remainQty > 0;
                  const isSelected = selectedSampleIds.has(sample.id);

                  return (
                    <TableRow key={sample.id} className={`${isUsedUp ? "bg-slate-50/50 opacity-70" : "hover:bg-slate-50"} ${isSelected ? "bg-blue-50/30" : ""}`}>
                      <TableCell className="text-center border-r">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectSample(sample.id)}
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center text-slate-400 text-xs">{samples.length - index}</TableCell>
                      <TableCell className="pl-2">
                        <div className="font-black text-blue-800 text-sm tracking-wide">{sample.management_no}</div>
                        <div className="text-xs font-bold text-slate-500">{sample.lot_code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-800">{sample.products?.name}</div>
                        <div className="text-xs text-slate-500">{sample.products?.variant_name}</div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <div className="font-bold text-slate-700">{new Date(sample.production_date).toLocaleDateString()}</div>
                        <div className="text-slate-500 mt-0.5">{new Date(sample.expiry_date).toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-600">{sample.saved_quantity} <span className="text-[10px] font-normal">個</span></TableCell>
                      <TableCell className="text-right font-bold text-red-600">{sample.used_quantity} <span className="text-[10px] font-normal">個</span></TableCell>
                      <TableCell className={`text-right font-black text-lg ${isUsedUp ? 'text-slate-400' : 'text-blue-700'}`}>{remainQty} <span className="text-[10px] font-normal">個</span></TableCell>
                      <TableCell className="text-xs">
                        {sample.used_quantity > 0 ? (
                          <>
                            <div className="font-bold text-slate-700 truncate max-w-[150px]" title={sample.usage_purpose}>{sample.usage_purpose}</div>
                            <div className="text-slate-500">{new Date(sample.used_date).toLocaleDateString()}</div>
                          </>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isUsedUp ? <Badge className="bg-slate-200 text-slate-600 border-none shadow-none">使用済(残0)</Badge> :
                          isPartiallyUsed ? <Badge className="bg-amber-100 text-amber-800 border-none shadow-sm">一部使用</Badge> :
                            <Badge className="bg-green-100 text-green-800 border-none shadow-sm">保管中</Badge>}
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        <div className="flex justify-center gap-1">
                          {canEdit ? (
                            <Button variant="outline" size="sm" onClick={() => openEditModal(sample)} className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 px-2">
                              <Edit className="h-3 w-3 mr-1" /> 記録
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 mt-1"><Lock className="w-3 h-3 inline" /></span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && samples.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-16 text-slate-500 font-bold bg-slate-50/50">キープサンプルのデータがありません。</TableCell></TableRow>}
                {loading && <TableRow><TableCell colSpan={11} className="text-center py-16"><Loader2 className="h-8 w-8 text-slate-400 animate-spin mx-auto" /></TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="import" className="mt-0">
          <Card className="shadow-sm border-slate-200 mb-6">
            <CardHeader className="bg-blue-50/50 border-b pb-4"><CardTitle className="text-base text-blue-900 flex items-center gap-2"><UploadCloud className="h-5 w-5" /> 過去データの一括読み込み (CSV)</CardTitle></CardHeader>
            <CardContent className="pt-6">
              <div className="mb-4">
                <div className="text-sm font-bold text-slate-700 mb-2">CSVファイルの作成ルール</div>
                <div className="bg-slate-50 p-3 rounded border text-xs text-slate-600 font-mono">
                  1行目（ヘッダー）に以下の列名を設定してください。<br />
                  <span className="font-bold text-blue-700">製品ID, Lot番号, 製造日, 賞味期限, 保存数, 使用数, 使用用途, 使用日</span><br /><br />
                  ※管理番号(KS-...)は保存時にシステムが自動で発行・割り当てします。
                </div>
              </div>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${loading ? 'border-slate-300 bg-slate-50' : 'border-blue-300 bg-blue-50/50 hover:bg-blue-100/50'}`}
                onClick={() => !loading && fileInputRef.current?.click()}
              >
                <input type="file" accept=".csv" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                {loading ? <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-400 mb-3" /> : <FileSpreadsheet className="w-12 h-12 mx-auto text-blue-500 mb-3" />}
                <div className="font-bold text-slate-700 text-lg">{loading ? '読み込み中...' : 'ここをクリックしてCSVファイルを選択'}</div>
              </div>
            </CardContent>
          </Card>

          {parsedList.length > 0 && (
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base text-slate-800 flex items-center gap-2">読み込みプレビュー ({parsedList.length}件)</CardTitle>
                <Button onClick={handleSaveBulkImport} disabled={isProcessing || parsedList.some(p => p._error)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 shadow-sm">{isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} すべてDBに保存</Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[1000px] text-sm">
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead>製品ID</TableHead>
                      <TableHead>Lot番号(自動)</TableHead>
                      <TableHead>製造日 / 賞味期限</TableHead>
                      <TableHead className="w-20">保存数</TableHead>
                      <TableHead className="w-20">使用数</TableHead>
                      <TableHead>使用用途 / 日付</TableHead>
                      <TableHead className="w-20 text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedList.map((item, idx) => (
                      <TableRow key={idx} className={item._error ? "bg-red-50" : ""}>
                        <TableCell className="p-2"><Input value={item.product_id} onChange={e => handleUpdateParsed(idx, 'product_id', e.target.value)} className="h-8 text-xs bg-white font-bold" /></TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.calculated_lot_code}
                            onChange={e => handleUpdateParsed(idx, 'calculated_lot_code', e.target.value)}
                            className="h-8 text-xs bg-white font-bold text-blue-700 tracking-wider"
                          />
                        </TableCell>
                        <TableCell className="p-2 space-y-1">
                          <div className="flex items-center gap-1"><span className="text-[10px] text-slate-500 w-6">製造</span><Input type="date" value={item.production_date} onChange={e => handleUpdateParsed(idx, 'production_date', e.target.value)} className="h-8 text-xs bg-white" /></div>
                          <div className="flex items-center gap-1"><span className="text-[10px] text-slate-500 w-6">期限</span><Input type="date" value={item.expiry_date} onChange={e => handleUpdateParsed(idx, 'expiry_date', e.target.value)} className="h-8 text-xs bg-white" /></div>
                          {item._error && <div className="text-[10px] text-red-600 font-bold">{item._error}</div>}
                        </TableCell>
                        <TableCell className="p-2"><Input type="number" min="0" value={item.saved_quantity} onChange={e => handleUpdateParsed(idx, 'saved_quantity', e.target.value)} className="h-8 text-xs bg-white text-right" /></TableCell>
                        <TableCell className="p-2"><Input type="number" min="0" value={item.used_quantity} onChange={e => handleUpdateParsed(idx, 'used_quantity', e.target.value)} className="h-8 text-xs bg-white text-right text-red-600" /></TableCell>
                        <TableCell className="p-2 space-y-1">
                          <Input value={item.usage_purpose} onChange={e => handleUpdateParsed(idx, 'usage_purpose', e.target.value)} placeholder="用途" className="h-8 text-xs bg-white" />
                          <Input type="date" value={item.used_date} onChange={e => handleUpdateParsed(idx, 'used_date', e.target.value)} className="h-8 text-xs bg-white text-slate-500" />
                        </TableCell>
                        <TableCell className="text-center p-2"><Button variant="ghost" size="icon" onClick={() => setParsedList(parsedList.filter((_, i) => i !== idx))} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 手動登録ダイアログ（単発） */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Plus className="h-5 w-5 text-blue-600" />
              キープサンプルの手動登録 (補填)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex gap-2 items-start text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>自動登録に失敗したデータや、システム導入前の過去のサンプルを補填・登録するための機能です。</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">対象製品 <span className="text-red-500">*</span></label>
              <select value={newProductId} onChange={e => setNewProductId(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm bg-white focus:ring-blue-500">
                <option value="">製品を選択してください</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.variant_name})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">製造Lot番号 <span className="text-red-500">*</span></label>
              <Input value={newLotCode} onChange={e => setNewLotCode(e.target.value)} placeholder="例: 13B26YC50" className="bg-white border-slate-300" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">製造年月日 <span className="text-red-500">*</span></label>
                <Input type="date" value={newProductionDate} onChange={e => setNewProductionDate(e.target.value)} className="bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">賞味期限 <span className="text-red-500">*</span></label>
                <Input type="date" value={newExpiryDate} onChange={e => setNewExpiryDate(e.target.value)} className="bg-white border-blue-300 shadow-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">保存数 (個) <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-3">
                <Input type="number" min="1" value={newSavedQty} onChange={e => setNewSavedQty(e.target.value === "" ? "" : Number(e.target.value))} className="text-xl font-bold bg-white text-right border-slate-300 shadow-sm w-32" />
                <span className="font-bold text-slate-500">個</span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 border-t pt-4 flex gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">キャンセル</Button>
            <Button onClick={handleSaveNewSample} disabled={isProcessing || !newProductId || !newLotCode || !newProductionDate || !newExpiryDate} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 登録して保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 既存の編集・使用記録ダイアログ */}
      <Dialog open={!!editingSample} onOpenChange={(open) => !open && setEditingSample(null)}>
        <DialogContent className="max-w-sm bg-white p-6 rounded-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-slate-800"><Beaker className="h-5 w-5 text-blue-600" /> キープサンプル使用記録</DialogTitle></DialogHeader>
          {editingSample && (
            <div className="space-y-4 mt-2">
              <div className="bg-slate-50 p-4 rounded-lg border text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">管理番号: {editingSample.management_no}</div>
                <div className="font-bold text-blue-900">{editingSample.products?.name}</div>
                <div className="text-sm font-bold text-slate-600">保存数: {editingSample.saved_quantity} 個</div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">保存数 (変更可)</label>
                  <Input type="number" min="1" value={editSavedQty} onChange={e => setEditSavedQty(e.target.value === "" ? "" : Number(e.target.value))} className="text-lg font-bold text-right border-slate-300 h-10 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">使用した数</label>
                  <Input type="number" min="0" max={Number(editSavedQty) || editingSample.saved_quantity} value={editUsedQty} onChange={e => setEditUsedQty(e.target.value === "" ? "" : Number(e.target.value))} className="text-lg font-bold text-right border-blue-300 h-10 bg-white focus-visible:ring-blue-500" />
                </div>
              </div>

              <div><label className="block text-xs font-bold text-slate-500 mb-1">使用日</label><Input type="date" value={editUsedDate} onChange={e => setEditUsedDate(e.target.value)} className="h-10" /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">使用用途</label><Input value={editPurpose} onChange={e => setEditPurpose(e.target.value)} placeholder="例: 菌検査、検食..." className="h-10" /></div>

              <div className="text-xs font-bold text-blue-700 text-center mt-2 bg-blue-50 p-2 rounded">
                現在の残数: {(Number(editSavedQty) || 0) - (Number(editUsedQty) || 0)} 個
              </div>

              <DialogFooter className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-2 w-full">
                <Button variant="outline" onClick={handleDeleteSample} disabled={isProcessing} className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-2" />削除
                </Button>
                <div className="flex gap-2 w-full sm:w-auto ml-auto">
                  <Button variant="ghost" onClick={() => setEditingSample(null)} className="flex-1 sm:flex-none">キャンセル</Button>
                  <Button onClick={handleSaveUsage} disabled={isProcessing || editUsedQty === ""} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 保存
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}