"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShoppingCart, Plus, Calculator, Loader2, Save, Lock, Edit, Trash2, X,
  FileText, Printer, LayoutGrid, List, CheckCircle2, ChevronLeft, ChevronRight, Calendar
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = {
  id: string;
  order_date: string;
  planned_ship_date: string;
  desired_ship_date: string;
  quantity: number;
  status: string;
  product_id: string;
  customer_id: string;
  customer_order_no?: string;
  unit_price?: number;
  remarks?: string;
  production_date_override?: string | null;
  customers?: { name: string; short_name?: string | null; address?: string };
  products?: { name: string; variant_name: string; unit_per_cs: number };
};

type ProductionDateEntry = {
  key: string;
  productionPlanId: string | null;
  productionDate: string | null;
  overrideDate: string | null;
  plannedUnits: number;
  status: string | null;
};

type Customer = { id: string; name: string; address?: string };
type Product = { id: string; name: string; variant_name: string; unit_per_kg: number; unit_per_cs: number };

type DetailFormData = {
  id?: string;
  productId: string;
  cs: number | "";
  p: number | "";
  unitPrice: number | "";
  remarks: string;
  selectedName: string;
};

type FormDataState = {
  date: string;
  plannedShipDate: string;
  shipDate: string;
  customerId: string;
  customerOrderNo: string;
  details: DetailFormData[];
};

type BomWithStock = {
  id: string;
  product_id: string;
  item_id: string;
  usage_rate: number;
  unit: string;
  basis_type: string;
  items: { name: string; item_type: string; item_stocks: { quantity: number }[] };
};

type OrderGroup = {
  groupId: string;
  customerName: string;
  customerShortName: string;
  customerAddress: string;
  customerId: string;
  customerOrderNo: string;
  orderDate: string;
  plannedShipDate: string;
  desiredShipDate: string;
  status: string;
  items: Order[];
};

function pcsToDisplay(totalPcs: number, unitPerCs: number): { cs: number; p: number } {
  const cs = Math.floor(totalPcs / unitPerCs);
  const remainder = totalPcs % unitPerCs;
  const p = Math.floor(remainder / 2);
  return { cs, p };
}

function displayToPcs(cs: number, p: number, unitPerCs: number): number {
  return (cs * unitPerCs) + (p * 2);
}

// YYYY-MM-DD 文字列をローカル日付の 00:00:00 Date に変換
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatShortMD(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const [, m, d] = dateStr.slice(0, 10).split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : dateStr;
}

