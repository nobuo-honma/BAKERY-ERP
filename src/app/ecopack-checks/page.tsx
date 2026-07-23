"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, MinusCircle, Save, Loader2, CalendarDays, Printer, ArrowLeft, Lock, Edit, Trash2, Plus, Box } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import HaccpPrintHeader from "@/components/HaccpPrintHeader";

// YO-4 のチェック内容定義
const CHECK_ITEMS = [
    { id: "c1", num: "①", text: "異物の混入・付着はないか" },
    { id: "c2", num: "②", text: "箱に汚れ・傷・破損はないか" },
    { id: "c3", num: "③", text: "包装に穴・傷・シール不良はないか" },
    { id: "c4", num: "④", text: "印字に不具合はないか" },
    { id: "c5", num: "⑤", text: "大箱にロット・賞味期限が正しく記入してあるか" },
    { id: "c6", num: "⑥", text: "入り数はただしいか" },
];

type PlanOption = { lot_code: string; product_name: string; planned_units: number; unit_per_cs: number };
type CheckResult = 'ok' | 'ng' | null;
type EcopackCheckRow = {
    id: string;
    check_date: string;
    lot_code: string;
    product_name: string;
    planned_qty: number;
    seal_checked: number | null;
    seal_ng: number | null;
    oxygen_level: number | null;
    checker_name: string;
    results?: Record<string, CheckResult>;
    defective_qty: number | null;
    notes: string;
};

