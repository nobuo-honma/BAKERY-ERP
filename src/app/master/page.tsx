"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Database, Edit2, Loader2, Save, Lock, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// --- 型定義 ---
type Product = { id: string; name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number; };
type Item = { id: string; name: string; item_type: string; unit_size: number; unit: string; safety_stock: number; };
type Bom = { id: string; product_id: string; item_id: string; usage_rate: number; unit: string; basis_type: string; products?: { name: string; variant_name: string }; items?: { name: string }; };
type Customer = { id: string; name: string; contact_name: string; postal_code: string; address: string; phone: string; fax: string; notes: string; };

// --- インライン編集用コンポーネント ---
function EditableCell({ value, onSave, type = "text", placeholder = "", alignRight = false }: { value: any, onSave: (val: any) => void, type?: "text" | "number", placeholder?: string, alignRight?: boolean }) {
  const { canEdit } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value || "");

  const handleSave = () => {
    setIsEditing(false);
    if (String(val) !== String(value || "")) onSave(type === "number" ? Number(val) : val);
  };

  const isRightAligned = type === "number" || alignRight;

  if (isEditing && canEdit) {
    return (
      <Input type={type} value={val} onChange={(e) => setVal(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setIsEditing(false); setVal(value || ""); } }} placeholder={placeholder} autoFocus className={`h-8 py-1 px-2 text-sm border-blue-400 bg-blue-50 focus-visible:ring-blue-400 w-full ${isRightAligned ? "text-right" : "text-left"}`} />
    );
  }

  return (
    <div onClick={() => canEdit && setIsEditing(true)} className={`${canEdit ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'} p-1.5 -m-1.5 rounded flex items-center group min-h-[28px] transition-colors w-full ${isRightAligned ? "justify-end" : "justify-between"}`} title={canEdit ? "クリックして編集" : "閲覧モードのため編集できません"}>
      {isRightAligned && canEdit && <Edit2 className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity mr-2 shrink-0" />}
      <span className={`truncate block ${!value ? "text-slate-300" : ""}`}>{value || placeholder}</span>
      {!isRightAligned && canEdit && <Edit2 className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />}
    </div>
  );
}

