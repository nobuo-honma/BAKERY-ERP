"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDownToLine, CalendarDays, Loader2, Plus, Printer, ArrowLeft, ChevronLeft, ChevronRight, Edit, Trash2, CheckCircle2, PackageCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- 型定義 ---
type Item = { id: string; name: string; item_type: string; unit: string; };
type Arrival = { id: string; item_id: string; order_date: string; expected_date: string; quantity: number; unit: string; status: string; notes?: string; items?: { name: string; item_type: string } };

export default function ArrivalsPage() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [loading, setLoading] = useState(true);
  
  // データ用State
  const [items, setItems] = useState<Item[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);

  // カレンダー用State
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // 新規登録フォーム用State
  const [newItemId, setNewItemId] = useState("");
  const [newOrderDate, setNewOrderDate] = useState("");
  const [newExpectedDate, setNewExpectedDate] = useState("");
  const [newQuantity, setNewQuantity] = useState<number | "">("");
  const [newNotes, setNewNotes] = useState("");

  // 編集・ステータス更新ダイアログ用State
  const [editingArrival, setEditingArrival] = useState<Arrival | null>(null);
  const [editExpectedDate, setEditExpectedDate] = useState("");
  const [editQuantity, setEditQuantity] = useState<number | "">("");
  const [editNotes, setEditNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 初回マウント判定用
  const isInitialMount = useRef(true);

  // --- データ取得関数 ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 品目マスタの取得
      const { data: iData } = await supabase.from("items").select("*").order("item_type", { ascending: true }).order("id", { ascending: true });
      // 2. 入荷データ一覧
      const { data: aData } = await supabase.from("arrivals").select("*, items(name, item_type)").order("status", { ascending: false }).order("expected_date", { ascending: true });

      if (iData) setItems(iData as Item[]);
      if (aData) setArrivals(aData as Arrival[]);

      // 日付の初期設定は初回のみ
      if (isInitialMount.current) {
        const today = new Date().toISOString().split('T')[0];
        setNewOrderDate(today);
        setNewExpectedDate(today);
        isInitialMount.current = false;
      }
    } catch (error) {
      console.error("Data fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 選択された品目の単位を取得
  const selectedItemUnit = items.find(i => i.id === newItemId)?.unit || "";

  // --- 1. 新規登録処理 ---
  const handleSaveArrival = async () => {
    if (!newItemId || !newOrderDate || !newExpectedDate || !newQuantity) {
      alert("必須項目を入力してください。"); return;
    }

    const dateStr = newOrderDate.replace(/-/g, "");
    const random3 = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const arrivalId = `INC-${dateStr}-${random3}`;

    const newArrival = {
      id: arrivalId, item_id: newItemId, order_date: newOrderDate, expected_date: newExpectedDate,
      quantity: newQuantity, unit: selectedItemUnit, status: "pending", notes: newNotes
    };

    const { error } = await supabase.from("arrivals").insert(newArrival);
    if (!error) {
      alert("入荷予定(発注)を登録しました！");
      setNewItemId(""); setNewQuantity(""); setNewNotes("");
      fetchData();
    } else alert("エラー: " + error.message);
  };

  const openEditDialog = (arrival: Arrival) => {
    setEditingArrival(arrival);
    setEditExpectedDate(arrival.expected_date);
    setEditQuantity(arrival.quantity);
    setEditNotes(arrival.notes || "");
  };

  // --- 2. 予定の更新・削除 ---
  const handleUpdateArrival = async () => {
    if (!editingArrival || !editExpectedDate || !editQuantity) return;
    setIsProcessing(true);
    const { error } = await supabase.from("arrivals").update({ expected_date: editExpectedDate, quantity: editQuantity, notes: editNotes }).eq("id", editingArrival.id);
    if (!error) {
      setEditingArrival(null); fetchData();
    } else alert("更新失敗: " + error.message);
    setIsProcessing(false);
  };

  const handleDeleteArrival = async () => {
    if (!editingArrival) return;
    if (editingArrival.status === 'arrived') {
      alert("入荷済みのデータは削除できません。"); return;
    }
    if (!confirm("この入荷予定を削除しますか？")) return;
    setIsProcessing(true);
    const { error } = await supabase.from("arrivals").delete().eq("id", editingArrival.id);
    if (!error) {
      setEditingArrival(null); fetchData();
    } else alert("削除失敗: " + error.message);
    setIsProcessing(false);
  };

  // --- 3. 入荷処理（在庫加算ロジック） ---
  const handleCompleteArrival = async () => {
    if (!editingArrival) return;
    if (!confirm(`【${editingArrival.items?.name}】を入荷済みにしますか？\n（現在の在庫に ${editingArrival.quantity} ${editingArrival.unit} が加算されます）`)) return;
    
    setIsProcessing(true);
    try {
      const { data: stock } = await supabase.from('item_stocks').select('quantity').eq('item_id', editingArrival.item_id).single();
      const currentQty = stock?.quantity || 0;
      const newQty = currentQty + editingArrival.quantity;

      await supabase.from('item_stocks').upsert({ item_id: editingArrival.item_id, quantity: newQty });

      await supabase.from('inventory_adjustments').insert({
        item_id: editingArrival.item_id, before_qty: currentQty, after_qty: newQty, reason: '入荷'
      });

      await supabase.from("arrivals").update({ status: "arrived" }).eq("id", editingArrival.id);

      setEditingArrival(null);
      fetchData();
      alert("入荷処理が完了し、在庫に加算されました！");
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました。");
    }
    setIsProcessing(false);
  };

  const getCalendarDays = () => {
    const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay(); const daysInMonth = new Date(y, m + 1, 0).getDate();
    const blanks = Array(firstDay).fill(null); const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const totalSlots = blanks.length + days.length; const trailingBlanks = Array(Math.ceil(totalSlots / 7) * 7 - totalSlots).fill(null);
    return [...blanks, ...days, ...trailingBlanks];
  };

  if (loading && arrivals.length === 0) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-500" /></div>;

  // --- カレンダー画面の描画 ---
  if (viewMode === 'calendar') {
    const daysArray = getCalendarDays();
    const currentYear = calendarMonth.getFullYear();
    const currentMonthStr = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const startDate = `${currentYear}-${currentMonthStr}-01`;
    const endDate = new Date(currentYear, calendarMonth.getMonth() + 1, 0).toISOString().split('T')[0];
    const calendarData = arrivals.filter(a => a.expected_date >= startDate && a.expected_date <= endDate);

    return (
      <div className="bg-white min-h-screen print:p-0 print:m-0">
        <div className="flex justify-between items-center mb-6 print:hidden bg-slate-50 p-4 rounded-lg border shadow-sm">
          <Button variant="outline" onClick={() => setViewMode('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> 入荷入力へ戻る</Button>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-6 w-6" /></Button>
            <h2 className="text-xl font-bold text-slate-800 w-40 text-center">{currentYear}年 {currentMonthStr}月</h2>
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-6 w-6" /></Button>
          </div>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white gap-2"><Printer className="h-4 w-4" /> 予定表を印刷</Button>
        </div>

        <div className="hidden print:block text-2xl font-bold mb-4 text-center border-b-2 border-black pb-2">
          入荷予定表 ({currentYear}年 {currentMonthStr}月)
        </div>

        <div className="border border-slate-300 rounded-sm print:border-black">
          <div className="grid grid-cols-7 bg-slate-100 print:bg-gray-200 border-b border-slate-300 print:border-black">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <div key={d} className={`p-2 text-center font-bold text-sm border-r border-slate-300 print:border-black last:border-r-0 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7">
            {daysArray.map((day, idx) => {
              const dateStr = day ? `${currentYear}-${currentMonthStr}-${String(day).padStart(2, '0')}` : null;
              const dayArrivals = dateStr ? calendarData.filter(a => a.expected_date === dateStr) :[];

              return (
                <div key={idx} className={`min-h-35 print:min-h-25 border-b border-slate-300 print:border-black p-1 ${idx % 7 !== 6 ? 'border-r' : ''} ${!day ? 'bg-slate-50 print:bg-white' : 'bg-white'}`}>
                  {day && (
                    <>
                      <div className={`text-right font-bold text-sm mb-1 ${idx % 7 === 0 ? 'text-red-600' : idx % 7 === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{day}</div>
                      <div className="space-y-1.5 print:space-y-1">
                        {dayArrivals.map(arr => {
                          const isArrived = arr.status === 'arrived';
                          const cardColor = isArrived ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200";

                          return (
                            <div 
                              key={arr.id} 
                              onClick={() => openEditDialog(arr)}
                              className={`${cardColor} border rounded p-1.5 print:p-1 print:border-black print:bg-white cursor-pointer hover:shadow-md transition-shadow text-xs leading-tight whitespace-normal wrap-break-word relative group`}
                              title="クリックして詳細・入荷処理"
                            >
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden text-slate-400"><Edit className="h-3 w-3" /></div>
                              <div className="text-[10px] text-slate-500 print:text-black mb-0.5">{arr.items?.item_type === 'raw_material' ? '原料' : '資材'}</div>
                              <div className="font-bold text-slate-800 print:text-black pr-3">{arr.items?.name}</div>
                              <div className="font-black text-blue-700 print:text-black mt-0.5">{arr.quantity.toLocaleString()} <span className="font-normal text-[10px]">{arr.unit}</span></div>
                              {arr.notes && <div className="mt-1 pt-1 border-t border-slate-200 print:border-black text-[10px] text-slate-700 print:text-black italic break-all">{arr.notes}</div>}
                              
                              <div className="mt-1 flex justify-end print:hidden">
                                {isArrived ? 
                                  <span className="text-[10px] bg-green-600 text-white px-1.5 rounded font-bold flex items-center gap-0.5"><CheckCircle2 className="h-2 w-2"/> 入荷済</span> : 
                                  <span className="text-[10px] bg-blue-500 text-white px-1.5 rounded font-bold flex items-center gap-0.5"><PackageCheck className="h-2 w-2"/> 発注済</span>
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
          <ArrowDownToLine className="h-6 w-6 text-blue-600" />
          入荷管理 (発注・受け入れ)
        </h1>
        <Button onClick={() => setViewMode('calendar')} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-2 font-bold shadow-sm">
          <CalendarDays className="h-5 w-5" /> 入荷予定表(カレンダー)
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[35%]">
          <Card className="border-slate-200 shadow-sm sticky top-24">
            <CardHeader className="bg-slate-50 pb-4 border-b rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800"><Plus className="h-5 w-5" /> 新規入荷予定(発注)の登録</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-slate-700">対象品目 (原料・資材)</label>
                <select value={newItemId} onChange={e => setNewItemId(e.target.value)} className="w-full border border-blue-200 rounded-md p-2.5 text-sm bg-white focus:ring-blue-500">
                  <option value="">品目を選択してください</option>
                  <optgroup label="原材料">
                    {items.filter(i => i.item_type === 'raw_material').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                  <optgroup label="資材">
                    {items.filter(i => i.item_type === 'material').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">発注日</label>
                  <Input type="date" value={newOrderDate} onChange={e => setNewOrderDate(e.target.value)} className="bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-blue-800">入荷予定日</label>
                  <Input type="date" value={newExpectedDate} onChange={e => setNewExpectedDate(e.target.value)} className="bg-white border-blue-300 shadow-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1 text-slate-700">発注・入荷予定数</label>
                <div className="flex items-center gap-3">
                  <Input type="number" min="0" value={newQuantity} onChange={e => setNewQuantity(e.target.value === "" ? "" : Number(e.target.value))} className="text-xl font-bold text-right border-blue-300 shadow-sm h-12" />
                  <span className="text-lg font-bold text-slate-500 w-12">{selectedItemUnit || "-"}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1 text-slate-700">備考 (任意)</label>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="発注先や連絡事項など..." className="w-full p-2 border border-slate-300 rounded-md text-sm resize-none h-20" />
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveArrival} disabled={!newItemId || !newQuantity} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-sm">
                  予定を登録する
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-[65%]">
          <h2 className="font-bold text-slate-700 mb-3">直近の入荷予定・実績</h2>
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <Table className="min-w-175">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>入荷予定日</TableHead>
                  <TableHead>品目</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="w-24">ステータス</TableHead>
                  <TableHead className="w-20 text-center">詳細</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arrivals.slice(0, 15).map((arrival) => (
                  <TableRow key={arrival.id} className="hover:bg-slate-50">
                    <TableCell className={arrival.status === 'pending' && new Date(arrival.expected_date) < new Date(new Date().setHours(0,0,0,0)) ? "text-red-600 font-bold" : ""}>
                      {new Date(arrival.expected_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-800">{arrival.items?.name}</div>
                      <div className="text-[10px] text-slate-500">{arrival.items?.item_type === 'raw_material' ? '原料' : '資材'}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg text-blue-700">{arrival.quantity.toLocaleString()} <span className="text-sm font-normal text-slate-500">{arrival.unit}</span></TableCell>
                    <TableCell>
                      {arrival.status === 'arrived' ? 
                        <Badge className="bg-green-100 text-green-800 border-none shadow-sm"><CheckCircle2 className="w-3 h-3 mr-1"/>入荷済</Badge> : 
                        <Badge className="bg-blue-500 text-white border-none shadow-sm"><PackageCheck className="w-3 h-3 mr-1"/>発注済</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(arrival)} className="text-blue-600 border-blue-200 hover:bg-blue-50">確認</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {arrivals.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">データがありません</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={!!editingArrival} onOpenChange={(open) => !open && setEditingArrival(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              <span>入荷予定の詳細 / 処理</span>
              {editingArrival?.status === 'pending' ? <Badge className="bg-blue-500 text-white border-none">発注済 (未入荷)</Badge> : <Badge className="bg-green-600 text-white border-none">入荷済</Badge>}
            </DialogTitle>
          </DialogHeader>

          {editingArrival && (
            <div className="space-y-4 mt-2">
              <div className="bg-slate-50 p-3 rounded border text-sm">
                <div className="text-slate-500 text-xs mb-1">発注日: {new Date(editingArrival.order_date).toLocaleDateString()}</div>
                <div className="font-bold text-lg text-blue-900">{editingArrival.items?.name}</div>
                <div className="text-slate-500 text-xs">{editingArrival.items?.item_type === 'raw_material' ? '原材料' : '資材'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">入荷予定日</label>
                  <Input type="date" value={editExpectedDate} onChange={e => setEditExpectedDate(e.target.value)} disabled={editingArrival.status === 'arrived'} className="h-9"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">数量 ({editingArrival.unit})</label>
                  <Input type="number" value={editQuantity} onChange={e => setEditQuantity(e.target.value === "" ? "" : Number(e.target.value))} disabled={editingArrival.status === 'arrived'} className="h-9 text-right font-bold text-blue-700"/>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">備考</label>
                <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} disabled={editingArrival.status === 'arrived'} className="h-9" placeholder="備考を入力..."/>
              </div>

              <div className="pt-4 border-t flex flex-col gap-3">
                {editingArrival.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateArrival} disabled={isProcessing} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white"><Edit className="h-4 w-4 mr-2"/> 内容を更新</Button>
                    <Button onClick={handleDeleteArrival} disabled={isProcessing} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4"/></Button>
                  </div>
                )}

                {editingArrival.status === 'pending' && (
                  <Button onClick={handleCompleteArrival} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 shadow-sm text-lg mt-2">
                    {isProcessing ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <ArrowDownToLine className="h-5 w-5 mr-2"/>}
                    入荷済にする (在庫に加算)
                  </Button>
                )}
                {editingArrival.status === 'arrived' && (
                  <div className="text-center text-sm font-bold text-green-700 bg-green-50 py-3 rounded-md">
                    このデータは入荷済のため、在庫へ加算されています。
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}