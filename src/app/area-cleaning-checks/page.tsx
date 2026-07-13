"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, MinusCircle, Save, Loader2, CalendarDays, Printer, ArrowLeft, Sparkles, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
// ★共通ヘッダー部品をインポート
import HaccpPrintHeader from "@/components/HaccpPrintHeader";

// YO-21 の項目定義 (全8項目)
const AREA_CLEANING_ITEMS = [
    { id: "ac1", name: "前室", freq: "1日1回", method: "毎日、作業終了後に掃き掃除、拭き掃除後に水気をワイパーでよく切る。" },
    { id: "ac2", name: "作業室", freq: "1日1回", method: "作業室全体の整理整頓を確認する。不要な物は廃棄する。" },
    { id: "ac3", name: "作業台", freq: "1日1回", method: "毎日、作業終了後に清掃後、アルコール消毒をする。" },
    { id: "ac4", name: "床", freq: "1日1回", method: "清掃後に次亜塩素で消毒し乾燥させる。" },
    { id: "ac5", name: "冷蔵・冷凍庫", freq: "1日1回", method: "原材料の整理整頓を行う。\n内部の清掃" },
    { id: "ac6", name: "窓", freq: "月1回", method: "専用洗剤を使用し、拭き掃除後、乾燥させる。" },
    { id: "ac7", name: "排水溝", freq: "1日1回", method: "水洗い後、中世洗剤で洗浄。トラップにある残渣を取り除き、次亜塩素で消毒。" },
    { id: "ac8", name: "排気口", freq: "月1回", method: "フィルターを外し、水洗い後に消毒し乾燥させる。" },
];

type CheckResult = 'ok' | 'ng' | null;

type AreaCleaningCheckRow = {
    check_date: string;
    results?: Record<string, CheckResult>;
    checker_name?: string;
    notes?: string;
};

type MonthlyDataMap = Record<string, AreaCleaningCheckRow>;

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