// --- メイン画面 ---
export default function MasterPage() {
  const { canEdit } = useAuth();
  const [activeTab, setActiveTab] = useState("products");

  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState("");

  // 新規登録モーダル用State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 各マスタの新規登録フォームState
  const [newProduct, setNewProduct] = useState({ id: "", name: "", variant_name: "", unit_per_kg: 10, unit_per_cs: 24 });
  const [newItem, setNewItem] = useState({ id: "", name: "", item_type: "raw_material", unit_size: 1, unit: "kg", safety_stock: 0 });
  const [newBom, setNewBom] = useState({ product_id: "", item_id: "", usage_rate: 0, unit: "kg", basis_type: "production_qty" });
  const [newCustomer, setNewCustomer] = useState({ id: "", name: "", contact_name: "", postal_code: "", address: "", phone: "", fax: "", notes: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: pData } = await supabase.from("products").select("*").order("created_at", { ascending: true });
    const { data: iData } = await supabase.from("items").select("*").order("created_at", { ascending: true });
    const { data: bData } = await supabase.from("bom").select(`*, products ( name, variant_name ), items ( name )`).order("created_at", { ascending: true });
    const { data: cData } = await supabase.from("customers").select("*").order("id", { ascending: true });

    if (pData) setProducts(pData);
    if (iData) setItems(iData);
    if (bData) setBoms(bData);
    if (cData) setCustomers(cData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // インライン編集用
  const handleUpdate = async (table: string, id: string, column: string, newValue: any) => {
    setSavingMsg("保存中...");
    const { error } = await supabase.from(table).update({ [column]: newValue }).eq('id', id);
    if (error) alert("更新に失敗しました: " + error.message);
    else {
      if (table === "products") setProducts(products.map(p => p.id === id ? { ...p, [column]: newValue } : p));
      else if (table === "items") setItems(items.map(i => i.id === id ? { ...i, [column]: newValue } : i));
      else if (table === "bom") setBoms(boms.map(b => b.id === id ? { ...b, [column]: newValue } : b));
      else if (table === "customers") setCustomers(customers.map(c => c.id === id ? { ...c, [column]: newValue } : c));
    }
    setTimeout(() => setSavingMsg(""), 1000);
  };

  // 新規登録処理
  const handleCreate = async () => {
    setIsProcessing(true);
    try {
      if (activeTab === "products") {
        if (!newProduct.id || !newProduct.name || !newProduct.variant_name) throw new Error("ID, 製品名, 種類(味) は必須です。");
        const { error } = await supabase.from("products").insert(newProduct);
        if (error) throw error;
      } else if (activeTab === "items") {
        if (!newItem.id || !newItem.name || !newItem.unit) throw new Error("ID, 品目名, 単位 は必須です。");
        const { error } = await supabase.from("items").insert(newItem);
        if (error) throw error;
      } else if (activeTab === "bom") {
        if (!newBom.product_id || !newBom.item_id || newBom.usage_rate <= 0) throw new Error("製品, 構成品目, 使用率 は正しく入力してください。");
        const { error } = await supabase.from("bom").insert(newBom);
        if (error) throw error;
      } else if (activeTab === "customers") {
        if (!newCustomer.id || !newCustomer.name) throw new Error("ID, 出荷先名 は必須です。");
        const { error } = await supabase.from("customers").insert(newCustomer);
        if (error) throw error;
      }

      alert("新規データを登録しました！");
      setIsAddModalOpen(false);

      // フォームリセット
      setNewProduct({ id: "", name: "", variant_name: "", unit_per_kg: 10, unit_per_cs: 24 });
      setNewItem({ id: "", name: "", item_type: "raw_material", unit_size: 1, unit: "kg", safety_stock: 0 });
      setNewBom({ product_id: "", item_id: "", usage_rate: 0, unit: "kg", basis_type: "production_qty" });
      setNewCustomer({ id: "", name: "", contact_name: "", postal_code: "", address: "", phone: "", fax: "", notes: "" });

      fetchData(); // 最新データを再取得
    } catch (err: any) {
      alert("登録エラー: " + err.message);
    }
    setIsProcessing(false);
  };

  if (loading) return <div className="flex justify-center items-center h-64 text-slate-500"><Loader2 className="animate-spin h-8 w-8 mr-2" /> データを読み込み中...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Database className="h-6 w-6 text-blue-600" /> マスタ管理</h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 text-sm font-bold flex items-center gap-1 shadow-sm"><Lock className="w-3 h-3" /> 閲覧モード</Badge>}
          {savingMsg && <div className="flex items-center text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full text-sm shadow-sm"><Save className="h-4 w-4 mr-1" /> {savingMsg}</div>}
        </div>

        {/* ★権限ロック: 管理者のみ新規登録ボタンを表示 */}
        {canEdit && (
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm w-full md:w-auto">
            <Plus className="w-4 h-4 mr-2" /> 新規データ登録
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 bg-slate-100 flex flex-wrap h-auto">
          <TabsTrigger value="products" className="font-bold py-2">製品マスタ</TabsTrigger>
          <TabsTrigger value="items" className="font-bold py-2">品目マスタ</TabsTrigger>
          <TabsTrigger value="bom" className="font-bold py-2">BOM (部品表)</TabsTrigger>
          <TabsTrigger value="customers" className="font-bold py-2 text-blue-700">出荷先マスタ</TabsTrigger>
        </TabsList>

        {/* --- 製品マスタ --- */}
        <TabsContent value="products">
          <div className="border rounded-md overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed min-w-[700px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[10%] pl-4">製品ID</TableHead>
                  <TableHead className="w-[30%]">製品名</TableHead>
                  <TableHead className="w-[30%]">種類(味)</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">1kgあたり個数</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">1c/sあたり入数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-blue-600 truncate pl-4">{product.id}</TableCell>
                    <TableCell><EditableCell value={product.name} onSave={(val) => handleUpdate("products", product.id, "name", val)} /></TableCell>
                    <TableCell><EditableCell value={product.variant_name} onSave={(val) => handleUpdate("products", product.id, "variant_name", val)} /></TableCell>
                    <TableCell className="text-right pr-4"><EditableCell type="number" value={product.unit_per_kg} onSave={(val) => handleUpdate("products", product.id, "unit_per_kg", val)} /></TableCell>
                    <TableCell className="text-right pr-4"><EditableCell type="number" value={product.unit_per_cs} onSave={(val) => handleUpdate("products", product.id, "unit_per_cs", val)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* --- 品目マスタ --- */}
        <TabsContent value="items">
          <div className="border rounded-md overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed min-w-[700px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[15%] pl-4">品目ID</TableHead>
                  <TableHead className="w-[30%]">品目名</TableHead>
                  <TableHead className="w-[15%]">区分</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">規格量</TableHead>
                  <TableHead className="w-[10%] pl-4">単位</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">安全在庫</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-blue-600 truncate pl-4">{item.id}</TableCell>
                    <TableCell><EditableCell value={item.name} onSave={(val) => handleUpdate("items", item.id, "name", val)} /></TableCell>
                    <TableCell>
                      {canEdit ? (
                        <select value={item.item_type} onChange={(e) => handleUpdate("items", item.id, "item_type", e.target.value)} className="bg-transparent border-none text-sm w-full cursor-pointer focus:ring-0">
                          <option value="raw_material">原材料</option><option value="material">資材</option>
                        </select>
                      ) : (
                        <span className="text-sm">{item.item_type === 'raw_material' ? '原材料' : '資材'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4"><EditableCell type="number" value={item.unit_size} onSave={(val) => handleUpdate("items", item.id, "unit_size", val)} /></TableCell>
                    <TableCell className="pl-4"><EditableCell value={item.unit} alignRight={false} onSave={(val) => handleUpdate("items", item.id, "unit", val)} /></TableCell>
                    <TableCell className="text-right pr-4 text-red-600 font-bold"><EditableCell type="number" value={item.safety_stock} onSave={(val) => handleUpdate("items", item.id, "safety_stock", val)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* --- BOM (部品表) --- */}
        <TabsContent value="bom">
          <div className="border rounded-md overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed min-w-[800px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[25%] pl-4">対象製品</TableHead>
                  <TableHead className="w-[25%]">構成品目 (原料/資材)</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">使用率</TableHead>
                  <TableHead className="w-[10%] pl-4">単位</TableHead>
                  <TableHead className="w-[25%]">計算基準</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boms.map((bom) => (
                  <TableRow key={bom.id} className="hover:bg-slate-50">
                    <TableCell className="truncate pl-4">
                      <div className="font-bold text-blue-900">{bom.product_id}</div>
                      <div className="text-xs text-slate-500 truncate" title={`${bom.products?.name} (${bom.products?.variant_name})`}>{bom.products?.name} ({bom.products?.variant_name})</div>
                    </TableCell>
                    <TableCell className="truncate">
                      <div className="font-bold text-slate-700">{bom.item_id}</div>
                      <div className="text-xs text-slate-500 truncate" title={bom.items?.name}>{bom.items?.name}</div>
                    </TableCell>
                    <TableCell className="text-right pr-4"><EditableCell type="number" value={bom.usage_rate} onSave={(val) => handleUpdate("bom", bom.id, "usage_rate", val)} /></TableCell>
                    <TableCell className="pl-4"><EditableCell value={bom.unit} alignRight={false} onSave={(val) => handleUpdate("bom", bom.id, "unit", val)} /></TableCell>
                    <TableCell>
                      {canEdit ? (
                        <select value={bom.basis_type} onChange={(e) => handleUpdate("bom", bom.id, "basis_type", e.target.value)} className="bg-transparent border-none text-sm w-full cursor-pointer focus:ring-0">
                          <option value="production_qty">製造量(kg) 基準</option><option value="order_qty">製造数(c/s) 基準</option>
                        </select>
                      ) : (
                        <span className="text-sm">{bom.basis_type === 'production_qty' ? '製造量(kg) 基準' : '製造数(c/s) 基準'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* --- 出荷先マスタ --- */}
        <TabsContent value="customers">
          <div className="border rounded-md overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed min-w-[1200px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[100px] pl-4">出荷先ID</TableHead>
                  <TableHead className="w-[250px]">出荷先名</TableHead>
                  <TableHead className="w-[150px]">担当者名</TableHead>
                  <TableHead className="w-[120px]">郵便番号</TableHead>
                  <TableHead className="w-[250px]">住所</TableHead>
                  <TableHead className="w-[150px]">電話番号</TableHead>
                  <TableHead className="w-[150px]">FAX</TableHead>
                  <TableHead className="w-[200px]">備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-blue-600 truncate pl-4" title={customer.id}>{customer.id}</TableCell>
                    <TableCell className="font-bold"><EditableCell value={customer.name} onSave={(val) => handleUpdate("customers", customer.id, "name", val)} /></TableCell>
                    <TableCell><EditableCell value={customer.contact_name} placeholder="- 空白 -" onSave={(val) => handleUpdate("customers", customer.id, "contact_name", val)} /></TableCell>
                    <TableCell><EditableCell value={customer.postal_code} placeholder="- 空白 -" onSave={(val) => handleUpdate("customers", customer.id, "postal_code", val)} /></TableCell>
                    <TableCell><EditableCell value={customer.address} placeholder="- 空白 -" onSave={(val) => handleUpdate("customers", customer.id, "address", val)} /></TableCell>
                    <TableCell><EditableCell value={customer.phone} placeholder="- 空白 -" onSave={(val) => handleUpdate("customers", customer.id, "phone", val)} /></TableCell>
                    <TableCell><EditableCell value={customer.fax} placeholder="- 空白 -" onSave={(val) => handleUpdate("customers", customer.id, "fax", val)} /></TableCell>
                    <TableCell><EditableCell value={customer.notes} placeholder="- 空白 -" onSave={(val) => handleUpdate("customers", customer.id, "notes", val)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* --- 新規登録用モーダル --- */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Plus className="h-5 w-5 text-blue-600" />
              {activeTab === "products" && "新規製品の登録"}
              {activeTab === "items" && "新規品目(原料・資材)の登録"}
              {activeTab === "bom" && "新規BOM(部品表)の登録"}
              {activeTab === "customers" && "新規出荷先の登録"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 製品マスタ用フォーム */}
            {activeTab === "products" && (
              <>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">製品ID (例: C3)</label><Input value={newProduct.id} onChange={e => setNewProduct({ ...newProduct, id: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">製品名 (例: キュウメイパン)</label><Input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">種類・味 (例: チョコチップ)</label><Input value={newProduct.variant_name} onChange={e => setNewProduct({ ...newProduct, variant_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">1kgあたり個数</label><Input type="number" value={newProduct.unit_per_kg} onChange={e => setNewProduct({ ...newProduct, unit_per_kg: Number(e.target.value) })} className="text-right font-bold" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">1c/sあたり入数</label><Input type="number" value={newProduct.unit_per_cs} onChange={e => setNewProduct({ ...newProduct, unit_per_cs: Number(e.target.value) })} className="text-right font-bold" /></div>
                </div>
              </>
            )}

            {/* 品目マスタ用フォーム */}
            {activeTab === "items" && (
              <>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">品目ID (例: R030, M100)</label><Input value={newItem.id} onChange={e => setNewItem({ ...newItem, id: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">品目名 (例: 上白糖)</label><Input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">区分</label>
                    <select value={newItem.item_type} onChange={e => setNewItem({ ...newItem, item_type: e.target.value })} className="w-full border rounded-md p-2 text-sm bg-white"><option value="raw_material">原材料</option><option value="material">資材</option></select>
                  </div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">安全在庫</label><Input type="number" value={newItem.safety_stock} onChange={e => setNewItem({ ...newItem, safety_stock: Number(e.target.value) })} className="text-right" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">規格量</label><Input type="number" value={newItem.unit_size} onChange={e => setNewItem({ ...newItem, unit_size: Number(e.target.value) })} className="text-right" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">単位 (kg, 個, 枚など)</label><Input value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} /></div>
                </div>
              </>
            )}

            {/* BOM用フォーム */}
            {activeTab === "bom" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">対象の製品</label>
                  <select value={newBom.product_id} onChange={e => setNewBom({ ...newBom, product_id: e.target.value })} className="w-full border rounded-md p-2 text-sm bg-white">
                    <option value="">製品を選択</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.id}: {p.name} ({p.variant_name})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">構成品目 (使う原料・資材)</label>
                  <select value={newBom.item_id} onChange={e => {
                    const selItem = items.find(i => i.id === e.target.value);
                    // 品目が選ばれたら、単位と計算基準の初期値を自動でセットする親切設計
                    setNewBom({ ...newBom, item_id: e.target.value, unit: selItem?.unit || "kg", basis_type: selItem?.item_type === 'raw_material' ? 'production_qty' : 'order_qty' });
                  }} className="w-full border rounded-md p-2 text-sm bg-white">
                    <option value="">品目を選択</option>
                    <optgroup label="原材料">{items.filter(i => i.item_type === 'raw_material').map(i => <option key={i.id} value={i.id}>{i.id}: {i.name}</option>)}</optgroup>
                    <optgroup label="資材">{items.filter(i => i.item_type === 'material').map(i => <option key={i.id} value={i.id}>{i.id}: {i.name}</option>)}</optgroup>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">使用率 (ロス率込)</label><Input type="number" step="0.01" value={newBom.usage_rate} onChange={e => setNewBom({ ...newBom, usage_rate: Number(e.target.value) })} className="text-right font-bold text-blue-700" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">単位</label><Input value={newBom.unit} onChange={e => setNewBom({ ...newBom, unit: e.target.value })} /></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">計算基準</label>
                  <select value={newBom.basis_type} onChange={e => setNewBom({ ...newBom, basis_type: e.target.value })} className="w-full border rounded-md p-2 text-sm bg-white font-bold text-slate-700">
                    <option value="production_qty">製造量(kg) ベースで計算する</option>
                    <option value="order_qty">製造数(c/s) ベースで計算する</option>
                  </select>
                </div>
              </>
            )}

            {/* 出荷先用フォーム */}
            {activeTab === "customers" && (
              <>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">出荷先ID (例: N050)</label><Input value={newCustomer.id} onChange={e => setNewCustomer({ ...newCustomer, id: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">出荷先・会社名</label><Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">担当者名</label><Input value={newCustomer.contact_name} onChange={e => setNewCustomer({ ...newCustomer, contact_name: e.target.value })} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">電話番号</label><Input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">住所</label><Input value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} /></div>
              </>
            )}
          </div>

          <DialogFooter className="mt-6 border-t pt-4 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1 sm:flex-none">キャンセル</Button>
            <Button onClick={handleCreate} disabled={isProcessing} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 登録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}