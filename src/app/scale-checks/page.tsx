"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Loader2, CalendarDays, Printer, ArrowLeft, Lock, Scale, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ScaleCheck = {
    check_date: string;
    check_time: string;
    status_a: 'ok' | 'ng' | null;
    status_b: 'ok' | 'ng' | null;
    status_c: 'ok' | 'ng' | null;
    d1_weight: number | ""; d1_diff: number | "";
    d2_weight: number | ""; d2_diff: number | "";
    d3_weight: number | ""; d3_diff: number | "";
    d4_weight: number | ""; d4_diff: number | "";
    d5_weight: number | ""; d5_diff: number | "";
    checker_name: string;
    notes: string;
};

const DEFAULT_STATE: ScaleCheck = {
    check_date: "", check_time: "",
    status_a: null, status_b: null, status_c: null,
    d1_weight: "", d1_diff: "", d2_weight: "", d2_diff: "",
    d3_weight: "", d3_diff: "", d4_weight: "", d4_diff: "",
    d5_weight: "", d5_diff: "",
    checker_name: "", notes: ""
};

export default function ScaleChecksPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'input' | 'monthly' | 'print'>('input');

    const [checkDate, setCheckDate] = useState("");
    const [formData, setFormData] = useState<ScaleCheck>(DEFAULT_STATE);
    const [isSaving, setIsSaving] = useState(false);

    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [monthlyData, setMonthlyData] = useState<Record<string, ScaleCheck>>({});

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
        const { data } = await supabase.from('scale_checks').select('*').eq('check_date', dateStr).maybeSingle();
        if (data) {
            setFormData({
                check_date: data.check_date, check_time: data.check_time || "",
                status_a: data.status_a, status_b: data.status_b, status_c: data.status_c,
                d1_weight: data.d1_weight ?? "", d1_diff: data.d1_diff ?? "",
                d2_weight: data.d2_weight ?? "", d2_diff: data.d2_diff ?? "",
                d3_weight: data.d3_weight ?? "", d3_diff: data.d3_diff ?? "",
                d4_weight: data.d4_weight ?? "", d4_diff: data.d4_diff ?? "",
                d5_weight: data.d5_weight ?? "", d5_diff: data.d5_diff ?? "",
                checker_name: data.checker_name || "", notes: data.notes || ""
            });
        } else {
            setFormData({ ...DEFAULT_STATE, check_date: dateStr });
        }
        setLoading(false);
    };

    const fetchMonthlyData = async (dateObj: Date) => {
        setLoading(true);
        const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const startDate = `${y}-${m}-01`;
        const endDate = new Date(y, dateObj.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data } = await supabase.from('scale_checks').select('*').gte('check_date', startDate).lte('check_date', endDate);
        if (data) {
            const dataMap: Record<string, ScaleCheck> = {};
            data.forEach(row => { dataMap[row.check_date] = row; });
            setMonthlyData(dataMap);
        }
        setLoading(false);
    };

    const handleUpdate = (field: keyof ScaleCheck, value: any) => {
        if (!canEdit) return;
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleStatus = (field: keyof ScaleCheck) => {
        if (!canEdit) return;
        setFormData(prev => {
            const current = prev[field];
            let next: any = 'ok';
            if (current === 'ok') next = 'ng';
            else if (current === 'ng') next = null;
            return { ...prev, [field]: next };
        });
    };

    const handleSaveDaily = async () => {
        if (!checkDate) return;
        setIsSaving(true);
        const payload = {
            check_date: checkDate,
            check_time: formData.check_time || null,
            status_a: formData.status_a,
            status_b: formData.status_b,
            status_c: formData.status_c,
            d1_weight: formData.d1_weight === "" ? null : formData.d1_weight, d1_diff: formData.d1_diff === "" ? null : formData.d1_diff,
            d2_weight: formData.d2_weight === "" ? null : formData.d2_weight, d2_diff: formData.d2_diff === "" ? null : formData.d2_diff,
            d3_weight: formData.d3_weight === "" ? null : formData.d3_weight, d3_diff: formData.d3_diff === "" ? null : formData.d3_diff,
            d4_weight: formData.d4_weight === "" ? null : formData.d4_weight, d4_diff: formData.d4_diff === "" ? null : formData.d4_diff,
            d5_weight: formData.d5_weight === "" ? null : formData.d5_weight, d5_diff: formData.d5_diff === "" ? null : formData.d5_diff,
            checker_name: formData.checker_name,
            notes: formData.notes,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('scale_checks').upsert(payload, { onConflict: 'check_date' });
        setIsSaving(false);
        if (error) alert("保存に失敗しました: " + error.message);
        else alert("電子はかり点検記録を保存しました！");
    };

    const renderOkNg = (val: any) => {
        if (val === 'ok') return '〇';
        if (val === 'ng') return '×';
        return '';
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー - PDFを完全に再現したレイアウト
    // =======================================================================
    if (viewMode === 'print') {
        const y = calendarMonth.getFullYear();
        const m = calendarMonth.getMonth() + 1;
        const daysInMonth = new Date(y, m, 0).getDate();
        const daysTop = Array.from({ length: 16 }, (_, i) => i + 1);
        const daysBottom = Array.from({ length: 15 }, (_, i) => i + 17); // 31日まで

        // テーブル生成用の共通コンポーネント
        const renderTable = (daysArr: number[], isTop: boolean) => (
            <table className="w-full border-collapse border-2 border-black text-[9px] table-fixed mb-0 bg-white">
                <thead>
                    <tr className="h-5">
                        {isTop ? (
                            <th colSpan={2} rowSpan={2} className="border border-black font-black text-2xl w-[11.5%] tracking-widest bg-white pb-1 text-center align-middle">計量</th>
                        ) : (
                            <th colSpan={2} rowSpan={2} className="border border-black bg-white w-[11.5%]"></th>
                        )}
                        {daysArr.map(day => {
                            if (day > daysInMonth) return <th key={`header-${day}`} className="border border-black bg-white w-[5.5%]"></th>;
                            const dateObj = new Date(y, m - 1, day);
                            const dow = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
                            const isSat = dateObj.getDay() === 6;
                            const isSun = dateObj.getDay() === 0;
                            const dowColor = isSat ? "text-blue-600" : isSun ? "text-red-600" : "text-black";
                            return (
                                <th key={`date-${day}`} className={`border border-black font-bold leading-tight py-0.5 border-t-[3px] border-t-black text-center ${dowColor}`}>
                                    {m}月{day}日<br />({dow})
                                </th>
                            );
                        })}
                    </tr>
                    <tr className="h-4">
                        {daysArr.map(day => {
                            if (day > daysInMonth) return <th key={`time-${day}`} className="border border-black bg-white"></th>;
                            const dStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const timeVal = monthlyData[dStr]?.check_time;
                            return (
                                <th key={`time-${day}`} className="border border-black font-medium text-[8px] text-center py-0">
                                    {timeVal ? timeVal : "："}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    <tr className="h-[18px]">
                        <th rowSpan={2} className="border border-black font-medium text-left px-1.5 w-[9%] text-[9px] leading-tight align-middle">設置状態の<br />確認</th>
                        <th className="border border-black text-center font-medium w-[2.5%] text-[9px] py-0">A</th>
                        {daysArr.map(d => d > daysInMonth ? <td key={`A-${d}`} className="border border-black bg-white"></td> : <td key={`A-${d}`} className="border border-black text-center font-bold text-xs">{renderOkNg(monthlyData[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`]?.status_a)}</td>)}
                    </tr>
                    <tr className="h-[18px]">
                        <th className="border border-black text-center font-medium text-[9px] py-0">B</th>
                        {daysArr.map(d => d > daysInMonth ? <td key={`B-${d}`} className="border border-black bg-white"></td> : <td key={`B-${d}`} className="border border-black text-center font-bold text-xs">{renderOkNg(monthlyData[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`]?.status_b)}</td>)}
                    </tr>
                    <tr className="h-[18px]">
                        <th className="border border-black font-medium text-left px-1.5 text-[9px] leading-tight align-middle">ゼロ点の確<br />認</th>
                        <th className="border border-black text-center font-medium text-[9px] py-0">C</th>
                        {daysArr.map(d => d > daysInMonth ? <td key={`C-${d}`} className="border border-black bg-white"></td> : <td key={`C-${d}`} className="border border-black text-center font-bold text-xs">{renderOkNg(monthlyData[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`]?.status_c)}</td>)}
                    </tr>

                    <tr className="h-[18px]">
                        {/* 左側の「重量表示の確認」とデジタル表示の図 */}
                        <th rowSpan={10} className="border border-black bg-white p-1 text-center align-middle">
                            <div className="flex flex-col items-center justify-between h-full py-1 box-border">
                                <div className="w-full text-center">
                                    <div className="text-[9px] font-bold leading-tight tracking-wider">重量表示の</div>
                                    <div className="text-[9px] font-bold leading-tight tracking-wider">確認</div>
                                    <div className="text-[7px] font-bold mt-1 text-slate-600 scale-[0.9] leading-none">※5点測定箇所</div>
                                </div>
                                <div className="w-[58px] h-[34px] border border-black relative bg-white shrink-0 mt-2">
                                    <div className="absolute top-0 left-0 bg-white border-b border-r border-black text-[5px] font-bold px-0.5 py-0.2 z-10 leading-none scale-[0.8] origin-top-left">デジタル表示</div>
                                    <div className="absolute top-[13px] left-[2.5px] text-[7px] font-bold w-2.5 h-2.5 rounded-full border border-black flex items-center justify-center bg-white leading-none">1</div>
                                    <div className="absolute top-[13px] left-1/2 -translate-x-1/2 text-[7px] font-bold w-2.5 h-2.5 rounded-full border border-black flex items-center justify-center bg-white leading-none">3</div>
                                    <div className="absolute top-[13px] right-[2.5px] text-[7px] font-bold w-2.5 h-2.5 rounded-full border border-black flex items-center justify-center bg-white leading-none">2</div>
                                    <div className="absolute bottom-[2px] left-[2.5px] text-[7px] font-bold w-2.5 h-2.5 rounded-full border border-black flex items-center justify-center bg-white leading-none">4</div>
                                    <div className="absolute bottom-[2px] right-[2.5px] text-[7px] font-bold w-2.5 h-2.5 rounded-full border border-black flex items-center justify-center bg-white leading-none">5</div>
                                </div>
                            </div>
                        </th>
                        <th className="border border-black font-bold px-1 text-[9px] py-0">D①</th>
                        {daysArr.map(d => {
                            if (d > daysInMonth) return <td key={`D1-${d}`} className="border border-black bg-white"></td>;
                            const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            return <td key={`D1-${d}`} className="border border-black text-center font-bold text-[10px]">{monthlyData[dStr]?.d1_weight || ""}</td>;
                        })}
                    </tr>
                    <tr className="h-[18px]">
                        <th className="border border-black font-medium px-1 text-[8px] py-0" style={{ borderBottomStyle: 'dashed', borderBottomWidth: '1px' }}>(差)</th>
                        {daysArr.map(d => {
                            if (d > daysInMonth) return <td key={`Diff1-${d}`} className="border border-black bg-white" style={{ borderBottomStyle: 'dashed', borderBottomWidth: '1px' }}></td>;
                            const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            return <td key={`Diff1-${d}`} className="border border-black text-center text-[9px]" style={{ borderBottomStyle: 'dashed', borderBottomWidth: '1px' }}>{monthlyData[dStr]?.d1_diff || ""}</td>;
                        })}
                    </tr>

                    {[2, 3, 4, 5].map((num) => {
                        const isLast = num === 5;
                        const borderBottomStyle = isLast ? {} : { borderBottomStyle: 'dashed' as const, borderBottomWidth: '1px' };
                        return (
                            <React.Fragment key={`group-${num}`}>
                                <tr className="h-[18px]">
                                    <th className="border border-black font-bold px-1 text-[9px] py-0">D{num}</th>
                                    {daysArr.map(d => {
                                        if (d > daysInMonth) return <td key={`D${num}-${d}`} className="border border-black bg-white"></td>;
                                        const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        return <td key={`D${num}-${d}`} className="border border-black text-center font-bold text-[10px]">{monthlyData[dStr]?.[`d${num}_weight` as keyof ScaleCheck] || ""}</td>;
                                    })}
                                </tr>
                                <tr className="h-[18px]">
                                    <th className="border border-black font-medium px-1 text-[8px] py-0" style={borderBottomStyle}>(差)</th>
                                    {daysArr.map(d => {
                                        if (d > daysInMonth) return <td key={`Diff${num}-${d}`} className="border border-black bg-white" style={borderBottomStyle}></td>;
                                        const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        return <td key={`Diff${num}-${d}`} className="border border-black text-center text-[9px]" style={borderBottomStyle}>{monthlyData[dStr]?.[`d${num}_diff` as keyof ScaleCheck] || ""}</td>;
                                    })}
                                </tr>
                            </React.Fragment>
                        );
                    })}

                    <tr className="h-6">
                        <th className="border border-black text-center font-bold text-[9px] py-0" colSpan={2}>確認者</th>
                        {daysArr.map(d => {
                            if (d > daysInMonth) return <td key={`chk-${d}`} className="border border-black bg-white"></td>;
                            const checker = monthlyData[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`]?.checker_name;
                            return <td key={`chk-${d}`} className="border border-black text-center p-0.5">{checker ? <div className="text-[9px] truncate max-w-[24px] mx-auto font-bold">{checker.slice(0, 2)}</div> : ""}</td>;
                        })}
                    </tr>
                </tbody>
            </table>
        );

        return (
            <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        header, nav { display: none !important; }
                        main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
                        /* A4横 (Landscape)で余白を調整 */
                        @page { size: A4 landscape; margin: 6mm 10mm; }
                        body { background-color: white !important; color: black !important; }
                        .print-hide { display: none !important; }
                    }
                `}} />

                <div className="w-[297mm] print:w-full flex justify-between mb-4 print-hide">
                    <Button variant="outline" onClick={() => setViewMode('monthly')} className="bg-white text-slate-700 font-bold border-slate-300">
                        <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
                    </Button>
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
                        <Printer className="h-5 w-5 mr-2" /> 印刷する (PDF)
                    </Button>
                </div>

                <div className="w-[297mm] h-[210mm] bg-white py-4 px-8 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between overflow-hidden">

                    <div className="flex justify-between items-end mb-1 shrink-0 relative">
                        <div className="flex flex-col relative z-10 pb-1">
                            <h1 className="text-3xl font-black tracking-widest leading-none">電子はかり 日常点検データシート</h1>
                        </div>

                        <table className="border-collapse border-2 border-black text-[9px] text-center leading-tight w-[280px]">
                            <tbody>
                                <tr className="h-5">
                                    <td className="border border-black font-bold text-left px-2 py-0.5" colSpan={2}>ワークセンター・やまびこ</td>
                                    <th className="border border-black font-medium w-[60px] py-0.5 bg-slate-50">施設長</th>
                                    <th className="border border-black font-medium w-[60px] py-0.5 bg-slate-50">担当</th>
                                </tr>
                                <tr className="h-5">
                                    <th className="border border-black font-medium w-[60px] py-0.5 bg-slate-50">文書No.</th>
                                    <td className="border border-black font-bold w-[100px] py-0.5 bg-white">YO-15</td>
                                    <td className="border border-black bg-white" rowSpan={3}></td>
                                    <td className="border border-black bg-white" rowSpan={3}></td>
                                </tr>
                                <tr className="h-5">
                                    <th className="border border-black font-medium py-0.5 bg-slate-50">制定日</th>
                                    <td className="border border-black font-bold py-0.5 bg-white">2021/4/1</td>
                                </tr>
                                <tr className="h-5">
                                    <th className="border border-black font-medium py-0.5 bg-slate-50">改定日</th>
                                    <td className="border border-black font-bold py-0.5 bg-white"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="flex-1 flex flex-col justify-between mt-1 gap-2">
                        <div>
                            <div className="text-[10px] font-bold pl-1 mb-0.5 text-left">{y}年</div>
                            {renderTable(daysTop, true)}
                        </div>
                        <div className="mt-1">
                            {renderTable(daysBottom, false)}
                        </div>
                    </div>

                    <div className="flex justify-between items-start text-[9px] font-bold mt-2 px-1 leading-normal shrink-0 border-t border-transparent pt-1">
                        <div className="space-y-0.5 text-left">
                            <div>※A：水平が取れている事。(水準器で確認)</div>
                            <div>※B：汚れ・異物付着の無き事。(目視で確認)</div>
                            <div>※C：ゼロ点設定後、分銅を3回測定し表示がゼロ(0g)へ戻る事。</div>
                            <div>※D：100gの標準分銅を載せて誤差±0.2g以内である事。(5点で確認)</div>
                        </div>
                        <div className="text-right align-top pt-0.5">
                            ※破損等の異常発見時は上長に報告し指示を仰ぐ事。
                        </div>
                    </div>

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
                        <Scale className="h-6 w-6 text-teal-600" />
                        電子はかり 日常点検シート (YO-15)
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
                    <TabsTrigger value="input" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">日次チェック (現場入力用)</TabsTrigger>
                    <TabsTrigger value="monthly" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">月間一覧 (管理者・監査用)</TabsTrigger>
                </TabsList>

                <TabsContent value="input">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-1/3 space-y-6">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="bg-teal-50/50 border-b pb-4">
                                    <CardTitle className="text-lg text-teal-900 flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-teal-600" />点検日の選択
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div><label className="block text-sm font-bold mb-1 text-slate-700">対象日付</label><Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="h-12 text-lg font-bold bg-white border-teal-300 shadow-sm" /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-bold mb-1 text-slate-700">点検時間</label><Input type="time" value={formData.check_time} onChange={(e) => handleUpdate('check_time', e.target.value)} className="h-12 text-lg font-bold bg-white" /></div>
                                        <div><label className="block text-sm font-bold mb-1 text-slate-700">担当者</label><Input value={formData.checker_name} onChange={(e) => handleUpdate('checker_name', e.target.value)} disabled={!canEdit} className="h-12 font-bold bg-white" placeholder="サイン..." /></div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="bg-slate-100 border-b py-3"><CardTitle className="text-base font-bold text-slate-700">基本状態の確認</CardTitle></CardHeader>
                                <CardContent className="p-0 divide-y divide-slate-100">
                                    {[
                                        { id: 'status_a', label: 'A: 水平が取れている事', sub: '水準器で確認' },
                                        { id: 'status_b', label: 'B: 汚れ・異物付着の無き事', sub: '目視で確認' },
                                        { id: 'status_c', label: 'C: ゼロ点の設定', sub: '分銅を3回測定し0gに戻る事' },
                                    ].map(item => {
                                        const val = formData[item.id as keyof ScaleCheck];
                                        const isOk = val === 'ok'; const isNg = val === 'ng';
                                        return (
                                            <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div><div className="font-bold text-slate-800">{item.label}</div><div className="text-xs text-slate-500">{item.sub}</div></div>
                                                <button onClick={() => toggleStatus(item.id as keyof ScaleCheck)} disabled={!canEdit} className={`w-full sm:w-32 h-12 rounded-xl flex items-center justify-center gap-2 font-black transition-all shadow-sm border-2 ${isOk ? 'bg-teal-500 border-teal-600 text-white' : isNg ? 'bg-red-500 border-red-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'}`}>{isOk && <><CheckCircle2 className="w-5 h-5" /> 良</>}{isNg && <><XCircle className="w-5 h-5" /> 不良</>}{!isOk && !isNg && <><MinusCircle className="w-5 h-5" /> -</>}</button>
                                            </div>
                                        )
                                    })}
                                </CardContent>
                            </Card>

                            {canEdit ? (
                                <Button onClick={handleSaveDaily} disabled={isSaving || loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold h-14 text-lg shadow-md">
                                    {isSaving ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <Save className="w-6 h-6 mr-2" />} この日の記録を保存
                                </Button>
                            ) : (<div className="text-center text-sm font-bold text-slate-500 bg-slate-50 py-4 rounded-md border border-slate-200"><Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため保存不可</div>)}
                        </div>

                        <div className="w-full lg:w-2/3">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="bg-white border-b pb-4">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <CardTitle className="text-lg text-slate-800">D: 重量表示の確認</CardTitle>
                                            <p className="text-xs text-slate-500 mt-1 font-bold">100gの標準分銅を載せて誤差±0.2g以内である事。(5点で確認)</p>
                                        </div>
                                        <div className="w-24 h-20 border-2 border-slate-300 rounded-lg relative bg-slate-50 shadow-inner shrink-0">
                                            <div className="absolute top-0 left-0 bg-white border-b border-r border-slate-300 text-[8px] px-1 font-bold text-slate-500 rounded-tl-md">デジタル表示</div>
                                            <div className="absolute top-5 left-2 w-4 h-4 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-black shadow-sm">1</div>
                                            <div className="absolute top-5 right-2 w-4 h-4 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-black shadow-sm">2</div>
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-black shadow-sm">3</div>
                                            <div className="absolute bottom-2 left-2 w-4 h-4 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-black shadow-sm">4</div>
                                            <div className="absolute bottom-2 right-2 w-4 h-4 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-black shadow-sm">5</div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {loading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-teal-500" /></div> : (
                                        <Table className="w-full text-sm">
                                            <TableHeader className="bg-slate-100">
                                                <TableRow>
                                                    <TableHead className="w-20 text-center font-bold">測定箇所</TableHead>
                                                    <TableHead className="w-1/2 text-center font-bold">重量表示 (g)</TableHead>
                                                    <TableHead className="w-1/2 text-center font-bold">差 (g) ※自動</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="bg-white">
                                                {[1, 2, 3, 4, 5].map(num => {
                                                    const wField = `d${num}_weight` as keyof ScaleCheck;
                                                    const dField = `d${num}_diff` as keyof ScaleCheck;
                                                    const wVal = formData[wField];
                                                    const dVal = formData[dField];

                                                    // ±0.2gの判定
                                                    const isWarning = typeof dVal === 'number' && Math.abs(dVal) > 0.2;

                                                    return (
                                                        <TableRow key={num} className="h-16">
                                                            <TableCell className="text-center">
                                                                <div className="w-8 h-8 mx-auto bg-teal-100 text-teal-800 rounded-full flex items-center justify-center font-black text-lg shadow-sm border border-teal-200">
                                                                    {num}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="px-6">
                                                                <Input
                                                                    type="number" step="0.1"
                                                                    value={wVal as any}
                                                                    onChange={e => {
                                                                        const val = e.target.value === "" ? "" : Number(e.target.value);
                                                                        handleUpdate(wField, val);
                                                                        if (val !== "") {
                                                                            // 差を自動計算 (100g基準)
                                                                            handleUpdate(dField, Number((val - 100).toFixed(2)));
                                                                        } else {
                                                                            handleUpdate(dField, "");
                                                                        }
                                                                    }}
                                                                    disabled={!canEdit}
                                                                    className="h-12 text-xl font-bold text-center border-teal-300 shadow-sm focus-visible:ring-teal-500"
                                                                    placeholder="100.0"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="px-6">
                                                                <Input
                                                                    type="number" step="0.1"
                                                                    value={dVal as any}
                                                                    onChange={e => handleUpdate(dField, e.target.value === "" ? "" : Number(e.target.value))}
                                                                    disabled={!canEdit}
                                                                    className={`h-12 text-xl font-bold text-center shadow-sm ${isWarning ? 'bg-red-50 text-red-600 border-red-400' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                                                />
                                                                {isWarning && <p className="text-[10px] text-red-600 font-bold text-center mt-1">※±0.2gの誤差を超えています</p>}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
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
                                <Table className="w-full table-fixed min-w-[1200px] border-collapse text-xs">
                                    <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-32 border-r font-bold text-slate-700 bg-slate-100 sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">点検項目</TableHead>
                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => (
                                                <TableHead key={day} className="w-8 text-center border-r p-0.5 font-bold text-slate-600">{day}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? <TableRow><TableCell colSpan={32} className="h-64 text-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></TableCell></TableRow> : (
                                            <>
                                                {['A (水平)', 'B (汚れ)', 'C (ゼロ点)'].map((label, idx) => {
                                                    const field = idx === 0 ? 'status_a' : idx === 1 ? 'status_b' : 'status_c';
                                                    return (
                                                        <TableRow key={label} className="hover:bg-slate-50 border-b">
                                                            <TableCell className="border-r font-bold text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">{label}</TableCell>
                                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                                const dStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                                const res = monthlyData[dStr]?.[field as keyof ScaleCheck];
                                                                return <TableCell key={day} className={`border-r text-center p-0 ${res === 'ng' ? 'bg-red-50 text-red-600 font-black' : res === 'ok' ? 'text-teal-600 font-bold' : 'text-slate-200'}`}>{renderOkNg(res) || "-"}</TableCell>;
                                                            })}
                                                        </TableRow>
                                                    );
                                                })}
                                                {[1, 2, 3, 4, 5].map(num => (
                                                    <TableRow key={`w-${num}`} className="hover:bg-slate-50 border-b">
                                                        <TableCell className="border-r font-bold text-slate-600 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">D{num} (重量)</TableCell>
                                                        {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                            const dStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                            const w = monthlyData[dStr]?.[`d${num}_weight` as keyof ScaleCheck];
                                                            return <TableCell key={day} className="border-r text-center p-0 text-[10px] font-mono">{w || ""}</TableCell>;
                                                        })}
                                                    </TableRow>
                                                ))}
                                                <TableRow className="bg-slate-50">
                                                    <TableCell className="border-r font-bold text-slate-600 sticky left-0 z-10">担当者</TableCell>
                                                    {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                                        const dStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                        const checker = monthlyData[dStr]?.checker_name;
                                                        return <TableCell key={`checker-${day}`} className="border-r text-center p-0.5">{checker ? <div className="text-[8px] truncate max-w-[28px] mx-auto text-slate-700">{checker.slice(0, 2)}</div> : ""}</TableCell>;
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