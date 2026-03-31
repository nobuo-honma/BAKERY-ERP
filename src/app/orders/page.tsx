"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Calculator, Loader2, Save, Lock, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = { id: string; order_date: string; desired_ship_date: string; customer_id: string; product_id: string; quantity: number; status: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_cs?: number; unit_per_kg?: number } };
type Customer = { id: string; name: string };
type Product = { id: string; name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number };
type BomWithStock = { id: string; item_id: string; usage_rate: number; unit: string; basis_type: string; items: { name: string; item_type: string; item_stocks?: [{ quantity: number }] } };

export default function OrdersPage() {
  const { canEdit } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [formData, setFormData] = useState({ date: "", shipDate: "", customerId: "", productId: "", cs: 0 });
  const [selectedProductName, setSelectedProductName] = useState("");

  const [boms, setBoms] = useState<BomWithStock[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: oData } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_kg, unit_per_cs)").order("order_date", { ascending: false });
    const { data: cData } = await supabase.from("customers").select("id, name");
    const { data: pData } = await supabase.from("products").select("*");

    if (oData) setOrders(oData);
    if (cData) setCustomers(cData);
    if (pData) setProducts(pData);

    resetForm();
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (order?: Order) => {
    if (order) {
      setEditingOrder(order);
      setFormData({ date: order.order_date, shipDate: order.desired_ship_date, customerId: order.customer_id, productId: order.product_id, cs: order.quantity });
      setSelectedProductName(order.products?.name || "");
    } else resetForm();
    setIsOpen(true);
  };

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingOrder(null);
    setFormData({ date: today, shipDate: "", customerId: "", productId: "", cs: 0 });
    setSelectedProductName("");
  };

  useEffect(() => {
    if (!formData.productId) { setBoms([]); return; }
    const fetchBoms = async () => {
      setIsSimulating(true);
      const { data } = await supabase.from("bom").select(`*, items ( name, item_type, item_stocks ( quantity ) )`).eq("product_id", formData.productId);
      if (data) setBoms(data as any);
      setIsSimulating(false);
    };
    fetchBoms();
  }, [formData.productId]);

  const selectedProduct = products.find(p => p.id === formData.productId);
  const productionPcs = selectedProduct ? formData.cs * selectedProduct.unit_per_cs : 0;
  const productionKg = selectedProduct ? productionPcs / selectedProduct.unit_per_kg : 0;

  const handleSaveOrder = async () => {
    if (!formData.customerId || !formData.productId || formData.cs <= 0 || !formData.shipDate) { alert("必須項目を入力してください。"); return; }
    setIsProcessing(true);
    const orderData = { order_date: formData.date, desired_ship_date: formData.shipDate, customer_id: formData.customerId, product_id: formData.productId, quantity: formData.cs };

    try {
      if (editingOrder) {
        await supabase.from("orders").update(orderData).eq("id", editingOrder.id);
        alert("受注データを更新しました！");
      } else {
        const dateStr = formData.date.replace(/-/g, "");
        const random3 = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        await supabase.from("orders").insert({ id: `ORD-${dateStr}-${random3}`, status: "received", ...orderData });
        alert("新規受注を登録しました！");
      }
      setIsOpen(false); fetchData();
    } catch (err: any) { alert("エラー: " + err.message); }
    setIsProcessing(false);
  };

  // --- ★変更: どんな状態でも削除できる「ロールバック付き」削除処理 ---
  const handleDeleteOrder = async (orderId: string, status: string) => {
    let confirmMsg = "この受注データを本当に削除（キャンセル）しますか？\n（※元に戻せません）";

    // ステータスによって警告文を変える
    if (status === 'in_production') {
      confirmMsg = "【警告】この受注は現在「製造中」の計画が含まれています。\n受注を削除すると、紐づく製造計画もすべて強制的に削除されますがよろしいですか？\n（※減算された原料の在庫は自動では戻りませんので、別途棚卸で調整してください）";
    } else if (status === 'shipped') {
      confirmMsg = "【警告】この受注は「出荷済」です。\n削除しても出荷実績や在庫は元に戻りません。本当に削除してよろしいですか？";
    }

    if (!confirm(confirmMsg)) return;
    setIsProcessing(true);

    try {
      // 外部キーの制約（ON DELETE CASCADE）により、受注を消せば紐づく製造計画(production_plans)や出荷実績(shipments)も消えます
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;

      setIsOpen(false); fetchData();
      alert("受注を削除（キャンセル）しました。");
    } catch (err: any) {
      alert("削除エラー: " + err.message);
    }
    setIsProcessing(false);
  };

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><ShoppingCart className="h-6 w-6 text-blue-600" />受注管理</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
        {canEdit && <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"><Plus className="h-4 w-4 mr-2" /> 新規受注登録</Button>}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl bg-white max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> {editingOrder ? "受注内容の編集 / キャンセル" : "新規受注の登録"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <div className="space-y-4 bg-slate-50 p-6 rounded-lg border shadow-inner">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold mb-1 text-slate-700">受注日</label><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="bg-white" /></div>
                <div><label className="block text-sm font-bold mb-1 text-slate-700">希望納期 <span className="text-red-500">*</span></label><Input type="date" value={formData.shipDate} onChange={e => setFormData({ ...formData, shipDate: e.target.value })} className="bg-white border-blue-300" /></div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-slate-700">出荷先 <span className="text-red-500">*</span></label>
                <Input list="customers-list" placeholder="顧客名を入力または選択..." value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })} className="bg-white border-blue-300" />
                <datalist id="customers-list">{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</datalist>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 -mx-2 rounded-md border border-blue-100">
                <div><label className="block text-sm font-bold mb-1 text-blue-900">製品名 <span className="text-red-500">*</span></label><select className="w-full border-blue-200 rounded-md p-2.5 text-sm bg-white" value={selectedProductName} onChange={e => { setSelectedProductName(e.target.value); setFormData({ ...formData, productId: "" }); }}><option value="">1. 製品名を選択</option>{Array.from(new Set(products.map(p => p.name))).map(name => <option key={name} value={name}>{name}</option>)}</select></div>
                <div><label className="block text-sm font-bold mb-1 text-blue-900">種類(味) <span className="text-red-500">*</span></label><select className="w-full border-blue-200 rounded-md p-2.5 text-sm bg-white disabled:bg-slate-100" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })} disabled={!selectedProductName}><option value="">{selectedProductName ? "2. 味を選択" : "←先に製品名"}</option>{products.filter(p => p.name === selectedProductName).map(p => <option key={p.id} value={p.id}>{p.variant_name}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-bold mb-1 text-slate-700">受注数(c/s) <span className="text-red-500">*</span></label><div className="flex items-center gap-3"><Input type="number" min="0" value={formData.cs || ""} onChange={e => setFormData({ ...formData, cs: Number(e.target.value) })} className="bg-white border-blue-300 text-2xl font-bold h-12 w-48 text-right" /><span className="text-xl font-bold text-slate-500">c/s</span></div></div>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 h-full shadow-inner">
                <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-4 text-lg"><Calculator className="h-6 w-6" /> 必要資材・原料 シミュレーション</h3>
                {formData.productId ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4 bg-white p-4 rounded border"><div className="text-slate-600">製造個数: <span className="font-black text-2xl text-slate-800 ml-2">{productionPcs.toLocaleString()}</span> 個</div><div className="text-slate-600">製造量: <span className="font-black text-2xl text-slate-800 ml-2">{productionKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span> kg</div></div>
                    <div className="overflow-x-auto rounded-md border shadow-sm">
                      <Table className="bg-white">
                        <TableHeader className="bg-slate-100"><TableRow><TableHead className="font-bold text-slate-700">必要品目</TableHead><TableHead className="text-right font-bold text-slate-700">必要量</TableHead><TableHead className="text-right font-bold text-slate-700">現在庫</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {isSimulating ? (<TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500 font-bold"><Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" /> 計算中...</TableCell></TableRow>) : (
                            boms.map((bom, idx) => {
                              const requiredQty = bom.basis_type === 'production_qty' ? productionKg * bom.usage_rate : formData.cs * bom.usage_rate;
                              const currentStock = bom.items.item_stocks?.[0]?.quantity || 0;
                              const isShort = currentStock < requiredQty;
                              return (
                                <TableRow key={idx} className={isShort && requiredQty > 0 ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}>
                                  <TableCell className="font-medium text-slate-800 text-sm py-3">{bom.items.name}</TableCell>
                                  <TableCell className="text-right font-black text-blue-600 text-base py-3">{requiredQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-500">{bom.unit}</span></TableCell>
                                  <TableCell className={`text-right font-bold text-base py-3 ${isShort && requiredQty > 0 ? "text-red-600" : "text-slate-700"}`}>{currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })} {isShort && requiredQty > 0 && <span className="ml-2 inline-block bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">不足!</span>}</TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (<div className="flex flex-col items-center justify-center h-[300px] text-slate-400 bg-white/50 rounded-lg border-dashed border-blue-200"><Calculator className="h-12 w-12 mb-4 opacity-50" /><p className="font-bold">製品と種類を選択してください</p></div>)}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 border-t pt-4 flex flex-col sm:flex-row gap-4 sm:justify-between">
            {/* ★変更: どんな状態でも削除可能に */}
            {editingOrder ? (
              <Button onClick={() => handleDeleteOrder(editingOrder.id, editingOrder.status)} disabled={isProcessing} variant="outline" className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 font-bold"><Trash2 className="h-4 w-4 mr-2" />この受注をキャンセル(削除)する</Button>
            ) : <div></div>}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsOpen(false)} className="flex-1 sm:flex-none">キャンセル</Button>
              <Button onClick={handleSaveOrder} disabled={isProcessing} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-8 font-bold"><Save className="h-4 w-4 mr-2" /> {editingOrder ? "更新する" : "受注を確定する"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order) => (
          <Card key={order.id} className="hover:shadow-md transition-all border-slate-200 relative group">
            {canEdit && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1 bg-white/80 p-1 rounded-md shadow-sm backdrop-blur-sm">
                <Button variant="ghost" size="icon" onClick={() => openModal(order)} className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700" title="編集・キャンセル">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}

            <CardHeader className="pb-2 bg-slate-50 border-b rounded-t-lg">
              <div className="flex justify-between items-start pr-12">
                <div><div className="text-xs text-slate-500 mb-1">{order.id}</div><CardTitle className="text-lg text-slate-800 line-clamp-1" title={order.customers?.name}>{order.customers?.name}</CardTitle></div>
              </div>
              <div className="mt-2">
                {order.status === 'received' && <Badge className="bg-amber-100 text-amber-800 border-none shadow-sm">未処理 (引当・計画待)</Badge>}
                {order.status === 'in_production' && <Badge className="bg-blue-100 text-blue-800 border-none shadow-sm">製造中あり</Badge>}
                {order.status === 'shipped' && <Badge className="bg-green-100 text-green-800 border-none shadow-sm">出荷済</Badge>}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between"><span>製品:</span><span className="font-bold text-slate-800 text-right w-2/3 leading-tight">{order.products?.name}<br /><span className="text-xs font-normal text-slate-500">({order.products?.variant_name})</span></span></div>
              <div className="flex justify-between items-center pt-1"><span>数量:</span><span className="font-black text-xl text-blue-600">{order.quantity} <span className="text-sm font-normal text-slate-500">c/s</span></span></div>
              <div className="flex justify-between pt-3 border-t mt-3"><span>希望納期:</span><span className="font-bold text-slate-800 text-base">{new Date(order.desired_ship_date).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>
        ))}
        {loading && orders.length === 0 ? <div className="col-span-full text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-slate-400 mx-auto" /></div> : orders.length === 0 && <div className="col-span-full text-center py-16 text-slate-500 bg-white rounded-lg border-dashed">受注データがありません。</div>}
      </div>
    </div>
  );
}