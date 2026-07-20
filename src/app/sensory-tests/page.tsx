"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// ▼ 修正: Plus をインポートに追加しました ▼
import { Save, Loader2, CalendarDays, Printer, ArrowLeft, Eye, Lock, Edit, Trash2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import HaccpPrintHeader from "@/components/HaccpPrintHeader";

// YO-30 の項目定義
// 各セクションのチェック項目と、その選択肢（options）を定義
const TEST_SECTIONS = [
    {
        title: "小箱の状態",
        id: "box",
        items: [
            { id: "box_visual", label: "視覚（目）", options: ["問題ない", "シュリンクに裂け目がある", "傷がある", "凹みがある", "汚れが付着している"] },
            { id: "box_olfactory", label: "嗅覚（鼻）", options: ["問題ない", "異臭がする", "その他"] },
            { id: "box_tactile", label: "触覚（皮膚）", options: ["問題ない", "ざらざらしている", "違和感がある", "その他"] },
        ]
    },
    {
        title: "アルミの状態",
        id: "aluminum",
        items: [
            { id: "alu_visual", label: "視覚（目）", options: ["問題ない", "アルミに裂け目・穴が開いている", "傷がある", "凹みがある", "汚れが付着している"] },
            { id: "alu_olfactory", label: "嗅覚（鼻）", options: ["問題ない", "異臭がする", "その他"] },
            { id: "alu_tactile", label: "触覚（皮膚）", options: ["問題ない", "ざらざらしている", "違和感がある", "その他"] },
        ]
    },
    {
        title: "パンの状態",
        id: "bread",
        items: [
            { id: "bread_visual", label: "視覚（目）", options: ["問題ない", "やや焦げている", "焦げている", "焼けていない", "規格内", "規格外（カップよりはみ出している・少ない・変形している）"] },
            { id: "bread_olfactory", label: "嗅覚（鼻）", options: ["問題ない", "焦げた臭いがする", "酸っぱい香りがする", "異臭がする", "その他"] },
            { id: "bread_gustatory", label: "味覚（舌）", options: ["問題ない", "軽い音がする", "重い音がする", "その他"] }, // 原本に基づくが「味覚」に音が入っているのは元の仕様通りとする
            { id: "bread_tactile", label: "触覚（皮膚）", options: ["問題ない", "ざらざらしている", "違和感がある", "その他"] },
        ]
    }
];

type PlanOption = { lot_code: string; product_name: string };
type SensoryRecord = {
    id: string;
    test_date: string;
    lot_code: string;
    product_name: string;
    results?: Record<string, string[] | string>;
    checker_name?: string | null;
    sub_checker_name?: string | null;
    notes?: string | null;
};

export default function SensoryTestsPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'input' | 'list'>('list');

    // 日次入力用State
    const [testDate, setTestDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [lotCode, setLotCode] = useState("");
    const [productName, setProductName] = useState("");
    const [results, setResults] = useState<Record<string, string[]>>({});
    const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
    const [checkerName, setCheckerName] = useState("");
    const [subCheckerName, setSubCheckerName] = useState("");
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // その日製造されたLotのリスト（プルダウン用）
    const [availableLots, setAvailableLots] = useState<PlanOption[]>([]);

    // 一覧用State
    const [testRecords, setTestRecords] = useState<SensoryRecord[]>([]);

    // 印刷・編集用State
    const [printRecord, setPrintRecord] = useState<SensoryRecord | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('sensory_tests').select('*').order('test_date', { ascending: false }).limit(50);
        if (data) setTestRecords(data as SensoryRecord[]);
        setLoading(false);
    }, []);

    const fetchAvailableLots = useCallback(async (dateStr: string) => {
        const { data } = await supabase.from('production_plans')
            .select('lot_code, products(name, variant_name)')
            .eq('production_date', dateStr);

        if (data) {
            const lots = data.map((d: any) => {
                const prod = Array.isArray(d.products) ? d.products[0] : d.products;
                return {
                    lot_code: d.lot_code,
                    product_name: `${prod?.name ?? ""} (${prod?.variant_name ?? ""})`
                };
            });
            setAvailableLots(lots);
        } else {
            setAvailableLots([]);
        }
    }, []);

    // 初期化と一覧取得
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchRecords();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [fetchRecords]);

    // 入力画面で日付が変わった際に、その日の製造計画（Lot）を取得する
    useEffect(() => {
        if (viewMode === 'input' && testDate) {
            const timer = window.setTimeout(() => {
                void fetchAvailableLots(testDate);
            }, 0);

            return () => window.clearTimeout(timer);
        }
    }, [testDate, viewMode, fetchAvailableLots]);

    // Lot番号が選択されたら、製品名を自動セット
    const handleLotSelect = (selectedLot: string) => {
        setLotCode(selectedLot);
        const target = availableLots.find(l => l.lot_code === selectedLot);
        if (target) setProductName(target.product_name);
        else setProductName("");
    };

    // 新規入力のリセット
    const resetInput = () => {
        const today = new Date().toISOString().split('T')[0];
        setTestDate(today); setLotCode(""); setProductName(""); setCheckerName(""); setSubCheckerName(""); setNotes("");

        // 初期値としてすべての項目を「問題ない」と「規格内」にする
        const initialResults: Record<string, string[]> = {};
        TEST_SECTIONS.forEach(sec => {
            sec.items.forEach(item => {
                initialResults[item.id] = ["問題ない"];
                if (item.id === "bread_visual") initialResults[item.id].push("規格内");
            });
        });
        setResults(initialResults);
        setOtherTexts({});
    };

    const handleOpenInput = () => {
        resetInput();
        setViewMode('input');
    };

    const handleEdit = (record: SensoryRecord) => {
        setTestDate(record.test_date);
        setLotCode(record.lot_code);
        setProductName(record.product_name);
        setCheckerName(record.checker_name || "");
        setSubCheckerName(record.sub_checker_name || "");
        setNotes(record.notes || "");

        const recResults = record.results || {};
        const parsedResults: Record<string, string[]> = {};
        const parsedOthers: Record<string, string> = {};

        // DBに保存されているJSONから、チェック項目と「その他」のテキストを復元
        Object.keys(recResults).forEach(key => {
            if (key.endsWith('_other_text')) {
                parsedOthers[key.replace('_other_text', '')] = recResults[key] as string;
            } else {
                parsedResults[key] = Array.isArray(recResults[key]) ? recResults[key] as string[] : [recResults[key] as string];
            }
        });
        setResults(parsedResults);
        setOtherTexts(parsedOthers);

        setViewMode('input');
    };

    const toggleOption = (itemId: string, option: string) => {
        if (!canEdit) return;
        setResults(prev => {
            const current = prev[itemId] || [];
            let updated = [...current];

            // 「問題ない」等と他の異常項目を排他に扱う（簡易的）
            if (option === "問題ない") {
                const keep = updated.filter(o => o === "規格内" || o === "規格外（カップよりはみ出している・少ない・変形している）");
                updated = ["問題ない", ...keep];
            } else if (option === "規格内" || option === "規格外（カップよりはみ出している・少ない・変形している）") {
                updated = updated.filter(o => o !== "規格内" && o !== "規格外（カップよりはみ出している・少ない・変形している）");
                updated.push(option);
            } else {
                updated = updated.filter(o => o !== "問題ない");
                if (updated.includes(option)) {
                    updated = updated.filter(o => o !== option);
                } else {
                    updated.push(option);
                }
            }
            return { ...prev, [itemId]: updated };
        });
    };

    const handleSave = async () => {
        if (!testDate || !lotCode || !productName) {
            alert("実施日とLot番号（対象品）を選択してください。");
            return;
        }
        setIsSaving(true);

        const saveResults: Record<string, string[] | string> = { ...results };
        Object.keys(otherTexts).forEach(key => {
            if (results[key]?.includes("その他") || results[key]?.includes("その他 （ ）")) {
                saveResults[`${key}_other_text`] = otherTexts[key];
            }
        });

        const payload = {
            test_date: testDate,
            product_name: productName,
            lot_code: lotCode,
            results: saveResults,
            checker_name: checkerName,
            sub_checker_name: subCheckerName,
            notes: notes,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('sensory_tests').upsert(payload, { onConflict: 'test_date,lot_code' });
        setIsSaving(false);
        if (error) {
            alert("保存に失敗しました: " + error.message);
        } else {
            alert("官能検査記録を保存しました！");
            setViewMode('list');
            fetchRecords();
        }
    };

    const handleDelete = async (record: SensoryRecord) => {
        if (!confirm(`Lot: ${record.lot_code} の検査記録を削除しますか？`)) return;
        const { error } = await supabase.from('sensory_tests').delete().eq('id', record.id);
        if (error) alert("削除エラー: " + error.message);
        else fetchRecords();
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー
    // A4 縦サイズ
    // =======================================================================
    if (printRecord) {
        const rec = printRecord;
        const dObj = new Date(rec.test_date);
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][dObj.getDay()];

        const pResults = rec.results || {};

        const isChecked = (itemId: string, option: string) => {
            const arr = pResults[itemId] || [];
            return arr.includes(option) ? "☑" : "□";
        };
        const getOtherText = (itemId: string) => pResults[`${itemId}_other_text`] || "　　　　　　　　　　　　　　　　";

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
                    <Button variant="outline" onClick={() => setPrintRecord(null)} className="bg-white text-slate-700 font-bold border-slate-300">
                        <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
                    </Button>
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
                        <Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)
                    </Button>
                </div>

                <div className="w-[210mm] min-h-[297mm] bg-white pt-8 pb-10 px-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col">

                    <HaccpPrintHeader
                        title="災害備蓄用パン官能検査実施表"
                        docNo="YO-30"
                        establishedDate="2021/4/1"
                        revisedDate="2023/4/1"
                        hasSubChecker={true}
                    />

                    <div className="mb-4 space-y-3 font-medium text-sm">
                        <div className="flex items-end">
                            <div className="w-24">実施日<br /><span className="text-xs">（製造日）</span></div>
                            <div>：　<span className="font-bold underline underline-offset-4 decoration-slate-400">{y}年 {m}月 {d}日</span>　（{dayOfWeek}）</div>
                        </div>
                        <div className="flex items-end">
                            <div className="w-24">実施品目</div>
                            <div>：　<span className="font-bold underline underline-offset-4 decoration-slate-400">{rec.product_name}　（Lot: {rec.lot_code}）</span></div>
                        </div>
                    </div>

                    <table className="w-full border-collapse border-2 border-black text-[13px] flex-1">
                        <tbody>
                            {/* --- 小箱の状態 --- */}
                            <tr><td colSpan={2} className="border border-black text-center py-2 font-bold bg-gray-50">小箱の状態</td><td rowSpan={4} className="border border-black text-xs p-2 align-top w-[20%]">※ 問題があった場合は、詳細を下の記入欄に記載</td></tr>
                            <tr>
                                <td className="border border-black text-center py-3 w-[15%]">視覚（目）</td>
                                <td className="border border-black px-3 py-3 w-[65%] space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("box_visual", "問題ない")} 問題ない</span><span>{isChecked("box_visual", "シュリンクに裂け目がある")} シュリンクに裂け目がある</span></div>
                                    <div className="flex gap-6"><span>{isChecked("box_visual", "傷がある")} 傷がある</span><span>{isChecked("box_visual", "凹みがある")} 凹みがある</span><span>{isChecked("box_visual", "汚れが付着している")} 汚れが付着している</span></div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black text-center py-3">嗅覚（鼻）</td>
                                <td className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("box_olfactory", "問題ない")} 問題ない</span><span>{isChecked("box_olfactory", "異臭がする")} 異臭がする</span></div>
                                    <div>{isChecked("box_olfactory", "その他")} その他 （ {getOtherText("box_olfactory")} ）</div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black text-center py-3">触覚（皮膚）</td>
                                <td className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("box_tactile", "問題ない")} 問題ない</span><span>{isChecked("box_tactile", "ざらざらしている")} ざらざらしている</span><span>{isChecked("box_tactile", "違和感がある")} 違和感がある</span></div>
                                    <div>{isChecked("box_tactile", "その他")} その他 （ {getOtherText("box_tactile")} ）</div>
                                </td>
                            </tr>

                            {/* --- アルミの状態 --- */}
                            <tr><td colSpan={3} className="border border-black text-center py-2 font-bold bg-gray-50">アルミの状態</td></tr>
                            <tr>
                                <td className="border border-black text-center py-3">視覚（目）</td>
                                <td colSpan={2} className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("alu_visual", "問題ない")} 問題ない</span><span>{isChecked("alu_visual", "アルミに裂け目・穴が開いている")} アルミに裂け目・穴が開いている</span></div>
                                    <div className="flex gap-6"><span>{isChecked("alu_visual", "傷がある")} 傷がある</span><span>{isChecked("alu_visual", "凹みがある")} 凹みがある</span><span>{isChecked("alu_visual", "汚れが付着している")} 汚れが付着している</span></div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black text-center py-3">嗅覚（鼻）</td>
                                <td colSpan={2} className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("alu_olfactory", "問題ない")} 問題ない</span><span>{isChecked("alu_olfactory", "異臭がする")} 異臭がする</span></div>
                                    <div>{isChecked("alu_olfactory", "その他")} その他 （ {getOtherText("alu_olfactory")} ）</div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black text-center py-3">触覚（皮膚）</td>
                                <td colSpan={2} className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("alu_tactile", "問題ない")} 問題ない</span><span>{isChecked("alu_tactile", "ざらざらしている")} ざらざらしている</span><span>{isChecked("alu_tactile", "違和感がある")} 違和感がある</span></div>
                                    <div>{isChecked("alu_tactile", "その他")} その他 （ {getOtherText("alu_tactile")} ）</div>
                                </td>
                            </tr>

                            {/* --- パンの状態 --- */}
                            <tr><td colSpan={3} className="border border-black text-center py-2 font-bold bg-gray-50">パンの状態</td></tr>
                            <tr>
                                <td className="border border-black text-center py-3">視覚（目）</td>
                                <td colSpan={2} className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("bread_visual", "問題ない")} 問題ない</span><span>{isChecked("bread_visual", "やや焦げている")} やや焦げている</span><span>{isChecked("bread_visual", "焦げている")} 焦げている</span><span>{isChecked("bread_visual", "焼けていない")} 焼けていない</span></div>
                                    <div className="flex gap-6"><span>{isChecked("bread_visual", "規格内")} 規格内</span><span>{isChecked("bread_visual", "規格外（カップよりはみ出している・少ない・変形している）")} 規格外（カップよりはみ出している・少ない・変形している）</span></div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black text-center py-3">嗅覚（鼻）</td>
                                <td colSpan={2} className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("bread_olfactory", "問題ない")} 問題ない</span><span>{isChecked("bread_olfactory", "焦げた臭いがする")} 焦げた臭いがする</span><span>{isChecked("bread_olfactory", "酸っぱい香りがする")} 酸っぱい香りがする</span></div>
                                    <div className="flex gap-6"><span>{isChecked("bread_olfactory", "異臭がする")} 異臭がする</span><span>{isChecked("bread_olfactory", "その他")} その他 （ {getOtherText("bread_olfactory")} ）</span></div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black text-center py-3">味覚（舌）</td>
                                <td colSpan={2} className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("bread_gustatory", "問題ない")} 問題ない</span><span>{isChecked("bread_gustatory", "軽い音がする")} 軽い音がする</span><span>{isChecked("bread_gustatory", "重い音がする")} 重い音がする</span></div>
                                    <div>{isChecked("bread_gustatory", "その他")} その他 （ {getOtherText("bread_gustatory")} ）</div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black text-center py-3">触覚（皮膚）</td>
                                <td colSpan={2} className="border border-black px-3 py-3 space-y-2">
                                    <div className="flex gap-6"><span>{isChecked("bread_tactile", "問題ない")} 問題ない</span><span>{isChecked("bread_tactile", "ざらざらしている")} ざらざらしている</span><span>{isChecked("bread_tactile", "違和感がある")} 違和感がある</span></div>
                                    <div>{isChecked("bread_tactile", "その他")} その他 （ {getOtherText("bread_tactile")} ）</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="mt-2 border-2 border-black flex flex-col min-h-30">
                        <div className="text-center font-bold text-xs py-1 border-b border-black bg-gray-50">・各項目ごとに、チェックをして問題が無いかの確認</div>
                        <div className="p-3 text-sm whitespace-pre-wrap flex-1 leading-[2.5em] bg-[linear-gradient(transparent_95%,#cbd5e1_95%)] bg-size-[100%_2.5em]">
                            {rec.notes || ""}
                        </div>
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
                        <Eye className="h-6 w-6 text-pink-600" />
                        官能検査実施表 (YO-30)
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
                {viewMode === 'list' && canEdit && (
                    <Button onClick={handleOpenInput} className="bg-pink-600 hover:bg-pink-700 text-white font-bold shadow-sm h-10 w-full sm:w-auto">
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
                    <CardHeader className="bg-slate-50 border-b py-4">
                        <CardTitle className="text-lg text-slate-800">検査記録一覧</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table className="w-full min-w-200 text-sm">
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="w-28 pl-4">実施(製造)日</TableHead>
                                        <TableHead className="w-48">Lot番号</TableHead>
                                        <TableHead>製品名</TableHead>
                                        <TableHead className="w-48">担当者</TableHead>
                                        <TableHead className="w-40 text-center">アクション</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 text-slate-400 mx-auto" /></TableCell></TableRow> : (
                                        testRecords.map(rec => (
                                            <TableRow key={rec.id} className="hover:bg-slate-50">
                                                <TableCell className="pl-4 font-bold text-slate-600">{new Date(rec.test_date).toLocaleDateString()}</TableCell>
                                                <TableCell className="font-black text-pink-700 tracking-widest">{rec.lot_code}</TableCell>
                                                <TableCell className="font-bold text-slate-800">{rec.product_name}</TableCell>
                                                <TableCell className="text-xs text-slate-500">主: {rec.checker_name || "-"}<br />副: {rec.sub_checker_name || "-"}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => setPrintRecord(rec)} className="h-8 px-2 border-slate-300 hover:bg-slate-100"><Printer className="h-4 w-4" /></Button>
                                                        {canEdit && (
                                                            <>
                                                                <Button variant="outline" size="sm" onClick={() => handleEdit(rec)} className="h-8 px-2 border-blue-200 text-blue-600 hover:bg-blue-50"><Edit className="h-4 w-4" /></Button>
                                                                <Button variant="outline" size="sm" onClick={() => handleDelete(rec)} className="h-8 px-2 border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
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
                        <CardHeader className="bg-pink-50/50 border-b pb-4">
                            <CardTitle className="text-lg text-pink-900 flex items-center gap-2">
                                <CalendarDays className="h-5 w-5 text-pink-600" /> 対象Lotの選択
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700">実施日 (製造日)</label>
                                <Input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="h-12 text-lg font-bold bg-white border-pink-300 shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700">製造Lotを選択 (必須)</label>
                                <select value={lotCode} onChange={(e) => handleLotSelect(e.target.value)} className="w-full h-12 text-base font-bold bg-white border-2 border-pink-300 rounded-md px-3 shadow-sm focus:ring-pink-500">
                                    <option value="">-- この日製造されたLot --</option>
                                    {availableLots.map(l => <option key={l.lot_code} value={l.lot_code}>{l.lot_code} ({l.product_name})</option>)}
                                </select>
                                {availableLots.length === 0 && <p className="text-[10px] text-red-500 mt-1">※この日に製造されたLotはありません。</p>}
                            </div>
                        </CardContent>
                    </Card>

                    {TEST_SECTIONS.map((section) => (
                        <Card key={section.id} className="shadow-sm border-slate-200">
                            <CardHeader className="bg-slate-100 border-b py-3 px-4">
                                <CardTitle className="text-base text-slate-700 font-black">{section.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    {section.items.map((item) => (
                                        <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-start gap-4">
                                            <div className="md:w-32 font-bold text-slate-800 shrink-0 pt-2">{item.label}</div>
                                            <div className="flex-1 flex flex-wrap gap-2">
                                                {item.options.map(opt => {
                                                    const isChecked = results[item.id]?.includes(opt);
                                                    const isOther = opt === "その他" || opt === "その他 （ ）";

                                                    let btnColor = "bg-white border-slate-300 text-slate-600 hover:bg-slate-50";
                                                    if (isChecked) {
                                                        if (opt === "問題ない" || opt === "規格内") btnColor = "bg-blue-100 border-blue-400 text-blue-800 shadow-sm";
                                                        else btnColor = "bg-red-100 border-red-400 text-red-800 shadow-sm"; // 異常
                                                    }

                                                    return (
                                                        <div key={opt} className={`flex items-center gap-2 ${isOther && isChecked ? 'w-full mt-2' : ''}`}>
                                                            <button
                                                                onClick={() => toggleOption(item.id, opt)}
                                                                className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all ${btnColor}`}
                                                            >
                                                                {opt}
                                                            </button>
                                                            {isOther && isChecked && (
                                                                <Input
                                                                    value={otherTexts[item.id] || ""}
                                                                    onChange={e => setOtherTexts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                                    placeholder="詳細を入力..."
                                                                    className="flex-1 border-red-300 focus-visible:ring-red-400"
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    <Card className="shadow-sm border-slate-200">
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold mb-1 text-slate-700">担当者</label><Input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} placeholder="サイン..." /></div>
                                <div><label className="block text-sm font-bold mb-1 text-slate-700">副担当者</label><Input value={subCheckerName} onChange={(e) => setSubCheckerName(e.target.value)} placeholder="サイン..." /></div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700">確認・問題があった場合などの詳細</label>
                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 border border-slate-200 rounded-md text-sm resize-none h-24 bg-white" placeholder="特記事項など..." />
                            </div>
                            <Button onClick={handleSave} disabled={isSaving || !testDate || !lotCode} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold h-12 shadow-md mt-4">
                                {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} この検査結果を保存する
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}