// 指定日を含む週の月曜日を取得
function getMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export default function OrdersPage() {
  const { canEdit } = useAuth();
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [productionDates, setProductionDates] = useState<Record<string, ProductionDateEntry[]>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [displayMode, setDisplayMode] = useState<"cards" | "list" | "progress">("cards");

  // ガントチャート表示開始日（週の月曜日基準）
  const [ganttStartDate, setGanttStartDate] = useState<string>(() => {
    const today = new Date();
    const mon = getMonday(today);
    return formatDateYMD(mon);
  });
  const [ganttWeeks, setGanttWeeks] = useState<number>(4);

  const [isOpen, setIsOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<OrderGroup | null>(null);
  const [formData, setFormData] = useState<FormDataState>({
    date: "", plannedShipDate: "", shipDate: "", customerId: "", customerOrderNo: "",
    details: [{ productId: "", cs: 0, p: 0, unitPrice: "", remarks: "", selectedName: "" }]
  });
  const [boms, setBoms] = useState<BomWithStock[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetForm = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    setEditingGroup(null);
    setFormData({
      date: today, plannedShipDate: "", shipDate: "", customerId: "", customerOrderNo: "",
      details: [{ productId: "", cs: 0, p: 0, unitPrice: "", remarks: "", selectedName: "" }]
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: oData } = await supabase
      .from("orders")
      .select("*, customers (name, short_name, address), products (name, variant_name, unit_per_kg, unit_per_cs)")
      .order("order_date", { ascending: false });
    const { data: cData } = await supabase.from("customers").select("id, name, address");
    const { data: pData } = await supabase.from("products").select("*");

    const orderIds = (oData ?? []).map((order: Order) => order.id);
    const datesByOrder: Record<string, Map<string, ProductionDateEntry>> = {};

    if (orderIds.length > 0) {
      const [{ data: planLinks }, { data: directPlans }] = await Promise.all([
        supabase.from("production_plan_orders").select("order_id, production_plan_id, production_date_override, planned_units").in("order_id", orderIds),
        supabase.from("production_plans").select("id, order_id, production_date, planned_units, status").in("order_id", orderIds)
      ]);

      let linkedPlans: Array<{ id: string; production_date: string; planned_units: number; status: string }> = [];
      const planIds = [...new Set((planLinks ?? []).map((link) => link.production_plan_id))];
      if (planIds.length > 0) {
        const result = await supabase.from("production_plans").select("id, production_date, planned_units, status").in("id", planIds);
        linkedPlans = result.data ?? [];
      }

      const addProductionDate = (orderId: string, entry: ProductionDateEntry) => {
        if (!datesByOrder[orderId]) datesByOrder[orderId] = new Map();
        datesByOrder[orderId].set(entry.key, entry);
      };

      const linkedPlansById = new Map(linkedPlans.map((plan) => [plan.id, plan]));
      (planLinks ?? []).forEach((link) => {
        const plan = linkedPlansById.get(link.production_plan_id);
        if (plan) {
          addProductionDate(link.order_id, {
            key: `plan:${link.production_plan_id}`,
            productionPlanId: link.production_plan_id,
            productionDate: plan.production_date,
            overrideDate: link.production_date_override,
            plannedUnits: link.planned_units,
            status: plan.status
          });
        }
      });

      (directPlans ?? []).forEach((plan) => {
        if (!datesByOrder[plan.order_id]?.has(`plan:${plan.id}`)) {
          addProductionDate(plan.order_id, {
            key: `plan:${plan.id}`,
            productionPlanId: plan.id,
            productionDate: plan.production_date,
            overrideDate: null,
            plannedUnits: plan.planned_units,
            status: plan.status
          });
        }
      });
    }

    const productionDateEntries = Object.fromEntries(
      Object.entries(datesByOrder).map(([orderId, entries]) => [
        orderId,
        [...entries.values()].sort((a, b) => (a.overrideDate || a.productionDate || "").localeCompare(b.overrideDate || b.productionDate || ""))
      ])
    );

    (oData ?? []).forEach((order: Order) => {
      if (!productionDateEntries[order.id]?.length) {
        productionDateEntries[order.id] = [{
          key: `order:${order.id}`,
          productionPlanId: null,
          productionDate: null,
          overrideDate: order.production_date_override ?? null,
          plannedUnits: 0,
          status: null
        }];
      }
    });

    setProductionDates(productionDateEntries);

    if (oData) {
      const groups: Record<string, OrderGroup> = {};
      oData.forEach((o: Order) => {
        const parts = o.id.split('-');
        const gId = parts.length > 3 ? parts.slice(0, 3).join('-') : o.id;
        if (!groups[gId]) {
          groups[gId] = {
            groupId: gId,
            customerName: o.customers?.name || "",
            customerShortName: o.customers?.short_name || "",
            customerAddress: o.customers?.address || "",
            customerId: o.customer_id,
            customerOrderNo: o.customer_order_no || "",
            orderDate: o.order_date,
            plannedShipDate: o.planned_ship_date,
            desiredShipDate: o.desired_ship_date,
            status: o.status,
            items: []
          };
        }
        groups[gId].items.push(o);
        if (o.status === 'shipped' || (o.status === 'in_production' && groups[gId].status !== 'shipped')) {
          groups[gId].status = o.status;
        }
      });

      setOrderGroups(
        Object.values(groups)
          .filter((group) => group.status !== "shipped")
          .sort((a, b) => (a.plannedShipDate || "").localeCompare(b.plannedShipDate || ""))
      );
    }
    if (cData) setCustomers(cData);
    if (pData) setProducts(pData);
    resetForm();
    setLoading(false);
  }, [resetForm]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const openModal = (group?: OrderGroup) => {
    if (group) {
      setEditingGroup(group);
      const details = group.items.map(item => {
        const unitPerCs = item.products?.unit_per_cs || 24;
        const { cs, p } = pcsToDisplay(item.quantity, unitPerCs);
        return {
          id: item.id,
          productId: item.product_id,
          cs, p,
          unitPrice: (item.unit_price ?? "") as number | "",
          remarks: item.remarks || "",
          selectedName: item.products?.name || ""
        };
      });
      setFormData({
        date: group.orderDate, plannedShipDate: group.plannedShipDate || "",
        shipDate: group.desiredShipDate, customerId: group.customerId,
        customerOrderNo: group.customerOrderNo, details
      });
    } else resetForm();
    setIsOpen(true);
  };

  const addDetailRow = () => setFormData(prev => ({ ...prev, details: [...prev.details, { productId: "", cs: 0, p: 0, unitPrice: "", remarks: "", selectedName: "" }] }));
  const removeDetailRow = (index: number) => setFormData(prev => ({ ...prev, details: prev.details.filter((_, i) => i !== index) }));

  const updateDetail = (index: number, field: keyof DetailFormData, value: DetailFormData[keyof DetailFormData]) => {
    setFormData(prev => {
      const newDetails = [...prev.details];
      const nextDetail = { ...newDetails[index], [field]: value } as DetailFormData;
      newDetails[index] = nextDetail;
      if (field === 'selectedName') newDetails[index].productId = "";
      return { ...prev, details: newDetails };
    });
  };

  useEffect(() => {
    const productIds = formData.details.map(d => d.productId).filter(Boolean);
    if (productIds.length === 0) {
      const timer = window.setTimeout(() => setBoms([]), 0);
      return () => window.clearTimeout(timer);
    }
    const fetchBoms = async () => {
      setIsSimulating(true);
      const { data: bomData } = await supabase.from("bom").select(`*, items (id, name, item_type)`).in("product_id", productIds);
      if (bomData && bomData.length > 0) {
        const mappedBoms = bomData as BomWithStock[];
        const itemIds = mappedBoms.map((b) => b.item_id);
        const { data: stockData } = await supabase.from("item_stocks").select("item_id, quantity").in("item_id", itemIds);
        const stockRows = (stockData ?? []) as Array<{ item_id: string; quantity: number }>;
        const mergedBoms = mappedBoms.map((b) => {
          const stock = stockRows.find((s) => s.item_id === b.item_id);
          return { ...b, items: { ...b.items, item_stocks: stock ? [{ quantity: stock.quantity }] : [] } };
        });
        setBoms(mergedBoms);
      } else {
        setBoms([]);
      }
      setIsSimulating(false);
    };
    const timer = window.setTimeout(() => { void fetchBoms(); }, 0);
    return () => window.clearTimeout(timer);
  }, [formData.details]);

  const simResult: Record<string, { name: string, unit: string, required: number, stock: number, isShort: boolean }> = {};
  formData.details.forEach(detail => {
    const csVal = Number(detail.cs) || 0;
    const pVal = Number(detail.p) || 0;
    if (!detail.productId || (csVal <= 0 && pVal <= 0)) return;
    const selectedProduct = products.find(p => p.id === detail.productId);
    if (!selectedProduct) return;
    const totalPcs = displayToPcs(csVal, pVal, selectedProduct.unit_per_cs);
    const productionKg = totalPcs / selectedProduct.unit_per_kg;
    const productBoms = boms.filter(b => b.product_id === detail.productId);
    productBoms.forEach(bom => {
      const csCount = Math.floor(totalPcs / selectedProduct.unit_per_cs);
      const reqQty = bom.basis_type === 'production_qty' ? productionKg * bom.usage_rate : csCount * bom.usage_rate;
      const currentStock = Array.isArray(bom.items.item_stocks) ? (bom.items.item_stocks[0]?.quantity || 0) : 0;
      if (!simResult[bom.item_id]) {
        simResult[bom.item_id] = { name: bom.items.name, unit: bom.unit, required: 0, stock: currentStock, isShort: false };
      }
      simResult[bom.item_id].required += reqQty;
      simResult[bom.item_id].isShort = simResult[bom.item_id].required > simResult[bom.item_id].stock;
    });
  });

  const formatListDate = (date: string | null | undefined) => {
    if (!date) return "未設定";
    const [, month, day] = date.slice(0, 10).split("-");
    return month && day ? `${Number(month)}月${Number(day)}日` : date;
  };

  const deleteOrdersAndUnlinkPlans = async (orderIds: string[]) => {
    const { error: unlinkError } = await supabase.from("production_plans").update({ order_id: null }).in("order_id", orderIds);
    if (unlinkError) throw unlinkError;
    const { error } = await supabase.from("orders").delete().in("id", orderIds);
    if (error) throw error;
  };

  const handleSaveOrder = async () => {
    if (!formData.customerId || !formData.shipDate || !formData.plannedShipDate) {
      alert("出荷予定日や着予定日などの必須項目を入力してください。");
      return;
    }
    const validDetails = formData.details.filter(d => d.productId && (Number(d.cs) > 0 || Number(d.p) > 0));
    if (validDetails.length === 0) {
      alert("少なくとも1つの製品と数量を正しく入力してください。");
      return;
    }
    const existingIds = editingGroup?.items.map(item => item.id) || [];
    const currentIds = validDetails.map(detail => detail.id).filter((id): id is string => Boolean(id));
    const idsToDelete = existingIds.filter(id => !currentIds.includes(id));
    const deletedItems = editingGroup?.items.filter(item => idsToDelete.includes(item.id)) || [];

    if (deletedItems.some(item => item.status === 'shipped')) {
      alert("出荷済みの製品は削除できません。");
      return;
    }
    if (deletedItems.some(item => item.status === 'in_production') && !confirm("製造中の製品を受注から削除しますか？\n紐づく製造計画は継続し、製造済みの原料在庫も戻しません。")) return;

    setIsProcessing(true);
    try {
      const dateStr = formData.date.replace(/-/g, "");
      const random3 = editingGroup ? editingGroup.groupId.split('-')[2] : Math.floor(Math.random() * 1000).toString().padStart(3, "0");
      const baseGroupId = `ORD-${dateStr}-${random3}`;

      const upserts = validDetails.map((detail, i) => {
        const selectedProduct = products.find(p => p.id === detail.productId);
        const totalPcs = displayToPcs(Number(detail.cs) || 0, Number(detail.p) || 0, selectedProduct?.unit_per_cs || 24);
        return {
          id: detail.id || `${baseGroupId}-${i}`,
          order_date: formData.date,
          planned_ship_date: formData.plannedShipDate,
          desired_ship_date: formData.shipDate,
          customer_id: formData.customerId,
          customer_order_no: formData.customerOrderNo || null,
          product_id: detail.productId,
          quantity: totalPcs,
          unit_price: Number(detail.unitPrice) || 0,
          remarks: detail.remarks || null,
          production_date_override: editingGroup?.items.find(item => item.id === detail.id)?.production_date_override ?? null,
          status: editingGroup?.items.find(item => item.id === detail.id)?.status || "received"
        };
      });

      if (idsToDelete.length > 0) await deleteOrdersAndUnlinkPlans(idsToDelete);
      const { error } = await supabase.from("orders").upsert(upserts);
      if (error) throw error;
      alert(editingGroup ? "受注データを更新しました！" : `新規受注を登録しました！(${upserts.length}件)`);
      setIsOpen(false);
      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラーが発生しました。";
      alert("エラー: " + message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteOrder = async (group: OrderGroup) => {
    if (group.items.some(item => item.status === 'shipped')) {
      alert("出荷済みのデータが含まれているため削除できません。");
      return;
    }
    const hasInProduction = group.items.some(item => item.status === 'in_production');
    const confirmMessage = hasInProduction
      ? "この注文書を削除しますか？\n紐づく製造計画は継続し、製造済みの原料在庫は戻しません。"
      : "この注文書を本当にキャンセル（削除）しますか？";
    if (!confirm(confirmMessage)) return;

    setIsProcessing(true);
    try {
      const idsToDelete = group.items.map(item => item.id);
      await deleteOrdersAndUnlinkPlans(idsToDelete);
      setIsOpen(false);
      await fetchData();
      alert("注文書全体をキャンセルしました。");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラーが発生しました。";
      alert("削除に失敗しました: " + message);
    } finally {
      setIsProcessing(false);
    }
  };

  const orderListRows = orderGroups.flatMap((group) => group.items.map((item) => ({ group, item })));
  const firstRowByCustomerOrderNo = new Map<string, number>();
  orderListRows.forEach(({ group }, index) => {
    if (group.customerOrderNo && !firstRowByCustomerOrderNo.has(group.customerOrderNo)) {
      firstRowByCustomerOrderNo.set(group.customerOrderNo, index);
    }
  });

  // ガントチャート用の日付配列（週単位で生成）
  const ganttTimeline = useMemo(() => {
    const start = parseLocalDate(ganttStartDate);
    const totalDays = ganttWeeks * 7;
    const days: { date: Date; ymd: string; dayNum: number; dowLabel: string; isWeekend: boolean; isToday: boolean }[] = [];
    const weeks: { label: string; days: typeof days }[] = [];
    const todayYmd = formatDateYMD(new Date());
    const dowNames = ["日", "月", "火", "水", "木", "金", "土"];

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const ymd = formatDateYMD(d);
      const dow = d.getDay();
      days.push({
        date: d,
        ymd,
        dayNum: d.getDate(),
        dowLabel: dowNames[dow],
        isWeekend: dow === 0 || dow === 6,
        isToday: ymd === todayYmd,
      });
    }

    for (let w = 0; w < ganttWeeks; w++) {
      const slice = days.slice(w * 7, w * 7 + 7);
      const first = slice[0].date;
      weeks.push({
        label: `${first.getFullYear()}/${first.getMonth() + 1}/${first.getDate()}`,
        days: slice,
      });
    }

    return { days, weeks };
  }, [ganttStartDate, ganttWeeks]);

  const shiftGanttWeeks = (deltaWeeks: number) => {
    const cur = parseLocalDate(ganttStartDate);
    cur.setDate(cur.getDate() + deltaWeeks * 7);
    setGanttStartDate(formatDateYMD(cur));
  };

  // グループごとのフェーズヘッダー背景色ローテーション（画像のような青・赤・緑）
  const phaseColors = [
    { bg: "bg-sky-100/90", text: "text-sky-950", border: "border-sky-200" },
    { bg: "bg-rose-100/90", text: "text-rose-950", border: "border-rose-200" },
    { bg: "bg-emerald-100/90", text: "text-emerald-950", border: "border-emerald-200" },
  ];

  return (
    <div className="bg-transparent">
      {(displayMode === "list" || displayMode === "progress") && (
        <style>{`
          @media print {
            header, nav, .orders-screen-controls { display: none !important; }
            main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
            body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: A4 landscape; margin: 8mm; }
            .orders-cards { display: none !important; }
            .orders-print-list { border: 0 !important; box-shadow: none !important; }
            .orders-print-list table { font-size: 9pt; }
            .orders-print-list thead { display: table-header-group; }
            .orders-print-list tr { break-inside: avoid; }
            .orders-print-hide { display: none !important; }
          }
        `}</style>
      )}

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <ShoppingCart className="h-6 w-6 text-blue-600" />受注管理
          </h1>
          {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" />閲覧モード</Badge>}
        </div>
        <div className="orders-screen-controls flex flex-wrap justify-end gap-2">
          <Button variant={displayMode === "cards" ? "default" : "outline"} onClick={() => setDisplayMode("cards")} className={displayMode === "cards" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}>
            <LayoutGrid className="h-4 w-4 mr-2" />カード
          </Button>
          <Button variant={displayMode === "list" ? "default" : "outline"} onClick={() => setDisplayMode("list")} className={displayMode === "list" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}>
            <List className="h-4 w-4 mr-2" />一覧
          </Button>
          <Button variant={displayMode === "progress" ? "default" : "outline"} onClick={() => setDisplayMode("progress")} className={displayMode === "progress" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}>
            <CheckCircle2 className="h-4 w-4 mr-2" />進捗表
          </Button>
          {(displayMode === "list" || displayMode === "progress") && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />印刷/PDF保存
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm">
              <Plus className="h-4 w-4 mr-2" />新規受注登録
            </Button>
          )}
        </div>
      </div>

      {/* 登録・編集モーダル */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl bg-white max-h-[95vh] flex flex-col p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> {editingGroup ? "受注内容の編集 / キャンセル" : "新規受注の登録"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-4 mr-4 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 bg-slate-50 p-6 rounded-lg border shadow-inner">
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-xs font-bold mb-1 text-slate-700">受注日</label><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="bg-white text-sm" /></div>
                  <div><label className="block text-xs font-bold mb-1 text-slate-700">発注番号</label><Input value={formData.customerOrderNo} onChange={e => setFormData({ ...formData, customerOrderNo: e.target.value })} className="bg-white border-blue-300 text-sm" placeholder="FAX・注番" /></div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-700">出荷先名(納入先)<span className="text-red-500">*</span></label>
                    <Input list="customers-list" placeholder="検索..." value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })} className="bg-white border-blue-300 text-sm font-bold" />
                    <datalist id="customers-list">{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</datalist>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded border border-blue-200">
                  <div><label className="block text-xs font-bold mb-1 text-blue-800">工場からの出荷予定日 <span className="text-red-500">*</span></label><Input type="date" value={formData.plannedShipDate} onChange={e => setFormData({ ...formData, plannedShipDate: e.target.value })} className="bg-white border-blue-400 font-bold" /></div>
                  <div><label className="block text-xs font-bold mb-1 text-slate-700">納入期限(着予定日)<span className="text-red-500">*</span></label><Input type="date" value={formData.shipDate} onChange={e => setFormData({ ...formData, shipDate: e.target.value })} className="bg-white border-slate-300 font-bold" /></div>
                </div>
                <div className="bg-blue-50/50 p-4 mx-2 rounded-md border border-blue-100 space-y-3">
                  <label className="block text-sm font-bold text-blue-900 mb-2">注文製品と数量 <span className="text-red-500">*</span></label>
                  {formData.details.map((detail, idx) => (
                    <div key={idx} className="flex flex-col gap-2 bg-white p-3 rounded border shadow-sm relative">
                      <div className="flex flex-col sm:flex-row items-end gap-2">
                        <div className="w-full sm:flex-1"><label className="block text-[10px] font-bold mb-1 text-slate-500">1. 品目</label><select className="w-full border-slate-200 rounded p-2 text-sm bg-white font-bold" value={detail.selectedName} onChange={e => updateDetail(idx, 'selectedName', e.target.value)}><option value="">選択</option>{Array.from(new Set(products.map(p => p.name))).map(name => <option key={name} value={name}>{name}</option>)}</select></div>
                        <div className="w-full sm:flex-1"><label className="block text-[10px] font-bold mb-1 text-slate-500">2. テキスト(味)</label><select className="w-full border-slate-200 rounded p-2 text-sm bg-white disabled:bg-slate-50" value={detail.productId} onChange={e => updateDetail(idx, 'productId', e.target.value)} disabled={!detail.selectedName}><option value="">選択</option>{products.filter(p => p.name === detail.selectedName).map(p => <option key={p.id} value={p.id}>{p.variant_name}</option>)}</select></div>
                        <div className="w-full sm:w-20"><label className="block text-[10px] font-bold mb-1 text-slate-500">3. c/s</label><Input type="number" min="0" value={detail.cs !== undefined ? detail.cs : ""} onChange={e => updateDetail(idx, 'cs', e.target.value === "" ? "" : Number(e.target.value))} className="font-bold text-right h-9" /></div>
                        <div className="w-full sm:w-20"><label className="block text-[10px] font-bold mb-1 text-slate-500">4. p(パック)</label><Input type="number" min="0" value={detail.p !== undefined ? detail.p : ""} onChange={e => updateDetail(idx, 'p', e.target.value === "" ? "" : Number(e.target.value))} className="font-bold text-right h-9" /></div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-2 mt-1 pt-2 border-t border-slate-100 border-dashed">
                        <div className="w-full sm:w-1/3 flex items-center gap-1"><label className="text-[10px] font-bold text-slate-500 shrink-0">単価 ¥</label><Input type="number" min="0" value={detail.unitPrice !== undefined ? detail.unitPrice : ""} onChange={e => updateDetail(idx, 'unitPrice', e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-sm text-right font-bold" placeholder="任意" /></div>
                        <div className="w-full sm:flex-1 flex items-center gap-1"><label className="text-[10px] font-bold text-slate-500 shrink-0">摘要</label><Input value={detail.remarks} onChange={e => updateDetail(idx, 'remarks', e.target.value)} className="h-8 text-xs text-slate-600" placeholder="備考..." /></div>
                      </div>
                      {formData.details.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeDetailRow(idx)} className="h-9 w-9 text-red-500 hover:bg-red-50 absolute -right-2 -top-2 bg-white rounded-full border shadow-sm"><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addDetailRow} className="w-full mt-2 border-blue-300 text-blue-700 bg-white hover:bg-blue-50 font-bold"><Plus className="h-4 w-4 mr-1" />品目を追加する</Button>
                </div>
              </div>

              {/* BOM シミュレーション */}
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 h-full shadow-inner">
                  <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-4 text-lg"><Calculator className="h-6 w-6"/>合算 必要資材シミュレーション</h3>
                  {Object.keys(simResult).length > 0 ? (
                    <div className="overflow-x-auto rounded-md border shadow-sm">
                      <Table className="bg-white">
                        <TableHeader className="bg-slate-100">
                          <TableRow>
                            <TableHead className="font-bold text-slate-700">必要品</TableHead>
                            <TableHead className="text-right font-bold text-slate-700">必要量</TableHead>
                            <TableHead className="text-right font-bold text-slate-700">現在庫</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isSimulating ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500 font-bold"><Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />計算中...</TableCell></TableRow>
                          ) : (
                            Object.values(simResult).map((item, idx) => (
                              <TableRow key={idx} className={item.isShort && item.required > 0 ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}>
                                <TableCell className="font-medium text-slate-800 text-sm py-3">{item.name}</TableCell>
                                <TableCell className="text-right font-black text-blue-600 text-base py-3">{item.required.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-500">{item.unit}</span></TableCell>
                                <TableCell className={`text-right font-bold text-base py-3 ${item.isShort && item.required > 0 ? "text-red-600" : "text-slate-700"}`}>
                                  {item.stock.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                  {item.isShort && item.required > 0 && <span className="ml-2 inline-block bg-red-600 text-white text-xs px-2 py-0.5 rounded-full shadow-sm">不足!</span>}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-75 text-slate-400 bg-white/50 rounded-lg border-dashed border-blue-200">
                      <Calculator className="h-12 w-12 mb-4 opacity-50" />
                      <p className="font-bold">製品と数量を入力してください</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 border-t pt-4 flex flex-col sm:flex-row gap-4 sm:justify-between shrink-0">
            {editingGroup ? (
              <Button onClick={() => handleDeleteOrder(editingGroup)} disabled={isProcessing} variant="outline" className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 font-bold">
                <Trash2 className="h-4 w-4 mr-2"/>注文書全体をキャンセル(削除)
              </Button>
            ) : <div></div>}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsOpen(false)} className="flex-1 sm:flex-none">キャンセル</Button>
              <Button onClick={handleSaveOrder} disabled={isProcessing} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-8 font-bold">
                <Save className="h-4 w-4 mr-2" />{editingGroup ? "更新する" : "受注を確定する"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ★ ガントチャート形式の進捗表ビュー */}
      {displayMode === "progress" && (
        <Card className="shadow-sm border-slate-300 overflow-hidden bg-white">
          {/* 上部コントロールバー（プロジェクト開始日・週表示切り替え） */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-slate-800 tracking-tight">受注・製造スケジュール進捗表</span>
              <div className="flex items-center gap-3 text-xs text-slate-600 ml-2">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-neutral-400 rounded-xs"></span>完了分</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-purple-700 rounded-xs"></span>予定・残工程</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 orders-print-hide">
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2.5 py-1 shadow-2xs">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-600">開始日:</span>
                <input
                  type="date"
                  value={ganttStartDate}
                  onChange={(e) => e.target.value && setGanttStartDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md p-0.5 shadow-2xs">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftGanttWeeks(-1)} title="前週へ">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold" onClick={() => setGanttStartDate(formatDateYMD(getMonday(new Date())))}>
                  今週
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftGanttWeeks(1)} title="翌週へ">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2.5 py-1 shadow-2xs">
                <span className="text-xs font-bold text-slate-600">週表示:</span>
                <select
                  value={ganttWeeks}
                  onChange={(e) => setGanttWeeks(Number(e.target.value))}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
                >
                  <option value={2}>2週間</option>
                  <option value={4}>4週間</option>
                  <option value={6}>6週間</option>
                  <option value={8}>8週間</option>
                </select>
              </div>
            </div>
          </div>

          {/* ガントチャート本体 */}
          <div className="overflow-x-auto relative">
            <table className="border-collapse w-max min-w-full text-xs select-none">
              <thead>
                {/* 1段目: 週の開始日ヘッダー */}
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th colSpan={5} className="sticky left-0 z-20 bg-white border-r border-slate-300 p-1.5 text-right text-[11px] font-normal text-slate-500">
                    表示期間: {formatShortMD(ganttTimeline.days[0]?.ymd)} 〜 {formatShortMD(ganttTimeline.days[ganttTimeline.days.length - 1]?.ymd)}
                  </th>
                  {ganttTimeline.weeks.map((week, wIdx) => (
                    <th
                      key={wIdx}
                      colSpan={7}
                      className="border-r border-slate-300 bg-slate-200/80 py-1.5 px-2 text-center font-bold text-slate-800 text-xs"
                    >
                      {week.label}
                    </th>
                  ))}
                </tr>

                {/* 2段目: 日付数字 (1〜31) */}
                <tr className="bg-slate-50 border-b border-slate-300">
                  <th colSpan={5} className="sticky left-0 z-20 bg-slate-50 border-r border-slate-300"></th>
                  {ganttTimeline.days.map((d) => (
                    <th
                      key={d.ymd}
                      className={`w-7 min-w-7 text-center py-1 font-bold text-[11px] border-r border-slate-200 ${
                        d.isToday ? "bg-amber-200 text-amber-950" : d.isWeekend ? "bg-slate-100 text-slate-500" : "text-slate-700"
                      }`}
                    >
                      {d.dayNum}
                    </th>
                  ))}
                </tr>

                {/* 3段目: ダークグレーのタスク列見出し ＆ 曜日 (月〜日) */}
                <tr className="bg-neutral-700 text-white border-b border-neutral-800">
                  <th className="sticky left-0 z-20 bg-neutral-700 py-2 px-3 text-left font-bold w-48 min-w-48 border-r border-neutral-600">
                    タスク（製品・種類）
                  </th>
                  <th className="sticky left-48 z-20 bg-neutral-700 py-2 px-2 text-right font-bold w-24 min-w-24 border-r border-neutral-600">
                    数量
                  </th>
                  <th className="sticky left-72 z-20 bg-neutral-700 py-2 px-2 text-center font-bold w-16 min-w-16 border-r border-neutral-600">
                    進捗状況
                  </th>
                  <th className="sticky left-88 z-20 bg-neutral-700 py-2 px-2 text-center font-bold w-16 min-w-16 border-r border-neutral-600">
                    開始
                  </th>
                  <th className="sticky left-104 z-20 bg-neutral-700 py-2 px-2 text-center font-bold w-16 min-w-16 border-r border-neutral-500">
                    終了
                  </th>
                  {ganttTimeline.days.map((d) => (
                    <th
                      key={d.ymd}
                      className={`w-7 min-w-7 text-center py-1.5 font-medium text-[10px] border-r border-neutral-600 ${
                        d.isToday ? "bg-amber-500 text-white font-bold" : ""
                      }`}
                    >
                      {d.dowLabel}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {orderGroups.map((group, gIdx) => {
                  const pColor = phaseColors[gIdx % phaseColors.length];
                  return (
                    <>
                      {/* フェーズ（受注先グループ）行 */}
                      <tr key={`phase-${group.groupId}`} className={`${pColor.bg} ${pColor.text} border-b ${pColor.border}`}>
                        <td colSpan={5} className={`sticky left-0 z-10 ${pColor.bg} py-2 px-3 font-black text-xs border-r border-slate-300`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {group.customerName}
                              {group.customerOrderNo && <span className="ml-2 font-normal opacity-80">（発注No: {group.customerOrderNo}）</span>}
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => openModal(group)}
                                className="text-[10px] underline opacity-70 hover:opacity-100 shrink-0 orders-print-hide"
                              >
                                編集
                              </button>
                            )}
                          </div>
                        </td>
                        {ganttTimeline.days.map((d) => (
                          <td
                            key={d.ymd}
                            className={`border-r border-slate-300/60 ${d.isToday ? "bg-amber-100/50" : ""}`}
                          ></td>
                        ))}
                      </tr>

                      {/* タスク（受注明細）行 */}
                      {group.items.map((item) => {
                        const unitPerCs = item.products?.unit_per_cs || 24;
                        const { cs, p } = pcsToDisplay(item.quantity, unitPerCs);
                        const entries = productionDates[item.id] ?? [];

                        // 開始日: 製造予定日の最も早い日（無ければ受注日）
                        const validPlanDates = entries
                          .map((e) => e.overrideDate || e.productionDate)
                          .filter((d): d is string => Boolean(d))
                          .sort();
                        const startYmd = validPlanDates[0] || group.orderDate;

                        // 終了日: 工場出荷予定日（無ければ納入期限、それも無ければ開始日）
                        const endYmd = group.plannedShipDate || group.desiredShipDate || startYmd;

                        // 進捗率の算出
                        const totalPlanned = entries.reduce((sum, e) => sum + (e.plannedUnits || 0), 0);
                        const completedUnits = entries
                          .filter((e) => e.status === "completed")
                          .reduce((sum, e) => sum + (e.plannedUnits || 0), 0);

                        let progressPct = 0;
                        if (item.status === "shipped") {
                          progressPct = 100;
                        } else if (item.quantity > 0 && completedUnits > 0) {
                          progressPct = Math.min(100, Math.round((completedUnits / item.quantity) * 100));
                        } else if (item.status === "in_production" || totalPlanned > 0) {
                          progressPct = entries.some((e) => e.status === "in_progress") ? 50 : 25;
                        }

                        const startDt = parseLocalDate(startYmd);
                        const endDt = parseLocalDate(endYmd < startYmd ? startYmd : endYmd);
                        const totalSpanDays = Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / 86400000) + 1);
                        const completedDaysCount = Math.round((totalSpanDays * progressPct) / 100);

                        return (
                          <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50/90 bg-white">
                            {/* タスク名 */}
                            <td className="sticky left-0 z-10 bg-white py-2 pl-6 pr-2 border-r border-slate-200 w-48 min-w-48">
                              <div className="font-bold text-slate-800 truncate" title={item.products?.name}>
                                {item.products?.name || "-"}
                              </div>
                              {item.products?.variant_name && (
                                <div className="text-[10px] text-slate-500 truncate">{item.products.variant_name}</div>
                              )}
                            </td>

                            {/* 数量 */}
                            <td className="sticky left-48 z-10 bg-white py-2 px-2 text-right font-bold text-slate-700 border-r border-slate-200 w-24 min-w-24 whitespace-nowrap">
                              {cs} c/s {p > 0 && <span className="text-[10px]">{p}p</span>}
                            </td>

                            {/* 進捗状況（%表示＋グレー背景バー） */}
                            <td className="sticky left-72 z-10 bg-white py-1.5 px-1.5 text-center border-r border-slate-200 w-16 min-w-16">
                              {progressPct > 0 ? (
                                <div className="w-full bg-neutral-200 rounded-xs py-0.5 font-bold text-neutral-800 text-[11px]">
                                  {progressPct}%
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  {validPlanDates.length === 0 ? "未計画" : "0%"}
                                </span>
                              )}
                            </td>

                            {/* 開始日 */}
                            <td className="sticky left-88 z-10 bg-white py-2 px-1 text-center text-slate-700 font-medium border-r border-slate-200 w-16 min-w-16">
                              {formatShortMD(startYmd)}
                            </td>

                            {/* 終了日 */}
                            <td className="sticky left-104 z-10 bg-white py-2 px-1 text-center text-slate-700 font-medium border-r border-slate-300 w-16 min-w-16">
                              {formatShortMD(endYmd)}
                            </td>

                            {/* 日別ガントバー描画セル */}
                            {ganttTimeline.days.map((d) => {
                              const curTime = d.date.getTime();
                              const inRange = curTime >= startDt.getTime() && curTime <= endDt.getTime();
                              const dayOffset = Math.round((curTime - startDt.getTime()) / 86400000);
                              const isCompletedPortion = inRange && dayOffset < completedDaysCount;
                              const isStart = d.ymd === formatDateYMD(startDt);
                              const isEnd = d.ymd === formatDateYMD(endDt);

                              return (
                                <td
                                  key={d.ymd}
                                  className={`p-0 border-r border-slate-200 relative h-9 ${
                                    d.isToday ? "bg-amber-50/70" : d.isWeekend ? "bg-slate-50/60" : ""
                                  }`}
                                  title={`${item.products?.name} (${formatShortMD(startYmd)} 〜 ${formatShortMD(endYmd)}) 進捗:${progressPct}%`}
                                >
                                  {inRange && (
                                    <div
                                      className={`h-6 my-auto w-full ${
                                        isCompletedPortion ? "bg-neutral-400" : "bg-purple-700"
                                      } ${isStart ? "rounded-l-xs" : ""} ${isEnd ? "rounded-r-xs" : ""}`}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </>
                  );
                })}

                {!loading && orderGroups.length === 0 && (
                  <tr>
                    <td colSpan={5 + ganttTimeline.days.length} className="text-center py-16 text-slate-400 font-bold">
                      表示する受注・進捗データがありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 通常の一覧ビュー */}
      {displayMode === "list" && (
        <Card className="orders-print-list overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="w-12 font-bold text-slate-700">No.</TableHead>
                    <TableHead className="font-bold text-slate-700">発注 No.</TableHead>
                    <TableHead className="font-bold text-slate-700">受注先</TableHead>
                    <TableHead className="font-bold text-slate-700">製造種類</TableHead>
                    <TableHead className="font-bold text-slate-700 whitespace-nowrap">受注数(c/s)</TableHead>
                    <TableHead className="font-bold text-slate-700">製造予定日</TableHead>
                    <TableHead className="font-bold text-slate-700">出荷予定日</TableHead>
                    <TableHead className="font-bold text-slate-700">着日</TableHead>
                    <TableHead className="font-bold text-slate-700">備考</TableHead>
                    <TableHead className="orders-print-hide w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderListRows.map(({ group, item }, index) => {
                    const itemProductionDates = productionDates[item.id] ?? [];
                    const unitPerCs = item.products?.unit_per_cs || 24;
                    const { cs, p } = pcsToDisplay(item.quantity, unitPerCs);
                    const showOrderDetails = !group.customerOrderNo || firstRowByCustomerOrderNo.get(group.customerOrderNo) === index;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                        <TableCell className="font-medium">{showOrderDetails ? group.customerOrderNo || " " : ""}</TableCell>
                        <TableCell><div className="font-medium">{group.customerName || ""}</div><div className="text-xs text-slate-500">{showOrderDetails ? group.customerShortName || "" : ""}</div></TableCell>
                        <TableCell><div className="font-medium">{item.products?.name || "-"}</div>{item.products?.variant_name && <div className="text-xs text-slate-500">{item.products.variant_name}</div>}</TableCell>
                        <TableCell className="whitespace-nowrap">{cs} c/s {p > 0 && `${p}p`}</TableCell>
                        <TableCell className="min-w-52">
                          <div className="flex flex-col gap-1">
                            {itemProductionDates.map((entry) => (
                              <span key={entry.key}>{formatListDate(entry.overrideDate || entry.productionDate)}</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{formatListDate(group.plannedShipDate)}</TableCell>
                        <TableCell>{formatListDate(group.desiredShipDate)}</TableCell>
                        <TableCell>{item.remarks || "-"}</TableCell>
                        <TableCell className="orders-print-hide">
                          <div className="flex gap-1">
                            {canEdit && <Button variant="ghost" size="icon" onClick={() => openModal(group)} title="編集"><Edit className="h-4 w-4" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* カードビュー */}
      {displayMode === "cards" && (
        <div className="orders-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orderGroups.map((group) => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const isLate = new Date(group.plannedShipDate) < today;
            return (
              <Card key={group.groupId} className="hover:shadow-md transition-all border-slate-200 relative group">
                <CardHeader className="pb-2 bg-slate-50 border-b rounded-t-lg">
                  <div className="flex justify-between items-start pr-20">
                    <div>
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                        {group.groupId.slice(-6)}
                        {group.customerOrderNo && <Badge variant="outline" className="text-[10px] bg-white text-slate-500 py-0"><FileText className="w-3 h-3 mr-1"/>発注:{group.customerOrderNo}</Badge>}
                      </div>
                      <CardTitle className="text-lg text-slate-800 line-clamp-1" title={group.customerName}>{group.customerName}</CardTitle>
                    </div>
                  </div>
                  <div className="mt-2">
                    {group.status === 'received' && <Badge className="bg-amber-100 text-amber-800 border-none shadow-sm">出荷予定(未処理)</Badge>}
                    {group.status === 'in_production' && <Badge className="bg-blue-100 text-blue-800 border-none shadow-sm">製造中あり</Badge>}
                    {group.status === 'shipped' && <Badge className="bg-green-100 text-green-800 border-none shadow-sm">出荷済</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="p-0 bg-white rounded-b-lg">
                  <div className="divide-y divide-slate-100">
                    {group.items.map((item) => {
                      const unitPerCs = item.products?.unit_per_cs || 24;
                      const { cs, p } = pcsToDisplay(item.quantity, unitPerCs);
                      return (
                        <div key={item.id} className="px-4 py-3 flex justify-between items-center text-sm relative">
                          <div className="font-bold text-slate-700 truncate mr-2">
                            {item.products?.name} <span className="text-xs font-normal text-slate-500">({item.products?.variant_name})</span>
                          </div>
                          <div className="font-black text-lg text-blue-600 shrink-0">
                            {cs > 0 && <>{cs} <span className="text-[10px] font-normal text-slate-500">c/s</span></>}
                            {p > 0 && <span className="text-slate-700 ml-1">{p} <span className="text-[10px] font-normal text-slate-500">p</span></span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-4 py-3 border-t bg-slate-50 rounded-b-lg text-xs text-slate-500 space-y-1">
                    <div className="flex justify-between"><span>出荷予定:</span><span className={`font-bold ${isLate ? 'text-red-600' : 'text-blue-800'}`}>{formatListDate(group.plannedShipDate)} {isLate && '(遅延!)'}</span></div>
                    <div className="flex justify-between"><span>納入期限(着):</span><span className="font-bold text-slate-700">{formatListDate(group.desiredShipDate)}</span></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}