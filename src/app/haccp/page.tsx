"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, ExternalLink, Edit, Trash2, Loader2, Save, Lock, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type HaccpDoc = {
    id: string;
    title: string;
    category: string;
    file_url: string;
    version: string;
    notes: string;
    updated_at: string;
};

// カテゴリの定義 (タブにも使用)
const CATEGORIES = [
    { id: "product_desc", label: "製品説明書", color: "bg-blue-100 text-blue-800" },
    { id: "flow", label: "フロー図", color: "bg-purple-100 text-purple-800" },
    { id: "hazard", label: "危害要因分析表", color: "bg-amber-100 text-amber-800" },
    { id: "ccp", label: "HACCPプラン", color: "bg-red-100 text-red-800" },
    { id: "equipment", label: "機械マニュアル", color: "bg-emerald-100 text-emerald-800" },
    { id: "other", label: "その他", color: "bg-slate-100 text-slate-800" },
];

export default function HaccpPage() {
    const { canEdit } = useAuth();
    const [documents, setDocuments] = useState<HaccpDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    // ★追加: タブ切り替え用のState (初期値は 'all')
    const [activeTab, setActiveTab] = useState<string>("all");

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

    useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

    const openModal = (doc?: HaccpDoc) => {
        if (doc) {
            setEditingDoc(doc);
            setFormData({ title: doc.title, category: doc.category, file_url: doc.file_url, version: doc.version, notes: doc.notes || "" });
        } else {
            setEditingDoc(null);
            // 新規登録時、現在開いているタブのカテゴリを初期値にセットする（allの場合はproduct_desc）
            const initialCategory = activeTab === "all" ? "product_desc" : activeTab;
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

    // 表示用のフィルタリング (タブのカテゴリ ＋ 検索キーワード)
    const filteredDocs = documents.filter(doc => {
        const matchCategory = activeTab === "all" || doc.category === activeTab;
        const matchSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || (doc.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchSearch;
    });

    // テーブルの行を描画する共通関数
    const renderTableRow = (doc: HaccpDoc) => {
        const categoryDef = CATEGORIES.find(c => c.id === doc.category) || CATEGORIES[5];
        return (
            <TableRow key={doc.id} className="hover:bg-slate-50 group">
                <TableCell className="w-32 hidden md:table-cell">
                    <Badge className={`${categoryDef.color} border-none shadow-sm text-xs`}>{categoryDef.label}</Badge>
                </TableCell>
                <TableCell className="font-bold text-slate-800">
                    <div className="flex flex-col">
                        <span className="text-base text-blue-900">{doc.title}</span>
                        <span className="text-xs text-slate-500 font-normal md:hidden mt-1">{categoryDef.label}</span>
                    </div>
                </TableCell>
                <TableCell className="w-20 text-center font-mono text-slate-500 text-xs">v{doc.version}</TableCell>
                <TableCell className="text-sm text-slate-600 truncate max-w-[200px]" title={doc.notes}>{doc.notes || "-"}</TableCell>
                <TableCell className="w-28 text-slate-400 text-xs text-right hidden lg:table-cell">{new Date(doc.updated_at).toLocaleDateString()}</TableCell>
                <TableCell className="w-48 text-right pr-4">
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => window.open(doc.file_url, "_blank")} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-8 px-3 text-xs">
                            <ExternalLink className="h-3 w-3 mr-1" /> 開く
                        </Button>
                        {canEdit && (
                            <Button variant="outline" onClick={() => openModal(doc)} className="h-8 px-2 border-slate-300 text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
                                <Edit className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <FileText className="h-6 w-6 text-blue-600" /> HACCP・マニュアル閲覧
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>

                {canEdit && (
                    <Button onClick={() => openModal()} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold h-12 md:h-10">
                        <Plus className="h-4 w-4 mr-2" /> 新規資料の登録
                    </Button>
                )}
            </div>

            {/* ★変更: タブ切り替えと検索ボックスの統合UI */}
            <div className="flex flex-col mb-4 gap-3">
                <div className="flex flex-col xl:flex-row justify-between gap-4">
                    {/* タブ (横スクロール対応) */}
                    <div className="overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar flex-1">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-max">
                            <TabsList className="bg-slate-200/80 flex h-auto p-1.5 rounded-xl">
                                <TabsTrigger value="all" className="font-bold py-2 px-4 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">すべて</TabsTrigger>
                                {CATEGORIES.map(c => (
                                    <TabsTrigger key={c.id} value={c.id} className="font-bold py-2 px-4 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                                        {c.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* 検索ボックス */}
                    <div className="relative shrink-0 xl:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="資料名や備考で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white border-slate-300 shadow-sm h-10 w-full"
                        />
                    </div>
                </div>
            </div>

            {/* 資料リスト (一覧テーブル形式) */}
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
                                        {canEdit && <p className="text-sm mt-1">「新規資料の登録」からURLを追加してください。</p>}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* 登録・編集モーダル */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="w-[95vw] max-w-md bg-white p-4 md:p-6 rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800">
                            <FileText className="h-5 w-5 text-blue-600" />
                            {editingDoc ? "資料情報の編集" : "新規資料の登録"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">資料名 (必須)</label>
                            <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="例: 製品説明書 (チョコパン)" className="font-bold h-10 md:h-9" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">カテゴリ</label>
                            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full border-2 border-slate-200 rounded-lg md:rounded-md p-2.5 bg-white font-bold text-slate-700 h-12 md:h-10">
                                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">ファイルURL (必須)</label>
                            <Input value={formData.file_url} onChange={e => setFormData({ ...formData, file_url: e.target.value })} placeholder="https://drive.google.com/..." className="text-sm font-mono bg-slate-50 h-10 md:h-9" />
                            <p className="text-[10px] text-slate-500 mt-1">※Googleドライブ等の共有リンクURLを貼り付けてください。</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">バージョン</label>
                                <Input value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })} placeholder="1.0" className="h-10 md:h-9" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">備考・改訂内容</label>
                            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full p-3 md:p-2 border border-slate-200 rounded-lg md:rounded-md text-sm resize-none h-24 md:h-20 bg-slate-50" placeholder="改訂の理由など..." />
                        </div>
                    </div>
                    <DialogFooter className="mt-6 border-t pt-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
                        {editingDoc ? (
                            <Button onClick={handleDelete} disabled={isProcessing} variant="outline" className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4 mr-2" />削除</Button>
                        ) : <div className="hidden sm:block"></div>}
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1 sm:flex-none">キャンセル</Button>
                            <Button onClick={handleSave} disabled={isProcessing || !formData.title || !formData.file_url} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 md:h-9">
                                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 保存する
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}