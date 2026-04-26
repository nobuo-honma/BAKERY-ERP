"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Beaker, Loader2, Save, Lock, Edit, Printer, ArrowLeft, Trash2, Plus, AlertTriangle, QrCode, CheckSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type KeepSample = { id: string; lot_code: string; product_id: string; management_no: string; saved_quantity: number; production_date: string; expiry_date: string; used_quantity: number; usage_purpose: string; used_date: string; products?: { name: string; variant_name: string }; };
type Product = { id: string; name: string; variant_name: string; };

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

  // 新規登録(補填)用State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newLotCode, setNewLotCode] = useState("");
  const [newSavedQty, setNewSavedQty] = useState<number | "">(10);
  const [newProductionDate, setNewProductionDate] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");

  // ★追加: 複数選択用のState
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set());

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

  // ★追加: チェックボックスのON/OFF制御
  const toggleSelectSample = (id: string) => {
    const newSet = new Set(selectedSampleIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSampleIds(newSet);
  };

  // ★追加: 全選択/全解除
  const toggleSelectAll = () => {
    if (selectedSampleIds.size === samples.length) {
      setSelectedSampleIds(new Set()); // 全解除
    } else {
      setSelectedSampleIds(new Set(samples.map(s => s.id))); // 全選択
    }
  };

  // =======================================================================
  // ★追加: キープサンプル 段ボール用まとめラベル印刷画面
  // =======================================================================
  if (viewMode === 'print_label') {
    // 選択されたサンプルのデータを取得
    const selectedSamplesData = samples.filter(s => selectedSampleIds.has(s.id));

    // QRコードには、検索用にLot番号をカンマ区切りで埋め込む
    // (例: スB26SB,26MA01,13B26YC50)
    // ただし、数が多すぎるとQRが複雑になりすぎるため、最初の5個分などに制限する設計もアリですが、今回は全Lotを入れます
    const lotCodes = selectedSamplesData.map(s => s.lot_code).join(',');
    const qrData = encodeURIComponent(lotCodes);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

    // ラベルに記載する期間（最初の製造日〜最後の製造日）
    const dates = selectedSamplesData.map(s => new Date(s.production_date).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const dateRangeStr = minDate.getTime() === maxDate.getTime()
      ? minDate.toLocaleDateString('ja-JP')
      : `${minDate.toLocaleDateString('ja-JP')} 〜 ${maxDate.toLocaleDateString('ja-JP')}`;

    // 最も短い賞味期限（この箱を廃棄すべき基準日）
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

          {/* 切り取り線（ガイド） */}
          <div className="border-[3px] border-dashed border-slate-400 w-[160mm] p-6 rounded-2xl relative">
            <div className="absolute -top-3 left-4 bg-white px-2 text-sm font-bold text-slate-400 flex items-center gap-1"><Beaker className="w-4 h-4" /> 段ボール保管用ラベル</div>

            <div className="text-center border-b-2 border-black pb-4 mb-4 flex justify-between items-end">
              <div className="text-left">
                <h1 className="text-3xl font-black tracking-widest text-slate-800">キープサンプル保管箱</h1>
                <p className="text-sm font-bold text-slate-500 mt-1">品質検査・トレーサビリティ用</p>
              </div>
              {/* QRコード */}
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

            {/* 箱の中身一覧 */}
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
  // 管理記録 印刷画面
  // =======================================================================
  if (viewMode === 'print') {
    const chunkedSamples = [];
    for (let i = 0; i < samples.length; i += 3) chunkedSamples.push(samples.slice(i, i + 3));

    return (
      <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
        <style dangerouslySetInnerHTML={{ __html: `@media print { header, nav { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; } @page { size: A4 landscape; margin: 10mm; } body { background-color: white !important; color: black !important; } .print-hide { display: none !important; } .page-break { page-break-after: always; } }` }} />
        <div className="w-[297mm] print:w-full flex justify-between mb-4 print-hide">
          <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300"><ArrowLeft className="h-4 w-4 mr-2" /> 戻る</Button>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"><Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)</Button>
        </div>

        {chunkedSamples.length === 0 ? (
          <div className="w-[297mm] bg-white p-8 text-center text-slate-500 font-bold shadow-xl">データがありません</div>
        ) : (
          chunkedSamples.map((chunk, pageIdx) => (
            <div key={pageIdx} className={`w-[297mm] h-[210mm] bg-white pt-8 pb-4 px-12 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col ${pageIdx < chunkedSamples.length - 1 ? 'page-break mb-8 print:mb-0' : ''}`}>
              <div className="flex justify-between items-end mb-4 pr-4">
                <h1 className="text-4xl font-bold tracking-[0.2em] border-b-3 border-black pb-1 ml-16">キープサンプル管理記録</h1>
                <table className="border-collapse border-2 border-black text-center text-sm w-48">
                  <tbody><tr><th className="border border-black w-1/2 py-1 font-medium">施設長</th><th className="border border-black w-1/2 py-1 font-medium">担当</th></tr><tr><td className="border border-black h-16"></td><td className="border border-black h-16"></td></tr></tbody>
                </table>
              </div>
              <div className="flex-1 flex flex-col gap-4">
                {chunk.map(sample => {
                  const dP = new Date(sample.production_date); const pStr = `${dP.getFullYear()}.${String(dP.getMonth() + 1).padStart(2, '0')}.${String(dP.getDate()).padStart(2, '0')}`;
                  const dE = new Date(sample.expiry_date); const eStr = `${dE.getFullYear()}.${String(dE.getMonth() + 1).padStart(2, '0')}.${String(dE.getDate()).padStart(2, '0')}`;

                  return (
                    <div key={sample.id} className="flex border-2 border-black h-[48mm] text-[13px]">
                      <div className="w-[60mm] flex flex-col border-r border-black shrink-0">
                        <div className="flex-1 flex border-b border-black"><div className="w-[20mm] p-2 font-medium border-r border-black flex items-center justify-center">ロット</div><div className="flex-1 p-2 flex items-center justify-center font-bold text-base tracking-widest">{sample.lot_code}</div></div>
                        <div className="flex-1 flex border-b border-black"><div className="w-[20mm] p-2 font-medium border-r border-black flex flex-col items-center justify-center leading-tight"><span>賞味</span><span>期限</span></div><div className="flex-1 p-2 flex items-center justify-center font-bold tracking-widest">{eStr}</div></div>
                        <div className="flex-1 flex"><div className="w-[20mm] p-2 font-medium border-r border-black flex flex-col items-center justify-center leading-tight"><span>管理</span><span>番号</span></div><div className="flex-1 p-2 flex items-center justify-center font-bold">{sample.management_no}</div></div>
                      </div>
                      <div className="w-[65mm] flex flex-col border-r border-black shrink-0">
                        <div className="flex-1 flex border-b border-black"><div className="w-[20mm] p-2 font-medium border-r border-black flex flex-col items-center justify-center leading-tight"><span>製造</span><span>種類</span></div><div className="flex-1 p-2 flex items-center justify-center text-center text-xs font-bold leading-tight">{sample.products?.name} <br />({sample.products?.variant_name})</div></div>
                        <div className="flex-1 flex border-b border-black"><div className="w-[20mm] p-2 font-medium border-r border-black flex flex-col items-center justify-center leading-tight"><span>製造</span><span>年月日</span></div><div className="flex-1 p-2 flex items-center justify-center font-bold tracking-widest">{pStr}</div></div>
                        <div className="flex-1 flex"><div className="w-[20mm] p-2 font-medium border-r border-black flex items-center justify-center">保存数</div><div className="flex-1 p-2 pr-4 flex items-center justify-end font-bold text-lg">{sample.saved_quantity} <span className="text-[10px] font-normal ml-1">個</span></div></div>
                      </div>
                      <div className="w-[12mm] border-r border-black flex items-center justify-center font-medium text-xs shrink-0" style={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.2em' }}>使用用途名</div>
                      <div className="flex-1 flex flex-col border-r border-black">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const isUsed = i === 0 && sample.used_quantity > 0;
                          const uDate = isUsed ? new Date(sample.used_date).toLocaleDateString('ja-JP') : "";
                          const uQty = isUsed ? sample.used_quantity : "";
                          const rQty = isUsed ? (sample.saved_quantity - sample.used_quantity) : "";
                          return (
                            <div key={i} className="flex-1 flex border-b border-black last:border-b-0">
                              <div className="w-[22mm] border-r border-black flex flex-col items-center justify-center bg-slate-50 print:bg-transparent leading-tight shrink-0"><span className="text-[10px]">使用</span><span className="text-[10px]">年月日</span></div>
                              <div className="w-[38mm] border-r border-black flex items-center justify-center text-xs tracking-wider shrink-0">{uDate || "　　 .　　 ."}</div>
                              <div className="w-[18mm] border-r border-black flex items-center justify-center bg-slate-50 print:bg-transparent text-[11px] shrink-0">使用数</div>
                              <div className="w-[28mm] border-r border-black flex items-center justify-end pr-2 text-base font-bold shrink-0">{uQty} <span className="text-[9px] font-normal ml-1 mt-1">個</span></div>
                              <div className="w-[18mm] border-r border-black flex items-center justify-center bg-slate-50 print:bg-transparent text-[11px] shrink-0">現在数</div>
                              <div className="flex-1 flex items-center justify-end pr-2 text-base font-bold">{rQty} <span className="text-[9px] font-normal ml-1 mt-1">個</span></div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="w-[12mm] flex flex-col shrink-0">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex-1 border-b border-black last:border-b-0 flex items-center justify-center text-[9px] font-medium text-slate-400 print:text-black/50">印</div>))}</div>
                    </div>
                  );
                })}
                {Array.from({ length: 3 - chunk.length }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="flex border-2 border-black h-[48mm] text-sm opacity-20"><div className="w-[60mm] border-r border-black"></div><div className="w-[65mm] border-r border-black"></div><div className="w-[12mm] border-r border-black"></div><div className="flex-1 border-r border-black flex flex-col">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex-1 border-b border-black last:border-b-0"></div>)}</div><div className="w-[12mm] flex flex-col">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex-1 border-b border-black last:border-b-0"></div>)}</div></div>
                ))}
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
          {/* ★追加: 選択されたサンプルからラベルを発行するボタン */}
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

      <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              {/* ★追加: チェックボックス用のヘッダー */}
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
              const isSelected = selectedSampleIds.has(sample.id); // 選択状態

              return (
                <TableRow key={sample.id} className={`${isUsedUp ? "bg-slate-50/50 opacity-70" : "hover:bg-slate-50"} ${isSelected ? "bg-blue-50/30" : ""}`}>
                  {/* ★追加: 行ごとのチェックボックス */}
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

      {/* =======================================================================
          手動登録ダイアログ
          ======================================================================= */}
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

      {/* --- 既存の編集・使用記録ダイアログ --- */}
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