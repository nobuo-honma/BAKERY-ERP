"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Package, Truck, Factory, LineChart, Eye, FileSpreadsheet, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type TraceResult = {
    lotCode: string;
    productName: string;
    expiryDate: string;
    totalProduced: number; // 個数
    shipments: ShipmentTraceRow[];
    productionPlan: ProductionPlanTraceRow | null;
    fujiSteamyLogs: FujiSteamyTraceRow[];
    sensoryTest: SensoryTraceRow | null;
    boms: BomTraceRow[]; // 使用原料
};

type ShipmentTraceRow = {
    ship_date: string;
    qty_cs: number;
    qty_piece: number;
    orders?: {
        customer_order_no?: string | null;
        customers?: { name?: string | null } | null;
    } | null;
};

type ProductionPlanTraceRow = {
    product_id?: string | null;
    production_date?: string | null;
    actual_cs?: number | null;
    actual_piece?: number | null;
    planned_units?: number | null;
    products?: { name?: string | null; variant_name?: string | null; unit_per_cs?: number | null } | null;
};

type FujiSteamyTraceRow = Record<string, unknown>;
type SensoryTraceRow = {
    test_date?: string | null;
    checker_name?: string | null;
    sub_checker_name?: string | null;
    results?: Record<string, string[] | string>;
    notes?: string | null;
};

type BomTraceRow = {
    usage_rate?: number | null;
    unit?: string | null;
    items?: {
        name?: string | null;
        item_type?: string | null;
    } | null;
};

// =======================================================================
// 官能検査結果のキーを日本語に変換するためのマッピング定義
// =======================================================================
const SENSORY_LABELS: Record<string, { category: string, label: string }> = {
    "box_visual": { category: "小箱の状態", label: "視覚（目）" },
    "box_olfactory": { category: "小箱の状態", label: "嗅覚（鼻）" },
    "box_tactile": { category: "小箱の状態", label: "触覚（皮膚）" },
    "alu_visual": { category: "アルミの状態", label: "視覚（目）" },
    "alu_olfactory": { category: "アルミの状態", label: "嗅覚（鼻）" },
    "alu_tactile": { category: "アルミの状態", label: "触覚（皮膚）" },
    "bread_visual": { category: "パンの状態", label: "視覚（目）" },
    "bread_olfactory": { category: "パンの状態", label: "嗅覚（鼻）" },
    "bread_gustatory": { category: "パンの状態", label: "味覚（舌）" },
    "bread_tactile": { category: "パンの状態", label: "触覚（皮膚）" },
};

