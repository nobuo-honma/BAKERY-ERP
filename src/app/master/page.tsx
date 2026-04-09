"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // ★これを追加しました！
import { Database, Edit2, Loader2, Save, Lock, Plus, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Product = { id: string; name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number; };
type Item = { id: string; name: string; item_type: string; unit_size: number; unit: string; unit_price: number; safety_stock: number; };
type Bom = { id: string; product_id: string; item_id: string; usage_rate: number; unit: string; basis_type: string; products?: { name: string; variant_name: string }; items?: { name: string }; };
type Customer = { id: string; name: string; contact_name: string; postal_code: string; address: string; phone: string; fax: string; notes: string; };

function EditableCell({ value, onSave, type = "text", placeholder = "", alignRight = false }: { value: any, onSave: (val: any) => void, type?: "text" | "number", placeholder?: string, alignRight?: boolean }) {
  const { canEdit } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value || "");

  const handleSave = () => {
    setIsEditing(false);
    if (String(val) !== String(value || "")) {
      onSave(type === "number" ? Number(val) : val);
    }
  };

  const isRightAligned = type === "number" || alignRight;

  if (isEditing && canEdit) {
    return (
      <Input
        type={type} value={val} onChange={(e) => setVal(e.target.value)} onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') { setIsEditing(false); setVal(value || ""); }
        }}
        placeholder={placeholder} autoFocus
        className={`h-8 py-1 px-2 text-sm border-blue-400 bg-blue-50 focus-visible:ring-blue-400 w-full ${isRightAligned ? "text-right" : "text-left"}`}
      />
    );
  }

  return (
    <div
      onClick={() => canEdit && setIsEditing(true)}
      className={`${canEdit ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'} p-1.5 -m-1.5 rounded flex items-center group min-h-[28px] transition-colors w-full ${isRightAligned ? "justify-end" : "justify-between"}`}
      title={canEdit ? "クリックして編集" : "閲覧モードのため編集できません"}
    >
      {isRightAligned && canEdit && <Edit2 className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity mr-2 shrink-0" />}
      <span className={`truncate block ${!value ? "text-slate-300" : ""}`}>{value || placeholder}</span>
      {!isRightAligned && canEdit && <Edit2 className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />}
    </div>
  );
}

