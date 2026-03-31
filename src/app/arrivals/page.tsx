"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowDownToLine, CalendarDays, Loader2, Plus, Printer, ArrowLeft, ChevronLeft, ChevronRight, Edit, Trash2, CheckCircle2, PackageCheck, Lock, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

type Item = { id: string; name: string; item_type: string; unit: string; };
type Arrival = { id: string; item_id: string; order_date: string; expected_date: string; quantity: number; unit: string; status: string; notes?: string; items?: { name: string; item_type: string } };

// --- 発注書（PDF）用の商品リスト定数 ---
const hashiyaItems = [
    { code: "", maker: "横山製粉", name: "あすなろミックス", spec: "20kg", unit: "1袋" },
    { code: "", maker: "日本製粉", name: "P15菓子パンミックス", spec: "20kg", unit: "1袋" },
    { code: "", maker: "キューピー", name: "凍結全卵", spec: "1kg×12本", unit: "1ケース" },
    { code: "", maker: "うめはら", name: "オレンジカット5㎜ A", spec: "1kg", unit: "1パック" },
    { code: "", maker: "川西製餡", name: "かのこ黒豆", spec: "2kg×1p", unit: "1袋" },
    { code: "", maker: "", name: "かのこ黒豆", spec: "2kg×2p", unit: "1ケース" },
    { code: "", maker: "森永商事", name: "キャラメル チョコチップ", spec: "5kg×2p", unit: "1ケース" },
    { code: "", maker: "理研", name: "Eオイルスーパー60", spec: "5kg", unit: "1缶" },
    { code: "", maker: "", name: "ミックスフルーツ", spec: "1kg×12p", unit: "1ケース" },
    { code: "", maker: "", name: "アップルチップ", spec: "2kg×6ｐ", unit: "1ケース" },
    { code: "", maker: "", name: "ホワイトチョコチップ", spec: "5kg×2p", unit: "1ケース" },
    { code: "", maker: "ニッテン", name: "FRイースト", spec: "500g×25", unit: "1ケース" },
    { code: "", maker: "月島食品", name: "ラクトザック", spec: "10kg", unit: "1缶" },
    { code: "", maker: "", name: "ミルシア", spec: "5kg", unit: "1ケース" },
    { code: "", maker: "", name: "ルミナスグランデ", spec: "10kg", unit: "1ケース" },
    { code: "", maker: "", name: "ショコラクリュ ホワイト", spec: "5kg", unit: "1ケース" },
    { code: "", maker: "", name: "ドライストロベリーダイス", spec: "2.5kg×2", unit: "1ケース" },
    { code: "", maker: "川西フーズ", name: "パンプキンパウダー", spec: "1kg×5p", unit: "1ケース" },
];

const nexusItems = [
    { code: "", maker: "", name: "シーベリーペースト", spec: "1kg×15", unit: "1ケース" },
    { code: "", maker: "", name: "ハスカップペースト", spec: "1kg×15", unit: "1ケース" },
    { code: "", maker: "", name: "プチヴェール", spec: "1kg×10", unit: "1ケース" },
    { code: "", maker: "", name: "シーベリーペースト", spec: "1kg", unit: "1袋" },
    { code: "", maker: "", name: "ハスカップペースト", spec: "1kg", unit: "1袋" },
];

