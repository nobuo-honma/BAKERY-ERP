"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Loader2, PackageCheck, Save, Box, AlertCircle, ArrowRight } from "lucide-react";

// --- 型定義 ---
type Order = { id: string; order_date: string; desired_ship_date: string; quantity: number; status: string; product_id: string; customers?: { name: string }; products?: { name: string; variant_name: string; unit_per_cs: number }; };
type ProductStock = { id: string; lot_code: string; product_id: string; total_pieces: number; expiry_date: string; };

export default function ShipmentsPage() {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);

    // 選択中の受注と、その製品の在庫リスト
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [stocks, setStocks] = useState<ProductStock[]>([]);

    // 出荷入力用State (キーは在庫ID)
    const [shipInputs, setShipInputs] = useState<Record<string, { cs: number | ""; p: number | "" }>>({});
    const [shipDate, setShipDate] = useState("");
    const [isOrderCompleted, setIsOrderCompleted] = useState(false); // この受注を「出荷済」にするか
    const [isProcessing, setIsProcessing] = useState(false);

    // --- 初期データ取得 (ESLint対策でuseCallbackを使用) ---
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        // 出荷待ち（未処理、または製造中）の受注リストを取得
        const { data } = await supabase
            .from("orders")
            .select("*, customers(name), products(name, variant_name, unit_per_cs)")
            .in("status", ["received", "in_production"])
            .order("desired_ship_date", { ascending: true });

        if (data) setOrders(data as Order[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchOrders();
        setShipDate(new Date().toISOString().split('T')[0]);
    }, [fetchOrders]);

    // 受注を選択した時、その製品の在庫を読み込む
    const handleSelectOrder = async (order: Order) => {
        setSelectedOrder(order);
        setShipInputs({}); // 入力をリセット
        setIsOrderCompleted(true); // デフォルトで完了チェックを入れる

        const { data } = await supabase
            .from("product_stocks")
            .select("*")
            .eq("product_id", order.product_id)
            .gt("total_pieces", 0) // 在庫が1ピース以上あるものだけ
            .order("expiry_date", { ascending: true }); // 賞味期限が古い順（先入れ先出しの推奨）

        if (data) setStocks(data as ProductStock[]);
    };

    // 入力値の変更ハンドラー
    const handleInputChange = (stockId: string, field: 'cs' | 'p', value: string) => {
        setShipInputs(prev => ({
            ...prev,
            [stockId]: {
                ...prev[stockId],
                [field]: value === "" ? "" : Number(value)
            }
        }));
    };

    // --- 合計計算ロジック ---
    const unitPerCs = selectedOrder?.products?.unit_per_cs || 24;

    // 今回出荷する合計ピース数
    const totalShipPieces = Object.values(shipInputs).reduce((sum, input) => {
        const cs = Number(input?.cs) || 0;
        const p = Number(input?.p) || 0;
        return sum + (cs * unitPerCs) + p;
    }, 0);

    // 表示用に合計をc/sとpに直す
    const totalDisplayCs = Math.floor(totalShipPieces / unitPerCs);
    const totalDisplayP = totalShipPieces % unitPerCs;

    // --- 出荷確定処理 ---
    const handleSaveShipment = async () => {
        if (!selectedOrder) return;
        if (totalShipPieces === 0) {
            alert("出荷する数量を入力してください。"); return;
        }

        setIsProcessing(true);
        try {
            const stockUpdates = [];
            const shipmentInserts = [];
            const historyInserts = [];

            // 入力された各Lotごとに処理を準備
            for (const stock of stocks) {
                const input = shipInputs[stock.id];
                const inputCs = Number(input?.cs) || 0;
                const inputP = Number(input?.p) || 0;
                const shipPieces = (inputCs * unitPerCs) + inputP;

                if (shipPieces > 0) {
                    if (shipPieces > stock.total_pieces) {
                        alert(`Lot番号[${stock.lot_code}] の出荷数が現在庫を超えています！`);
                        setIsProcessing(false); return;
                    }

                    const newTotalPieces = stock.total_pieces - shipPieces;

                    // 1. 在庫の減算データ
                    stockUpdates.push({ id: stock.id, total_pieces: newTotalPieces });

                    // 2. 出荷実績の登録データ
                    const random4 = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
                    const shipmentId = `SHP-${shipDate.replace(/-/g, "")}-${random4}`;
                    shipmentInserts.push({
                        id: shipmentId, order_id: selectedOrder.id, ship_date: shipDate, lot_code: stock.lot_code,
                        qty_cs: inputCs, qty_piece: inputP, status: "shipped"
                    });

                    // 3. 調整履歴への記録
                    historyInserts.push({
                        product_id: stock.product_id, lot_code: stock.lot_code, before_qty: stock.total_pieces, after_qty: newTotalPieces, reason: `出荷 (${selectedOrder.customers?.name}様宛)`
                    });
                }
            }

            // DBを一括更新
            await supabase.from("product_stocks").upsert(stockUpdates, { onConflict: 'id' });
            await supabase.from("shipments").insert(shipmentInserts);
            await supabase.from("inventory_adjustments").insert(historyInserts);

            // 受注のステータス更新（チェックボックスがONの場合）
            if (isOrderCompleted) {
                await supabase.from("orders").update({ status: "shipped" }).eq("id", selectedOrder.id);
                setSelectedOrder(null);
            } else {
                // 全量出荷でない場合は、在庫リストを再読み込みする
                handleSelectOrder(selectedOrder);
            }

            alert("出荷処理が完了し、在庫が引き落とされました！");
            fetchOrders(); // 左側の受注リストを更新

        } catch (err: any) {
            alert("エラーが発生しました: " + err.message);
        }
        setIsProcessing(false);
    };

    return (
        <div className="bg-transparent">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <Truck className="h-6 w-6 text-blue-600" />
                    出荷管理 (手入力引き当て)
                </h1>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* --- 左側：出荷待ちの受注リスト --- */}
                <div className="w-full lg:w-[35%]">
                    <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                        出荷対象の受注を選択
                    </h2>
                    <div className="space-y-3 h-[calc(100vh-150px)] overflow-y-auto pr-2 pb-10">
                        {orders.map((order) => {
                            const isLate = new Date(order.desired_ship_date) < new Date(new Date().setHours(0, 0, 0, 0));
                            return (
                                <Card
                                    key={order.id}
                                    onClick={() => handleSelectOrder(order)}
                                    className={`cursor-pointer transition-all border-2 ${selectedOrder?.id === order.id ? "border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]" : "border-slate-200 hover:border-blue-300"}`}
                                >
                                    <CardHeader className="p-4 pb-2 bg-white rounded-t-lg">
                                        <div className="flex justify-between items-start">
                                            <div className="text-xs text-slate-500">{order.id}</div>
                                            <Badge className={`${isLate ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-800'} border-none shadow-sm text-xs`}>
                                                納期: {new Date(order.desired_ship_date).toLocaleDateString()}
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-base text-slate-800 leading-tight mt-1">{order.customers?.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-2 text-sm text-slate-600 bg-white rounded-b-lg">
                                        <div className="font-bold text-slate-800 mb-2">{order.products?.name} ({order.products?.variant_name})</div>
                                        <div className="flex items-center justify-between border-t pt-2">
                                            <span className="text-xs text-slate-500">
                                                状態: {order.status === 'in_production' ? <span className="text-amber-600 font-bold">製造中あり</span> : "未製造/在庫引当"}
                                            </span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xs text-slate-500">受注数:</span>
                                                <span className="font-black text-xl text-blue-600">{order.quantity}</span>
                                                <span className="text-xs font-normal text-slate-500">c/s</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                        {loading && orders.length === 0 && <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></div>}
                        {!loading && orders.length === 0 && (
                            <div className="text-center py-12 text-slate-500 border border-dashed rounded-lg bg-white">出荷待ちのデータはありません。</div>
                        )}
                    </div>
                </div>

                {/* --- 右側：在庫の引き当て入力 --- */}
                <div className="w-full lg:w-[65%] flex flex-col gap-4">
                    <h2 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                        出荷するLotと数量を入力 (c/s・p混在可能)
                    </h2>

                    <Card className="border-slate-200 shadow-sm overflow-hidden shrink-0">
                        {selectedOrder ? (
                            <div className="p-0">
                                {/* 選択された受注情報と日付入力 */}
                                <div className="bg-slate-50 p-6 border-b border-slate-200">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">出荷先: {selectedOrder.customers?.name}</div>
                                            <div className="font-bold text-xl text-slate-800">{selectedOrder.products?.name} <span className="text-base font-normal text-slate-600">({selectedOrder.products?.variant_name})</span></div>
                                        </div>
                                        <div className="text-right bg-white px-4 py-2 rounded-md shadow-sm border border-slate-200">
                                            <div className="text-xs text-slate-500 mb-1">受注合計</div>
                                            <div className="font-black text-2xl text-blue-600">{selectedOrder.quantity} <span className="text-sm font-normal text-slate-500">c/s</span></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="font-bold text-sm text-slate-700">出荷日</label>
                                        <Input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} className="bg-white w-48 shadow-sm" />
                                    </div>
                                </div>

                                {/* 対象製品の現在庫リスト（Lot別） */}
                                <div className="overflow-x-auto max-h-[500px]">
                                    <Table className="min-w-[700px]">
                                        <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                                            <TableRow>
                                                <TableHead className="pl-6 w-[20%]">Lot番号</TableHead>
                                                <TableHead className="w-[20%]">賞味期限</TableHead>
                                                <TableHead className="w-[25%] text-right bg-slate-50">現在庫</TableHead>
                                                <TableHead className="w-[35%] text-center bg-blue-50 text-blue-900 font-bold border-l border-blue-200">今回出荷する数量</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {stocks.map((stock) => {
                                                const stockCs = Math.floor(stock.total_pieces / unitPerCs);
                                                const stockPiece = stock.total_pieces % unitPerCs;

                                                // 入力値と在庫の超過チェック
                                                const inputCs = Number(shipInputs[stock.id]?.cs) || 0;
                                                const inputP = Number(shipInputs[stock.id]?.p) || 0;
                                                const inputPieces = (inputCs * unitPerCs) + inputP;
                                                const isOver = inputPieces > stock.total_pieces;
                                                const isSelected = inputPieces > 0;

                                                return (
                                                    <TableRow key={stock.id} className={`${isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"} transition-colors`}>
                                                        <TableCell className="font-black text-slate-800 pl-6 text-base tracking-wider">{stock.lot_code}</TableCell>
                                                        <TableCell className="font-bold text-slate-600">{new Date(stock.expiry_date).toLocaleDateString()}</TableCell>
                                                        <TableCell className="text-right bg-slate-50/50">
                                                            <span className="font-bold text-lg text-slate-800">{stockCs} <span className="text-xs font-normal text-slate-500">c/s</span></span>
                                                            <span className="ml-2 font-bold text-slate-600">{stockPiece} <span className="text-[10px] font-normal text-slate-400">p</span></span>
                                                        </TableCell>
                                                        <TableCell className={`border-l ${isOver ? 'bg-red-50 border-red-200' : 'bg-blue-50/30 border-blue-100'}`}>
                                                            <div className="flex items-center justify-center gap-2">
                                                                <div className="flex items-end gap-1">
                                                                    <Input type="number" min="0" value={shipInputs[stock.id]?.cs ?? ""} onChange={e => handleInputChange(stock.id, 'cs', e.target.value)} className={`w-16 text-right font-bold h-9 bg-white shadow-sm ${isOver ? 'border-red-400 focus-visible:ring-red-500' : 'border-blue-300'}`} />
                                                                    <span className="text-xs font-bold text-slate-500 pb-1 w-4">c/s</span>
                                                                </div>
                                                                <div className="flex items-end gap-1">
                                                                    <Input type="number" min="0" value={shipInputs[stock.id]?.p ?? ""} onChange={e => handleInputChange(stock.id, 'p', e.target.value)} className={`w-16 text-right font-bold h-9 bg-white shadow-sm ${isOver ? 'border-red-400 focus-visible:ring-red-500' : 'border-blue-300'}`} />
                                                                    <span className="text-xs font-bold text-slate-500 pb-1 w-4">p</span>
                                                                </div>
                                                            </div>
                                                            {isOver && <div className="text-[10px] text-red-600 font-bold text-center mt-1">※在庫超過</div>}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {stocks.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-16 text-slate-500 bg-slate-50">
                                                        <Box className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                                        この製品の完成品在庫（出荷可能Lot）がありません。<br />製造を完了するか、在庫棚卸を行ってください。
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* 合計と確定ボタンエリア */}
                                <div className="bg-white border-t p-6 shadow-inner flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-6">
                                        <div>
                                            <div className="text-xs font-bold text-slate-500 mb-1">出荷合計入力</div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-black text-3xl text-blue-700">{totalDisplayCs}</span><span className="text-sm font-bold text-slate-500">c/s</span>
                                                <span className="font-bold text-xl text-slate-600 ml-2">{totalDisplayP}</span><span className="text-xs font-bold text-slate-500">p</span>
                                            </div>
                                        </div>
                                        {/* 受注数との比較アラート */}
                                        {totalDisplayCs !== selectedOrder.quantity && totalShipPieces > 0 && (
                                            <div className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4" /> 受注数と異なっています（分割・追加出荷）
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-3 w-full md:w-auto">
                                        <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-md border text-sm font-bold text-slate-700">
                                            <input type="checkbox" checked={isOrderCompleted} onChange={e => setIsOrderCompleted(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                                            この受注データを「出荷完了(リストから消去)」にする
                                        </label>
                                        <Button onClick={handleSaveShipment} disabled={isProcessing || totalShipPieces === 0} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 shadow-sm">
                                            {isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ArrowRight className="w-5 h-5 mr-2" />}
                                            出荷を確定して在庫から減算
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-16 text-center text-slate-400 flex flex-col items-center bg-slate-50">
                                <Truck className="h-16 w-16 mb-4 opacity-30 text-blue-500" />
                                <p className="text-xl font-bold text-slate-500">左のリストから出荷対象を選択してください</p>
                                <p className="mt-2 text-sm">顧客要件に合わせたLotの手動引き当てが行えます。</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}