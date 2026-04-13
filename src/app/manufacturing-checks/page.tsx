"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, MinusCircle, Save, Loader2, CalendarDays, Printer, ArrowLeft, Wrench, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// YO-27 の項目定義
const MFG_DAILY_ITEMS = [
    { id: "m_d1", text: "施設へのねずみや昆虫の侵入を防止するための設備に不備はありませんか" },
    { id: "m_d2", text: "手洗い設備の石けん、爪ブラシ、ペーパータオル、消毒液は適切ですか" },
    { id: "m_d3", text: "休憩室から作業場への移動の際には衣服、履物の交換が行われていますか" },
    { id: "m_d4", text: "施設に部外者が入ったり、製造作業に不必要な物品が置かれていたりしませんか" },
    { id: "m_d5", text: "施設の清掃は、製造作業が完全に終了した後、適切に実施されましたか（床面等）" },
    { id: "m_d6", text: "施設は十分な換気が行われ、高温多湿が避けられていますか" },
];

const MFG_MONTHLY_ITEMS = [
    { id: "m_m1", text: "汚染作業区域（休憩所・事務室）と非汚染作業区域が明確に区別されていますか" },
    { id: "m_m2", text: "巡回点検の結果、ねずみや昆虫の発生はありませんか" },
    { id: "m_m3", text: "便所には、専用の手洗い設備、専用の履き物が備えられていますか" },
    { id: "m_m4", text: "シンクは用途別に相互汚染しないように設置されていますか" },
    { id: "m_m5", text: "シンク等の排水口は排水管又は排水溝に直結した構造になっていますか" },
];

const MFG_QUARTERLY_ITEMS = [
    { id: "m_q1", text: "製造作業場は隔壁等により、不清潔な場所から完全に区別されていますか" },
    { id: "m_q2", text: "製造作業場の入り口手前に手洗い設備、衣服のゴミ取り設備が設置されていますか" },
    { id: "m_q3", text: "便所・休憩室・更衣室は仕切り、隔壁をもって他の場所と区別されていますか" },
];

const ALL_ITEMS = [...MFG_DAILY_ITEMS, ...MFG_MONTHLY_ITEMS, ...MFG_QUARTERLY_ITEMS];

type CheckResult = 'ok' | 'ng' | null;

