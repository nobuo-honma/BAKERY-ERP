"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Factory, Calendar as CalendarIcon, PackageCheck, Loader2, ListPlus, CheckCircle2, CalendarDays, Printer, ArrowLeft, ChevronLeft, ChevronRight, Edit, Trash2, Play, CheckCircle, Truck, Flag, Lock, Plus } from "lucide-react";
import { calculateExpiryDate, generateLotNumber } from "@/lib/lot-generator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

type Order = { id: string; order_date: string; desired_ship_date: string; planned_ship_date: string; quantity: number; status: string; product_id: string; customer_order_no?: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number }; plannedPieces: number; remainPieces: number; };
type Plan = { id: string; order_id: string; product_id: string; production_date: string; production_kg: number; planned_cs: number; lot_code: string; expiry_date: string; status: string; notes?: string; products?: { name: string; variant_name: string; unit_per_cs?: number; unit_per_kg?: number }; actual_cs?: number; actual_piece?: number; };
type Event = { id: string; event_date: string; title: string; notes?: string; };
type Product = { id: string; name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number; };

export default function ProductionPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarPlans, setCalendarPlans] = useState<Plan[]>([]);
  const [calendarOrders, setCalendarOrders] = useState<Order[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Event[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isStockProduction, setIsStockProduction] = useState(false);
  const [stockProductId, setStockProductId] = useState("");

  const [planDate, setPlanDate] = useState("");
  const [planKg, setPlanKg] = useState<number | "">("");
  const [planNotes, setPlanNotes] = useState("");
  const [calculatedLot, setCalculatedLot] = useState("");
  const [calculatedExpiry, setCalculatedExpiry] = useState("");
  const [calculatedCs, setCalculatedCs] = useState(0);

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editKg, setEditKg] = useState<number | "">("");
  const [editNotes, setEditNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [actualCs, setActualCs] = useState<number | "">("");
  const [actualPiece, setActualPiece] = useState<number | "">("");

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventNotes, setEventNotes] = useState("");

  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [ordersModalDate, setOrdersModalDate] = useState("");

  const [monthlyNote, setMonthlyNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const fetchData = useCallback(async (preserveSelectedId?: string) => {
    setLoading(true);
    const { data: oData } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_kg, unit_per_cs), production_plans(planned_cs)").in("status", ["received", "in_production"]).order("planned_ship_date", { ascending: true });
    const { data: pData } = await supabase.from("production_plans").select("*, products(name, variant_name, unit_per_kg, unit_per_cs)").order("production_date", { ascending: false }).limit(30);
    const { data: prData } = await supabase.from("products").select("*");

    const processedOrders = (oData as any[])?.map(o => {
      const unitPerCs = o.products?.unit_per_cs || 24;
      const plannedPieces = o.production_plans ? o.production_plans.reduce((sum: number, p: any) => sum + (p.planned_cs * unitPerCs), 0) : 0;
      const remainPieces = o.quantity - plannedPieces;
      return { ...o, plannedPieces, remainPieces };
    }).filter(o => o.remainPieces > 0) || [];

    setOrders(processedOrders);
    if (pData) setPlans(pData as Plan[]);
    if (prData) setProducts(prData as Product[]);

    if (preserveSelectedId) {
      const stillRemainingOrder = processedOrders.find(o => o.id === preserveSelectedId);
      if (stillRemainingOrder) {
        setSelectedOrder(stillRemainingOrder); resetInputForNextDay(stillRemainingOrder, planDate);
      } else {
        setSelectedOrder(null); setIsStockProduction(false);
      }
    } else if (!selectedOrder && !isStockProduction) {
      setPlanDate(new Date().toISOString().split('T')[0]);
    }
    setLoading(false);
  }, [planDate, selectedOrder, isStockProduction]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchCalendarPlans = useCallback(async () => {
    setLoadingCalendar(true);
    const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth() + 1;
    const currentMonthStr = `${y}-${String(m).padStart(2, '0')}`;
    const startDate = `${currentMonthStr}-01`;
    const endDate = new Date(y, m, 0).toISOString().split('T')[0];

    const { data: pData } = await supabase.from("production_plans").select("*, products(name, variant_name, unit_per_kg, unit_per_cs)").gte("production_date", startDate).lte("production_date", endDate).order("production_date", { ascending: true });
    if (pData) setCalendarPlans(pData as Plan[]);

    const { data: oData } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_cs)").gte("planned_ship_date", startDate).lte("planned_ship_date", endDate).order("planned_ship_date", { ascending: true });
    if (oData) setCalendarOrders(oData as Order[]);

    const { data: eData } = await supabase.from("events").select("*").gte("event_date", startDate).lte("event_date", endDate).order("event_date", { ascending: true });
    if (eData) setCalendarEvents(eData as Event[]);

    const { data: noteData } = await supabase.from("calendar_notes").select("note_content").eq("month_str", currentMonthStr).single();
    setMonthlyNote(noteData ? noteData.note_content : "");

    setLoadingCalendar(false);
  }, [calendarMonth]);

  useEffect(() => { if (viewMode === 'calendar') fetchCalendarPlans(); }, [fetchCalendarPlans, viewMode]);

  const handleSaveMonthlyNote = async () => {
    setIsSavingNote(true);
    const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth() + 1;
    const currentMonthStr = `${y}-${String(m).padStart(2, '0')}`;
    try {
      await supabase.from("calendar_notes").upsert({ month_str: currentMonthStr, note_content: monthlyNote, updated_at: new Date().toISOString() }, { onConflict: 'month_str' });
      alert(`${m}月の備考を保存しました。`);
    } catch (err: any) { alert("エラー: " + err.message); }
    setIsSavingNote(false);
  };

  useEffect(() => {
    const pId = isStockProduction ? stockProductId : selectedOrder?.product_id;
    const targetProduct = isStockProduction ? products.find(p => p.id === stockProductId) : selectedOrder?.products;
    if (pId && targetProduct && planDate && planKg) {
      setCalculatedExpiry(calculateExpiryDate(planDate));
      setCalculatedLot(generateLotNumber(planDate, pId, 1));
      const pcs = (planKg as number) * targetProduct.unit_per_kg;
      setCalculatedCs(Math.floor(pcs / targetProduct.unit_per_cs));
    } else { setCalculatedLot(""); setCalculatedExpiry(""); setCalculatedCs(0); }
  }, [selectedOrder, planDate, planKg, isStockProduction, stockProductId, products]);

  const handleSelectOrder = (order: Order) => {
    setIsStockProduction(false); setStockProductId("");
    setSelectedOrder(order); setPlanDate(new Date().toISOString().split('T')[0]);
    const requiredKg = Math.ceil((order.remainPieces) / order.products!.unit_per_kg);
    setPlanKg(requiredKg); setPlanNotes("");
  };

  const handleSelectStockProduction = () => {
    setSelectedOrder(null); setIsStockProduction(true);
    setPlanDate(new Date().toISOString().split('T')[0]);
    setPlanKg(""); setPlanNotes(""); setStockProductId("");
  };

  const resetInputForNextDay = (order: Order, currentDateStr: string) => {
    const nextDate = new Date(currentDateStr); nextDate.setDate(nextDate.getDate() + 1);
    setPlanDate(nextDate.toISOString().split('T')[0]);
    const requiredKg = Math.ceil((order.remainPieces) / order.products!.unit_per_kg);
    setPlanKg(requiredKg); setPlanNotes("");
  };

  const handleSavePlan = async () => {
    const pId = isStockProduction ? stockProductId : selectedOrder?.product_id;
    const targetProduct = isStockProduction ? products.find(p => p.id === stockProductId) : selectedOrder?.products;
    if (!pId || !targetProduct || !planDate || !planKg || !calculatedLot) return;
    setIsProcessing(true);
    const dateStr = planDate.replace(/-/g, "");
    const random3 = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const newPlan = { id: `PLN-${dateStr}-${random3}`, order_id: isStockProduction ? null : selectedOrder?.id, product_id: pId, production_date: planDate, production_kg: planKg, planned_units: (planKg as number) * targetProduct.unit_per_kg, planned_cs: calculatedCs, lot_code: calculatedLot, expiry_date: calculatedExpiry, status: "planned", notes: planNotes };
    const { error } = await supabase.from("production_plans").insert(newPlan);
    if (!error) {
      if (!isStockProduction && selectedOrder?.status === 'received') {
        await supabase.from("orders").update({ status: "in_production" }).eq("id", selectedOrder.id);
        fetchData(selectedOrder.id);
      } else { alert(isStockProduction ? "在庫品としての製造計画を登録しました！" : "計画を登録しました！"); fetchData(); if (isStockProduction) { setPlanKg(""); setPlanNotes(""); } }
    } else alert("エラー: " + error.message);
    setIsProcessing(false);
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan); setEditDate(plan.production_date); setEditKg(plan.production_kg); setEditNotes(plan.notes || "");
  };

  const openOrdersModal = (dateStr: string) => { setOrdersModalDate(dateStr); setOrdersModalOpen(true); };

  const handleUpdatePlan = async () => {
    if (!editingPlan || !editDate || !editKg) return;
    setIsProcessing(true);
    const unit_per_kg = editingPlan.products?.unit_per_kg || 10; const unit_per_cs = editingPlan.products?.unit_per_cs || 24;
    const newCs = Math.floor(((editKg as number) * unit_per_kg) / unit_per_cs);
    const newExpiry = calculateExpiryDate(editDate); const newLot = generateLotNumber(editDate, editingPlan.product_id, 1);
    const updates = { production_date: editDate, production_kg: editKg, planned_cs: newCs, planned_units: (editKg as number) * unit_per_kg, lot_code: newLot, expiry_date: newExpiry, notes: editNotes };
    const { error } = await supabase.from("production_plans").update(updates).eq("id", editingPlan.id);
    if (!error) { setEditingPlan(null); if (viewMode === 'calendar') fetchCalendarPlans(); fetchData(); alert("計画を更新しました。"); } else alert("更新失敗: " + error.message);
    setIsProcessing(false);
  };

  const handleDeletePlan = async () => {
    if (!editingPlan) return;
    let confirmMsg = "この製造計画を削除（キャンセル）しますか？";
    if (editingPlan.status === 'in_progress') confirmMsg = "【重要】この計画は「製造中」です。\nキャンセルすると、引き落とされた原料在庫が元に戻されます。削除してよろしいですか？";
    else if (editingPlan.status === 'completed') confirmMsg = "【超重要】この計画は「完了」しています。\nキャンセルすると、製品在庫がマイナスされます。削除してよろしいですか？";
    if (!confirm(confirmMsg)) return;
    setIsProcessing(true);
    try {
      if (editingPlan.status === 'in_progress') {
        const { data: boms } = await supabase.from('bom').select('*').eq('product_id', editingPlan.product_id);
        if (boms && boms.length > 0) {
          for (const bom of boms) {
            const usedQty = bom.basis_type === 'production_qty' ? editingPlan.production_kg * bom.usage_rate : editingPlan.planned_cs * bom.usage_rate;
            const { data: stock } = await supabase.from('item_stocks').select('quantity').eq('item_id', bom.item_id).single();
            const currentQty = stock?.quantity || 0;
            await supabase.from('item_stocks').upsert({ item_id: bom.item_id, quantity: currentQty + usedQty });
            await supabase.from('inventory_adjustments').insert({ item_id: bom.item_id, before_qty: currentQty, after_qty: currentQty + usedQty, reason: `製造キャンセルによる原料戻し` });
          }
        }
      }
      if (editingPlan.status === 'completed') {
        const unit_per_cs = editingPlan.products?.unit_per_cs || 24;
        const actualCsVal = editingPlan.actual_cs || editingPlan.planned_cs;
        const actualPieceVal = editingPlan.actual_piece || 0;
        const cancelPieces = (actualCsVal * unit_per_cs) + actualPieceVal;
        const { data: existingStock } = await supabase.from('product_stocks').select('id, total_pieces').eq('lot_code', editingPlan.lot_code).single();
        if (existingStock) {
          const newPieces = existingStock.total_pieces - cancelPieces;
          if (newPieces <= 0) await supabase.from('product_stocks').delete().eq('id', existingStock.id);
          else await supabase.from('product_stocks').update({ total_pieces: newPieces }).eq('id', existingStock.id);
          await supabase.from('inventory_adjustments').insert({ product_id: editingPlan.product_id, lot_code: editingPlan.lot_code, before_qty: existingStock.total_pieces, after_qty: newPieces, reason: `製造完了取り消しによる製品減算` });
        }
      }
      const { error } = await supabase.from("production_plans").delete().eq("id", editingPlan.id);
      if (error) throw error;
      setEditingPlan(null); if (viewMode === 'calendar') fetchCalendarPlans(); fetchData();
      alert("計画を削除し、在庫のロールバックを完了しました。");
    } catch (err: any) { alert("エラー: " + err.message); }
    setIsProcessing(false);
  };

  const handleStartProduction = async () => {
    if (!editingPlan) return;
    if (editingPlan.status !== 'planned') { alert("この計画はすでに製造開始されています！"); return; }
    if (!confirm("製造を開始しますか？（原料在庫が引き落とされます）")) return;
    setIsProcessing(true);
    try {
      const { data: boms } = await supabase.from('bom').select('*').eq('product_id', editingPlan.product_id);
      if (boms && boms.length > 0) {
        for (const bom of boms) {
          const requiredQty = bom.basis_type === 'production_qty' ? editingPlan.production_kg * bom.usage_rate : editingPlan.planned_cs * bom.usage_rate;
          const { data: stock } = await supabase.from('item_stocks').select('quantity').eq('item_id', bom.item_id).single();
          const currentQty = stock?.quantity || 0;
          await supabase.from('item_stocks').upsert({ item_id: bom.item_id, quantity: currentQty - requiredQty });
          await supabase.from('inventory_adjustments').insert({ item_id: bom.item_id, before_qty: currentQty, after_qty: currentQty - requiredQty, reason: `製造消費` });
        }
      }
      await supabase.from("production_plans").update({ status: "in_progress" }).eq("id", editingPlan.id);
      setEditingPlan(null); if (viewMode === 'calendar') fetchCalendarPlans(); fetchData(); alert("製造を開始しました。");
    } catch (err) { alert("エラーが発生しました。"); }
    setIsProcessing(false);
  };

  const openCompletionModal = () => {
    if (!editingPlan) return;
    if (editingPlan.status === 'completed') { alert("すでに完了処理されています。"); return; }
    setActualCs(editingPlan.planned_cs); setActualPiece(0); setCompletionModalOpen(true);
  };

  const handleCompleteProductionWithActuals = async () => {
    if (!editingPlan || actualCs === "") { alert("実績ケース数を入力してください。"); return; }
    if (editingPlan.status === 'completed') { alert("この計画はすでに完了済みです。"); return; }
    const aCs = Number(actualCs) || 0; const aP = Number(actualPiece) || 0;
    if (aCs === 0 && aP === 0) { alert("実績数が0になっています。"); return; }

    setIsProcessing(true);
    try {
      const unit_per_cs = editingPlan.products?.unit_per_cs || 24;
      const totalActualPieces = (aCs * unit_per_cs) + (aP * 2);

      const productIdStr = editingPlan.product_id || "";
      const keepQuantity = (productIdStr.startsWith('MA') || productIdStr.startsWith('FD')) ? 5 : 10;
      const addPiecesToStock = totalActualPieces - keepQuantity;

      if (addPiecesToStock < 0) {
        alert(`エラー: 実績数(${totalActualPieces}個)が、キープサンプル必要数(${keepQuantity}個)を下回っています。`);
        setIsProcessing(false); return;
      }

      const { data: existingStock } = await supabase.from('product_stocks').select('id, total_pieces').eq('lot_code', editingPlan.lot_code).single();
      if (existingStock) {
        await supabase.from('product_stocks').update({ total_pieces: existingStock.total_pieces + addPiecesToStock }).eq('id', existingStock.id);
        await supabase.from('inventory_adjustments').insert({ product_id: editingPlan.product_id, lot_code: editingPlan.lot_code, before_qty: existingStock.total_pieces, after_qty: existingStock.total_pieces + addPiecesToStock, reason: `製造完成 (サンプル引当後)` });
      } else {
        await supabase.from('product_stocks').insert({ lot_code: editingPlan.lot_code, product_id: editingPlan.product_id, total_pieces: addPiecesToStock, expiry_date: editingPlan.expiry_date });
        await supabase.from('inventory_adjustments').insert({ product_id: editingPlan.product_id, lot_code: editingPlan.lot_code, before_qty: 0, after_qty: addPiecesToStock, reason: `製造完成 (新規Lot)` });
      }

      const randomManageNo = `KS-${editingPlan.lot_code}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await supabase.from("keep_samples").insert({
        lot_code: editingPlan.lot_code, product_id: editingPlan.product_id, management_no: randomManageNo, saved_quantity: keepQuantity, production_date: editingPlan.production_date, expiry_date: editingPlan.expiry_date
      });

      try { await supabase.from("production_plans").update({ status: "completed", actual_cs: aCs, actual_piece: aP }).eq("id", editingPlan.id); }
      catch (e) { await supabase.from("production_plans").update({ status: "completed" }).eq("id", editingPlan.id); }

      setCompletionModalOpen(false); setEditingPlan(null); if (viewMode === 'calendar') fetchCalendarPlans(); fetchData();
      alert(`製造完了！\nサンプルを ${keepQuantity}個 保管し、残りを製品在庫に追加しました。`);
    } catch (err: any) { alert("エラー: " + err.message); }
    setIsProcessing(false);
  };

  const openEventDialog = (ev?: Event, dateStr?: string) => {
    if (ev) { setEditingEvent(ev); setEventDate(ev.event_date); setEventTitle(ev.title); setEventNotes(ev.notes || ""); }
    else { setEditingEvent(null); setEventDate(dateStr || new Date().toISOString().split('T')[0]); setEventTitle(""); setEventNotes(""); }
    setEventModalOpen(true);
  };
  const handleSaveEvent = async () => {
    if (!eventDate || !eventTitle) { alert("日付とタイトルは必須です。"); return; }
    setIsProcessing(true); const eventData = { event_date: eventDate, title: eventTitle, notes: eventNotes };
    if (editingEvent) { await supabase.from("events").update(eventData).eq("id", editingEvent.id); }
    else { await supabase.from("events").insert(eventData); }
    setEventModalOpen(false); fetchCalendarPlans(); setIsProcessing(false);
  };
  const handleDeleteEvent = async () => {
    if (!editingEvent || !confirm("このイベントを削除しますか？")) return;
    setIsProcessing(true); await supabase.from("events").delete().eq("id", editingEvent.id);
    setEventModalOpen(false); fetchCalendarPlans(); setIsProcessing(false);
  };

  const getCalendarDays = () => {
    const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth(); const firstDay = new Date(y, m, 1).getDay(); const daysInMonth = new Date(y, m + 1, 0).getDate();
    const blanks = Array(firstDay).fill(null); const days = Array.from({ length: daysInMonth }, (_, i) => i + 1); const totalSlots = blanks.length + days.length; const trailingBlanks = Array(Math.ceil(totalSlots / 7) * 7 - totalSlots).fill(null);
    return [...blanks, ...days, ...trailingBlanks];
  };
  // =======================================================================
  // 共通のダイアログコンポーネントを返す関数
  // =======================================================================
  const renderAllDialogs = () => (
    <div className="print:hidden">
      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent className="w-[95vw] max-w-sm bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-slate-800"><Flag className="w-5 h-5 text-slate-600" /> {editingEvent ? "イベントの編集" : "新規イベントの登録"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><label className="block text-xs font-bold text-slate-500 mb-1">日付</label><Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="h-10 md:h-9" /></div>
            <div><label className="block text-xs font-bold text-slate-500 mb-1">イベント名・内容 (必須)</label><Input value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="例: 月末棚卸、大掃除..." className="h-10 md:h-9 font-bold" /></div>
            <div><label className="block text-xs font-bold text-slate-500 mb-1">備考 (任意)</label><textarea value={eventNotes} onChange={e => setEventNotes(e.target.value)} placeholder="詳細なメモ..." className="w-full p-3 md:p-2 border border-slate-200 rounded-md text-sm resize-none h-24 md:h-20 bg-slate-50" /></div>
          </div>
          <DialogFooter className="mt-6 border-t pt-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
            {editingEvent ? <Button onClick={handleDeleteEvent} disabled={isProcessing} variant="outline" className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4 mr-2" />削除</Button> : <div className="hidden sm:block"></div>}
            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <Button variant="ghost" onClick={() => setEventModalOpen(false)} className="flex-1 sm:flex-none">キャンセル</Button>
              <Button onClick={handleSaveEvent} disabled={isProcessing || !eventTitle} className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-900 text-white font-bold h-10 md:h-9">{isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}保存</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="w-[95vw] max-w-md bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader><DialogTitle className="flex justify-between items-center"><span>計画詳細 / ステータス更新</span></DialogTitle></DialogHeader>
          {editingPlan && (
            <div className="space-y-4 mt-2">
              <div className="bg-slate-50 p-3 rounded-lg border text-sm">
                <div className="text-slate-500 text-xs mb-1">Lot番号: <span className="font-bold text-slate-800">{editingPlan.lot_code}</span></div>
                <div className="font-bold text-lg text-blue-900 leading-tight">{editingPlan.products?.name}</div>
                <div className="text-slate-600 mt-1">{editingPlan.products?.variant_name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 mb-1">製造予定日</label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} disabled={editingPlan.status !== 'planned' || !canEdit} className="h-10 md:h-9" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">製造量 (kg)</label><Input type="number" value={editKg} onChange={e => setEditKg(e.target.value === "" ? "" : Number(e.target.value))} disabled={editingPlan.status !== 'planned' || !canEdit} className="h-10 md:h-9 text-right font-bold text-lg" /></div>
              </div>
              <div className="text-xs text-right text-slate-500">予定ケース数: <span className="font-bold">{editingPlan.planned_cs} c/s</span></div>

              <div><label className="block text-xs font-bold text-slate-500 mb-1">備考</label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} disabled={editingPlan.status !== 'planned' || !canEdit} className="h-10 md:h-9" placeholder="備考を入力..." /></div>

              {canEdit && (
                <div className="pt-4 border-t flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Button onClick={handleUpdatePlan} disabled={isProcessing || editingPlan.status !== 'planned'} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white h-10 md:h-9"><Edit className="h-4 w-4 mr-2" /> 内容更新</Button>
                    <Button onClick={handleDeletePlan} disabled={isProcessing} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-10 md:h-9"><Trash2 className="h-4 w-4 mr-2" /> {editingPlan.status === 'planned' ? '削除' : 'キャンセル'}</Button>
                  </div>

                  {editingPlan.status === 'planned' && (
                    <Button onClick={handleStartProduction} disabled={isProcessing} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 shadow-sm text-base">
                      <Play className="h-5 w-5 mr-2" />製造を開始する (在庫減算)
                    </Button>
                  )}

                  {editingPlan.status === 'in_progress' && (
                    <Button onClick={openCompletionModal} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 shadow-sm text-base">
                      <CheckCircle className="h-5 w-5 mr-2" />製造を完了し、実績数を入力
                    </Button>
                  )}
                </div>
              )}
              {editingPlan.status === 'completed' && <div className="text-center text-sm font-bold text-green-700 bg-green-50 py-3 rounded-md border border-green-200">この計画は完了し、在庫へ反映済みです。</div>}
              {!canEdit && editingPlan.status !== 'completed' && <div className="text-center text-sm font-bold text-slate-500 bg-slate-50 py-3 rounded-md"><Lock className="w-4 h-4 inline mr-1" />閲覧モードのため処理はできません</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={completionModalOpen} onOpenChange={setCompletionModalOpen}>
        <DialogContent className="max-w-sm bg-white p-6 rounded-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-green-700"><CheckCircle2 className="w-5 h-5" /> 製造完了と実績の登録</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 p-4 rounded-lg text-center border">
              <div className="text-xs text-slate-500 mb-1">予定ケース数</div>
              <div className="text-2xl font-black text-slate-400 line-through">{editingPlan?.planned_cs} <span className="text-sm font-normal">c/s</span></div>
            </div>

            <div className="text-center">
              <label className="block text-sm font-bold text-blue-800 mb-2">実際の完成数を入力してください</label>
              <div className="flex items-center justify-center gap-2">
                <Input type="number" inputMode="numeric" min="0" autoFocus value={actualCs} onChange={e => setActualCs(e.target.value === "" ? "" : Number(e.target.value))} className="w-24 h-14 text-3xl font-black text-right border-blue-400 focus-visible:ring-blue-500 shadow-sm" />
                <span className="font-bold text-slate-500">c/s</span>
                <Input type="number" inputMode="numeric" min="0" max={Math.floor(((editingPlan?.products?.unit_per_cs || 24) - 1) / 2)} value={actualPiece} onChange={e => setActualPiece(e.target.value === "" ? "" : Number(e.target.value))} className="w-16 h-14 text-2xl font-bold text-right border-blue-400 focus-visible:ring-blue-500 shadow-sm ml-2" />
                <span className="font-bold text-slate-500">p</span>
              </div>
            </div>

            {actualCs !== "" && editingPlan && (
              <div className={`text-center font-bold text-sm mt-4 ${Number(actualCs) === editingPlan.planned_cs && (actualPiece === "" || Number(actualPiece) === 0) ? 'text-green-600' : 'text-amber-600'}`}>
                予定との誤差: {
                  ((Number(actualCs) * (editingPlan.products?.unit_per_cs || 24)) + (Number(actualPiece) * 2)) - (editingPlan.planned_cs * (editingPlan.products?.unit_per_cs || 24)) > 0 ? "+" : ""
                }
                {((Number(actualCs) * (editingPlan.products?.unit_per_cs || 24)) + (Number(actualPiece) * 2)) - (editingPlan.planned_cs * (editingPlan.products?.unit_per_cs || 24))} 個
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 border-t pt-4 flex gap-2">
            <Button variant="outline" onClick={() => setCompletionModalOpen(false)} className="flex-1">戻る</Button>
            <Button onClick={handleCompleteProductionWithActuals} disabled={isProcessing || actualCs === ""} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} 完了して在庫に加算
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ordersModalOpen} onOpenChange={setOrdersModalOpen}>
        <DialogContent className="w-[95vw] max-w-md bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-800">
              <Truck className="w-5 h-5" /> 出荷予定 ({ordersModalDate ? new Date(ordersModalDate).toLocaleDateString('ja-JP') : ''})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 max-h-[60vh] overflow-y-auto pr-2">
            {calendarOrders.filter(o => o.planned_ship_date === ordersModalDate).map(ord => {
              const isShipped = ord.status === 'shipped';
              const unitPerCs = ord.products?.unit_per_cs || 24;
              const displayCs = Math.floor(ord.quantity / unitPerCs);
              const displayP = Math.floor((ord.quantity % unitPerCs) / 2);

              return (
                <div key={ord.id} className={`p-4 rounded-lg border ${isShipped ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-purple-50 border-purple-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className={`font-bold text-base ${isShipped ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{ord.customers?.name}</div>
                    {isShipped ? <Badge className="bg-slate-200 text-slate-600 border-none shadow-none text-xs">出荷済</Badge> : <Badge className="bg-purple-500 text-white border-none shadow-sm text-xs">出荷予定</Badge>}
                  </div>
                  <div className="flex justify-between items-end border-t border-purple-200/50 pt-2">
                    <div>
                      <div className="text-slate-700 font-bold">{ord.products?.name}</div>
                      <div className="text-xs text-slate-500">{ord.products?.variant_name}</div>
                      {ord.customer_order_no && <div className="text-[10px] text-slate-400 mt-1">発注: {ord.customer_order_no}</div>}
                    </div>
                    <div className="font-black text-purple-800 text-2xl">
                      {displayCs} <span className="font-normal text-sm text-slate-500">c/s</span>
                      {displayP > 0 && <span className="text-lg ml-1">{displayP} <span className="text-xs font-normal text-slate-500">p</span></span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {calendarOrders.filter(o => o.planned_ship_date === ordersModalDate).length === 0 && (
              <div className="text-center py-8 text-slate-400 font-bold bg-slate-50 rounded-lg">この日の出荷予定はありません</div>
            )}
          </div>
          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setOrdersModalOpen(false)} className="w-full font-bold h-10 md:h-9">閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (loading && orders.length === 0 && plans.length === 0) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-500" /></div>;

  // =======================================================================
  // --- カレンダー画面の描画 ---
  // =======================================================================
  if (viewMode === 'calendar') {
    const daysArray = getCalendarDays();
    const currentYear = calendarMonth.getFullYear();
    const currentMonthStr = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const todayStr = new Date().toLocaleDateString('ja-JP');

    return (
      <div className="bg-white min-h-screen print:p-0 print:m-0 -mx-4 px-4 md:mx-0 md:px-0 pt-4 md:pt-0">
        <style dangerouslySetInnerHTML={{ __html: `@media print { header { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; } @page { size: landscape; margin: 10mm; } body { background-color: white !important; } }` }} />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden bg-slate-50 p-4 rounded-lg border shadow-sm">
          <Button variant="outline" onClick={() => setViewMode('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">計画入力へ戻る</span><span className="sm:hidden">戻る</span></Button>

          <div className="flex items-center justify-center gap-4 w-full md:w-auto">
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-6 w-6" /></Button>
            <h2 className="text-xl font-bold text-slate-800 w-32 text-center">{currentYear}年 {currentMonthStr}月</h2>
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-6 w-6" /></Button>
          </div>

          <div className="flex gap-2 w-full md:w-auto justify-end">
            {canEdit && <Button onClick={() => openEventDialog()} className="bg-slate-700 hover:bg-slate-800 text-white gap-1 font-bold shadow-sm flex-1 md:flex-none"><Flag className="h-4 w-4" /> イベント<span className="hidden sm:inline">登録</span></Button>}
            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 font-bold shadow-sm flex-1 md:flex-none"><Printer className="h-4 w-4" /> 印刷</Button>
          </div>
        </div>

        <div className="hidden print:flex justify-between items-end mb-3 border-b-2 border-black pb-2">
          <div className="text-2xl font-black">製造・出荷スケジュール表 ({currentYear}年 {currentMonthStr}月)</div>
          <div className="text-sm font-bold text-slate-800">更新日: {todayStr}</div>
        </div>

        <div className="border border-slate-300 rounded-lg md:rounded-sm overflow-hidden print:border-black print:border-2 flex flex-col">

          <div className="hidden md:block print:block">
            <div className="grid grid-cols-7 bg-slate-100 print:bg-gray-100 border-b border-slate-300 print:border-black">
              {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (<div key={d} className={`p-2 text-center font-bold text-sm border-r border-slate-300 print:border-black last:border-r-0 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{d}</div>))}
            </div>
            <div className="grid grid-cols-7">
              {daysArray.map((day, idx) => {
                const dateStr = day ? `${currentYear}-${currentMonthStr}-${String(day).padStart(2, '0')}` : null;
                const dayPlans = dateStr ? calendarPlans.filter(p => p.production_date === dateStr) : [];
                const dayOrders = dateStr ? calendarOrders.filter(o => o.planned_ship_date === dateStr) : [];
                const dayEvents = dateStr ? calendarEvents.filter(e => e.event_date === dateStr) : [];

                return (
                  <div key={idx} className={`min-h-[140px] print:min-h-[100px] border-b border-slate-300 print:border-black p-1 ${idx % 7 !== 6 ? 'border-r print:border-black' : ''} ${!day ? 'bg-slate-50 print:bg-white' : 'bg-white'}`}>
                    {day && (
                      <>
                        <div className="flex justify-between items-start mb-1">
                          <div onClick={() => canEdit && openEventDialog(undefined, dateStr ?? undefined)} className={`print:hidden p-0.5 ${canEdit ? 'text-slate-300 hover:text-blue-500 cursor-pointer' : 'text-transparent'}`}><PlusIcon /></div>
                          <div className={`text-right font-bold text-sm ${idx % 7 === 0 ? 'text-red-600' : idx % 7 === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{day}</div>
                        </div>

                        <div className="space-y-1.5 print:space-y-1">
                          {dayEvents.map(ev => (
                            <div key={ev.id} onClick={() => canEdit && openEventDialog(ev)} className={`bg-slate-100 border border-slate-300 rounded p-1.5 print:p-1 print:border-black text-xs leading-tight wrap-break-word relative group ${canEdit ? 'cursor-pointer hover:bg-slate-200' : ''}`}>
                              {canEdit && <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden text-slate-400"><Edit className="h-3 w-3" /></div>}
                              <div className="font-bold text-slate-800 print:text-black flex items-start gap-1"><Flag className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />{ev.title}</div>
                              {ev.notes && <div className="text-[10px] text-slate-600 print:text-black mt-0.5 ml-4 italic">{ev.notes}</div>}
                            </div>
                          ))}

                          {dayOrders.length > 0 && (
                            <div onClick={() => openOrdersModal(dateStr!)} className="bg-purple-100 border border-purple-300 rounded px-2 py-1 print:p-1 print:border-black text-xs font-bold text-purple-800 print:text-black flex items-center justify-between shadow-sm cursor-pointer hover:bg-purple-200 transition-colors">
                              <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> 出荷</span>
                              <span className="text-[10px] bg-white px-1.5 rounded-sm">{dayOrders.length}件</span>
                            </div>
                          )}

                          {dayPlans.map(plan => {
                            let cardColor = "bg-blue-50 border-blue-200";
                            if (plan.status === 'in_progress') cardColor = "bg-amber-50 border-amber-300";
                            if (plan.status === 'completed') cardColor = "bg-green-50 border-green-300";

                            const isCompleted = plan.status === 'completed';
                            const displayCs = isCompleted ? (plan.actual_cs !== undefined ? plan.actual_cs : plan.planned_cs) : plan.planned_cs;
                            const displayP = isCompleted ? (plan.actual_piece || 0) : 0;

                            return (
                              <div key={plan.id} onClick={() => canEdit && openEditDialog(plan)} className={`${cardColor} border rounded p-1.5 print:p-1 print:border-black print:bg-white text-xs leading-tight wrap-break-word relative group ${canEdit ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
                                {canEdit && <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden text-slate-400"><Edit className="h-3 w-3" /></div>}
                                <div className="flex items-center gap-1 text-[10px] text-blue-700 font-bold mb-0.5"><Factory className="w-3 h-3" /> {isCompleted ? '製造実績' : '製造予定'}</div>
                                <div className="font-bold text-slate-800 print:text-black pr-3">{plan.products?.name}</div>
                                <div className="text-slate-600 print:text-black mb-0.5">{plan.products?.variant_name}</div>
                                <div className="font-black text-slate-900 print:text-black">
                                  {displayCs} <span className="font-normal text-[10px]">c/s</span>
                                  {displayP > 0 && <span className="ml-1">{displayP} <span className="font-normal text-[10px]">p</span></span>}
                                  {!isCompleted && <span className="text-slate-600 font-normal ml-1">({plan.production_kg}kg)</span>}
                                </div>
                                {plan.notes && <div className="mt-1 pt-1 border-t border-slate-200 print:border-black text-[10px] text-slate-700 print:text-black italic wrap-break-word">{plan.notes}</div>}

                                <div className="mt-1 flex justify-end print:hidden">
                                  {plan.status === 'planned' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold">計画</span>}
                                  {plan.status === 'in_progress' && <span className="text-[10px] bg-amber-500 text-white px-1.5 rounded font-bold flex items-center gap-0.5"><Play className="h-2 w-2" /> 製造中</span>}
                                  {plan.status === 'completed' && <span className="text-[10px] bg-green-600 text-white px-1.5 rounded font-bold flex items-center gap-0.5"><CheckCircle className="h-2 w-2" /> 完了</span>}
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

          {/* スマホ用 */}
          <div className="block md:hidden print:hidden divide-y divide-slate-200 bg-slate-50 flex-1">
            {getCalendarDays().filter(d => d !== null).map((day) => {
              const dateStr = `${currentYear}-${currentMonthStr}-${String(day).padStart(2, '0')}`;
              const dObj = new Date(currentYear, calendarMonth.getMonth(), day as number);
              const dow = dObj.getDay();
              const dowStr = ['日', '月', '火', '水', '木', '金', '土'][dow];
              const dowColor = dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-slate-700';

              const dayPlans = calendarPlans.filter(p => p.production_date === dateStr);
              const dayOrders = calendarOrders.filter(o => o.planned_ship_date === dateStr);
              const dayEvents = calendarEvents.filter(e => e.event_date === dateStr);
              const hasAnyEvent = dayPlans.length > 0 || dayOrders.length > 0 || dayEvents.length > 0;

              return (
                <div key={day} className={`flex p-3 ${dow === 0 ? 'bg-red-50/30' : dow === 6 ? 'bg-blue-50/30' : 'bg-white'}`}>
                  <div className="w-12 shrink-0 flex flex-col items-center pt-1 border-r border-slate-100 mr-3 pr-1">
                    <span className={`text-xl font-black leading-none ${dowColor}`}>{day}</span>
                    <span className={`text-[10px] mt-1 font-bold ${dowColor}`}>{dowStr}</span>
                    {canEdit && (
                      <div onClick={() => openEventDialog(undefined, dateStr)} className="mt-3 text-slate-400 hover:text-blue-500 hover:bg-slate-100 cursor-pointer p-1.5 rounded-full border shadow-sm bg-white">
                        <PlusIcon />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5 py-1 min-h-[3rem]">
                    {dayEvents.map(ev => (
                      <div key={ev.id} onClick={() => canEdit && openEventDialog(ev)} className={`bg-slate-100 border border-slate-300 rounded p-2 text-xs relative group shadow-sm ${canEdit ? 'cursor-pointer hover:bg-slate-200' : ''}`}>
                        <div className="font-bold text-slate-800 flex items-start gap-1.5 text-sm"><Flag className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />{ev.title}</div>
                        {ev.notes && <div className="text-[11px] text-slate-600 mt-1.5 ml-5 italic bg-white/50 p-1.5 rounded border border-slate-200">{ev.notes}</div>}
                      </div>
                    ))}

                    {dayOrders.length > 0 && (
                      <div onClick={() => openOrdersModal(dateStr!)} className="bg-purple-100 border border-purple-300 rounded px-3 py-2 text-sm font-bold text-purple-800 flex items-center justify-between shadow-sm cursor-pointer hover:bg-purple-200 transition-colors">
                        <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" /> 出荷</span>
                        <span className="text-xs bg-white px-2 py-0.5 rounded-sm">{dayOrders.length} 件の予定</span>
                      </div>
                    )}

                    {dayPlans.map(plan => {
                      let cardColor = "bg-blue-50 border-blue-200";
                      if (plan.status === 'in_progress') cardColor = "bg-amber-50 border-amber-300";
                      if (plan.status === 'completed') cardColor = "bg-green-50 border-green-300";

                      const isCompleted = plan.status === 'completed';
                      const displayCs = isCompleted ? (plan.actual_cs !== undefined ? plan.actual_cs : plan.planned_cs) : plan.planned_cs;
                      const displayP = isCompleted ? (plan.actual_piece || 0) : 0;

                      return (
                        <div key={plan.id} onClick={() => canEdit && openEditDialog(plan)} className={`${cardColor} border rounded p-2.5 text-xs shadow-sm relative group ${canEdit ? 'cursor-pointer' : ''}`}>
                          <div className="flex justify-between items-start mb-1.5 border-b border-white/40 pb-1.5">
                            <div className="flex items-center gap-1 text-[10px] text-blue-800 font-bold"><Factory className="w-3.5 h-3.5" /> {isCompleted ? '製造実績' : '製造予定'}</div>
                            {plan.status === 'planned' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold">計画</span>}
                            {plan.status === 'in_progress' && <span className="text-[10px] bg-amber-500 text-white px-1.5 rounded font-bold flex items-center gap-0.5"><Play className="h-2.5 w-2.5" /> 製造中</span>}
                            {plan.status === 'completed' && <span className="text-[10px] bg-green-600 text-white px-1.5 rounded font-bold flex items-center gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> 完了</span>}
                          </div>
                          <div className="font-bold text-slate-800 text-sm">{plan.products?.name} <span className="text-slate-500 font-normal text-xs">({plan.products?.variant_name})</span></div>
                          <div className="flex justify-between items-end mt-2 pt-1.5">
                            <div className="text-slate-600 italic truncate max-w-[50%]">{plan.notes || ""}</div>
                            <div className="font-black text-slate-900 text-lg">
                              {displayCs} <span className="font-normal text-[10px] text-slate-500">c/s</span>
                              {displayP > 0 && <span className="font-black text-slate-900 text-lg ml-1">{displayP} <span className="font-normal text-[10px] text-slate-500">p</span></span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!hasAnyEvent && (
                      <div className="text-xs text-slate-400 flex h-full items-center justify-center font-medium border border-dashed rounded-lg py-4 bg-slate-50/50">
                        予定なし
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-slate-100 print:bg-white border-t border-slate-300 print:border-black p-4 flex flex-col gap-2 shrink-0">
            <div className="text-sm font-bold text-slate-700 print:text-black flex items-center justify-between">
              <span>{currentMonthStr}月の備考・連絡事項</span>
              {isSavingNote && <Loader2 className="w-4 h-4 animate-spin text-blue-600 print:hidden" />}
            </div>
            {canEdit ? (
              <textarea
                value={monthlyNote}
                onChange={(e) => setMonthlyNote(e.target.value)}
                onBlur={handleSaveMonthlyNote}
                placeholder="クリックして今月の特記事項を入力...（入力後に別の場所をクリックすると自動保存されます）"
                className="w-full bg-white print:border-none print:shadow-none p-3 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
              />
            ) : (
              <div className="w-full bg-white print:border-none print:shadow-none p-3 border border-slate-300 rounded-md text-sm min-h-[60px] whitespace-pre-wrap">
                {monthlyNote || <span className="text-slate-400">備考なし</span>}
              </div>
            )}
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
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Factory className="h-6 w-6 text-blue-600" /> 製造計画・Lot採番</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {canEdit && (
            <Button onClick={handleSelectStockProduction} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-12 md:h-10">
              <Plus className="h-4 w-4 mr-2" /> 在庫品として製造 (見込み生産)
            </Button>
          )}
          <Button onClick={() => setViewMode('calendar')} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-2 font-bold shadow-sm h-12 md:h-10">
            <CalendarDays className="h-5 w-5" /> スケジュール表を表示
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[35%]">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>未計画の残数がある受注</h2>
          <div className="space-y-3 h-[calc(100vh-200px)] overflow-y-auto pr-2 pb-10">
            {orders.map((order) => {
              const displayCs = Math.floor(order.quantity / (order.products?.unit_per_cs || 24));
              const displayP = Math.floor((order.quantity % (order.products?.unit_per_cs || 24)) / 2);
              const remainCs = Math.floor(order.remainPieces / (order.products?.unit_per_cs || 24));
              const remainP = Math.floor((order.remainPieces % (order.products?.unit_per_cs || 24)) / 2);

              return (
                <Card key={order.id} onClick={() => handleSelectOrder(order)} className={`cursor-pointer transition-all border-2 ${selectedOrder?.id === order.id ? "border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]" : "border-slate-200 hover:border-blue-300"}`}>
                  <CardHeader className="p-4 pb-2 bg-white rounded-t-lg"><div className="flex justify-between items-start"><div className="text-xs text-slate-500">{order.id}</div><Badge className="bg-slate-100 text-slate-800 border-none shadow-sm text-xs">出荷: {new Date(order.planned_ship_date || order.desired_ship_date).toLocaleDateString()}</Badge></div><CardTitle className="text-base text-slate-800 leading-tight mt-1">{order.customers?.name}</CardTitle></CardHeader>
                  <CardContent className="p-4 pt-2 text-sm text-slate-600 bg-white rounded-b-lg">
                    <div className="font-bold text-slate-800 mb-2">{order.products?.name} ({order.products?.variant_name})</div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-xs text-slate-500">全体: {displayCs} c/s {displayP > 0 && `${displayP} p`}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-slate-500">未計画残数:</span>
                        <span className="font-black text-xl text-red-600">{remainCs}</span><span className="text-xs font-normal text-slate-500">c/s</span>
                        {remainP > 0 && <><span className="font-bold text-lg text-slate-700 ml-1">{remainP}</span><span className="text-[10px] font-normal text-slate-500">p</span></>}
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden"><div className="bg-blue-500 h-full transition-all" style={{ width: `${(order.plannedPieces / order.quantity) * 100}%` }}></div></div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="w-full lg:w-[65%] flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 mb-1 flex items-center gap-2"><span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>日別の製造予定を入力</h2>

          {canEdit ? (
            <Card className="border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
              {selectedOrder || isStockProduction ? (
                <div className="p-4 md:p-6">
                  <div className="bg-slate-100 p-4 rounded-md mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4 border border-slate-200 shadow-inner">
                    {isStockProduction ? (
                      <div className="w-full">
                        <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1"><PackageCheck className="w-3 h-3" /> 見込み生産 (在庫補充)</div>
                        <select value={stockProductId} onChange={e => setStockProductId(e.target.value)} className="w-full border-slate-300 rounded p-2 text-sm font-bold bg-white focus:ring-blue-500">
                          <option value="">製造する製品を選択してください...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.variant_name})</option>)}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div><div className="text-xs text-slate-500 mb-1">対象製品</div><div className="font-bold text-lg text-slate-800">{selectedOrder?.products?.name} ({selectedOrder?.products?.variant_name})</div></div>
                        <div className="md:text-right border-t md:border-none pt-2 md:pt-0 mt-2 md:mt-0">
                          <div className="text-xs text-slate-500 mb-1">この受注の残数</div>
                          <div className="font-black text-2xl text-red-600">
                            {Math.floor((selectedOrder?.remainPieces || 0) / (selectedOrder?.products?.unit_per_cs || 24))} <span className="text-sm font-normal text-slate-500">c/s</span>
                            {Math.floor(((selectedOrder?.remainPieces || 0) % (selectedOrder?.products?.unit_per_cs || 24)) / 2) > 0 && <span className="ml-1 text-xl">{Math.floor(((selectedOrder?.remainPieces || 0) % (selectedOrder?.products?.unit_per_cs || 24)) / 2)} <span className="text-xs font-normal text-slate-500">p</span></span>}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                      <div><label className="block text-sm font-bold mb-2 text-slate-700 flex items-center gap-1"><CalendarIcon className="h-4 w-4" /> 製造予定日</label><Input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="text-lg bg-white h-12 border-blue-300 shadow-sm" /></div>
                      <div><label className="block text-sm font-bold mb-2 text-slate-700">この日の製造量 (kg)</label><div className="flex items-center gap-3"><Input type="number" min="0" value={planKg} onChange={e => setPlanKg(e.target.value === "" ? "" : Number(e.target.value))} className="text-xl font-bold bg-white h-12 text-right border-blue-300 shadow-sm" /><span className="text-lg font-bold text-slate-500">kg</span></div><div className="text-xs text-slate-500 mt-2 text-right">自動計算 👉 <span className="font-bold text-blue-700 text-sm">{calculatedCs} c/s</span></div></div>
                    </div>
                    <div className="flex flex-col h-full"><label className="block text-sm font-bold mb-2 text-slate-700">備考 (任意)</label><textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)} className="flex-1 w-full p-3 border rounded-md text-sm border-blue-300 shadow-sm min-h-[100px] resize-none" /></div>
                  </div>
                  <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-5 relative">
                    <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2 text-md"><PackageCheck className="h-5 w-5" /> 発行されるLot情報</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded-md border border-blue-100 shadow-sm text-center"><div className="text-xs font-bold text-slate-500 mb-1">製造Lot番号</div><div className="text-2xl font-black text-blue-700 tracking-wider">{calculatedLot || "-"}</div></div>
                      <div className="bg-white p-3 rounded-md border border-blue-100 shadow-sm text-center"><div className="text-xs font-bold text-slate-500 mb-1">賞味期限</div><div className="text-2xl font-black text-slate-800 tracking-wider">{calculatedExpiry ? new Date(calculatedExpiry).toLocaleDateString() : "-"}</div></div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSavePlan} disabled={!planKg || !calculatedLot || (isStockProduction && !stockProductId)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white h-12 px-6 font-bold shadow-sm"><ListPlus className="h-5 w-5 mr-2" /> 計画を追加する</Button>
                  </div>
                </div>
              ) : (<div className="p-16 text-center text-slate-400 flex flex-col items-center bg-slate-50"><Factory className="h-16 w-16 mb-4 opacity-30 text-blue-500" /><p className="text-xl font-bold text-slate-500">リストから受注を選ぶか、見込み生産を開始してください</p></div>)}
            </Card>
          ) : (
            <Card className="border-slate-200 bg-slate-50 opacity-70">
              <CardContent className="p-16 text-center text-slate-500"><Lock className="w-12 h-12 mx-auto mb-4 text-slate-300" /><p className="font-bold">閲覧モードのため、新規計画の追加はできません。</p></CardContent>
            </Card>
          )}

          {!selectedOrder && (
            <div className="mt-4">
              <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> 直近の製造計画一覧</h2>
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead>予定日</TableHead><TableHead>Lot / 製品</TableHead><TableHead className="text-right">数量(c/s)</TableHead><TableHead className="text-center w-24">状態</TableHead><TableHead className="w-20 text-center">詳細</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {plans.map(plan => {
                      const isCompleted = plan.status === 'completed';
                      const displayCs = isCompleted ? (plan.actual_cs !== undefined ? plan.actual_cs : plan.planned_cs) : plan.planned_cs;
                      const displayP = isCompleted ? (plan.actual_piece || 0) : 0;

                      return (
                        <TableRow key={plan.id}>
                          <TableCell>
                            <div className="font-bold text-slate-700">{new Date(plan.production_date).toLocaleDateString()}</div>
                            {!plan.order_id && <Badge className="bg-slate-100 text-slate-500 border-none shadow-none text-[10px] mt-1 py-0">見込み生産</Badge>}
                          </TableCell>
                          <TableCell><div className="font-bold text-blue-600">{plan.lot_code}</div><div className="text-xs text-slate-600">{plan.products?.name}</div></TableCell>
                          <TableCell className="text-right font-bold">
                            {displayCs} c/s
                            {displayP > 0 && <span className="ml-1">{displayP} p</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {plan.status === 'planned' && <Badge className="bg-blue-100 text-blue-700 border-none shadow-sm">計画</Badge>}
                            {plan.status === 'in_progress' && <Badge className="bg-amber-500 text-white border-none shadow-sm">製造中</Badge>}
                            {plan.status === 'completed' && <Badge className="bg-green-600 text-white border-none shadow-sm">完了</Badge>}
                          </TableCell>
                          <TableCell className="text-center"><Button variant="outline" size="sm" onClick={() => canEdit ? openEditDialog(plan) : alert("閲覧モードです")} className="text-blue-600 border-blue-200 hover:bg-blue-50">確認</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
      {renderAllDialogs()}
    </div>
  );
}

function PlusIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>;
}