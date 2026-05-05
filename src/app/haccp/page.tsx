"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// ▼ 修正: PackageOpen をインポートリストに追加しました ▼
import { FileText, Plus, ExternalLink, Edit, Trash2, Loader2, Save, Lock, Search, ShieldCheck, ClipboardCheck, Building2, Wrench, Sparkles, ShieldAlert, ArrowRight, Trash, Eye, PackageOpen, Box, LineChart, GitMerge } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

// ==========================================
// HACCP資料 (既存の機能) の型定義
// ==========================================
type HaccpDoc = {
    id: string; title: string; category: string; file_url: string; version: string; notes: string; updated_at: string;
};
const CATEGORIES = [
    { id: "product_desc", label: "製品説明書", color: "bg-blue-100 text-blue-800" },
    { id: "flow", label: "フロー図", color: "bg-purple-100 text-purple-800" },
    { id: "hazard", label: "危害要因分析表", color: "bg-amber-100 text-amber-800" },
    { id: "ccp", label: "HACCPプラン", color: "bg-red-100 text-red-800" },
    { id: "equipment", label: "機械マニュアル", color: "bg-emerald-100 text-emerald-800" },
    { id: "other", label: "その他", color: "bg-slate-100 text-slate-800" },
];

export default function HaccpPortalPage() {
    const { canEdit } = useAuth();
    const [activeTab, setActiveTab] = useState<string>("portal");

    // --- 資料タブ用のState ---
    const [documents, setDocuments] = useState<HaccpDoc[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [docCategoryTab, setDocCategoryTab] = useState<string>("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<HaccpDoc | null>(null);
    const [formData, setFormData] = useState({ title: "", category: "product_desc", file_url: "", version: "1.0", notes: "" });
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from("haccp_documents").select("*").order("updated_at", { ascending: false });
        if (data) setDocuments(data as HaccpDoc[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (activeTab === "documents") fetchDocuments();
    }, [activeTab, fetchDocuments]);

    const openModal = (doc?: HaccpDoc) => {
        if (doc) {
            setEditingDoc(doc); setFormData({ title: doc.title, category: doc.category, file_url: doc.file_url, version: doc.version, notes: doc.notes || "" });
        } else {
            setEditingDoc(null);
            const initialCategory = docCategoryTab === "all" ? "product_desc" : docCategoryTab;
            setFormData({ title: "", category: initialCategory, file_url: "", version: "1.0", notes: "" });
        }
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.file_url) { alert("資料名とURLは必須です。"); return; }
        setIsProcessing(true);
        const docData = { title: formData.title, category: formData.category, file_url: formData.file_url, version: formData.version, notes: formData.notes, updated_at: new Date().toISOString() };
        try {
            if (editingDoc) await supabase.from("haccp_documents").update(docData).eq("id", editingDoc.id);
            else await supabase.from("haccp_documents").insert(docData);
            setModalOpen(false); fetchDocuments();
        } catch (err: any) { alert("エラーが発生しました: " + err.message); }
        setIsProcessing(false);
    };

    const handleDelete = async () => {
        if (!editingDoc || !confirm("この資料データを削除しますか？\n（※リンク先のファイル自体は削除されません）")) return;
        setIsProcessing(true);
        await supabase.from("haccp_documents").delete().eq("id", editingDoc.id);
        setModalOpen(false); fetchDocuments();
        setIsProcessing(false);
    };

    const filteredDocs = documents.filter(doc => {
        const matchCategory = docCategoryTab === "all" || doc.category === docCategoryTab;
        const matchSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || (doc.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchSearch;
    });

    const renderTableRow = (doc: HaccpDoc) => {
        const categoryDef = CATEGORIES.find(c => c.id === doc.category) || CATEGORIES[5];
        return (
            <TableRow key={doc.id} className="hover:bg-slate-50 group">
                <TableCell className="w-32 hidden md:table-cell"><Badge className={`${categoryDef.color} border-none shadow-sm text-xs`}>{categoryDef.label}</Badge></TableCell>
                <TableCell className="font-bold text-slate-800">
                    <div className="flex flex-col"><span className="text-base text-blue-900">{doc.title}</span><span className="text-xs text-slate-500 font-normal md:hidden mt-1">{categoryDef.label}</span></div>
                </TableCell>
                <TableCell className="w-20 text-center font-mono text-slate-500 text-xs">v{doc.version}</TableCell>
                <TableCell className="text-sm text-slate-600 truncate max-w-[200px]" title={doc.notes}>{doc.notes || "-"}</TableCell>
                <TableCell className="w-28 text-slate-400 text-xs text-right hidden lg:table-cell">{new Date(doc.updated_at).toLocaleDateString()}</TableCell>
                <TableCell className="w-48 text-right pr-4">
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => window.open(doc.file_url, "_blank")} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-8 px-3 text-xs"><ExternalLink className="h-3 w-3 mr-1" /> 開く</Button>
                        {canEdit && <Button variant="outline" onClick={() => openModal(doc)} className="h-8 px-2 border-slate-300 text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"><Edit className="h-4 w-4" /></Button>}
                    </div>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <div className="bg-transparent">
            <div className="flex items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    HACCP 記録・資料ポータル
                </h1>
                {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar flex-1 mb-6">
                    <TabsList className="bg-slate-200/80 flex w-max h-auto p-1.5 rounded-xl">
                        <TabsTrigger value="portal" className="font-bold py-2.5 px-6 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">日々の記録表へ</TabsTrigger>
                        <TabsTrigger value="documents" className="font-bold py-2.5 px-6 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">HACCP関連資料</TabsTrigger>
                    </TabsList>
                </div>

                {/* =========================================================
                    ポータル (記録表へのリンク集)
                ========================================================= */}
                <TabsContent value="portal" className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                        <Link href="/cleaning-checks" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-emerald-100 p-2.5 rounded-lg text-emerald-700 group-hover:scale-110 transition-transform"><ClipboardCheck className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">YO-22</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">清掃・点検チェック表</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">ミキサー、オーブン、天板など、日・週・月ごとの機械清掃と動作点検を記録します。</p>
                                    <div className="text-xs font-bold text-emerald-600 flex items-center justify-end">記録する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/facility-checks" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-blue-100 p-2.5 rounded-lg text-blue-700 group-hover:scale-110 transition-transform"><Building2 className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">YO-26</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">施設設備チェック表</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">工場の周囲環境や、トイレ、手洗い設備、冷蔵庫の温度などの全30項目を記録します。</p>
                                    <div className="text-xs font-bold text-blue-600 flex items-center justify-end">記録する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/manufacturing-checks" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-purple-100 p-2.5 rounded-lg text-purple-700 group-hover:scale-110 transition-transform"><Wrench className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">YO-27</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">製造施設チェック表</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">防虫・防鼠対策、汚染区域の区別など、1ヶ月・3ヶ月ごとの定期点検と改善策を記録します。</p>
                                    <div className="text-xs font-bold text-purple-600 flex items-center justify-end">記録する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/area-cleaning-checks" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-cyan-100 p-2.5 rounded-lg text-cyan-700 group-hover:scale-110 transition-transform"><Sparkles className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">YO-21</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">清掃チェック表</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">前室・作業室・冷蔵庫・床など、場所(エリア)ごとの毎日の清掃状況を記録します。</p>
                                    <div className="text-xs font-bold text-cyan-600 flex items-center justify-end">記録する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/waste-checks" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-orange-100 p-2.5 rounded-lg text-orange-700 group-hover:scale-110 transition-transform"><Trash className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">YO-41</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">廃棄物チェック表</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">廃棄物容器の清掃・消毒、集積場の分別管理や定期回収の状況などを毎日記録します。</p>
                                    <div className="text-xs font-bold text-orange-600 flex items-center justify-end">記録する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/sensory-tests" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-pink-400 hover:bg-pink-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-pink-100 p-2.5 rounded-lg text-pink-700 group-hover:scale-110 transition-transform"><Eye className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">YO-30</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">官能検査実施表</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">製造されたLotに対して、小箱・アルミ・パンの状態を「視覚・嗅覚・触覚・味覚」から検査し記録します。</p>
                                    <div className="text-xs font-bold text-pink-600 flex items-center justify-end">記録する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* ▼ 追加：原材料受入台帳 ▼ */}
                        <Link href="/material-receiving" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-indigo-100 p-2.5 rounded-lg text-indigo-700 group-hover:scale-110 transition-transform"><PackageOpen className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">YO-14</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">原材料受入台帳</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">日々の原材料入荷時に、賞味期限、Lot、数量、外観、臭い等の受入状態を記録します。</p>
                                    <div className="text-xs font-bold text-indigo-600 flex items-center justify-end">記録する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/audit-logs" className="block group md:col-span-2 lg:col-span-1">
                            <Card className="h-full border-2 border-slate-200 hover:border-red-400 hover:bg-red-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer relative overflow-hidden">
                                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12"><ShieldAlert className="w-40 h-40" /></div>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-red-100 p-2.5 rounded-lg text-red-700 group-hover:scale-110 transition-transform"><ShieldAlert className="w-6 h-6" /></div>
                                        <Badge className="bg-red-100 text-red-700 shadow-sm border-none text-[10px]">自動監視</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">監査ログ (改竄履歴)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">すべてのHACCP記録に対する「追加・変更・削除」の履歴を自動で追跡・保存しています。変更前後のデータを比較できます。</p>
                                    <div className="text-xs font-bold text-red-600 flex items-center justify-end">履歴を確認する <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/ecopack-checks" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-teal-100 p-2.5 rounded-lg text-teal-700 group-hover:scale-110 transition-transform"><Box className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">YO-4</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">エコパック製品チェック表</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">製品のシール状態や酸素濃度など、製造ごとの品質保証と適合判定を記録します。</p>
                                    <div className="text-xs font-bold text-teal-600 flex items-center justify-end">記録する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/fuji-steamy" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-indigo-100 p-2.5 rounded-lg text-indigo-700 group-hover:scale-110 transition-transform"><LineChart className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">自動解析</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">加熱調理記録 (フジスチーミー)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">装置から出力されたCSVログをドラッグ＆ドロップするだけで、80℃到達時間や最高温度を自動抽出し、記録表を生成します。</p>
                                    <div className="text-xs font-bold text-indigo-600 flex items-center justify-end">解析する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* ▼ 追加：製品説明書 ▼ */}
                        <Link href="/product-descriptions" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-blue-100 p-2.5 rounded-lg text-blue-700 group-hover:scale-110 transition-transform"><FileText className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">HACCP-P1</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">製品説明書</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">製品ごとの原材料、添加物、アレルギー物質、賞味期限、保存方法などをまとめた説明書を作成・出力します。</p>
                                    <div className="text-xs font-bold text-blue-600 flex items-center justify-end">作成する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* ▼ 追加：製造工程フロー図 ▼ */}
                        <Link href="/manufacturing-flows" className="block group">
                            <Card className="h-full border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 transition-all shadow-sm group-hover:shadow-md cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-purple-100 p-2.5 rounded-lg text-purple-700 group-hover:scale-110 transition-transform"><GitMerge className="w-6 h-6" /></div>
                                        <Badge className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px]">HACCP-F1</Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold text-slate-800 mt-4">製造工程フロー図</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">原材料の受入から出荷までの各工程と、重要管理点（CCP）を設定し、フロー図としてPDF出力します。</p>
                                    <div className="text-xs font-bold text-purple-600 flex items-center justify-end">作成する / PDF出力 <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></div>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                </TabsContent>

                {/* =========================================================
                    HACCP 資料リスト (既存機能)
                ========================================================= */}
                <TabsContent value="documents" className="mt-0">
                    <div className="flex flex-col mb-4 gap-3">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar flex-1">
                                <Tabs value={docCategoryTab} onValueChange={setDocCategoryTab} className="w-max">
                                    <TabsList className="bg-slate-200/80 flex h-auto p-1.5 rounded-xl">
                                        <TabsTrigger value="all" className="font-bold py-2 px-4 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">すべて</TabsTrigger>
                                        {CATEGORIES.map(c => <TabsTrigger key={c.id} value={c.id} className="font-bold py-2 px-4 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">{c.label}</TabsTrigger>)}
                                    </TabsList>
                                </Tabs>
                            </div>
                            <div className="relative shrink-0 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input placeholder="資料名や備考で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-white border-slate-300 shadow-sm h-10 w-full" />
                            </div>
                            {canEdit && (
                                <Button onClick={() => openModal()} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold h-10 shrink-0">
                                    <Plus className="h-4 w-4 mr-2" /> 新規資料のリンク追加
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden mb-8">
                        {loading ? (
                            <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>
                        ) : (
                            <Table className="min-w-[600px]">
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-32 hidden md:table-cell pl-4">カテゴリ</TableHead>
                                        <TableHead>資料名</TableHead>
                                        <TableHead className="text-center w-20">Ver</TableHead>
                                        <TableHead>備考</TableHead>
                                        <TableHead className="w-28 text-right hidden lg:table-cell">更新日</TableHead>
                                        <TableHead className="w-48 text-right pr-4">アクション</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDocs.map(renderTableRow)}
                                    {filteredDocs.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-16 text-slate-500 bg-slate-50/50">
                                                <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                                <p className="font-bold">該当する資料が見つかりません。</p>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* 資料の登録・編集モーダル */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="w-[95vw] max-w-md bg-white p-4 md:p-6 rounded-xl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-slate-800"><FileText className="h-5 w-5 text-blue-600" /> {editingDoc ? "資料情報の編集" : "新規資料の登録"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">資料名 (必須)</label><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="例: 製品説明書 (チョコパン)" className="font-bold h-10 md:h-9" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">カテゴリ</label>
                            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full border-2 border-slate-200 rounded-lg md:rounded-md p-2.5 bg-white font-bold text-slate-700 h-12 md:h-10">
                                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">ファイルURL (必須)</label><Input value={formData.file_url} onChange={e => setFormData({ ...formData, file_url: e.target.value })} placeholder="https://drive.google.com/..." className="text-sm font-mono bg-slate-50 h-10 md:h-9" /><p className="text-[10px] text-slate-500 mt-1">※Googleドライブ等の共有リンクURLを貼り付けてください。</p></div>
                        <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">バージョン</label><Input value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })} placeholder="1.0" className="h-10 md:h-9" /></div></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">備考・改訂内容</label><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full p-3 md:p-2 border border-slate-200 rounded-lg md:rounded-md text-sm resize-none h-24 md:h-20 bg-slate-50" placeholder="改訂の理由など..." /></div>
                    </div>
                    <DialogFooter className="mt-6 border-t pt-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
                        {editingDoc ? <Button onClick={handleDelete} disabled={isProcessing} variant="outline" className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4 mr-2" />削除</Button> : <div className="hidden sm:block"></div>}
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1 sm:flex-none">キャンセル</Button>
                            <Button onClick={handleSave} disabled={isProcessing || !formData.title || !formData.file_url} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 md:h-9">{isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 保存する</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}