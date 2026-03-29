"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Database, Edit2, Loader2, Save, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge"; // 念のため追加
import { useAuth } from "@/contexts/AuthContext";

// --- 型定義 ---
type Product = { id: string; name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number; };
type Item = { id: string; name: string; item_type: string; unit_size: number; unit: string; safety_stock: number; };
type Bom = { id: string; product_id: string; item_id: string; usage_rate: number; unit: string; basis_type: string; products?: { name: string; variant_name: string }; items?: { name: string }; };
type Customer = { id: string; name: string; contact_name: string; postal_code: string; address: string; phone: string; fax: string; notes: string; };

// --- インライン編集用コンポーネント（権限チェック＆右寄せ対応） ---
function EditableCell({
  value,
  onSave,
  type = "text",
  placeholder = "",
  alignRight = false
}: {
  value: any,
  onSave: (val: any) => void,
  type?: "text" | "number",
  placeholder?: string,
  alignRight?: boolean
}) {
  const { canEdit } = useAuth(); // ★追加: 編集可能かチェック
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
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') { setIsEditing(false); setVal(value || ""); }
        }}
        placeholder={placeholder}
        autoFocus
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

// --- メイン画面 ---
export default function MasterPage() {
  const { canEdit } = useAuth(); // ★追加: 画面上部に警告を出すために取得
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState("");

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (loading) return <div className="flex justify-center items-center h-64 text-slate-500"><Loader2 className="animate-spin h-8 w-8 mr-2" /> データを読み込み中...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <Database className="h-6 w-6 text-blue-600" />
            マスタ管理
          </h1>
          {/* ★追加: 閲覧モードの時の警告バッジ */}
          {!canEdit && (
            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 text-sm font-bold flex items-center gap-1 shadow-sm">
              <Lock className="w-3 h-3" /> 閲覧モード (編集ロック中)
            </Badge>
          )}
        </div>
        {savingMsg && <div className="flex items-center text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full text-sm shadow-sm"><Save className="h-4 w-4 mr-1" /> {savingMsg}</div>}
      </div>

      <Tabs defaultValue="products" className="w-full">
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
                  <TableHead className="w-[10%]">製品ID</TableHead>
                  <TableHead className="w-[30%]">製品名</TableHead>
                  <TableHead className="w-[30%]">種類(味)</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">1kgあたり個数</TableHead>
                  <TableHead className="w-[15%] text-right pr-4">1c/sあたり入数</TableHead>
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
                    <TableCell><EditableCell value={item.item_type} onSave={(val) => handleUpdate("items", item.id, "item_type", val)} /></TableCell>
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
                    <TableCell className="text-right pr-4">
                      <EditableCell type="number" value={bom.usage_rate} onSave={(val) => handleUpdate("bom", bom.id, "usage_rate", val)} />
                    </TableCell>
                    <TableCell className="pl-4">
                      <EditableCell value={bom.unit} alignRight={false} onSave={(val) => handleUpdate("bom", bom.id, "unit", val)} />
                    </TableCell>
                    <TableCell>
                      <EditableCell value={bom.basis_type} onSave={(val) => handleUpdate("bom", bom.id, "basis_type", val)} />
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
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-12">
                      出荷先データがありません。SQLでデータを登録してください。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}