export default function ManufacturingChecksPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'input' | 'monthly' | 'print'>('input');

    // 日次入力用State
    const [checkDate, setCheckDate] = useState("");
    const [results, setResults] = useState<Record<string, CheckResult>>({});
    const [checkerName, setCheckerName] = useState("");
    const [improvementDone, setImprovementDone] = useState("");
    const [improvementPlanned, setImprovementPlanned] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // 月次一覧用State
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
        const { data } = await supabase.from('manufacturing_checks').select('*').eq('check_date', dateStr).maybeSingle();
        if (data) {
            setResults(data.results || {});
            setCheckerName(data.checker_name || "");
            setImprovementDone(data.improvement_done || "");
            setImprovementPlanned(data.improvement_planned || "");
        } else {
            setResults({}); setCheckerName(""); setImprovementDone(""); setImprovementPlanned("");
        }
        setLoading(false);
    };

    const fetchMonthlyData = async (dateObj: Date) => {
        setLoading(true);
        const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const startDate = `${y}-${m}-01`;
        const endDate = new Date(y, dateObj.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data } = await supabase.from('manufacturing_checks').select('*').gte('check_date', startDate).lte('check_date', endDate);
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
        const payload = {
            check_date: checkDate,
            results: results,
            checker_name: checkerName,
            improvement_done: improvementDone,
            improvement_planned: improvementPlanned,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('manufacturing_checks').upsert(payload, { onConflict: 'check_date' });
        setIsSaving(false);
        if (error) alert("保存に失敗しました: " + error.message);
        else alert("製造施設チェック記録を保存しました！");
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー
    // =======================================================================
    if (viewMode === 'print') {
        const y = calendarMonth.getFullYear();
        const m = calendarMonth.getMonth() + 1;
        const daysArray = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => i + 1);

        // その月の最終入力日のデータを取得し、備考欄に印字する（月末時点での評価として）
        const lastInputDateStr = Object.keys(monthlyData).sort().pop();
        const printImprovementDone = lastInputDateStr ? monthlyData[lastInputDateStr].improvement_done : "";
        const printImprovementPlanned = lastInputDateStr ? monthlyData[lastInputDateStr].improvement_planned : "";

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

                <div className="w-[297mm] h-[210mm] bg-white pt-6 pb-4 px-8 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between">
                    <div className="flex justify-between items-end mb-3">
                        <h1 className="text-2xl font-bold tracking-widest">製造施設チェック表</h1>
                        <div className="text-base font-bold">令和 {y - 2018} <span className="font-normal text-sm">年</span> {m} <span className="font-normal text-sm">月</span></div>
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
                                                <tr><th className="border-b border-r border-black px-2 py-0.5 font-medium bg-gray-100 w-16">文章No.</th><td className="border-b border-black px-2 py-0.5">YO-27</td></tr>
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

                    <table className="w-full border-collapse border-2 border-black text-[9px] table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black py-0.5 w-[3%] font-medium">No.</th>
                                <th className="border border-black py-0.5 w-[30%] font-medium">点検項目</th>
                                {daysArray.map(day => <th key={day} className="border border-black py-0.5 font-medium w-[2.1%]">{day}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td colSpan={33} className="bg-slate-100 font-bold text-[10px] pl-2 border border-black">１．毎日点検</td></tr>
                            {MFG_DAILY_ITEMS.map((item, idx) => (
                                <tr key={item.id} className="h-[4.5mm]">
                                    <td className="border border-black text-center font-medium">{idx + 1}</td>
                                    <td className="border border-black px-1 truncate leading-tight overflow-hidden whitespace-nowrap" title={item.text}>{item.text}</td>
                                    {daysArray.map(day => {
                                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                        return <td key={day} className="border border-black text-center font-bold text-[9px] p-0">{res === 'ok' ? '〇' : res === 'ng' ? '×' : ''}</td>;
                                    })}
                                </tr>
                            ))}

                            <tr><td colSpan={33} className="bg-slate-100 font-bold text-[10px] pl-2 border border-black">２．１ヶ月ごとの点検</td></tr>
                            {MFG_MONTHLY_ITEMS.map((item, idx) => (
                                <tr key={item.id} className="h-[4.5mm]">
                                    <td className="border border-black text-center font-medium">{idx + 1}</td>
                                    <td className="border border-black px-1 truncate leading-tight overflow-hidden whitespace-nowrap" title={item.text}>{item.text}</td>
                                    {daysArray.map(day => {
                                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                        return <td key={day} className="border border-black text-center font-bold text-[9px] p-0">{res === 'ok' ? '〇' : res === 'ng' ? '×' : ''}</td>;
                                    })}
                                </tr>
                            ))}

                            <tr><td colSpan={33} className="bg-slate-100 font-bold text-[10px] pl-2 border border-black">３．３ヶ月ごとの点検</td></tr>
                            {MFG_QUARTERLY_ITEMS.map((item, idx) => (
                                <tr key={item.id} className="h-[4.5mm]">
                                    <td className="border border-black text-center font-medium">{idx + 1}</td>
                                    <td className="border border-black px-1 truncate leading-tight overflow-hidden whitespace-nowrap" title={item.text}>{item.text}</td>
                                    {daysArray.map(day => {
                                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const res = monthlyData[dateStr]?.results?.[item.id];
                                        return <td key={day} className="border border-black text-center font-bold text-[9px] p-0">{res === 'ok' ? '〇' : res === 'ng' ? '×' : ''}</td>;
                                    })}
                                </tr>
                            ))}
                            {/* サイン欄 */}
                            <tr className="bg-gray-50">
                                <td colSpan={2} className="border border-black font-medium text-right pr-2">担当者（サイン/印）</td>
                                {daysArray.map(day => {
                                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const checker = monthlyData[dateStr]?.checker_name;
                                    return <td key={day} className="border border-black text-center p-0">{checker ? <div className="text-[7px] truncate max-w-[14px] mx-auto leading-none pt-0.5">{checker.slice(0, 2)}</div> : ""}</td>;
                                })}
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex-1 mt-3 flex flex-col gap-2">
                        <div className="flex-1 border-2 border-black flex flex-col">
                            <div className="bg-gray-100 border-b border-black text-[10px] font-bold px-2 py-0.5">〈改善を行った点〉</div>
                            <div className="flex-1 p-2 text-xs whitespace-pre-wrap">{printImprovementDone || "　"}</div>
                        </div>
                        <div className="flex-1 border-2 border-black flex flex-col">
                            <div className="bg-gray-100 border-b border-black text-[10px] font-bold px-2 py-0.5">〈計画的に改善すべき点〉</div>
                            <div className="flex-1 p-2 text-xs whitespace-pre-wrap">{printImprovementPlanned || "　"}</div>
                        </div>
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
                        <Wrench className="h-6 w-6 text-purple-600" />
                        製造施設チェック表 (YO-27)
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
                    <TabsTrigger value="input" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm">日次チェック (現場入力用)</TabsTrigger>
                    <TabsTrigger value="monthly" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm">月間一覧 (管理者・監査用)</TabsTrigger>
                </TabsList>

                <TabsContent value="input">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-1/3 space-y-6">
                            <Card className="sticky top-20 shadow-sm border-slate-200">
                                <CardHeader className="bg-purple-50/50 border-b pb-4">
                                    <CardTitle className="text-lg text-purple-900 flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-purple-600" />点検日の選択
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div><label className="block text-sm font-bold mb-1 text-slate-700">対象日付</label><Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="h-12 text-lg font-bold bg-white border-purple-300 shadow-sm" /></div>
                                    <div className="pt-2 border-t mt-4"><label className="block text-sm font-bold mb-1 text-slate-700">点検担当者</label><Input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} disabled={!canEdit} placeholder="名前を入力..." className="bg-white" /></div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="bg-amber-50/50 border-b pb-4"><CardTitle className="text-sm text-amber-900 font-bold">改善報告</CardTitle></CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div><label className="block text-xs font-bold mb-1 text-slate-700">〈改善を行った点〉</label><textarea value={improvementDone} onChange={(e) => setImprovementDone(e.target.value)} disabled={!canEdit} className="w-full p-2 border border-slate-200 rounded-md text-sm resize-none h-20 bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400" /></div>
                                    <div><label className="block text-xs font-bold mb-1 text-slate-700">〈計画的に改善すべき点〉</label><textarea value={improvementPlanned} onChange={(e) => setImprovementPlanned(e.target.value)} disabled={!canEdit} className="w-full p-2 border border-slate-200 rounded-md text-sm resize-none h-20 bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400" /></div>
                                    {canEdit ? (
                                        <Button onClick={handleSaveDaily} disabled={isSaving || loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 shadow-md mt-4">
                                            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                                            この日の記録を保存
                                        </Button>
                                    ) : (<div className="text-center text-sm font-bold text-slate-500 bg-slate-50 py-3 rounded-md border border-slate-200 mt-4"><Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため保存不可</div>)}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="w-full lg:w-2/3">
                            <Card className="shadow-sm border-slate-200 mb-6">
                                <CardHeader className="bg-slate-100 border-b py-3 px-4"><CardTitle className="text-base text-slate-700 font-black">１．毎日点検</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                    {loading ? <div className="flex justify-center items-center h-32"><Loader2 className="animate-spin h-6 w-6 text-purple-500" /></div> : (
                                        <div className="divide-y divide-slate-100">
                                            {MFG_DAILY_ITEMS.map((item, idx) => {
                                                const res = results[item.id]; const isOk = res === 'ok'; const isNg = res === 'ng';
                                                return (
                                                    <div key={item.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isNg ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                                        <div className="flex-1 flex gap-3"><div className="font-bold text-slate-400 w-4 shrink-0 pt-0.5">{idx + 1}.</div><h3 className="font-bold text-slate-800 text-sm leading-snug pt-0.5">{item.text}</h3></div>
                                                        <div className="shrink-0 flex sm:justify-end"><button onClick={() => toggleResult(item.id)} disabled={!canEdit} className={`w-full sm:w-28 h-10 rounded-xl flex items-center justify-center gap-2 font-black text-sm transition-all shadow-sm border-2 ${isOk ? 'bg-blue-500 border-blue-600 text-white' : isNg ? 'bg-red-500 border-red-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'}`}>{isOk && <><CheckCircle2 className="w-4 h-4" /> 〇</>}{isNg && <><XCircle className="w-4 h-4" /> ×</>}{!isOk && !isNg && <><MinusCircle className="w-4 h-4" /> -</>}</button></div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-slate-200 mb-6">
                                <CardHeader className="bg-slate-100 border-b py-3 px-4"><CardTitle className="text-base text-slate-700 font-black">２．１ヶ月ごとの点検</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-slate-100">
                                        {MFG_MONTHLY_ITEMS.map((item, idx) => {
                                            const res = results[item.id]; const isOk = res === 'ok'; const isNg = res === 'ng';
                                            return (
                                                <div key={item.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isNg ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                                    <div className="flex-1 flex gap-3"><div className="font-bold text-slate-400 w-4 shrink-0 pt-0.5">{idx + 1}.</div><h3 className="font-bold text-slate-800 text-sm leading-snug pt-0.5">{item.text}</h3></div>
                                                    <div className="shrink-0 flex sm:justify-end"><button onClick={() => toggleResult(item.id)} disabled={!canEdit} className={`w-full sm:w-28 h-10 rounded-xl flex items-center justify-center gap-2 font-black text-sm transition-all shadow-sm border-2 ${isOk ? 'bg-blue-500 border-blue-600 text-white' : isNg ? 'bg-red-500 border-red-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'}`}>{isOk && <><CheckCircle2 className="w-4 h-4" /> 〇</>}{isNg && <><XCircle className="w-4 h-4" /> ×</>}{!isOk && !isNg && <><MinusCircle className="w-4 h-4" /> -</>}</button></div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="bg-slate-100 border-b py-3 px-4"><CardTitle className="text-base text-slate-700 font-black">３．３ヶ月ごとの点検</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-slate-100">
                                        {MFG_QUARTERLY_ITEMS.map((item, idx) => {
                                            const res = results[item.id]; const isOk = res === 'ok'; const isNg = res === 'ng';
                                            return (
                                                <div key={item.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isNg ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                                    <div className="flex-1 flex gap-3"><div className="font-bold text-slate-400 w-4 shrink-0 pt-0.5">{idx + 1}.</div><h3 className="font-bold text-slate-800 text-sm leading-snug pt-0.5">{item.text}</h3></div>
                                                    <div className="shrink-0 flex sm:justify-end"><button onClick={() => toggleResult(item.id)} disabled={!canEdit} className={`w-full sm:w-28 h-10 rounded-xl flex items-center justify-center gap-2 font-black text-sm transition-all shadow-sm border-2 ${isOk ? 'bg-blue-500 border-blue-600 text-white' : isNg ? 'bg-red-500 border-red-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'}`}>{isOk && <><CheckCircle2 className="w-4 h-4" /> 〇</>}{isNg && <><XCircle className="w-4 h-4" /> ×</>}{!isOk && !isNg && <><MinusCircle className="w-4 h-4" /> -</>}</button></div>
                                                </div>
                                            )
                                        })}
                                    </div>
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
                                            <>
                                                {/* 毎日点検 */}
                                                <TableRow><TableCell colSpan={33} className="bg-slate-100 font-bold text-xs text-slate-700 border-b border-r py-1">１．毎日点検</TableCell></TableRow>
                                                {MFG_DAILY_ITEMS.map((item, idx) => (
                                                    <TableRow key={item.id} className="hover:bg-slate-50 border-b">
                                                        <TableCell className="border-r text-center text-xs text-slate-500 p-0.5">{idx + 1}</TableCell>
                                                        <TableCell className="border-r font-bold text-xs text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] truncate" title={item.text}>{item.text}</TableCell>
                                                        {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                            const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                            const res = monthlyData[dateStr]?.results?.[item.id];
                                                            return <TableCell key={day} className={`border-r text-center p-0 ${res === 'ng' ? 'bg-red-50' : ''}`}>{res === 'ok' && <span className="text-blue-600 font-bold text-[10px]">〇</span>}{res === 'ng' && <span className="text-red-600 font-black text-[10px]">×</span>}{!res && <span className="text-slate-200">-</span>}</TableCell>;
                                                        })}
                                                    </TableRow>
                                                ))}

                                                {/* 1ヶ月ごとの点検 */}
                                                <TableRow><TableCell colSpan={33} className="bg-slate-100 font-bold text-xs text-slate-700 border-b border-r py-1 mt-2">２．１ヶ月ごとの点検</TableCell></TableRow>
                                                {MFG_MONTHLY_ITEMS.map((item, idx) => (
                                                    <TableRow key={item.id} className="hover:bg-slate-50 border-b">
                                                        <TableCell className="border-r text-center text-xs text-slate-500 p-0.5">{idx + 1}</TableCell>
                                                        <TableCell className="border-r font-bold text-xs text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] truncate" title={item.text}>{item.text}</TableCell>
                                                        {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                            const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                            const res = monthlyData[dateStr]?.results?.[item.id];
                                                            return <TableCell key={day} className={`border-r text-center p-0 ${res === 'ng' ? 'bg-red-50' : ''}`}>{res === 'ok' && <span className="text-blue-600 font-bold text-[10px]">〇</span>}{res === 'ng' && <span className="text-red-600 font-black text-[10px]">×</span>}{!res && <span className="text-slate-200">-</span>}</TableCell>;
                                                        })}
                                                    </TableRow>
                                                ))}

                                                {/* 3ヶ月ごとの点検 */}
                                                <TableRow><TableCell colSpan={33} className="bg-slate-100 font-bold text-xs text-slate-700 border-b border-r py-1 mt-2">３．３ヶ月ごとの点検</TableCell></TableRow>
                                                {MFG_QUARTERLY_ITEMS.map((item, idx) => (
                                                    <TableRow key={item.id} className="hover:bg-slate-50 border-b">
                                                        <TableCell className="border-r text-center text-xs text-slate-500 p-0.5">{idx + 1}</TableCell>
                                                        <TableCell className="border-r font-bold text-xs text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] truncate" title={item.text}>{item.text}</TableCell>
                                                        {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                            const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                            const res = monthlyData[dateStr]?.results?.[item.id];
                                                            return <TableCell key={day} className={`border-r text-center p-0 ${res === 'ng' ? 'bg-red-50' : ''}`}>{res === 'ok' && <span className="text-blue-600 font-bold text-[10px]">〇</span>}{res === 'ng' && <span className="text-red-600 font-black text-[10px]">×</span>}{!res && <span className="text-slate-200">-</span>}</TableCell>;
                                                        })}
                                                    </TableRow>
                                                ))}

                                                {/* 担当者行 */}
                                                <TableRow className="bg-slate-50">
                                                    <TableCell className="border-r font-bold text-xs text-slate-600 text-right pr-4" colSpan={2}>担当者</TableCell>
                                                    {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                        const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                        const checker = monthlyData[dateStr]?.checker_name;
                                                        return <TableCell key={`checker-${day}`} className="border-r text-center p-0.5">{checker ? <div className="text-[8px] truncate max-w-[28px] mx-auto text-slate-700" title={checker}>{checker.slice(0, 2)}</div> : ""}</TableCell>;
                                                    })}
                                                </TableRow>
                                            </>
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