export default function AreaCleaningChecksPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'input' | 'monthly' | 'print'>('input');

    // 日次入力用State
    const [checkDate, setCheckDate] = useState(getTodayString);
    const [results, setResults] = useState<Record<string, CheckResult>>({});
    const [checkerName, setCheckerName] = useState("");
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // 月次一覧用State
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [monthlyData, setMonthlyData] = useState<MonthlyDataMap>({});

    const fetchDailyData = useCallback(async (dateStr: string) => {
        setLoading(true);
        const { data } = await supabase.from('area_cleaning_checks').select('*').eq('check_date', dateStr).maybeSingle();
        const row = data as AreaCleaningCheckRow | null;
        if (row) {
            setResults(row.results || {});
            setCheckerName(row.checker_name || "");
            setNotes(row.notes || "");
        } else {
            setResults({});
            setCheckerName("");
            setNotes("");
        }
        setLoading(false);
    }, []);

    const fetchMonthlyData = useCallback(async (dateObj: Date) => {
        setLoading(true);
        const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const startDate = `${y}-${m}-01`;
        const endDate = new Date(y, dateObj.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data } = await supabase.from('area_cleaning_checks').select('*').gte('check_date', startDate).lte('check_date', endDate);
        const rows = (data as AreaCleaningCheckRow[] | null) ?? [];
        const dataMap: MonthlyDataMap = {};
        rows.forEach((row) => {
            dataMap[row.check_date] = row;
        });
        setMonthlyData(dataMap);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!checkDate || viewMode !== 'input') return;

        const timeoutId = window.setTimeout(() => {
            void fetchDailyData(checkDate);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [checkDate, fetchDailyData, viewMode]);

    useEffect(() => {
        if (viewMode !== 'monthly' && viewMode !== 'print') return;

        const timeoutId = window.setTimeout(() => {
            void fetchMonthlyData(calendarMonth);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [calendarMonth, fetchMonthlyData, viewMode]);

    const toggleResult = (itemId: string) => {
        if (!canEdit) return;
        setResults(prev => {
            const current = prev[itemId];
            let next: CheckResult = 'ok';
            if (current === 'ok') next = 'ng';
            else if (current === 'ng') next = null;
            return { ...prev, [itemId]: next };
        });
    };

    const handleSaveDaily = async () => {
        if (!checkDate) return;
        setIsSaving(true);
        const payload = { check_date: checkDate, results: results, checker_name: checkerName, notes: notes, updated_at: new Date().toISOString() };
        const { error } = await supabase.from('area_cleaning_checks').upsert(payload, { onConflict: 'check_date' });
        setIsSaving(false);
        if (error) alert("保存に失敗しました: " + error.message);
        else alert("清掃チェック記録を保存しました！");
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー
    // =======================================================================
    if (viewMode === 'print') {
        // ★ 変数 y と m をここで定義しているので、このブロック内なら使えます
        const y = calendarMonth.getFullYear();
        const m = calendarMonth.getMonth() + 1;
        const daysInMonth = new Date(y, m, 0).getDate();

        const daysTop = Array.from({ length: 16 }, (_, i) => i + 1);

        return (
            <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        header, nav { display: none !important; }
                        main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
                        @page { size: A4 landscape; margin: 10mm; }
                        body { background-color: white !important; color: black !important; }
                        .print-hide { display: none !important; }
                    }
                `}} />

                <div className="w-[297mm] print:w-full flex justify-between mb-4 print-hide">
                    <Button variant="outline" onClick={() => setViewMode('monthly')} className="bg-white text-slate-700 font-bold border-slate-300">
                        <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
                    </Button>
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
                        <Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)
                    </Button>
                </div>

                <div className="w-[297mm] h-[210mm] bg-white pt-8 pb-4 px-12 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-start gap-8">

                    {/* ★共通ヘッダーを使用 */}
                    <HaccpPrintHeader
                        title="清掃チェック表"
                        subtitle={<>令和 {y - 2018} <span className="font-normal text-sm">年</span> {m} <span className="font-normal text-sm">月</span></>}
                        docNo="YO-21"
                        establishedDate="2021/4/1"
                        revisedDate=""
                    />

                    {/* 上段テーブル (1日〜16日) */}
                    <table className="w-full border-collapse border-2 border-black text-[12px] table-fixed mb-4 mt-2">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black py-1 w-[8%] font-bold">項目</th>
                                <th className="border border-black py-1 w-[22%] font-bold">清掃方法</th>
                                {daysTop.map(day => <th key={day} className="border border-black py-1 font-bold w-[4.3%]">{day}日</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {AREA_CLEANING_ITEMS.map(item => (
                                <tr key={item.id} className="h-8">
                                    <td className="border border-black text-center leading-tight">
                                        {item.name}<br /><span className="text-[10px]">({item.freq})</span>
                                    </td>
                                    <td className="border border-black px-2 text-[11px] whitespace-pre-wrap leading-tight">{item.method}</td>
                                    {daysTop.map(day => {
                                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                        return <td key={day} className="border border-black text-center font-bold p-0">{res === 'ok' ? '〇' : res === 'ng' ? '×' : ''}</td>;
                                    })}
                                </tr>
                            ))}
                            <tr className="h-8">
                                <td className="border border-black text-center">確認</td>
                                <td className="border border-black px-2 text-xs">確認者は印を押す。</td>
                                {daysTop.map(day => {
                                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const checker = monthlyData[dateStr]?.checker_name;
                                    return <td key={day} className="border border-black text-center p-0">{checker ? <div className="text-[9px] truncate max-w-[20px] mx-auto">{checker.slice(0, 2)}</div> : ""}</td>;
                                })}
                            </tr>
                        </tbody>
                    </table>

                    {/* 下段テーブル (17日〜月末) */}
                    <table className="w-full border-collapse border-2 border-black text-[12px] table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black py-1 w-[8%] font-bold">項目</th>
                                <th className="border border-black py-1 w-[22%] font-bold">清掃方法</th>
                                {Array.from({ length: 16 }, (_, i) => i + 17).map(day => (
                                    <th key={day} className={`border border-black py-1 font-bold w-[4.3%] ${day > daysInMonth ? 'bg-gray-200' : ''}`}>
                                        {day <= daysInMonth ? `${day}日` : ''}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {AREA_CLEANING_ITEMS.map(item => (
                                <tr key={item.id} className="h-8">
                                    <td className="border border-black text-center leading-tight">
                                        {item.name}<br /><span className="text-[10px]">({item.freq})</span>
                                    </td>
                                    <td className="border border-black px-2 text-[11px] whitespace-pre-wrap leading-tight">{item.method}</td>
                                    {Array.from({ length: 16 }, (_, i) => i + 17).map(day => {
                                        if (day > daysInMonth) return <td key={day} className="border border-black bg-gray-200"></td>;
                                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                        return <td key={day} className="border border-black text-center font-bold p-0">{res === 'ok' ? '〇' : res === 'ng' ? '×' : ''}</td>;
                                    })}
                                </tr>
                            ))}
                            <tr className="h-8">
                                <td className="border border-black text-center">確認</td>
                                <td className="border border-black px-2 text-xs">確認者は印を押す。</td>
                                {Array.from({ length: 16 }, (_, i) => i + 17).map(day => {
                                    if (day > daysInMonth) return <td key={day} className="border border-black bg-gray-200"></td>;
                                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const checker = monthlyData[dateStr]?.checker_name;
                                    return <td key={day} className="border border-black text-center p-0">{checker ? <div className="text-[9px] truncate max-w-[20px] mx-auto">{checker.slice(0, 2)}</div> : ""}</td>;
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // =======================================================================
    // 通常画面 (日次入力 / 月次一覧)
    // =======================================================================
    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <Sparkles className="h-6 w-6 text-cyan-600" />
                        清掃チェック表 (YO-21)
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
                {viewMode === 'monthly' && (
                    <Button onClick={() => setViewMode('print')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-10 w-full sm:w-auto">
                        <Printer className="h-4 w-4 mr-2" /> PDF帳票を出力
                    </Button>
                )}
            </div>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "input" | "monthly" | "print")} className="w-full">
                <TabsList className="mb-6 bg-slate-200/80 p-1.5 rounded-xl">
                    <TabsTrigger value="input" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-cyan-700 data-[state=active]:shadow-sm">日次チェック (現場入力用)</TabsTrigger>
                    <TabsTrigger value="monthly" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-cyan-700 data-[state=active]:shadow-sm">月間一覧 (管理者・監査用)</TabsTrigger>
                </TabsList>

                <TabsContent value="input">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-1/3">
                            <Card className="sticky top-20 shadow-sm border-slate-200">
                                <CardHeader className="bg-cyan-50/50 border-b pb-4">
                                    <CardTitle className="text-lg text-cyan-900 flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-cyan-600" />点検日の選択
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div><label className="block text-sm font-bold mb-1 text-slate-700">対象日付</label><Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="h-12 text-lg font-bold bg-white border-cyan-300 shadow-sm" /></div>
                                    <div className="pt-2 border-t mt-4"><label className="block text-sm font-bold mb-1 text-slate-700">点検担当者 (確認印)</label><Input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} disabled={!canEdit} placeholder="名前を入力..." className="bg-white" /></div>
                                    <div><label className="block text-sm font-bold mb-1 text-slate-700">備考</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} className="w-full p-3 border border-slate-200 rounded-md text-sm resize-none h-24 bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" placeholder="特記事項など..." /></div>
                                    {canEdit ? (
                                        <Button onClick={handleSaveDaily} disabled={isSaving || loading} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-12 shadow-md mt-4">
                                            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} この日の記録を保存
                                        </Button>
                                    ) : (<div className="text-center text-sm font-bold text-slate-500 bg-slate-50 py-3 rounded-md border border-slate-200 mt-4"><Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため保存不可</div>)}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="w-full lg:w-2/3">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="bg-white border-b pb-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg text-slate-800">各エリアの清掃チェック (全8項目)</CardTitle>
                                        <div className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-full">タップして 良 / 不良 を切り替え</div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {loading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-cyan-500" /></div> : (
                                        <div className="divide-y divide-slate-100">
                                            {AREA_CLEANING_ITEMS.map((item) => {
                                                const res = results[item.id]; const isOk = res === 'ok'; const isNg = res === 'ng';
                                                return (
                                                    <div key={item.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isNg ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                                                                <Badge className="bg-slate-100 text-slate-600 border-none shadow-none text-[10px] px-2 py-0">{item.freq}</Badge>
                                                            </div>
                                                            <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{item.method}</p>
                                                        </div>
                                                        <div className="shrink-0 flex sm:justify-end">
                                                            <button onClick={() => toggleResult(item.id)} disabled={!canEdit} className={`w-full sm:w-32 h-14 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all shadow-sm border-2 ${isOk ? 'bg-cyan-500 border-cyan-600 text-white' : isNg ? 'bg-red-500 border-red-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'}`}>
                                                                {isOk && <><CheckCircle2 className="w-5 h-5" /> 良</>}
                                                                {isNg && <><XCircle className="w-5 h-5" /> 不良</>}
                                                                {!isOk && !isNg && <><MinusCircle className="w-5 h-5" /> 未実施</>}
                                                            </button>
                                                        </div>
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

                <TabsContent value="monthly">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4">
                            <CardTitle className="text-lg text-slate-800">月間 記録マトリックス</CardTitle>
                            <Input type="month" value={`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`} onChange={(e) => { if (e.target.value) setCalendarMonth(new Date(e.target.value + "-01")); }} className="w-40 bg-white font-bold" />
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table className="w-full table-fixed min-w-[1200px] border-collapse text-sm">
                                    <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-32 border-r font-bold text-slate-700 bg-slate-100 sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">清掃エリア</TableHead>
                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => (
                                                <TableHead key={day} className="w-10 text-center border-r p-1 font-bold text-slate-600 text-xs">{day}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? <TableRow><TableCell colSpan={32} className="h-64 text-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></TableCell></TableRow> : (
                                            AREA_CLEANING_ITEMS.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-slate-50 border-b">
                                                    <TableCell className="border-r font-bold text-xs text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                                        {item.name}
                                                    </TableCell>
                                                    {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                        const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                                        return <TableCell key={day} className={`border-r text-center p-0 ${res === 'ng' ? 'bg-red-50' : ''}`}>{res === 'ok' && <span className="text-cyan-600 font-bold">〇</span>}{res === 'ng' && <span className="text-red-600 font-black">×</span>}{!res && <span className="text-slate-200">-</span>}</TableCell>;
                                                    })}
                                                </TableRow>
                                            ))
                                        )}
                                        <TableRow className="bg-slate-50">
                                            <TableCell className="border-r font-bold text-xs text-slate-600 sticky left-0 z-10">確認 (担当者)</TableCell>
                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                const checker = monthlyData[dateStr]?.checker_name;
                                                return <TableCell key={`checker-${day}`} className="border-r text-center p-1">{checker ? <div className="text-[9px] truncate max-w-[32px] mx-auto text-slate-700" title={checker}>{checker.slice(0, 2)}</div> : ""}</TableCell>;
                                            })}
                                        </TableRow>
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