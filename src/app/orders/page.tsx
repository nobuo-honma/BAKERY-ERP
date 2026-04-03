"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Calculator, Loader2, Save, Lock, Edit, Trash2, X, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = { id: string; order_date: string; planned_ship_date: string; desired_ship_date: string; customer_id: string; product_id: string; quantity: number; status: string; customer_order_no?: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_cs?: number; unit_per_kg?: number } };
type Customer = { id: string; name: string };
type Product = { id: string; name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number };
type BomWithStock = { id: string; product_id: string; item_id: string; usage_rate: number; unit: string; basis_type: string; items: { name: string; item_type: string; item_stocks?: [{ quantity: number }] } };

export default function OrdersPage() {
  const { canEdit } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [formData, setFormData] = useState<{
    date: string; plannedShipDate: string; shipDate: string; customerId: string; customerOrderNo: string;
    details: { productId: string; cs: number; selectedName: string }[];
  }>({ date: "", plannedShipDate: "", shipDate: "", customerId: "", customerOrderNo: "", details: [{ productId: "", cs: 0, selectedName: "" }] });

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
      setFormData({
        date: order.order_date, plannedShipDate: order.planned_ship_date || "", shipDate: order.desired_ship_date, customerId: order.customer_id, customerOrderNo: order.customer_order_no || "",
        details: [{ productId: order.product_id, cs: order.quantity, selectedName: order.products?.name || "" }]
      });
    } else resetForm();
    setIsOpen(true);
  };

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingOrder(null);
    setFormData({ date: today, plannedShipDate: "", shipDate: "", customerId: "", customerOrderNo: "", details: [{ productId: "", cs: 0, selectedName: "" }] });
  };

  const addDetailRow = () => setFormData(prev => ({ ...prev, details: [...prev.details, { productId: "", cs: 0, selectedName: "" }] }));
  const removeDetailRow = (index: number) => setFormData(prev => ({ ...prev, details: prev.details.filter((_, i) => i !== index) }));
  const updateDetail = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newDetails = [...prev.details];
      newDetails[index] = { ...newDetails[index], [field]: value };
      if (field === 'selectedName') newDetails[index].productId = "";
      return { ...prev, details: newDetails };
    });
  };

  useEffect(() => {
    const productIds = formData.details.map(d => d.productId).filter(Boolean);
    if (productIds.length === 0) { setBoms([]); return; }
    const fetchBoms = async () => {
      setIsSimulating(true);
      const { data } = await supabase.from("bom").select(`*, items ( name, item_type, item_stocks ( quantity ) )`).in("product_id", productIds);
      if (data) setBoms(data as any);
      setIsSimulating(false);
    };
    fetchBoms();
  }, [formData.details]);

  const simResult: Record<string, { name: string, unit: string, required: number, stock: number, isShort: boolean }> = {};
  formData.details.forEach(detail => {
    if (!detail.productId || detail.cs <= 0) return;
    const selectedProduct = products.find(p => p.id === detail.productId);
    if (!selectedProduct) return;

    const productionPcs = detail.cs * selectedProduct.unit_per_cs;
    const productionKg = productionPcs / selectedProduct.unit_per_kg;

    const productBoms = boms.filter(b => b.product_id === detail.productId);
    productBoms.forEach(bom => {
      const reqQty = bom.basis_type === 'production_qty' ? productionKg * bom.usage_rate : detail.cs * bom.usage_rate;
      if (!simResult[bom.item_id]) {
        simResult[bom.item_id] = { name: bom.items.name, unit: bom.unit, required: 0, stock: bom.items.item_stocks?.[0]?.quantity || 0, isShort: false };
      }
      simResult[bom.item_id].required += reqQty;
      simResult[bom.item_id].isShort = simResult[bom.item_id].required > simResult[bom.item_id].stock;
    });
  });

  const handleSaveOrder = async () => {
    if (!formData.customerId || !formData.shipDate || !formData.plannedShipDate) { alert("出荷予定日と着予定日などの必須項目を入力してください。"); return; }

    const validDetails = formData.details.filter(d => d.productId && d.cs > 0);
    if (validDetails.length === 0) { alert("少なくとも1つの製品と数量を正しく入力してください。"); return; }

    setIsProcessing(true);
    try {
      if (editingOrder) {
        const orderData = { order_date: formData.date, planned_ship_date: formData.plannedShipDate, desired_ship_date: formData.shipDate, customer_id: formData.customerId, customer_order_no: formData.customerOrderNo, product_id: validDetails[0].productId, quantity: validDetails[0].cs };
        await supabase.from("orders").update(orderData).eq("id", editingOrder.id);
        alert("受注データを更新しました！");
      } else {
        const dateStr = formData.date.replace(/-/g, "");
        const inserts = validDetails.map((detail, i) => {
          const random3 = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
          return {
            id: `ORD-${dateStr}-${random3}-${i}`, order_date: formData.date, planned_ship_date: formData.plannedShipDate, desired_ship_date: formData.shipDate,
            customer_id: formData.customerId, customer_order_no: formData.customerOrderNo || null,
            product_id: detail.productId, quantity: detail.cs, status: "received"
          };
        });
        await supabase.from("orders").insert(inserts);
        alert(`新規受注を登録しました！(${inserts.length}件)`);
      }
      setIsOpen(false); fetchData();
    } catch (err: any) { alert("エラー: " + err.message); }
    setIsProcessing(false);
  };

  const handleDeleteOrder = async (orderId: string, status: string) => {
    if (status !== 'received') { alert("製造中または出荷済みの受注は削除できません。"); return; }
    if (!confirm("この受注データを本当に削除（キャンセル）しますか？")) return;
    setIsProcessing(true);
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (!error) { setIsOpen(false); fetchData(); alert("受注をキャンセルしました。"); } else alert("エラー: " + error.message);
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
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> {editingOrder ? "受注内容の編集 / キャンセル" : "新規受注の登録 (複数入力可)"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <div className="space-y-4 bg-slate-50 p-6 rounded-lg border shadow-inner">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-xs font-bold mb-1 text-slate-700">受注日</label><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="bg-white text-sm" /></div>
                <div><label className="block text-xs font-bold mb-1 text-slate-700">発注番号 (任意)</label><Input value={formData.customerOrderNo} onChange={e => setFormData({ ...formData, customerOrderNo: e.target.value })} className="bg-white border-blue-300 text-sm" placeholder="FAX・注番" /></div>
                <div><label className="block text-xs font-bold mb-1 text-slate-700">出荷先名 <span className="text-red-500">*</span></label><Input list="customers-list" placeholder="検索..." value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })} className="bg-white border-blue-300 text-sm" /><datalist id="customers-list">{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</datalist></div>
              </div>

              {/* ★変更: 出荷予定日と着予定日を分ける */}
              <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded border border-blue-200">
                <div><label className="block text-xs font-bold mb-1 text-blue-800">工場からの出荷予定日 <span className="text-red-500">*</span></label><Input type="date" value={formData.plannedShipDate} onChange={e => setFormData({ ...formData, plannedShipDate: e.target.value })} className="bg-white border-blue-400 font-bold" /></div>
                <div><label className="block text-xs font-bold mb-1 text-slate-700">納品先への着予定日(納期) <span className="text-red-500">*</span></label><Input type="date" value={formData.shipDate} onChange={e => setFormData({ ...formData, shipDate: e.target.value })} className="bg-white border-slate-300" /></div>
              </div>

              <div className="bg-blue-50/50 p-4 -mx-2 rounded-md border border-blue-100 space-y-3">
                <label className="block text-sm font-bold text-blue-900 mb-2">注文製品と数量 (複数可) <span className="text-red-500">*</span></label>
                {formData.details.map((detail, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-end gap-2 bg-white p-2 rounded border shadow-sm relative">
                    <div className="w-full sm:flex-1"><label className="block text-xs font-bold mb-1 text-slate-500">1. 製品名</label><select className="w-full border-slate-200 rounded p-2 text-sm bg-white" value={detail.selectedName} onChange={e => updateDetail(idx, 'selectedName', e.target.value)}><option value="">選択</option>{Array.from(new Set(products.map(p => p.name))).map(name => <option key={name} value={name}>{name}</option>)}</select></div>
                    <div className="w-full sm:flex-1"><label className="block text-xs font-bold mb-1 text-slate-500">2. 種類(味)</label><select className="w-full border-slate-200 rounded p-2 text-sm bg-white disabled:bg-slate-50" value={detail.productId} onChange={e => updateDetail(idx, 'productId', e.target.value)} disabled={!detail.selectedName}><option value="">選択</option>{products.filter(p => p.name === detail.selectedName).map(p => <option key={p.id} value={p.id}>{p.variant_name}</option>)}</select></div>
                    <div className="w-full sm:w-28"><label className="block text-xs font-bold mb-1 text-slate-500">3. 数量(c/s)</label><Input type="number" min="0" value={detail.cs || ""} onChange={e => updateDetail(idx, 'cs', Number(e.target.value))} className="font-bold text-right h-9" /></div>
                    {!editingOrder && formData.details.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeDetailRow(idx)} className="h-9 w-9 text-red-500 hover:bg-red-50 absolute -right-2 -top-2 bg-white rounded-full border shadow-sm"><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
                {!editingOrder && (
                  <Button variant="outline" size="sm" onClick={addDetailRow} className="w-full mt-2 border-blue-300 text-blue-700 bg-white hover:bg-blue-50"><Plus className="w-4 h-4 mr-1" /> 製品を追加する</Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 h-full shadow-inner">
                <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-4 text-lg"><Calculator className="h-6 w-6" /> 合算 必要資材シミュレーション</h3>
                {Object.keys(simResult).length > 0 ? (
                  <div className="overflow-x-auto rounded-md border shadow-sm">
                    <Table className="bg-white">
                      <TableHeader className="bg-slate-100"><TableRow><TableHead className="font-bold text-slate-700">必要品目</TableHead><TableHead className="text-right font-bold text-slate-700">必要量</TableHead><TableHead className="text-right font-bold text-slate-700">現在庫</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {isSimulating ? (<TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500 font-bold"><Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" /> 計算中...</TableCell></TableRow>) : (
                          Object.values(simResult).map((item, idx) => (
                            <TableRow key={idx} className={item.isShort && item.required > 0 ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}>
                              <TableCell className="font-medium text-slate-800 text-sm py-3">{item.name}</TableCell>
                              <TableCell className="text-right font-black text-blue-600 text-base py-3">{item.required.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-500">{item.unit}</span></TableCell>
                              <TableCell className={`text-right font-bold text-base py-3 ${item.isShort && item.required > 0 ? "text-red-600" : "text-slate-700"}`}>{item.stock.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.isShort && item.required > 0 && <span className="ml-2 inline-block bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">不足!</span>}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (<div className="flex flex-col items-center justify-center h-[300px] text-slate-400 bg-white/50 rounded-lg border-dashed border-blue-200"><Calculator className="h-12 w-12 mb-4 opacity-50" /><p className="font-bold">製品と数量を入力してください</p></div>)}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 border-t pt-4 flex flex-col sm:flex-row gap-4 sm:justify-between">
            {editingOrder ? (
              <Button onClick={() => handleDeleteOrder(editingOrder.id, editingOrder.status)} disabled={isProcessing} variant="outline" className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 font-bold"><Trash2 className="h-4 w-4 mr-2" />キャンセル(削除)する</Button>
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
                <Button variant="ghost" size="icon" onClick={() => openModal(order)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="編集・キャンセル"><Edit className="h-4 w-4" /></Button>
              </div>
            )}

            <CardHeader className="pb-2 bg-slate-50 border-b rounded-t-lg">
              <div className="flex justify-between items-start pr-12">
                <div>
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                    {order.id.slice(-6)}
                    {order.customer_order_no && <Badge variant="outline" className="text-[10px] bg-white text-slate-500 py-0"><FileText className="w-3 h-3 mr-1" /> 発注: {order.customer_order_no}</Badge>}
                  </div>
                  <CardTitle className="text-lg text-slate-800 line-clamp-1" title={order.customers?.name}>{order.customers?.name}</CardTitle>
                </div>
              </div>
              <div className="mt-2">
                {order.status === 'received' && <Badge className="bg-amber-100 text-amber-800 border-none shadow-sm">出荷予定 (未処理)</Badge>}
                {order.status === 'in_production' && <Badge className="bg-blue-100 text-blue-800 border-none shadow-sm">製造中あり</Badge>}
                {order.status === 'shipped' && <Badge className="bg-green-100 text-green-800 border-none shadow-sm">出荷済</Badge>}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between"><span>製品:</span><span className="font-bold text-slate-800 text-right w-2/3 leading-tight">{order.products?.name}<br /><span className="text-xs font-normal text-slate-500">({order.products?.variant_name})</span></span></div>
              <div className="flex justify-between items-center pt-1"><span>数量:</span><span className="font-black text-xl text-blue-600">{order.quantity} <span className="text-sm font-normal text-slate-500">c/s</span></span></div>

              {/* ★変更: 出荷予定日と着予定日を両方表示 */}
              <div className="flex justify-between pt-3 border-t mt-3 text-xs text-slate-500"><span>出荷予定:</span><span className="font-bold text-blue-800">{new Date(order.planned_ship_date || order.desired_ship_date).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span>着予定(納期):</span><span className="font-bold text-slate-700">{new Date(order.desired_ship_date).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}