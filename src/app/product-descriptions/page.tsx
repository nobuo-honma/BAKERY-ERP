"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Printer, ArrowLeft, FileText, Lock, Edit2, FilePlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Product = { id: string; name: string; variant_name: string; };
type ProductDesc = {
    product_id: string;
    product_name: string;
    product_type: string;
    ingredients: string;
    additives: string;
    allergens: string;
    packaging: string;
    packaging_inner: string;
    product_characteristics: string;
    product_standards: string;
    expiry_rule: string;
    storage_method: string;
    consumption_method: string;
    target_consumers: string;
    doc_no: string;
    established_date: string;
    revised_date: string;
    updated_at: string;
};

export default function ProductDescriptionsPage() {
    const { canEdit } = useAuth();
    const [viewMode, setViewMode] = useState<'list' | 'edit' | 'print'>('list');
    const [loading, setLoading] = useState(true);

    const [products, setProducts] = useState<Product[]>([]);
    const [descriptions, setDescriptions] = useState<Record<string, ProductDesc>>({});

    const [editingProductId, setEditingProductId] = useState("");
    const [formData, setFormData] = useState<Partial<ProductDesc>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: pData } = await supabase.from('products').select('*').order('id');
        const { data: dData } = await supabase.from('product_descriptions').select('*');

        if (pData) setProducts(pData as Product[]);
        if (dData) {
            const descMap: Record<string, ProductDesc> = {};
            dData.forEach(d => { descMap[d.product_id] = d; });
            setDescriptions(descMap);
        }
        setLoading(false);
    };

    const handleEdit = (productId: string) => {
        setEditingProductId(productId);
        const existing = descriptions[productId];
        const pInfo = products.find(p => p.id === productId);

        if (existing) {
            setFormData(existing);
        } else {
            // 新規作成時のデフォルトテンプレート (PDFの内容を反映)
            setFormData({
                product_name: pInfo ? `${pInfo.name} ${pInfo.variant_name}` : "",
                product_type: "災害用備蓄パン",
                ingredients: "ミックス粉（小麦、砂糖、脱脂粉乳、その他）、鶏卵、マーガリン、うるち米、乳等を主要原料とする食品、豆乳加工品（豆乳、大豆粉末）、ホワイトチョコレート、パン酵母、発酵風味液（砂糖、酵母エキス、食塩）/乳化剤、酒精、乳清ミネラル（ホエイソルト）、香料、ph調整剤、安定剤（ペクチン）、着色料（アナトー色素）（一部に小麦・乳成分・大豆を含む）\n原料原産地名：小麦（国内製造）、うるち米（北海道）",
                additives: "なし",
                allergens: "小麦、乳成分、卵、大豆",
                packaging: "台紙・トレー・小箱・外箱（段ボール）：紙",
                packaging_inner: "内装袋：アルミ・外装フィルム：プラ",
                product_characteristics: "内容量：１箱２個入り：（1個55ｇ）\nカロリー：397.1kcal/１箱\n【栄養成分】\nたんぱく質：9.57g、脂質：13.86g、炭水化物：58.63g、食塩相当量：0.391g",
                product_standards: "【自社基準】\n一般生菌数：３００個/ｇ以下\n大腸菌群：陰性\n黄色ブドウ球菌：陰性\nサルモネラ属菌：陰性\n真菌(カビ)：０個/ｇ",
                expiry_rule: "製造日より５年",
                storage_method: "直射日光・高温多湿を避けて常温で保存",
                consumption_method: "そのまま喫食",
                target_consumers: "一般消費者",
                doc_no: "YO-47",
                established_date: "2023/4/15",
                revised_date: "-"
            });
        }
        setViewMode('edit');
    };

    const handleSave = async () => {
        if (!editingProductId) return;
        setIsSaving(true);

        const payload = {
            product_id: editingProductId,
            ...formData,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('product_descriptions').upsert(payload, { onConflict: 'product_id' });
        setIsSaving(false);

        if (error) {
            alert("保存に失敗しました: " + error.message);
        } else {
            alert("製品説明書を保存しました！");
            fetchData();
            setViewMode('list');
        }
    };

    const getProductName = (id: string) => {
        const p = products.find(p => p.id === id);
        return p ? `${p.name} (${p.variant_name})` : "";
    };

    // =======================================================================
    // 印刷（PDF帳票）ビュー - A4用紙の縦いっぱいに広がるように最適化
    // =======================================================================
    if (viewMode === 'print' && editingProductId) {
        const desc = descriptions[editingProductId] || formData;

        return (
            <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        header, nav { display: none !important; }
                        main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
                        /* A4縦、上下マージン15mmずつ */
                        @page { size: A4 portrait; margin: 15mm 20mm; }
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

                {/* 
                  print:h-[267mm] : A4(297mm) - 上下マージン(30mm) に高さを固定。
                  これと flex-1 を組み合わせることで、テーブルがA4用紙の縦いっぱいに自動で引き伸ばされます。
                */}
                <div className="w-[210mm] h-[297mm] print:h-[267mm] bg-white py-10 px-8 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col items-stretch">

                    <div className="w-full flex justify-start mb-4 shrink-0">
                        <h1 className="text-3xl font-normal tracking-wide">製品説明書</h1>
                    </div>

                    {/* text-[13.5px] で文字を大きくし、leading-relaxed で行間を広げています */}
                    <table className="w-full flex-1 border-collapse border-2 border-black text-[13.5px] leading-relaxed">
                        <tbody>
                            {/* 1 */}
                            <tr>
                                <td rowSpan={2} className="border border-black text-center w-[5%] py-2 font-medium">1</td>
                                <td rowSpan={2} className="border border-black px-2 w-[30%] py-2 font-medium">製品の名称及び種類</td>
                                <td className="border border-black px-2 py-2 w-[15%] text-center font-medium">製品名</td>
                                <td className="border border-black px-4 py-2 w-[50%] font-medium">{desc.product_name}</td>
                            </tr>
                            <tr>
                                <td className="border border-black px-2 py-2 text-center font-medium">種類</td>
                                <td className="border border-black px-4 py-2 font-medium">{desc.product_type}</td>
                            </tr>
                            {/* 2 */}
                            <tr>
                                <td className="border border-black text-center py-2 font-medium">2</td>
                                <td className="border border-black px-2 py-2 font-medium">原材料の名称及び種類</td>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.ingredients}</td>
                            </tr>
                            {/* 3 */}
                            <tr>
                                <td className="border border-black text-center py-2 font-medium">3</td>
                                <td className="border border-black px-2 py-2 font-medium">使用基準のある添加物の名称及び<br />使用量</td>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.additives}</td>
                            </tr>
                            {/* 4 */}
                            <tr>
                                <td className="border border-black text-center py-2 font-medium">4</td>
                                <td className="border border-black px-2 py-2 font-medium">アレルギー物質</td>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.allergens}</td>
                            </tr>
                            {/* 5 */}
                            <tr>
                                <td rowSpan={2} className="border border-black text-center py-2 font-medium">5</td>
                                <td rowSpan={2} className="border border-black px-2 py-2 font-medium">包装容器の材質及び形態</td>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.packaging}</td>
                            </tr>
                            <tr>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.packaging_inner}</td>
                            </tr>
                            {/* 6 */}
                            <tr>
                                <td className="border border-black text-center py-2 font-medium">6</td>
                                <td className="border border-black px-2 py-2 font-medium">製品の特性</td>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.product_characteristics}</td>
                            </tr>
                            {/* 7 */}
                            <tr>
                                <td className="border border-black text-center py-2 font-medium">7</td>
                                <td className="border border-black px-2 py-2 font-medium">製品の規格</td>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.product_standards}</td>
                            </tr>
                            {/* 8 */}
                            <tr>
                                <td rowSpan={2} className="border border-black text-center py-2 font-medium">8</td>
                                <td rowSpan={2} className="border border-black px-2 py-2 font-medium">消費期限または賞味期限及び保<br />存方法</td>
                                <td className="border border-black px-2 py-2 text-center font-medium">賞味期限</td>
                                <td className="border border-black px-4 py-2 font-medium">{desc.expiry_rule}</td>
                            </tr>
                            <tr>
                                <td className="border border-black px-2 py-2 text-center font-medium">保存方法</td>
                                <td className="border border-black px-4 py-2 font-medium">{desc.storage_method}</td>
                            </tr>
                            {/* 9 */}
                            <tr>
                                <td className="border border-black text-center py-2 font-medium">9</td>
                                <td className="border border-black px-2 py-2 font-medium">喫食または利用の方法</td>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.consumption_method}</td>
                            </tr>
                            {/* 10 */}
                            <tr>
                                <td className="border border-black text-center py-2 font-medium">10</td>
                                <td className="border border-black px-2 py-2 font-medium">喫食対象とする消費者</td>
                                <td colSpan={2} className="border border-black px-4 py-2 whitespace-pre-wrap font-medium">{desc.target_consumers}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* サイン欄・文書情報 (下部に固定) */}
                    <div className="flex justify-end w-full mt-4 shrink-0">
                        <table className="border-collapse border border-black text-[12px] text-center">
                            <tbody>
                                <tr>
                                    <td colSpan={2} className="border-none bg-transparent"></td>
                                    <th className="border border-black w-24 font-normal py-1">施設長</th>
                                    <th className="border border-black w-24 font-normal py-1">担当者</th>
                                </tr>
                                <tr>
                                    <th className="border border-black px-4 font-normal py-1">文章No.</th>
                                    <td className="border border-black px-4 py-1 font-bold">{desc.doc_no}</td>
                                    <td className="border border-black h-24" rowSpan={4}></td>
                                    <td className="border border-black h-24" rowSpan={4}></td>
                                </tr>
                                <tr>
                                    <th className="border border-black px-4 font-normal py-1">制定日</th>
                                    <td className="border border-black px-4 py-1 font-bold">{desc.established_date}</td>
                                </tr>
                                <tr>
                                    <th className="border border-black px-4 font-normal py-1">改定日</th>
                                    <td className="border border-black px-4 py-1 font-bold">{desc.revised_date}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black px-4 py-1.5 font-bold" colSpan={2}>ワークセンター・やまびこ</td>
                                </tr>
                            </tbody>
                        </table>
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
                        <FileText className="h-6 w-6 text-blue-600" /> 製品説明書の編集
                    </h1>
                </div>

                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <CardTitle className="text-lg text-slate-800">対象製品: {getProductName(editingProductId)}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border">
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-slate-700">1. 製品名</label>
                                    <Input value={formData.product_name || ""} onChange={e => setFormData({ ...formData, product_name: e.target.value })} className="bg-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-slate-700">1. 種類</label>
                                    <Input value={formData.product_type || ""} onChange={e => setFormData({ ...formData, product_type: e.target.value })} className="bg-white" />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold mb-1 text-slate-700">2. 原材料の名称及び種類</label>
                                <textarea value={formData.ingredients || ""} onChange={e => setFormData({ ...formData, ingredients: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm resize-none h-32 bg-white focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold mb-1 text-slate-700">3. 使用基準のある添加物の名称及び使用量</label>
                                <Input value={formData.additives || ""} onChange={e => setFormData({ ...formData, additives: e.target.value })} className="bg-white" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold mb-1 text-slate-700">4. アレルギー物質</label>
                                <Input value={formData.allergens || ""} onChange={e => setFormData({ ...formData, allergens: e.target.value })} className="bg-white" />
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-slate-700">5. 包装容器の材質 (外装)</label>
                                    <Input value={formData.packaging || ""} onChange={e => setFormData({ ...formData, packaging: e.target.value })} className="bg-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-slate-700">5. 包装容器の材質 (内装)</label>
                                    <Input value={formData.packaging_inner || ""} onChange={e => setFormData({ ...formData, packaging_inner: e.target.value })} className="bg-white" />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold mb-1 text-slate-700">6. 製品の特性 (内容量・カロリー・栄養成分等)</label>
                                <textarea value={formData.product_characteristics || ""} onChange={e => setFormData({ ...formData, product_characteristics: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm resize-none h-24 bg-white focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold mb-1 text-slate-700">7. 製品の規格 (菌検査基準等)</label>
                                <textarea value={formData.product_standards || ""} onChange={e => setFormData({ ...formData, product_standards: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm resize-none h-24 bg-white focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700">8. 賞味期限</label>
                                <Input value={formData.expiry_rule || ""} onChange={e => setFormData({ ...formData, expiry_rule: e.target.value })} className="bg-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700">8. 保存方法</label>
                                <Input value={formData.storage_method || ""} onChange={e => setFormData({ ...formData, storage_method: e.target.value })} className="bg-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700">9. 喫食または利用の方法</label>
                                <Input value={formData.consumption_method || ""} onChange={e => setFormData({ ...formData, consumption_method: e.target.value })} className="bg-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700">10. 喫食対象とする消費者</label>
                                <Input value={formData.target_consumers || ""} onChange={e => setFormData({ ...formData, target_consumers: e.target.value })} className="bg-white" />
                            </div>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border mt-4">
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
                        </div>

                        <div className="flex justify-end pt-6 border-t mt-6">
                            <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-12 shadow-md">
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
                        <FileText className="h-6 w-6 text-blue-600" />
                        製品説明書 (HACCP)
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
                        <Table className="w-full min-w-[700px] text-sm">
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
                                        const hasDesc = !!descriptions[p.id];
                                        return (
                                            <TableRow key={p.id} className="hover:bg-slate-50">
                                                <TableCell className="pl-4 font-bold text-slate-500 font-mono">{p.id}</TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-800 text-base">{p.name}</div>
                                                    <div className="text-sm text-slate-500">{p.variant_name}</div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {hasDesc ? (
                                                        <Badge className="bg-green-100 text-green-700 border-none shadow-sm">作成済</Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-100 text-slate-500 border-none shadow-sm">未作成</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center pr-4">
                                                    <div className="flex justify-center gap-2">
                                                        {hasDesc && (
                                                            <Button variant="outline" size="sm" onClick={() => { setEditingProductId(p.id); setViewMode('print'); }} className="h-8 px-3 border-slate-300 hover:bg-slate-100">
                                                                <Printer className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canEdit && (
                                                            <Button variant={hasDesc ? "outline" : "default"} size="sm" onClick={() => handleEdit(p.id)} className={`h-8 px-3 ${hasDesc ? 'border-blue-200 text-blue-600 hover:bg-blue-50' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}>
                                                                {hasDesc ? <><Edit2 className="h-4 w-4 mr-1.5" /> 編集</> : <><FilePlus className="h-4 w-4 mr-1.5" /> 作成</>}
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