export default function EcopackChecksPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);

    const [viewMode, setViewMode] = useState<'input' | 'list' | 'print'>('list');

    // 日次入力用State
    const [testDate, setTestDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [lotCode, setLotCode] = useState("");
    const [productName, setProductName] = useState("");
    const [plannedQty, setPlannedQty] = useState<number | "">(""); // ピース数
    const [unitPerCs, setUnitPerCs] = useState<number>(24); // c/s換算用

    const [sealChecked, setSealChecked] = useState<number | "">("");
    const [sealNg, setSealNg] = useState<number | "">("");
    const [oxygenLevel, setOxygenLevel] = useState<number | "">("");
    const [checkerName, setCheckerName] = useState("");
    const [results, setResults] = useState<Record<string, CheckResult>>({});
    const [defectiveQty, setDefectiveQty] = useState<number | "">("");
    const [notes, setNotes] = useState("");

    const [isSaving, setIsSaving] = useState(false);

    // その日製造されたLotのリスト（プルダウン用）
    const [availableLots, setAvailableLots] = useState<PlanOption[]>([]);

    // 一覧用・印刷用State
    const [testRecords, setTestRecords] = useState<EcopackCheckRow[]>([]);
    const [printMonth, setPrintMonth] = useState(new Date());

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('ecopack_checks').select('*').order('check_date', { ascending: false }).limit(50);
        const rows = (data as EcopackCheckRow[] | null) ?? [];
        setTestRecords(rows);
        setLoading(false);
    }, []);

    const fetchAvailableLots = useCallback(async (dateStr: string) => {
        const { data } = await supabase.from('production_plans')
            .select('lot_code, planned_units, products(name, variant_name, unit_per_cs)')
            .eq('production_date', dateStr);

        if (data) {
            const lots: PlanOption[] = data.map((d: Record<string, unknown>) => ({
                lot_code: String(d.lot_code ?? ""),
                product_name: `${String((d.products as Record<string, unknown> | undefined)?.name ?? "") } (${String((d.products as Record<string, unknown> | undefined)?.variant_name ?? "")})`,
                planned_units: Number(d.planned_units ?? 0),
                unit_per_cs: Number((d.products as Record<string, unknown> | undefined)?.unit_per_cs ?? 24)
            }));
            setAvailableLots(lots);
        } else {
            setAvailableLots([]);
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchRecords();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [fetchRecords]);

    useEffect(() => {
        if (viewMode !== 'input' || !testDate) return;

        const timeoutId = window.setTimeout(() => {
            void fetchAvailableLots(testDate);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [fetchAvailableLots, testDate, viewMode]);

    const handleLotSelect = (selectedLot: string) => {
        setLotCode(selectedLot);
        const target = availableLots.find(l => l.lot_code === selectedLot);
        if (target) {
            setProductName(target.product_name);
            setPlannedQty(target.planned_units);
            setUnitPerCs(target.unit_per_cs);
        } else {
            setProductName(""); setPlannedQty(""); setUnitPerCs(24);
        }
    };

    const resetInput = () => {
        const today = new Date().toISOString().split('T')[0];
        setTestDate(today); setLotCode(""); setProductName(""); setPlannedQty(""); setUnitPerCs(24);
        setSealChecked(""); setSealNg(""); setOxygenLevel(""); setCheckerName("");
        setDefectiveQty(""); setNotes("");

        const initialResults: Record<string, CheckResult> = {};
        CHECK_ITEMS.forEach(item => { initialResults[item.id] = 'ok'; });
        setResults(initialResults);
    };

    const handleOpenInput = () => {
        resetInput();
        setViewMode('input');
    };

    const handleEdit = (record: EcopackCheckRow) => {
        setTestDate(record.check_date); setLotCode(record.lot_code); setProductName(record.product_name);
        setPlannedQty(record.planned_qty);
        setUnitPerCs(24);
        setSealChecked(record.seal_checked !== null ? record.seal_checked : "");
        setSealNg(record.seal_ng !== null ? record.seal_ng : ""); setOxygenLevel(record.oxygen_level !== null ? record.oxygen_level : "");
        setCheckerName(record.checker_name || ""); setDefectiveQty(record.defective_qty !== null ? record.defective_qty : "");
        setNotes(record.notes || ""); setResults(record.results || {});
        setViewMode('input');
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

    const handleSave = async () => {
        if (!testDate || !lotCode || !productName) { alert("製造日とLot番号を選択してください。"); return; }
        setIsSaving(true);

        const payload = {
            check_date: testDate, lot_code: lotCode, product_name: productName, planned_qty: Number(plannedQty) || 0,
            seal_checked: sealChecked === "" ? null : Number(sealChecked), seal_ng: sealNg === "" ? null : Number(sealNg),
            oxygen_level: oxygenLevel === "" ? null : Number(oxygenLevel), checker_name: checkerName, results: results,
            defective_qty: defectiveQty === "" ? null : Number(defectiveQty), notes: notes, updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('ecopack_checks').upsert(payload, { onConflict: 'check_date,lot_code' });
        setIsSaving(false);
        if (error) alert("保存に失敗しました: " + error.message);
        else { alert("製品チェック記録を保存しました！"); setViewMode('list'); fetchRecords(); }
    };

    const handleDelete = async (record: EcopackCheckRow) => {
        if (!confirm(`Lot: ${record.lot_code} の検査記録を削除しますか？`)) return;
        const { error } = await supabase.from('ecopack_checks').delete().eq('id', record.id);
        if (error) alert("削除エラー: " + error.message);
        else fetchRecords();
    };

    // =======================================================================
    // 月間一覧・印刷（PDF帳票）ビュー
    // A4 縦サイズ
    // =======================================================================

    type PrintRow = EcopackCheckRow | { id: string; isEmpty: true };

    const printRecords = testRecords
        .filter(r => {
            const d = new Date(r.check_date);
            return d.getFullYear() === printMonth.getFullYear() && d.getMonth() === printMonth.getMonth();
        })
        .sort((a, b) => new Date(a.check_date).getTime() - new Date(b.check_date).getTime());

    if (viewMode as string === 'print') {
        const y = printMonth.getFullYear();
        const m = String(printMonth.getMonth() + 1).padStart(2, '0');

        const displayRows: PrintRow[] = [...printRecords];
        while (displayRows.length < 26) {
            displayRows.push({ id: `empty-${displayRows.length}`, isEmpty: true });
        }

        return (
            <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        header, nav { display: none !important; }
                        main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
                        @page { size: A4 portrait; margin: 15mm; }
                        body { background-color: white !important; color: black !important; }
                        .print-hide { display: none !important; }
                    }
                `}} />

                <div className="w-[210mm] print:w-full flex justify-between mb-4 print-hide">
                    <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300">
                        <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
                    </Button>
                    <div className="flex gap-2 items-center bg-white px-2 py-1 rounded border shadow-sm">
                        <span className="text-sm font-bold text-slate-600 ml-2">出力対象月:</span>
                        <Input type="month" value={`${y}-${m}`} onChange={(e) => { if (e.target.value) setPrintMonth(new Date(e.target.value + "-01")); }} className="w-40 border-none shadow-none h-8 font-bold" />
                    </div>
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
                        <Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)
                    </Button>
                </div>

                <div className="w-[210mm] min-h-[297mm] bg-white pt-8 pb-10 px-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col">

                    <HaccpPrintHeader
                        title="エコパック製品チェック表"
                        subtitle={<>{y}年{m}月度</>}
                        docNo="YO-4"
                        establishedDate="2019/10/1"
                        revisedDate="2021/2/1"
                    />

                    <table className="w-full border-collapse border-2 border-black text-[10px] flex-1 table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black py-0.5 w-[7%] font-medium leading-tight">製造月日</th>
                                <th className="border border-black py-0.5 w-[23%] font-medium leading-tight">製造名<hr className="border-black my-0.5" />Lot №.</th>
                                <th className="border border-black py-0.5 w-[8%] font-medium leading-tight">予定製造数</th>
                                <th className="border border-black py-0.5 w-[8%] font-medium leading-tight text-[9px]">シール可否<hr className="border-black my-0.5" />NG数/検査数</th>
                                <th className="border border-black py-0.5 w-[7%] font-medium leading-tight text-[8px]">酸素濃度(%)</th>
                                <th className="border border-black py-0.5 w-[9%] font-medium leading-tight">検査者</th>
                                <th className="border border-black p-0 w-[24%]">
                                    <div className="border-b border-black py-0.5 text-[9px] font-medium">チェック内容の問題有無</div>
                                    <div className="flex w-full divide-x divide-black text-[9px]">
                                        <div className="flex-1 text-center py-0.5">①</div><div className="flex-1 text-center py-0.5">②</div>
                                        <div className="flex-1 text-center py-0.5">③</div><div className="flex-1 text-center py-0.5">④</div>
                                        <div className="flex-1 text-center py-0.5">⑤</div><div className="flex-1 text-center py-0.5">⑥</div>
                                    </div>
                                </th>
                                <th className="border border-black py-0.5 w-[6%] font-medium leading-tight text-[8px]">不適合品<br />廃棄数</th>
                                <th className="border border-black py-0.5 w-[8%] font-medium leading-tight">備考</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayRows.map((row, idx) => {
                                if ("isEmpty" in row) {
                                    return (
                                        <tr key={idx} className="h-[7mm]">
                                            <td className="border border-black text-center text-[11px]"> / </td>
                                            <td className="border border-black"><div className="h-1/2 border-b border-dashed border-black/50"></div><div className="h-1/2"></div></td>
                                            <td className="border border-black p-0">
                                                <div className="h-1/2 border-b border-dashed border-black/50 text-right pr-0.5 align-bottom text-[9px] flex items-end justify-end"><span className="text-slate-400">c/s</span></div>
                                                <div className="h-1/2 text-right pr-0.5 align-bottom text-[9px] flex items-end justify-end"><span className="text-slate-400">個</span></div>
                                            </td>
                                            <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                            <td className="border border-black p-0">
                                                <div className="flex w-full h-full divide-x divide-black text-[8px] items-center text-slate-300">
                                                    <div className="flex-1 text-center">良 不</div><div className="flex-1 text-center">良 不</div><div className="flex-1 text-center">良 不</div>
                                                    <div className="flex-1 text-center">良 不</div><div className="flex-1 text-center">良 不</div><div className="flex-1 text-center">良 不</div>
                                                </div>
                                            </td>
                                            <td className="border border-black"></td><td className="border border-black"></td>
                                        </tr>
                                    );
                                }

                                const record = row as EcopackCheckRow;
                                const d = new Date(record.check_date);
                                const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                                const res = record.results || {};
                                const getOkNg = (id: string) => {
                                    if (res[id] === 'ok') return <><span className="font-bold text-black border border-black rounded-full w-3 h-3 flex items-center justify-center">良</span> <span className="text-slate-300">不</span></>;
                                    if (res[id] === 'ng') return <><span className="text-slate-300">良</span> <span className="font-bold text-black border border-black rounded-full w-3 h-3 flex items-center justify-center">不</span></>;
                                    return <><span className="text-slate-400">良</span> <span className="text-slate-400">不</span></>;
                                };

                                // ★修正: 個数を2で割ってパック数にし、さらにunit_per_csで割ってケース数を出す
                                const rowCs = Math.floor((record.planned_qty / 2) / 24);

                                return (
                                    <tr key={row.id} className="h-[7mm]">
                                        <td className="border border-black text-center text-xs tracking-wider font-bold">{dateStr}</td>
                                        <td className="border border-black relative p-0 text-[9px] font-bold">
                                            <div className="h-1/2 border-b border-dashed border-black/50 px-1 truncate leading-tight flex items-end pb-0.5">{record.product_name}</div>
                                            <div className="h-1/2 px-1 truncate leading-tight flex items-start pt-0.5">{record.lot_code}</div>
                                        </td>
                                        <td className="border border-black p-0 text-xs font-bold text-right pr-0.5">
                                            <div className="h-1/2 border-b border-dashed border-black/50 flex items-end justify-end pb-0.5">{rowCs} <span className="text-[8px] font-normal ml-0.5">c/s</span></div>
                                            <div className="h-1/2 flex items-end justify-end">{record.planned_qty} <span className="text-[8px] font-normal ml-0.5">個</span></div>
                                        </td>
                                        <td className="border border-black text-center text-[10px]">{record.seal_ng !== null ? `${record.seal_ng} / ${record.seal_checked}` : ""}</td>
                                        <td className="border border-black text-center text-[11px] font-bold">{record.oxygen_level !== null ? record.oxygen_level : ""}</td>
                                        <td className="border border-black text-center text-[9px] truncate px-0.5">{record.checker_name}</td>
                                        <td className="border border-black p-0">
                                            <div className="flex w-full h-full divide-x divide-black text-[8px] items-center text-center">
                                                <div className="flex-1 flex justify-center gap-0.5">{getOkNg('c1')}</div><div className="flex-1 flex justify-center gap-0.5">{getOkNg('c2')}</div><div className="flex-1 flex justify-center gap-0.5">{getOkNg('c3')}</div>
                                                <div className="flex-1 flex justify-center gap-0.5">{getOkNg('c4')}</div><div className="flex-1 flex justify-center gap-0.5">{getOkNg('c5')}</div><div className="flex-1 flex justify-center gap-0.5">{getOkNg('c6')}</div>
                                            </div>
                                        </td>
                                        <td className="border border-black text-center font-bold text-xs">{record.defective_qty !== null ? record.defective_qty : ""}</td>
                                        <td className="border border-black text-[8px] px-0.5 truncate">{record.notes}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="mt-3 flex gap-8 items-start text-[11px] font-medium leading-relaxed">
                        <div className="flex gap-2 items-start">
                            <div className="shrink-0 bg-gray-100 border border-black px-4 py-1 font-bold">チェック内容</div>
                            <ul className="list-none space-y-0.5">
                                {CHECK_ITEMS.map(item => <li key={item.id}><span className="inline-block w-4 text-center">{item.num}</span> {item.text}</li>)}
                            </ul>
                        </div>
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex gap-2">
                                <span>※ 酸素濃度基準 ：</span>
                                <span className="font-bold underline underline-offset-4">12.5 %以下</span>
                            </div>
                            <div>
                                <span>※ シールチェックは折り機通過後 1500個毎に実施する。</span>
                            </div>
                        </div>
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
                        <Box className="h-6 w-6 text-teal-600" />
                        エコパック製品チェック表 (YO-4)
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
                {viewMode === 'list' && canEdit && (
                    <Button onClick={handleOpenInput} className="bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-sm h-10 w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" /> 新規検査を入力
                    </Button>
                )}
                {viewMode === 'input' && (
                    <Button variant="outline" onClick={() => setViewMode('list')} className="font-bold border-slate-300 h-10">
                        <ArrowLeft className="h-4 w-4 mr-2" /> 一覧に戻る
                    </Button>
                )}
            </div>

            {viewMode === 'list' ? (
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b py-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg text-slate-800">検査記録一覧</CardTitle>
                        <Button variant="outline" onClick={() => setViewMode('print')} className="h-9 px-4 border-slate-300 font-bold bg-white shadow-sm"><Printer className="h-4 w-4 mr-2" /> PDF帳票を出力 (月指定)</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table className="w-full min-w-200 text-sm">
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="w-28 pl-4">製造日</TableHead>
                                        <TableHead className="w-48">Lot番号</TableHead>
                                        <TableHead>製品名</TableHead>
                                        <TableHead className="w-32 text-right pr-4">予定数(個/箱)</TableHead>
                                        <TableHead className="w-40 text-center">アクション</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 text-slate-400 mx-auto" /></TableCell></TableRow> : (
                                        testRecords.map(rec => (
                                            <TableRow key={rec.id} className="hover:bg-slate-50">
                                                <TableCell className="pl-4 font-bold text-slate-600">{new Date(rec.check_date).toLocaleDateString()}</TableCell>
                                                <TableCell className="font-black text-teal-700 tracking-widest">{rec.lot_code}</TableCell>
                                                <TableCell className="font-bold text-slate-800">{rec.product_name}</TableCell>
                                                <TableCell className="text-right pr-4 text-xs font-bold text-slate-600">
                                                    {/* ★修正: ピース数を2で割ってから24で割る */}
                                                    {Math.floor((rec.planned_qty / 2) / 24)} c/s <span className="font-normal">({rec.planned_qty} 個)</span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center gap-2">
                                                        {canEdit && (
                                                            <>
                                                                <Button variant="outline" size="sm" onClick={() => handleEdit(rec)} className="h-8 px-3 border-blue-200 text-blue-600 hover:bg-blue-50"><Edit className="h-4 w-4" /></Button>
                                                                <Button variant="outline" size="sm" onClick={() => handleDelete(rec)} className="h-8 px-3 border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                    {testRecords.length === 0 && !loading && (
                                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500 bg-slate-50">記録がありません。</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6 max-w-4xl mx-auto pb-12">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-teal-50/50 border-b pb-4">
                            <CardTitle className="text-lg text-teal-900 flex items-center gap-2">
                                <CalendarDays className="h-5 w-5 text-teal-600" /> 対象Lotと基本情報の入力
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold mb-1 text-slate-700">製造日 (検査日)</label><Input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="h-12 text-lg font-bold bg-white border-teal-300 shadow-sm" /></div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-slate-700">製造Lotを選択 (必須)</label>
                                    <select value={lotCode} onChange={(e) => handleLotSelect(e.target.value)} className="w-full h-12 text-base font-bold bg-white border-2 border-teal-300 rounded-md px-3 shadow-sm focus:ring-teal-500">
                                        <option value="">-- この日製造されたLot --</option>
                                        {availableLots.map(l => <option key={l.lot_code} value={l.lot_code}>{l.lot_code} ({l.product_name})</option>)}
                                    </select>
                                    {availableLots.length === 0 && <p className="text-[10px] text-red-500 mt-1">※この日に製造されたLotはありません。</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">予定製造数 (総個数)</label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" min="0" value={plannedQty} onChange={e => setPlannedQty(e.target.value === "" ? "" : Number(e.target.value))} className="h-10 text-lg font-bold text-right" />
                                        <span className="font-bold text-slate-500">個</span>
                                    </div>
                                    {/* ▼ 修正: ピース数を2で割ってパックにし、さらにunit_per_csで割ってケース数を出す */}
                                    {plannedQty !== "" && (
                                        <p className="text-xs text-right text-slate-500 font-bold mt-1">
                                            ≒ {Math.floor((Number(plannedQty) / 2) / unitPerCs)} c/s
                                        </p>
                                    )}
                                </div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">酸素濃度 (%)</label><Input type="number" step="0.1" value={oxygenLevel} onChange={e => setOxygenLevel(e.target.value === "" ? "" : Number(e.target.value))} className="h-10 text-lg font-bold text-right" placeholder="12.5以下..." /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">不適合品廃棄数</label><Input type="number" min="0" value={defectiveQty} onChange={e => setDefectiveQty(e.target.value === "" ? "" : Number(e.target.value))} className="h-10 text-lg font-bold text-right text-red-600" /></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-lg border">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">シール可否 (1500個毎)</label>
                                    <div className="flex gap-2 items-center">
                                        <Input type="number" min="0" value={sealNg} onChange={e => setSealNg(e.target.value === "" ? "" : Number(e.target.value))} className="h-10 font-bold text-right border-red-300 focus-visible:ring-red-400 placeholder:text-red-300" placeholder="NG数" />
                                        <span className="font-black text-slate-400">/</span>
                                        <Input type="number" min="0" value={sealChecked} onChange={e => setSealChecked(e.target.value === "" ? "" : Number(e.target.value))} className="h-10 font-bold text-right" placeholder="検査数" />
                                    </div>
                                </div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-2">検査者名</label><Input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} placeholder="サイン..." className="h-10" /></div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-white border-b py-3 px-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-base text-slate-700 font-black">チェック内容 (全6項目)</CardTitle>
                                <div className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-full">タップして 良 / 不良 を切り替え</div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {CHECK_ITEMS.map((item) => {
                                    const res = results[item.id]; const isOk = res === 'ok'; const isNg = res === 'ng';
                                    return (
                                        <div key={item.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isNg ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                            <div className="flex-1 flex items-start gap-2">
                                                <div className="font-black text-slate-500 bg-slate-100 px-1.5 rounded w-6 text-center">{item.num}</div>
                                                <h3 className="font-bold text-slate-800 text-sm md:text-base leading-snug pt-0.5">{item.text}</h3>
                                            </div>
                                            <div className="shrink-0 flex sm:justify-end">
                                                <button onClick={() => toggleResult(item.id)} disabled={!canEdit} className={`w-full sm:w-32 h-14 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all shadow-sm border-2 ${isOk ? 'bg-teal-500 border-teal-600 text-white' : isNg ? 'bg-red-500 border-red-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'}`}>
                                                    {isOk && <><CheckCircle2 className="w-5 h-5" /> 良</>}
                                                    {isNg && <><XCircle className="w-5 h-5" /> 不良</>}
                                                    {!isOk && !isNg && <><MinusCircle className="w-5 h-5" /> 未実施</>}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardContent className="pt-6">
                            <div><label className="block text-sm font-bold mb-1 text-slate-700">備考</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 border border-slate-200 rounded-md text-sm resize-none h-20 bg-white" placeholder="特記事項など..." /></div>
                            <Button onClick={handleSave} disabled={isSaving || !testDate || !lotCode} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold h-12 shadow-md mt-6">
                                {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} この検査結果を保存する
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}