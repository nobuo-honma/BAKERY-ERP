"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Wheat, Box, Boxes, ClipboardEdit, ArrowRight, Save, Loader2, AlertCircle, CheckCircle2, ListChecks, TrendingUp, Filter, Lock, Printer, ArrowLeft, Plus, History, Trash2, Search, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ItemCategory = 'raw_material' | 'packaging' | 'product';

type InventoryItem = {
  id: string;
  category: ItemCategory;
  name: string;
  qty: string;
  rawQty: number;
  unit: string;
  min_qty: number;
  item_stocks?: { quantity: number; expiry_date: string | null }[];
};

type ProductStock = {
  id: string;
  product_id: string;
  lot_code: string;
  total_pieces: number;
  expiry_date: string;
  products?: { name: string; variant_name: string; unit_per_cs: number };
};

export default function InventoryPage() {
  const { canEdit } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'print'>('list');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [filter, setFilter] = useState<ItemCategory | 'all'>('all');
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    // 原材料・資材の取得
    const { data: iData } = await supabase.from("items").select("*, item_stocks(quantity, expiry_date)");
    // 製品在庫の取得
    const { data: psData } = await supabase.from("product_stocks").select("*, products(name, variant_name, unit_per_cs)").gt("total_pieces", 0).order("expiry_date", { ascending: true });

    if (iData) {
      const formatted = (iData as any[]).map(item => {
        const total = item.item_stocks?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
        return {
          id: item.id,
          category: item.item_type as ItemCategory,
          name: item.name,
          qty: `${total.toLocaleString()} ${item.unit}`,
          rawQty: total,
          unit: item.unit,
          min_qty: item.min_qty || 0
        };
      });
      setItems(formatted);
    }
    if (psData) setProductStocks(psData as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = useMemo(() => {
    return items.filter(i => (filter === 'all' || i.category === filter) && i.name.toLowerCase().includes(search.toLowerCase()));
  }, [items, filter, search]);

  const filteredProducts = useMemo(() => {
    return productStocks.filter(p => 
      (filter === 'all' || filter === 'product') && 
      (p.products?.name.toLowerCase().includes(search.toLowerCase()) || p.lot_code.toLowerCase().includes(search.toLowerCase()))
    );
  }, [productStocks, filter, search]);

  const handleDeleteLot = async (id: string) => {
    if (!canEdit || !confirm("この製品ロットを在庫から削除しますか？")) return;
    const { error } = await supabase.from("product_stocks").delete().eq("id", id);
    if (!error) fetchData();
    else alert("エラー: " + error.message);
  };

  const printView = (
    <div className="bg-white p-8 min-h-screen text-slate-900">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none; }
          body { background: white; }
        }
      `}} />
      <div className="flex justify-between items-center mb-6 no-print border-b pb-4">
        <Button variant="outline" onClick={() => setViewMode('list')}><ArrowLeft className="w-4 h-4 mr-2" /> 戻る</Button>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="bg-slate-800 text-white"><Printer className="w-4 h-4 mr-2" /> 印刷 (A4横推奨)</Button>
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-black mb-2 tracking-tighter">実地棚卸・在庫確認シート</h1>
        <p className="font-bold text-slate-500">作成日: {new Date().toLocaleDateString('ja-JP')} | 確認者印: ( ＿＿＿＿ )</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-black bg-slate-100 p-2 mb-2 border-l-4 border-slate-800">原材料・資材</h2>
          <Table className="border-2 border-slate-900 border-collapse">
            <TableHeader><TableRow className="bg-slate-50 border-b-2 border-slate-900"><TableHead className="text-slate-900 font-bold border-r">品目名</TableHead><TableHead className="text-slate-900 font-bold text-right border-r">システム在庫</TableHead><TableHead className="text-slate-900 font-bold text-center">実地確認(正)</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.filter(i => i.category !== 'product').map(item => (
                <TableRow key={item.id} className="border-b border-slate-300 h-10"><TableCell className="font-bold border-r">{item.name}</TableCell><TableCell className="text-right border-r">{item.qty}</TableCell><TableCell className="flex justify-center items-center py-2"><div className="w-24 h-6 border-b-2 border-dotted border-slate-400"></div></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <h2 className="text-lg font-black bg-slate-100 p-2 mb-2 border-l-4 border-blue-800">製品在庫 (Lot別)</h2>
          <Table className="border-2 border-slate-900 border-collapse">
            <TableHeader><TableRow className="bg-slate-50 border-b-2 border-slate-900"><TableHead className="text-slate-900 font-bold border-r">製品名 / Lot</TableHead><TableHead className="text-slate-900 font-bold text-right border-r">c/s | p</TableHead><TableHead className="text-slate-900 font-bold text-center">実地確認(正)</TableHead></TableRow></TableHeader>
            <TableBody>
              {productStocks.map(stock => {
                const cs = Math.floor(stock.total_pieces / (stock.products?.unit_per_cs || 1));
                const p = stock.total_pieces % (stock.products?.unit_per_cs || 1);
                return (
                  <TableRow key={stock.id} className="border-b border-slate-300 h-12">
                    <TableCell className="border-r"><div className="font-bold text-xs">{stock.products?.name}</div><div className="text-[10px] text-slate-500 font-mono">L:{stock.lot_code}</div></TableCell>
                    <TableCell className="text-right border-r font-black text-sm">{cs} cs / {p} p</TableCell>
                    <TableCell className="flex justify-center items-center py-3"><div className="w-24 h-6 border-b-2 border-dotted border-slate-400"></div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  if (viewMode === 'print') return printView;

  return (
    <div className="bg-transparent">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-800"><Boxes className="h-7 w-7 text-blue-600" /> 在庫・資産管理</h1>
          <p className="text-sm text-slate-500 font-bold mt-1">原材料から製品まで、全流通在庫のリアルタイム監視</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={() => setViewMode('print')} className="bg-white border-slate-200 font-bold h-10 px-4 shrink-0"><Printer className="w-4 h-4 mr-2" /> 棚卸シート出力</Button>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
        </div>
      </div>

      {/* 検索・フィルタ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="品目名、製品名、ロット番号で検索..." className="pl-9 h-11 bg-white border-slate-200 rounded-xl font-bold" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-11 bg-white border-slate-200 rounded-xl px-4 text-sm font-bold shadow-sm" value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="all">すべてのカテゴリ</option>
          <option value="raw_material">原材料</option>
          <option value="packaging">包装資材</option>
          <option value="product">製品(在庫)</option>
        </select>
        <div className="flex items-center justify-between bg-blue-50/50 p-2 rounded-xl border border-blue-100 px-4">
          <div className="text-[10px] font-black text-blue-600 uppercase">監視対象数</div>
          <div className="text-xl font-black text-blue-800 tracking-tighter">{filteredItems.length + filteredProducts.length} <span className="text-[10px] font-normal text-slate-400">SKU</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 原材料・資材セクション */}
        <div className="space-y-4">
          <h2 className="font-black text-slate-700 flex items-center gap-2 px-2 uppercase tracking-tight italic"><Package className="w-5 h-5" /> 原材料・包装資材</h2>
          <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-slate-100 border-b">
                <TableRow><TableHead className="font-black text-slate-700">品目名</TableHead><TableHead className="font-black text-slate-700 text-right">システム在庫</TableHead><TableHead className="font-black text-slate-700 text-center">ステータス</TableHead></TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {loading ? (<TableRow><TableCell colSpan={3} className="text-center py-10 font-bold text-slate-300">読み込み中...</TableCell></TableRow>) : 
                  filteredItems.filter(i => i.category !== 'product').map((item) => {
                    const isShort = item.rawQty <= item.min_qty;
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell><div className="font-black text-slate-800">{item.name}</div><div className="text-[10px] font-bold text-slate-400 uppercase">{item.category === 'raw_material' ? '原材料' : '包装資材'}</div></TableCell>
                        <TableCell className="text-right font-black text-lg text-slate-700">{item.qty}</TableCell>
                        <TableCell className="text-center">
                          {isShort ? <Badge className="bg-red-500 text-white border-none shadow-sm font-black px-2 py-0.5">要補充</Badge> : <Badge className="bg-emerald-100 text-emerald-800 border-none font-black px-2 py-0.5">正常</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })
                }
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* 製品在庫セクション */}
        <div className="space-y-4">
          <h2 className="font-black text-slate-700 flex items-center gap-2 px-2 uppercase tracking-tight italic"><TrendingUp className="w-5 h-5 text-blue-600" /> 出荷可能製品 (Lot別)</h2>
          <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-slate-100 border-b">
                <TableRow><TableHead className="font-black text-slate-700">製品名 / Lot</TableHead><TableHead className="font-black text-slate-700 text-right">在庫数</TableHead><TableHead className="font-black text-slate-700 text-right">操作</TableHead></TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {loading ? (<TableRow><TableCell colSpan={3} className="text-center py-10 font-bold text-slate-300">読み込み中...</TableCell></TableRow>) : 
                  filteredProducts.map((stock) => {
                    const unitPerCs = stock.products?.unit_per_cs || 1;
                    const cs = Math.floor(stock.total_pieces / unitPerCs);
                    const p = stock.total_pieces % unitPerCs;
                    return (
                      <TableRow key={stock.id} className="hover:bg-blue-50/30 transition-colors group">
                        <TableCell><div className="font-black text-slate-800">{stock.products?.name}</div><div className="flex gap-2"><Badge variant="outline" className="text-[10px] font-mono bg-slate-50 text-slate-500 border-slate-200">Lot:{stock.lot_code}</Badge><Badge variant="outline" className="text-[10px] font-bold text-indigo-500 border-indigo-100">Exp:{new Date(stock.expiry_date).toLocaleDateString()}</Badge></div></TableCell>
                        <TableCell className="text-right">
                          <div className="font-black text-xl text-blue-700 tracking-tighter leading-none">{cs} <span className="text-[10px] font-normal text-slate-400 not-italic">cs</span></div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1">{p} <span className="font-normal">pcs</span></div>
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit && <Button variant="ghost" size="sm" onClick={() => handleDeleteLot(stock.id)} className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></Button>}
                        </TableCell>
                      </TableRow>
                    );
                  })
                }
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}