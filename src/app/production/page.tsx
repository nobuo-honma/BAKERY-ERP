"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, ClipboardList, Loader2, Save, Play, CheckCircle2, FlaskConical, AlertCircle, Trash2, Edit, Lock, ArrowRight, PackageOpen, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Plan = {
  id: string;
  plan_date: string;
  order_id: string | null;
  product_id: string;
  quantity: number;
  actual_cs: number | null;
  actual_piece: number | null;
  status: string;
  lot_code: string | null;
  orders?: { 
    id: string;
    customers?: { name: string };
    customer_order_no?: string;
  };
  products?: { 
    name: string; 
    variant_name: string;
    unit_per_cs: number;
    expiry_days: number;
  };
};

type Product = { 
  id: string; 
  name: string; 
  variant_name: string; 
  unit_per_cs: number; 
  expiry_days: number;
};

export default function ProductionPage() {
  const { canEdit } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [isOpen, setIsOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({ date: "", productId: "", cs: 0, type: "order" as "order" | "stock" });
  const [selectedProductName, setSelectedProductName] = useState("");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [actualResults, setActualResults] = useState({ cs: 0, p: 0, lotCode: "" });

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data: pData } = await supabase
      .from("production_plans")
      .select("*, orders(id, customers(name), customer_order_no), products(name, variant_name, unit_per_cs, expiry_days)")
      .order("plan_date", { ascending: true });
    
    const { data: prodData } = await supabase.from("products").select("*");

    if (pData) setPlans(pData as any);
    if (prodData) setProducts(prodData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleSavePlan = async () => {
    if (!newPlan.date || !newPlan.productId || newPlan.cs <= 0) { alert("必須項目を入力してください。"); return; }
    setIsProcessing(true);
    const { error } = await supabase.from("production_plans").insert({
      plan_date: newPlan.date,
      product_id: newPlan.productId,
      quantity: newPlan.cs,
      status: "planned"
    });
    if (!error) { setIsOpen(false); fetchPlans(); } else alert("エラー: " + error.message);
    setIsProcessing(false);
  };

  const handleOpenComplete = (plan: Plan) => {
    setSelectedPlan(plan);
    const today = new Date().toISOString().split('T')[0].replace(/-/g, "").slice(2);
    setActualResults({ 
      cs: plan.quantity, 
      p: 0, 
      lotCode: `${today}-01` // デフォルトロット
    });
    setCompleteDialogOpen(true);
  };

  const handleCompleteProduction = async () => {
    if (!selectedPlan || !canEdit || !actualResults.lotCode) return;
    setIsProcessing(true);
    try {
      const unitPerCs = selectedPlan.products?.unit_per_cs || 1;
      const totalPieces = (actualResults.cs * unitPerCs) + actualResults.p;
      const expiryDays = selectedPlan.products?.expiry_days || 180;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      // 1. 製造ステータスの更新
      await supabase.from("production_plans").update({
        status: "completed",
        lot_code: actualResults.lotCode,
        actual_cs: actualResults.cs,
        actual_piece: actualResults.p
      }).eq("id", selectedPlan.id);

      // 2. 製品在庫の追加 (upsert または insert)
      // 同じロット番号があれば合算、なければ新規
      const { data: existingStock } = await supabase.from("product_stocks").select("*").eq("lot_code", actualResults.lotCode).eq("product_id", selectedPlan.product_id).single();
      
      if (existingStock) {
        await supabase.from("product_stocks").update({ total_pieces: existingStock.total_pieces + totalPieces }).eq("id", existingStock.id);
      } else {
        await supabase.from("product_stocks").insert({
          product_id: selectedPlan.product_id,
          lot_code: actualResults.lotCode,
          total_pieces: totalPieces,
          expiry_date: expiryDate.toISOString().split('T')[0]
        });
      }

      // 3. 在庫変動履歴の記録
      await supabase.from("inventory_adjustments").insert({
        product_id: selectedPlan.product_id,
        lot_code: actualResults.lotCode,
        before_qty: existingStock ? existingStock.total_pieces : 0,
        after_qty: (existingStock ? existingStock.total_pieces : 0) + totalPieces,
        reason: "製品製造完了"
      });

      // 4. 保存サンプルの自動登録 (1個)
      await supabase.from("keep_samples").insert({
        product_id: selectedPlan.product_id,
        lot_code: actualResults.lotCode,
        save_date: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0],
        qty: 1,
        status: "saved"
      });

      // 5. 受注ステータスの更新 (もし受注紐付けがあれば)
      if (selectedPlan.order_id) {
        await supabase.from("orders").update({ status: "in_production" }).eq("id", selectedPlan.order_id);
      }

      setCompleteDialogOpen(false);
      fetchPlans();
      alert("製造実績を登録し、在庫（＋保存サンプル）に反映しました！");
    } catch (err: any) {
      alert("エラー: " + err.message);
    }
    setIsProcessing(false);
  };

  const groupedPlans = plans.reduce((acc, plan) => {
    if (!acc[plan.plan_date]) acc[plan.plan_date] = [];
    acc[plan.plan_date].push(plan);
    return acc;
  }, {} as Record<string, Plan[]>);

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-800">
            <ClipboardList className="h-7 w-7 text-emerald-600" /> 製造計画・実績
          </h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')} className="bg-white border-slate-200 shadow-sm hidden md:flex font-bold">
            {viewMode === 'calendar' ? <LayoutDashboard className="w-4 h-4 mr-2" /> : <Calendar className="w-4 h-4 mr-2" />} {viewMode === 'calendar' ? "リスト表示" : "カレンダー表示"}
          </Button>
          {canEdit && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-100 h-11 px-6"><Play className="h-4 w-4 mr-2" /> 計画を追加</Button></DialogTrigger>
              <DialogContent className="max-w-md bg-white">
                <DialogHeader><DialogTitle className="font-black text-xl flex items-center gap-2 text-emerald-700 underline underline-offset-4 decoration-emerald-200"><Calendar className="h-6 w-6" /> 製造計画の新規作成</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1 leading-none uppercase tracking-widest">製造予定日</label>
                    <Input type="date" value={newPlan.date} onChange={e => setNewPlan({...newPlan, date: e.target.value})} className="bg-slate-50 border-slate-200" />
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    <label className="block text-xs font-black text-emerald-600 mb-2 leading-none uppercase tracking-widest">対象製品 *</label>
                    <div className="space-y-2">
                      <select 
                        className="w-full border-slate-200 rounded-lg p-3 text-sm bg-white font-bold" 
                        value={selectedProductName} 
                        onChange={e => { setSelectedProductName(e.target.value); setNewPlan({...newPlan, productId: ""}); }}
                      >
                        <option value="">1. 製品名を選択...</option>
                        {Array.from(new Set(products.map(p => p.name))).map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                      <select 
                        className="w-full border-slate-200 rounded-lg p-3 text-sm bg-white disabled:bg-slate-100 font-bold" 
                        value={newPlan.productId} 
                        onChange={e => setNewPlan({...newPlan, productId: e.target.value})} 
                        disabled={!selectedProductName}
                      >
                        <option value="">{selectedProductName ? "2. 味を選択..." : "←先に製品名"}</option>
                        {products.filter(p => p.name === selectedProductName).map(p => <option key={p.id} value={p.id}>{p.variant_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1 leading-none uppercase tracking-widest">製造予定数 (c/s)</label>
                    <div className="flex items-center gap-3">
                      <Input type="number" min="0" value={newPlan.cs || ""} onChange={e => setNewPlan({...newPlan, cs: Number(e.target.value)})} className="text-2xl font-black h-14 bg-white border-slate-200 w-32 text-right" />
                      <span className="text-xl font-black text-slate-400">c/s</span>
                    </div>
                  </div>
                  <Button onClick={handleSavePlan} disabled={isProcessing} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-lg shadow-emerald-100 transition-all active:scale-95">
                    {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5 mr-2" />} 計画を保存する
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedPlans).sort().map(([date, dayPlans]) => (
          <div key={date} className="relative pl-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-0 before:w-1 before:bg-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-slate-800 text-white px-4 py-1 rounded-full font-black text-sm shadow-sm">{new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}</div>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
              {dayPlans.map((plan) => (
                <Card key={plan.id} className={`group border-2 transition-all ${plan.status === 'completed' ? 'border-slate-100 grayscale-[0.5] opacity-80' : 'border-white hover:border-emerald-200 shadow-sm shadow-slate-100'}`}>
                  <CardHeader className="pb-2 p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        {plan.orders ? (
                          <Badge variant="outline" className="mb-1 text-[9px] bg-blue-50 text-blue-600 font-bold border-blue-100">紐付受注: {plan.orders.customers?.name}</Badge>
                        ) : (
                          <Badge variant="outline" className="mb-1 text-[9px] bg-slate-100 text-slate-500 font-bold border-slate-200">見込み生産</Badge>
                        )}
                        <CardTitle className="text-lg font-black text-slate-800 tracking-tight leading-tight group-hover:text-emerald-700">{plan.products?.name}</CardTitle>
                        <div className="text-[11px] font-bold text-slate-400 mt-1 uppercase leading-none italic">{plan.products?.variant_name}</div>
                      </div>
                      {plan.status === 'planned' ? (
                        <Badge className="bg-amber-100 text-amber-800 border-none px-2 shadow-sm shadow-amber-50 font-black">計画中</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-none px-2 shadow-sm shadow-emerald-50 font-black flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 完了</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex justify-between items-end mb-4">
                      <div className="text-slate-400 text-xs font-bold leading-none">製造目標</div>
                      <div className="text-2xl font-black text-slate-700 tracking-tighter">{plan.quantity} <span className="text-xs font-normal text-slate-400 not-italic">c/s</span></div>
                    </div>
                    
                    {plan.status === 'completed' ? (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                        <div className="flex justify-between text-xs font-bold"><span className="text-slate-400 italic">LOT:</span> <span className="text-slate-900 font-mono tracking-widest">{plan.lot_code}</span></div>
                        <div className="flex justify-between text-xs font-bold"><span className="text-slate-400">実績数量:</span> <span className="text-slate-900">{plan.actual_cs} c/s + {plan.actual_piece} p</span></div>
                      </div>
                    ) : (
                      canEdit && (
                        <Button onClick={() => handleOpenComplete(plan)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-10 shadow-md shadow-emerald-50 flex items-center justify-center gap-2 transition-all">
                          <CheckCircle2 className="w-4 h-4" /> 実績を入力して完了
                        </Button>
                      )
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {loading && plans.length === 0 && <div className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 text-slate-300 mx-auto" /></div>}
        {!loading && plans.length === 0 && (
          <Card className="p-20 text-center text-slate-400 border-2 border-dashed border-slate-100 bg-white/50 rounded-3xl">
            <LayoutDashboard className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="font-black text-lg tracking-tight">現在、予定されている製造計画はありません。</p>
          </Card>
        )}
      </div>

      {/* 実績入力ダイアログ */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader><DialogTitle className="font-black text-xl flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-emerald-600" /> 製造実績の報告</DialogTitle></DialogHeader>
          <div className="space-y-6 pt-4 pb-2">
            <div className="bg-slate-100 px-4 py-3 rounded-xl border border-slate-200 flex justify-between items-center">
              <div><div className="text-[10px] text-slate-400 font-black mb-1 leading-none">計画品目</div><div className="font-black text-slate-800">{selectedPlan?.products?.name}</div></div>
              <div className="text-right"><div className="text-[10px] text-slate-400 font-black mb-1 leading-none">目標</div><div className="font-black text-slate-800">{selectedPlan?.quantity} c/s</div></div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-500 mb-1 leading-none uppercase tracking-widest flex items-center gap-1">製造ロット番号 (Lot) <AlertCircle className="w-3 h-3 text-emerald-500" /></label>
                <div className="relative">
                  <Input value={actualResults.lotCode} onChange={e => setActualResults({...actualResults, lotCode: e.target.value})} className="bg-slate-50 border-slate-200 font-mono tracking-widest text-lg h-12" placeholder="YYMMDD-01" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 italic">MANUAL INPUT</div>
                </div>
              </div>
              
              <div className="bg-emerald-50/50 p-5 rounded-2xl border-2 border-emerald-100">
                <label className="block text-xs font-black text-emerald-700 mb-3 leading-none uppercase tracking-widest border-l-4 border-emerald-500 pl-2">最終製造実績（数量）</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-black text-emerald-600 mb-1">ケース (cs)</span>
                    <div className="flex items-center gap-2"><Input type="number" value={actualResults.cs} onChange={e => setActualResults({...actualResults, cs: Number(e.target.value)})} className="bg-white border-emerald-200 font-black text-xl h-12 text-right" /><span className="text-xs font-bold text-emerald-500">cs</span></div>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-emerald-600 mb-1">端数 (p)</span>
                    <div className="flex items-center gap-2"><Input type="number" value={actualResults.p} onChange={e => setActualResults({...actualResults, p: Number(e.target.value)})} className="bg-white border-emerald-200 font-black text-xl h-12 text-right" /><span className="text-xs font-bold text-emerald-500">p</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex items-center gap-3">
              <FlaskConical className="w-6 h-6 text-indigo-500" />
              <div className="text-[10px] font-bold text-indigo-700 leading-tight">完了と同時に、規定の【保存サンプル(1個)】が<br/>自動的にシステムへ登録されます。</div>
            </div>

            <Button onClick={handleCompleteProduction} disabled={isProcessing || !actualResults.lotCode} className="w-full h-16 bg-slate-800 hover:bg-slate-900 text-white font-black text-xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
              {isProcessing ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="w-6 h-6" />} 製造を完了とし、在庫へ在庫反映
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}