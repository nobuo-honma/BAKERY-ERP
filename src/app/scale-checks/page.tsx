"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Loader2, CalendarDays, Printer, ArrowLeft, Lock, Scale, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ScaleCheckField =
  | 'check_date' | 'check_time'
  | 'status_a' | 'status_b' | 'status_c'
  | 'd1_weight' | 'd1_diff' | 'd2_weight' | 'd2_diff'
  | 'd3_weight' | 'd3_diff' | 'd4_weight' | 'd4_diff'
  | 'd5_weight' | 'd5_diff'
  | 'checker_name' | 'notes';

type ScaleCheck = Record<ScaleCheckField, string | number | null> & {
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
type ScaleCheckViewMode = 'input' | 'monthly' | 'print';
type ScaleCheckRow = ScaleCheck & {
  check_time?: string | null;
  status_a?: 'ok' | 'ng' | null;
  status_b?: 'ok' | 'ng' | null;
  status_c?: 'ok' | 'ng' | null;
  d1_weight?: number | null;
  d1_diff?: number | null;
  d2_weight?: number | null;
  d2_diff?: number | null;
  d3_weight?: number | null;
  d3_diff?: number | null;
  d4_weight?: number | null;
  d4_diff?: number | null;
  d5_weight?: number | null;
  d5_diff?: number | null;
  checker_name?: string | null;
  notes?: string | null;
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
  const [viewMode, setViewMode] = useState<ScaleCheckViewMode>('input');

  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState<ScaleCheck>(DEFAULT_STATE);
  const [isSaving, setIsSaving] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState<Record<string, ScaleCheck>>({});

  const fetchDailyData = useCallback(async (dateStr: string) => {
    setLoading(true);
    const { data } = await supabase.from('scale_checks').select('*').eq('check_date', dateStr).maybeSingle();
    const row = data as ScaleCheckRow | null;
    if (row) {
      setFormData({
        check_date: row.check_date, check_time: row.check_time || "",
        status_a: row.status_a ?? null, status_b: row.status_b ?? null, status_c: row.status_c ?? null,
        d1_weight: row.d1_weight ?? "", d1_diff: row.d1_diff ?? "",
        d2_weight: row.d2_weight ?? "", d2_diff: row.d2_diff ?? "",
        d3_weight: row.d3_weight ?? "", d3_diff: row.d3_diff ?? "",
        d4_weight: row.d4_weight ?? "", d4_diff: row.d4_diff ?? "",
        d5_weight: row.d5_weight ?? "", d5_diff: row.d5_diff ?? "",
        checker_name: row.checker_name || "", notes: row.notes || ""
      });
    } else {
      setFormData({ ...DEFAULT_STATE, check_date: dateStr });
    }
    setLoading(false);
  }, []);

  const fetchMonthlyData = useCallback(async (dateObj: Date) => {
    setLoading(true);
    const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const startDate = `${y}-${m}-01`;
    const endDate = new Date(y, dateObj.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data } = await supabase.from('scale_checks').select('*').gte('check_date', startDate).lte('check_date', endDate);
    const rows = (data as ScaleCheckRow[] | null) ?? [];
    if (rows.length > 0) {
      const dataMap: Record<string, ScaleCheck> = {};
      rows.forEach(row => { dataMap[row.check_date] = {
        check_date: row.check_date,
        check_time: row.check_time || "",
        status_a: row.status_a ?? null,
        status_b: row.status_b ?? null,
        status_c: row.status_c ?? null,
        d1_weight: row.d1_weight ?? "",
        d1_diff: row.d1_diff ?? "",
        d2_weight: row.d2_weight ?? "",
        d2_diff: row.d2_diff ?? "",
        d3_weight: row.d3_weight ?? "",
        d3_diff: row.d3_diff ?? "",
        d4_weight: row.d4_weight ?? "",
        d4_diff: row.d4_diff ?? "",
        d5_weight: row.d5_weight ?? "",
        d5_diff: row.d5_diff ?? "",
        checker_name: row.checker_name || "",
        notes: row.notes || ""
      }; });
      setMonthlyData(dataMap);
    } else {
      setMonthlyData({});
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

  const handleUpdate = (field: ScaleCheckField, value: number | string | null) => {
    if (!canEdit) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleStatus = (field: 'status_a' | 'status_b' | 'status_c') => {
    if (!canEdit) return;
    setFormData(prev => {
      const current = prev[field];
      let next: 'ok' | 'ng' | null = 'ok';
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

  const renderOkNg = (val: 'ok' | 'ng' | null | undefined) => {
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
      <table className="w-full border-collapse border-2 border-black text-[10px] table-fixed mb-0 bg-white">
        <thead>
          <tr className="h-6">
            {isTop ? (
              <th colSpan={2} rowSpan={2} className="border border-black font-black text-3xl w-[10%] tracking-widest bg-white pb-2">計量</th>
            ) : (
              <th colSpan={2} rowSpan={2} className="border border-black bg-white w-[10%]"></th>
            )}
            {daysArr.map(day => {
              if (day > daysInMonth) return <th key={`header-${day}`} className="border border-black bg-white w-[5.6%]"></th>;
              const dateObj = new Date(y, m - 1, day);
              const dow = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
              return (
                <th key={`date-${day}`} className="border border-black font-bold leading-tight py-0.5 border-t-[3px]">
                  {m}月{day}日<br />({dow})
                </th>
              );
            })}
          </tr>
          <tr className="h-4">
            {daysArr.map(day => {
              if (day > daysInMonth) return <th key={`time-${day}`} className="border border-black bg-white"></th>;
              const dStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              return <th key={`time-${day}`} className="border border-black font-medium text-[9px]">：{monthlyData[dStr]?.check_time || "　"}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="h-[22px]">
            <th className="border border-black font-medium text-left px-1 w-[8%] text-xs">設置状態の<br />確認</th>
            <th className="border border-black text-center font-medium w-[2%]">A</th>
            {daysArr.map(d => d > daysInMonth ? <td key={`A-${d}`} className="border border-black bg-white"></td> : <td key={`A-${d}`} className="border border-black text-center font-bold text-xs">{renderOkNg(monthlyData[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`]?.status_a)}</td>)}
          </tr>
          <tr className="h-[22px]">
            <th className="border border-black font-medium text-center"></th>
            <th className="border border-black text-center font-medium">B</th>
            {daysArr.map(d => d > daysInMonth ? <td key={`B-${d}`} className="border border-black bg-white"></td> : <td key={`B-${d}`} className="border border-black text-center font-bold text-xs">{renderOkNg(monthlyData[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`]?.status_b)}</td>)}
          </tr>
          <tr className="h-[22px]">
            <th className="border border-black font-medium text-left px-1 text-xs">ゼロ点の確<br />認</th>
            <th className="border border-black text-center font-medium">C</th>
            {daysArr.map(d => d > daysInMonth ? <td key={`C-${d}`} className="border border-black bg-white"></td> : <td key={`C-${d}`} className="border border-black text-center font-bold text-xs">{renderOkNg(monthlyData[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`]?.status_c)}</td>)}
          </tr>

          <tr className="h-[22px]">
            {/* 左側の「重量表示の確認」とデジタル表示の図 */}
            <th rowSpan={10} className="border border-black bg-white p-0 relative align-top overflow-hidden">
              <div className="text-[10px] font-bold w-full text-left pl-1 pt-1 leading-tight tracking-wider">重量表示の<br />確認</div>
              <div className="mt-4 text-[8px] font-bold w-full text-left pl-1">※5点測定箇<br />所</div>
              {/* ▼ 修正: border-[2px] -> border-2, border-b-[2px] -> border-b-2, border-r-[2px] -> border-r-2 */}
              <div className="mx-auto mt-1 w-[70px] h-[45px] border-2 border-black relative bg-white shrink-0">
                <div className="absolute top-0 left-0 bg-white border-b-2 border-r-2 border-black text-[7px] font-bold px-1 py-0.5 z-10">デジタル表示</div>
                <div className="absolute top-5 left-1 text-[10px] font-bold w-4 h-4 rounded-full border border-black flex items-center justify-center bg-white">1</div>
                <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold w-4 h-4 rounded-full border border-black flex items-center justify-center bg-white">3</div>
                <div className="absolute top-5 right-1 text-[10px] font-bold w-4 h-4 rounded-full border border-black flex items-center justify-center bg-white">2</div>
                <div className="absolute bottom-1 left-1 text-[10px] font-bold w-4 h-4 rounded-full border border-black flex items-center justify-center bg-white">4</div>
                <div className="absolute bottom-1 right-1 text-[10px] font-bold w-4 h-4 rounded-full border border-black flex items-center justify-center bg-white">5</div>
              </div>
            </th>
            <th className="border border-black font-bold px-1 text-xs">D①</th>
            {daysArr.map(d => {
              if (d > daysInMonth) return <td key={`D1-${d}`} className="border border-black bg-white"></td>;
              const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              return <td key={`D1-${d}`} className="border border-black text-center font-bold text-xs">{monthlyData[dStr]?.d1_weight || ""}</td>;
            })}
          </tr>
          <tr className="h-[22px]">
            <th className="border border-black font-medium px-1 text-[9px]">(差)</th>
            {daysArr.map(d => {
              if (d > daysInMonth) return <td key={`Diff1-${d}`} className="border border-black bg-white"></td>;
              const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              return <td key={`Diff1-${d}`} className="border border-black text-center text-[10px]">{monthlyData[dStr]?.d1_diff || ""}</td>;
            })}
          </tr>

          {[2, 3, 4, 5].map((num) => (
            <React.Fragment key={`group-${num}`}>
              <tr className="h-[22px]">
                <th className="border border-black font-bold px-1 text-xs">D{num}</th>
                {daysArr.map(d => {
                  if (d > daysInMonth) return <td key={`D${num}-${d}`} className="border border-black bg-white"></td>;
                  const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  return <td key={`D${num}-${d}`} className="border border-black text-center font-bold text-xs">{monthlyData[dStr]?.[`d${num}_weight` as keyof ScaleCheck] || ""}</td>;
                })}
              </tr>
              <tr className="h-[22px]">
                <th className="border border-black font-medium px-1 text-[9px]">(差)</th>
                {daysArr.map(d => {
                  if (d > daysInMonth) return <td key={`Diff${num}-${d}`} className="border border-black bg-white"></td>;
                  const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  return <td key={`Diff${num}-${d}`} className="border border-black text-center text-[10px]">{monthlyData[dStr]?.[`d${num}_diff` as keyof ScaleCheck] || ""}</td>;
                })}
              </tr>
            </React.Fragment>
          ))}

          <tr className="h-6">
            <th className="border border-black text-center font-bold" colSpan={2}>確認者</th>
            {daysArr.map(d => {
              if (d > daysInMonth) return <td key={`chk-${d}`} className="border border-black bg-white"></td>;
              const checker = monthlyData[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`]?.checker_name;
              return <td key={`chk-${d}`} className="border border-black text-center p-0">{checker ? <div className="text-[10px] truncate max-w-[24px] mx-auto font-bold">{checker.slice(0, 2)}</div> : ""}</td>;
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
                        @page { size: A4 landscape; margin: 8mm 12mm; }
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

        <div className="w-[297mm] h-[210mm] bg-white py-6 px-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between overflow-hidden">

          <div className="flex justify-between items-end mb-2 shrink-0 relative">
            <div className="flex items-end gap-2 relative z-10 top-2">
              <h1 className="text-3xl font-black tracking-widest leading-none">電子はかり 日常点検データシート</h1>
            </div>
            <div className="absolute bottom-0 left-0 text-lg font-black tracking-widest mt-2">{y} <span className="text-sm font-bold">年</span></div>

            {/* ▼ 修正: border-[3px] -> border-2 に */}
            <table className="border-collapse border-2 border-black text-[12px] text-center leading-none w-[280px]">
              <tbody>
                <tr className="h-6">
                  <th className="border border-black font-medium w-24">文章No.</th>
                  <td className="border border-black font-bold w-24">YO-15</td>
                  <th className="border border-black font-medium w-20">施設長</th>
                  <th className="border border-black font-medium w-20">担当者</th>
                </tr>
                <tr className="h-6">
                  <th className="border border-black font-medium">制定日</th>
                  <td className="border border-black font-bold">2021/4/1</td>
                  <td className="border border-black h-[70px]" rowSpan={3}></td>
                  <td className="border border-black h-[70px]" rowSpan={3}></td>
                </tr>
                <tr className="h-6">
                  <th className="border border-black font-medium">改定日</th>
                  <td className="border border-black font-bold"></td>
                </tr>
                <tr>
                  <td className="border border-black font-medium py-1 text-[10px]" colSpan={2}>ワークセンター・やまびこ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex-1 flex flex-col justify-between mt-2 gap-4">
            {renderTable(daysTop, true)}
            {renderTable(daysBottom, false)}
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

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ScaleCheckViewMode)} className="w-full">
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
                    { id: 'status_a' as const, label: 'A: 水平が取れている事', sub: '水準器で確認' },
                    { id: 'status_b' as const, label: 'B: 汚れ・異物付着の無き事', sub: '目視で確認' },
                    { id: 'status_c' as const, label: 'C: ゼロ点の設定', sub: '分銅を3回測定し0gに戻る事' },
                  ].map(item => {
                    const val = formData[item.id];
                    const isOk = val === 'ok'; const isNg = val === 'ng';
                    return (
                      <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div><div className="font-bold text-slate-800">{item.label}</div><div className="text-xs text-slate-500">{item.sub}</div></div>
                        <button onClick={() => toggleStatus(item.id)} disabled={!canEdit} className={`w-full sm:w-32 h-12 rounded-xl flex items-center justify-center gap-2 font-black transition-all shadow-sm border-2 ${isOk ? 'bg-teal-500 border-teal-600 text-white' : isNg ? 'bg-red-500 border-red-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'}`}>{isOk && <><CheckCircle2 className="w-5 h-5" /> 良</>}{isNg && <><XCircle className="w-5 h-5" /> 不良</>}{!isOk && !isNg && <><MinusCircle className="w-5 h-5" /> -</>}</button>
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
                          const wField = `d${num}_weight` as 'd1_weight' | 'd2_weight' | 'd3_weight' | 'd4_weight' | 'd5_weight';
                          const dField = `d${num}_diff` as 'd1_diff' | 'd2_diff' | 'd3_diff' | 'd4_diff' | 'd5_diff';
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
                                  value={wVal ?? ""}
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
                                  value={dVal ?? ""}
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
                                return <TableCell key={day} className={`border-r text-center p-0 ${res === 'ng' ? 'bg-red-50 text-red-600 font-black' : res === 'ok' ? 'text-teal-600 font-bold' : 'text-slate-200'}`}>{renderOkNg(res as 'ok' | 'ng' | null | undefined) || "-"}</TableCell>;
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