"use client";

import { useState } from "react";
import {
    BookOpen, Printer, MenuIcon, Settings, Info,
    ChevronDown, AlertCircle, CheckCircle2, FileText,
    AlertTriangle, HelpCircle, Shield, BookMarked, ShieldAlert,
    Edit, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────
type TabKey = "user" | "tech";

// ─────────────────────────────────────────────
//  目次データ
// ─────────────────────────────────────────────
const USER_TOC = [
    { id: "glossary", title: "用語集" },
    { id: "roles", title: "権限ロール一覧" },
    { id: "intro", title: "はじめに" },
    { id: "swimlane", title: "第1章　業務フロー（スイムレーン）" },
    { id: "master", title: "第2章　マスタ管理" },
    { id: "order", title: "第3章　受注管理" },
    { id: "arrival", title: "第4章　入荷管理" },
    { id: "production", title: "第5章　製造管理" },
    { id: "inventory", title: "第6章　在庫管理・棚卸" },
    { id: "shipment", title: "第7章　出荷管理" },
    { id: "calendar", title: "第8章　カレンダー" },
    { id: "haccp", title: "第9章　HACCP・マニュアル" },
    { id: "errors", title: "エラー・警告の対処法" },
    { id: "trouble", title: "トラブルシューティング" },
];

const TECH_TOC = [
    { num: "01", label: "システム・アーキテクチャ" },
    { num: "02", label: "Lot 番号の自動生成ルール" },
    { num: "03", label: "ケース・ピース混在管理" },
    { num: "04", label: "MRP 計算ロジック" },
    { num: "05", label: "ロールバック安全設計" },
    { num: "06", label: "データベース・テーブル構成" },
];

// ─────────────────────────────────────────────
//  スイムレーン
// ─────────────────────────────────────────────
const LANES = [
    { label: "営業 / 管理者", color: "bg-blue-50 border-blue-300 text-blue-800" },
    { label: "製造担当", color: "bg-amber-50 border-amber-300 text-amber-800" },
    { label: "倉庫担当", color: "bg-green-50 border-green-300 text-green-800" },
    { label: "システム\n(自動)", color: "bg-slate-50 border-slate-300 text-slate-700" },
];

const SWIM_STEPS: [number, string, string][] = [
    [0, "受注登録", "複数味まとめて登録可・発注番号入力"],
    [3, "BOM 計算", "必要資材・不足を自動計算"],
    [0, "資材発注登録", "不足資材を入荷管理に登録"],
    [0, "発注書 PDF 作成", "FAX用フォームで印刷"],
    [2, "資材受入", "届いた資材を「入荷済にする」"],
    [3, "原料在庫 +加算", "item_stocks が自動更新"],
    [1, "製造計画登録", "受注 or 見込み生産で登録"],
    [3, "Lot・賞味期限 自動発行", "lot-generator.ts が計算"],
    [1, "製造開始ボタン", "実作業スタート"],
    [3, "原料在庫 −減算", "BOM に基づき自動処理"],
    [1, "製造完了・実績入力", "完成ケース/パック数を入力"],
    [3, "キープサンプル自動登録", "keep_samples テーブルへ"],
    [3, "製品在庫 +加算", "残数が product_stocks へ"],
    [2, "棚卸確認", "月次で実数と照合（MRP参照）"],
    [0, "出荷引き当て", "Lot を古い順に選び手入力"],
    [3, "製品在庫 −減算", "0 になった Lot は自動削除"],
    [0, "管理票 PDF 作成", "出荷管理票をPDFで印刷"],
];

function SwimlaneChart() {
    return (
        <div className="overflow-x-auto">
            <div className="min-w-[600px]">
                <div className="grid grid-cols-4 gap-1 mb-1">
                    {LANES.map((l) => (
                        <div key={l.label} className={`border rounded-sm px-2 py-1.5 text-xs font-bold text-center whitespace-pre-line ${l.color}`}>
                            {l.label}
                        </div>
                    ))}
                </div>
                <div className="space-y-1">
                    {SWIM_STEPS.map(([laneIdx, label, sub], i) => (
                        <div key={i} className="grid grid-cols-4 gap-1">
                            {[0, 1, 2, 3].map((col) => {
                                if (col !== laneIdx) return <div key={col} className="border border-dashed border-slate-200 rounded-sm h-11" />;
                                const lane = LANES[laneIdx];
                                return (
                                    <div key={col} className={`border rounded-sm px-2 py-1 ${lane.color} relative`}>
                                        <div className="text-xs font-bold leading-tight">{label}</div>
                                        <div className="text-[10px] opacity-60 leading-tight mt-0.5">{sub}</div>
                                        {i < SWIM_STEPS.length - 1 && (
                                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-slate-300 text-[10px] z-10 select-none">▼</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
//  部品
// ─────────────────────────────────────────────

/** パンくず */
function Breadcrumb({ items }: { items: string[] }) {
    return (
        <div className="flex items-center gap-1 text-xs text-blue-600 mb-4 flex-wrap">
            {items.map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                    <span className={i === items.length - 1 ? "text-slate-500" : "hover:underline cursor-default"}>{item}</span>
                </span>
            ))}
        </div>
    );
}

/** 章タイトル（太い左罫線スタイル） */
function ChapterTitle({ id, num, title, bread }: { id: string; num?: string; title: string; bread?: string[] }) {
    return (
        <div id={id} className="scroll-mt-20 mb-6">
            {bread && <Breadcrumb items={bread} />}
            <div className="border-l-4 border-blue-600 pl-4">
                {num && <div className="text-xs font-mono text-blue-500 tracking-widest mb-0.5">{num}</div>}
                <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{title}</h2>
            </div>
            <div className="h-px bg-slate-200 mt-3" />
        </div>
    );
}

/** セクション見出し */
function SectionHead({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-base font-bold text-slate-700 mb-3 mt-6 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-500 inline-block rounded-sm shrink-0" />
            {children}
        </h3>
    );
}

/** 手順ステップ（PDFスタイル：番号が大きく太字） */
function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
    return (
        <div className="mb-5">
            <div className="flex items-baseline gap-3 mb-1.5">
                <span className="text-2xl font-black text-blue-700 leading-none shrink-0">{n}.</span>
                <span className="text-base font-bold text-slate-800">{title}</span>
            </div>
            {children && (
                <div className="ml-9 text-sm text-slate-700 space-y-2">{children}</div>
            )}
        </div>
    );
}

/** ▼画面プレースホルダー */
function ScreenLabel({ label = "システム画面" }: { label?: string }) {
    return (
        <div className="my-3">
            <div className="text-xs text-slate-500 mb-1">▼{label}</div>
            <div className="border border-dashed border-slate-300 rounded bg-slate-50 flex items-center justify-center py-5 text-xs text-slate-400">
                ［スクリーンショット挿入位置］
            </div>
        </div>
    );
}

/** 注意ボックス（PDFスタイル） */
function NoteBox({ type, children }: { type: "caution" | "supplement" | "info" | "check"; children: React.ReactNode }) {
    const cfg = {
        caution: { bg: "bg-red-50 border-red-400", icon: <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />, label: "注意", labelColor: "bg-red-500 text-white" },
        supplement: { bg: "bg-blue-50 border-blue-400", icon: <Info className="h-4 w-4 text-blue-600 shrink-0" />, label: "補足", labelColor: "bg-blue-500 text-white" },
        info: { bg: "bg-amber-50 border-amber-400", icon: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />, label: "重要", labelColor: "bg-amber-500 text-white" },
        check: { bg: "bg-green-50 border-green-400", icon: <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />, label: "確認", labelColor: "bg-green-600 text-white" },
    };
    const c = cfg[type];
    return (
        <div className={`border-l-4 rounded-r-md p-3 my-3 ${c.bg}`}>
            <div className="flex items-center gap-2 mb-1.5">
                {c.icon}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${c.labelColor}`}>{c.label}</span>
            </div>
            <div className="text-sm text-slate-700 ml-6">{children}</div>
        </div>
    );
}

/** 目次行 */
function TocRow({ label, onClick }: { label: string; onClick?: () => void }) {
    return (
        <button onClick={onClick} className="w-full flex items-baseline gap-1 py-1 group text-left">
            <span className="text-[10px] text-slate-400 shrink-0">›</span>
            <span className="flex-1 border-b border-dotted border-slate-300 mb-0.5" />
            <span className="text-xs text-slate-600 group-hover:text-blue-700 transition-colors shrink-0 text-right leading-tight max-w-[145px]">
                {label}
            </span>
        </button>
    );
}

/** 入力項目テーブル */
function FieldTable({ rows }: { rows: [string, string, string?][] }) {
    return (
        <div className="overflow-x-auto my-3">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-slate-600 text-white">
                        <th className="px-3 py-1.5 border border-slate-500 text-left font-bold">項目</th>
                        <th className="px-3 py-1.5 border border-slate-500 text-left font-bold">内容</th>
                        <th className="px-3 py-1.5 border border-slate-500 text-center font-bold w-16">必須</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(([field, hint, req], i) => (
                        <tr key={field} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="px-3 py-1.5 border border-slate-200 font-bold text-blue-800">{field}</td>
                            <td className="px-3 py-1.5 border border-slate-200 text-slate-600">{hint}</td>
                            <td className="px-3 py-1.5 border border-slate-200 text-center">
                                {req === "必須" ? <span className="text-red-600 font-bold">●</span>
                                    : req === "自動" ? <span className="text-blue-500 font-bold">自動</span>
                                        : <span className="text-slate-400">任意</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─────────────────────────────────────────────
//  メイン
// ─────────────────────────────────────────────
export default function ManualPage() {
    const [tab, setTab] = useState<TabKey>("user");
    const [mobileTocOpen, setMobileTocOpen] = useState(false);
    const [techTocOpen, setTechTocOpen] = useState(false);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
        setMobileTocOpen(false);
    };

    const scrollToTech = (num: string) => {
        const el = document.getElementById(`tech-${num}`);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
        setTechTocOpen(false);
    };

    return (
        <div className="bg-white min-h-[80vh] rounded-xl shadow-sm border border-slate-200 print:border-none print:shadow-none">
            <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          .print-hidden { display: none !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }
      `}</style>

            {/* ── 表紙ヘッダー ── */}
            <header className="border-b-2 border-blue-600 px-4 md:px-8 py-4 md:py-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="bg-blue-600 p-2 rounded shrink-0 print:hidden">
                            <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-white" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 font-mono tracking-widest mb-0.5">
                                操作マニュアル　REV. 3.0.0
                            </div>
                            <h1 className="text-lg md:text-2xl font-black text-slate-800 leading-tight">
                                システム取り扱い説明書
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                                対象：製造担当、営業・管理者、倉庫担当向け｜災害備蓄用パン 製造・HACCP 統合管理システム
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => window.print()}
                        className="print-hidden shrink-0 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs md:text-sm px-3 md:px-4"
                    >
                        <Printer className="h-4 w-4 mr-1 md:mr-2" />
                        <span className="hidden sm:inline">マニュアルを印刷する</span>
                        <span className="sm:hidden">印刷</span>
                    </Button>
                </div>

                {/* タブ */}
                <div className="flex gap-1.5 mt-4 print-hidden">
                    {([
                        { key: "user" as const, icon: <Info className="h-4 w-4" />, label: "操作マニュアル (User)" },
                        { key: "tech" as const, icon: <Settings className="h-4 w-4" />, label: "技術仕様 (Tech)" },
                    ]).map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold transition-colors border-b-2"
                            style={tab === t.key
                                ? { borderBottomColor: "#2563eb", color: "#2563eb", background: "#eff6ff" }
                                : { borderBottomColor: "transparent", color: "#64748b", background: "transparent" }}
                        >
                            {t.icon}{t.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* ══════════════════════════════════════
          操作マニュアル
      ══════════════════════════════════════ */}
            {tab === "user" && (
                <div className="flex flex-col md:flex-row">

                    {/* PC サイドバー */}
                    <aside className="hidden md:flex w-60 shrink-0 border-r border-slate-200 flex-col print-hidden sticky top-0 self-start max-h-screen overflow-y-auto">
                        <div className="bg-slate-700 text-white px-4 py-2 text-xs font-bold tracking-widest uppercase">
                            目次
                        </div>
                        <nav className="p-3 space-y-0.5">
                            {USER_TOC.map((item) => (
                                <TocRow key={item.id} label={item.title} onClick={() => scrollTo(item.id)} />
                            ))}
                        </nav>
                    </aside>

                    {/* モバイル 目次 */}
                    <div className="md:hidden border-b border-slate-200 print-hidden">
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-700 text-white text-sm font-bold"
                            onClick={() => setMobileTocOpen(!mobileTocOpen)}
                        >
                            <span className="flex items-center gap-2"><MenuIcon className="h-4 w-4" />目次</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${mobileTocOpen ? "rotate-180" : ""}`} />
                        </button>
                        {mobileTocOpen && (
                            <nav className="px-4 pb-3 bg-white divide-y divide-slate-100">
                                {USER_TOC.map((item) => (
                                    <button key={item.id} onClick={() => scrollTo(item.id)}
                                        className="block w-full text-left py-2 text-sm font-bold text-slate-700 hover:text-blue-700">
                                        {item.title}
                                    </button>
                                ))}
                            </nav>
                        )}
                    </div>

                    {/* 本文 */}
                    <main className="flex-1 px-4 md:px-10 py-6 md:py-8 space-y-12 min-w-0 print:p-4">

                        {/* ── 用語集 ── */}
                        <section>
                            <ChapterTitle id="glossary" title="用語集" bread={["トップ", "操作マニュアル", "用語集"]} />
                            <p className="text-sm text-slate-600 mb-3">マニュアル中の用語は、それぞれ次の内容を表しています。</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-600 text-white text-xs">
                                            <th className="px-3 py-2 border border-slate-500 text-left w-32">用語</th>
                                            <th className="px-3 py-2 border border-slate-500 text-left">説明</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ["Lot（ロット）", "一度の製造バッチに付与される識別番号。賞味期限管理とトレーサビリティに使用します。"],
                                            ["BOM（部品表・レシピ）", "製品を作るためのレシピ。どの原料を何kg使うかが登録されています。"],
                                            ["MRP（資材所要量計画）", "製造計画と入荷予定を基に、30日先までの在庫推移を自動計算する機能。"],
                                            ["c/s（ケース）", "製品の出荷単位。1ケースに入るパック数は製品マスタの unit_per_cs で管理します。"],
                                            ["p（パック）", "製品の販売単位。棚卸・出荷時にケース未満の端数として入力します。"],
                                            ["キープサンプル", "製造完了時に品質保持のために保管するサンプル。完成数入力時にシステムが自動登録します。"],
                                            ["見込み生産", "受注がない状態で、在庫確保を目的として製造計画を立てること。"],
                                            ["引き当て", "受注に対して、倉庫の製品在庫（Lot）を割り当て・確保すること。"],
                                            ["棚卸", "実際の在庫数を数えてシステムの数値と照合し、ズレを修正する作業。"],
                                            ["ロールバック", "製造計画を削除した際に、連動して増減した在庫を自動で元に戻す機能。"],
                                            ["マスタ", "製品・原料・得意先など、業務の基本情報を登録した設定データ。"],
                                            ["HACCP", "食品製造における危害分析・重要管理点方式。衛生管理記録の根拠文書。"],
                                            ["管理者モード", "データの編集・登録・削除・在庫操作ができる権限。ヘッダーのスイッチで切り替え。"],
                                            ["閲覧者モード", "データの参照のみ可能。誤操作防止のためフィールド作業時に推奨。"],
                                        ].map(([term, desc], i) => (
                                            <tr key={term as string} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                                <td className="px-3 py-2 border border-slate-200 font-bold text-blue-800 text-xs align-top whitespace-nowrap">{term as string}</td>
                                                <td className="px-3 py-2 border border-slate-200 text-slate-600">{desc as string}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* ── 権限ロール ── */}
                        <section>
                            <ChapterTitle id="roles" title="権限ロール別 操作可否一覧" bread={["トップ", "操作マニュアル", "権限ロール一覧"]} />
                            <NoteBox type="supplement">
                                ヘッダー右上の「👑 管理者 / 👀 閲覧者」スイッチで切り替えます。フィールド作業中は必ず<strong>閲覧者モード</strong>を推奨します。
                            </NoteBox>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse mt-3">
                                    <thead>
                                        <tr className="bg-slate-600 text-white text-xs">
                                            <th className="px-3 py-2 border border-slate-500 text-left">操作内容</th>
                                            <th className="px-3 py-2 border border-slate-500 text-center w-20">管理者</th>
                                            <th className="px-3 py-2 border border-slate-500 text-center w-20">閲覧者</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {[
                                            ["各画面の閲覧・印刷・MRP予測の参照", true, true],
                                            ["マスタ（製品・原料・得意先）の編集・追加", true, false],
                                            ["受注の新規登録（複数味まとめて）・編集・削除", true, false],
                                            ["発注書 PDF の作成・印刷", true, false],
                                            ["入荷済ボタン（原料在庫加算）", true, false],
                                            ["製造計画の登録（受注 / 見込み生産）・分割", true, false],
                                            ["製造開始ボタン（原料在庫減算）", true, false],
                                            ["製造完了・実績入力（キープサンプル自動登録）", true, false],
                                            ["製造計画の削除（ロールバック）", true, false],
                                            ["既存 Lot の追加登録", true, false],
                                            ["棚卸の実行・一括保存 / 在庫表 PDF 印刷", true, false],
                                            ["出荷引き当て・確定 / 管理票 PDF 作成", true, false],
                                            ["カレンダーへのイベント追加・削除", true, false],
                                            ["HACCP 資料の新規登録・編集", true, false],
                                        ].map(([op, admin, viewer]) => (
                                            <tr key={op as string} className="even:bg-slate-50">
                                                <td className="px-3 py-2 border border-slate-200">{op as string}</td>
                                                <td className="px-3 py-2 border border-slate-200 text-center">
                                                    {admin ? <span className="text-green-600 font-black text-base">○</span> : <span className="text-slate-300">－</span>}
                                                </td>
                                                <td className="px-3 py-2 border border-slate-200 text-center">
                                                    {viewer ? <span className="text-green-600 font-black text-base">○</span> : <span className="text-slate-300">－</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* ── はじめに ── */}
                        <section>
                            <ChapterTitle id="intro" title="はじめに" bread={["トップ", "操作マニュアル", "はじめに"]} />
                            <p className="text-sm text-slate-700 leading-relaxed mb-4">
                                本システムは、災害備蓄用パンの「受注〜製造〜出荷」に至るすべてのモノの流れ（サプライチェーン）を一元管理し、在庫の自動計算やLot番号の自動採番を行うことで、業務効率化とミス防止を実現するシステムです。
                            </p>
                            <NoteBox type="info">
                                <p className="font-bold mb-1">システム内の在庫数は、各画面のステータス更新と<strong>完全に連動</strong>して増減します。</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>「入荷済にする」ボタン → 原料在庫 ＋加算</li>
                                    <li>「製造開始」ボタン → 原料在庫 －減算</li>
                                    <li>「製造完了・実績入力」→ キープサンプル自動登録 ＋ 製品在庫 ＋加算</li>
                                    <li>「出荷確定」ボタン → 製品在庫 －減算（0になった Lot は自動削除）</li>
                                    <li>「計画削除（キャンセル）」→ 連動した在庫変動を自動でロールバック</li>
                                </ul>
                                <p className="mt-2">必ず実際の作業と<strong>同時</strong>にシステムを操作してください。</p>
                            </NoteBox>
                            <NoteBox type="supplement">
                                <strong>【権限について】</strong>ヘッダー右上のスイッチで「管理者モード（👑）」と「閲覧モード（👀）」を切り替えられます。情報の新規登録・編集・削除、在庫を動かすボタンの操作は<strong>管理者モードでのみ可能</strong>です。
                            </NoteBox>
                        </section>

                        <div className="page-break" />

                        {/* ── 業務フロー ── */}
                        <section>
                            <ChapterTitle id="swimlane" num="第1章" title="業務フロー（スイムレーン図）" bread={["トップ", "操作マニュアル", "第1章　業務フロー"]} />
                            <p className="text-sm text-slate-600 mb-4">担当者ごとにレーンを色分けし、システムが自動処理するステップを右端レーンに表示しています。</p>
                            <SwimlaneChart />
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                {LANES.map((l) => (
                                    <div key={l.label} className={`border rounded-sm px-2 py-1 text-center font-bold ${l.color}`}>
                                        {l.label.replace("\n", " ")}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* ── マスタ管理 ── */}
                        <section>
                            <ChapterTitle id="master" num="第2章" title="マスタ管理（初期設定）" bread={["トップ", "操作マニュアル", "第2章　マスタ管理"]} />
                            <p className="text-sm text-slate-700 mb-4">システムを正しく動かすための「基礎データ」を登録・編集する画面です。編集は<strong>管理者モードのみ</strong>可能です。</p>

                            <SectionHead>新規データの登録手順</SectionHead>
                            <Step n={1} title="画面右上の「新規データ登録」ボタンを押します。" />
                            <Step n={2} title="現在開いているタブ（例：品目マスタ）に合わせた登録フォームが開きます。必要項目を入力して「保存」を押します。" />

                            <SectionHead>既存データの編集方法</SectionHead>
                            <Step n={1} title="一覧表の編集したいセル（文字）を直接クリックします。入力枠に変わります。" />
                            <Step n={2} title="値を書き換えて Enter キーを押すだけで上書き保存されます。" />

                            <SectionHead>主要マスタと重要項目</SectionHead>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse mt-2">
                                    <thead>
                                        <tr className="bg-slate-600 text-white">
                                            <th className="px-3 py-2 border border-slate-500 text-left">マスタ名</th>
                                            <th className="px-3 py-2 border border-slate-500 text-left">主な登録項目</th>
                                            <th className="px-3 py-2 border border-slate-500 text-left">注意点</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-600">
                                        {[
                                            ["製品マスタ", "製品名 / 種類(味) / 1kgあたり個数 / 1c/sあたり入数", "unit_per_cs を間違えると在庫計算が狂う。変更時は必ず棚卸を実施。"],
                                            ["品目マスタ（原料・資材）", "品目名 / 種別 / 単位 / 安全在庫数量", "安全在庫を設定すると MRP 予測での欠品警告が早めに出る。"],
                                            ["BOM（レシピ）", "製品ID / 品目ID / 使用量 / 基準（kg or c/s）", "変更は次回製造計画から反映。過去の Lot には影響しない。"],
                                            ["得意先マスタ", "得意先名 / 住所 / 電話番号", "受注登録時のプルダウン・名前検索に連動する。"],
                                        ].map(([name, fields, note]) => (
                                            <tr key={name as string} className="even:bg-slate-50">
                                                <td className="px-3 py-2 border border-slate-200 font-bold text-blue-800 whitespace-nowrap">{name as string}</td>
                                                <td className="px-3 py-2 border border-slate-200">{fields as string}</td>
                                                <td className="px-3 py-2 border border-slate-200 text-amber-700">{note as string}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <div className="page-break" />

                        {/* ── 受注管理 ── */}
                        <section>
                            <ChapterTitle id="order" num="第3章" title="受注管理（注文の登録と編集）" bread={["トップ", "操作マニュアル", "第3章　受注管理"]} />

                            <SectionHead>新規受注の登録手順</SectionHead>
                            <Step n={1} title='画面右上の「新規受注登録」ボタンを押します。（管理者モード時のみ表示）'>
                                <ScreenLabel label="利用状況 Web サイト画面" />
                            </Step>
                            <Step n={2} title="以下の基本情報を入力します。">
                                <FieldTable rows={[
                                    ["出荷予定日", "カレンダーから選択", "必須"],
                                    ["納期", "カレンダーから選択", "必須"],
                                    ["発注番号", "お客様の発注番号を入力", "任意"],
                                    ["出荷先", "得意先名の一部を入力して検索・選択", "必須"],
                                ]} />
                            </Step>
                            <Step n={3} title='製品と数量を入力します。1枚の注文書に複数の味がある場合は「製品を追加する」ボタンで行を追加し、まとめて登録できます。数量は c/s とパック(p) の両方で入力可能です。' />
                            <Step n={4} title="数量を入力した瞬間、BOMシミュレーション結果が右側に表示されます。">
                                <NoteBox type="caution">不足品目がある場合は赤色で警告が表示されます。受注登録は可能ですが、製造前に<strong>入荷管理で調達</strong>を行ってください。</NoteBox>
                                <ScreenLabel label="BOM シミュレーション結果" />
                            </Step>
                            <Step n={5} title='BOM 確認後、「受注を確定する」ボタンを押して保存します。' />

                            <SectionHead>登録後の編集・キャンセル</SectionHead>
                            <div className="text-sm text-slate-700 space-y-2 ml-2">
                                <div className="flex items-start gap-2">
                                    <Edit className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                    <p><strong>編集：</strong>受注カード右上の「鉛筆アイコン（✏）」をクリックすると編集モードになります。</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                    <p><strong>キャンセル（削除）：</strong>「キャンセル」ボタンで受注を取り消せます。製造計画が紐づいている場合は先に計画を削除してください。</p>
                                </div>
                            </div>
                        </section>

                        {/* ── 入荷管理 ── */}
                        <section>
                            <ChapterTitle id="arrival" num="第4章" title="入荷管理（発注と発注書PDF）" bread={["トップ", "操作マニュアル", "第4章　入荷管理"]} />

                            <SectionHead>発注登録の手順</SectionHead>
                            <Step n={1} title='「入荷管理」画面を開きます。' />
                            <Step n={2} title='左側フォームから「品目」「数量」を入力します。（ステータスは「発注済」になります）この時点では在庫は未加算です。' />
                            <Step n={3} title='「発注登録」ボタンを押すと右側リストに追加されます。' />

                            <SectionHead>発注書 PDF の作成</SectionHead>
                            <Step n={1} title='画面右上の「発注書(PDF)作成」ボタンを押します。' />
                            <Step n={2} title='取引先（橋谷㈱・㈱ネクス等）向けの FAX フォーマットで、A4 サイズの発注書が印刷されます。' />

                            <SectionHead>入荷受け入れの手順（在庫加算）</SectionHead>
                            <Step n={1} title='実際に資材が届いたら、右側リストの該当行の「確認」ボタンを押します。'>
                                <ScreenLabel />
                            </Step>
                            <Step n={2} title='確認ダイアログが開きます。実際の入荷数量を確認または修正します。' />
                            <Step n={3} title='緑色の「入荷済にする（在庫に加算）」ボタンを押します。'>
                                <NoteBox type="caution">「確認」ボタンを押しただけでは在庫に加算されません。必ず<strong>「入荷済にする」</strong>まで押してください。</NoteBox>
                            </Step>
                            <Step n={4} title='item_stocks の数量が即時更新され、在庫管理画面に反映されます。' />
                        </section>

                        <div className="page-break" />

                        {/* ── 製造管理 ── */}
                        <section>
                            <ChapterTitle id="production" num="第5章" title="製造管理（計画と Lot 自動発行）" bread={["トップ", "操作マニュアル", "第5章　製造管理"]} />

                            <SectionHead>製造計画の登録手順</SectionHead>
                            <Step n={1} title='「製造管理」画面を開きます。' />
                            <Step n={2} title='左側「未計画の残数がある受注」リストから、製造したい受注をクリックします。受注がない場合は右上の「見込み生産」ボタンを使用します。'>
                                <ScreenLabel />
                            </Step>
                            <Step n={3} title='右側フォームに以下を入力します。'>
                                <FieldTable rows={[
                                    ["製造予定日", "カレンダーから選択", "必須"],
                                    ["製造量 (kg)", "数値入力。全量を一度に製造しない場合は分割量を入力", "必須"],
                                    ["製造 Lot 番号", "自動生成（変更不可）", "自動"],
                                    ["賞味期限", "製造日 ＋ 5年6ヶ月を自動計算（変更不可）", "自動"],
                                ]} />
                            </Step>
                            <Step n={4} title='「計画を追加する」ボタンを押します。この時点では在庫は動きません。' />
                            <Step n={5} title='残数がゼロになるまで繰り返して分割登録できます。' />

                            <SectionHead>製造実行（在庫連動）の手順</SectionHead>
                            <Step n={1} title='リスト下の「確認」ボタン、またはカレンダー（予定表）から計画カードをクリックします。' />
                            <Step n={2} title='詳細ダイアログが開きます。' />
                            <Step n={3} title='製造を開始する際：「製造を開始する」ボタンを押します。'>
                                <NoteBox type="caution">BOMに登録されたすべての原料・資材が item_stocks から即時減算されます。操作は取り消せません。</NoteBox>
                            </Step>
                            <Step n={4} title='パンが完成したら：「製造を完了し、実績数を入力」ボタンを押します。' />
                            <Step n={5} title='実際の完成数（ケース数 / パック数）を入力して確定します。'>
                                <NoteBox type="check">
                                    <p className="font-bold mb-1">2つの処理が自動で行われます：</p>
                                    <ol className="list-decimal pl-4 space-y-1">
                                        <li><strong>キープサンプル自動登録：</strong>キープサンプル分が自動で引かれ、keep_samples テーブルに Lot 番号付きで登録されます。</li>
                                        <li><strong>製品在庫加算：</strong>残りの数が Lot 番号・賞味期限付きで product_stocks に加算されます。</li>
                                    </ol>
                                </NoteBox>
                            </Step>

                            <SectionHead>計画の取り消し（ロールバック機能）</SectionHead>
                            <NoteBox type="check">
                                <p className="font-bold mb-1">間違えても安心：自動ロールバック機能</p>
                                <p>計画の「削除（キャンセル）」を行うと、システムが以下を全自動で処理します。</p>
                                <ul className="list-disc pl-4 mt-1 space-y-1">
                                    <li>「製造中」を削除 ⇒ 引き落とされた<strong>原料・資材の在庫が元に戻ります</strong></li>
                                    <li>「完了」を削除 ⇒ 増えた<strong>製品 Lot の在庫が取り消し（マイナス）されます</strong></li>
                                </ul>
                                <p className="text-xs mt-2 text-slate-500">いずれも inventory_adjustments テーブルに「ロールバックによる調整」として証跡が残ります。</p>
                            </NoteBox>

                            <SectionHead>ステータスの流れ</SectionHead>
                            <div className="flex flex-wrap gap-2 items-center text-xs font-bold mt-2">
                                {[
                                    { label: "計画済", color: "bg-blue-50 text-blue-800 border-blue-300" },
                                    { label: "→", color: "text-slate-400 border-0 bg-transparent" },
                                    { label: "製造中", color: "bg-orange-50 text-orange-800 border-orange-300" },
                                    { label: "→", color: "text-slate-400 border-0 bg-transparent" },
                                    { label: "完了", color: "bg-green-50 text-green-800 border-green-300" },
                                ].map((s, i) => (
                                    <span key={i} className={`px-3 py-1 border rounded-sm ${s.color}`}>{s.label}</span>
                                ))}
                            </div>
                        </section>

                        {/* ── 在庫管理 ── */}
                        <section>
                            <ChapterTitle id="inventory" num="第6章" title="在庫管理・棚卸（実数調整）" bread={["トップ", "操作マニュアル", "第6章　在庫管理・棚卸"]} />

                            <SectionHead>在庫予測（MRP）カレンダーの見方</SectionHead>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 mb-3">
                                <li>製造計画による消費予定と入荷予定を考慮し、今後 <strong>30 日分</strong>の在庫推移を自動計算して表示します。</li>
                                <li>安全在庫を下回る（欠品が予測される）日付は<span className="text-red-600 font-bold">赤色</span>でハイライトされます。</li>
                            </ul>
                            <NoteBox type="supplement">
                                計算式：翌日在庫 ＝ 本日在庫 ＋ 入荷予定数 − 製造予定のBOM消費量
                            </NoteBox>

                            <SectionHead>既存 Lot の追加登録</SectionHead>
                            <p className="text-sm text-slate-700 mb-3">システム導入前（過去）に製造された在庫をシステムに登録したい場合は、画面右上の「既存Lotの追加登録」ボタンから Lot 番号・賞味期限・数量を手動で追加できます。</p>

                            <SectionHead>一括棚卸の手順</SectionHead>
                            <Step n={1} title='「在庫管理」画面を開き、「一括棚卸を開始」ボタンを押します。' />
                            <Step n={2} title='全項目に入力枠が現れます。実際に在庫を数えながら、ズレている項目を書き換えます。製品在庫はケース (c/s) とパック (p) を別々の枠に入力できます。' />
                            <Step n={3} title='変更した項目は黄色くハイライトされます。内容を確認したら「一括で上書き保存」ボタンを押します。'>
                                <ScreenLabel label="棚卸入力画面" />
                            </Step>
                            <Step n={4} title='調整履歴（変更前・変更後・差分・日時）が inventory_adjustments テーブルに自動記録されます。' />

                            <SectionHead>在庫表（PDF）の印刷</SectionHead>
                            <p className="text-sm text-slate-700">実地棚卸用に、空欄の「実数記入欄」が付いた在庫一覧表を PDF で印刷できます。画面右上の「在庫表(PDF)を印刷」ボタンを押してください。</p>
                        </section>

                        <div className="page-break" />

                        {/* ── 出荷管理 ── */}
                        <section>
                            <ChapterTitle id="shipment" num="第7章" title="出荷管理（手動引き当て）" bread={["トップ", "操作マニュアル", "第7章　出荷管理"]} />

                            <SectionHead>出荷手順</SectionHead>
                            <Step n={1} title='「出荷管理」画面を開きます。' />
                            <Step n={2} title='左側リストから出荷する受注をクリックして選択します。同じ注文書の製品はまとめて表示されます。'>
                                <ScreenLabel />
                            </Step>
                            <Step n={3} title='右側に「出荷可能な Lot 一覧」が古い順（先入れ先出し）で表示されます。'>
                                <NoteBox type="supplement">顧客の残存賞味期限要求に合わせ、古い Lot を優先しつつ、要求期限を下回らない Lot を選んでください。</NoteBox>
                            </Step>
                            <Step n={4} title='出荷するLotにチェックを入れ、出荷数量（c/s と p）を手入力します。複数 Lot にまたがる場合は複数行に入力してください。' />
                            <Step n={5} title='画面下部の合計数が受注数量と一致することを確認します。' />
                            <Step n={6} title='「出荷を確定」ボタンを押します。製品在庫が減算され、在庫が 0 になった Lot は自動的にデータが消去されます。'>
                                <NoteBox type="caution">出荷確定は取り消せません。確定後に在庫を戻す場合は棚卸（手動調整）で対応してください。</NoteBox>
                            </Step>

                            <SectionHead>出荷管理票 PDF の作成</SectionHead>
                            <p className="text-sm text-slate-700">画面右上の「出荷実績から管理票(PDF)を作成」ボタンから、出荷済みの実績データを元にした「出荷管理票」を PDF で印刷できます。</p>
                        </section>

                        {/* ── カレンダー ── */}
                        <section>
                            <ChapterTitle id="calendar" num="第8章" title="予定表（カレンダー）の活用と印刷" bread={["トップ", "操作マニュアル", "第8章　カレンダー"]} />

                            <SectionHead>ステータスの色分け</SectionHead>
                            <div className="flex flex-wrap gap-2 text-xs font-bold mb-3">
                                {[
                                    { label: "計画済（青）", color: "bg-blue-50 text-blue-800 border-blue-300" },
                                    { label: "製造中（オレンジ）", color: "bg-orange-50 text-orange-800 border-orange-300" },
                                    { label: "完了（緑）", color: "bg-green-50 text-green-800 border-green-300" },
                                    { label: "出荷予定（紫）", color: "bg-purple-50 text-purple-800 border-purple-300" },
                                    { label: "社内イベント（グレー）", color: "bg-slate-50 text-slate-700 border-slate-300" },
                                ].map((s) => (
                                    <span key={s.label} className={`px-2.5 py-1 border rounded-sm ${s.color}`}>{s.label}</span>
                                ))}
                            </div>
                            <NoteBox type="supplement">PCでは横型のマス目カレンダー、スマホでは縦型リストカレンダーが自動で表示されます。</NoteBox>

                            <SectionHead>イベントの追加手順</SectionHead>
                            <Step n={1} title='カレンダー上の日付右側にある「＋」ボタンをクリックします。' />
                            <Step n={2} title='タイトル・メモを入力して「保存」を押します。events テーブルに保存され、全員の画面に表示されます。' />

                            <SectionHead>印刷の手順</SectionHead>
                            <Step n={1} title='カレンダー右上の「予定表を印刷」ボタンを押します。' />
                            <Step n={2} title='白黒印刷で綺麗にA4用紙に収まる専用レイアウトで印刷されます。用紙サイズは A4 縦を推奨します。' />
                        </section>

                        {/* ── HACCP ── */}
                        <section>
                            <ChapterTitle id="haccp" num="第9章" title="HACCP・各種マニュアル閲覧" bread={["トップ", "操作マニュアル", "第9章　HACCP・マニュアル"]} />
                            <p className="text-sm text-slate-600 mb-4">HACCP関連書類や、オーブン・包装機などの機械の取扱説明書（PDF等）を一元管理するポータル画面です。</p>

                            <SectionHead>閲覧手順</SectionHead>
                            <Step n={1} title='メニューから「HACCP 資料」を開きます。' />
                            <Step n={2} title='カテゴリでフィルタして目的の資料を探します。' />
                            <Step n={3} title='「閲覧する」ボタンを押すと PDF 等の資料が別タブで開きます。' />

                            <SectionHead>資料登録手順（管理者のみ）</SectionHead>
                            <Step n={1} title='Google ドライブ等に PDF をアップロードし、共有リンクを取得します。' />
                            <Step n={2} title='「新規資料の登録」ボタンを押します。' />
                            <Step n={3} title='タイトル・カテゴリ・バージョン・URL を入力して保存します。' />
                            <NoteBox type="supplement">カテゴリ（製品説明書、機械マニュアルなど）で分類しておくと便利です。</NoteBox>
                        </section>

                        <div className="page-break" />

                        {/* ── エラー対処 ── */}
                        <section>
                            <ChapterTitle id="errors" title="エラー・警告メッセージの対処法" bread={["トップ", "操作マニュアル", "エラー・警告の対処法"]} />
                            <div className="space-y-4">
                                {[
                                    { type: "caution" as const, msg: "原料・資材の在庫が不足しています（赤色表示）", cause: "BOM 計算の結果、現在庫が必要量に満たない。", action: "入荷管理から不足品目を発注・受け入れてから再度操作してください。" },
                                    { type: "info" as const, msg: "製造計画が未計画の状態です", cause: "受注は登録されているが製造計画がまだない。", action: "製造管理画面で製造予定日・kg数を入力して計画を追加してください。" },
                                    { type: "info" as const, msg: "出荷可能な Lot がありません", cause: "製品在庫に該当製品の Lot が存在しない。", action: "製造管理で「製造完了・実績入力」まで処理されているか確認してください。" },
                                    { type: "caution" as const, msg: "保存に失敗しました（ネットワークエラー）", cause: "インターネット接続切断または DB タイムアウト。", action: "ページをリロードして再度操作してください。" },
                                    { type: "info" as const, msg: "在庫がマイナスになっています", cause: "棚卸漏れ、または二重操作による数値のズレ。", action: "在庫管理の棚卸機能で実数を入力し直してください。" },
                                ].map((e) => (
                                    <NoteBox key={e.msg} type={e.type}>
                                        <p className="font-bold">{e.msg}</p>
                                        <p className="mt-1"><span className="font-bold">原因：</span>{e.cause}</p>
                                        <p><span className="font-bold">対処：</span>{e.action}</p>
                                    </NoteBox>
                                ))}
                            </div>
                        </section>

                        {/* ── トラブルシューティング ── */}
                        <section>
                            <ChapterTitle id="trouble" title="トラブルシューティング Q&A" bread={["トップ", "操作マニュアル", "トラブルシューティング"]} />
                            <div className="space-y-3">
                                {[
                                    { q: "受注登録ボタンが表示されない", a: "ヘッダーのスイッチが「👀 閲覧者」になっています。「👑 管理者」に切り替えてください。" },
                                    { q: "発注書 PDF のフォーマットが崩れる", a: "ブラウザの印刷設定で「背景のグラフィック」を有効にしてください。Chrome 最新版を推奨します。" },
                                    { q: "製造完了したのに製品在庫が増えていない", a: "「製造完了・実績入力」まで押しているか確認してください。実績数（ケース/パック）の入力が必要です。" },
                                    { q: "誤って「製造開始」を押してしまった", a: "計画の「削除（キャンセル）」を行うと、引き落とされた原料在庫が自動でロールバックされます。" },
                                    { q: "キープサンプルが自動登録されない", a: "「製造完了・実績入力」ボタンを使用しているか確認してください。旧バージョンの「製造を完了する」ボタンでは登録されません。" },
                                    { q: "棚卸で保存したのに数値が元に戻った", a: "「一括で上書き保存」を押す前にブラウザがリロードされた可能性があります。保存後に調整履歴を確認してください。" },
                                    { q: "HACCP 資料のリンクを押しても開かない", a: "Google ドライブの共有設定が「リンクを知っている全員」になっているか確認してください。" },
                                ].map((qa) => (
                                    <div key={qa.q} className="border border-slate-200 rounded overflow-hidden">
                                        <div className="bg-slate-100 px-4 py-2 font-bold text-sm text-slate-800 flex items-start gap-2">
                                            <HelpCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                            Q. {qa.q}
                                        </div>
                                        <div className="px-4 py-3 text-sm text-slate-700 bg-white">
                                            <span className="font-bold text-blue-700">A. </span>{qa.a}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                    </main>
                </div>
            )}

            {/* ══════════════════════════════════════
          技術仕様
      ══════════════════════════════════════ */}
            {tab === "tech" && (
                <div className="flex flex-col md:flex-row">
                    <aside className="hidden md:flex w-60 shrink-0 border-r border-slate-200 flex-col print-hidden sticky top-0 self-start">
                        <div className="bg-slate-700 text-white px-4 py-2 text-xs font-bold tracking-widest uppercase">目次</div>
                        <nav className="p-3 space-y-0.5">
                            {TECH_TOC.map((row) => (
                                <TocRow key={row.num} label={`${row.num}. ${row.label}`} onClick={() => scrollToTech(row.num)} />
                            ))}
                        </nav>
                    </aside>

                    <div className="md:hidden border-b border-slate-200">
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-700 text-white text-sm font-bold"
                            onClick={() => setTechTocOpen(!techTocOpen)}
                        >
                            <span className="font-mono text-xs tracking-widest uppercase">目次</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${techTocOpen ? "rotate-180" : ""}`} />
                        </button>
                        {techTocOpen && (
                            <div className="px-4 pb-3 bg-white divide-y divide-slate-100">
                                {TECH_TOC.map((row) => (
                                    <button key={row.num} onClick={() => scrollToTech(row.num)}
                                        className="block w-full text-left py-2.5 text-sm font-bold text-slate-700 hover:text-blue-700">
                                        {row.num}. {row.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <main className="flex-1 px-4 md:px-10 py-6 md:py-8 space-y-12 min-w-0">

                        <section id="tech-01" className="scroll-mt-20">
                            <ChapterTitle id="tech-01-h" num="01" title="システム・アーキテクチャ" />
                            <div className="bg-slate-800 text-white rounded p-4 md:p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                    {[
                                        { label: "フロントエンド", items: ["Next.js (App Router) + React", "TypeScript", "Tailwind CSS (shadcn/ui)"] },
                                        { label: "バックエンド / DB", items: ["Neon (Serverless PostgreSQL)", "Drizzle ORM", "NextAuth v5"] },
                                        { label: "特徴", items: ["Responsive UI (PC / スマホ自動切替)", "Server / Client Components", "Role-based Access Control", "MRP Inventory Forecast"] },
                                    ].map((col) => (
                                        <div key={col.label} className="bg-slate-700/50 rounded border border-slate-600 p-3">
                                            <div className="font-bold text-blue-300 mb-2 text-[10px] tracking-widest uppercase">{col.label}</div>
                                            {col.items.map((it) => <div key={it} className="text-slate-300 text-sm">{it}</div>)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section id="tech-02" className="scroll-mt-20">
                            <ChapterTitle id="tech-02-h" num="02" title="Lot 番号の自動生成ルール" />
                            <p className="text-sm text-slate-600 mb-3">
                                <code className="bg-slate-100 px-1 rounded text-slate-700 text-xs">src/lib/lot-generator.ts</code> にて制御。入力された日付と製品IDから一意の文字列を生成します。
                            </p>
                            <div className="border border-slate-200 rounded overflow-hidden divide-y divide-slate-200">
                                {[
                                    { type: "通常品（例: SB）", rule: "カタカナ (日付) + 月 alpha + 年2桁 + 製品 ID", note: "変換表: 日付 (タ行抜き ア〜ヤ)、月 (A〜L)", example: "2026年2月13日 ⇒ ス(13)+B(2)+26+SB ⇒", result: "スB26SB" },
                                    { type: "MA / FD 複合製品", rule: "yy (年2桁) + MA/FD + 連番2桁", note: "", example: "2026年製造 ⇒", result: "26MA01" },
                                    { type: "YC50 / YO50", rule: "dd (日付2桁) + 月 alpha + 年2桁 + 製品 ID", note: "", example: "2026年2月13日 ⇒", result: "13B26YC50" },
                                ].map((row) => (
                                    <div key={row.type} className="p-4">
                                        <div className="font-bold text-blue-800 mb-1 text-sm">【{row.type}】</div>
                                        <div className="text-slate-600 text-sm">ルール: <code className="bg-slate-100 px-1 rounded text-xs break-all">{row.rule}</code></div>
                                        {row.note && <div className="text-slate-500 text-xs mt-0.5">{row.note}</div>}
                                        <div className="mt-2 bg-slate-50 border border-slate-200 rounded px-3 py-2 font-mono text-xs break-all">
                                            {row.example} <strong className="text-slate-900">{row.result}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section id="tech-03" className="scroll-mt-20">
                            <ChapterTitle id="tech-03-h" num="03" title="ケース・ピース混在管理" />
                            <p className="text-sm text-slate-600 mb-3">繰り下がりバグを防ぐため、DB と画面でデータの持ち方を分けています。</p>
                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                <div className="border border-slate-200 rounded p-4 bg-slate-50">
                                    <div className="font-bold text-blue-800 mb-2 text-xs tracking-widest uppercase">DB（Neon）</div>
                                    <p className="text-slate-600 mb-2"><code className="bg-white px-1 rounded border text-xs">product_stocks.total_pieces</code> に<strong>総個数（ピース数）</strong>で保存</p>
                                    <div className="bg-white border rounded px-3 py-2 font-mono text-xs">例: 10 c/s + 5 p → <strong>250個</strong> として保存</div>
                                </div>
                                <div className="border border-slate-200 rounded p-4 bg-slate-50">
                                    <div className="font-bold text-blue-800 mb-2 text-xs tracking-widest uppercase">フロントエンド（表示時変換）</div>
                                    <div className="font-mono text-xs space-y-1 bg-white border rounded px-3 py-2 break-all">
                                        <div><span className="text-blue-600">cs</span> = Math.floor( total_pieces / unit_per_cs )</div>
                                        <div><span className="text-blue-600">p</span>  = Math.floor( (total_pieces % unit_per_cs) / 2 )</div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">※ パックは2個入りのため ÷2 で変換します。</p>
                                </div>
                            </div>
                        </section>

                        <section id="tech-04" className="scroll-mt-20">
                            <ChapterTitle id="tech-04-h" num="04" title="MRP（資材所要量計画）計算ロジック" />
                            <p className="text-sm text-slate-700 mb-3">在庫管理画面の「在庫予測」は、以下の数式で30日先までの在庫推移を自動計算します。</p>
                            <div className="bg-slate-50 border border-slate-200 rounded p-4 font-mono text-sm text-slate-800 break-all">
                                翌日の在庫 ＝ 本日の在庫 ＋ 入荷予定数（pending） − 製造予定のBOM消費量（planned）
                            </div>
                            <ul className="mt-3 list-disc pl-5 text-sm text-slate-600 space-y-1">
                                <li><strong>入荷予定数：</strong>arrivals テーブルの status = 'pending' かつ expected_date が対象日のレコードを合計</li>
                                <li><strong>BOM消費量：</strong>production_plans の対象日の計画に対して BOM の usage_rate を乗算した値を合計</li>
                                <li>安全在庫（safety_stock）を下回る日付を赤色でフラグ表示します。</li>
                            </ul>
                        </section>

                        <section id="tech-05" className="scroll-mt-20">
                            <ChapterTitle id="tech-05-h" num="05" title="ロールバック安全設計" />
                            <p className="text-sm text-slate-700 mb-3">製造計画を削除した際、システムは自動的に在庫を復元し、データの整合性を担保します。</p>
                            <div className="border border-slate-200 rounded overflow-hidden divide-y divide-slate-200 text-sm">
                                {[
                                    { trigger: "「製造中」の計画を削除", action: "使用予定だった原料・資材の item_stocks を元の数に加算（復元）する。", log: "inventory_adjustments に「ロールバック：原料復元」として記録。" },
                                    { trigger: "「完了済」の計画を削除", action: "完成した製品の product_stocks を減算し、0になったらレコードごと DELETE する。キープサンプル（keep_samples）も削除。", log: "inventory_adjustments に「ロールバック：製品取消」として記録。" },
                                    { trigger: "出荷確定後に在庫を戻したい場合", action: "出荷のロールバック機能はありません。棚卸（手動調整）で対応します。", log: "inventory_adjustments に「棚卸調整」として記録。" },
                                ].map((row) => (
                                    <div key={row.trigger} className="p-4">
                                        <div className="font-bold text-red-700 mb-1">▶ {row.trigger}</div>
                                        <div className="text-slate-700 mb-1">{row.action}</div>
                                        <div className="text-slate-400 text-xs">{row.log}</div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section id="tech-06" className="scroll-mt-20">
                            <ChapterTitle id="tech-06-h" num="06" title="データベース・テーブル構成" />
                            <div className="sm:hidden space-y-2">
                                {[
                                    ["products", "製品マスタ（完成品）", "id, name, variant_name, unit_per_cs, unit_per_kg"],
                                    ["items", "品目マスタ（原料・資材）", "id, item_type, unit_size, safety_stock"],
                                    ["bom", "部品表（レシピ）", "product_id(FK), item_id(FK), usage_rate, basis_type"],
                                    ["customers", "得意先マスタ", "id, name, address, phone"],
                                    ["orders", "受注データ", "id, customer_id(FK), product_id(FK), quantity, status"],
                                    ["production_plans", "製造計画・実績", "id, order_id(FK), production_date, planned_cs, lot_code, status"],
                                    ["keep_samples", "キープサンプル管理", "id, lot_code, management_no, saved_quantity, used_quantity"],
                                    ["item_stocks", "原料・資材の現在庫", "item_id(FK), quantity"],
                                    ["product_stocks", "完成品の現在庫（Lot 別）", "id, lot_code, product_id(FK), total_pieces, expiry_date"],
                                    ["arrivals", "入荷予定・発注", "id, item_id(FK), expected_date, quantity, status"],
                                    ["shipments", "出荷実績（引き当て）", "id, order_id(FK), lot_code, qty_cs, qty_piece"],
                                    ["inventory_adjustments", "棚卸・調整履歴", "id, adjusted_at, item_id/product_id, before_qty, after_qty, diff, reason"],
                                    ["events", "社内イベント（カレンダー）", "id, event_date, title, notes"],
                                    ["haccp_documents", "HACCP / 機械マニュアル等", "id, title, category, file_url, version"],
                                ].map(([name, role, cols]) => (
                                    <div key={name as string} className="border border-slate-200 rounded p-3 bg-slate-50">
                                        <div className="font-mono text-xs font-bold text-blue-700 mb-0.5">{name as string}</div>
                                        <div className="text-sm text-slate-600 mb-1">{role as string}</div>
                                        <div className="font-mono text-[11px] text-slate-400 break-all">{cols as string}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-600 text-white text-xs">
                                            <th className="px-3 py-2 border border-slate-500 text-left">テーブル名</th>
                                            <th className="px-3 py-2 border border-slate-500 text-left">役割</th>
                                            <th className="px-3 py-2 border border-slate-500 text-left">主要カラム / リレーション</th>
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
                                                style={highlight ? { background: (typeof bg === 'string' ? bg : "#eff6ff") } : undefined}
                                                className={i % 2 === 0 && !highlight ? "bg-slate-50" : "bg-white"}>
                                                <td className="px-3 py-2 border border-slate-200 font-bold font-mono text-xs text-slate-800">{name as string}</td>
                                                <td className="px-3 py-2 border border-slate-200">{role as string}</td>
                                                <td className="px-3 py-2 border border-slate-200 font-mono text-xs text-slate-500">{cols as string}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                    </main>
                </div>
            )}

            {/* ── フッター ── */}
            <footer className="border-t-2 border-slate-200 px-4 md:px-8 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[10px] font-mono text-slate-400">
                <span>災害備蓄用パン 製造・HACCP 統合管理システム　操作マニュアル</span>
                <span>REV. 3.0.0　— 2026年4月</span>
            </footer>
        </div>
    );
}