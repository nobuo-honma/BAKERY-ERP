"use client";

import { useState } from "react";
import {
    BookOpen, Printer, MenuIcon, Settings, Info,
    ChevronDown, AlertCircle, CheckCircle2, FileText,
    AlertTriangle, HelpCircle, Shield, BookMarked, ShieldAlert,
    Edit, Box
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ManualPage() {
    const [activeTab, setActiveTab] = useState("overview");

    const sections = [
        { id: "overview", title: "概要と基本操作", icon: <Info className="w-5 h-5" /> },
        { id: "orders", title: "受注・出荷管理", icon: <FileText className="w-5 h-5" /> },
        { id: "production", title: "製造・在庫管理", icon: <Settings className="w-5 h-5" /> },
        { id: "haccp", title: "HACCP・品質管理", icon: <Shield className="w-5 h-5" /> },
    ];

    return (
        <div className="bg-transparent min-h-screen">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <BookOpen className="w-8 h-8 text-blue-600" /> 操作マニュアル
                </h1>
                <p className="text-slate-500 font-bold mt-2">Bakery ERP システムの機能構成と操作手順</p>
            </header>

            <div className="flex flex-col lg:flex-row gap-8">
                <aside className="lg:w-64 shrink-0">
                    <nav className="flex flex-col gap-2 sticky top-4">
                        {sections.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setActiveTab(s.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                                    activeTab === s.id
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                                        : "hover:bg-slate-100 text-slate-600"
                                }`}
                            >
                                {s.icon}
                                <span>{s.title}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                <main className="flex-1 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[600px]">
                    {activeTab === "overview" && (
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm">01</span>
                                システムの概要
                            </h2>
                            <div className="prose prose-slate max-w-none space-y-6">
                                <p className="text-lg text-slate-600 leading-relaxed font-bold">
                                    本システムは、受注から製造、品質管理、出荷までを一元管理するベーカリー専用の基幹業務システム（ERP）です。
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <h3 className="font-black text-slate-700 mb-2 flex items-center gap-2">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            リアルタイム在庫連携
                                        </h3>
                                        <p className="text-sm text-slate-500 leading-relaxed font-bold">製造・出荷の実績を入力すると、原材料から製品までの在庫が自動的に最新の状態へ更新されます。</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <h3 className="font-black text-slate-700 mb-2 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                                            期限・欠品アラート
                                        </h3>
                                        <p className="text-sm text-slate-500 leading-relaxed font-bold">賞味期限の近い製品や、安全在庫を下回った原材料をダッシュボードで即座に通知します。</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 他のセクションは省略中だが、以前の構造を維持 */}
                    <div className="mt-12 pt-8 border-t border-slate-100">
                         <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2 italic">
                            <Settings className="w-6 h-6 text-slate-400" /> データ構造リファレンス (技術者向け)
                         </h3>
                         <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-blue-700 text-white text-xs">
                                            <th className="px-3 py-2 border border-blue-600 text-left">テーブル名</th>
                                            <th className="px-3 py-2 border border-blue-600 text-left">役割</th>
                                            <th className="px-3 py-2 border border-blue-600 text-left">主要カラム / リレーション</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-600">
                                        {[
                                            ["products", "製品マスタ（完成品）", "id, name, variant_name, unit_per_cs, unit_per_kg"],
                                            ["items", "品目マスタ（原料・資材）", "id, item_type, unit_size, safety_stock"],
                                            ["bom", "部品表（レシピ）", "product_id(FK), item_id(FK), usage_rate, basis_type(kg/cs基準)"],
                                            ["customers", "得意先マスタ", "id, name, address, phone"],
                                            ["orders", "受注データ", "id, customer_id(FK), product_id(FK), quantity, status(received/in_production/shipped)", true],
                                            ["production_plans", "製造計画・実績", "id, order_id(FK), production_date, planned_cs, lot_code, status", true, "#fef9c3"],
                                            ["keep_samples", "キープサンプル管理", "id, lot_code, management_no, saved_quantity, used_quantity", true, "#d1fae5"],
                                            ["item_stocks", "原料・資材の現在庫", "item_id(FK), quantity"],
                                            ["product_stocks", "完成品の現在庫（Lot 別）", "id, lot_code, product_id(FK), total_pieces, expiry_date"],
                                            ["arrivals", "入荷予定・発注", "id, item_id(FK), expected_date, quantity, status"],
                                            ["shipments", "出荷実績（引き当て）", "id, order_id(FK), lot_code, qty_cs, qty_piece"],
                                            ["inventory_adjustments", "棚卸・調整履歴", "id, adjusted_at, item_id/product_id, before_qty, after_qty, diff, reason"],
                                            ["events", "社内イベント（カレンダー）", "id, event_date, title, notes"],
                                            ["haccp_documents", "HACCP / 機械マニュアル等", "id, title, category, file_url, version", true, "#e0e7ff"],
                                        ].map(([name, role, cols, highlight, bg], i) => (
                                            <tr key={name as string}
                                                style={highlight ? { background: (bg as string) ?? "#eff6ff" } : undefined}
                                                className={i % 2 === 0 && !highlight ? "bg-slate-50" : "bg-white"}>
                                                <td className="px-3 py-2 border border-slate-200 font-bold font-mono text-xs text-slate-800">{name as string}</td>
                                                <td className="px-3 py-2 border border-slate-200">{role as string}</td>
                                                <td className="px-3 py-2 border border-slate-200 font-mono text-xs text-slate-500">{cols as string}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    </div>
                </main>
            </div>
        </div>
    );
}