"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Loader2, CalendarDays, Printer, ArrowLeft, Lock, Users, Trash2, Edit2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import HaccpPrintHeader from "@/components/HaccpPrintHeader";

type VisitorLog = {
    id: string;
    visit_date: string;
    entry_time: string;
    exit_time: string;
    visitor_name: string;
    headcount: number | "";
    attendant_name: string;
    fever: '有' | '無' | null;
    nausea: '有' | '無' | null;
    diarrhea: '有' | '無' | null;
    nails_checked: '良' | '不良' | null;
    accessories: string;
    notes: string;
};

// 印刷用データの型（空行のフラグを許容する）
type PrintRow = VisitorLog | { id: string; isEmpty: true };

const DEFAULT_STATE: Partial<VisitorLog> = {
    visit_date: "", entry_time: "", exit_time: "", visitor_name: "", headcount: 1, attendant_name: "",
    fever: "無", nausea: "無", diarrhea: "無", nails_checked: "良", accessories: "無し", notes: ""
};

export default function VisitorLogsPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'monthly' | 'print'>('list');

    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [monthlyLogs, setMonthlyLogs] = useState<VisitorLog[]>([]);

    // 入力・編集用
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<VisitorLog>>(DEFAULT_STATE);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (viewMode === 'list' || viewMode === 'monthly' || viewMode === 'print') {
            fetchMonthlyData(calendarMonth);
        }
    }, [calendarMonth, viewMode]);

    const fetchMonthlyData = async (dateObj: Date) => {
        setLoading(true);
        const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const startDate = `${y}-${m}-01`;
        const endDate = new Date(y, dateObj.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data } = await supabase.from('visitor_logs').select('*')
            .gte('visit_date', startDate).lte('visit_date', endDate)
            .order('visit_date', { ascending: true })
            .order('entry_time', { ascending: true });

        if (data) setMonthlyLogs(data as VisitorLog[]);
        setLoading(false);
    };

    const openModal = (log?: VisitorLog) => {
        if (log) {
            setFormData(log);
        } else {
            const today = new Date().toISOString().split('T')[0];
            setFormData({ ...DEFAULT_STATE, visit_date: today });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.visit_date || !formData.visitor_name) {
            alert("日付と来場者名は必須です。"); return;
        }
        setIsSaving(true);

        const payload = {
            ...formData,
            headcount: formData.headcount === "" ? null : formData.headcount,
            updated_at: new Date().toISOString()
        };

        let error;
        if (formData.id) {
            const res = await supabase.from('visitor_logs').update(payload).eq('id', formData.id);
            error = res.error;
        } else {
            const res = await supabase.from('visitor_logs').insert([payload]);
            error = res.error;
        }

        setIsSaving(false);
        if (error) {
            alert("保存に失敗しました: " + error.message);
        } else {
            alert("来場者記録を保存しました！");
            setIsModalOpen(false);
            fetchMonthlyData(calendarMonth);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("この来場者記録を削除しますか？")) return;
        setLoading(true);
        await supabase.from('visitor_logs').delete().eq('id', id);
        fetchMonthlyData(calendarMonth);
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー - YO-42 完全再現
    // =======================================================================
    if (viewMode === 'print') {
        const y = calendarMonth.getFullYear();

        // 印刷用データの整形 (20行分の枠を用意)
        const printRows: PrintRow[] = [...monthlyLogs];
        while (printRows.length < 21) {
            printRows.push({ id: `empty-${printRows.length}`, isEmpty: true });
        }

        return (
            <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        header, nav { display: none !important; }
                        main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
                        @page { size: A4 landscape; margin: 12mm 15mm; }
                        body { background-color: white !important; color: black !important; }
                        .print-hide { display: none !important; }
                        .page-break { page-break-after: always; }
                    }
                `}} />

                <div className="w-[297mm] print:w-full flex justify-between mb-4 print-hide">
                    <Button variant="outline" onClick={() => setViewMode('monthly')} className="bg-white text-slate-700 font-bold border-slate-300">
                        <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
                    </Button>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm">
                        <span className="text-sm font-bold text-slate-600">表示月:</span>
                        <Input
                            type="month"
                            value={`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`}
                            onChange={(e) => { if (e.target.value) setCalendarMonth(new Date(e.target.value + "-01")); }}
                            className="w-36 h-8 font-bold border-none shadow-none focus-visible:ring-0 px-0"
                        />
                    </div>
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
                        <Printer className="h-5 w-5 mr-2" /> 印刷する (PDF)
                    </Button>
                </div>

                <div className="w-[297mm] h-[210mm] bg-white pt-8 pb-4 px-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col justify-between overflow-hidden">

                    <div className="flex justify-between items-end mb-2 shrink-0">
                        <div className="flex items-end gap-6 relative top-2">
                            <div className="text-sm font-bold ml-10">{y} <span className="font-normal text-xs">年</span></div>
                            <h1 className="text-3xl font-black tracking-[0.5em] leading-none mb-1">来場者記録</h1>
                        </div>

                        <table className="border-collapse border-2 border-black text-[12px] text-center leading-none w-[320px]">
                            <tbody>
                                <tr className="h-6">
                                    <th className="border border-black font-medium w-24">文書No.</th>
                                    <td className="border border-black font-bold w-24">YO-42</td>
                                    <th className="border border-black font-medium w-20">施設長</th>
                                    <th className="border border-black font-medium w-20">担当</th>
                                </tr>
                                <tr className="h-6">
                                    <th className="border border-black font-medium">制定日</th>
                                    <td className="border border-black font-bold">2021/4/1</td>
                                    <td className="border border-black h-[60px]" rowSpan={2}></td>
                                    <td className="border border-black h-[60px]" rowSpan={2}></td>
                                </tr>
                                <tr className="h-6">
                                    <th className="border border-black font-medium">改定日</th>
                                    <td className="border border-black font-bold"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="text-right text-[10px] pr-[180px] mb-1">ワークセンター・やまびこ</div>

                    <div className="flex-1">
                        <table className="w-full border-collapse border-[2.5px] border-black text-[11px] table-fixed">
                            <thead>
                                <tr>
                                    <th className="border border-black w-[4%] font-medium py-1.5" rowSpan={2}>月日</th>
                                    <th className="border border-black w-[5%] font-medium" rowSpan={2}>入場<br />時間</th>
                                    <th className="border border-black w-[5%] font-medium" rowSpan={2}>退場<br />時間</th>
                                    <th className="border border-black w-[20%] font-medium" rowSpan={2}>来場者</th>
                                    <th className="border border-black w-[3%] font-medium" rowSpan={2}>人数</th>
                                    <th className="border border-black w-[13%] font-medium" rowSpan={2}>随行者</th>
                                    <th className="border border-black font-medium" colSpan={3}>健康チェック</th>
                                    <th className="border border-black font-medium" colSpan={2}>身だしなみ</th>
                                    <th className="border border-black w-[18%] font-medium" rowSpan={2}>備　　考</th>
                                </tr>
                                <tr>
                                    <th className="border border-black w-[7%] font-medium py-1">熱<span className="text-[9px]">( 有・無 )</span></th>
                                    <th className="border border-black w-[8%] font-medium">吐き気<span className="text-[9px]">(有・無)</span></th>
                                    <th className="border border-black w-[7%] font-medium">下痢<span className="text-[9px]">(有・無)</span></th>
                                    <th className="border border-black w-[3%] font-medium">爪</th>
                                    <th className="border border-black w-[7%] font-medium">装飾品</th>
                                </tr>
                            </thead>
                            <tbody>
                                {printRows.slice(0, 21).map((row, idx) => {
                                    if ('isEmpty' in row && row.isEmpty) {
                                        return (
                                            <tr key={idx} className="h-[6.5mm]">
                                                <td className="border border-black text-center text-[10px] text-slate-400">/</td>
                                                <td className="border border-black text-center text-[10px] text-slate-400">：</td>
                                                <td className="border border-black text-center text-[10px] text-slate-400">：</td>
                                                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                                <td className="border border-black text-center text-[9px] text-slate-700 tracking-widest">有・無</td>
                                                <td className="border border-black text-center text-[9px] text-slate-700 tracking-widest">有・無</td>
                                                <td className="border border-black text-center text-[9px] text-slate-700 tracking-widest">有・無</td>
                                                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                            </tr>
                                        );
                                    }

                                    const log = row as VisitorLog;
                                    const d = new Date(log.visit_date);
                                    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

                                    const renderCircle = (val: string | null, target: string) => {
                                        if (val === target) return <span className="inline-block w-4 h-4 border border-black rounded-full text-center leading-tight font-bold -mx-1">{target}</span>;
                                        return target;
                                    };

                                    return (
                                        <tr key={log.id} className="h-[6.5mm]">
                                            <td className="border border-black text-center font-bold">{dateStr}</td>
                                            <td className="border border-black text-center font-mono text-[10px] tracking-tighter">{log.entry_time}</td>
                                            <td className="border border-black text-center font-mono text-[10px] tracking-tighter">{log.exit_time}</td>
                                            <td className="border border-black px-2 font-bold truncate overflow-hidden whitespace-nowrap">{log.visitor_name}</td>
                                            <td className="border border-black text-center">{log.headcount}</td>
                                            <td className="border border-black px-1.5 truncate text-center">{log.attendant_name}</td>
                                            <td className="border border-black text-center text-[9px] tracking-wide">{renderCircle(log.fever, '有')} ・ {renderCircle(log.fever, '無')}</td>
                                            <td className="border border-black text-center text-[9px] tracking-wide">{renderCircle(log.nausea, '有')} ・ {renderCircle(log.nausea, '無')}</td>
                                            <td className="border border-black text-center text-[9px] tracking-wide">{renderCircle(log.diarrhea, '有')} ・ {renderCircle(log.diarrhea, '無')}</td>
                                            <td className="border border-black text-center font-bold">{log.nails_checked}</td>
                                            <td className="border border-black text-center truncate text-[10px]">{log.accessories}</td>
                                            <td className="border border-black px-1 text-[9px] truncate">{log.notes}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // =======================================================================
    // 通常画面 (一覧 / 入力)
    // =======================================================================
    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <Users className="h-6 w-6 text-indigo-600" />
                        来場者記録 (YO-42)
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {canEdit && (
                        <Button onClick={() => openModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm h-10 w-full sm:w-auto">
                            <Plus className="h-4 w-4 mr-2" /> 新規記録を追加
                        </Button>
                    )}
                    <Button onClick={() => setViewMode('print')} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold shadow-sm h-10 w-full sm:w-auto">
                        <Printer className="h-4 w-4 mr-2" /> 帳票(PDF)出力
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-lg text-slate-800">月間 記録一覧</CardTitle>
                    <Input type="month" value={`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`} onChange={(e) => { if (e.target.value) setCalendarMonth(new Date(e.target.value + "-01")); }} className="w-40 bg-white font-bold" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="w-full min-w-[1000px] text-sm">
                            <TableHeader className="bg-slate-100">
                                <TableRow>
                                    <TableHead className="w-24 pl-4">日付</TableHead>
                                    <TableHead className="w-28 text-center">入場 - 退場</TableHead>
                                    <TableHead className="w-48">来場者 (人数)</TableHead>
                                    <TableHead className="w-28">随行者</TableHead>
                                    <TableHead className="w-40 text-center">健康状態 / 身だしなみ</TableHead>
                                    <TableHead>備考</TableHead>
                                    <TableHead className="w-24 text-center pr-4">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 text-slate-400 mx-auto" /></TableCell></TableRow> : (
                                    monthlyLogs.map(log => {
                                        const isHealthOk = log.fever === '無' && log.nausea === '無' && log.diarrhea === '無';
                                        return (
                                            <TableRow key={log.id} className="hover:bg-slate-50">
                                                <TableCell className="pl-4 font-bold text-slate-600">{new Date(log.visit_date).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-center font-mono text-xs">
                                                    <div>{log.entry_time || "-"}</div>
                                                    <div className="text-slate-400">~ {log.exit_time || "-"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-800">{log.visitor_name}</div>
                                                    <div className="text-xs text-slate-500">{log.headcount} 名</div>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-600">{log.attendant_name || "-"}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {isHealthOk ? <Badge className="bg-green-100 text-green-800 border-none shadow-none text-[10px] w-16 justify-center">健康 良</Badge> : <Badge className="bg-red-100 text-red-800 border-none shadow-none text-[10px] w-16 justify-center">要確認</Badge>}
                                                        <div className="text-[10px] text-slate-500">爪:{log.nails_checked || "-"} / 飾:{log.accessories || "-"}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-600 truncate max-w-[200px]" title={log.notes}>{log.notes || "-"}</TableCell>
                                                <TableCell className="text-center pr-4">
                                                    {canEdit && (
                                                        <div className="flex justify-center gap-1">
                                                            <Button variant="outline" size="icon" onClick={() => openModal(log)} className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"><Edit2 className="h-4 w-4" /></Button>
                                                            <Button variant="outline" size="icon" onClick={() => handleDelete(log.id)} className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                                {monthlyLogs.length === 0 && !loading && (
                                    <TableRow><TableCell colSpan={7} className="text-center py-16 text-slate-500 bg-slate-50">指定月の記録がありません。</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl bg-white p-0 rounded-xl overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[85vh]">
                    <DialogHeader className="p-6 border-b bg-slate-50 shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-indigo-800">
                            <Users className="h-5 w-5" /> 来場者記録の入力
                        </DialogTitle>
                    </DialogHeader>

                    {/* ★修正: 中身のコンテンツ領域に overflow-y-auto と十分な padding を設定し、スマホでスクロールできるようにする */}
                    <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">来場日 <span className="text-red-500">*</span></label><Input type="date" value={formData.visit_date} onChange={e => setFormData({ ...formData, visit_date: e.target.value })} className="h-10" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">入場時間</label><Input type="time" value={formData.entry_time} onChange={e => setFormData({ ...formData, entry_time: e.target.value })} className="h-10" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">退場時間</label><Input type="time" value={formData.exit_time} onChange={e => setFormData({ ...formData, exit_time: e.target.value })} className="h-10" /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-6"><label className="block text-xs font-bold text-slate-500 mb-1">来場者名 (会社名など) <span className="text-red-500">*</span></label><Input value={formData.visitor_name} onChange={e => setFormData({ ...formData, visitor_name: e.target.value })} className="h-10 font-bold" placeholder="例: 商工会婦人部" /></div>
                            <div className="col-span-1 md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">人数</label><Input type="number" min="1" value={formData.headcount} onChange={e => setFormData({ ...formData, headcount: e.target.value === "" ? "" : Number(e.target.value) })} className="h-10 text-right" /></div>
                            <div className="md:col-span-4"><label className="block text-xs font-bold text-slate-500 mb-1">随行者</label><Input value={formData.attendant_name} onChange={e => setFormData({ ...formData, attendant_name: e.target.value })} className="h-10" placeholder="例: 梅村施設長" /></div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-700 mb-3 border-b pb-1">健康チェック</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">熱</label>
                                    <div className="flex bg-white rounded border p-0.5"><button onClick={() => setFormData({ ...formData, fever: '有' })} className={`flex-1 text-sm md:text-xs py-2 md:py-1.5 font-bold rounded-sm ${formData.fever === '有' ? 'bg-red-500 text-white' : 'text-slate-500'}`}>有</button><button onClick={() => setFormData({ ...formData, fever: '無' })} className={`flex-1 text-sm md:text-xs py-2 md:py-1.5 font-bold rounded-sm ${formData.fever === '無' ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>無</button></div>
                                </div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">吐き気</label>
                                    <div className="flex bg-white rounded border p-0.5"><button onClick={() => setFormData({ ...formData, nausea: '有' })} className={`flex-1 text-sm md:text-xs py-2 md:py-1.5 font-bold rounded-sm ${formData.nausea === '有' ? 'bg-red-500 text-white' : 'text-slate-500'}`}>有</button><button onClick={() => setFormData({ ...formData, nausea: '無' })} className={`flex-1 text-sm md:text-xs py-2 md:py-1.5 font-bold rounded-sm ${formData.nausea === '無' ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>無</button></div>
                                </div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">下痢</label>
                                    <div className="flex bg-white rounded border p-0.5"><button onClick={() => setFormData({ ...formData, diarrhea: '有' })} className={`flex-1 text-sm md:text-xs py-2 md:py-1.5 font-bold rounded-sm ${formData.diarrhea === '有' ? 'bg-red-500 text-white' : 'text-slate-500'}`}>有</button><button onClick={() => setFormData({ ...formData, diarrhea: '無' })} className={`flex-1 text-sm md:text-xs py-2 md:py-1.5 font-bold rounded-sm ${formData.diarrhea === '無' ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>無</button></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-700 mb-3 border-b pb-1">身だしなみ</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">爪</label>
                                    <div className="flex bg-white rounded border p-0.5"><button onClick={() => setFormData({ ...formData, nails_checked: '良' })} className={`flex-1 text-sm md:text-xs py-2 md:py-1.5 font-bold rounded-sm ${formData.nails_checked === '良' ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>良</button><button onClick={() => setFormData({ ...formData, nails_checked: '不良' })} className={`flex-1 text-sm md:text-xs py-2 md:py-1.5 font-bold rounded-sm ${formData.nails_checked === '不良' ? 'bg-red-500 text-white' : 'text-slate-500'}`}>不良</button></div>
                                </div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">装飾品</label><Input value={formData.accessories || ""} onChange={e => setFormData({ ...formData, accessories: e.target.value })} className="h-11 md:h-9 bg-white" placeholder="例: 腕時計、無し" /></div>
                            </div>
                        </div>

                        <div><label className="block text-xs font-bold text-slate-500 mb-1">備考</label><Input value={formData.notes || ""} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="h-11 md:h-10" placeholder="特記事項..." /></div>
                    </div>

                    <DialogFooter className="p-4 border-t bg-slate-50 shrink-0 flex flex-row gap-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 h-12 md:h-10 font-bold">キャンセル</Button>
                        <Button onClick={handleSave} disabled={isSaving || !formData.visit_date || !formData.visitor_name} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 md:h-10">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5 md:h-4 md:w-4 mr-2" /> : <Save className="h-5 w-5 md:h-4 md:w-4 mr-2" />} 登録して保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}