export default function TraceabilityPage() {
    const { canEdit } = useAuth();
    const [searchLot, setSearchLot] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TraceResult | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    const handleSearch = async () => {
        if (!searchLot.trim()) return;
        setLoading(true);
        setErrorMsg("");
        setResult(null);

        try {
            // 1. まず製品在庫(product_stocks) または 製造計画(production_plans) から対象Lotを探す
            const { data: stockData } = await supabase.from('product_stocks')
                .select('product_id, expiry_date, products!inner(name, variant_name, unit_per_cs)')
                .eq('lot_code', searchLot)
                .maybeSingle();

            const { data: planData } = await supabase.from('production_plans')
                .select('product_id, production_date, actual_cs, actual_piece, planned_units, products!inner(name, variant_name, unit_per_cs)')
                .eq('lot_code', searchLot)
                .maybeSingle();

            if (!stockData && !planData) {
                setErrorMsg(`Lot番号「${searchLot}」は見つかりませんでした。`);
                setLoading(false);
                return;
            }

            const rawSProduct = stockData?.products;
            const sProduct = (Array.isArray(rawSProduct) ? rawSProduct[0] : rawSProduct) as { name?: string | null; variant_name?: string | null; unit_per_cs?: number | null } | null;
            const rawPProduct = planData?.products;
            const pProduct = (Array.isArray(rawPProduct) ? rawPProduct[0] : rawPProduct) as { name?: string | null; variant_name?: string | null; unit_per_cs?: number | null } | null;

            const productId = stockData?.product_id || planData?.product_id;
            const productName = stockData ? `${sProduct?.name ?? ""} (${sProduct?.variant_name ?? ""})` : `${pProduct?.name ?? ""} (${pProduct?.variant_name ?? ""})`;
            const expiryDate = stockData?.expiry_date || "-";
            const unitPerCs = (stockData ? sProduct?.unit_per_cs : pProduct?.unit_per_cs) || 24;

            // 製造数の算出 (実績があれば実績、なければ計画数)
            let totalProduced = 0;
            if (planData) {
                if (planData.actual_cs !== null) {
                    totalProduced = (planData.actual_cs * unitPerCs) + ((planData.actual_piece || 0) * 2);
                } else {
                    totalProduced = planData.planned_units || 0;
                }
            }

            // 2. 出荷先履歴を検索
            const { data: shipments } = await supabase.from('shipments')
                .select('ship_date, qty_cs, qty_piece, orders(customer_order_no, customers(name))')
                .eq('lot_code', searchLot)
                .order('ship_date', { ascending: false });

            // 3. フジスチーミー記録を検索
            const { data: fujiLogs } = await supabase.from('fuji_steamy_logs')
                .select('*')
                // 計画の製造日と製品IDが一致するものを取得（近似値）
                .eq('work_date', planData?.production_date)
                .eq('product_name', productName.split(' ')[0]);

            // 4. 官能検査結果を検索
            const { data: sensory } = await supabase.from('sensory_tests')
                .select('*')
                .eq('lot_code', searchLot)
                .maybeSingle();

            // 5. BOM（使用原料レシピ）を検索
            const { data: boms } = await supabase.from('bom')
                .select('usage_rate, unit, items(name, item_type)')
                .eq('product_id', productId);

            const normalizedPlan: ProductionPlanTraceRow | null = planData
                ? {
                    product_id: planData.product_id,
                    production_date: planData.production_date,
                    actual_cs: planData.actual_cs,
                    actual_piece: planData.actual_piece,
                    planned_units: planData.planned_units,
                    products: pProduct,
                  }
                : null;

            setResult({
                lotCode: searchLot,
                productName,
                expiryDate,
                totalProduced,
                shipments: (shipments as any) || [],
                productionPlan: normalizedPlan,
                fujiSteamyLogs: fujiLogs || [],
                sensoryTest: sensory || null,
                boms: boms || []
            });

        } catch (err: unknown) {
            console.error(err);
            setErrorMsg("検索中にエラーが発生しました。");
        }
        setLoading(false);
    };

    // =======================================================================
    // 官能検査のJSONデータをパースして、カテゴリ別にグループ化する関数
    // =======================================================================
    const renderSensoryResults = (resultsObj: Record<string, string[] | string> | null | undefined) => {
        if (!resultsObj) return null;

        const grouped: Record<string, { label: string, values: string[], other?: string }[]> = {
            "小箱の状態": [],
            "アルミの状態": [],
            "パンの状態": []
        };

        Object.keys(resultsObj).forEach(key => {
            if (key.endsWith('_other_text')) return; // その他テキストは別途処理

            const def = SENSORY_LABELS[key];
            if (def) {
                grouped[def.category].push({
                    label: def.label,
                    values: resultsObj[key],
                    other: resultsObj[`${key}_other_text`]
                });
            }
        });

        return (
            <div className="space-y-4 mt-2">
                {Object.keys(grouped).map(category => (
                    <div key={category} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 border-b border-slate-200">
                            {category}
                        </div>
                        <div className="divide-y divide-slate-100 bg-white">
                            {grouped[category].map((item, idx) => {
                                const isProblem = item.values.some(v => v !== "問題ない" && v !== "規格内");
                                return (
                                    <div key={idx} className="px-3 py-2 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 text-xs">
                                        <div className="w-20 font-bold text-slate-500 shrink-0">{item.label}</div>
                                        <div className="flex-1 flex flex-wrap gap-1.5">
                                            {item.values.map((val, vIdx) => {
                                                const isOk = val === "問題ない" || val === "規格内";
                                                return (
                                                    <span key={vIdx} className={`px-2 py-0.5 rounded font-bold ${isOk ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                        {val}
                                                    </span>
                                                );
                                            })}
                                            {item.other && <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">詳細: {item.other}</span>}
                                            {/* 全て問題ない場合のアイコン補足 */}
                                            {!isProblem && <CheckCircle2 className="w-4 h-4 text-blue-500 ml-1" />}
                                            {isProblem && <AlertCircle className="w-4 h-4 text-red-500 ml-1" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-transparent">
            <div className="flex items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <Search className="h-6 w-6 text-indigo-600" />
                    トレーサビリティ (追跡) 検索
                </h1>
                {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
            </div>

            <Card className="shadow-sm border-slate-200 mb-8 bg-indigo-50/30">
                <CardContent className="pt-6 pb-6">
                    <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-4">
                        <Input
                            value={searchLot}
                            onChange={e => setSearchLot(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                            placeholder="追跡したいLot番号を入力... (例: スB26SB)"
                            className="h-14 text-xl font-bold border-indigo-300 shadow-sm bg-white"
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={loading || !searchLot.trim()}
                            className="w-full sm:w-auto h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-md shrink-0"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Search className="w-5 h-5 mr-2" />}
                            追跡・検索
                        </Button>
                    </div>
                    {errorMsg && <p className="text-center text-red-600 font-bold mt-4">{errorMsg}</p>}
                </CardContent>
            </Card>

            {result && (
                <div className="space-y-6 max-w-5xl mx-auto pb-12">

                    {/* 基本情報 */}
                    <Card className="border-indigo-200 shadow-md overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
                        <CardHeader className="bg-indigo-50/50 border-b pb-4 pl-8">
                            <CardTitle className="text-sm font-bold text-indigo-800 flex items-center gap-2"><Package className="w-4 h-4" /> 製品・Lot基本情報</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 pl-8 flex flex-col md:flex-row justify-between gap-6">
                            <div>
                                <div className="text-xs font-bold text-slate-500 mb-1">製品名</div>
                                <div className="text-2xl font-black text-slate-800 leading-tight">{result.productName}</div>
                            </div>
                            <div className="flex gap-8 md:gap-12 flex-wrap">
                                <div>
                                    <div className="text-xs font-bold text-slate-500 mb-1">対象Lot番号</div>
                                    <div className="text-2xl font-black text-indigo-700 tracking-wider">{result.lotCode}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-500 mb-1">賞味期限</div>
                                    <div className="text-xl font-bold text-slate-700">{result.expiryDate !== "-" ? new Date(result.expiryDate).toLocaleDateString('ja-JP') : "-"}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-500 mb-1">製造総数 (実績)</div>
                                    <div className="text-xl font-bold text-slate-700">{result.totalProduced > 0 ? `${result.totalProduced} 個` : "-"}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 左列：出荷先と使用原料 */}
                        <div className="space-y-6">

                            {/* 出荷履歴 */}
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="bg-slate-50 border-b py-3 px-4">
                                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><Truck className="w-4 h-4 text-purple-600" /> 出荷先履歴 (販売先)</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {result.shipments.length > 0 ? (
                                        <Table className="text-sm">
                                            <TableHeader className="bg-slate-100/50"><TableRow><TableHead>出荷日</TableHead><TableHead>出荷先</TableHead><TableHead className="text-right">数量</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {result.shipments.map((s, i) => {
                                                    const orderObj = s.orders;
                                                    return (
                                                        <TableRow key={i}>
                                                            <TableCell className="font-bold text-xs">{new Date(s.ship_date).toLocaleDateString('ja-JP')}</TableCell>
                                                            <TableCell>
                                                                <div className="font-bold text-slate-800">{orderObj?.customers?.name || "不明"}</div>
                                                                {orderObj?.customer_order_no && <div className="text-[9px] text-slate-400">発注: {orderObj.customer_order_no}</div>}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-purple-700 whitespace-nowrap">
                                                                {s.qty_cs > 0 && <>{s.qty_cs}<span className="text-[10px] font-normal text-slate-500 ml-0.5">c/s</span></>}
                                                                {s.qty_piece > 0 && <span className="ml-1">{s.qty_piece}<span className="text-[10px] font-normal text-slate-500 ml-0.5">p</span></span>}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="p-6 text-center text-slate-400 text-xs font-bold">まだ出荷されていません</div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* 使用原料 */}
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="bg-slate-50 border-b py-3 px-4">
                                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><Factory className="w-4 h-4 text-amber-600" /> 使用された原材料 (BOM)</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 max-h-[300px] overflow-y-auto">
                                    {result.boms.length > 0 ? (
                                        <Table className="text-sm">
                                            <TableBody>
                                                {result.boms.filter((b) => b.items?.item_type === 'raw_material').map((b, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-bold text-slate-700">{b.items?.name}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="p-6 text-center text-slate-400 text-xs font-bold">BOM情報がありません</div>
                                    )}
                                </CardContent>
                            </Card>

                        </div>

                        {/* 右列：HACCPと温度記録 */}
                        <div className="space-y-6">

                            {/* 官能検査 */}
                            <Card className="border-slate-200 shadow-sm flex flex-col max-h-[500px]">
                                <CardHeader className="bg-slate-50 border-b py-3 px-4 flex flex-row items-center justify-between shrink-0">
                                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><Eye className="w-4 h-4 text-pink-600" /> 官能検査結果 (YO-30)</CardTitle>
                                    {result.sensoryTest && <Badge className="bg-green-100 text-green-700 shadow-none border-none">実施済</Badge>}
                                </CardHeader>
                                <CardContent className="p-4 overflow-y-auto">
                                    {result.sensoryTest ? (
                                        <div className="space-y-3">
                                            <div className="flex justify-between border-b pb-2 text-xs">
                                                <span className="text-slate-500 font-bold">実施日</span>
                                                <span className="font-bold">{new Date(result.sensoryTest.test_date).toLocaleDateString('ja-JP')}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2 text-xs">
                                                <span className="text-slate-500 font-bold">主担当</span>
                                                <span className="font-bold">{result.sensoryTest.checker_name || "不明"}</span>
                                            </div>
                                            {result.sensoryTest.sub_checker_name && (
                                                <div className="flex justify-between border-b pb-2 text-xs">
                                                    <span className="text-slate-500 font-bold">副担当</span>
                                                    <span className="font-bold">{result.sensoryTest.sub_checker_name}</span>
                                                </div>
                                            )}
                                            {/* ▼ 日本語化された検査結果の表示 ▼ */}
                                            {renderSensoryResults(result.sensoryTest.results)}

                                            {result.sensoryTest.notes && (
                                                <div className="mt-3 bg-pink-50/50 p-2 rounded border border-pink-100 text-xs">
                                                    <div className="font-bold text-pink-800 mb-1">備考・特記事項</div>
                                                    <div className="text-slate-700 whitespace-pre-wrap">{result.sensoryTest.notes}</div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-red-500 text-xs font-bold bg-red-50 rounded border border-red-100">官能検査が未実施、または見つかりません</div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* フジスチーミー記録 */}
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="bg-slate-50 border-b py-3 px-4">
                                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><LineChart className="w-4 h-4 text-cyan-600" /> フジスチーミー加熱記録</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {result.fujiSteamyLogs.length > 0 ? (
                                        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                                            {result.fujiSteamyLogs.map((log, i) => (
                                                <div key={i} className="p-4 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-mono mb-1">{log.batch_name}</div>
                                                        <div className="text-xs font-bold text-slate-700">開始: {log.start_time.split(' ')[1] || log.start_time}</div>
                                                        <div className="text-xs font-bold text-red-600">80℃: {log.reach_80_time !== "-" ? (log.reach_80_time.split(' ')[1] || log.reach_80_time) : "未達"}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xl font-black text-slate-800">{log.max_temp} <span className="text-[10px] font-normal text-slate-500">℃ (最高)</span></div>
                                                        <div className="text-xs font-bold text-slate-500">{log.avg_temp} <span className="text-[9px] font-normal">℃ (庫内平均)</span></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-slate-400 text-xs font-bold flex flex-col items-center">
                                            <FileSpreadsheet className="w-8 h-8 mb-2 opacity-30" />
                                            この製造日の加熱記録は見つかりません。<br />CSVがアップロードされていない可能性があります。
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}