"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Factory, Calendar as CalendarIcon, PackageCheck, Loader2, ListPlus, CheckCircle2, CalendarDays, Printer, ArrowLeft, ChevronLeft, ChevronRight, Edit, Trash2, Play, CheckCircle } from "lucide-react";
import { calculateExpiryDate, generateLotNumber } from "@/lib/lot-generator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- 型定義 ---
type Order = { id: string; order_date: string; desired_ship_date: string; quantity: number; status: string; product_id: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number }; plannedCs: number; remainCs: number; };
type Plan = { id: string; order_id: string; product_id: string; production_date: string; production_kg: number; planned_cs: number; lot_code: string; expiry_date: string; status: string; notes?: string; products?: { name: string; variant_name: string; unit_per_cs?: number; unit_per_kg?: number } };

export default function ProductionPage() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const[loading, setLoading] = useState(true);

  // カレンダー用State
  const[calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarPlans, setCalendarPlans] = useState<Plan[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // 計画入力用State (リスト画面用)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [planDate, setPlanDate] = useState("");
  const[planKg, setPlanKg] = useState<number | "">("");
  const [planNotes, setPlanNotes] = useState("");
  const [calculatedLot, setCalculatedLot] = useState("");
  const[calculatedExpiry, setCalculatedExpiry] = useState("");
  const [calculatedCs, setCalculatedCs] = useState(0);

  // --- ★追加: カレンダー上の編集/ステータス変更用State ---
  const[editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editKg, setEditKg] = useState<number | "">("");
  const [editNotes, setEditNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false); // 在庫処理中のローディング

  // --- 初期データ取得 ---
  useEffect(() => { fetchData(); },[]);

  const fetchData = async (preserveSelectedId?: string) => {
    setLoading(true);
    const { data: oData } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_kg, unit_per_cs), production_plans(planned_cs)").in("status", ["received", "in_production"]).order("desired_ship_date", { ascending: true });
    const { data: pData } = await supabase.from("production_plans").select("*, products(name, variant_name)").order("created_at", { ascending: false }).limit(10);

    const processedOrders = (oData as any[])?.map(o => {
      const plannedTotal = o.production_plans ? o.production_plans.reduce((sum: number, p: any) => sum + p.planned_cs, 0) : 0;
      return { ...o, plannedCs: plannedTotal, remainCs: o.quantity - plannedTotal };
    }).filter(o => o.remainCs > 0) ||[];

    setOrders(processedOrders);
    if (pData) setPlans(pData as Plan[]);
    
    if (preserveSelectedId) {
      const stillRemainingOrder = processedOrders.find(o => o.id === preserveSelectedId);
      if (stillRemainingOrder) {
        setSelectedOrder(stillRemainingOrder);
        resetInputForNextDay(stillRemainingOrder, planDate);
      } else setSelectedOrder(null);
    } else if (!selectedOrder) {
      setPlanDate(new Date().toISOString().split('T')[0]);
    }
    setLoading(false);
  };

  // --- カレンダーデータの取得 ---
  useEffect(() => { if (viewMode === 'calendar') fetchCalendarPlans(); },[calendarMonth, viewMode]);

  const fetchCalendarPlans = async () => {
    setLoadingCalendar(true);
    const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth() + 1;
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(y, m, 0).toISOString().split('T')[0];

    // productの単位情報も一緒に取得
    const { data } = await supabase.from("production_plans").select("*, products(name, variant_name, unit_per_kg, unit_per_cs)").gte("production_date", startDate).lte("production_date", endDate).order("production_date", { ascending: true });
    if (data) setCalendarPlans(data as Plan[]);
    setLoadingCalendar(false);
  };

  // --- 自動計算 (新規作成用) ---
  useEffect(() => {
    if (selectedOrder && planDate && planKg) {
      setCalculatedExpiry(calculateExpiryDate(planDate));
      setCalculatedLot(generateLotNumber(planDate, selectedOrder.product_id, 1));
      const pcs = (planKg as number) * selectedOrder.products!.unit_per_kg;
      setCalculatedCs(Math.floor(pcs / selectedOrder.products!.unit_per_cs));
    } else {
      setCalculatedLot(""); setCalculatedExpiry(""); setCalculatedCs(0);
    }
  },[selectedOrder, planDate, planKg]);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order); setPlanDate(new Date().toISOString().split('T')[0]);
    const requiredKg = Math.ceil((order.remainCs * order.products!.unit_per_cs) / order.products!.unit_per_kg);
    setPlanKg(requiredKg); setPlanNotes("");
  };

  const resetInputForNextDay = (order: Order, currentDateStr: string) => {
    const nextDate = new Date(currentDateStr); nextDate.setDate(nextDate.getDate() + 1);
    setPlanDate(nextDate.toISOString().split('T')[0]);
    const requiredKg = Math.ceil((order.remainCs * order.products!.unit_per_cs) / order.products!.unit_per_kg);
    setPlanKg(requiredKg); setPlanNotes("");
  };

  const handleSavePlan = async () => {
    if (!selectedOrder || !planDate || !planKg || !calculatedLot) return;
    const dateStr = planDate.replace(/-/g, "");
    const random3 = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const newPlan = {
      id: `PLN-${dateStr}-${random3}`, order_id: selectedOrder.id, product_id: selectedOrder.product_id,
      production_date: planDate, production_kg: planKg, planned_units: (planKg as number) * selectedOrder.products!.unit_per_kg,
      planned_cs: calculatedCs, lot_code: calculatedLot, expiry_date: calculatedExpiry, status: "planned", notes: planNotes
    };
    const { error } = await supabase.from("production_plans").insert(newPlan);
    if (!error) {
      if (selectedOrder.status === 'received') await supabase.from("orders").update({ status: "in_production" }).eq("id", selectedOrder.id);
      fetchData(selectedOrder.id);
    } else alert("エラー: " + error.message);
  };

  // ====================================================================================
  // ★追加: 計画の編集・削除・ステータス更新ロジック (カレンダー用)
  // ====================================================================================
  
  // 1. カレンダーの計画をクリックして編集ダイアログを開く
  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setEditDate(plan.production_date);
    setEditKg(plan.production_kg);
    setEditNotes(plan.notes || "");
  };

  // 2. 計画の基本情報の「更新」
  const handleUpdatePlan = async () => {
    if (!editingPlan || !editDate || !editKg) return;
    setIsProcessing(true);
    
    // kg数からc/sを再計算
    const unit_per_kg = editingPlan.products?.unit_per_kg || 10;
    const unit_per_cs = editingPlan.products?.unit_per_cs || 24;
    const newCs = Math.floor(((editKg as number) * unit_per_kg) / unit_per_cs);
    // 日付が変わった場合、Lot番号と賞味期限を再計算
    const newExpiry = calculateExpiryDate(editDate);
    const newLot = generateLotNumber(editDate, editingPlan.product_id, 1);

    const updates = {
      production_date: editDate, production_kg: editKg, planned_cs: newCs,
      planned_units: (editKg as number) * unit_per_kg, lot_code: newLot, expiry_date: newExpiry, notes: editNotes
    };

    const { error } = await supabase.from("production_plans").update(updates).eq("id", editingPlan.id);
    if (!error) {
      setEditingPlan(null); fetchCalendarPlans(); fetchData();
    } else alert("更新失敗: " + error.message);
    setIsProcessing(false);
  };

  // 3. 計画の「削除」
  const handleDeletePlan = async () => {
    if (!editingPlan) return;
    if (editingPlan.status !== 'planned') {
      alert("製造開始済みの計画は削除できません。"); return;
    }
    if (!confirm("この製造計画を削除しますか？")) return;
    
    setIsProcessing(true);
    const { error } = await supabase.from("production_plans").delete().eq("id", editingPlan.id);
    if (!error) {
      setEditingPlan(null); fetchCalendarPlans(); fetchData();
    } else alert("削除失敗: " + error.message);
    setIsProcessing(false);
  };

  // 4. ★最重要: 製造開始 (在庫引当ロジック)
  const handleStartProduction = async () => {
    if (!editingPlan) return;
    if (!confirm("製造を開始しますか？\n（BOMに基づいて原材料・資材の在庫が引き落とされます）")) return;
    
    setIsProcessing(true);
    try {
      // 1. BOMの取得
      const { data: boms } = await supabase.from('bom').select('*').eq('product_id', editingPlan.product_id);
      if (boms && boms.length > 0) {
        // 2. 各品目の在庫を引く
        for (const bom of boms) {
          const requiredQty = bom.basis_type === 'production_qty' ? editingPlan.production_kg * bom.usage_rate : editingPlan.planned_cs * bom.usage_rate;
          
          // 現在の在庫を取得
          const { data: stock } = await supabase.from('item_stocks').select('quantity').eq('item_id', bom.item_id).single();
          const currentQty = stock?.quantity || 0;
          const newQty = currentQty - requiredQty;

          // 在庫を更新（なければ作成）
          await supabase.from('item_stocks').upsert({ item_id: bom.item_id, quantity: newQty });
        }
      }
      
      // 3. ステータスを製造中(in_progress)に変更
      await supabase.from("production_plans").update({ status: "in_progress" }).eq("id", editingPlan.id);
      setEditingPlan(null); fetchCalendarPlans(); fetchData();
      alert("製造を開始し、資材の在庫を減算しました。");
    } catch (err) {
      alert("エラーが発生しました。");
    }
    setIsProcessing(false);
  };

  // 5. ★最重要: 製造完了 (製品完成ロジック)
  const handleCompleteProduction = async () => {
    if (!editingPlan) return;
    if (!confirm("製造を完了しますか？\n（完成品が製品在庫として登録されます）")) return;
    
    setIsProcessing(true);
    try {
      // 追加するトータルピース数 (c/s * 1c/sあたりの入数)
      const unit_per_cs = editingPlan.products?.unit_per_cs || 24;
      const addPieces = editingPlan.planned_cs * unit_per_cs;

      // すでに同じLotの在庫が存在するかチェック
      const { data: existingStock } = await supabase.from('product_stocks').select('id, total_pieces').eq('lot_code', editingPlan.lot_code).single();

      if (existingStock) {
        // あれば加算して更新
        await supabase.from('product_stocks').update({ total_pieces: existingStock.total_pieces + addPieces }).eq('id', existingStock.id);
      } else {
        // なければ新規作成
        await supabase.from('product_stocks').insert({
          lot_code: editingPlan.lot_code, product_id: editingPlan.product_id,
          total_pieces: addPieces, expiry_date: editingPlan.expiry_date
        });
      }

      // 3. ステータスを完了(completed)に変更
      await supabase.from("production_plans").update({ status: "completed" }).eq("id", editingPlan.id);
      setEditingPlan(null); fetchCalendarPlans(); fetchData();
      alert("製造完了！製品在庫に追加されました。");
    } catch (err) {
      alert("エラーが発生しました。");
    }
    setIsProcessing(false);
  };

  // --- カレンダー描画用ロジック ---
  const getCalendarDays = () => {
    const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay(); const daysInMonth = new Date(y, m + 1, 0).getDate();
    const blanks = Array(firstDay).fill(null); const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const totalSlots = blanks.length + days.length; const trailingBlanks = Array(Math.ceil(totalSlots / 7) * 7 - totalSlots).fill(null);
    return[...blanks, ...days, ...trailingBlanks];
  };

  // --- カレンダー画面の描画 ---
  if (viewMode === 'calendar') {
    const daysArray = getCalendarDays();
    const currentYear = calendarMonth.getFullYear();
    const currentMonthStr = String(calendarMonth.getMonth() + 1).padStart(2, '0');

    return (
      <div className="bg-white min-h-screen print:p-0 print:m-0">
        <div className="flex justify-between items-center mb-6 print:hidden bg-slate-50 p-4 rounded-lg border shadow-sm">
          <Button variant="outline" onClick={() => setViewMode('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> 計画入力へ戻る</Button>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-6 w-6" /></Button>
            <h2 className="text-xl font-bold text-slate-800 w-40 text-center">{currentYear}年 {currentMonthStr}月</h2>
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-6 w-6" /></Button>
          </div>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white gap-2"><Printer className="h-4 w-4" /> 予定表を印刷</Button>
        </div>

        <div className="hidden print:block text-2xl font-bold mb-4 text-center border-b-2 border-black pb-2">
          製造計画 予定表 ({currentYear}年 {currentMonthStr}月)
        </div>

        {loadingCalendar ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-500" /></div>
        ) : (
          <div className="border border-slate-300 rounded-sm print:border-black">
            <div className="grid grid-cols-7 bg-slate-100 print:bg-gray-200 border-b border-slate-300 print:border-black">
              {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                <div key={d} className={`p-2 text-center font-bold text-sm border-r border-slate-300 print:border-black last:border-r-0 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{d}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7">
              {daysArray.map((day, idx) => {
                const dateStr = day ? `${currentYear}-${currentMonthStr}-${String(day).padStart(2, '0')}` : null;
                const dayPlans = dateStr ? calendarPlans.filter(p => p.production_date === dateStr) :[];

                return (
                  <div key={idx} className={`min-h-[140px] print:min-h-[100px] border-b border-slate-300 print:border-black p-1 ${idx % 7 !== 6 ? 'border-r' : ''} ${!day ? 'bg-slate-50 print:bg-white' : 'bg-white'}`}>
                    {day && (
                      <>
                        <div className={`text-right font-bold text-sm mb-1 ${idx % 7 === 0 ? 'text-red-600' : idx % 7 === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{day}</div>
                        <div className="space-y-1.5 print:space-y-1">
                          {dayPlans.map(plan => {
                            // ステータスに応じた色分け (印刷時はすべて白黒)
                            let cardColor = "bg-blue-50 border-blue-200";
                            if (plan.status === 'in_progress') cardColor = "bg-amber-50 border-amber-300";
                            if (plan.status === 'completed') cardColor = "bg-green-50 border-green-300";

                            return (
                              <div 
                                key={plan.id} 
                                onClick={() => openEditDialog(plan)}
                                className={`${cardColor} border rounded p-1.5 print:p-1 print:border-black print:bg-white cursor-pointer hover:shadow-md transition-shadow text-xs leading-tight wrap-break-word relative group`}
                                title="クリックして詳細・ステータス更新"
                              >
                                {/* 印刷時に見えない編集アイコン */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden text-slate-400"><Edit className="h-3 w-3" /></div>
                                
                                <div className="font-bold text-slate-800 print:text-black pr-3">{plan.products?.name}</div>
                                <div className="text-slate-600 print:text-black mb-0.5">{plan.products?.variant_name}</div>
                                <div className="font-black text-slate-900 print:text-black">{plan.planned_cs} <span className="font-normal text-[10px]">c/s</span> ({plan.production_kg}kg)</div>
                                {plan.notes && <div className="mt-1 pt-1 border-t border-slate-200 print:border-black text-[10px] text-slate-700 print:text-black italic break-all">{plan.notes}</div>}
                                
                                {/* ステータス表示 (画面上のみ) */}
                                <div className="mt-1 flex justify-end print:hidden">
                                  {plan.status === 'planned' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold">計画</span>}
                                  {plan.status === 'in_progress' && <span className="text-[10px] bg-amber-500 text-white px-1.5 rounded font-bold flex items-center gap-0.5"><Play className="h-2 w-2"/> 製造中</span>}
                                  {plan.status === 'completed' && <span className="text-[10px] bg-green-600 text-white px-1.5 rounded font-bold flex items-center gap-0.5"><CheckCircle className="h-2 w-2"/> 完了</span>}
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
        )}

        {/* --- ★編集・ステータス更新ダイアログ --- */}
        <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center">
                <span>計画詳細 / ステータス更新</span>
                {editingPlan?.status === 'planned' && <Badge className="bg-blue-100 text-blue-800 border-none">計画 (未着手)</Badge>}
                {editingPlan?.status === 'in_progress' && <Badge className="bg-amber-500 text-white border-none">製造中</Badge>}
                {editingPlan?.status === 'completed' && <Badge className="bg-green-600 text-white border-none">完了</Badge>}
              </DialogTitle>
            </DialogHeader>

            {editingPlan && (
              <div className="space-y-4 mt-2">
                <div className="bg-slate-50 p-3 rounded border text-sm">
                  <div className="text-slate-500 text-xs mb-1">Lot番号: <span className="font-bold text-slate-800">{editingPlan.lot_code}</span></div>
                  <div className="font-bold text-base text-blue-900">{editingPlan.products?.name}</div>
                  <div className="text-slate-600">{editingPlan.products?.variant_name}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">製造予定日</label>
                    <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} disabled={editingPlan.status !== 'planned'} className="h-9"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">製造量 (kg)</label>
                    <Input type="number" value={editKg} onChange={e => setEditKg(e.target.value === "" ? "" : Number(e.target.value))} disabled={editingPlan.status !== 'planned'} className="h-9 text-right"/>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">備考</label>
                  <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-9" placeholder="備考を入力..."/>
                </div>

                {/* アクションボタン群 */}
                <div className="pt-4 border-t flex flex-col gap-2">
                  {/* 更新・削除 (計画時のみ) */}
                  {editingPlan.status === 'planned' && (
                    <div className="flex gap-2">
                      <Button onClick={handleUpdatePlan} disabled={isProcessing} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white"><Edit className="h-4 w-4 mr-2"/> 内容を更新</Button>
                      <Button onClick={handleDeletePlan} disabled={isProcessing} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  )}

                  {/* ステータス進行ボタン (超重要) */}
                  {editingPlan.status === 'planned' && (
                    <Button onClick={handleStartProduction} disabled={isProcessing} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 shadow-sm">
                      {isProcessing ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <Play className="h-5 w-5 mr-2"/>}
                      製造を開始する (資材在庫を減算)
                    </Button>
                  )}
                  {editingPlan.status === 'in_progress' && (
                    <Button onClick={handleCompleteProduction} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 shadow-sm">
                      {isProcessing ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <CheckCircle className="h-5 w-5 mr-2"/>}
                      製造を完了する (製品在庫に加算)
                    </Button>
                  )}
                  {editingPlan.status === 'completed' && (
                    <div className="text-center text-sm font-bold text-green-700 bg-green-50 py-3 rounded-md">
                      この計画は完了し、在庫へ反映済みです。
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

  // --- 通常の計画画面 (変更なし) ---
  if (loading && orders.length === 0) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-500" /></div>;
  const currentOrderPlans = plans.filter(p => p.order_id === selectedOrder?.id);

  return (
    <div className="bg-transparent">
      {/* 以前のリスト表示モードのコードは省略せず保持 (文字数制限のため上部と共通のロジックに統合) */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
          <Factory className="h-6 w-6 text-blue-600" /> 製造計画・Lot採番
        </h1>
        <Button onClick={() => setViewMode('calendar')} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-2 font-bold shadow-sm">
          <CalendarDays className="h-5 w-5" /> 予定表(カレンダー)で編集・更新
        </Button>
      </div>
      
      {/* --- 左側・右側のレイアウト (前回と同じ) --- */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[35%]">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
            未計画の残数がある受注
          </h2>
          <div className="space-y-3 h-[calc(100vh-200px)] overflow-y-auto pr-2 pb-10">
            {orders.map((order) => (
              <Card key={order.id} onClick={() => handleSelectOrder(order)} className={`cursor-pointer transition-all border-2 ${selectedOrder?.id === order.id ? "border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]" : "border-slate-200 hover:border-blue-300"}`}>
                <CardHeader className="p-4 pb-2 bg-white rounded-t-lg"><div className="text-xs text-slate-500">{order.id}</div><CardTitle className="text-base text-slate-800 leading-tight mt-1">{order.customers?.name}</CardTitle></CardHeader>
                <CardContent className="p-4 pt-2 text-sm text-slate-600 bg-white rounded-b-lg">
                  <div className="font-bold text-slate-800 mb-2">{order.products?.name} ({order.products?.variant_name})</div>
                  <div className="flex items-center justify-between border-t pt-2"><span className="text-xs text-slate-500">全体: {order.quantity}</span><div className="flex items-baseline gap-1"><span className="text-xs text-slate-500">未計画残数:</span><span className="font-black text-xl text-red-600">{order.remainCs}</span><span className="text-xs font-normal text-slate-500">c/s</span></div></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-[65%] flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
            日別の製造予定を入力
          </h2>
          <Card className="border-slate-200 shadow-sm overflow-hidden shrink-0">
            {selectedOrder ? (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div><label className="block text-sm font-bold mb-2 text-slate-700">製造予定日</label><Input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="text-lg bg-white h-12" /></div>
                    <div>
                      <label className="block text-sm font-bold mb-2 text-slate-700">この日の製造量 (kg)</label>
                      <div className="flex items-center gap-3"><Input type="number" min="0" value={planKg} onChange={e => setPlanKg(e.target.value === "" ? "" : Number(e.target.value))} className="text-xl font-bold text-right h-12" /><span className="text-lg font-bold text-slate-500">kg</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col h-full"><label className="block text-sm font-bold mb-2 text-slate-700">備考 (任意)</label><textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)} className="flex-1 w-full p-3 border rounded-md text-sm" /></div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSavePlan} disabled={!planKg || !calculatedLot} className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-6 font-bold shadow-sm"><ListPlus className="h-5 w-5 mr-2" /> 計画を追加する</Button>
                </div>
              </div>
            ) : (<div className="p-16 text-center text-slate-400">リストから受注を選択してください</div>)}
          </Card>
        </div>
      </div>
    </div>
  );
}