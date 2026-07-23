"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Save, Loader2, CalendarDays, Printer, ArrowLeft, PackageOpen, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import HaccpPrintHeader from "@/components/HaccpPrintHeader";

// YO-14 の項目定義 (全28項目)
const MATERIAL_ITEMS = [
    { id: "m1", name: "デリソフト", unit: "kg", storage: "常温" },
    { id: "m2", name: "チョコチップHCEE", unit: "kg", storage: "冷蔵" },
    { id: "m3", name: "アクアクーベルホワイトカカオ", unit: "kg", storage: "冷蔵" },
    { id: "m4", name: "マスカルポーネ・レジェ", unit: "kg", storage: "冷蔵" },
    { id: "m5", name: "まめまーじゅUSA", unit: "kg", storage: "冷蔵" },
    { id: "m6", name: "ドライクランベリーBR", unit: "kg", storage: "冷凍" },
    { id: "m7", name: "デザーンココアパウダーテラロッサ", unit: "kg", storage: "冷蔵" },
    { id: "m8", name: "あすなろミックス", unit: "袋", storage: "冷蔵" },
    { id: "m9", name: "コア粉", unit: "袋", storage: "冷蔵" },
    { id: "m10", name: "P15菓子パンミックス", unit: "袋", storage: "冷蔵" },
    { id: "m11", name: "凍結全卵", unit: "本", storage: "冷蔵" },
    { id: "m12", name: "オレンジカット５ｍｍ Ａ", unit: "kg", storage: "冷蔵" },
    { id: "m13", name: "かのこ黒豆", unit: "kg", storage: "冷蔵" },
    { id: "m14", name: "キャラメルチョコチップ", unit: "kg", storage: "冷蔵" },
    { id: "m15", name: "Eオイルスーパー６０", unit: "缶", storage: "冷蔵" },
    { id: "m16", name: "ミックスフルーツ", unit: "kg", storage: "冷蔵" },
    { id: "m17", name: "アップルチップ", unit: "kg", storage: "冷蔵" },
    { id: "m18", name: "ホワイトチョコチップ", unit: "kg", storage: "常温" },
    { id: "m19", name: "ドライストロベリー", unit: "kg", storage: "冷蔵" },
    { id: "m20", name: "パンプキンパウダー", unit: "kg", storage: "冷蔵" },
    { id: "m21", name: "FRイースト", unit: "包", storage: "冷蔵" },
    { id: "m22", name: "ミルシア", unit: "kg", storage: "冷蔵" },
    { id: "m23", name: "ルミナスグランデ", unit: "kg", storage: "冷蔵" },
    { id: "m24", name: "ショコラクリュホワイト", unit: "kg", storage: "冷蔵" },
    { id: "m25", name: "プチヴェールパウダー", unit: "kg", storage: "冷蔵" },
    { id: "m26", name: "シーベリーペースト", unit: "kg", storage: "冷蔵" },
    { id: "m27", name: "ハスカップペースト", unit: "kg", storage: "常温" },
    { id: "m28", name: "デバイダーオイル", unit: "缶", storage: "常温" },
];

type ReceiveData = { expiry: string; lot: string; qty: string; appearance: 'ok' | 'ng' | null; smell: 'ok' | 'ng' | null; };
type ViewMode = 'input' | 'list' | 'print';
type MaterialReceivingRecord = {
    id?: string;
    check_date: string;
    checker_name?: string;
    results?: Record<string, ReceiveData>;
};

