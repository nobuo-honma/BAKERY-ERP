"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, MinusCircle, Save, Loader2, CalendarDays, Printer, ArrowLeft, Building2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// YO-26 の項目定義 (30項目)
const FACILITY_ITEMS = [
    { id: "f1", category: "工場周囲の環境", text: "工場の周囲を、定期的に清掃しているか" },
    { id: "f2", category: "工場周囲の環境", text: "外部排水溝を定期的に清掃・点検しているか" },
    { id: "f3", category: "工場周囲の環境", text: "外部の排水溝は、スムーズに流れているか" },
    { id: "f4", category: "工場周囲の環境", text: "ゴミの集積場に、ゴミが堆積していないか" },
    { id: "f5", category: "工場周囲の環境", text: "ゴミの集積場を、分別管理しているのか" },
    { id: "f6", category: "工場周囲の環境", text: "ゴミの集積場を、搬出後、清掃・洗浄・消毒等しているか" },
    { id: "f7", category: "工場周囲の環境", text: "駐車場では、キチンと駐車しているか" },
    { id: "f8", category: "工場周囲の環境", text: "周囲の草花・雑草等の環境整備はできているか" },
    { id: "f9", category: "施設", text: "施設を、目的別に使用しているか" },
    { id: "f10", category: "施設", text: "休憩室・事務所等を、製造等に使用していないか" },
    { id: "f11", category: "施設", text: "汚染作業区域と清潔作業区域が明確になっているか" },
    { id: "f12", category: "施設", text: "施設を、必要に応じて補修しているか" },
    { id: "f13", category: "施設", text: "施設を日に一回以上清掃しているか" },
    { id: "f14", category: "施設", text: "施設のドア・窓等が開放されていないか" },
    { id: "f15", category: "施設", text: "手洗い設備は整備されているか" },
    { id: "f16", category: "施設", text: "手洗い設備には、石鹸・爪ブラシ・消毒液等が完備されているか" },
    { id: "f17", category: "施設", text: "排水溝を点検・洗浄しているか" },
    { id: "f18", category: "施設", text: "排水口には昨日分の残りカス等が溜まっていないか" },
    { id: "f19", category: "施設", text: "排水溝は、スムーズに流れているか" },
    { id: "f20", category: "施設", text: "床には凸凹等がなく平滑に管理されているか" },
    { id: "f21", category: "施設", text: "床面を、日に一回以上清掃・洗浄しているか" },
    { id: "f22", category: "施設", text: "換気装置を、週一回以上、フィルターは月に一回以上清掃・洗浄しているか" },
    { id: "f23", category: "施設", text: "冷蔵庫を週一回以上、冷凍庫を月に一回以上清掃・洗浄しているか" },
    { id: "f24", category: "施設", text: "オーブンを週一回以上、清掃・洗浄しているか" },
    { id: "f25", category: "施設", text: "便所を、日に一回以上、清掃・洗浄・消毒しているか" },
    { id: "f26", category: "施設", text: "便所の手洗い設備に不備はないか" },
    { id: "f27", category: "施設", text: "便所には、専用の履物があるか" },
    { id: "f28", category: "施設", text: "冷蔵庫の温度を、定期的に測定しているか" },
    { id: "f29", category: "施設", text: "冷凍庫の温度を、定期的に測定しているか" },
    { id: "f30", category: "施設", text: "オーブンの温度を、定期的に測定しているか" }
];

type CheckResult = 'ok' | 'ng' | null;

