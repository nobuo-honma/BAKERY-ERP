"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Archive, Search, Printer, Loader2, Save, Trash2, Edit, AlertCircle, CheckCircle2, FlaskConical, History, Lock, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type KeepSample = {
  id: string;
  product_id: string;
  lot_code: string;
  save_date: string;
  expiry_date: string;
  qty: number;
  purpose: string | null;
  used_date: string | null;
  used_qty: number;
  status: string;
  products?: {
    name: string;
    variant_name: string;
  };
};

export default function KeepSamplesPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'print'>('list');
  const [samples, setSamples] = useState<KeepSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 編集用
  const [selectedSample, setSelectedSample] = useState<KeepSample | null>(null);
  const [editForm, setEditForm] = useState({ usedDate: "", usedQty: 0, purpose: "" });

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("keep_samples")
      .select("*, products(name, variant_name)")
      .order("save_date", { ascending: false });
    
    if (error) {
      console.error("データ取得エラー:", error);
    } else if (data) {
      setSamples(data as KeepSample[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  const handleOpenEdit = (sample: KeepSample) => {
    setSelectedSample(sample);
    setEditForm({
      usedDate: sample.used_date || new Date().toISOString().split('T')[0],
      usedQty: sample.qty,
      purpose: sample.purpose || ""
    });
  };

  const handleUpdate = async () => {
    if (!selectedSample || !canEdit) return;
    setIsProcessing(true);
    try {
      const isUsed = editForm.usedQty > 0;
      const { error } = await supabase
        .from("keep_samples")
        .update({
          used_date: isUsed ? editForm.usedDate : null,
          used_qty: editForm.usedQty,
          purpose: editForm.purpose,
          status: isUsed ? "used" : "saved"
        })
        .eq("id", selectedSample.id);

      if (error) throw error;
      await fetchSamples();
      setSelectedSample(null);
      alert("更新しました。");
    } catch (err: any) {
      alert("エラー: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit || !confirm("この記録を削除しますか？")) return;
    const { error } = await supabase.from("keep_samples").delete().eq("id", id);
    if (!error) fetchSamples();
    else alert("エラー: " + error.message);
  };

  const filteredSamples = samples.filter(s => 
    s.lot_code.toLowerCase().includes(search.toLowerCase()) ||
    s.products?.name.toLowerCase().includes(search.toLowerCase())
  );

  const printView = (
    <div className="bg-white p-8 min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none; }
          body { background: white; }
          .print-container { width: 100%; border: none; box-shadow: none; padding: 0; }
        }
      `}} />
      <div className="flex justify-between items-center mb-6 no-print border-b pb-4">
        <Button variant="outline" onClick={() => setViewMode('list')}><ArrowLeft className="w-4 h-4 mr-2" /> 戻る</Button>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="bg-slate-800 text-white"><Printer className="w-4 h-4 mr-2" /> 印刷実行 (A4横推奨)</Button>
        </div>
      </div>

      <div className="print-container">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2 tracking-tight">保存サンプル管理記録簿</h1>
          <p className="text-slate-500 font-bold">作成日: {new Date().toLocaleDateString('ja-JP')} | やまびこパン事業所</p>
        </div>

        <Table className="border-2 border-slate-900 border-collapse">
          <TableHeader>
            <TableRow className="bg-slate-100 border-b-2 border-slate-900">
              <TableHead className="border-r border-slate-300 text-slate-900 font-black h-12">採取日</TableHead>
              <TableHead className="border-r border-slate-300 text-slate-900 font-black">製品名・Lot</TableHead>
              <TableHead className="border-r border-slate-300 text-slate-900 font-black text-right">数量(個)</TableHead>
              <TableHead className="border-r border-slate-300 text-slate-900 font-black">賞味期限</TableHead>
              <TableHead className="border-r border-slate-300 text-slate-900 font-black">使用(廃棄)日</TableHead>
              <TableHead className="border-r border-slate-300 text-slate-900 font-black">数量</TableHead>
              <TableHead className="text-slate-900 font-black">目的・備考</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {samples.map((s) => (
              <TableRow key={s.id} className="border-b border-slate-400 h-16">
                <TableCell className="border-r border-slate-300 font-bold">{new Date(s.save_date).toLocaleDateString('ja-JP')}</TableCell>
                <TableCell className="border-r border-slate-300">
                  <div className="font-bold">{s.products?.name}</div>
                  <div className="text-xs text-slate-500 font-mono">Lot: {s.lot_code}</div>
                </TableCell>
                <TableCell className="border-r border-slate-300 text-right font-black text-lg">{s.qty}</TableCell>
                <TableCell className="border-r border-slate-300 font-bold">{new Date(s.expiry_date).toLocaleDateString('ja-JP')}</TableCell>
                <TableCell className="border-r border-slate-300 font-bold">{s.used_date ? new Date(s.used_date).toLocaleDateString('ja-JP') : "―"}</TableCell>
                <TableCell className="border-r border-slate-300 text-right font-bold">{s.used_qty || "―"}</TableCell>
                <TableCell className="italic text-sm">{s.purpose || "―"}</TableCell>
              </TableRow>
            ))}
            {samples.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-400">記録はありません</TableCell></TableRow>}
          </TableBody>
        </Table>

        <div className="mt-12 grid grid-cols-3 gap-8">
          <div className="border border-slate-900 h-24 p-2 flex flex-col justify-between"><span className="text-[10px] font-bold">承認者 (役職: ＿＿＿＿＿)</span><div className="flex justify-end pr-4 text-slate-300">(印)</div></div>
          <div className="border border-slate-900 h-24 p-2 flex flex-col justify-between"><span className="text-[10px] font-bold">確認者</span><div className="flex justify-end pr-4 text-slate-300">(印)</div></div>
          <div className="border border-slate-900 h-24 p-2 flex flex-col justify-between"><span className="text-[10px] font-bold">担当者 (記録)</span><div className="flex justify-end pr-4 text-slate-300">(印)</div></div>
        </div>
      </div>
    </div>
  );

  if (viewMode === 'print') return printView;

  return (
    <div className="bg-transparent">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-800">
            <FlaskConical className="h-7 w-7 text-indigo-600" /> 保存サンプル管理
          </h1>
          <p className="text-sm text-slate-500 font-bold mt-1">製造時に採取したサンプルの追跡と保管状況の記録</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="製品・Lotで検索..." 
              className="pl-9 bg-white border-slate-200" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setViewMode('print')} className="bg-slate-800 text-white font-bold h-10 px-4 shrink-0">
            <Printer className="w-4 h-4 mr-2" /> 記録簿印刷
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-100 border-b">
            <TableRow>
              <TableHead className="font-black text-slate-700">採取日・Lot</TableHead>
              <TableHead className="font-black text-slate-700">製品名</TableHead>
              <TableHead className="font-black text-slate-700 text-right">保管数</TableHead>
              <TableHead className="font-black text-slate-700">賞味期限</TableHead>
              <TableHead className="font-black text-slate-700 text-center">状態</TableHead>
              <TableHead className="font-black text-slate-700 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-indigo-500 mx-auto" /></TableCell></TableRow>
            ) : filteredSamples.map((s) => (
              <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <div className="font-bold text-slate-800">{new Date(s.save_date).toLocaleDateString()}</div>
                  <div className="text-[11px] font-mono bg-slate-100 text-slate-600 px-1 rounded w-fit mt-1">{s.lot_code}</div>
                </TableCell>
                <TableCell>
                  <div className="font-bold text-slate-800">{s.products?.name}</div>
                  <div className="text-xs text-slate-500">{s.products?.variant_name}</div>
                </TableCell>
                <TableCell className="text-right font-black text-lg text-slate-700">{s.qty} <span className="text-[10px] font-normal text-slate-400">個</span></TableCell>
                <TableCell className="font-bold text-slate-600 italic">{new Date(s.expiry_date).toLocaleDateString()}</TableCell>
                <TableCell className="text-center">
                  {s.status === 'used' ? (
                    <Badge className="bg-slate-200 text-slate-600 border-none font-bold"><History className="w-3 h-3 mr-1" /> 使用済</Badge>
                  ) : (
                    <Badge className="bg-indigo-100 text-indigo-700 border-none font-bold"><CheckCircle2 className="w-3 h-3 mr-1" /> 保管中</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(s)} className="h-8 border-slate-200">
                          <Edit className="w-3 h-3 mr-1" /> {s.status === 'used' ? "編集" : "使用・廃棄を登録"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2"><FlaskConical className="w-5 h-5" /> サンプル使用・廃棄登録</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="bg-slate-50 p-3 rounded-md border border-slate-100 mb-2">
                            <div className="text-xs text-slate-500 mb-1">対象サンプル:</div>
                            <div className="font-bold text-slate-800">{s.products?.name} (Lot: {s.lot_code})</div>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-bold mb-1">使用・廃棄日</label>
                            <Input type="date" value={editForm.usedDate} onChange={e => setEditForm({...editForm, usedDate: e.target.value})} className="border-slate-200" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold mb-1">使用・廃棄数 (個) <span className="text-xs font-normal text-slate-400">※0で「保管中」に戻ります</span></label>
                            <div className="flex items-center gap-2">
                              <Input type="number" value={editForm.usedQty} onChange={e => setEditForm({...editForm, usedQty: Number(e.target.value)})} className="border-slate-200 text-lg font-black h-12 text-right" />
                              <span className="text-sm font-bold text-slate-500">/ {s.qty}個中</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-bold mb-1">使用目的・備考</label>
                            <Input placeholder="例: 保存試験に使用、期限切れ廃棄など..." value={editForm.purpose} onChange={e => setEditForm({...editForm, purpose: e.target.value})} className="border-slate-200" />
                          </div>
                          
                          <Button onClick={handleUpdate} disabled={isProcessing} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold h-12 shadow-md">
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} 変更を確定
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredSamples.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400"><div className="flex flex-col items-center"><Archive className="h-10 w-10 mb-2 opacity-30" /><p>該当するサンプル記録は見つかりませんでした。</p></div></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <Card className="bg-indigo-50/50 border-indigo-100 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><FlaskConical className="w-6 h-6" /></div>
            <div>
              <div className="text-xs text-indigo-600 font-bold mb-0.5">現在保管中</div>
              <div className="text-2xl font-black text-slate-800">{samples.filter(s => s.status === 'saved').length} <span className="text-xs font-normal text-slate-500">件</span></div>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-50/50 border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><History className="w-6 h-6" /></div>
            <div>
              <div className="text-xs text-slate-500 font-bold mb-0.5">累計使用・廃棄</div>
              <div className="text-2xl font-black text-slate-800">{samples.filter(s => s.status === 'used').length} <span className="text-xs font-normal text-slate-500">件</span></div>
            </div>
          </div>
        </Card>
        <Card className="bg-white border-slate-200 p-4 border-dashed flex flex-col justify-center">
          <p className="text-xs text-slate-400 text-center font-bold">※製品製造(ロット登録)時に自動で<br/>サンプル保管が登録されます。</p>
        </Card>
      </div>
    </div>
  );
}