export default function ArrivalsPage() {
    const { canEdit } = useAuth();
    // ★変更: viewMode に 'order_sheet' (発注書プレビュー) を追加
    const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'order_sheet'>('list');
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<Item[]>([]);
    const [arrivals, setArrivals] = useState<Arrival[]>([]);
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    const [newItemId, setNewItemId] = useState("");
    const [newOrderDate, setNewOrderDate] = useState("");
    const [newExpectedDate, setNewExpectedDate] = useState("");
    const [newQuantity, setNewQuantity] = useState<number | "">("");
    const [newNotes, setNewNotes] = useState("");

    const [editingArrival, setEditingArrival] = useState<Arrival | null>(null);
    const [editExpectedDate, setEditExpectedDate] = useState("");
    const [editQuantity, setEditQuantity] = useState<number | "">("");
    const [editNotes, setEditNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // ★追加: 発注書（PDF）作成用のState
    const [orderSheetOpen, setOrderSheetOpen] = useState(false);
    const [orderSupplier, setOrderSupplier] = useState<'hashiya' | 'nexus'>('hashiya');
    const [orderDate, setOrderDate] = useState("");
    const [deliveryInfo, setDeliveryInfo] = useState("最短納品でお願いします。");
    const [orderQuantities, setOrderQuantities] = useState<Record<string, string>>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: iData } = await supabase.from("items").select("*").order("item_type", { ascending: true }).order("id", { ascending: true });
        const { data: aData } = await supabase.from("arrivals").select("*, items(name, item_type)").order("status", { ascending: false }).order("expected_date", { ascending: true });
        if (iData) setItems(iData as Item[]);
        if (aData) setArrivals(aData as Arrival[]);
        const today = new Date().toISOString().split('T')[0];
        setNewOrderDate(today); setNewExpectedDate(today); setOrderDate(today);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const selectedItemUnit = items.find(i => i.id === newItemId)?.unit || "";

    const handleSaveArrival = async () => {
        if (!newItemId || !newOrderDate || !newExpectedDate || !newQuantity) { alert("必須項目を入力してください。"); return; }
        const dateStr = newOrderDate.replace(/-/g, "");
        const random3 = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        const newArrival = { id: `INC-${dateStr}-${random3}`, item_id: newItemId, order_date: newOrderDate, expected_date: newExpectedDate, quantity: newQuantity, unit: selectedItemUnit, status: "pending", notes: newNotes };
        const { error } = await supabase.from("arrivals").insert(newArrival);
        if (!error) { alert("予定を登録しました！"); setNewItemId(""); setNewQuantity(""); setNewNotes(""); fetchData(); } else alert("エラー: " + error.message);
    };

    const openEditDialog = (arrival: Arrival) => { setEditingArrival(arrival); setEditExpectedDate(arrival.expected_date); setEditQuantity(arrival.quantity); setEditNotes(arrival.notes || ""); };

    const handleUpdateArrival = async () => {
        if (!editingArrival || !editExpectedDate || !editQuantity) return;
        setIsProcessing(true);
        const { error } = await supabase.from("arrivals").update({ expected_date: editExpectedDate, quantity: editQuantity, notes: editNotes }).eq("id", editingArrival.id);
        if (!error) { setEditingArrival(null); fetchData(); } else alert("更新失敗: " + error.message);
        setIsProcessing(false);
    };

    const handleDeleteArrival = async () => {
        if (!editingArrival) return;
        if (editingArrival.status === 'arrived') { alert("入荷済みのデータは削除できません。"); return; }
        if (!confirm("削除しますか？")) return;
        setIsProcessing(true);
        const { error } = await supabase.from("arrivals").delete().eq("id", editingArrival.id);
        if (!error) { setEditingArrival(null); fetchData(); } else alert("削除失敗: " + error.message);
        setIsProcessing(false);
    };

    const handleCompleteArrival = async () => {
        if (!editingArrival) return;
        if (!confirm(`【${editingArrival.items?.name}】を入荷済みにし、在庫に加算しますか？`)) return;
        setIsProcessing(true);
        try {
            const { data: stock } = await supabase.from('item_stocks').select('quantity').eq('item_id', editingArrival.item_id).single();
            const newQty = (stock?.quantity || 0) + editingArrival.quantity;
            await supabase.from('item_stocks').upsert({ item_id: editingArrival.item_id, quantity: newQty });
            await supabase.from('inventory_adjustments').insert({ item_id: editingArrival.item_id, before_qty: stock?.quantity || 0, after_qty: newQty, reason: '入荷' });
            await supabase.from("arrivals").update({ status: "arrived" }).eq("id", editingArrival.id);
            setEditingArrival(null); fetchData(); alert("入荷処理が完了し、在庫に加算されました！");
        } catch (err) { alert("エラーが発生しました。"); }
        setIsProcessing(false);
    };

    const getCalendarDays = () => {
        const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth();
        const firstDay = new Date(y, m, 1).getDay(); const daysInMonth = new Date(y, m + 1, 0).getDate();
        const blanks = Array(firstDay).fill(null); const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const totalSlots = blanks.length + days.length; const trailingBlanks = Array(Math.ceil(totalSlots / 7) * 7 - totalSlots).fill(null);
        return [...blanks, ...days, ...trailingBlanks];
    };

    // =======================================================================
    // ★追加: 発注書 (PDF) プレビュー＆印刷画面
    // =======================================================================
    if (viewMode === 'order_sheet') {
        const currentItems = orderSupplier === 'hashiya' ? hashiyaItems : nexusItems;
        const d = new Date(orderDate);
        const reiwaYear = d.getFullYear() - 2018; // 令和への変換
        const dateStr = `令和${reiwaYear}年${d.getMonth() + 1}月${d.getDate()}日 (${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]})`;

        return (
            <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
                {/* A4印刷用のCSS強制適用 */}
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
                        <Printer className="h-5 w-5 mr-2" /> 印刷する (PDFに保存)
                    </Button>
                </div>

                {/* 印刷エリア (A4サイズ枠) */}
                <div className="w-[210mm] min-h-[297mm] bg-white p-12 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border">
                    <h1 className="text-3xl font-bold tracking-[1.5em] text-center mb-16 ml-[1.5em]">発注書</h1>

                    <div className="flex justify-between items-start mb-12">
                        <div className="text-xl font-bold">
                            {orderSupplier === 'hashiya' ? "橋谷㈱" : "㈱ネクス"}　御中
                        </div>
                        <div className="text-sm text-right leading-relaxed font-medium">
                            社会福祉法人　小樽高島福祉会<br />
                            ワークセンター・やまびこ<br /><br />
                            TEL　0134-21-0011<br />
                            FAX　0134-21-0022<br /><br />
                            担当者　本間
                        </div>
                    </div>

                    <div className="mb-6 space-y-3 text-sm font-medium">
                        <div className="flex">
                            <div className="w-28">発注日</div>
                            <div>{dateStr}</div>
                        </div>
                        {orderSupplier === 'hashiya' && (
                            <div className="flex">
                                <div className="w-28">納期希望日</div>
                                <div>{deliveryInfo}</div>
                            </div>
                        )}
                    </div>

                    <table className="w-full border-collapse border-2 border-black text-sm">
                        <thead>
                            <tr className="bg-white">
                                <th className="border border-black py-2 px-1 w-[12%] font-medium">コード</th>
                                <th className="border border-black py-2 px-1 w-[18%] font-medium">メーカー</th>
                                <th className="border border-black py-2 px-1 w-[35%] font-medium">商品名</th>
                                <th className="border border-black py-2 px-1 w-[15%] font-medium">規格</th>
                                <th className="border border-black py-2 px-1 w-[8%] font-medium">単位</th>
                                <th className="border border-black py-2 px-1 w-[12%] font-medium">発注数量</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentItems.map((item, idx) => {
                                const key = `${item.name}-${item.spec}`;
                                const qty = orderQuantities[key] || "";
                                return (
                                    <tr key={idx} className="h-9">
                                        <td className="border border-black px-2 text-center">{item.code}</td>
                                        <td className="border border-black px-2">{item.maker}</td>
                                        <td className="border border-black px-2">{item.name}</td>
                                        <td className="border border-black px-2 text-right">{item.spec}</td>
                                        <td className="border border-black px-2 text-center">{item.unit}</td>
                                        <td className="border border-black px-2 text-center font-bold text-lg">{qty}</td>
                                    </tr>
                                );
                            })}
                            {/* 空行を追加して表の長さを整える (全体で22行程度にする) */}
                            {Array.from({ length: Math.max(0, 22 - currentItems.length) }).map((_, idx) => (
                                <tr key={`empty-${idx}`} className="h-9">
                                    <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // =======================================================================
    // カレンダー画面の描画
    // =======================================================================
    if (viewMode === 'calendar') {
        const daysArray = getCalendarDays(); const currentYear = calendarMonth.getFullYear(); const currentMonthStr = String(calendarMonth.getMonth() + 1).padStart(2, '0');
        const startDate = `${currentYear}-${currentMonthStr}-01`; const endDate = new Date(currentYear, calendarMonth.getMonth() + 1, 0).toISOString().split('T')[0];
        const calendarData = arrivals.filter(a => a.expected_date >= startDate && a.expected_date <= endDate);

        return (
            <div className="bg-white min-h-screen print:p-0 print:m-0 -mx-4 px-4 md:mx-0 md:px-0 pt-4 md:pt-0">
                <style dangerouslySetInnerHTML={{ __html: `@media print { header { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; } @page { size: landscape; margin: 10mm; } body { background-color: white !important; } }` }} />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden bg-slate-50 p-4 rounded-lg border shadow-sm">
                    <Button variant="outline" onClick={() => setViewMode('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">入力へ戻る</span><span className="sm:hidden">戻る</span></Button>
                    <div className="flex items-center justify-center gap-4 w-full md:w-auto">
                        <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-6 w-6" /></Button>
                        <h2 className="text-xl font-bold text-slate-800 w-32 text-center">{currentYear}年 {currentMonthStr}月</h2>
                        <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-6 w-6" /></Button>
                    </div>
                    <div className="flex justify-end w-full md:w-auto">
                        <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold shadow-sm w-full md:w-auto"><Printer className="h-4 w-4" /> 印刷</Button>
                    </div>
                </div>
                <div className="hidden print:flex justify-between items-end mb-3 border-b-2 border-black pb-2">
                    <div className="text-2xl font-black">入荷予定表 ({currentYear}年 {currentMonthStr}月)</div>
                    <div className="text-sm font-bold">更新日: {new Date().toLocaleDateString('ja-JP')}</div>
                </div>
                <div className="border border-slate-300 rounded-lg md:rounded-sm overflow-hidden print:border-black print:border-2">
                    <div className="hidden md:block print:block">
                        <div className="grid grid-cols-7 bg-slate-100 print:bg-gray-200 border-b border-slate-300 print:border-black">
                            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (<div key={d} className={`p-2 text-center font-bold text-sm border-r border-slate-300 print:border-black last:border-r-0 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{d}</div>))}
                        </div>
                        <div className="grid grid-cols-7">
                            {daysArray.map((day, idx) => {
                                const dateStr = day ? `${currentYear}-${currentMonthStr}-${String(day).padStart(2, '0')}` : null;
                                const dayArrivals = dateStr ? calendarData.filter(a => a.expected_date === dateStr) : [];
                                return (
                                    <div key={idx} className={`min-h-[140px] print:min-h-[100px] border-b border-slate-300 print:border-black p-1 ${idx % 7 !== 6 ? 'border-r print:border-black' : ''} ${!day ? 'bg-slate-50 print:bg-white' : 'bg-white'}`}>
                                        {day && (
                                            <>
                                                <div className={`text-right font-bold text-sm mb-1 ${idx % 7 === 0 ? 'text-red-600' : idx % 7 === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{day}</div>
                                                <div className="space-y-1.5 print:space-y-1">
                                                    {dayArrivals.map(arr => (
                                                        <div key={arr.id} onClick={() => canEdit && openEditDialog(arr)} className={`${arr.status === 'arrived' ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200"} border rounded p-1.5 print:p-1 cursor-pointer hover:shadow-md text-xs leading-tight wrap-break-word relative group`}>
                                                            {canEdit && <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 print:hidden text-slate-400"><Edit className="h-3 w-3" /></div>}
                                                            <div className="text-[10px] text-slate-500 print:text-black mb-0.5">{arr.items?.item_type === 'raw_material' ? '原料' : '資材'}</div>
                                                            <div className="font-bold text-slate-800 print:text-black pr-3">{arr.items?.name}</div>
                                                            <div className="font-black text-blue-700 print:text-black mt-0.5">{arr.quantity.toLocaleString()} <span className="font-normal text-[10px]">{arr.unit}</span></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="block md:hidden print:hidden divide-y divide-slate-200 bg-slate-50">
                        {daysArray.filter(d => d !== null).map((day) => {
                            const dateStr = `${currentYear}-${currentMonthStr}-${String(day).padStart(2, '0')}`;
                            const dObj = new Date(currentYear, calendarMonth.getMonth(), day as number);
                            const dow = dObj.getDay();
                            const dowStr = ['日', '月', '火', '水', '木', '金', '土'][dow];
                            const dowColor = dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-slate-700';
                            const dayArrivals = calendarData.filter(a => a.expected_date === dateStr);
                            return (
                                <div key={day} className={`flex p-3 ${dow === 0 ? 'bg-red-50/30' : dow === 6 ? 'bg-blue-50/30' : 'bg-white'}`}>
                                    <div className="w-12 shrink-0 flex flex-col items-center pt-1 border-r border-slate-100 mr-3 pr-1">
                                        <span className={`text-xl font-black leading-none ${dowColor}`}>{day}</span>
                                        <span className={`text-[10px] mt-1 font-bold ${dowColor}`}>{dowStr}</span>
                                    </div>
                                    <div className="flex-1 space-y-2.5 py-1 min-h-[3rem]">
                                        {dayArrivals.map(arr => (
                                            <div key={arr.id} onClick={() => canEdit && openEditDialog(arr)} className={`${arr.status === 'arrived' ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200"} border rounded p-2.5 text-xs shadow-sm relative group ${canEdit ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
                                                <div className="font-bold text-slate-800 text-sm mb-1.5">{arr.items?.name}</div>
                                                <div className="flex justify-between items-end">
                                                    <div className="font-black text-blue-700 text-lg">{arr.quantity.toLocaleString()} <span className="font-normal text-xs text-slate-500">{arr.unit}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                        {dayArrivals.length === 0 && <div className="text-xs text-slate-400 flex h-full items-center justify-center font-medium border border-dashed rounded-lg py-4 bg-slate-50/50">入荷予定なし</div>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // =======================================================================
    // 通常のリスト入力画面
    // =======================================================================
    return (
        <div className="bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><ArrowDownToLine className="h-6 w-6 text-blue-600" /> 入荷管理</h1>
                    {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {/* ★追加: 発注書(PDF)作成ボタン */}
                    <Button onClick={() => { setOrderQuantities({}); setOrderSheetOpen(true); }} className="w-full md:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-12 md:h-10">
                        <FileText className="h-4 w-4 mr-2" /> 発注書(PDF)作成
                    </Button>
                    <Button onClick={() => setViewMode('calendar')} variant="outline" className="w-full md:w-auto border-blue-300 text-blue-700 hover:bg-blue-50 gap-2 font-bold shadow-sm h-12 md:h-10">
                        <CalendarDays className="h-5 w-5" /> カレンダー表示
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-[35%]">
                    {canEdit ? (
                        <Card className="border-slate-200 shadow-sm sticky top-24">
                            <CardHeader className="bg-slate-50 pb-4 border-b"><CardTitle className="text-lg flex items-center gap-2"><Plus className="h-5 w-5" /> 新規入荷予定の登録</CardTitle></CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div><label className="block text-sm font-bold mb-1">対象品目</label><select value={newItemId} onChange={e => setNewItemId(e.target.value)} className="w-full border border-blue-200 rounded-md p-2.5 text-sm bg-white focus:ring-blue-500"><option value="">品目を選択</option><optgroup label="原材料">{items.filter(i => i.item_type === 'raw_material').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup><optgroup label="資材">{items.filter(i => i.item_type === 'material').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup></select></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold mb-1">発注日</label><Input type="date" value={newOrderDate} onChange={e => setNewOrderDate(e.target.value)} className="bg-white" /></div><div><label className="block text-sm font-bold mb-1 text-blue-800">入荷予定日</label><Input type="date" value={newExpectedDate} onChange={e => setNewExpectedDate(e.target.value)} className="bg-white border-blue-300 shadow-sm" /></div></div>
                                <div><label className="block text-sm font-bold mb-1">発注数</label><div className="flex items-center gap-3"><Input type="number" min="0" value={newQuantity} onChange={e => setNewQuantity(e.target.value === "" ? "" : Number(e.target.value))} className="text-xl font-bold text-right border-blue-300 shadow-sm h-12" /><span className="text-lg font-bold text-slate-500 w-12">{selectedItemUnit || "-"}</span></div></div>
                                <div><label className="block text-sm font-bold mb-1">備考</label><textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="発注先など..." className="w-full p-2 border border-slate-300 rounded-md text-sm resize-none h-20" /></div>
                                <div className="pt-2"><Button onClick={handleSaveArrival} disabled={!newItemId || !newQuantity} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-sm">予定を登録する</Button></div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-slate-200 bg-slate-50 opacity-70">
                            <CardContent className="p-8 md:p-16 text-center text-slate-500"><Lock className="w-12 h-12 mx-auto mb-4 text-slate-300" /><p className="font-bold">閲覧モードのため、新規登録はできません。</p></CardContent>
                        </Card>
                    )}
                </div>

                <div className="w-full lg:w-[65%]">
                    <h2 className="font-bold text-slate-700 mb-3">直近の入荷予定・実績</h2>
                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <Table className="min-w-[700px]">
                            <TableHeader className="bg-slate-50"><TableRow><TableHead>入荷予定日</TableHead><TableHead>品目</TableHead><TableHead className="text-right">数量</TableHead><TableHead className="w-24">ステータス</TableHead><TableHead className="w-20 text-center">詳細</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {arrivals.slice(0, 15).map((arrival) => (
                                    <TableRow key={arrival.id} className="hover:bg-slate-50">
                                        <TableCell className={arrival.status === 'pending' && new Date(arrival.expected_date) < new Date(new Date().setHours(0, 0, 0, 0)) ? "text-red-600 font-bold" : ""}>{new Date(arrival.expected_date).toLocaleDateString()}</TableCell>
                                        <TableCell><div className="font-bold text-slate-800">{arrival.items?.name}</div><div className="text-[10px] text-slate-500">{arrival.items?.item_type === 'raw_material' ? '原料' : '資材'}</div></TableCell>
                                        <TableCell className="text-right font-bold text-lg text-blue-700">{arrival.quantity.toLocaleString()} <span className="text-sm font-normal text-slate-500">{arrival.unit}</span></TableCell>
                                        <TableCell>{arrival.status === 'arrived' ? <Badge className="bg-green-100 text-green-800 border-none shadow-sm"><CheckCircle2 className="w-3 h-3 mr-1" />入荷済</Badge> : <Badge className="bg-blue-500 text-white border-none shadow-sm"><PackageCheck className="w-3 h-3 mr-1" />発注済</Badge>}</TableCell>
                                        <TableCell className="text-center"><Button variant="outline" size="sm" onClick={() => openEditDialog(arrival)} className="text-blue-600 border-blue-200 hover:bg-blue-50">確認</Button></TableCell>
                                    </TableRow>
                                ))}
                                {loading && arrivals.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></TableCell></TableRow>}
                                {!loading && arrivals.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500 border border-dashed rounded-lg bg-white">データがありません</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* --- 発注書（PDF）作成用 モーダル --- */}
            <Dialog open={orderSheetOpen} onOpenChange={setOrderSheetOpen}>
                <DialogContent className="w-[95vw] max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" /> 発注書 (PDF) の作成</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">発注先</label>
                                <select value={orderSupplier} onChange={e => { setOrderSupplier(e.target.value as any); setOrderQuantities({}); }} className="w-full border border-blue-200 p-2 rounded-md font-bold">
                                    <option value="hashiya">橋谷㈱</option><option value="nexus">㈱ネクス</option>
                                </select>
                            </div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">発注日</label><Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} /></div>
                        </div>
                        {orderSupplier === 'hashiya' && (
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">納期希望日</label><Input value={deliveryInfo} onChange={e => setDeliveryInfo(e.target.value)} /></div>
                        )}

                        <div className="border rounded-md overflow-hidden shadow-sm">
                            <Table className="text-sm">
                                <TableHeader className="bg-slate-50">
                                    <TableRow><TableHead>商品名</TableHead><TableHead>規格 / 単位</TableHead><TableHead className="w-24 text-center">発注数量</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(orderSupplier === 'hashiya' ? hashiyaItems : nexusItems).map(item => {
                                        const key = `${item.name}-${item.spec}`;
                                        return (
                                            <TableRow key={key} className="hover:bg-slate-50">
                                                <TableCell className="font-bold text-slate-800 py-2">{item.name}</TableCell>
                                                <TableCell className="py-2 text-slate-500 text-xs">{item.spec} <br /> {item.unit}</TableCell>
                                                <TableCell className="py-1">
                                                    <Input type="number" min="0" value={orderQuantities[key] || ""} onChange={e => setOrderQuantities({ ...orderQuantities, [key]: e.target.value })} className="h-8 text-right font-bold text-blue-700 focus-visible:ring-blue-500" />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    <DialogFooter className="mt-4 pt-4 border-t">
                        <Button variant="outline" onClick={() => setOrderSheetOpen(false)}>キャンセル</Button>
                        <Button onClick={() => { setOrderSheetOpen(false); setViewMode('order_sheet'); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold"><Printer className="w-4 h-4 mr-2" /> プレビュー＆印刷へ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- 既存の入荷詳細モーダル --- */}
            <Dialog open={!!editingArrival} onOpenChange={(open) => !open && setEditingArrival(null)}>
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader><DialogTitle className="flex justify-between items-center"><span>入荷予定の詳細 / 処理</span></DialogTitle></DialogHeader>
                    {editingArrival && (
                        <div className="space-y-4 mt-2">
                            <div className="bg-slate-50 p-3 rounded border text-sm"><div className="text-slate-500 text-xs mb-1">発注日: {new Date(editingArrival.order_date).toLocaleDateString()}</div><div className="font-bold text-lg text-blue-900 leading-tight">{editingArrival.items?.name}</div><div className="text-slate-500 text-xs mt-1">{editingArrival.items?.item_type === 'raw_material' ? '原材料' : '資材'}</div></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">入荷予定日</label><Input type="date" value={editExpectedDate} onChange={e => setEditExpectedDate(e.target.value)} disabled={editingArrival.status === 'arrived' || !canEdit} className="h-10 md:h-9" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">数量 ({editingArrival.unit})</label><Input type="number" value={editQuantity} onChange={e => setEditQuantity(e.target.value === "" ? "" : Number(e.target.value))} disabled={editingArrival.status === 'arrived' || !canEdit} className="h-10 md:h-9 text-right font-bold text-lg text-blue-700" /></div>
                            </div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">備考</label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} disabled={editingArrival.status === 'arrived' || !canEdit} className="h-10 md:h-9" /></div>

                            {canEdit && (
                                <div className="pt-4 border-t flex flex-col gap-3">
                                    {editingArrival.status === 'pending' && <div className="flex gap-2"><Button onClick={handleUpdateArrival} disabled={isProcessing} className="flex-1 bg-slate-800 text-white h-10 md:h-9"><Edit className="h-4 w-4 mr-2" /> 内容更新</Button><Button onClick={handleDeleteArrival} disabled={isProcessing} variant="outline" className="text-red-600 h-10 md:h-9"><Trash2 className="h-4 w-4" /></Button></div>}
                                    {editingArrival.status === 'pending' && <Button onClick={handleCompleteArrival} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 shadow-sm text-base"><ArrowDownToLine className="h-5 w-5 mr-2" /> 入荷済にする (在庫加算)</Button>}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}