export default function MasterPage() {
  const { canEdit } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newData, setNewData] = useState<any>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
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
  };

  const handleUpdate = async (table: string, id: string, column: string, newValue: any) => {
    setSavingMsg("保存中...");
    const { error } = await supabase.from(table).update({ [column]: newValue }).eq('id', id);
    if (error) {
      alert("更新に失敗しました: " + error.message);
    } else {
      if (table === "products") setProducts(products.map(p => p.id === id ? { ...p, [column]: newValue } : p));
      else if (table === "items") setItems(items.map(i => i.id === id ? { ...i, [column]: newValue } : i));
      else if (table === "bom") setBoms(boms.map(b => b.id === id ? { ...b, [column]: newValue } : b));
      else if (table === "customers") setCustomers(customers.map(c => c.id === id ? { ...c, [column]: newValue } : c));
    }
    setTimeout(() => setSavingMsg(""), 1000);
  };

  const openAddModal = () => {
    setNewData({});
    setIsAddModalOpen(true);
  };

  const handleSaveNewData = async () => {
    setIsProcessing(true);
    try {
      let tableName = "";
      let insertData = { ...newData };

      if (currentTab === "products") {
        tableName = "products";
        if (!insertData.id || !insertData.name) throw new Error("製品IDと製品名は必須です。");
      } else if (currentTab === "items") {
        tableName = "items";
        if (!insertData.id || !insertData.name) throw new Error("品目IDと品目名は必須です。");
      } else if (currentTab === "bom") {
        tableName = "bom";
        if (!insertData.product_id || !insertData.item_id) throw new Error("対象製品と構成品目は必須です。");
      } else if (currentTab === "customers") {
        tableName = "customers";
        if (!insertData.id || !insertData.name) throw new Error("出荷先IDと出荷先名は必須です。");
      }

      const { error } = await supabase.from(tableName).insert([insertData]);
      if (error) throw error;

      alert("新規データを登録しました！");
      setIsAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("登録エラー: " + err.message);
    }
    setIsProcessing(false);
  };

  if (loading) return <div className="flex justify-center items-center h-64 text-slate-500"><Loader2 className="animate-spin h-8 w-8 mr-2" /> データを読み込み中...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <Database className="h-6 w-6 text-blue-600" />
            マスタ管理
          </h1>
          {!canEdit && (
            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex">
              <Lock className="w-3 h-3 mr-1" /> 閲覧モード
            </Badge>
          )}
          {savingMsg && <div className="flex items-center text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full text-sm shadow-sm transition-all"><Save className="h-4 w-4 mr-1" /> {savingMsg}</div>}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> 新規データ登録
            </Button>
          )}
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="mb-6 bg-slate-100 flex flex-wrap h-auto">
          <TabsTrigger value="products" className="font-bold py-2">製品マスタ</TabsTrigger>
          <TabsTrigger value="items" className="font-bold py-2">品目マスタ</TabsTrigger>
          <TabsTrigger value="bom" className="font-bold py-2">BOM (部品表)</TabsTrigger>
          <TabsTrigger value="customers" className="font-bold py-2 text-blue-700">出荷先マスタ</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="border rounded-md overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed min-w-[700px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[10%]">製品 ID</TableHead>
                  <TableHead className="w-[30%]">製品名</TableHead>
                  <TableHead className="w-[30%]">種類(味)</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">1kg あたり個数</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">1c/s あたり入数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-blue-600 truncate">{product.id}</TableCell>
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

        <TabsContent value="items">
          <div className="border rounded-md overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed min-w-[800px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[15%] pl-4">品目 ID</TableHead>
                  <TableHead className="w-[25%]">品目名</TableHead>
                  <TableHead className="w-[10%]">区分</TableHead>
                  <TableHead className="w-[10%] text-right pr-4">規格量</TableHead>
                  <TableHead className="w-[10%] pl-4">単位</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">単価(円)</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">安全在庫</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-blue-600 truncate pl-4">{item.id}</TableCell>
                    <TableCell><EditableCell value={item.name} onSave={(val) => handleUpdate("items", item.id, "name", val)} /></TableCell>
                    <TableCell><EditableCell value={item.item_type} onSave={(val) => handleUpdate("items", item.id, "item_type", val)} /></TableCell>
                    <TableCell className="text-right pr-4"><EditableCell type="number" value={item.unit_size} onSave={(val) => handleUpdate("items", item.id, "unit_size", val)} /></TableCell>
                    <TableCell className="pl-4"><EditableCell value={item.unit} alignRight={false} onSave={(val) => handleUpdate("items", item.id, "unit", val)} /></TableCell>
                    <TableCell className="text-right pr-4"><EditableCell type="number" value={item.unit_price} onSave={(val) => handleUpdate("items", item.id, "unit_price", val)} /></TableCell>
                    <TableCell className="text-right pr-4 text-red-600 font-bold"><EditableCell type="number" value={item.safety_stock} onSave={(val) => handleUpdate("items", item.id, "safety_stock", val)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

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
                    <TableCell><EditableCell value={bom.basis_type} onSave={(val) => handleUpdate("bom", bom.id, "basis_type", val)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="customers">
          <div className="border rounded-md overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed min-w-[1200px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[100px] pl-4">出荷先 ID</TableHead>
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
                {customers.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-12">出荷先データがありません。SQLでデータを登録してください。</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* =======================================================================
          新規登録モーダル (タブに応じて入力フォームが変わる)
          ======================================================================= */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-[95vw] max-w-md bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <FileText className="w-5 h-5 text-blue-600" />
              {currentTab === "products" && "製品マスタ 新規登録"}
              {currentTab === "items" && "品目マスタ 新規登録"}
              {currentTab === "bom" && "BOM (部品表) 新規登録"}
              {currentTab === "customers" && "出荷先マスタ 新規登録"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 製品マスタ用のフォーム */}
            {currentTab === "products" && (
              <>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">製品 ID <span className="text-red-500">*</span></label><Input value={newData.id || ""} onChange={e => setNewData({ ...newData, id: e.target.value })} placeholder="例: SB" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">製品名 <span className="text-red-500">*</span></label><Input value={newData.name || ""} onChange={e => setNewData({ ...newData, name: e.target.value })} placeholder="例: キュウメイパン" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">種類 (味) <span className="text-red-500">*</span></label><Input value={newData.variant_name || ""} onChange={e => setNewData({ ...newData, variant_name: e.target.value })} placeholder="例: チョコチップ" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">1kg あたり個数</label><Input type="number" value={newData.unit_per_kg || ""} onChange={e => setNewData({ ...newData, unit_per_kg: Number(e.target.value) })} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">1c/s あたり入数</label><Input type="number" value={newData.unit_per_cs || ""} onChange={e => setNewData({ ...newData, unit_per_cs: Number(e.target.value) })} /></div>
                </div>
              </>
            )}

            {/* 品目マスタ用のフォーム */}
            {currentTab === "items" && (
              <>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">品目 ID <span className="text-red-500">*</span></label><Input value={newData.id || ""} onChange={e => setNewData({ ...newData, id: e.target.value })} placeholder="例: ITEM-001" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">品目名 <span className="text-red-500">*</span></label><Input value={newData.name || ""} onChange={e => setNewData({ ...newData, name: e.target.value })} placeholder="例: 小麦粉" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">区分 <span className="text-red-500">*</span></label>
                  <select value={newData.item_type || ""} onChange={e => setNewData({ ...newData, item_type: e.target.value })} className="w-full border-slate-200 rounded p-2 text-sm bg-white">
                    <option value="">選択してください</option>
                    <option value="raw_material">原材料</option>
                    <option value="material">資材・包材</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">規格量</label><Input type="number" value={newData.unit_size || ""} onChange={e => setNewData({ ...newData, unit_size: Number(e.target.value) })} placeholder="例: 25" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">単位</label><Input value={newData.unit || ""} onChange={e => setNewData({ ...newData, unit: e.target.value })} placeholder="例: kg" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">単価 (円)</label><Input type="number" value={newData.unit_price || ""} onChange={e => setNewData({ ...newData, unit_price: Number(e.target.value) })} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">安全在庫</label><Input type="number" value={newData.safety_stock || ""} onChange={e => setNewData({ ...newData, safety_stock: Number(e.target.value) })} /></div>
                </div>
              </>
            )}

            {/* BOM用のフォーム */}
            {currentTab === "bom" && (
              <>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">対象製品 <span className="text-red-500">*</span></label>
                  <select value={newData.product_id || ""} onChange={e => setNewData({ ...newData, product_id: e.target.value })} className="w-full border-slate-200 rounded p-2 text-sm bg-white">
                    <option value="">製品を選択してください</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.variant_name})</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">構成品目 (原料/資材) <span className="text-red-500">*</span></label>
                  <select value={newData.item_id || ""} onChange={e => setNewData({ ...newData, item_id: e.target.value })} className="w-full border-slate-200 rounded p-2 text-sm bg-white">
                    <option value="">品目を選択してください</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">使用率</label><Input type="number" value={newData.usage_rate || ""} onChange={e => setNewData({ ...newData, usage_rate: Number(e.target.value) })} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">単位</label><Input value={newData.unit || ""} onChange={e => setNewData({ ...newData, unit: e.target.value })} placeholder="例: g" /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">計算基準 <span className="text-red-500">*</span></label>
                  <select value={newData.basis_type || ""} onChange={e => setNewData({ ...newData, basis_type: e.target.value })} className="w-full border-slate-200 rounded p-2 text-sm bg-white">
                    <option value="">選択してください</option>
                    <option value="production_qty">製造量(kg) 基準</option>
                    <option value="product_cs">完成数(c/s) 基準</option>
                  </select>
                </div>
              </>
            )}

            {/* 出荷先マスタ用のフォーム */}
            {currentTab === "customers" && (
              <>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">出荷先 ID <span className="text-red-500">*</span></label><Input value={newData.id || ""} onChange={e => setNewData({ ...newData, id: e.target.value })} placeholder="例: CUST-001" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">出荷先名 <span className="text-red-500">*</span></label><Input value={newData.name || ""} onChange={e => setNewData({ ...newData, name: e.target.value })} placeholder="例: 株式会社サンプル" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">担当者名</label><Input value={newData.contact_name || ""} onChange={e => setNewData({ ...newData, contact_name: e.target.value })} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">電話番号</label><Input value={newData.phone || ""} onChange={e => setNewData({ ...newData, phone: e.target.value })} /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">住所</label><Input value={newData.address || ""} onChange={e => setNewData({ ...newData, address: e.target.value })} placeholder="例: 北海道小樽市..." /></div>
              </>
            )}
          </div>

          <DialogFooter className="mt-6 border-t pt-4 flex gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">キャンセル</Button>
            <Button onClick={handleSaveNewData} disabled={isProcessing} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 登録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}