export default function FacilityChecksPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'input' | 'monthly' | 'print'>('input');

    // 日次入力用
    const [checkDate, setCheckDate] = useState("");
    const [results, setResults] = useState<Record<string, CheckResult>>({});
    const [checkerName, setCheckerName] = useState("");
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // 月次一覧用
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [monthlyData, setMonthlyData] = useState<Record<string, any>>({});

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setCheckDate(today);
    }, []);

    useEffect(() => {
        if (checkDate && viewMode === 'input') fetchDailyData(checkDate);
    }, [checkDate, viewMode]);

    useEffect(() => {
        if (viewMode === 'monthly' || viewMode === 'print') fetchMonthlyData(calendarMonth);
    }, [calendarMonth, viewMode]);

    const fetchDailyData = async (dateStr: string) => {
        setLoading(true);
        const { data } = await supabase.from('facility_checks').select('*').eq('check_date', dateStr).maybeSingle();
        if (data) {
            setResults(data.results || {}); setCheckerName(data.checker_name || ""); setNotes(data.notes || "");
        } else {
            setResults({}); setCheckerName(""); setNotes("");
        }
        setLoading(false);
    };

    const fetchMonthlyData = async (dateObj: Date) => {
        setLoading(true);
        const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const startDate = `${y}-${m}-01`;
        const endDate = new Date(y, dateObj.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data } = await supabase.from('facility_checks').select('*').gte('check_date', startDate).lte('check_date', endDate);
        if (data) {
            const dataMap: Record<string, any> = {};
            data.forEach(row => { dataMap[row.check_date] = row; });
            setMonthlyData(dataMap);
        }
        setLoading(false);
    };

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
        const { error } = await supabase.from('facility_checks').upsert(payload, { onConflict: 'check_date' });
        setIsSaving(false);
        if (error) alert("保存に失敗しました: " + error.message);
        else alert("施設設備チェック記録を保存しました！");
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー
    // =======================================================================
    if (viewMode === 'print') {
        const y = calendarMonth.getFullYear();
        const m = calendarMonth.getMonth() + 1;
        const daysArray = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => i + 1);

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

                <div className="w-[297mm] h-[210mm] bg-white pt-6 pb-4 px-8 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col">
                    <div className="flex justify-between items-end mb-4">
                        <h1 className="text-2xl font-bold tracking-widest">施設設備チェック表</h1>
                        <div className="text-base font-bold">{y} <span className="font-normal text-sm">年</span> {m} <span className="font-normal text-sm">月</span></div>
                        <table className="border-collapse border border-black text-center text-[10px]">
                            <tbody>
                                <tr>
                                    <th className="border border-black px-2 py-0.5 font-medium bg-gray-100">ワークセンター・やまびこ</th>
                                    <th className="border border-black px-4 py-0.5 font-medium bg-gray-100 w-20">施設長</th>
                                    <th className="border border-black px-4 py-0.5 font-medium bg-gray-100 w-20">担当者</th>
                                </tr>
                                <tr>
                                    <td className="border border-black p-0">
                                        <table className="w-full border-collapse">
                                            <tbody>
                                                <tr><th className="border-b border-r border-black px-2 py-0.5 font-medium bg-gray-100 w-16">文章No.</th><td className="border-b border-black px-2 py-0.5">YO-26</td></tr>
                                                <tr><th className="border-b border-r border-black px-2 py-0.5 font-medium bg-gray-100">制定日</th><td className="border-b border-black px-2 py-0.5">2019/10/1</td></tr>
                                                <tr><th className="border-r border-black px-2 py-0.5 font-medium bg-gray-100">改定日</th><td className=""></td></tr>
                                            </tbody>
                                        </table>
                                    </td>
                                    <td className="border border-black"></td>
                                    <td className="border border-black"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <table className="w-full border-collapse border-2 border-black text-[9px] flex-1 table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black py-0.5 w-[5%] font-medium">分類</th>
                                <th className="border border-black py-0.5 w-[3%] font-medium">No.</th>
                                <th className="border border-black py-0.5 w-[30%] font-medium">点検項目</th>
                                {daysArray.map(day => (
                                    <th key={day} className="border border-black py-0.5 font-medium w-[2%]">{day}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {FACILITY_ITEMS.map((item, idx) => (
                                <tr key={item.id} className="h-[5mm]">
                                    {idx === 0 && <td className="border border-black text-center font-bold writing-vertical" rowSpan={8}>工場の周囲</td>}
                                    {idx === 8 && <td className="border border-black text-center font-bold writing-vertical" rowSpan={22}>施設</td>}
                                    <td className="border border-black text-center font-medium">{idx + 1}</td>
                                    <td className="border border-black px-1 truncate leading-tight overflow-hidden whitespace-nowrap" title={item.text}>{item.text}</td>
                                    {daysArray.map(day => {
                                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                        return (
                                            <td key={day} className="border border-black text-center font-bold text-[9px] p-0">
                                                {res === 'ok' ? '〇' : res === 'ng' ? '×' : ''}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* 備考・担当者 */}
                    <table className="w-full border-collapse border-2 border-black border-t-0 text-[10px] mt-0">
                        <tbody>
                            <tr>
                                <th className="border border-black py-1 w-[38%] bg-gray-100 font-medium text-right pr-2">担当者（サイン/印）</th>
                                {daysArray.map(day => {
                                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const checker = monthlyData[dateStr]?.checker_name;
                                    return (
                                        <td key={day} className="border border-black text-center p-0 w-[2%]">
                                            {checker ? <div className="text-[7px] truncate max-w-[14px] mx-auto leading-none pt-0.5">{checker.slice(0, 2)}</div> : ""}
                                        </td>
                                    );
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
                        <Building2 className="h-6 w-6 text-blue-600" />
                        施設設備チェック表 (YO-26)
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
                {viewMode === 'monthly' && (
                    <Button onClick={() => setViewMode('print')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-10 w-full sm:w-auto">
                        <Printer className="h-4 w-4 mr-2" /> PDF帳票を出力
                    </Button>
                )}
            </div>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                <TabsList className="mb-6 bg-slate-200/80 p-1.5 rounded-xl">
                    <TabsTrigger value="input" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">日次チェック (現場入力用)</TabsTrigger>
                    <TabsTrigger value="monthly" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">月間一覧 (管理者・監査用)</TabsTrigger>
                </TabsList>

                <TabsContent value="input">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-1/3">
                            <Card className="sticky top-20 shadow-sm border-slate-200">
                                <CardHeader className="bg-blue-50/50 border-b pb-4">
                                    <CardTitle className="text-lg text-blue-900 flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-blue-600" />
                                        点検日の選択
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-slate-700">対象日付</label>
                                        <Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="h-12 text-lg font-bold bg-white border-blue-300 shadow-sm" />
                                    </div>
                                    <div className="pt-2 border-t mt-4">
                                        <label className="block text-sm font-bold mb-1 text-slate-700">点検担当者</label>
                                        <Input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} disabled={!canEdit} placeholder="名前を入力..." className="bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-slate-700">備考</label>
                                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} className="w-full p-3 border border-slate-200 rounded-md text-sm resize-none h-24 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400" placeholder="特記事項など..." />
                                    </div>
                                    {canEdit ? (
                                        <Button onClick={handleSaveDaily} disabled={isSaving || loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-md mt-4">
                                            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                                            この日の記録を保存
                                        </Button>
                                    ) : (
                                        <div className="text-center text-sm font-bold text-slate-500 bg-slate-50 py-3 rounded-md border border-slate-200 mt-4">
                                            <Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため保存不可
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="w-full lg:w-2/3">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="bg-white border-b pb-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg text-slate-800">施設点検 (全30項目)</CardTitle>
                                        <div className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-full">
                                            タップして 良 / 不良 を切り替え
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {loading ? (
                                        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {FACILITY_ITEMS.map((item, idx) => {
                                                const res = results[item.id];
                                                const isOk = res === 'ok';
                                                const isNg = res === 'ng';
                                                const isCategoryStart = idx === 0 || FACILITY_ITEMS[idx - 1].category !== item.category;

                                                return (
                                                    <div key={item.id}>
                                                        {isCategoryStart && (
                                                            <div className="bg-slate-100 px-4 py-2 font-black text-slate-700 text-sm border-y border-slate-200">
                                                                {item.category}
                                                            </div>
                                                        )}
                                                        <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isNg ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                                            <div className="flex-1 flex gap-3">
                                                                <div className="font-bold text-slate-400 w-6 shrink-0 pt-0.5">{idx + 1}.</div>
                                                                <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-snug pt-0.5">{item.text}</h3>
                                                            </div>

                                                            <div className="shrink-0 flex sm:justify-end">
                                                                <button
                                                                    onClick={() => toggleResult(item.id)}
                                                                    disabled={!canEdit}
                                                                    className={`w-full sm:w-32 h-12 rounded-xl flex items-center justify-center gap-2 font-black text-base transition-all shadow-sm border-2 ${isOk ? 'bg-blue-500 border-blue-600 text-white' :
                                                                            isNg ? 'bg-red-500 border-red-600 text-white' :
                                                                                'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'
                                                                        }`}
                                                                >
                                                                    {isOk && <><CheckCircle2 className="w-5 h-5" /> 良</>}
                                                                    {isNg && <><XCircle className="w-5 h-5" /> 不良</>}
                                                                    {!isOk && !isNg && <><MinusCircle className="w-5 h-5" /> -</>}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
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
                            <Input
                                type="month"
                                value={`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`}
                                onChange={(e) => {
                                    if (e.target.value) setCalendarMonth(new Date(e.target.value + "-01"));
                                }}
                                className="w-40 bg-white font-bold"
                            />
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
                                        {loading ? (
                                            <TableRow><TableCell colSpan={33} className="h-64 text-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></TableCell></TableRow>
                                        ) : (
                                            FACILITY_ITEMS.map((item, idx) => (
                                                <TableRow key={item.id} className="hover:bg-slate-50 border-b">
                                                    <TableCell className="border-r text-center text-xs text-slate-500">{idx + 1}</TableCell>
                                                    <TableCell className="border-r font-bold text-xs text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] truncate" title={item.text}>
                                                        {item.text}
                                                    </TableCell>
                                                    {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                        const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                        const res = monthlyData[dateStr]?.results?.[item.id];

                                                        return (
                                                            <TableCell key={day} className={`border-r text-center p-0 ${res === 'ng' ? 'bg-red-50' : ''}`}>
                                                                {res === 'ok' && <span className="text-blue-600 font-bold text-[10px]">〇</span>}
                                                                {res === 'ng' && <span className="text-red-600 font-black text-[10px]">×</span>}
                                                                {!res && <span className="text-slate-200">-</span>}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))
                                        )}
                                        <TableRow className="bg-slate-50">
                                            <TableCell className="border-r font-bold text-xs text-slate-600 text-right pr-4" colSpan={2}>担当者</TableCell>
                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                const checker = monthlyData[dateStr]?.checker_name;
                                                return (
                                                    <TableCell key={`checker-${day}`} className="border-r text-center p-0.5">
                                                        {checker ? <div className="text-[8px] truncate max-w-[28px] mx-auto text-slate-700" title={checker}>{checker.slice(0, 2)}</div> : ""}
                                                    </TableCell>
                                                );
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