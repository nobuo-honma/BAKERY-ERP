"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    ArrowDownToLine,
    CalendarDays,
    Loader2,
    Plus,
    Printer,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Edit,
    Trash2,
    CheckCircle2,
    PackageCheck,
    Lock,
    FileText,
    ExternalLink,
    ClipboardCheck,
    PackagePlus,
    Sparkles,
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

type Item = {
    id: string;
    name: string;
    item_type: string;
    unit: string;
    item_stocks?: { quantity: number }[] | { quantity: number } | null;
};

type Order = {
    id: string;
    product_id: string;
    quantity: number;
    status: string;
    products?: {
        name: string;
        variant_name: string;
        unit_per_cs: number;
        unit_per_kg: number;
    };
};

type Bom = {
    id: string;
    product_id: string;
    item_id: string;
    usage_rate: number;
    basis_type: "production_qty" | "planned_cs";
};

type ProductionPlan = {
    product_id: string;
    production_date: string;
    production_kg: number;
    planned_cs: number;
    status?: string;
};

type ItemShortageInfo = {
    itemId: string;
    itemName: string;
    itemType: string;
    unit: string;
    stockQty: number;
    pendingQty: number;
    requiredQty: number;
    shortageWithStock: number;
    shortageWithArrival: number;
    orderCount: number;
};

type Arrival = {
    id: string;
    item_id: string;
    order_date: string;
    expected_date: string;
    quantity: number;
    unit: string;
    status: string;
    notes?: string;
    items?: {
        name: string;
        item_type: string;
    };
};

type Supplier = "hashiya" | "nexus";

// ===== 発注書印刷用のマスタデータ =====
const hashiyaItems = [
    { code: "", maker: "横山製粉", name: "あすなろミックス", spec: "20kg", unit: "1袋" },
    { code: "", maker: "日本製粉", name: "P15菓子パンミックス", spec: "20kg", unit: "1袋" },
    { code: "", maker: "キューピー", name: "凍結全卵", spec: "1kg×12本", unit: "1ケース" },
    { code: "", maker: "うめはら", name: "オレンジカット5㎜ A", spec: "1kg", unit: "1パック" },
    { code: "", maker: "川西製餡", name: "かのこ黒豆", spec: "2kg×1p", unit: "1袋" },
    { code: "", maker: "", name: "かのこ黒豆", spec: "2kg×2p", unit: "1ケース" },
    { code: "", maker: "森永商事", name: "キャラメル チョコチップ", spec: "5kg×2p", unit: "1ケース" },
    { code: "", maker: "理研", name: "Eオイルスーパー60", spec: "5kg", unit: "1缶" },
    { code: "", maker: "", name: "ミックスフルーツ", spec: "1kg×12p", unit: "1ケース" },
    { code: "", maker: "", name: "アップルチップ", spec: "2kg×6ｐ", unit: "1ケース" },
    { code: "", maker: "", name: "ホワイトチョコチップ", spec: "5kg×2p", unit: "1ケース" },
    { code: "", maker: "ニッテン", name: "FRイースト", spec: "500g×25", unit: "1ケース" },
    { code: "", maker: "月島食品", name: "ミルシア", spec: "5kg", unit: "1ケース" },
    { code: "", maker: "", name: "ルミナスグランデ", spec: "10kg", unit: "1ケース" },
    { code: "", maker: "", name: "ショコラクリュ ホワイト", spec: "5kg", unit: "1ケース" },
    { code: "", maker: "", name: "ドライストロベリーダイス", spec: "2.5kg×2", unit: "1ケース" },
    { code: "", maker: "川西フーズ", name: "パンプキンパウダー", spec: "1kg×5p", unit: "1ケース" },
];

const nexusItems = [
    { code: "", maker: "", name: "シーベリーペースト", spec: "1kg×15", unit: "1ケース" },
    { code: "", maker: "", name: "ハスカップペースト", spec: "1kg×15", unit: "1ケース" },
    { code: "", maker: "", name: "プチヴェール", spec: "1kg×10", unit: "1ケース" },
    { code: "", maker: "", name: "シーベリーペースト", spec: "1kg", unit: "1袋" },
    { code: "", maker: "", name: "ハスカップペースト", spec: "1kg", unit: "1袋" },
];

// ===== HACCP YO-14連携用のマッピングデータ =====
const yo14Items = [
    { id: "m1", name: "デリソフト" }, { id: "m2", name: "チョコチップHCEE" }, { id: "m3", name: "アクアクーベルホワイトカカオ" }, { id: "m4", name: "マスカルポーネ・レジェ" }, { id: "m5", name: "まめまーじゅUSA" }, { id: "m6", name: "ドライクランベリーBR" }, { id: "m7", name: "デザーンココアパウダーテラロッサ" }, { id: "m8", name: "あすなろミックス" }, { id: "m9", name: "コア粉" }, { id: "m10", name: "P15菓子パンミックス" }, { id: "m11", name: "凍結全卵" }, { id: "m12", name: "オレンジカット" }, { id: "m13", name: "かのこ黒豆" }, { id: "m14", name: "キャラメルチョコチップ" }, { id: "m15", name: "Eオイルスーパー６０" }, { id: "m16", name: "ミックスフルーツ" }, { id: "m17", name: "アップルチップ" }, { id: "m18", name: "ホワイトチョコチップ" }, { id: "m19", name: "ドライストロベリー" }, { id: "m20", name: "パンプキンパウダー" }, { id: "m21", name: "FRイースト" }, { id: "m22", name: "ミルシア" }, { id: "m23", name: "ルミナスグランデ" }, { id: "m24", name: "ショコラクリュホワイト" }, { id: "m25", name: "プチヴェール" }, { id: "m26", name: "シーベリーペースト" }, { id: "m27", name: "ハスカップペースト" }, { id: "m28", name: "デバイダーオイル" },
];

