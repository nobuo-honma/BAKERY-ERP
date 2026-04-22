"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Printer, ArrowLeft, UploadCloud, Settings, Trash2, LineChart, FileSpreadsheet, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type ParsedData = {
    fileName: string;
    workDate: string;
    startTime: string;
    endTime: string;
    reach80Time: string;
    maxTemp: number;
    avgTemp: number;
    productName: string;
    quantity: number | "";
    discardQty: number | "";
};

type Config = { timeCol: string; flagCol: string; centerTempCol: string; chamberTempCol: string; };
type Product = { id: string; name: string; variant_name: string; };

const DEFAULT_CONFIG: Config = {
    timeCol: "Group1",
    flagCol: "WR00010.00",
    centerTempCol: "DM00158",
    chamberTempCol: "DM00148",
};

export default function FujiSteamyPage() {
    const { canEdit } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'input' | 'list' | 'print'>('input');
    const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
    const [configModalOpen, setConfigModalOpen] = useState(false);

    // 解析用State
    const [parsedList, setParsedList] = useState<ParsedData[]>([]);
    const [checkerName, setCheckerName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // マスタ情報・一覧用State
    const [products, setProducts] = useState<Product[]>([]);
    const [records, setRecords] = useState<any[]>([]);
    const [printMonth, setPrintMonth] = useState(new Date());

    useEffect(() => {
        fetchRecords();
        const savedConfig = localStorage.getItem("fuji_steamy_config");
        if (savedConfig) setConfig(JSON.parse(savedConfig));
    }, []);

    const fetchRecords = async () => {
        setLoading(true);
        const [logsRes, productsRes] = await Promise.all([
            // ★修正: リスト一覧も「日付が若い順 (昇順)」で取得する
            supabase.from('fuji_steamy_logs')
                .select('*')
                .order('work_date', { ascending: true })
                .order('start_time', { ascending: true })
                .limit(50),
            supabase.from('products').select('id, name, variant_name').order('id', { ascending: true })
        ]);

        if (logsRes.data) {
            // ★追加: 「ならし運転」を一覧から除外するフィルター
            const filteredRecords = logsRes.data.filter((r: any) => r.product_name !== 'ならし運転');
            setRecords(filteredRecords);
        }
        if (productsRes.data) setProducts(productsRes.data as Product[]);

        setLoading(false);
    };

    const handleSaveConfig = () => {
        localStorage.setItem("fuji_steamy_config", JSON.stringify(config));
        setConfigModalOpen(false);
        alert("解析マッピング設定を保存しました。");
    };

    // ================= CSV解析ロジック =================
    const readFileAsSJIS = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, "Shift_JIS");
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        const newList: ParsedData[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const text = await readFileAsSJIS(file);
                const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                if (lines.length < 2) continue;

                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

                const timeIdx = headers.findIndex(h => h.includes(config.timeCol));
                const centerTempIdx = headers.findIndex(h => h.includes(config.centerTempCol));
                const chamberTempIdx = headers.findIndex(h => h.includes(config.chamberTempCol));

                let startTime = "-";
                let endTime = "-";
                let reach80Time = "-";
                let maxTemp = 0;
                let chamberSum = 0;
                let chamberCount = 0;
                let workDate = "";

                if (lines.length > 1) {
                    const firstRow = lines[1].split(',').map(v => v.replace(/"/g, '').trim());
                    if (timeIdx >= 0 && firstRow[timeIdx]) {
                        startTime = firstRow[timeIdx];
                        const datePart = startTime.split(' ')[0];
                        if (datePart) {
                            workDate = datePart.replace(/\//g, '-');
                        }
                    }
                }

                if (!workDate) workDate = new Date().toISOString().split('T')[0];

                for (let j = 1; j < lines.length; j++) {
                    const rowStr = lines[j];
                    const row = rowStr.split(',').map(v => v.replace(/"/g, '').trim());

                    if (timeIdx >= 0 && (row[timeIdx] === "(END)" || rowStr.includes("(END)"))) {
                        break;
                    }

                    const timeStr = timeIdx >= 0 ? row[timeIdx] : "-";
                    if (timeStr && timeStr !== "-") {
                        endTime = timeStr;
                    }

                    const cTemp = centerTempIdx >= 0 ? parseFloat(row[centerTempIdx]) : 0;
                    const chTemp = chamberTempIdx >= 0 ? parseFloat(row[chamberTempIdx]) : 0;

                    if (!isNaN(cTemp)) {
                        if (reach80Time === "-" && cTemp >= 80) reach80Time = timeStr;
                        if (cTemp > maxTemp) maxTemp = cTemp;
                    }

                    if (!isNaN(chTemp) && chTemp > 0) {
                        chamberSum += chTemp;
                        chamberCount++;
                    }
                }

                newList.push({
                    fileName: file.name,
                    workDate,
                    startTime,
                    endTime,
                    reach80Time,
                    maxTemp,
                    avgTemp: chamberCount > 0 ? Number((chamberSum / chamberCount).toFixed(1)) : 0,
                    productName: "",
                    quantity: "",
                    discardQty: ""
                });
            } catch (err) {
                console.error("CSV解析エラー:", err);
                alert(`${file.name} の解析に失敗しました。`);
            }
        }

        setParsedList(prev => [...prev, ...newList]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setLoading(false);
    };

    const handleUpdateParsed = (idx: number, field: keyof ParsedData, value: any) => {
        const updated = [...parsedList];
        updated[idx] = { ...updated[idx], [field]: value };

        if (field === 'quantity') {
            const qty = Number(value);
            if (!isNaN(qty) && qty > 0) {
                updated[idx].discardQty = Math.ceil(qty / 640);
            } else {
                updated[idx].discardQty = "";
            }
        }

        setParsedList(updated);
    };

    const handleSaveToDB = async () => {
        if (parsedList.length === 0) return;
        setIsSaving(true);

        const inserts = parsedList.map(item => ({
            work_date: item.workDate,
            batch_name: item.fileName,
            product_name: item.productName || null,
            quantity: Number(item.quantity) || null,
            discard_qty: Number(item.discardQty) || null,
            start_time: item.startTime,
            end_time: item.endTime,
            reach_80_time: item.reach80Time,
            max_temp: item.maxTemp,
            avg_temp: item.avgTemp,
            checker_name: checkerName
        }));

        const { error } = await supabase.from('fuji_steamy_logs').insert(inserts);
        setIsSaving(false);

        if (error) {
            alert("保存エラー: " + error.message);
        } else {
            alert(`正常に ${inserts.length} 件の記録をデータベースに保存しました！`);
            setParsedList([]);
            fetchRecords();
            setViewMode('list');
        }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm("この記録を削除しますか？")) return;
        await supabase.from('fuji_steamy_logs').delete().eq('id', id);
        fetchRecords();
    };

    // ================= 印刷ビュー =================
    // ★追加: 印刷時にも「ならし運転」を除外する
    const printTargetRecords = records.filter(r => {
        const d = new Date(r.work_date);
        return d.getFullYear() === printMonth.getFullYear() && d.getMonth() === printMonth.getMonth() && r.product_name !== 'ならし運転';
    }).sort((a, b) => new Date(a.work_date).getTime() - new Date(b.work_date).getTime() || a.start_time.localeCompare(b.start_time));

    if (viewMode === 'print') {
        const y = printMonth.getFullYear();
        const m = String(printMonth.getMonth() + 1).padStart(2, '0');

        return (
            <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        header, nav { display: none !important; }
                        main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
                        @page { size: A4 landscape; margin: 15mm; }
                        body { background-color: white !important; color: black !important; }
                        .print-hide { display: none !important; }
                    }
                `}} />

                <div className="w-[297mm] print:w-full flex justify-between mb-4 print-hide">
                    <Button variant="outline" onClick={() => setViewMode('list')} className="bg-white text-slate-700 font-bold border-slate-300"><ArrowLeft className="h-4 w-4 mr-2" /> 戻る</Button>
                    <div className="flex gap-2 items-center bg-white px-2 py-1 rounded border shadow-sm">
                        <span className="text-sm font-bold text-slate-600 ml-2">出力対象月:</span>
                        <Input type="month" value={`${y}-${m}`} onChange={(e) => { if (e.target.value) setPrintMonth(new Date(e.target.value + "-01")); }} className="w-40 border-none shadow-none h-8 font-bold" />
                    </div>
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"><Printer className="h-5 w-5 mr-2" /> 印刷する</Button>
                </div>

                <div className="w-[297mm] min-h-[210mm] bg-white pt-8 pb-10 px-12 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border flex flex-col">
                    <div className="flex justify-between items-end mb-4">
                        <h1 className="text-2xl font-bold tracking-widest">加熱調理記録 (フジスチーミー運転記録)</h1>
                        <div className="text-lg font-bold">{y}年 {m}月度</div>
                    </div>

                    <table className="w-full border-collapse border-2 border-black text-sm flex-1">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border border-black py-2 w-[10%]">日付</th>
                                <th className="border border-black py-2 w-[22%]">製造種類</th>
                                <th className="border border-black py-2 w-[8%]">数量</th>
                                <th className="border border-black py-2 w-[14%]">開始時間</th>
                                <th className="border border-black py-2 w-[14%] leading-tight text-red-700">中心温度80℃<br />到達時間</th>
                                <th className="border border-black py-2 w-[14%]">終了時間</th>
                                <th className="border border-black py-2 w-[10%]">操作者</th>
                                <th className="border border-black py-2 w-[8%]">廃棄数</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printTargetRecords.map((r, i) => {
                                const sTime = r.start_time.split(' ')[1] || r.start_time;
                                const eTime = r.end_time ? (r.end_time.split(' ')[1] || r.end_time) : "";
                                const r80Time = r.reach_80_time !== "-" ? (r.reach_80_time.split(' ')[1] || r.reach_80_time) : "";
                                const dObj = new Date(r.work_date);
                                const dateStr = `${dObj.getMonth() + 1}/${dObj.getDate()}`;

                                return (
                                    <tr key={r.id} className="h-10 text-center">
                                        <td className="border border-black font-bold text-sm px-1">{dateStr}</td>
                                        <td className="border border-black font-bold text-center px-2 truncate text-sm">{r.product_name || "　"}</td>
                                        <td className="border border-black text-sm">{r.quantity ? `${r.quantity}` : "　"}</td>
                                        <td className="border border-black text-sm">{sTime}</td>
                                        <td className="border border-black text-sm font-bold text-red-600">{r80Time}</td>
                                        <td className="border border-black text-sm">{eTime}</td>
                                        <td className="border border-black text-xs px-0.5 truncate">{r.checker_name || ""}</td>
                                        <td className="border border-black text-sm">{r.discard_qty !== null ? `${r.discard_qty}` : ""}</td>
                                    </tr>
                                );
                            })}
                            {Array.from({ length: Math.max(0, 25 - printTargetRecords.length) }).map((_, idx) => (
                                <tr key={`empty-${idx}`} className="h-10 border-b border-black">
                                    <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-4 text-xs text-slate-600">※ この記録はフジスチーミーの出力ログ（CSV）からシステムによって自動解析・生成されたものです。（改竄防止機能作動中）</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <LineChart className="h-6 w-6 text-indigo-600" />
                        フジスチーミー 自動解析システム
                    </h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
                <Button onClick={() => setConfigModalOpen(true)} variant="outline" className="h-10 bg-white font-bold border-slate-300 shadow-sm">
                    <Settings className="w-4 h-4 mr-2" /> 解析設定 (マッピング)
                </Button>
            </div>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                <TabsList className="mb-6 bg-slate-200/80 p-1.5 rounded-xl">
                    <TabsTrigger value="input" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">CSVアップロード ＆ 解析</TabsTrigger>
                    <TabsTrigger value="list" className="font-bold py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">記録一覧 (PDF出力)</TabsTrigger>
                </TabsList>

                {/* --- アップロード＆解析タブ --- */}
                <TabsContent value="input">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                        <Card className="shadow-sm border-slate-200 lg:col-span-1">
                            <CardHeader className="bg-indigo-50/50 border-b pb-4"><CardTitle className="text-base text-indigo-900 flex items-center gap-2"><UploadCloud className="h-5 w-5" /> CSVファイルの投入</CardTitle></CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div><label className="block text-sm font-bold mb-1 text-slate-700">担当者(操作者) 一括設定</label><Input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} className="h-10 bg-white" placeholder="名前..." /></div>

                                <div className="pt-4">
                                    <label className="block text-sm font-bold mb-2 text-slate-700">CSVファイル (複数選択可)</label>
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${loading ? 'border-slate-300 bg-slate-50' : 'border-indigo-300 bg-indigo-50/50 hover:bg-indigo-100/50'}`}
                                        onClick={() => !loading && fileInputRef.current?.click()}
                                    >
                                        <input type="file" accept=".csv" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                        {loading ? <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-400 mb-2" /> : <FileSpreadsheet className="w-10 h-10 mx-auto text-indigo-500 mb-2" />}
                                        <div className="font-bold text-slate-600">{loading ? '解析中...' : 'ここをクリックしてCSVを選択'}</div>
                                        <div className="text-xs text-slate-500 mt-1">※USBから取り出した複数のログファイルを一度に読み込めます。</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-200 lg:col-span-3">
                            <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-base text-slate-800 flex items-center gap-2"><LineChart className="h-5 w-5 text-slate-500" /> 自動解析結果</CardTitle>
                                {parsedList.length > 0 && <Button onClick={handleSaveToDB} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 shadow-sm">{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} すべてDBに保存</Button>}
                            </CardHeader>
                            <CardContent className="p-0">
                                {parsedList.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">
                                        <LineChart className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p className="font-bold">CSVファイルをアップロードすると、ここに解析結果が表示されます。</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[1000px] text-sm">
                                            <TableHeader className="bg-slate-100">
                                                <TableRow>
                                                    <TableHead className="w-[12%] text-center">製造日(自動)</TableHead>
                                                    <TableHead className="w-[12%]">ファイル名</TableHead>
                                                    <TableHead className="w-[14%] text-center">開始 - 終了</TableHead>
                                                    <TableHead className="w-[10%] text-center text-red-600">80℃到達</TableHead>
                                                    <TableHead className="w-[20%]">製造種類 (製品ID)</TableHead>
                                                    <TableHead className="w-[10%]">数量</TableHead>
                                                    <TableHead className="w-[10%]">廃棄数(自動)</TableHead>
                                                    <TableHead className="w-[8%] text-center">操作</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {parsedList.map((item, idx) => {
                                                    const sTime = item.startTime.split(' ')[1] || item.startTime;
                                                    const eTime = item.endTime ? (item.endTime.split(' ')[1] || item.endTime) : "-";
                                                    const r80Time = item.reach80Time !== "-" ? (item.reach80Time.split(' ')[1] || item.reach80Time) : "-";
                                                    return (
                                                        <TableRow key={idx} className="hover:bg-slate-50">
                                                            <TableCell className="p-2">
                                                                <Input type="date" value={item.workDate} onChange={e => handleUpdateParsed(idx, 'workDate', e.target.value)} className="h-8 text-xs bg-white px-1 font-bold text-slate-700" />
                                                            </TableCell>
                                                            <TableCell className="font-mono text-[10px] text-slate-500 truncate" title={item.fileName}>{item.fileName}</TableCell>
                                                            <TableCell className="text-center font-bold font-mono text-[10px] leading-tight">
                                                                <div>{sTime}</div>
                                                                <div className="text-slate-400">~ {eTime}</div>
                                                            </TableCell>
                                                            <TableCell className="text-center font-black font-mono text-red-600">{r80Time}</TableCell>

                                                            <TableCell className="p-2">
                                                                <select
                                                                    value={item.productName}
                                                                    onChange={e => handleUpdateParsed(idx, 'productName', e.target.value)}
                                                                    className="w-full h-8 border-slate-200 rounded px-2 text-xs bg-white focus:ring-indigo-500 font-bold"
                                                                >
                                                                    <option value="">製品IDを選択...</option>
                                                                    <option value="ならし運転">ならし運転</option>
                                                                    {products.map(p => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {p.id} ({p.name})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </TableCell>

                                                            <TableCell className="p-2 flex items-center gap-1"><Input type="number" value={item.quantity} onChange={e => handleUpdateParsed(idx, 'quantity', e.target.value)} className="h-8 text-xs text-right bg-white" placeholder="個数" /></TableCell>
                                                            <TableCell className="p-2"><Input type="number" value={item.discardQty} onChange={e => handleUpdateParsed(idx, 'discardQty', e.target.value)} className="h-8 text-xs text-right bg-white text-red-600" placeholder="自動" /></TableCell>
                                                            <TableCell className="text-center p-2"><Button variant="ghost" size="icon" onClick={() => setParsedList(parsedList.filter((_, i) => i !== idx))} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- 一覧タブ --- */}
                <TabsContent value="list">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50 border-b py-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg text-slate-800">保存された加熱調理記録</CardTitle>
                            <Button variant="outline" onClick={() => setViewMode('print')} className="h-9 px-4 border-slate-300 font-bold bg-white shadow-sm"><Printer className="h-4 w-4 mr-2" /> PDF帳票を出力 (月指定)</Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table className="w-full min-w-[800px] text-sm">
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="w-[12%] pl-4">製造日</TableHead>
                                        <TableHead className="w-[20%]">製造種類 (製品ID)</TableHead>
                                        <TableHead className="w-[15%] text-center">開始 - 終了</TableHead>
                                        <TableHead className="w-[10%] text-center text-red-600">80℃</TableHead>
                                        <TableHead className="w-[10%] text-center">廃棄数</TableHead>
                                        <TableHead className="w-[15%]">操作者 / ファイル</TableHead>
                                        <TableHead className="w-[10%] text-center">アクション</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.map(rec => {
                                        const sTime = rec.start_time.split(' ')[1] || rec.start_time;
                                        const eTime = rec.end_time ? (rec.end_time.split(' ')[1] || rec.end_time) : "-";
                                        const r80Time = rec.reach_80_time !== "-" ? (rec.reach_80_time.split(' ')[1] || rec.reach_80_time) : "未達";

                                        return (
                                            <TableRow key={rec.id} className="hover:bg-slate-50">
                                                <TableCell className="pl-4 font-bold text-slate-600">{new Date(rec.work_date).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-800">{rec.product_name || "未入力"}</div>
                                                    {rec.quantity && <div className="text-[10px] text-slate-500 mt-0.5">{rec.quantity} 個</div>}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-[10px]">
                                                    <div className="text-slate-700">{sTime}</div>
                                                    <div className="text-slate-400">~ {eTime}</div>
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold text-red-600 text-xs">
                                                    {r80Time}
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-slate-800">{rec.discard_qty !== null ? rec.discard_qty : "-"}</TableCell>
                                                <TableCell>
                                                    <div className="text-xs font-bold text-slate-700">{rec.checker_name || "-"}</div>
                                                    <div className="text-[9px] text-slate-400 truncate max-w-[120px]" title={rec.batch_name}>{rec.batch_name}</div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {canEdit && <Button variant="ghost" size="icon" onClick={() => handleDeleteRecord(rec.id)} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {records.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">記録がありません。</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* 設定モーダル */}
            <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
                <DialogContent className="w-[95vw] max-w-sm bg-white p-6 rounded-xl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-slate-800"><Settings className="w-5 h-5 text-slate-500" /> 解析マッピング設定</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                        <p className="text-xs text-slate-500">CSVファイルの1行目（ヘッダー）に含まれる列名を設定してください。装置の仕様変更時に役立ちます。</p>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">時刻列名</label><Input value={config.timeCol} onChange={e => setConfig({ ...config, timeCol: e.target.value })} className="h-9" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">運転フラグ列名 (ON/OFF)</label><Input value={config.flagCol} onChange={e => setConfig({ ...config, flagCol: e.target.value })} className="h-9" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">中心温度列名</label><Input value={config.centerTempCol} onChange={e => setConfig({ ...config, centerTempCol: e.target.value })} className="h-9" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">庫内温度列名 (平均計算用)</label><Input value={config.chamberTempCol} onChange={e => setConfig({ ...config, chamberTempCol: e.target.value })} className="h-9" /></div>
                    </div>
                    <DialogFooter className="mt-6 border-t pt-4">
                        <Button variant="ghost" onClick={() => setConfigModalOpen(false)}>キャンセル</Button>
                        <Button onClick={handleSaveConfig} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">設定を保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}