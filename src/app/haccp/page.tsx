"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
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

// カテゴリの定義
const CATEGORIES = [
    { id: "product_desc", label: "製品説明書", color: "bg-blue-100 text-blue-800" },
    { id: "flow", label: "フローダイアグラム", color: "bg-purple-100 text-purple-800" },
    { id: "hazard", label: "危害要因分析表", color: "bg-amber-100 text-amber-800" },
    { id: "ccp", label: "HACCPプラン (CCP)", color: "bg-red-100 text-red-800" },
    // ▼ 追加: 機械の取扱説明書用のカテゴリ（緑色のバッジ）
    { id: "equipment", label: "設備・機械マニュアル", color: "bg-emerald-100 text-emerald-800" },
    { id: "other", label: "その他手順書", color: "bg-slate-100 text-slate-800" },
];

export default function HaccpPage() {
    const { canEdit } = useAuth();
    const [documents, setDocuments] = useState<HaccpDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    // 新規・編集モーダル用
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

    // モーダルを開く
    const openModal = (doc?: HaccpDoc) => {
        if (doc) {
            setEditingDoc(doc);
            setFormData({ title: doc.title, category: doc.category, file_url: doc.file_url, version: doc.version, notes: doc.notes || "" });
        } else {
            setEditingDoc(null);
            setFormData({ title: "", category: "product_desc", file_url: "", version: "1.0", notes: "" });
        }
        setModalOpen(true);
    };

    // 保存処理
    const handleSave = async () => {
        if (!formData.title || !formData.file_url) {
            alert("資料名とURLは必須です。"); return;
        }
        setIsProcessing(true);

        const docData = {
            title: formData.title, category: formData.category, file_url: formData.file_url,
            version: formData.version, notes: formData.notes, updated_at: new Date().toISOString()
        };

        try {
            if (editingDoc) {
                await supabase.from("haccp_documents").update(docData).eq("id", editingDoc.id);
            } else {
                await supabase.from("haccp_documents").insert(docData);
            }
            setModalOpen(false);
            fetchDocuments();
        } catch (err: any) {
            alert("エラーが発生しました: " + err.message);
        }
        setIsProcessing(false);
    };

    // 削除処理
    const handleDelete = async () => {
        if (!editingDoc || !confirm("この資料データを削除しますか？\n（※リンク先のファイル自体は削除されません）")) return;
        setIsProcessing(true);
        await supabase.from("haccp_documents").delete().eq("id", editingDoc.id);
        setModalOpen(false);
        fetchDocuments();
        setIsProcessing(false);
    };

    // 表示用のフィルタリング
    const filteredDocs = documents.filter(doc => {
        const matchCategory = filterCategory === "all" || doc.category === filterCategory;
        const matchSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || (doc.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchSearch;
    });

    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <FileText className="h-6 w-6 text-blue-600" /> HACCP・各種マニュアル閲覧
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>

                {/* ★権限ロック: 管理者のみ資料の追加が可能 */}
                {canEdit && (
                    <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold">
                        <Plus className="h-4 w-4 mr-2" /> 新規資料の登録
                    </Button>
                )}
            </div>

            {/* 検索・フィルターエリア */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="資料名や備考で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-50 border-slate-200"
                    />
                </div>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="border-slate-200 rounded-md p-2 text-sm bg-slate-50 focus:ring-blue-500 font-bold text-slate-700 w-full md:w-48"
                >
                    <option value="all">すべてのカテゴリ</option>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
            </div>

            {/* 資料リスト (カード形式) */}
            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.map(doc => {
                        const categoryDef = CATEGORIES.find(c => c.id === doc.category) || CATEGORIES[4];
                        return (
                            <Card key={doc.id} className="hover:shadow-md transition-shadow border-slate-200 group flex flex-col">
                                <CardHeader className="pb-3 border-b bg-slate-50 rounded-t-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge className={`${categoryDef.color} border-none shadow-sm`}>{categoryDef.label}</Badge>
                                        <div className="text-xs text-slate-500 font-bold">Ver {doc.version}</div>
                                    </div>
                                    <CardTitle className="text-lg text-slate-800 leading-tight">{doc.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-3 flex-1 flex flex-col justify-between">
                                    <div>
                                        <p className="text-sm text-slate-600 mb-3 line-clamp-2" title={doc.notes}>{doc.notes || "備考なし"}</p>
                                        <div className="text-xs text-slate-400 mb-4">最終更新: {new Date(doc.updated_at).toLocaleDateString()}</div>
                                    </div>

                                    <div className="flex gap-2 mt-auto">
                                        {/* 資料を開くボタン (全員操作可能) */}
                                        <Button
                                            onClick={() => window.open(doc.file_url, "_blank")}
                                            className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm"
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2" /> 閲覧する
                                        </Button>

                                        {/* ★権限ロック: 編集ボタンは管理者のみ */}
                                        {canEdit && (
                                            <Button variant="outline" onClick={() => openModal(doc)} className="px-3 border-slate-300 text-slate-600 hover:bg-slate-100">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {filteredDocs.length === 0 && (
                        <div className="col-span-full text-center py-16 bg-white border border-dashed rounded-xl text-slate-500">
                            <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-bold">該当する資料が見つかりません。</p>
                            {canEdit && <p className="text-sm mt-1">「新規資料の登録」からPDFなどのURLを追加してください。</p>}
                        </div>
                    )}
                </div>
            )}

            {/* --- 登録・編集モーダル (管理者用) --- */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            {editingDoc ? "資料情報の編集" : "新規資料の登録"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">資料名 (必須)</label>
                            <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="例: 製品説明書 (チョコパン)" className="font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">カテゴリ</label>
                            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full border rounded-md p-2 bg-white font-bold text-slate-700">
                                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">ファイルURL (必須)</label>
                            <Input value={formData.file_url} onChange={e => setFormData({ ...formData, file_url: e.target.value })} placeholder="https://drive.google.com/..." className="text-sm font-mono bg-slate-50" />
                            <p className="text-[10px] text-slate-500 mt-1">※Googleドライブや社内サーバーの共有リンクURLを貼り付けてください。</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">バージョン</label>
                                <Input value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })} placeholder="1.0" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">備考・改訂内容</label>
                            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full p-2 border border-slate-200 rounded-md text-sm resize-none h-20" placeholder="改訂の理由など..." />
                        </div>
                    </div>
                    <DialogFooter className="mt-6 border-t pt-4 flex justify-between">
                        {editingDoc ? (
                            <Button onClick={handleDelete} disabled={isProcessing} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4 mr-2" />削除</Button>
                        ) : <div></div>}
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setModalOpen(false)}>キャンセル</Button>
                            <Button onClick={handleSave} disabled={isProcessing || !formData.title || !formData.file_url} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 保存する
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}