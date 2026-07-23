"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Printer, ArrowLeft, GitMerge, Lock, Edit2, FilePlus, Plus, Trash2, ArrowDown, AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Product = { id: string; name: string; variant_name: string; };

type FlowMaterialStorage = "room" | "cold" | "freeze" | "freeze_water" | "none";

type FlowMaterial = {
    id: string;
    no: string;
    name: string;
    storage: FlowMaterialStorage;
    target_step_id: string;
};

type FlowStep = {
    id: string;
    zone: string;
    step_name: string;
    details: string;
    is_ccp: boolean;
    ccp_no: string;
};

type ManufacturingFlow = {
    product_id: string;
    doc_no: string;
    established_date: string;
    revised_date: string;
    author_name: string;
    materials: FlowMaterial[];
    flow_steps: FlowStep[];
    updated_at: string;
};

type ViewMode = 'list' | 'edit' | 'print';
type FlowNode = {
    id: string;
    type: 'material' | 'storage' | 'step';
    label: string;
    no?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    data?: FlowMaterial | FlowStep;
    texts?: string[];
};

type FlowEdge = {
    from: string;
    to: string;
    type: 'right' | 'direct' | 'left' | 'main';
};

// 描画エリアのサイズ (単位: mm)
const CANVAS_W = 180;
const CANVAS_H = 240;

