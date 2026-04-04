"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Calculator, Loader2, Save, Lock, Edit, Trash2, X, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = {
  id: string;
  order_date: string;
  desired_ship_date: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  status: string;
  customer_order_no?: string;
  customers?: { name: string };
  products?: { name: string; variant_name: string; unit_per_cs: number; unit_per_kg: number };
};

type Customer = { id: string; name: string };
type Product = { id: string; name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number };
type BomWithStock = {
  id: string;
  product_id: string;
  item_id: string;
  usage_rate: number;
  unit: string;
  basis_type: string;
  items: {
    name: string;
    item_type: string;
    item_stocks?: { quantity: number }[];
  };
};

export default function OrdersPage() {
  const { canEdit } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    shipDate: "",
    customerId: "",
    customerOrderNo: "",
    details: [{ productId: "", cs: 0, selectedProductName: "" }]
  });
  
  const [boms, setBoms] = useState<Record<string, BomWithStock[]>>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: oData } = await supabase.from("orders").select("*, customers(name), products(name, variant_name, unit_per_kg, unit_per_cs)").order("order_date", { ascending: false });
    const { data: cData } = await supabase.from("customers").select("id, name");
    const { data: pData } = await supabase.from("products").select("*");

    if (oData) setOrders(oData as any);
    if (cData) setCustomers(cData);
    if (pData) setProducts(pData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // BOMシミュレーション用のデータ取得
  useEffect(() => {
    const productIds = formData.details.map(d => d.productId).filter(Boolean);
    if (productIds.length === 0) { setBoms({}); return; }

    const fetchBoms = async () => {
      setIsSimulating(true);
      const { data } = await supabase
        .from("bom")
        .select(`*, items ( name, item_type, item_stocks ( quantity ) )`)
        .in("product_id", productIds);
      
      if (data) {
        const grouped: Record<string, BomWithStock[]> = {};
        (data as any).forEach((b: any) => {
          if (!grouped[b.product_id]) grouped[b.product_id] = [];
          grouped[b.product_id].push(b);
        });
        setBoms(grouped);
      }
      setIsSimulating(false);
    };
    fetchBoms();
  }, [JSON.stringify(formData.details.map(d => d.productId))]);

  const handleAddDetail = () => {
    setFormData({ ...formData, details: [...formData.details, { productId: "", cs: 0, selectedProductName: "" }] });
  };

  const handleRemoveDetail = (index: number) => {
    const newDetails = [...formData.details];
    newDetails.splice(index, 1);
    setFormData({ ...formData, details: newDetails });
  };

  const handleDetailChange = (index: number, field: string, value: any) => {
    const newDetails = [...formData.details] as any;
    newDetails[index][field] = value;
    if (field === 'selectedProductName') {
      newDetails[index].productId = ""; // 製品名を変えたら味(productId)はリセット
    }
    setFormData({ ...formData, details: newDetails });
  };

  const handleSaveOrder = async () => {
    const validDetails = formData.details.filter(d => d.productId && d.cs > 0);
    if (!formData.customerId || !formData.shipDate || validDetails.length === 0) {
      alert("必須項目をすべて入力してください。");
      return;
    }

    setIsProcessing(true);
    try {
      const dateStr = formData.date.replace(/-/g, "");
      const inserts = validDetails.map((detail, idx) => {
        const random3 = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        return {
          id: `ORD-${dateStr}-${random3}-${idx}`,
          order_date: formData.date,
          desired_ship_date: formData.shipDate,
          customer_id: formData.customerId,
          customer_order_no: formData.customerOrderNo,
          product_id: detail.productId,
          quantity: detail.cs,
          status: "received"
        };
      });

      const { error } = await supabase.from("orders").insert(inserts);
      if (error) throw error;

      setIsOpen(false);
      fetchData();
      alert("受注を登録しました。");
    } catch (err: any) {
      alert("エラー: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteOrder = async (orderId: string, status: string) => {
    if (status !== 'received' && status !== 'in_production') {
      alert("出荷済みの受注は削除できません。");
      return;
    }
    if (!confirm("この受注データを削除しますか？")) return;
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (!error) fetchData();
    else alert("エラー: " + error.message);
  };

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-800">
            <ShoppingCart className="h-7 w-7 text-blue-600" /> 受注管理
          </h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1"/> 閲覧モード</Badge>}
        </div>

        {canEdit && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 shadow-md shadow-blue-200">
                <Plus className="h-5 w-5 mr-2" /> 新規受注登録
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] lg:max-w-6xl bg-white max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-black flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-blue-600" /> 新規受注の登録</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                {/* 左側: 入力フォーム */}
                <div className="space-y-6">
                  <Card className="p-6 border-slate-200 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1 uppercase tracking-wider">受注日</label>
                        <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-white border-slate-200" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-blue-600 mb-1 uppercase tracking-wider">希望納期 *</label>
                        <Input type="date" value={formData.shipDate} onChange={e => setFormData({...formData, shipDate: e.target.value})} className="bg-white border-blue-200 shadow-sm shadow-blue-50 focus:border-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1 uppercase tracking-wider">出荷先 (顧客名) *</label>
                        <select className="w-full border-slate-200 rounded-md p-2 text-sm bg-white font-bold" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                          <option value="">顧客を選択...</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1 uppercase tracking-wider">顧客発注番号 (任意)</label>
                        <Input placeholder="PO-123456" value={formData.customerOrderNo} onChange={e => setFormData({...formData, customerOrderNo: e.target.value})} className="bg-white border-slate-200" />
                      </div>
                    </div>
                  </Card>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="font-black text-slate-700 uppercase tracking-tighter">受注明細</h3>
                      <Button variant="outline" size="sm" onClick={handleAddDetail} className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 font-bold"><Plus className="w-4 h-4 mr-1" /> 行を追加</Button>
                    </div>
                    
                    {formData.details.map((detail, idx) => (
                      <Card key={idx} className="p-4 border-slate-200 shadow-sm relative overflow-visible">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          <div className="md:col-span-5">
                            <label className="block text-[10px] font-black text-slate-400 mb-0.5">製品名</label>
                            <select 
                              className="w-full border-slate-200 rounded-md p-2 text-sm bg-white font-bold" 
                              value={detail.selectedProductName} 
                              onChange={e => handleDetailChange(idx, 'selectedProductName', e.target.value)}
                            >
                              <option value="">製品を選択...</option>
                              {Array.from(new Set(products.map(p => p.name))).map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-4">
                            <label className="block text-[10px] font-black text-slate-400 mb-0.5">味 (バリエーション)</label>
                            <select 
                              className="w-full border-slate-200 rounded-md p-2 text-sm bg-white disabled:bg-slate-50 font-bold" 
                              value={detail.productId} 
                              onChange={e => handleDetailChange(idx, 'productId', e.target.value)}
                              disabled={!detail.selectedProductName}
                            >
                              <option value="">{detail.selectedProductName ? "味を選択..." : "←先に製品名"}</option>
                              {products.filter(p => p.name === detail.selectedProductName).map(p => <option key={p.id} value={p.id}>{p.variant_name}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 mb-0.5">数量 (c/s)</label>
                            <Input type="number" min="1" value={detail.cs || ""} onChange={e => handleDetailChange(idx, 'cs', Number(e.target.value))} className="text-right font-black border-slate-200 md:text-lg" />
                          </div>
                          <div className="md:col-span-1 flex justify-center pb-1">
                            {formData.details.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveDetail(idx)} className="text-slate-300 hover:text-red-500 rounded-full h-8 w-8 p-0"><X className="w-4 h-4" /></Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* 右側: BOMシミュレーション */}
                <div className="space-y-4">
                  <div className="bg-blue-50/50 border-2 border-blue-100 rounded-2xl p-6 h-full flex flex-col min-h-[400px]">
                    <h3 className="font-black text-blue-900 flex items-center gap-2 mb-6 text-lg tracking-tight">
                      <Calculator className="h-6 w-6 text-blue-600" /> 出荷必要資材の事前シミュレーション
                    </h3>
                    
                    {formData.details.some(d => d.productId) ? (
                      <div className="flex-1 overflow-y-auto pr-1">
                        {isSimulating ? (
                          <div className="flex flex-col items-center justify-center h-48 text-slate-400 font-bold"><Loader2 className="animate-spin h-10 w-10 mb-4" /> 計算中...</div>
                        ) : (
                          <div className="space-y-6">
                            {/* 合計計算 */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                                <span className="block text-[10px] font-black text-slate-400 mb-1">合計製品数</span>
                                <span className="text-2xl font-black text-slate-800">{formData.details.reduce((sum, d) => sum + (d.cs || 0), 0)} <span className="text-xs font-normal text-slate-500">c/s</span></span>
                              </div>
                              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                                <span className="block text-[10px] font-black text-slate-400 mb-1">総品目数</span>
                                <span className="text-2xl font-black text-slate-800">{formData.details.filter(d => d.productId).length} <span className="text-xs font-normal text-slate-500">種類</span></span>
                              </div>
                            </div>

                            <Table className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
                              <TableHeader className="bg-slate-50">
                                <TableRow><TableHead className="font-black h-10 py-1">必要品目</TableHead><TableHead className="text-right font-black h-10 py-1">合計必要量</TableHead><TableHead className="text-right font-black h-10 py-1">現在庫</TableHead></TableRow>
                              </TableHeader>
                              <TableBody>
                                {(() => {
                                  // 重複資材を合算
                                  const totals: Record<string, { name: string, required: number, unit: string, stock: number }> = {};
                                  formData.details.forEach(detail => {
                                    const detailBoms = boms[detail.productId] || [];
                                    const product = products.find(p => p.id === detail.productId);
                                    const unitPerCs = product?.unit_per_cs || 1;
                                    const unitPerKg = product?.unit_per_kg || 1;

                                    detailBoms.forEach(bom => {
                                      const required = bom.basis_type === 'production_qty' 
                                        ? (detail.cs * unitPerCs / unitPerKg) * bom.usage_rate 
                                        : detail.cs * bom.usage_rate;
                                      
                                      if (!totals[bom.item_id]) {
                                        totals[bom.item_id] = { 
                                          name: bom.items.name, 
                                          required: 0, 
                                          unit: bom.unit, 
                                          stock: bom.items.item_stocks?.[0]?.quantity || 0 
                                        };
                                      }
                                      totals[bom.item_id].required += required;
                                    });
                                  });

                                  return Object.values(totals).map((t, i) => {
                                    const isShort = t.stock < t.required;
                                    return (
                                      <TableRow key={i} className={isShort ? "bg-red-50" : ""}>
                                        <TableCell className="font-bold py-3 text-slate-700">{t.name}</TableCell>
                                        <TableCell className="text-right font-black text-blue-600 py-3">{t.required.toLocaleString(undefined, {maximumFractionDigits:1})} <span className="text-[10px] font-normal text-slate-400">{t.unit}</span></TableCell>
                                        <TableCell className={`text-right font-bold py-3 ${isShort ? "text-red-500" : "text-slate-600"}`}>
                                          {t.stock.toLocaleString(undefined, {maximumFractionDigits:1})}
                                          {isShort && <div className="text-[9px] font-black text-red-600 tracking-tighter">不足</div>}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  });
                                })()}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-40 grayscale"><Calculator className="h-16 w-16 mb-4 text-blue-300" /><p className="font-black text-slate-400 text-lg">製品を選択すると<br/>必要資材が計算されます</p></div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t sticky bottom-0 bg-white z-10">
                <Button variant="outline" onClick={() => setIsOpen(false)} className="h-12 px-6 font-bold text-slate-500">キャンセル</Button>
                <Button onClick={handleSaveOrder} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white px-10 font-black h-12 shadow-lg shadow-blue-100 flex items-center gap-2">
                  {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="h-5 w-5" />} 受注を全登録する
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {orders.map((order) => (
          <Card key={order.id} className="group hover:shadow-xl hover:shadow-slate-200 transition-all border-slate-200 overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/80 border-b group-hover:bg-blue-50/30 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">{order.id}</div>
                  <CardTitle className="text-lg font-black text-slate-800 leading-tight group-hover:text-blue-700">{order.customers?.name}</CardTitle>
                  {order.customer_order_no && <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1"><FileText className="w-3 h-3" /> PO: {order.customer_order_no}</div>}
                </div>
                {order.status === 'received' && <Badge className="bg-amber-100 text-amber-800 border-none shadow-sm shadow-amber-50 font-black">未着手</Badge>}
                {order.status === 'in_production' && <Badge className="bg-blue-600 text-white border-none shadow-sm shadow-blue-100 font-black">製造中</Badge>}
                {order.status === 'shipped' && <Badge className="bg-slate-200 text-slate-500 border-none font-black grayscale">出荷済</Badge>}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-sm">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 font-bold whitespace-nowrap">製品:</span>
                <span className="font-black text-slate-800 text-right leading-tight wrap-break-word">{order.products?.name} <span className="text-[11px] font-bold text-slate-500 block">({order.products?.variant_name})</span></span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-bold">数量:</span>
                <span className="font-black text-2xl text-blue-600 italic">{order.quantity} <span className="text-xs font-normal text-slate-400 not-italic ml-0.5">c/s</span></span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-100 mt-2">
                <span className="text-slate-400 font-bold">納期予定日:</span>
                <span className="font-black text-slate-800 text-base">{new Date(order.desired_ship_date).toLocaleDateString()}</span>
              </div>
              
              {canEdit && (
                <div className="pt-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteOrder(order.id, order.status)} className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {loading && orders.length===0 ? (
          <div className="col-span-full text-center py-24"><Loader2 className="animate-spin w-10 h-10 text-blue-200 mx-auto"/></div>
        ) : orders.length===0 && (
          <div className="col-span-full text-center py-24 text-slate-400 bg-white border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center">
            <ShoppingCart className="w-12 h-12 mb-4 opacity-10" />
            <p className="font-black text-lg">受注データが見つかりませんでした</p>
          </div>
        )}
      </div>
    </div>
  );
}