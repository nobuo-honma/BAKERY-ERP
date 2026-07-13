"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, MinusCircle, Save, Loader2, CalendarDays, Printer, ArrowLeft, Trash, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import HaccpPrintHeader from "@/components/HaccpPrintHeader";

// YO-41 の項目定義 (全7項目)
const WASTE_ITEMS = [
    { id: "w1", text: "製造作業所内に廃棄物が散乱していないか、廃棄物容器に格納しているか" },
    { id: "w2", text: "廃棄物の容器から汚液・汚水が流出していないか" },
    { id: "w3", text: "作業終了後、廃棄物を処分しているか" },
    { id: "w4", text: "廃棄物容器を使用後、洗浄・消毒・乾燥しているか" },
    { id: "w5", text: "廃棄物集積場所では、分別管理しているか" },
    { id: "w6", text: "廃棄物は定期的に回収されているか" },
    { id: "w7", text: "廃棄物集積場を、回収後直ちに、清掃・洗浄・消毒しているか" },
];

type CheckResult = 'ok' | 'ng' | null;
type WasteRecord = {
    check_date: string;
    results?: Record<string, CheckResult>;
    checker_name?: string | null;
    notes?: string | null;
};

export default function WasteChecksPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'input' | 'monthly' | 'print'>('input');

    // 日次入力用State
    const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [results, setResults] = useState<Record<string, CheckResult>>({});
    const [checkerName, setCheckerName] = useState("");
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // 月次一覧用State
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [monthlyData, setMonthlyData] = useState<Record<string, WasteRecord>>({});

    const fetchDailyData = useCallback(async (dateStr: string) => {
        setLoading(true);
        const { data } = await supabase.from('waste_checks').select('*').eq('check_date', dateStr).maybeSingle();
        if (data) {
            const record = data as WasteRecord | null;
            setResults(record?.results || {}); setCheckerName(record?.checker_name || ""); setNotes(record?.notes || "");
        } else {
            setResults({}); setCheckerName(""); setNotes("");
        }
        setLoading(false);
    }, []);

    const fetchMonthlyData = useCallback(async (dateObj: Date) => {
        setLoading(true);
        const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const startDate = `${y}-${m}-01`;
        const endDate = new Date(y, dateObj.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data } = await supabase.from('waste_checks').select('*').gte('check_date', startDate).lte('check_date', endDate);
        if (data) {
            const dataMap: Record<string, WasteRecord> = {};
            data.forEach((row: WasteRecord) => { dataMap[row.check_date] = row; });
            setMonthlyData(dataMap);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (checkDate && viewMode === 'input') {
            const timer = window.setTimeout(() => {
                void fetchDailyData(checkDate);
            }, 0);

            return () => window.clearTimeout(timer);
        }
    }, [checkDate, viewMode, fetchDailyData]);

    useEffect(() => {
        if (viewMode === 'monthly' || viewMode === 'print') {
            const timer = window.setTimeout(() => {
                void fetchMonthlyData(calendarMonth);
            }, 0);

            return () => window.clearTimeout(timer);
        }
    }, [calendarMonth, viewMode, fetchMonthlyData]);

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
        const { error } = await supabase.from('waste_checks').upsert(payload, { onConflict: 'check_date' });
        setIsSaving(false);
        if (error) alert("保存に失敗しました: " + error.message);
        else alert("廃棄物チェック記録を保存しました！");
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー
    // 上下2段（1〜16日 / 17〜月末）で出力
    // =======================================================================
    if (viewMode === 'print') {
        const y = calendarMonth.getFullYear();
        const m = calendarMonth.getMonth() + 1;
        const daysInMonth = new Date(y, m, 0).getDate();

        // 1日〜16日
        const daysTop = Array.from({ length: 16 }, (_, i) => i + 1);
        // その月の最終入力日の備考を取得（月末のまとめとして印字）
        const lastInputDateStr = Object.keys(monthlyData).sort().pop();
        const printNotes = lastInputDateStr ? monthlyData[lastInputDateStr].notes : "";

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

                    <HaccpPrintHeader
                        title="廃棄物チェック表"
                        subtitle={<>令和 {y - 2018} <span className="font-normal text-base">年</span> {m} <span className="font-normal text-base">月</span></>}
                        docNo="YO-41"
                        establishedDate="2021/4/1"
                        revisedDate=""
                    />

                    {/* 上段テーブル (1日〜16日) */}
                    <table className="w-full border-collapse border-2 border-black text-[12px] table-fixed mb-4">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black py-1 w-[4%] font-bold">NO.</th>
                                <th className="border border-black py-1 w-[30%] font-bold tracking-widest">点検項目</th>
                                {daysTop.map(day => <th key={day} className="border border-black py-1 font-bold w-[4.1%]">{day}日</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {WASTE_ITEMS.map((item, idx) => (
                                <tr key={item.id} className="h-8">
                                    <td className="border border-black text-center">{idx + 1}</td>
                                    <td className="border border-black px-2 text-[11px] leading-tight truncate overflow-hidden whitespace-nowrap" title={item.text}>{item.text}</td>
                                    {daysTop.map(day => {
                                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                        return <td key={day} className="border border-black text-center font-bold p-0 text-sm">{res === 'ok' ? '〇' : res === 'ng' ? '×' : ''}</td>;
                                    })}
                                </tr>
                            ))}
                            {/* サイン欄 */}
                            <tr className="h-8 bg-gray-50">
                                <td colSpan={2} className="border border-black text-right pr-2 text-xs font-bold">担当者（サイン/印）</td>
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
                                <th className="border border-black py-1 w-[4%] font-bold">NO.</th>
                                <th className="border border-black py-1 w-[30%] font-bold tracking-widest">点検項目</th>
                                {/* 日付枠は16枠分確保してレイアウトを揃える */}
                                {Array.from({ length: 16 }, (_, i) => i + 17).map(day => (
                                    <th key={day} className={`border border-black py-1 font-bold w-[4.1%] ${day > daysInMonth ? 'bg-gray-200' : ''}`}>
                                        {day <= daysInMonth ? `${day}日` : ''}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {WASTE_ITEMS.map((item, idx) => (
                                <tr key={item.id} className="h-8">
                                    <td className="border border-black text-center">{idx + 1}</td>
                                    <td className="border border-black px-2 text-[11px] leading-tight truncate overflow-hidden whitespace-nowrap" title={item.text}>{item.text}</td>
                                    {Array.from({ length: 16 }, (_, i) => i + 17).map(day => {
                                        if (day > daysInMonth) return <td key={day} className="border border-black bg-gray-200"></td>;
                                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                        return <td key={day} className="border border-black text-center font-bold p-0 text-sm">{res === 'ok' ? '〇' : res === 'ng' ? '×' : ''}</td>;
                                    })}
                                </tr>
                            ))}
                            {/* サイン欄 */}
                            <tr className="h-8 bg-gray-50">
                                <td colSpan={2} className="border border-black text-right pr-2 text-xs font-bold">担当者（サイン/印）</td>
                                {Array.from({ length: 16 }, (_, i) => i + 17).map(day => {
                                    if (day > daysInMonth) return <td key={day} className="border border-black bg-gray-200"></td>;
                                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const checker = monthlyData[dateStr]?.checker_name;
                                    return <td key={day} className="border border-black text-center p-0">{checker ? <div className="text-[9px] truncate max-w-[20px] mx-auto">{checker.slice(0, 2)}</div> : ""}</td>;
                                })}
                            </tr>
                        </tbody>
                    </table>

                    {/* 備考欄 */}
                    <div className="flex-1 mt-2 border-2 border-black flex flex-col">
                        <div className="bg-gray-100 border-b border-black text-[12px] font-bold px-3 py-1 tracking-widest">備　考</div>
                        <div className="flex-1 p-3 text-xs whitespace-pre-wrap">{printNotes || "　"}</div>
                    </div>

                </div>
            </div>
        );
    }

    // =======================================================================
    // 通常画面
    // =======================================================================
    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <Trash className="h-6 w-6 text-orange-600" />
                        廃棄物チェック表 (YO-41)
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
                {viewMode === 'monthly' && (
                    <Button onClick={() => setViewMode('print')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-10 w-full sm:w-auto">
                        <Printer className="h-4 w-4 mr-2" /> PDF帳票を出力
                    </Button>
                )}
            </div>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'input' | 'monthly' | 'print')} className="w-full">
                <TabsList className="mb-6 bg-slate-200/80 p-1.5 rounded-xl">
                    <TabsTrigger value="input" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-sm">日次チェック (現場入力用)</TabsTrigger>
                    <TabsTrigger value="monthly" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-sm">月間一覧 (管理者・監査用)</TabsTrigger>
                </TabsList>

                <TabsContent value="input">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-1/3">
                            <Card className="sticky top-20 shadow-sm border-slate-200">
                                <CardHeader className="bg-orange-50/50 border-b pb-4">
                                    <CardTitle className="text-lg text-orange-900 flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-orange-600" />点検日の選択
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div><label className="block text-sm font-bold mb-1 text-slate-700">対象日付</label><Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="h-12 text-lg font-bold bg-white border-orange-300 shadow-sm" /></div>
                                    <div className="pt-2 border-t mt-4"><label className="block text-sm font-bold mb-1 text-slate-700">点検担当者 (確認印)</label><Input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} disabled={!canEdit} placeholder="名前を入力..." className="bg-white" /></div>
                                    <div><label className="block text-sm font-bold mb-1 text-slate-700">備考 (任意)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} className="w-full p-3 border border-slate-200 rounded-md text-sm resize-none h-24 bg-white focus:border-orange-400 focus:ring-1 focus:ring-orange-400" placeholder="特記事項など..." /></div>
                                    {canEdit ? (
                                        <Button onClick={handleSaveDaily} disabled={isSaving || loading} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 shadow-md mt-4">
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
                                        <CardTitle className="text-lg text-slate-800">点検項目リスト (全7項目)</CardTitle>
                                        <div className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-full">タップして 良 / 不良 を切り替え</div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {loading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div> : (
                                        <div className="divide-y divide-slate-100">
                                            {WASTE_ITEMS.map((item, idx) => {
                                                const res = results[item.id]; const isOk = res === 'ok'; const isNg = res === 'ng';
                                                return (
                                                    <div key={item.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isNg ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                                        <div className="flex-1 flex gap-3">
                                                            <div className="font-bold text-slate-400 w-6 shrink-0 pt-0.5">{idx + 1}.</div>
                                                            <h3 className="font-bold text-slate-800 text-sm md:text-base leading-snug pt-0.5">{item.text}</h3>
                                                        </div>
                                                        <div className="shrink-0 flex sm:justify-end">
                                                            <button onClick={() => toggleResult(item.id)} disabled={!canEdit} className={`w-full sm:w-32 h-14 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all shadow-sm border-2 ${isOk ? 'bg-blue-500 border-blue-600 text-white' : isNg ? 'bg-red-500 border-red-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'}`}>
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
                                            <TableHead className="w-10 border-r font-bold text-slate-700 bg-slate-100 text-center">No.</TableHead>
                                            <TableHead className="w-64 border-r font-bold text-slate-700 bg-slate-100 sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">点検項目</TableHead>
                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => (
                                                <TableHead key={day} className="w-8 text-center border-r p-0.5 font-bold text-slate-600 text-xs">{day}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? <TableRow><TableCell colSpan={33} className="h-64 text-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></TableCell></TableRow> : (
                                            WASTE_ITEMS.map((item, idx) => (
                                                <TableRow key={item.id} className="hover:bg-slate-50 border-b">
                                                    <TableCell className="border-r text-center text-xs text-slate-500">{idx + 1}</TableCell>
                                                    <TableCell className="border-r font-bold text-xs text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] truncate" title={item.text}>
                                                        {item.text}
                                                    </TableCell>
                                                    {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                        const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                                        return <TableCell key={day} className={`border-r text-center p-0 ${res === 'ng' ? 'bg-red-50' : ''}`}>{res === 'ok' && <span className="text-blue-600 font-bold text-[10px]">〇</span>}{res === 'ng' && <span className="text-red-600 font-black text-[10px]">×</span>}{!res && <span className="text-slate-200">-</span>}</TableCell>;
                                                    })}
                                                </TableRow>
                                            ))
                                        )}
                                        <TableRow className="bg-slate-50">
                                            <TableCell className="border-r font-bold text-xs text-slate-600 text-right pr-4" colSpan={2}>担当者</TableCell>
                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                const checker = monthlyData[dateStr]?.checker_name;
                                                return <TableCell key={`checker-${day}`} className="border-r text-center p-0.5">{checker ? <div className="text-[8px] truncate max-w-[28px] mx-auto text-slate-700" title={checker}>{checker.slice(0, 2)}</div> : ""}</TableCell>;
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