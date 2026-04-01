"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Beaker, Loader2, Save, Lock, Edit, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type KeepSample = {
    id: string;
    lot_code: string;
    product_id: string;
    management_no: string;
    saved_quantity: number;
    production_date: string;
    expiry_date: string;
    used_quantity: number;
    usage_purpose: string;
    used_date: string;
    products?: { name: string; variant_name: string };
};

export default function KeepSamplesPage() {
    const { canEdit } = useAuth();
    const [samples, setSamples] = useState<KeepSample[]>([]);
    const [loading, setLoading] = useState(true);

    // 編集用State
    const [editingSample, setEditingSample] = useState<KeepSample | null>(null);
    const [editUsedQty, setEditUsedQty] = useState<number | "">("");
    const [editPurpose, setEditPurpose] = useState("");
    const [editUsedDate, setEditUsedDate] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchSamples = useCallback(async () => {
        setLoading(true);
        // 製造日が新しい順に取得
        const { data } = await supabase.from("keep_samples").select("*, products(name, variant_name)").order("production_date", { ascending: false });
        if (data) setSamples(data as KeepSample[]);
        setLoading(false);
    }, []);

    useEffect(() => { fetchSamples(); }, [fetchSamples]);

    const openEditModal = (sample: KeepSample) => {
        setEditingSample(sample);
        setEditUsedQty(sample.used_quantity === 0 ? "" : sample.used_quantity); // 0の場合は空にして入力しやすく
        setEditPurpose(sample.usage_purpose || "官能検査・菌検査");
        setEditUsedDate(sample.used_date || new Date().toISOString().split('T')[0]); // デフォルト今日
    };

    const handleSaveUsage = async () => {
        if (!editingSample) return;
        const uQty = Number(editUsedQty) || 0;

        if (uQty > editingSample.saved_quantity) {
            alert("エラー: 使用数が保存数を超えています！");
            return;
        }

        setIsProcessing(true);
        const updates = {
            used_quantity: uQty,
            usage_purpose: uQty > 0 ? editPurpose : null,
            used_date: uQty > 0 ? editUsedDate : null,
            updated_at: new Date().toISOString()
        };

        const { error: dbError } = await supabase.from("keep_samples").update(updates).eq("id", editingSample.id);

        if (!dbError) {
            setEditingSample(null);
            fetchSamples();
            alert("使用記録を保存しました！");
        } else {
            alert("エラー: " + dbError.message);
        }
        setIsProcessing(false);
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-500" /></div>;

    return (
        <div className="bg-transparent">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Beaker className="h-6 w-6 text-blue-600" /> キープサンプル管理</h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
            </div>

            <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                <Table className="min-w-[1000px]">
                    <TableHeader className="bg-slate-50">
                        <TableRow>
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

                            return (
                                <TableRow key={sample.id} className={isUsedUp ? "bg-slate-50/50 opacity-70" : "hover:bg-slate-50"}>
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

                                    <TableCell className="text-right font-bold text-slate-600">{sample.saved_quantity} <span className="text-[10px] font-normal">p</span></TableCell>
                                    <TableCell className="text-right font-bold text-red-600">{sample.used_quantity} <span className="text-[10px] font-normal">p</span></TableCell>
                                    <TableCell className={`text-right font-black text-lg ${isUsedUp ? 'text-slate-400' : 'text-blue-700'}`}>{remainQty} <span className="text-xs font-normal">p</span></TableCell>

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
                                        {canEdit ? (
                                            <Button variant="outline" size="sm" onClick={() => openEditModal(sample)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                                <Edit className="h-3 w-3 mr-1" /> 記録
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-slate-400"><Lock className="w-3 h-3 inline" /></span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {samples.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-16 text-slate-500 font-bold bg-slate-50/50">キープサンプルのデータがありません。</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>

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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">使用した数 (個)</label>
                                    <Input type="number" min="0" max={editingSample.saved_quantity} value={editUsedQty} onChange={e => setEditUsedQty(e.target.value === "" ? "" : Number(e.target.value))} className="text-xl font-bold text-right border-blue-300 h-10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">使用日</label>
                                    <Input type="date" value={editUsedDate} onChange={e => setEditUsedDate(e.target.value)} className="h-10" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">使用用途</label>
                                <Input value={editPurpose} onChange={e => setEditPurpose(e.target.value)} placeholder="例: 保存試験、検食、クレーム調査..." className="h-10" />
                            </div>

                            <div className="text-xs text-slate-500 text-center mt-2">
                                ※使用数を入力すると、残数は自動的に {editingSample.saved_quantity - (Number(editUsedQty) || 0)} 個になります。
                            </div>

                            <DialogFooter className="mt-4 pt-4 border-t flex gap-2 w-full">
                                <Button variant="ghost" onClick={() => setEditingSample(null)} className="flex-1">キャンセル</Button>
                                <Button onClick={handleSaveUsage} disabled={isProcessing || editUsedQty === ""} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 記録を保存
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}