export default function MaterialReceivingPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('input');

    const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [results, setResults] = useState<Record<string, ReceiveData>>({});
    const [checkerName, setCheckerName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    // 一覧用State
    const [records, setRecords] = useState<MaterialReceivingRecord[]>([]);
    const [printRecord, setPrintRecord] = useState<MaterialReceivingRecord | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('material_receiving_checks').select('*').order('check_date', { ascending: false }).limit(30);
        if (data) setRecords(data as MaterialReceivingRecord[]);
        setLoading(false);
    }, []);

    const fetchDailyData = useCallback(async (dateStr: string) => {
        setLoading(true);
        const { data } = await supabase.from('material_receiving_checks').select('*').eq('check_date', dateStr).maybeSingle();
        const record = data as MaterialReceivingRecord | null;
        if (record) {
            setResults(record.results || {}); setCheckerName(record.checker_name || "");
        } else {
            setResults({}); setCheckerName("");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchRecords();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [fetchRecords]);

    useEffect(() => {
        if (!checkDate || viewMode !== 'input') return;

        const timer = window.setTimeout(() => {
            void fetchDailyData(checkDate);
        }, 0);

        return () => window.clearTimeout(timer);
    }, [checkDate, viewMode, fetchDailyData]);

    const handleInputChange = (itemId: string, field: keyof ReceiveData, value: string | null) => {
        if (!canEdit) return;
        setResults(prev => {
            const current = prev[itemId] || { expiry: "", lot: "", qty: "", appearance: null, smell: null };
            return { ...prev, [itemId]: { ...current, [field]: value } };
        });
    };

    const handleSaveDaily = async () => {
        if (!checkDate) return;
        setIsSaving(true);
        // 空のデータ（何も入力されていない品目）は保存対象から除外する
        const cleanedResults: Record<string, ReceiveData> = {};
        Object.keys(results).forEach(key => {
            const r = results[key];
            if (r.expiry || r.lot || r.qty || r.appearance || r.smell) {
                cleanedResults[key] = r;
            }
        });

        const payload = { check_date: checkDate, results: cleanedResults, checker_name: checkerName, updated_at: new Date().toISOString() };
        const { error } = await supabase.from('material_receiving_checks').upsert(payload, { onConflict: 'check_date' });
        setIsSaving(false);
        if (error) alert("保存に失敗しました: " + error.message);
        else {
            alert("原材料受入記録を保存しました！");
            fetchRecords();
        }
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー
    // =======================================================================
    if (viewMode === 'print' && printRecord) {
        const rec = printRecord;
        const dObj = new Date(rec.check_date);
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        const pResults = rec.results || {};

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
                    }
                `}} />

                <div className="w-[210mm] print:w-full flex justify-between mb-4 print-hide">
                    <Button variant="outline" onClick={() => { setViewMode('list'); setPrintRecord(null); }} className="bg-white text-slate-700 font-bold border-slate-300">
                        <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
                    </Button>
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
                        <Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)
                    </Button>
                </div>

                <div className="w-[210mm] min-h-[297mm] bg-white pt-8 pb-6 px-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col">

                    <HaccpPrintHeader
                        title="原材料受入台帳"
                        docNo="YO-14"
                        establishedDate="2021/4/1"
                        revisedDate="2023/5/1"
                    />

                    <div className="mb-2 text-base font-bold flex gap-4">
                        <div>入荷日：</div>
                        <div className="flex-1 flex justify-center tracking-widest">
                            {y} 年　　{m} 月　　{d} 日
                        </div>
                    </div>

                    <table className="w-full border-collapse border-2 border-black text-[12px] flex-1 table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black py-1 w-[4%] font-medium">No.</th>
                                <th className="border border-black py-1 w-[26%] font-medium">商品名</th>
                                <th className="border border-black py-1 w-[25%] font-medium">賞味期限</th>
                                <th className="border border-black py-1 w-[15%] font-medium">Lot</th>
                                <th className="border border-black py-1 w-[10%] font-medium">数量</th>
                                <th className="border border-black py-1 w-[6%] font-medium">外観</th>
                                <th className="border border-black py-1 w-[6%] font-medium">臭い</th>
                                <th className="border border-black py-1 w-[8%] font-medium text-[10px]">保存方法</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MATERIAL_ITEMS.map((item, idx) => {
                                const input = pResults[item.id];
                                let expiryStr = "　　年　　月　　日";
                                if (input && input.expiry) {
                                    const ex = new Date(input.expiry);
                                    expiryStr = `${ex.getFullYear()} 年 ${String(ex.getMonth() + 1).padStart(2, '0')} 月 ${String(ex.getDate()).padStart(2, '0')} 日`;
                                }

                                return (
                                    <tr key={item.id} className="h-[7.5mm]">
                                        <td className="border border-black text-center font-medium">{idx + 1}</td>
                                        <td className="border border-black px-1.5 text-[11px] truncate">{item.name}</td>
                                        <td className="border border-black text-center text-[10px] tracking-widest">{expiryStr}</td>
                                        <td className="border border-black text-center text-[11px] tracking-wider px-1 truncate">{input?.lot || ""}</td>
                                        <td className="border border-black text-right pr-1 font-bold">
                                            {input?.qty ? <>{input.qty} <span className="text-[9px] font-normal">{item.unit}</span></> : <span className="text-[9px] font-normal text-slate-400">{item.unit}</span>}
                                        </td>
                                        <td className="border border-black text-center font-bold">{input?.appearance === 'ok' ? '〇' : input?.appearance === 'ng' ? '×' : ''}</td>
                                        <td className="border border-black text-center font-bold">{input?.smell === 'ok' ? '〇' : input?.smell === 'ng' ? '×' : ''}</td>
                                        <td className="border border-black text-center text-[10px]">{item.storage}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="mt-4 text-[11px] leading-relaxed text-slate-800 font-medium">
                        ※ 原材料受入時に、外装状態、臭い、賞味期限などを確認。<br />
                        不備があった場合は、返品して正常品に交換。<br />
                        外観は、梱包状態（破れ、へこみ等）、異物付着の有無、漏れ等を確認
                    </div>
                </div>
            </div>
        );
    }


    // =======================================================================
    // 通常画面 (入力 / 一覧)
    // =======================================================================
    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <PackageOpen className="h-6 w-6 text-indigo-600" />
                        原材料受入台帳 (YO-14)
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
            </div>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
                <TabsList className="mb-6 bg-slate-200/80 p-1.5 rounded-xl">
                    <TabsTrigger value="input" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">入荷データ入力</TabsTrigger>
                    <TabsTrigger value="list" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">受入記録一覧 (印刷)</TabsTrigger>
                </TabsList>

                {/* --- 入力タブ --- */}
                <TabsContent value="input">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-1/3">
                            <Card className="sticky top-20 shadow-sm border-slate-200">
                                <CardHeader className="bg-indigo-50/50 border-b pb-4">
                                    <CardTitle className="text-lg text-indigo-900 flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-indigo-600" />受入日の選択
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div><label className="block text-sm font-bold mb-1 text-slate-700">入荷日</label><Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="h-12 text-lg font-bold bg-white border-indigo-300 shadow-sm" /></div>
                                    <div className="pt-2 border-t mt-4"><label className="block text-sm font-bold mb-1 text-slate-700">担当者 (確認印)</label><Input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} disabled={!canEdit} placeholder="名前を入力..." className="bg-white" /></div>
                                    {canEdit ? (
                                        <Button onClick={handleSaveDaily} disabled={isSaving || loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-md mt-4">
                                            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} この日の入荷を保存
                                        </Button>
                                    ) : (<div className="text-center text-sm font-bold text-slate-500 bg-slate-50 py-3 rounded-md border border-slate-200 mt-4"><Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため保存不可</div>)}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="w-full lg:w-2/3">
                            <Card className="shadow-sm border-slate-200 mb-12">
                                <CardHeader className="bg-white border-b pb-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg text-slate-800">入荷した原材料の入力</CardTitle>
                                        <div className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-full">該当する品目のみ入力してください</div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {loading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-indigo-500" /></div> : (
                                        <div className="divide-y divide-slate-200">
                                            {MATERIAL_ITEMS.map((item, idx) => {
                                                const isExpanded = expandedItem === item.id;
                                                const res = results[item.id] || { expiry: "", lot: "", qty: "", appearance: null, smell: null };
                                                const hasData = res.expiry || res.lot || res.qty || res.appearance || res.smell;

                                                return (
                                                    <div key={item.id} className={`transition-colors ${hasData ? 'bg-indigo-50/20' : 'bg-white'}`}>
                                                        {/* ヘッダー行 (タップで開閉) */}
                                                        <div
                                                            className={`p-3 md:p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${isExpanded ? 'bg-indigo-50/50' : ''}`}
                                                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="font-bold text-slate-400 w-5 text-right text-xs md:text-sm">{idx + 1}.</div>
                                                                <div>
                                                                    <div className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                                                                        {item.name}
                                                                        {hasData && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 flex gap-2 mt-0.5">
                                                                        <span className="bg-slate-100 px-1.5 rounded">単位: {item.unit}</span>
                                                                        <span className={`${item.storage === '冷蔵' || item.storage === '冷凍' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 bg-slate-100'} px-1.5 rounded font-bold`}>{item.storage}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-slate-400">
                                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                            </div>
                                                        </div>

                                                        {/* 入力フォーム部分 */}
                                                        {isExpanded && (
                                                            <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 shadow-inner">
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-600 mb-1">賞味期限</label>
                                                                    <Input type="date" value={res.expiry} onChange={e => handleInputChange(item.id, 'expiry', e.target.value)} disabled={!canEdit} className="bg-white h-9" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-600 mb-1">Lot番号</label>
                                                                    <Input value={res.lot} onChange={e => handleInputChange(item.id, 'lot', e.target.value)} disabled={!canEdit} className="bg-white h-9" placeholder="ロット記号を入力..." />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-600 mb-1">数量</label>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input type="number" min="0" step="0.1" value={res.qty} onChange={e => handleInputChange(item.id, 'qty', e.target.value)} disabled={!canEdit} className="bg-white h-9 text-right font-bold text-indigo-700" />
                                                                        <span className="text-sm font-bold text-slate-500 w-6">{item.unit}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="block text-xs font-bold text-slate-600 mb-1">外観 (状態)</label>
                                                                        <div className="flex bg-white rounded-md border p-0.5 overflow-hidden h-9">
                                                                            <button onClick={() => handleInputChange(item.id, 'appearance', 'ok')} disabled={!canEdit} className={`flex-1 text-xs font-bold rounded-sm transition-colors ${res.appearance === 'ok' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>良(〇)</button>
                                                                            <button onClick={() => handleInputChange(item.id, 'appearance', 'ng')} disabled={!canEdit} className={`flex-1 text-xs font-bold rounded-sm transition-colors ${res.appearance === 'ng' ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>不良(×)</button>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-bold text-slate-600 mb-1">臭い</label>
                                                                        <div className="flex bg-white rounded-md border p-0.5 overflow-hidden h-9">
                                                                            <button onClick={() => handleInputChange(item.id, 'smell', 'ok')} disabled={!canEdit} className={`flex-1 text-xs font-bold rounded-sm transition-colors ${res.smell === 'ok' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>良(〇)</button>
                                                                            <button onClick={() => handleInputChange(item.id, 'smell', 'ng')} disabled={!canEdit} className={`flex-1 text-xs font-bold rounded-sm transition-colors ${res.smell === 'ng' ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>不良(×)</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="md:col-span-2 flex justify-end mt-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            if (!canEdit) return;
                                                                            setResults(prev => {
                                                                                const updated = { ...prev };
                                                                                delete updated[item.id];
                                                                                return updated;
                                                                            });
                                                                        }}
                                                                        disabled={!canEdit}
                                                                        className="h-8 text-xs text-slate-400 hover:text-red-500"
                                                                    >
                                                                        この品目の入力をクリア
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- 一覧タブ --- */}
                <TabsContent value="list">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50 border-b py-4">
                            <CardTitle className="text-lg text-slate-800">受入記録一覧</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table className="w-full min-w-150 text-sm">
                                    <TableHeader className="bg-slate-100">
                                        <TableRow>
                                            <TableHead className="w-32 pl-4">入荷日</TableHead>
                                            <TableHead>担当者</TableHead>
                                            <TableHead className="text-center w-32">入荷した品目数</TableHead>
                                            <TableHead className="w-32 text-center pr-4">印刷</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 text-slate-400 mx-auto" /></TableCell></TableRow> : (
                                            records.map(rec => {
                                                const itemsCount = Object.keys(rec.results || {}).length;
                                                return (
                                                    <TableRow key={rec.id} className="hover:bg-slate-50">
                                                        <TableCell className="pl-4 font-bold text-slate-700">{new Date(rec.check_date).toLocaleDateString()}</TableCell>
                                                        <TableCell className="font-bold text-slate-600">{rec.checker_name || "-"}</TableCell>
                                                        <TableCell className="text-center font-black text-indigo-700">{itemsCount} <span className="text-xs font-normal text-slate-500">品目</span></TableCell>
                                                        <TableCell className="text-center pr-4">
                                                            <Button variant="outline" size="sm" onClick={() => { setPrintRecord(rec); setViewMode('print'); }} className="h-8 px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50"><Printer className="h-4 w-4 mr-1.5" /> 帳票出力</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                        {records.length === 0 && !loading && (
                                            <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500 bg-slate-50">記録がありません。</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}