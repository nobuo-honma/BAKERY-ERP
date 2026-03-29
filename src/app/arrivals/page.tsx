"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDownToLine, CalendarDays, Loader2, Plus, Printer, ArrowLeft, ChevronLeft, ChevronRight, Edit, Trash2, CheckCircle2, PackageCheck, Lock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

type Item = { id: string; name: string; item_type: string; unit: string; };
type Arrival = { id: string; item_id: string; order_date: string; expected_date: string; quantity: number; unit: string; status: string; notes?: string; items?: { name: string; item_type: string } };

export default function ArrivalsPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const[calendarMonth, setCalendarMonth] = useState(new Date());

  const [newItemId, setNewItemId] = useState("");
  const [newOrderDate, setNewOrderDate] = useState("");
  const [newExpectedDate, setNewExpectedDate] = useState("");
  const [newQuantity, setNewQuantity] = useState<number | "">("");
  const [newNotes, setNewNotes] = useState("");

  const [editingArrival, setEditingArrival] = useState<Arrival | null>(null);
  const [editExpectedDate, setEditExpectedDate] = useState("");
  const [editQuantity, setEditQuantity] = useState<number | "">("");
  const[editNotes, setEditNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: iData } = await supabase.from("items").select("*").order("item_type", { ascending: true }).order("id", { ascending: true });
    const { data: aData } = await supabase.from("arrivals").select("*, items(name, item_type)").order("status", { ascending: false }).order("expected_date", { ascending: true });
    if (iData) setItems(iData as Item[]);
    if (aData) setArrivals(aData as Arrival[]);
    const today = new Date().toISOString().split('T')[0];
    setNewOrderDate(today); setNewExpectedDate(today);
    setLoading(false);
  },[]);

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
    return[...blanks, ...days, ...trailingBlanks];
  };

  if (viewMode === 'calendar') {
    const daysArray = getCalendarDays(); const currentYear = calendarMonth.getFullYear(); const currentMonthStr = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const startDate = `${currentYear}-${currentMonthStr}-01`; const endDate = new Date(currentYear, calendarMonth.getMonth() + 1, 0).toISOString().split('T')[0];
    const calendarData = arrivals.filter(a => a.expected_date >= startDate && a.expected_date <= endDate);

    return (
      <div className="bg-white min-h-screen print:p-0 print:m-0">
        <style dangerouslySetInnerHTML={{__html: `@media print { header { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; } @page { size: landscape; margin: 10mm; } body { background-color: white !important; } }`}} />
        <div className="flex justify-between items-center mb-6 print:hidden bg-slate-50 p-4 rounded-lg border shadow-sm">
          <Button variant="outline" onClick={() => setViewMode('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> 戻る</Button>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-6 w-6" /></Button>
            <h2 className="text-xl font-bold text-slate-800 w-40 text-center">{currentYear}年 {currentMonthStr}月</h2>
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-6 w-6" /></Button>
          </div>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold"><Printer className="h-4 w-4" /> 印刷</Button>
        </div>
        <div className="hidden print:flex justify-between items-end mb-3 border-b-2 border-black pb-2">
          <div className="text-2xl font-black">入荷予定表 ({currentYear}年 {currentMonthStr}月)</div>
          <div className="text-sm font-bold">更新日: {new Date().toLocaleDateString('ja-JP')}</div>
        </div>
        <div className="border border-slate-300 rounded-sm print:border-black print:border-2">
          <div className="grid grid-cols-7 bg-slate-100 print:bg-gray-100 border-b border-slate-300 print:border-black">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (<div key={d} className={`p-2 text-center font-bold text-sm border-r border-slate-300 print:border-black last:border-r-0 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{d}</div>))}
          </div>
          <div className="grid grid-cols-7">
            {daysArray.map((day, idx) => {
              const dateStr = day ? `${currentYear}-${currentMonthStr}-${String(day).padStart(2, '0')}` : null;
              const dayArrivals = dateStr ? calendarData.filter(a => a.expected_date === dateStr) :[];
              return (
                <div key={idx} className={`min-h-[140px] print:min-h-[100px] border-b border-slate-300 print:border-black p-1 ${idx % 7 !== 6 ? 'border-r print:border-black' : ''} ${!day ? 'bg-slate-50 print:bg-white' : 'bg-white'}`}>
                  {day && (
                    <>
                      <div className={`text-right font-bold text-sm mb-1 ${idx % 7 === 0 ? 'text-red-600' : idx % 7 === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{day}</div>
                      <div className="space-y-1.5 print:space-y-1">
                        {dayArrivals.map(arr => (
                          <div key={arr.id} onClick={() => openEditDialog(arr)} className={`${arr.status === 'arrived' ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200"} border rounded p-1.5 print:p-1 cursor-pointer hover:shadow-md text-xs leading-tight wrap-break-word relative group`}>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 print:hidden text-slate-400"><Edit className="h-3 w-3" /></div>
                            <div className="text-[10px] text-slate-500 print:text-black mb-0.5">{arr.items?.item_type === 'raw_material' ? '原料' : '資材'}</div>
                            <div className="font-bold text-slate-800 print:text-black pr-3">{arr.items?.name}</div>
                            <div className="font-black text-blue-700 print:text-black mt-0.5">{arr.quantity.toLocaleString()} <span className="font-normal text-[10px]">{arr.unit}</span></div>
                            {arr.notes && <div className="mt-1 pt-1 border-t border-slate-200 print:border-black text-[10px] text-slate-700 print:text-black italic break-all">{arr.notes}</div>}
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
        {/* ダイアログは下部で共通利用 */}
      </div>
    );
  }

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><ArrowDownToLine className="h-6 w-6 text-blue-600" /> 入荷管理</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1"/> 閲覧モード</Badge>}
        </div>
        <Button onClick={() => setViewMode('calendar')} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-2 font-bold shadow-sm">
          <CalendarDays className="h-5 w-5" /> カレンダー表示
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[35%]">
          {canEdit ? (
            <Card className="border-slate-200 shadow-sm sticky top-24">
              <CardHeader className="bg-slate-50 pb-4 border-b"><CardTitle className="text-lg flex items-center gap-2"><Plus className="h-5 w-5" /> 新規入荷予定の登録</CardTitle></CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div><label className="block text-sm font-bold mb-1">対象品目</label><select value={newItemId} onChange={e => setNewItemId(e.target.value)} className="w-full border border-blue-200 rounded-md p-2.5 text-sm bg-white focus:ring-blue-500"><option value="">品目を選択</option><optgroup label="原材料">{items.filter(i => i.item_type === 'raw_material').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup><optgroup label="資材">{items.filter(i => i.item_type === 'material').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup></select></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold mb-1">発注日</label><Input type="date" value={newOrderDate} onChange={e => setNewOrderDate(e.target.value)} className="bg-white" /></div><div><label className="block text-sm font-bold mb-1 text-blue-800">入荷予定日</label><Input type="date" value={newExpectedDate} onChange={e => setNewExpectedDate(e.target.value)} className="bg-white border-blue-300" /></div></div>
                <div><label className="block text-sm font-bold mb-1">発注数</label><div className="flex items-center gap-3"><Input type="number" min="0" value={newQuantity} onChange={e => setNewQuantity(e.target.value === "" ? "" : Number(e.target.value))} className="text-xl font-bold text-right border-blue-300 h-12" /><span className="text-lg font-bold text-slate-500 w-12">{selectedItemUnit || "-"}</span></div></div>
                <div><label className="block text-sm font-bold mb-1">備考</label><textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm resize-none h-20" /></div>
                <div className="pt-2"><Button onClick={handleSaveArrival} disabled={!newItemId || !newQuantity} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12">予定を登録する</Button></div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 bg-slate-50 opacity-70">
              <CardContent className="p-8 text-center text-slate-500"><Lock className="w-12 h-12 mx-auto mb-4 text-slate-300"/>閲覧モードのため、新規登録はできません。</CardContent>
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
                    <TableCell className={arrival.status === 'pending' && new Date(arrival.expected_date) < new Date(new Date().setHours(0,0,0,0)) ? "text-red-600 font-bold" : ""}>{new Date(arrival.expected_date).toLocaleDateString()}</TableCell>
                    <TableCell><div className="font-bold text-slate-800">{arrival.items?.name}</div></TableCell>
                    <TableCell className="text-right font-bold text-lg text-blue-700">{arrival.quantity.toLocaleString()} <span className="text-sm font-normal text-slate-500">{arrival.unit}</span></TableCell>
                    <TableCell>{arrival.status === 'arrived' ? <Badge className="bg-green-100 text-green-800 border-none">入荷済</Badge> : <Badge className="bg-blue-500 text-white border-none">発注済</Badge>}</TableCell>
                    <TableCell className="text-center"><Button variant="outline" size="sm" onClick={() => openEditDialog(arrival)}>確認</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={!!editingArrival} onOpenChange={(open) => !open && setEditingArrival(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader><DialogTitle className="flex justify-between items-center"><span>入荷予定の詳細 / 処理</span></DialogTitle></DialogHeader>
          {editingArrival && (
            <div className="space-y-4 mt-2">
              <div className="bg-slate-50 p-3 rounded border text-sm"><div className="text-slate-500 text-xs mb-1">発注日: {new Date(editingArrival.order_date).toLocaleDateString()}</div><div className="font-bold text-lg text-blue-900">{editingArrival.items?.name}</div></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 mb-1">入荷予定日</label><Input type="date" value={editExpectedDate} onChange={e => setEditExpectedDate(e.target.value)} disabled={editingArrival.status === 'arrived' || !canEdit} className="h-9"/></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">数量 ({editingArrival.unit})</label><Input type="number" value={editQuantity} onChange={e => setEditQuantity(e.target.value === "" ? "" : Number(e.target.value))} disabled={editingArrival.status === 'arrived' || !canEdit} className="h-9 text-right font-bold"/></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">備考</label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} disabled={editingArrival.status === 'arrived' || !canEdit} className="h-9" /></div>
              
              <div className="pt-4 border-t flex flex-col gap-3">
                {editingArrival.status === 'pending' && canEdit && (
                  <div className="flex gap-2"><Button onClick={handleUpdateArrival} disabled={isProcessing} className="flex-1 bg-slate-800 text-white"><Edit className="h-4 w-4 mr-2"/> 内容を更新</Button><Button onClick={handleDeleteArrival} disabled={isProcessing} variant="outline" className="text-red-600"><Trash2 className="h-4 w-4"/></Button></div>
                )}
                {editingArrival.status === 'pending' && canEdit && (
                  <Button onClick={handleCompleteArrival} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12"><ArrowDownToLine className="h-5 w-5 mr-2"/> 入荷済にする (在庫に加算)</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}