// ===== 日付ユーティリティ =====
const normalizeDateKey = (value?: string | null) => {
    if (!value) return "";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const getLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const formatDateJP = (value?: string | null) => {
    const key = normalizeDateKey(value);
    if (!key) return "-";
    const [y, m, d] = key.split("-");
    return `${y}/${m}/${d}`;
};

// 数値フォーマット用ヘルパー
const formatNumber = (val: number, itemType?: string) => {
    if (typeof val !== "number" || isNaN(val)) return "0";
    if (itemType === "material") {
        return Math.round(val).toLocaleString();
    }
    const rounded = Math.round(val * 100) / 100;
    return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// ===== 受注出荷済み判定ヘルパー =====
const isShippedStatus = (status?: string | null) => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "shipped" || s === "出荷済" || s === "出荷済み";
};

export default function ArrivalsPage() {
    const { canEdit } = useAuth();

    const [viewMode, setViewMode] = useState<"list" | "calendar" | "order_sheet">("list");
    const [loading, setLoading] = useState(true);

    const [items, setItems] = useState<Item[]>([]);
    const [arrivals, setArrivals] = useState<Arrival[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [boms, setBoms] = useState<Bom[]>([]);
    const [plans, setPlans] = useState<ProductionPlan[]>([]);
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    // 計算ソース切り替え状態 ("plan": 消費予定(製造計画), "order": 受注)
    const [calculationSource, setCalculationSource] = useState<"plan" | "order">("plan");

    const [newItemId, setNewItemId] = useState("");
    const [newOrderDate, setNewOrderDate] = useState("");
    const [newExpectedDate, setNewExpectedDate] = useState("");
    const [newQuantity, setNewQuantity] = useState<number | "">("");
    const [newNotes, setNewNotes] = useState("");

    const [editingArrival, setEditingArrival] = useState<Arrival | null>(null);
    const [editExpectedDate, setEditExpectedDate] = useState("");
    const [editQuantity, setEditQuantity] = useState<number | "">("");
    const [editNotes, setEditNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const [orderSheetOpen, setOrderSheetOpen] = useState(false);
    const [orderSupplier, setOrderSupplier] = useState<Supplier>("hashiya");
    const [orderDate, setOrderDate] = useState("");
    const [deliveryInfo, setDeliveryInfo] = useState("最短納品でお願いします。");
    const [orderQuantities, setOrderQuantities] = useState<Record<string, string>>({});

    // HACCP連携用のState
    const [showHaccpCheck, setShowHaccpCheck] = useState(false);
    const [haccpData, setHaccpData] = useState({
        expiry: "", lot: "", appearance: "ok" as 'ok' | 'ng' | null, smell: "ok" as 'ok' | 'ng' | null,
    });

    // 今日の日付キー
    const todayKey = useMemo(() => getLocalDateKey(new Date()), []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [itemsRes, arrivalsRes, ordersRes, bomsRes, plansRes] = await Promise.all([
                supabase
                    .from("items")
                    .select("*, item_stocks(quantity)")
                    .order("item_type", { ascending: true })
                    .order("id", { ascending: true }),
                supabase
                    .from("arrivals")
                    .select("*, items(name, item_type)")
                    .order("status", { ascending: false })
                    .order("expected_date", { ascending: true }),
                supabase
                    .from("orders")
                    .select("*, products(name, variant_name, unit_per_cs, unit_per_kg)"),
                supabase
                    .from("bom")
                    .select("*"),
                supabase
                    .from("production_plans")
                    .select("*")
                    .eq("status", "planned"),
            ]);

            if (itemsRes.error) console.error("items fetch error:", itemsRes.error);
            if (arrivalsRes.error) console.error("arrivals fetch error:", arrivalsRes.error);
            if (ordersRes.error) console.error("orders fetch error:", ordersRes.error);
            if (bomsRes.error) console.error("boms fetch error:", bomsRes.error);
            if (plansRes.error) console.error("plans fetch error:", plansRes.error);

            if (itemsRes.data) setItems(itemsRes.data as Item[]);
            if (arrivalsRes.data) setArrivals(arrivalsRes.data as Arrival[]);

            if (ordersRes.data) {
                const activeOrders = (ordersRes.data as Order[]).filter(
                    (o) => !isShippedStatus(o.status)
                );
                setOrders(activeOrders);
            }
            if (bomsRes.data) setBoms(bomsRes.data as Bom[]);
            if (plansRes.data) setPlans(plansRes.data as ProductionPlan[]);

            const today = getLocalDateKey(new Date());
            setNewOrderDate(today);
            setNewExpectedDate(today);
            setOrderDate(today);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 切り替えスイッチに基づき、資材・原材料の消費予定・不足状況を計算
    const shortageList = useMemo(() => {
        if (!items.length) return [];

        const map: Record<string, { requiredQty: number; count: number }> = {};

        items.forEach((item) => {
            map[item.id] = { requiredQty: 0, count: 0 };
        });

        if (calculationSource === "order") {
            // 【受注ベース】の計算
            const unshippedOrders = orders.filter((o) => !isShippedStatus(o.status));

            unshippedOrders.forEach((ord) => {
                if (!ord.product_id || !ord.quantity) return;
                const prod = ord.products;
                const unitCs = prod?.unit_per_cs || 1;
                const unitKg = prod?.unit_per_kg || 0;
                const totalPcs = ord.quantity * unitCs;
                const productionKg = unitKg ? totalPcs / unitKg : 0;
                const csCount = ord.quantity;

                const productBoms = boms.filter((b) => b.product_id === ord.product_id);
                productBoms.forEach((bom) => {
                    if (!map[bom.item_id]) {
                        map[bom.item_id] = { requiredQty: 0, count: 0 };
                    }
                    const req = bom.basis_type === "production_qty"
                        ? productionKg * bom.usage_rate
                        : csCount * bom.usage_rate;

                    map[bom.item_id].requiredQty += req;
                    map[bom.item_id].count += 1;
                });
            });
        } else {
            // 【消費予定（製造計画）ベース】の計算
            plans.forEach((plan) => {
                if (!plan.product_id) return;
                const productBoms = boms.filter((b) => b.product_id === plan.product_id);
                productBoms.forEach((bom) => {
                    if (!map[bom.item_id]) {
                        map[bom.item_id] = { requiredQty: 0, count: 0 };
                    }
                    const req = bom.basis_type === "production_qty"
                        ? plan.production_kg * bom.usage_rate
                        : plan.planned_cs * bom.usage_rate;

                    map[bom.item_id].requiredQty += req;
                    map[bom.item_id].count += 1;
                });
            });
        }

        return items.map((item) => {
            const stockArr = Array.isArray(item.item_stocks)
                ? item.item_stocks
                : item.item_stocks
                    ? [item.item_stocks]
                    : [];
            const rawStock = stockArr[0]?.quantity || 0;

            const rawPending = arrivals
                .filter((a) => a.item_id === item.id && a.status === "pending")
                .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);

            const rawRequired = map[item.id]?.requiredQty || 0;

            const isMaterial = item.item_type === "material";
            const requiredQty = isMaterial ? Math.round(rawRequired) : Math.round(rawRequired * 100) / 100;
            const stockQty = isMaterial ? Math.round(rawStock) : Math.round(rawStock * 100) / 100;
            const pendingQty = isMaterial ? Math.round(rawPending) : Math.round(rawPending * 100) / 100;

            const shortageWithStock = Math.max(0, isMaterial ? Math.round(requiredQty - stockQty) : Math.round((requiredQty - stockQty) * 100) / 100);
            const shortageWithArrival = Math.max(0, isMaterial ? Math.round(requiredQty - (stockQty + pendingQty)) : Math.round((requiredQty - (stockQty + pendingQty)) * 100) / 100);

            return {
                itemId: item.id,
                itemName: item.name,
                itemType: item.item_type,
                unit: item.unit,
                stockQty,
                pendingQty,
                requiredQty,
                shortageWithStock,
                shortageWithArrival,
                orderCount: map[item.id]?.count || 0,
            };
        });
    }, [items, orders, plans, boms, arrivals, calculationSource]);

    // 必要量が0より大きく、不足しているものを優先したリスト
    const neededItems = useMemo(() => {
        return shortageList
            .filter((i) => i.requiredQty > 0)
            .sort((a, b) => {
                const aShort = a.shortageWithArrival > 0 ? 2 : (a.shortageWithStock > 0 ? 1 : 0);
                const bShort = b.shortageWithArrival > 0 ? 2 : (b.shortageWithStock > 0 ? 1 : 0);
                if (bShort !== aShort) return bShort - aShort;
                return b.requiredQty - a.requiredQty;
            });
    }, [shortageList]);

    // フォームで選択中の品目の不足情報
    const selectedItemShortage = useMemo(() => {
        if (!newItemId) return null;
        return shortageList.find((i) => i.itemId === newItemId) || null;
    }, [newItemId, shortageList]);

    // 不足資材のワンクリック自動入力
    const fillArrivalFormForShortage = (itemInfo: ItemShortageInfo) => {
        setNewItemId(itemInfo.itemId);
        const targetQty = itemInfo.shortageWithArrival > 0 ? itemInfo.shortageWithArrival : itemInfo.shortageWithStock;
        const roundedQty = itemInfo.itemType === "raw_material" ? Math.ceil(targetQty * 10) / 10 : Math.ceil(targetQty);
        setNewQuantity(roundedQty);
        setNewNotes(
            calculationSource === "plan"
                ? `製造計画補給 (${itemInfo.orderCount}件の製造)`
                : `受注不足補給 (${itemInfo.orderCount}件の受注)`
        );

        const formElement = document.getElementById("new-arrival-form");
        if (formElement) {
            formElement.scrollIntoView({ behavior: "smooth" });
        }
    };

    const selectedItemUnit = items.find((i) => i.id === newItemId)?.unit || "";

    const handleSaveArrival = async () => {
        if (!newItemId || !newOrderDate || !newExpectedDate || newQuantity === "" || Number(newQuantity) <= 0) {
            alert("必須項目を入力してください。");
            return;
        }

        try {
            const dateStr = newOrderDate.replace(/-/g, "");
            const random3 = Math.floor(Math.random() * 1000).toString().padStart(3, "0");

            const newArrival = {
                id: `INC-${dateStr}-${random3}`,
                item_id: newItemId,
                order_date: newOrderDate,
                expected_date: newExpectedDate,
                quantity: Number(newQuantity),
                unit: selectedItemUnit,
                status: "pending",
                notes: newNotes,
            };

            const { error } = await supabase.from("arrivals").insert(newArrival);
            if (error) {
                alert("エラー: " + error.message);
                return;
            }

            alert("予定を登録しました！");
            setNewItemId("");
            setNewQuantity("");
            setNewNotes("");
            await fetchData();
        } catch (err) {
            console.error(err);
            alert("登録中にエラーが発生しました。");
        }
    };

    const openEditDialog = (arrival: Arrival) => {
        setEditingArrival(arrival);
        setEditExpectedDate(normalizeDateKey(arrival.expected_date));
        setEditQuantity(arrival.quantity);
        setEditNotes(arrival.notes || "");
        setShowHaccpCheck(false);
        setHaccpData({ expiry: "", lot: "", appearance: "ok", smell: "ok" });
    };

    const handleUpdateArrival = async () => {
        if (!editingArrival || !editExpectedDate || editQuantity === "" || Number(editQuantity) <= 0) return;

        setIsProcessing(true);
        try {
            const { error } = await supabase
                .from("arrivals")
                .update({
                    expected_date: editExpectedDate,
                    quantity: Number(editQuantity),
                    notes: editNotes,
                })
                .eq("id", editingArrival.id);

            if (error) {
                alert("更新失敗: " + error.message);
                return;
            }

            setEditingArrival(null);
            await fetchData();
        } catch (err) {
            console.error(err);
            alert("更新中にエラーが発生しました。");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteArrival = async () => {
        if (!editingArrival) return;
        if (editingArrival.status === "arrived") {
            alert("入荷済みのデータは削除できません。");
            return;
        }
        if (!confirm("削除しますか？")) return;

        setIsProcessing(true);
        try {
            const { error } = await supabase.from("arrivals").delete().eq("id", editingArrival.id);

            if (error) {
                alert("削除失敗: " + error.message);
                return;
            }

            setEditingArrival(null);
            await fetchData();
        } catch (err) {
            console.error(err);
            alert("削除中にエラーが発生しました。");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleProceedToHaccpCheck = () => {
        setShowHaccpCheck(true);
    };

    const handleCompleteArrival = async () => {
        if (!editingArrival) return;
        setIsProcessing(true);

        try {
            const { data: stock, error: stockError } = await supabase
                .from("item_stocks")
                .select("quantity")
                .eq("item_id", editingArrival.item_id)
                .single();

            if (stockError && stockError.code !== "PGRST116") {
                throw stockError;
            }

            const beforeQty = stock?.quantity || 0;
            const newQty = beforeQty + editingArrival.quantity;

            const { error: upsertError } = await supabase
                .from("item_stocks")
                .upsert({ item_id: editingArrival.item_id, quantity: newQty });

            if (upsertError) throw upsertError;

            const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert({
                item_id: editingArrival.item_id,
                before_qty: beforeQty,
                after_qty: newQty,
                reason: "入荷",
            });

            if (adjustmentError) throw adjustmentError;

            const { error: arrivalUpdateError } = await supabase
                .from("arrivals")
                .update({ status: "arrived" })
                .eq("id", editingArrival.id);

            if (arrivalUpdateError) throw arrivalUpdateError;

            const todayStr = getLocalDateKey(new Date());
            const itemName = editingArrival.items?.name || "";
            const matchedItem = yo14Items.find(i => itemName.includes(i.name) || i.name.includes(itemName));

            if (matchedItem) {
                const { data: existingHaccp } = await supabase.from('material_receiving_checks').select('*').eq('check_date', todayStr).maybeSingle();
                const currentResults = existingHaccp?.results || {};

                currentResults[matchedItem.id] = {
                    expiry: haccpData.expiry,
                    lot: haccpData.lot,
                    qty: editingArrival.quantity.toString(),
                    appearance: haccpData.appearance,
                    smell: haccpData.smell
                };

                const haccpPayload = {
                    check_date: todayStr,
                    results: currentResults,
                    checker_name: existingHaccp?.checker_name || "自動連携 (システム)",
                    updated_at: new Date().toISOString()
                };

                const { error: haccpError } = await supabase.from('material_receiving_checks').upsert(haccpPayload, { onConflict: 'check_date' });
                if (haccpError) console.error("HACCP連携エラー:", haccpError);
            }

            setEditingArrival(null);
            setShowHaccpCheck(false);
            await fetchData();
            alert(`入荷処理が完了し、在庫に加算されました！\n${matchedItem ? "（HACCP受入台帳にも自動記録しました）" : "（※この品目はHACCP受入台帳の対象外です）"}`);

        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : String(err);
            alert("入荷処理中にエラーが発生しました: " + message);
        } finally {
            setIsProcessing(false);
        }
    };

    const getCalendarDays = () => {
        const y = calendarMonth.getFullYear();
        const m = calendarMonth.getMonth();
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        const blanks = Array(firstDay).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const totalSlots = blanks.length + days.length;
        const trailingBlanks = Array(Math.ceil(totalSlots / 7) * 7 - totalSlots).fill(null);

        return [...blanks, ...days, ...trailingBlanks];
    };

    const handleOrderQuantityChange = (key: string, value: string) => {
        setOrderQuantities((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const openOrderSheetDialog = () => {
        setOrderQuantities({});
        setOrderSheetOpen(true);
    };

    const handleCreateOrderSheet = () => {
        setOrderSheetOpen(false);
        setViewMode("order_sheet");
    };

    // =======================================================================
    // 発注書表示 (PDF)
    // =======================================================================
    if (viewMode === "order_sheet") {
        const currentItems = orderSupplier === "hashiya" ? hashiyaItems : nexusItems;
        const orderDateObj = orderDate ? new Date(`${orderDate}T00:00:00`) : new Date();
        const reiwaYear = orderDateObj.getFullYear() - 2018;
        const dateStr = `令和${reiwaYear}年${orderDateObj.getMonth() + 1}月${orderDateObj.getDate()}日 (${["日", "月", "火", "水", "木", "金", "土"][orderDateObj.getDay()]})`;

        return (
            <div className="bg-slate-200 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            header, nav { display: none !important; }
                            main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: white !important; }
                            @page { size: A4 portrait; margin: 15mm; }
                            body { background-color: white !important; color: black !important; }
                            .print-hide { display: none !important; }
                        }
                    `,
                    }}
                />
                <div className="w-[210mm] print:w-full flex justify-between mb-4 print-hide">
                    <Button
                        variant="outline"
                        onClick={() => setViewMode("list")}
                        className="bg-white text-slate-700 font-bold border-slate-300"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        戻る
                    </Button>
                    <Button
                        onClick={() => window.print()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
                    >
                        <Printer className="h-5 w-5 mr-2" />
                        印刷する (PDFに保存)
                    </Button>
                </div>

                <div className="w-[210mm] min-h-[297mm] bg-white p-12 print:p-0 shadow-xl print:shadow-none text-black font-sans box-border">
                    <h1 className="text-3xl font-bold tracking-[1.5em] text-center mb-16 ml-[1.5em]">発注書</h1>

                    <div className="flex justify-between items-start mb-12">
                        <div className="text-xl font-bold">
                            {orderSupplier === "hashiya" ? "橋谷㈱" : "㈱ネクス"}　御中
                        </div>
                        <div className="text-sm text-right leading-relaxed font-medium">
                            社会福祉法人　小樽高島福祉会
                            <br />
                            ワークセンター・やまびこ
                            <br />
                            <br />
                            TEL　0134-21-0011
                            <br />
                            FAX　0134-21-0022
                            <br />
                            <br />
                            担当者　本間
                        </div>
                    </div>

                    <div className="mb-6 space-y-3 text-sm font-medium">
                        <div className="flex">
                            <div className="w-28">発注日</div>
                            <div>{dateStr}</div>
                        </div>
                        {orderSupplier === "hashiya" && (
                            <div className="flex">
                                <div className="w-28">納期希望日</div>
                                <div>{deliveryInfo}</div>
                            </div>
                        )}
                    </div>

                    <table className="w-full border-collapse border-2 border-black text-sm">
                        <thead>
                            <tr className="bg-white">
                                <th className="border border-black py-2 px-1 w-[12%] font-medium">コード</th>
                                <th className="border border-black py-2 px-1 w-[18%] font-medium">メーカー</th>
                                <th className="border border-black py-2 px-1 w-[35%] font-medium">商品名</th>
                                <th className="border border-black py-2 px-1 w-[15%] font-medium">規格</th>
                                <th className="border border-black py-2 px-1 w-[8%] font-medium">単位</th>
                                <th className="border border-black py-2 px-1 w-[12%] font-medium">発注数量</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentItems.map((item, idx) => {
                                const key = `${item.name}-${item.spec}`;
                                const qty = orderQuantities[key] || "";

                                return (
                                    <tr key={idx} className="h-9">
                                        <td className="border border-black px-2 text-center">{item.code}</td>
                                        <td className="border border-black px-2">{item.maker}</td>
                                        <td className="border border-black px-2">{item.name}</td>
                                        <td className="border border-black px-2 text-right">{item.spec}</td>
                                        <td className="border border-black px-2 text-center">{item.unit}</td>
                                        <td className="border border-black px-2 text-center font-bold text-lg">{qty}</td>
                                    </tr>
                                );
                            })}
                            {Array.from({ length: Math.max(0, 22 - currentItems.length) }).map((_, idx) => (
                                <tr key={`empty-${idx}`} className="h-9">
                                    <td className="border border-black" />
                                    <td className="border border-black" />
                                    <td className="border border-black" />
                                    <td className="border border-black" />
                                    <td className="border border-black" />
                                    <td className="border border-black" />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // =======================================================================
    // カレンダー表示
    // =======================================================================
    if (viewMode === "calendar") {
        const daysArray = getCalendarDays();
        const currentYear = calendarMonth.getFullYear();
        const currentMonthNum = calendarMonth.getMonth() + 1;
        const currentMonthStr = String(currentMonthNum).padStart(2, "0");
        const lastDay = new Date(currentYear, calendarMonth.getMonth() + 1, 0).getDate();

        const startDate = `${currentYear}-${currentMonthStr}-01`;
        const endDate = `${currentYear}-${currentMonthStr}-${String(lastDay).padStart(2, "0")}`;

        const calendarData = arrivals.filter((a) => {
            const dateKey = normalizeDateKey(a.expected_date);
            return dateKey >= startDate && dateKey <= endDate;
        });

        return (
            <div className="bg-white min-h-screen print:p-0 print:m-0 -mx-4 px-4 md:mx-0 md:px-0 pt-4 md:pt-0">
                <style dangerouslySetInnerHTML={{ __html: `@media print { header { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; } @page { size: landscape; margin: 10mm; } body { background-color: white !important; } }` }} />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden bg-slate-50 p-4 rounded-lg border shadow-sm">
                    <Button variant="outline" onClick={() => setViewMode("list")} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">入力へ戻る</span>
                        <span className="sm:hidden">戻る</span>
                    </Button>

                    <div className="flex items-center justify-center gap-4 w-full md:w-auto">
                        <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}>
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <h2 className="text-xl font-bold text-slate-800 w-32 text-center">
                            {currentYear}年 {currentMonthStr}月
                        </h2>
                        <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}>
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>

                    <div className="flex justify-end w-full md:w-auto">
                        <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold shadow-sm w-full md:w-auto">
                            <Printer className="h-4 w-4" /> 印刷
                        </Button>
                    </div>
                </div>

                <div className="hidden print:flex justify-between items-end mb-3 border-b-2 border-black pb-2">
                    <div className="text-2xl font-black">入荷予定表 ({currentYear}年 {currentMonthStr}月)</div>
                    <div className="text-sm font-bold">更新日: {formatDateJP(getLocalDateKey(new Date()))}</div>
                </div>

                <div className="border border-slate-300 rounded-lg md:rounded-sm overflow-hidden print:border-black print:border-2">
                    <div className="hidden md:block print:block">
                        <div className="grid grid-cols-7 bg-slate-100 print:bg-gray-200 border-b border-slate-300 print:border-black">
                            {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
                                <div key={d} className={`p-2 text-center font-bold text-sm border-r border-slate-300 print:border-black last:border-r-0 ${i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : "text-slate-700 print:text-black"}`}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {daysArray.map((day, idx) => {
                                const dateStr = day ? `${currentYear}-${currentMonthStr}-${String(day).padStart(2, "0")}` : null;
                                const dayArrivals = dateStr ? calendarData.filter((a) => normalizeDateKey(a.expected_date) === dateStr) : [];

                                return (
                                    <div key={idx} className={`min-h-35 print:min-h-25 border-b border-slate-300 print:border-black p-1 ${idx % 7 !== 6 ? "border-r print:border-black" : ""} ${!day ? "bg-slate-50 print:bg-white" : "bg-white"}`}>
                                        {day && (
                                            <>
                                                <div className={`text-right font-bold text-sm mb-1 ${idx % 7 === 0 ? "text-red-600" : idx % 7 === 6 ? "text-blue-600" : "text-slate-700 print:text-black"}`}>
                                                    {day}
                                                </div>
                                                <div className="space-y-1.5 print:space-y-1">
                                                    {dayArrivals.map((arr) => (
                                                        <div key={arr.id} onClick={(e) => { e.stopPropagation(); openEditDialog(arr); }} className={`${arr.status === "arrived" ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200"} border rounded p-1.5 print:p-1 cursor-pointer hover:shadow-md text-xs leading-tight wrap-break-word relative group`}>
                                                            {canEdit && (
                                                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 print:hidden text-slate-400">
                                                                    <Edit className="h-3 w-3" />
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] text-slate-500 print:text-black mb-0.5">
                                                                {arr.items?.item_type === "raw_material" ? "原料" : "資材"}
                                                            </div>
                                                            <div className="font-bold text-slate-800 print:text-black pr-3">
                                                                {arr.items?.name}
                                                            </div>
                                                            <div className="font-black text-blue-700 print:text-black mt-0.5">
                                                                {arr.quantity.toLocaleString()} <span className="font-normal text-[10px]">{arr.unit}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="block md:hidden print:hidden divide-y divide-slate-200 bg-slate-50">
                        {daysArray.filter((d) => d !== null).map((day) => {
                            const dateStr = `${currentYear}-${currentMonthStr}-${String(day).padStart(2, "0")}`;
                            const dObj = new Date(currentYear, calendarMonth.getMonth(), day as number);
                            const dow = dObj.getDay();
                            const dowStr = ["日", "月", "火", "水", "木", "金", "土"][dow];
                            const dowColor = dow === 0 ? "text-red-600" : dow === 6 ? "text-blue-600" : "text-slate-700";
                            const dayArrivals = calendarData.filter((a) => normalizeDateKey(a.expected_date) === dateStr);

                            return (
                                <div key={day} className={`flex p-3 ${dow === 0 ? "bg-red-50/30" : dow === 6 ? "bg-blue-50/30" : "bg-white"}`}>
                                    <div className="w-12 shrink-0 flex flex-col items-center pt-1 border-r border-slate-100 mr-3 pr-1">
                                        <span className={`text-xl font-black leading-none ${dowColor}`}>{day}</span>
                                        <span className={`text-[10px] mt-1 font-bold ${dowColor}`}>{dowStr}</span>
                                    </div>

                                    <div className="flex-1 space-y-2.5 py-1 min-h-12">
                                        {dayArrivals.map((arr) => (
                                            <div key={arr.id} onClick={(e) => { e.stopPropagation(); openEditDialog(arr); }} className={`${arr.status === "arrived" ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200"} border rounded p-2.5 text-xs shadow-sm relative group cursor-pointer hover:bg-slate-50`}>
                                                <div className="flex justify-between items-start mb-1.5 border-b border-white/40 pb-1.5">
                                                    <div className="text-[10px] text-slate-500 font-bold">
                                                        {arr.items?.item_type === "raw_material" ? "原料" : "資材"}
                                                    </div>
                                                    {arr.status === "arrived" ? (
                                                        <span className="text-[10px] bg-green-600 text-white px-1.5 rounded font-bold flex items-center gap-0.5">
                                                            <CheckCircle2 className="h-2.5 w-2.5" /> 入荷済
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] bg-blue-500 text-white px-1.5 rounded font-bold flex items-center gap-0.5">
                                                            <PackageCheck className="h-2.5 w-2.5" /> 発注済
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-bold text-slate-800 text-sm mb-1.5">
                                                    {arr.items?.name}
                                                </div>
                                                <div className="flex justify-between items-end gap-2">
                                                    <div className="text-[10px] text-slate-500 italic max-w-[60%] truncate bg-white/50 p-1 rounded">
                                                        {arr.notes || "-"}
                                                    </div>
                                                    <div className="font-black text-blue-700 text-lg whitespace-nowrap">
                                                        {arr.quantity.toLocaleString()} <span className="font-normal text-xs text-slate-500">{arr.unit}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {dayArrivals.length === 0 && (
                                            <div className="text-xs text-slate-400 flex h-full items-center justify-center font-medium border border-dashed rounded-lg py-4 bg-slate-50/50">入荷予定なし</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
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
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <ArrowDownToLine className="h-6 w-6 text-blue-600" />
                        入荷管理
                    </h1>
                    {!canEdit && (
                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm hidden md:flex">
                            <Lock className="w-3 h-3 mr-1" /> 閲覧モード
                        </Badge>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    <Button onClick={() => window.open("https://tano.mu/item?page=1", "_blank", "noopener,noreferrer")} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm h-12 md:h-10">
                        <ExternalLink className="h-4 w-4 mr-2" /> 大槻食材へ
                    </Button>
                    <Button onClick={openOrderSheetDialog} className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm h-12 md:h-10">
                        <FileText className="h-4 w-4 mr-2" /> 発注書(PDF)作成
                    </Button>
                    <Button onClick={() => setViewMode("calendar")} variant="outline" className="w-full sm:w-auto border-blue-300 text-blue-700 hover:bg-blue-50 gap-2 font-bold shadow-sm h-12 md:h-10">
                        <CalendarDays className="h-5 w-5" /> カレンダー表示
                    </Button>
                </div>
            </div>

            {/* 3カラム構成（左に入力フォーム、中央に予定、右に必要/不足サイドバー） */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* 左・中央エリア (8カラム) */}
                <div className="xl:col-span-8 space-y-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* 入力フォーム (40%) */}
                        <div className="w-full lg:w-[40%]">
                            {canEdit ? (
                                <Card id="new-arrival-form" className="border-slate-200 shadow-sm sticky top-24 scroll-mt-24">
                                    <CardHeader className="bg-slate-50 pb-4 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Plus className="h-5 w-5 text-blue-600" /> 新規入荷予定の登録
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold mb-1">対象品目</label>
                                            <select value={newItemId} onChange={(e) => setNewItemId(e.target.value)} className="w-full border border-blue-200 rounded-md p-2.5 text-sm bg-white focus:ring-blue-500 font-medium">
                                                <option value="">品目を選択</option>
                                                <optgroup label="原材料">
                                                    {items.filter((i) => i.item_type === "raw_material").map((i) => {
                                                        const shortInfo = shortageList.find((s) => s.itemId === i.id);
                                                        const hasShort = shortInfo && (shortInfo.shortageWithArrival > 0 || shortInfo.shortageWithStock > 0);
                                                        const displayShort = shortInfo ? (shortInfo.shortageWithArrival > 0 ? shortInfo.shortageWithArrival : shortInfo.shortageWithStock) : 0;
                                                        return (
                                                            <option key={i.id} value={i.id}>
                                                                {i.name} {hasShort ? `⚠️ (不足: ${formatNumber(displayShort, i.item_type)}${i.unit})` : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                                <optgroup label="資材">
                                                    {items.filter((i) => i.item_type === "material").map((i) => {
                                                        const shortInfo = shortageList.find((s) => s.itemId === i.id);
                                                        const hasShort = shortInfo && (shortInfo.shortageWithArrival > 0 || shortInfo.shortageWithStock > 0);
                                                        const displayShort = shortInfo ? (shortInfo.shortageWithArrival > 0 ? shortInfo.shortageWithArrival : shortInfo.shortageWithStock) : 0;
                                                        return (
                                                            <option key={i.id} value={i.id}>
                                                                {i.name} {hasShort ? `⚠️ (不足: ${formatNumber(displayShort, i.item_type)}${i.unit})` : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            </select>
                                        </div>

                                        {/* 選択中の品目の不足ガイドアシスト */}
                                        {selectedItemShortage && (selectedItemShortage.shortageWithStock > 0 || selectedItemShortage.requiredQty > 0) && (
                                            <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-3 text-xs space-y-1.5">
                                                <div className="flex justify-between items-center font-bold text-blue-900 border-b border-blue-200/60 pb-1">
                                                    <span className="flex items-center gap-1">
                                                        <Sparkles className="w-3.5 h-3.5 text-blue-600" /> 受注・計画アシスト
                                                    </span>
                                                    <Badge variant="outline" className="bg-white text-blue-700 border-blue-300 text-[10px]">
                                                        {calculationSource === "plan" ? "計画" : "受注"}{selectedItemShortage.orderCount}件対象
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-700">
                                                    <div>必要量: <span className="font-bold text-slate-900">{formatNumber(selectedItemShortage.requiredQty, selectedItemShortage.itemType)} {selectedItemShortage.unit}</span></div>
                                                    <div>現在庫数: <span className="font-bold text-slate-900">{formatNumber(selectedItemShortage.stockQty, selectedItemShortage.itemType)} {selectedItemShortage.unit}</span></div>
                                                    <div>入荷予定数: <span className="font-bold text-blue-700">+{formatNumber(selectedItemShortage.pendingQty, selectedItemShortage.itemType)} {selectedItemShortage.unit}</span></div>
                                                    <div>
                                                        不足量: <span className={`font-bold ${selectedItemShortage.shortageWithArrival > 0 ? 'text-red-600 font-black' : 'text-amber-700'}`}>
                                                            {selectedItemShortage.shortageWithArrival > 0 ? formatNumber(selectedItemShortage.shortageWithArrival, selectedItemShortage.itemType) : formatNumber(selectedItemShortage.shortageWithStock, selectedItemShortage.itemType)} {selectedItemShortage.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                                {selectedItemShortage.shortageWithStock > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            const targetQty = selectedItemShortage.shortageWithArrival > 0 ? selectedItemShortage.shortageWithArrival : selectedItemShortage.shortageWithStock;
                                                            const roundedQty = selectedItemShortage.itemType === "raw_material" ? Math.ceil(targetQty * 10) / 10 : Math.ceil(targetQty);
                                                            setNewQuantity(roundedQty);
                                                        }}
                                                        className="w-full text-[11px] h-7 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold mt-1"
                                                    >
                                                        不足数を数量フォームに適用
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold mb-1">発注日</label>
                                                <Input type="date" value={newOrderDate} onChange={(e) => setNewOrderDate(e.target.value)} className="bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold mb-1 text-blue-800">入荷予定日</label>
                                                <Input type="date" value={newExpectedDate} onChange={(e) => setNewExpectedDate(e.target.value)} className="bg-white border-blue-300 shadow-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-1">発注数</label>
                                            <div className="flex items-center gap-3">
                                                <Input type="number" min="0" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value === "" ? "" : Number(e.target.value))} className="text-xl font-bold text-right border-blue-300 shadow-sm h-12" />
                                                <span className="text-lg font-bold text-slate-500 w-12">{selectedItemUnit || "-"}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-1">備考</label>
                                            <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="発注先など..." className="w-full p-2 border border-slate-300 rounded-md text-sm resize-none h-20" />
                                        </div>
                                        <div className="pt-2">
                                            <Button onClick={handleSaveArrival} disabled={!newItemId || newQuantity === "" || Number(newQuantity) <= 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-sm">
                                                予定を登録する
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-slate-200 bg-slate-50 opacity-70">
                                    <CardHeader className="bg-slate-50 pb-4 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2"><Lock className="h-5 w-5" /> 閲覧モード</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-8 text-center text-slate-500">
                                        <Lock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                        <p className="font-bold">閲覧モードのため、新規登録はできません。</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* 直近の予定・実績テーブル (60%) */}
                        <div className="w-full lg:w-[60%]">
                            <h2 className="font-bold text-slate-700 mb-3">直近の入荷予定・実績</h2>
                            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                                <Table className="min-w-140">
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead>入荷予定日</TableHead>
                                            <TableHead>品目</TableHead>
                                            <TableHead className="text-right">数量</TableHead>
                                            <TableHead className="w-24">状況</TableHead>
                                            <TableHead className="w-20 text-center">詳細</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arrivals.slice(0, 15).map((arrival) => {
                                            const expectedDateKey = normalizeDateKey(arrival.expected_date);
                                            const isOverdue = arrival.status === "pending" && expectedDateKey < todayKey;

                                            return (
                                                <TableRow key={arrival.id} className="hover:bg-slate-50">
                                                    <TableCell className={isOverdue ? "text-red-600 font-bold" : ""}>
                                                        {formatDateJP(arrival.expected_date)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-bold text-slate-800 text-xs md:text-sm">{arrival.items?.name}</div>
                                                        <div className="text-[10px] text-slate-500">{arrival.items?.item_type === "raw_material" ? "原料" : "資材"}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-base md:text-lg text-blue-700">
                                                        {arrival.quantity.toLocaleString()} <span className="text-xs font-normal text-slate-500">{arrival.unit}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {arrival.status === "arrived" ? (
                                                            <Badge className="bg-green-100 text-green-800 border-none shadow-none text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />入荷済</Badge>
                                                        ) : (
                                                            <Badge className="bg-blue-500 text-white border-none shadow-none text-[10px]"><PackageCheck className="w-3 h-3 mr-1" />発注済</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(arrival); }} className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs h-7 px-2">確認</Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {loading && arrivals.length === 0 && (
                                            <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></TableCell></TableRow>
                                        )}

                                        {!loading && arrivals.length === 0 && (
                                            <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500 border border-dashed rounded-lg bg-white">データがありません</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 右一列：必要・消費状況サイドバー (4カラム) */}
                <div className="xl:col-span-4">
                    <Card className="border-slate-200 shadow-sm h-full flex flex-col max-h-[85vh] sticky top-24">
                        <CardHeader className="bg-slate-50/80 pb-3 border-b space-y-2 sticky top-0 z-10">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold text-slate-850 flex items-center gap-2">
                                    <ClipboardCheck className="h-4 w-4 text-blue-600" />
                                    必要量・消費状況
                                </CardTitle>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] border-blue-200">
                                    {calculationSource === "plan" ? `計画 ${plans.length} 件` : `未出荷受注 ${orders.length} 件`}
                                </Badge>
                            </div>

                            {/* 計算ソース切り替えスイッチ */}
                            <div className="flex bg-slate-100 p-1 rounded-lg w-full">
                                <button
                                    onClick={() => setCalculationSource("plan")}
                                    className={`flex-1 text-[11px] py-1 px-2 rounded font-bold transition-all ${calculationSource === "plan"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    消費予定 (計画)
                                </button>
                                <button
                                    onClick={() => setCalculationSource("order")}
                                    className={`flex-1 text-[11px] py-1 px-2 rounded font-bold transition-all ${calculationSource === "order"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    受注ベース
                                </button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-3 overflow-y-auto space-y-3 flex-1 scrollbar-thin scrollbar-thumb-slate-200">
                            {neededItems.length === 0 ? (
                                <div className="text-center py-12 text-xs text-slate-400 font-medium">
                                    {calculationSource === "plan"
                                        ? "現在登録されている製造計画に必要な品目はありません。"
                                        : "現在登録されている未出荷の受注に必要な品目はありません。"}
                                </div>
                            ) : (
                                neededItems.map((item) => {
                                    const isCritical = item.shortageWithArrival > 0;
                                    const isShort = item.shortageWithStock > 0;

                                    return (
                                        <div
                                            key={item.itemId}
                                            className={`p-3 rounded-lg border transition-all duration-200 text-xs ${isCritical
                                                    ? "bg-red-50/30 border-red-200 hover:border-red-300 shadow-sm"
                                                    : isShort
                                                        ? "bg-amber-50/30 border-amber-200 hover:border-amber-300 shadow-sm"
                                                        : "bg-white border-slate-200 hover:border-slate-300"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                                <div className="truncate">
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 mr-1.5">
                                                        {item.itemType === "raw_material" ? "原料" : "資材"}
                                                    </span>
                                                    <span className="font-bold text-slate-800 text-xs truncate" title={item.itemName}>
                                                        {item.itemName}
                                                    </span>
                                                </div>
                                                {isCritical ? (
                                                    <Badge className="bg-red-500 text-white text-[9px] px-1.5 h-4 font-bold shrink-0 shadow-none">
                                                        欠品警戒
                                                    </Badge>
                                                ) : isShort ? (
                                                    <Badge className="bg-amber-500 text-white text-[9px] px-1.5 h-4 font-bold shrink-0 shadow-none">
                                                        予定で補填可
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] px-1.5 h-4 font-bold shrink-0 shadow-none">
                                                        確保済
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600 mb-2.5 bg-slate-50/50 p-2 rounded border border-slate-100">
                                                <div className="flex justify-between">
                                                    <span>必要量:</span>
                                                    <span className="font-bold text-slate-800">
                                                        {formatNumber(item.requiredQty, item.itemType)} {item.unit}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>現在庫数:</span>
                                                    <span className={`font-bold ${item.stockQty < item.requiredQty ? "text-amber-700" : "text-slate-800"}`}>
                                                        {formatNumber(item.stockQty, item.itemType)} {item.unit}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>入荷予定:</span>
                                                    <span className="font-bold text-blue-600">
                                                        +{formatNumber(item.pendingQty, item.itemType)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between font-bold">
                                                    <span className={isCritical ? "text-red-700" : "text-emerald-800"}>最終状況:</span>
                                                    {isCritical ? (
                                                        <span className="text-red-600">不足 {formatNumber(item.shortageWithArrival, item.itemType)}</span>
                                                    ) : (
                                                        <span className="text-emerald-700">充足</span>
                                                    )}
                                                </div>
                                            </div>

                                            {canEdit && (isShort || isCritical) && (
                                                <Button
                                                    onClick={() => fillArrivalFormForShortage(item)}
                                                    size="sm"
                                                    className={`w-full text-[10px] h-7 font-bold gap-1 ${isCritical
                                                            ? "bg-red-600 hover:bg-red-700 text-white shadow-none"
                                                            : "bg-amber-600 hover:bg-amber-700 text-white shadow-none"
                                                        }`}
                                                >
                                                    <PackagePlus className="w-3 h-3" /> 補給数量をセット
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </div>

            </div>

            {/* 入荷詳細ダイアログ ＋ HACCPチェック画面 */}
            <Dialog open={!!editingArrival} onOpenChange={(open) => !open && setEditingArrival(null)}>
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800">
                            {showHaccpCheck ? <ClipboardCheck className="w-5 h-5 text-indigo-600" /> : <PackageCheck className="w-5 h-5 text-blue-600" />}
                            {showHaccpCheck ? "HACCP 受入状態チェック" : "入荷予定の詳細 / 処理"}
                        </DialogTitle>
                    </DialogHeader>

                    {/* 入荷詳細画面 */}
                    {editingArrival && !showHaccpCheck && (
                        <div className="space-y-4 mt-2">
                            <div className="bg-slate-50 p-3 rounded border text-sm">
                                <div className="text-slate-500 text-xs mb-1">発注日: {formatDateJP(editingArrival.order_date)}</div>
                                <div className="font-bold text-lg text-blue-900 leading-tight">{editingArrival.items?.name}</div>
                                <div className="text-slate-500 text-xs mt-1">{editingArrival.items?.item_type === "raw_material" ? "原材料" : "資材"}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">入荷予定日</label>
                                    <Input type="date" value={editExpectedDate} onChange={(e) => setEditExpectedDate(e.target.value)} disabled={editingArrival.status === "arrived" || !canEdit} className="h-10 md:h-9" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">数量 ({editingArrival.unit})</label>
                                    <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value === "" ? "" : Number(e.target.value))} disabled={editingArrival.status === "arrived" || !canEdit} className="h-10 md:h-9 text-right font-bold text-lg text-blue-700" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">備考</label>
                                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} disabled={editingArrival.status === "arrived" || !canEdit} className="h-10 md:h-9" placeholder="備考を入力..." />
                            </div>

                            {canEdit && (
                                <div className="pt-4 border-t flex flex-col gap-3">
                                    {editingArrival.status === "pending" && (
                                        <div className="flex gap-2">
                                            <Button onClick={handleUpdateArrival} disabled={isProcessing} className="flex-1 bg-slate-800 text-white h-10 md:h-9"><Edit className="h-4 w-4 mr-2" />内容更新</Button>
                                            <Button onClick={handleDeleteArrival} disabled={isProcessing} variant="outline" className="text-red-600 h-10 md:h-9"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    )}

                                    {editingArrival.status === "pending" && (
                                        <Button onClick={handleProceedToHaccpCheck} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 shadow-sm text-base">
                                            <ArrowDownToLine className="h-5 w-5 mr-2" />入荷済にする (受入チェックへ)
                                        </Button>
                                    )}
                                </div>
                            )}

                            {editingArrival.status === "arrived" && (
                                <div className="text-center text-sm font-bold text-green-700 bg-green-50 py-3 rounded-md border border-green-200">
                                    このデータは入荷済のため、在庫へ加算されています。
                                </div>
                            )}

                            {!canEdit && editingArrival.status !== "arrived" && (
                                <div className="text-center text-sm font-bold text-slate-500 bg-slate-50 py-3 rounded-md">
                                    <Lock className="w-4 h-4 inline mr-1" /> 閲覧モードのため処理はできません
                                </div>
                            )}
                        </div>
                    )}

                    {/* HACCP 受入チェック画面 */}
                    {editingArrival && showHaccpCheck && (
                        <div className="space-y-4 mt-2">
                            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-sm">
                                <div className="font-bold text-indigo-900 leading-tight flex items-center gap-2"><PackageCheck className="w-4 h-4" /> {editingArrival.items?.name}</div>
                                <div className="text-indigo-700 text-xs mt-1 font-bold">入荷数: {editingArrival.quantity} {editingArrival.unit}</div>
                            </div>

                            <p className="text-xs text-slate-500 font-bold">※入力した情報は自動的に HACCP原材料受入台帳 (YO-14) に記録されます。</p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">賞味期限 (任意)</label>
                                    <Input type="date" value={haccpData.expiry} onChange={e => setHaccpData({ ...haccpData, expiry: e.target.value })} className="bg-white h-10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Lot番号 (任意)</label>
                                    <Input value={haccpData.lot} onChange={e => setHaccpData({ ...haccpData, lot: e.target.value })} className="bg-white h-10" placeholder="ロット記号..." />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">外観 (状態)</label>
                                    <div className="flex bg-slate-100 rounded-lg p-1 h-12 shadow-inner">
                                        <button onClick={() => setHaccpData({ ...haccpData, appearance: 'ok' })} className={`flex-1 text-sm font-bold rounded-md transition-colors ${haccpData.appearance === 'ok' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>良</button>
                                        <button onClick={() => setHaccpData({ ...haccpData, appearance: 'ng' })} className={`flex-1 text-sm font-bold rounded-md transition-colors ${haccpData.appearance === 'ng' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>不良</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">臭い</label>
                                    <div className="flex bg-slate-100 rounded-lg p-1 h-12 shadow-inner">
                                        <button onClick={() => setHaccpData({ ...haccpData, smell: 'ok' })} className={`flex-1 text-sm font-bold rounded-md transition-colors ${haccpData.smell === 'ok' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>良</button>
                                        <button onClick={() => setHaccpData({ ...haccpData, smell: 'ng' })} className={`flex-1 text-sm font-bold rounded-md transition-colors ${haccpData.smell === 'ng' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>不良</button>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t flex gap-2">
                                <Button variant="outline" onClick={() => setShowHaccpCheck(false)} disabled={isProcessing} className="flex-1 font-bold h-12">
                                    <ArrowLeft className="w-4 h-4 mr-2" /> 戻る
                                </Button>
                                <Button onClick={handleCompleteArrival} disabled={isProcessing} className="flex-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-md">
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                                    確定して在庫加算
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* 発注書作成ダイアログ */}
            <Dialog open={orderSheetOpen} onOpenChange={setOrderSheetOpen}>
                <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>発注書(PDF)作成</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">仕入先</label>
                                <select
                                    value={orderSupplier}
                                    onChange={(e) => {
                                        setOrderSupplier(e.target.value as Supplier);
                                        setOrderQuantities({});
                                    }}
                                    className="w-full border rounded-md p-2.5 bg-white"
                                >
                                    <option value="hashiya">橋谷</option>
                                    <option value="nexus">ネクス</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">発注日</label>
                                <Input
                                    type="date"
                                    value={orderDate}
                                    onChange={(e) => setOrderDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">納期希望</label>
                                <Input
                                    value={deliveryInfo}
                                    onChange={(e) => setDeliveryInfo(e.target.value)}
                                    disabled={orderSupplier !== "hashiya"}
                                />
                            </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-3 font-bold text-slate-700">
                                発注数量入力
                            </div>

                            <div className="p-4 space-y-3">
                                {(orderSupplier === "hashiya" ? hashiyaItems : nexusItems).map((item, idx) => {
                                    const key = `${item.name}-${item.spec}`;
                                    return (
                                        <div
                                            key={`${key}-${idx}`}
                                            className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3 items-center border-b last:border-b-0 pb-3 last:pb-0"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-800">{item.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {item.maker ? `${item.maker} / ` : ""}
                                                    {item.spec} / {item.unit}
                                                </div>
                                            </div>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="数量"
                                                value={orderQuantities[key] || ""}
                                                onChange={(e) => handleOrderQuantityChange(key, e.target.value)}
                                                className="text-right"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setOrderSheetOpen(false)}>
                            キャンセル
                        </Button>
                        <Button
                            onClick={handleCreateOrderSheet}
                            className="bg-slate-800 hover:bg-slate-900 text-white"
                        >
                            発注書を表示する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}