export default function ManufacturingFlowsPage() {
    const { canEdit } = useAuth();
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [loading, setLoading] = useState(true);

    const [products, setProducts] = useState<Product[]>([]);
    const [flows, setFlows] = useState<Record<string, ManufacturingFlow>>({});

    const [editingProductId, setEditingProductId] = useState("");
    const [formData, setFormData] = useState<Partial<ManufacturingFlow>>({});
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: pData } = await supabase.from('products').select('*').order('id');
        const { data: fData } = await supabase.from('manufacturing_flows').select('*');

        if (pData) setProducts(pData as Product[]);
        if (fData) {
            const flowMap: Record<string, ManufacturingFlow> = {};
            (fData as ManufacturingFlow[]).forEach((flow) => {
                flowMap[flow.product_id] = flow;
            });
            setFlows(flowMap);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchData();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [fetchData]);

    const handleEdit = (productId: string) => {
        setEditingProductId(productId);
        const existing = flows[productId];

        if (existing) {
            // 互換性のためstorageの型を変換
            const mats = existing.materials?.map((m) => {
                const storage = m.storage === "room" || m.storage === "cold" || m.storage === "freeze" || m.storage === "freeze_water"
                    ? m.storage
                    : "none";
                return {
                    ...m,
                    id: m.id || Date.now().toString() + Math.random(),
                    storage,
                    target_step_id: m.target_step_id || ""
                } satisfies FlowMaterial;
            }) || [];
            const steps = existing.flow_steps?.map(s => ({ ...s, zone: s.zone || "" })) || [];
            setFormData({ ...existing, materials: mats, flow_steps: steps });
        } else {
            // 新規作成時のデフォルトテンプレート (PDFを再現)
            setFormData({
                doc_no: "YO-2", established_date: new Date().toLocaleDateString('ja-JP'), revised_date: "-", author_name: "",
                materials: [
                    { id: "m1", no: "1", name: "小麦粉", storage: "room", target_step_id: "s1" },
                    { id: "m2", no: "2", name: "コア粉", storage: "room", target_step_id: "s1" },
                    { id: "m3", no: "3", name: "水", storage: "room", target_step_id: "s1" },
                    { id: "m4", no: "5", name: "凍結全卵", storage: "freeze_water", target_step_id: "s2" },
                    { id: "m5", no: "6", name: "生イースト", storage: "cold", target_step_id: "s2" },
                    { id: "m6", no: "14", name: "マフィンカップ", storage: "none", target_step_id: "s6" },
                    { id: "m7", no: "16", name: "アルミ袋", storage: "none", target_step_id: "s10" },
                    { id: "m8", no: "17", name: "小箱", storage: "none", target_step_id: "s14" },
                    { id: "m9", no: "18", name: "外箱", storage: "none", target_step_id: "s18" },
                ],
                flow_steps: [
                    { id: "s1", zone: "準備", step_name: "計量", details: "レシピを参照し、製造予定数にあった分量のみを計量", is_ccp: false, ccp_no: "" },
                    { id: "s2", zone: "清潔", step_name: "ミキシング", details: "ミキサー使用 約36分\n練り終わった生地は専用容器に移し替え蓋をして搬送", is_ccp: false, ccp_no: "" },
                    { id: "s3", zone: "清潔", step_name: "ベンチタイム", details: "生地を専用容器に入れて蓋をした状態で15分休ませる", is_ccp: false, ccp_no: "" },
                    { id: "s4", zone: "清潔", step_name: "分割", details: "分割機使用\n空になった容器は蓋をしてミキサー前に移動", is_ccp: false, ccp_no: "" },
                    { id: "s5", zone: "清潔", step_name: "丸め", details: "手作業で丸め（衛生手袋着用）", is_ccp: false, ccp_no: "" },
                    { id: "s6", zone: "清潔", step_name: "カップ詰め", details: "マフィンカップに丸めた生地を詰める", is_ccp: false, ccp_no: "" },
                    { id: "s7", zone: "清潔", step_name: "発酵", details: "発酵室にて発酵（50～60℃、約15分）", is_ccp: false, ccp_no: "" },
                    { id: "s8", zone: "清潔", step_name: "焼成", details: "空になった鉄板にカップを敷きなおす", is_ccp: false, ccp_no: "" },
                    { id: "s9", zone: "清潔", step_name: "放冷", details: "交差汚染防止のため水撥ね等に気を付ける", is_ccp: false, ccp_no: "" },
                    { id: "s10", zone: "清潔", step_name: "自動充填", details: "真空充填機を使用し、アルミ袋に入れる\n※シール不良：機械を停止して点検", is_ccp: false, ccp_no: "" },
                    { id: "s11", zone: "清潔", step_name: "殺菌", details: "高温高圧殺菌機を使用\n中心温度80℃以上で10分", is_ccp: true, ccp_no: "CCP1" },
                    { id: "s12", zone: "清潔", step_name: "水切り", details: "製品に付着した水滴や汚れを拭き取る", is_ccp: false, ccp_no: "" },
                    { id: "s13", zone: "清潔", step_name: "折り成形", details: "自動折込機を使用し成形する", is_ccp: false, ccp_no: "" },
                    { id: "s14", zone: "清潔", step_name: "小箱入れ", details: "成形されたパンを小箱に入れる", is_ccp: false, ccp_no: "" },
                    { id: "s15", zone: "汚染", step_name: "印字", details: "小箱に賞味期限を印字", is_ccp: false, ccp_no: "" },
                    { id: "s16", zone: "汚染", step_name: "Ｘ線探知機", details: "硬質異物を含まないことを確認\n※異物混入：別場所に保管後に廃棄", is_ccp: true, ccp_no: "CCP2" },
                    { id: "s17", zone: "汚染", step_name: "シュリンク", details: "シュリンク包装機でラッピング", is_ccp: false, ccp_no: "" },
                    { id: "s18", zone: "汚染", step_name: "梱包", details: "小箱の状態を検品し段ボールに詰める", is_ccp: false, ccp_no: "" },
                    { id: "s19", zone: "汚染", step_name: "出荷", details: "送り先、数量を確認して出荷", is_ccp: false, ccp_no: "" },
                ],
            });
        }
        setViewMode('edit');
    };

    const handleSave = async () => {
        if (!editingProductId) return;
        setIsSaving(true);
        const payload = { product_id: editingProductId, ...formData, updated_at: new Date().toISOString() };
        const { error } = await supabase.from('manufacturing_flows').upsert(payload, { onConflict: 'product_id' });
        setIsSaving(false);
        if (error) alert("保存に失敗しました: " + error.message);
        else { alert("製造工程フロー図を保存しました！"); fetchData(); setViewMode('list'); }
    };

    const getProductName = (id: string) => {
        const p = products.find(p => p.id === id);
        return p ? `${p.name} (${p.variant_name})` : "";
    };

    const addMaterial = () => {
        const newNo = ((formData.materials?.length || 0) + 1).toString();
        const newMat: FlowMaterial = { id: Date.now().toString(), no: newNo, name: "", storage: "none", target_step_id: "" };
        setFormData(prev => ({ ...prev, materials: [...(prev.materials || []), newMat] }));
    };
    const updateMaterial = (index: number, field: keyof FlowMaterial, value: string | FlowMaterialStorage) => {
        setFormData(prev => {
            const newMats = [...(prev.materials || [])];
            newMats[index] = { ...newMats[index], [field]: value } as FlowMaterial;
            return { ...prev, materials: newMats };
        });
    };
    const removeMaterial = (index: number) => {
        setFormData(prev => ({ ...prev, materials: (prev.materials || []).filter((_, i) => i !== index) }));
    };

    const addStep = () => {
        const newStep: FlowStep = { id: `s${Date.now()}`, zone: "", step_name: "", details: "", is_ccp: false, ccp_no: "" };
        setFormData(prev => ({ ...prev, flow_steps: [...(prev.flow_steps || []), newStep] }));
    };
    const updateStep = (index: number, field: keyof FlowStep, value: string | boolean) => {
        setFormData(prev => {
            const newSteps = [...(prev.flow_steps || [])];
            newSteps[index] = { ...newSteps[index], [field]: value } as FlowStep;
            if (field === 'is_ccp' && !value) newSteps[index].ccp_no = "";
            return { ...prev, flow_steps: newSteps };
        });
    };
    const removeStep = (index: number) => {
        setFormData(prev => {
            const removedStepId = prev.flow_steps?.[index].id;
            const newSteps = (prev.flow_steps || []).filter((_, i) => i !== index);
            const newMats = (prev.materials || []).map(m => m.target_step_id === removedStepId ? { ...m, target_step_id: "" } : m);
            return { ...prev, flow_steps: newSteps, materials: newMats };
        });
    };
    const moveStep = (index: number, direction: 'up' | 'down') => {
        setFormData(prev => {
            const newSteps = [...(prev.flow_steps || [])];
            if (direction === 'up' && index > 0) {
                [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
            } else if (direction === 'down' && index < newSteps.length - 1) {
                [newSteps[index + 1], newSteps[index]] = [newSteps[index], newSteps[index + 1]];
            }
            return { ...prev, flow_steps: newSteps };
        });
    };

    // =======================================================================
    // 描画ロジック (自動ルーティング計算)
    // =======================================================================
    const { nodes, edges } = useMemo(() => {
        if (viewMode !== 'print' || !editingProductId) return { nodes: [], edges: [] };
        const flow = flows[editingProductId] || formData;
        const materials = flow.materials || [];
        const steps = flow.flow_steps || [];

        const nds: FlowNode[] = [];
        const egs: FlowEdge[] = [];

        // Y座標の定義
        const Y_MAT = 5;
        const Y_STORE = 22;
        const Y_WATER = 35; // 流水解凍
        const Y_STEP_START = 45;
        const Y_STEP_END = 230;
        const STEP_H = steps.length > 0 ? (Y_STEP_END - Y_STEP_START) / steps.length : 10;

        // X座標の定義
        const MAIN_X = 25; // メイン工程のX位置

        // 1. 原料と資材の配置 (左側と右側に分ける)
        const matLeft = materials.filter(m => m.storage !== 'none');
        const matRight = materials.filter(m => m.storage === 'none');

        matLeft.forEach((m, i) => {
            const x = 5 + (i * (80 / Math.max(matLeft.length, 1)));
            nds.push({ id: m.id, type: 'material', label: m.name, no: m.no, x, y: Y_MAT, w: 10, h: 6, data: m });
        });
        matRight.forEach((m, i) => {
            const x = 110 + (i * (60 / Math.max(matRight.length, 1)));
            nds.push({ id: m.id, type: 'material', label: m.name, no: m.no, x, y: Y_MAT, w: 10, h: 6, data: m });
        });

        // 2. 保存ノードの配置
        const stores = [
            { id: 'st_room', label: '19\n常温保存', x: 15, y: Y_STORE, w: 16, h: 8, texts: [] },
            { id: 'st_freeze', label: '20\n冷凍保存', x: 45, y: Y_STORE, w: 16, h: 8, texts: ["-18℃管理"] },
            { id: 'st_cold', label: '21\n冷蔵保存', x: 75, y: Y_STORE, w: 16, h: 8, texts: ["5℃管理"] },
            { id: 'st_water', label: '22\n流水解凍', x: 45, y: Y_WATER, w: 16, h: 8, texts: ["流水解凍"] },
        ];
        stores.forEach(st => nds.push({ ...st, type: 'storage' }));

        // 3. メイン工程ノードの配置
        steps.forEach((s, i) => {
            nds.push({ id: s.id, type: 'step', label: `${23 + i}\n${s.step_name}`, x: MAIN_X, y: Y_STEP_START + (i * STEP_H), w: 18, h: 6, data: s });
        });

        // 4. エッジ（配線）の生成
        materials.forEach(m => {
            if (!m.target_step_id) return;
            if (m.storage === 'none') {
                egs.push({ from: m.id, to: m.target_step_id, type: 'right' });
            } else if (m.storage === 'freeze_water') {
                egs.push({ from: m.id, to: 'st_freeze', type: 'direct' });
                egs.push({ from: 'st_freeze', to: 'st_water', type: 'direct' });
                egs.push({ from: 'st_water', to: m.target_step_id, type: 'left' });
            } else {
                const stId = `st_${m.storage}`;
                egs.push({ from: m.id, to: stId, type: 'direct' });
                egs.push({ from: stId, to: m.target_step_id, type: 'left' });
            }
        });

        steps.forEach((s, i) => {
            if (i < steps.length - 1) {
                egs.push({ from: s.id, to: steps[i + 1].id, type: 'main' });
            }
        });

        return { nodes: nds, edges: egs };
    }, [viewMode, editingProductId, flows, formData]);

    const drawPath = (edge: FlowEdge) => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return "";

        const x1 = fromNode.x;
        const y1 = fromNode.y + fromNode.h; // 下端
        const x2 = toNode.x;
        const y2 = toNode.y; // 上端または横

        if (edge.type === 'direct' || edge.type === 'main') {
            const yMid = (y1 + y2) / 2;
            return `M ${x1} ${y1} V ${yMid} H ${x2} V ${y2}`;
        } else if (edge.type === 'left') {
            // 左を回って、ターゲットの左端へ刺さる
            const tLeft = toNode.x - (toNode.w / 2);
            // 重なりを避けるため、X位置をずらす
            const detourX = Math.min(x1, tLeft) - 5;
            return `M ${x1} ${y1} V ${y1 + 2} H ${detourX} V ${y2 + toNode.h / 2} H ${tLeft}`;
        } else if (edge.type === 'right') {
            // 右を回って、ターゲットの右端へ刺さる
            const tRight = toNode.x + (toNode.w / 2);
            // 他の線と重ならないように、fromNodeのXに依存した迂回Xを計算
            const detourX = Math.max(x1, tRight) + 2 + (x1 % 10);
            return `M ${x1} ${y1} V ${y1 + 2} H ${detourX} V ${y2 + toNode.h / 2} H ${tRight}`;
        }
        return "";
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー
    // =======================================================================
    if (viewMode === 'print' && editingProductId) {
        const flow = flows[editingProductId] || formData;
        const steps = flow.flow_steps || [];

        // ゾーンラベルの計算
        const zones: Array<{ name: string; startY: number; endY: number }> = [];
        let currentZone = "";
        steps.forEach((s) => {
            const n = nodes.find(nd => nd.id === s.id);
            if (!n) return;
            if (s.zone !== currentZone) {
                if (currentZone) zones[zones.length - 1].endY = n.y;
                currentZone = s.zone;
                zones.push({ name: s.zone, startY: n.y, endY: 230 });
            }
        });

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
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
                        <Printer className="h-5 w-5 mr-2" /> 印刷する (PDF)
                    </Button>
                </div>

                <div className="w-[210mm] h-[297mm] bg-white py-8 px-10 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col relative overflow-hidden">

                    {/* --- ヘッダー --- */}
                    <div className="w-full flex justify-between items-end mb-2 shrink-0 border-b-2 border-black pb-1 relative z-20">
                        <h1 className="text-xl font-bold tracking-widest">
                            製造工程フロー図 ({getProductName(editingProductId)})
                        </h1>
                        <table className="border-collapse border border-black text-[9px] text-center w-30">
                            <tbody>
                                <tr>
                                    <td className="border-none bg-transparent"></td>
                                    <th className="border border-black font-medium py-0.5 w-12">施設長</th>
                                    <th className="border border-black font-medium py-0.5 w-12">担当者</th>
                                </tr>
                                <tr>
                                    <td className="p-0">
                                        <table className="w-full border-collapse">
                                            <tbody>
                                                <tr><th className="border-t border-b border-l border-r border-black font-medium px-1 py-0.5 whitespace-nowrap bg-gray-50">文章No.</th><td className="border-t border-b border-black font-bold px-1 py-0.5">{flow.doc_no}</td></tr>
                                                <tr><th className="border-b border-l border-r border-black font-medium px-1 py-0.5 whitespace-nowrap bg-gray-50">制定日</th><td className="border-b border-black font-bold px-1 py-0.5">{flow.established_date}</td></tr>
                                                <tr><th className="border-b border-l border-r border-black font-medium px-1 py-0.5 whitespace-nowrap bg-gray-50">改定日</th><td className="border-b border-black font-bold px-1 py-0.5">{flow.revised_date}</td></tr>
                                            </tbody>
                                        </table>
                                    </td>
                                    <td className="border border-black h-12" rowSpan={3}></td>
                                    <td className="border border-black h-12" rowSpan={3}></td>
                                </tr>
                                <tr>
                                    <td className="border-b border-l border-black text-[8px] py-0.5 bg-gray-50" colSpan={1}>WCやまびこ</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* --- SVG & HTML 描画エリア --- */}
                    <div className="flex-1 w-full relative">
                        {/* SVG レイヤー */}
                        <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
                            <defs>
                                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                                    <path d="M 0 0 L 10 5 L 0 10 z" fill="black" />
                                </marker>
                            </defs>

                            {/* 枠の背景 (原料受入エリアなど) */}
                            <rect x="0" y="0" width="180" height="20" fill="#f8fafc" stroke="black" strokeWidth="0.5" strokeDasharray="2 2" />
                            <text x="2" y="4" fontSize="3" fontWeight="bold">原料受入</text>

                            {/* 線 */}
                            {edges.map((edge, i) => {
                                const isMain = edge.type === 'main';
                                return (
                                    <path key={i} d={drawPath(edge)} fill="none" stroke="black" strokeWidth="0.5" markerEnd={!isMain || edge.to === 's19' ? "" : "url(#arrow)"} />
                                );
                            })}
                        </svg>

                        {/* HTML ノードレイヤー */}
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">

                            {/* ゾーンラベル */}
                            {zones.map((z, i) => (
                                <div key={i} className="absolute border border-black bg-white flex items-center justify-center text-[7px] font-bold"
                                    style={{
                                        left: '0', top: `${(z.startY / CANVAS_H) * 100}%`,
                                        width: '4%', height: `${((z.endY - z.startY) / CANVAS_H) * 100}%`,
                                        writingMode: 'vertical-rl', letterSpacing: '2px'
                                    }}>
                                    {z.name}
                                </div>
                            ))}

                            {/* ノード群 */}
                            {nodes.map(n => {
                                const left = (n.x / CANVAS_W) * 100;
                                const top = (n.y / CANVAS_H) * 100;
                                const width = (n.w / CANVAS_W) * 100;
                                const height = (n.h / CANVAS_H) * 100;

                                if (n.type === 'material') {
                                    return (
                                        <div key={n.id} className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%` }}>
                                            <div className="text-[6px] font-bold leading-none mb-0.5">{n.no}</div>
                                            <div className="border border-black bg-white w-full h-6 flex items-center justify-center text-center text-[7px] font-bold shadow-sm leading-tight p-0.5">
                                                {n.label}
                                            </div>
                                        </div>
                                    );
                                }

                                if (n.type === 'storage') {
                                    return (
                                        <div key={n.id} className="absolute border border-black bg-gray-50 flex items-center justify-center text-center text-[8px] font-bold shadow-sm whitespace-pre-wrap -translate-x-1/2"
                                            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}>
                                            {n.label}
                                        </div>
                                    );
                                }

                                if (n.type === 'step') {
                                    const step = n.data as FlowStep;
                                    return (
                                        <div key={n.id} className="absolute flex items-center -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%`, width: '100%' }}>
                                            {/* CCPラベル */}
                                            {step.is_ccp && (
                                                <div className="absolute font-black text-red-600 text-[8px]" style={{ left: '6%' }}>{step.ccp_no}</div>
                                            )}
                                            {/* 工程名枠 */}
                                            <div className={`border shadow-sm flex items-center justify-center text-center font-bold text-[9px] whitespace-pre-wrap leading-tight p-0.5 ${step.is_ccp ? 'border-[1.5px] border-red-600 bg-red-50 text-red-800' : 'border-black bg-white'}`}
                                                style={{ width: `${width}%`, height: `${height}%`, marginLeft: '12%' }}>
                                                {n.label}
                                            </div>
                                            {/* 詳細テキスト */}
                                            <div className="ml-2 text-[8px] leading-tight text-slate-800 whitespace-pre-wrap max-w-[40%] bg-white/80 p-0.5">
                                                {step.details}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =======================================================================
    // 編集画面
    // =======================================================================
    if (viewMode === 'edit') {
        return (
            <div className="max-w-4xl mx-auto pb-12">
                <div className="flex items-center justify-between mb-6">
                    <Button variant="outline" onClick={() => setViewMode('list')} className="font-bold border-slate-300">
                        <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
                    </Button>
                    <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <GitMerge className="h-6 w-6 text-purple-600" /> 製造工程フロー図の編集
                    </h1>
                </div>

                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <CardTitle className="text-lg text-slate-800">対象製品: {getProductName(editingProductId)}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">

                        {/* 文書情報 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border">
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-700">作成者</label>
                                <Input value={formData.author_name || ""} onChange={e => setFormData({ ...formData, author_name: e.target.value })} className="bg-white h-9" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-700">文章No.</label>
                                <Input value={formData.doc_no || ""} onChange={e => setFormData({ ...formData, doc_no: e.target.value })} className="bg-white h-9" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-700">制定日</label>
                                <Input value={formData.established_date || ""} onChange={e => setFormData({ ...formData, established_date: e.target.value })} className="bg-white h-9" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-700">改定日</label>
                                <Input value={formData.revised_date || ""} onChange={e => setFormData({ ...formData, revised_date: e.target.value })} className="bg-white h-9" placeholder="-" />
                            </div>
                        </div>

                        {/* --- 原材料リスト (番号連携用) --- */}
                        <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200 shadow-inner">
                            <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">連携用</span> 原材料・資材リスト (配線設定)
                            </h3>
                            <div className="space-y-2">
                                {(formData.materials || []).map((mat, idx) => (
                                    <div key={mat.id || idx} className="flex flex-col sm:flex-row items-center gap-2 bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
                                        <Input value={mat.no} onChange={e => updateMaterial(idx, 'no', e.target.value)} placeholder="No" className="w-16 h-9 text-xs font-bold text-center px-1" />
                                        <Input value={mat.name} onChange={e => updateMaterial(idx, 'name', e.target.value)} placeholder="名称 (例: 小麦粉)" className="w-full sm:w-40 h-9 text-xs px-2" />

                                        <select value={mat.storage || "none"} onChange={e => updateMaterial(idx, 'storage', e.target.value)} className="w-full sm:w-36 h-9 text-xs px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-400">
                                            <option value="none">直接投入 (資材等)</option>
                                            <option value="room">常温保存</option>
                                            <option value="cold">冷蔵保存</option>
                                            <option value="freeze">冷凍保存</option>
                                            <option value="freeze_water">冷凍保存 → 流水解凍</option>
                                        </select>

                                        <select value={mat.target_step_id || ""} onChange={e => updateMaterial(idx, 'target_step_id', e.target.value)} className="w-full sm:flex-1 h-9 text-xs px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-400">
                                            <option value="">投入工程を選択 (合流先)...</option>
                                            {(formData.flow_steps || []).map(step => (
                                                <option key={step.id} value={step.id}>{step.step_name || "(未入力)"}</option>
                                            ))}
                                        </select>

                                        <Button variant="ghost" size="icon" onClick={() => removeMaterial(idx)} className="h-9 w-9 text-red-500 hover:bg-red-50 shrink-0"><X className="w-4 h-4" /></Button>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={addMaterial} variant="outline" size="sm" className="mt-2 text-blue-600 border-blue-200 hover:bg-blue-50 font-bold">
                                <Plus className="w-4 h-4 mr-1" /> 原材料・資材を追加
                            </Button>
                        </div>

                        {/* フローのステップ構築 */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800 border-b pb-2">工程 (ステップ) の設定</h3>

                            {(formData.flow_steps || []).map((step, idx) => (
                                <div key={step.id} className={`flex gap-3 items-start p-3 rounded-lg border shadow-sm transition-colors ${step.is_ccp ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200'}`}>
                                    <div className="flex flex-col gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => moveStep(idx, 'up')} disabled={idx === 0} className="h-6 w-6"><ArrowDown className="w-4 h-4 rotate-180 text-slate-400" /></Button>
                                        <div className="text-center font-bold text-slate-400 text-xs">{idx + 1}</div>
                                        <Button variant="ghost" size="icon" onClick={() => moveStep(idx, 'down')} disabled={idx === (formData.flow_steps?.length || 0) - 1} className="h-6 w-6"><ArrowDown className="w-4 h-4 text-slate-400" /></Button>
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">区域(ゾーン)</label>
                                            <Input value={step.zone || ""} onChange={e => updateStep(idx, 'zone', e.target.value)} placeholder="例: 清潔" className="font-bold text-xs" />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">工程名</label>
                                            <Input value={step.step_name} onChange={e => updateStep(idx, 'step_name', e.target.value)} placeholder="例: 計量" className={`font-bold ${step.is_ccp ? 'border-red-300' : ''}`} />
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">詳細・管理内容</label>
                                            <textarea value={step.details} onChange={e => updateStep(idx, 'details', e.target.value)} placeholder="例: レシピ通りに正確に計量" className={`w-full p-2 border rounded-md text-xs resize-none h-16 ${step.is_ccp ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-400'}`} />
                                        </div>
                                        <div className="md:col-span-3 flex flex-col justify-end">
                                            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border shadow-sm">
                                                <input type="checkbox" checked={step.is_ccp} onChange={e => updateStep(idx, 'is_ccp', e.target.checked)} className="w-4 h-4 text-red-600 rounded border-slate-300" />
                                                <span className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> CCPに設定</span>
                                            </label>
                                            {step.is_ccp && (
                                                <Input value={step.ccp_no} onChange={e => updateStep(idx, 'ccp_no', e.target.value)} placeholder="例: CCP-1" className="h-7 text-xs mt-1 border-red-400 font-bold text-red-700" />
                                            )}
                                        </div>
                                    </div>

                                    <Button variant="ghost" size="icon" onClick={() => removeStep(idx)} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 mt-5"><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            ))}

                            <div className="flex justify-center mt-4">
                                <Button onClick={addStep} variant="outline" className="border-dashed border-2 border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 w-full font-bold h-12">
                                    <Plus className="w-5 h-5 mr-2" /> 次の工程を追加する
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 border-t mt-6">
                            <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 px-12 shadow-md">
                                {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} 保存する
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // =======================================================================
    // 一覧画面
    // =======================================================================
    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <GitMerge className="h-6 w-6 text-purple-600" />
                        製造工程フロー図 (HACCP)
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50 border-b py-4">
                    <CardTitle className="text-lg text-slate-800">製品一覧</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="w-full min-w-175 text-sm">
                            <TableHeader className="bg-slate-100">
                                <TableRow>
                                    <TableHead className="w-32 pl-4">製品ID</TableHead>
                                    <TableHead>製品名 / 味</TableHead>
                                    <TableHead className="w-32 text-center">作成状況</TableHead>
                                    <TableHead className="w-48 text-center pr-4">アクション</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 text-slate-400 mx-auto" /></TableCell></TableRow> : (
                                    products.map(p => {
                                        const hasFlow = !!flows[p.id];
                                        return (
                                            <TableRow key={p.id} className="hover:bg-slate-50">
                                                <TableCell className="pl-4 font-bold text-slate-500 font-mono">{p.id}</TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-800 text-base">{p.name}</div>
                                                    <div className="text-sm text-slate-500">{p.variant_name}</div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {hasFlow ? (
                                                        <Badge className="bg-green-100 text-green-700 border-none shadow-sm">作成済</Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-100 text-slate-500 border-none shadow-sm">未作成</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center pr-4">
                                                    <div className="flex justify-center gap-2">
                                                        {hasFlow && (
                                                            <Button variant="outline" size="sm" onClick={() => { setEditingProductId(p.id); setViewMode('print'); }} className="h-8 px-3 border-slate-300 hover:bg-slate-100">
                                                                <Printer className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canEdit && (
                                                            <Button variant={hasFlow ? "outline" : "default"} size="sm" onClick={() => handleEdit(p.id)} className={`h-8 px-3 ${hasFlow ? 'border-purple-200 text-purple-700 hover:bg-purple-50' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'}`}>
                                                                {hasFlow ? <><Edit2 className="h-4 w-4 mr-1.5" /> 編集</> : <><FilePlus className="h-4 w-4 mr-1.5" /> 作成</>}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}