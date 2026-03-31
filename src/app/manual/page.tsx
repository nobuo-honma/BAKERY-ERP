"use client";

import { useState } from "react";
import {
    BookOpen, Printer, MenuIcon, Settings, Info,
    ChevronDown, AlertCircle, CheckCircle2, FileText,
    AlertTriangle, HelpCircle, Shield, BookMarked, ShieldAlert,
    Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────
type TabKey = "user" | "tech";

// ─────────────────────────────────────────────
//  目次
// ─────────────────────────────────────────────
const USER_TOC = [
    { id: "glossary", title: "用語集" },
    { id: "roles", title: "権限ロール一覧" },
    { id: "intro", title: "はじめに" },
    { id: "swimlane", title: "1. 業務フロー（スイムレーン）" },
    { id: "master", title: "2. マスタ管理" },
    { id: "order", title: "3. 受注管理" },
    { id: "arrival", title: "4. 入荷管理" },
    { id: "production", title: "5. 製造管理" },
    { id: "inventory", title: "6. 在庫管理・棚卸" },
    { id: "shipment", title: "7. 出荷管理" },
    { id: "calendar", title: "8. カレンダー" },
    { id: "haccp", title: "9. HACCP・マニュアル" },
    { id: "errors", title: "エラー・警告の対処法" },
    { id: "trouble", title: "トラブルシューティング" },
];

const TECH_TOC = [
    { num: "01", label: "システム・アーキテクチャ" },
    { num: "02", label: "Lot 番号の自動生成ルール" },
    { num: "03", label: "ケース・ピース混在管理" },
    { num: "04", label: "MRP 計算ロジック" },
    { num: "05", label: "データベース・テーブル構成" },
];

// ─────────────────────────────────────────────
//  スイムレーン
// ─────────────────────────────────────────────
const LANES = [
    { label: "営業 / 管理者", color: "bg-blue-100 border-blue-300 text-blue-800" },
    { label: "製造担当", color: "bg-amber-100 border-amber-300 text-amber-800" },
    { label: "倉庫担当", color: "bg-green-100 border-green-300 text-green-800" },
    { label: "システム\n(自動)", color: "bg-slate-100 border-slate-300 text-slate-700" },
];

const SWIM_STEPS: [number, string, string][] = [
    [0, "受注登録", "製品・数量・納期を入力"],
    [3, "BOM 計算", "必要資材・不足を自動計算"],
    [0, "資材発注登録", "不足資材を入荷管理に登録"],
    [0, "発注書 PDF 作成", "FAX用フォームで印刷"],
    [2, "資材受入", "届いた資材を「入荷済」に"],
    [3, "原料在庫 +加算", "item_stocks が自動更新"],
    [1, "製造計画登録", "製造日・kg 数を入力"],
    [3, "Lot・賞味期限 自動発行", "lot-generator.ts が計算"],
    [1, "製造開始ボタン", "実作業スタート"],
    [3, "原料在庫 −減算", "BOM に基づき自動処理"],
    [1, "製造完了ボタン", "パン完成"],
    [3, "製品在庫 +加算", "Lot 付きで product_stocks へ"],
    [2, "棚卸確認", "月次で実数と照合（MRP予測参照）"],
    [0, "出荷引き当て", "Lot を選び数量を手入力"],
    [3, "製品在庫 −減算", "product_stocks が自動更新"],
    [2, "出荷・納品", "取引完了"],
];

function SwimlaneChart() {
    return (
        <div className="overflow-x-auto -mx-4 px-4">
            <div className="min-w-[640px]">
                <div className="grid grid-cols-4 gap-1 mb-1">
                    {LANES.map((l) => (
                        <div key={l.label} className={`border rounded px-2 py-1.5 text-xs font-bold text-center whitespace-pre-line ${l.color}`}>
                            {l.label}
                        </div>
                    ))}
                </div>
                <div className="space-y-1">
                    {SWIM_STEPS.map(([laneIdx, label, sub], i) => (
                        <div key={i} className="grid grid-cols-4 gap-1">
                            {[0, 1, 2, 3].map((col) => {
                                if (col !== laneIdx) return <div key={col} className="border border-dashed border-slate-200 rounded h-12" />;
                                const lane = LANES[laneIdx];
                                return (
                                    <div key={col} className={`border rounded px-2 py-1 ${lane.color} relative`}>
                                        <div className="text-xs font-bold leading-tight">{label}</div>
                                        <div className="text-[10px] opacity-70 leading-tight">{sub}</div>
                                        {i < SWIM_STEPS.length - 1 && (
                                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-slate-400 text-[10px] z-10">▼</div>
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
function TocRow({ label, onClick }: { label: string; onClick?: () => void }) {
    return (
        <button onClick={onClick} className="w-full flex items-baseline gap-1 py-1.5 group text-left">
            <span className="text-[10px] text-slate-400 shrink-0">›</span>
            <span className="flex-1 border-b border-dotted border-slate-300 mb-0.5" />
            <span className="text-xs text-slate-600 group-hover:text-blue-700 transition-colors shrink-0 text-right leading-tight max-w-[130px]">
                {label}
            </span>
        </button>
    );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <h2 id={id} className="text-xl md:text-2xl font-black text-slate-800 border-b-2 border-slate-200 pb-2 mb-5 scroll-mt-20">
            {children}
        </h2>
    );
}

function SubTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-base md:text-lg font-bold text-blue-800 border-l-4 border-blue-500 pl-3 mb-3 mt-6">
            {children}
        </h3>
    );
}

function StepBadge({ n, label }: { n: number; label: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 text-xs mt-0.5">
                {n}
            </span>
            <span className="text-sm text-slate-800">{label}</span>
        </div>
    );
}

function InfoBox({ color, icon, title, children }: {
    color: "blue" | "amber" | "red" | "green";
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    const styles = {
        blue: "bg-blue-50 border-blue-200 text-blue-900",
        amber: "bg-amber-50 border-amber-200 text-amber-900",
        red: "bg-red-50 border-red-200 text-red-900",
        green: "bg-green-50 border-green-200 text-green-900",
    };
    return (
        <div className={`border rounded-lg p-4 ${styles[color]}`}>
            <div className="flex items-center gap-2 font-bold mb-2 text-sm">{icon}{title}</div>
            <div className="text-sm">{children}</div>
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

            {/* ── ヘッダー ── */}
            <header className="border-b border-slate-200 px-4 md:px-8 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 md:p-3 rounded-lg print:hidden shrink-0">
                            <BookOpen className="h-5 w-5 md:h-7 md:w-7 text-blue-700" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 border rounded-sm uppercase text-blue-700 border-blue-400 hidden sm:inline">
                                    取扱説明書
                                </span>
                                <span className="font-mono text-[9px] text-slate-400 tracking-widest">REV. 2.1.0</span>
                            </div>
                            <h1 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight leading-tight">
                                システム取り扱い説明書
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5 font-bold hidden sm:block">
                                災害備蓄用パン 製造・HACCP 統合管理システム
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => window.print()}
                        className="print-hidden shrink-0 bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-sm text-xs md:text-sm px-3 md:px-4"
                    >
                        <Printer className="h-4 w-4 mr-1 md:mr-2" />
                        <span className="hidden sm:inline">マニュアルを印刷する</span>
                        <span className="sm:hidden">印刷</span>
                    </Button>
                </div>

                {/* タブ */}
                <div className="flex gap-2 mt-4 print-hidden">
                    {([
                        { key: "user" as const, icon: <Info className="h-4 w-4" />, label: "操作マニュアル (User)" },
                        { key: "tech" as const, icon: <Settings className="h-4 w-4" />, label: "技術仕様 (Tech)" },
                    ]).map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors"
                            style={tab === t.key
                                ? { background: "#1d4ed8", color: "#fff" }
                                : { background: "#f1f5f9", color: "#475569" }}
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
                    <aside className="hidden md:block w-56 shrink-0 border-r border-slate-200 p-4 sticky top-0 self-start max-h-screen overflow-y-auto print-hidden">
                        <p className="font-mono text-[9px] tracking-[0.2em] text-slate-400 uppercase mb-2">目次</p>
                        {USER_TOC.map((item) => (
                            <TocRow key={item.id} label={item.title} onClick={() => scrollTo(item.id)} />
                        ))}
                    </aside>

                    {/* モバイル 目次 */}
                    <div className="md:hidden border-b border-slate-200 print-hidden">
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700"
                            onClick={() => setMobileTocOpen(!mobileTocOpen)}
                        >
                            <span className="flex items-center gap-2"><MenuIcon className="h-4 w-4" />目次</span>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${mobileTocOpen ? "rotate-180" : ""}`} />
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
                    <main className="flex-1 p-4 md:p-10 space-y-14 min-w-0 print:p-4">

                        {/* ── 用語集 ── */}
                        <section id="glossary" className="avoid-break scroll-mt-20">
                            <SectionTitle id="glossary">
                                <BookMarked className="inline h-6 w-6 mr-2 text-blue-600" />用語集
                            </SectionTitle>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-blue-700 text-white text-xs">
                                            <th className="px-3 py-2 border border-blue-600 text-left w-28">用語</th>
                                            <th className="px-3 py-2 border border-blue-600 text-left">意味</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ["Lot（ロット）", "一度の製造バッチに付与される識別番号。賞味期限管理とトレーサビリティに使用します。"],
                                            ["BOM（部品表・レシピ）", "製品を作るためのレシピ。どの原料を何kg使うかが登録されています。"],
                                            ["MRP（資材所要量計画）", "製造計画と入荷予定を基に、30日先までの在庫推移を自動計算する機能。欠品予測に使います。"],
                                            ["c/s（ケース）", "製品の出荷単位。1ケースに入るピース数は製品マスタの unit_per_cs で管理します。"],
                                            ["p（ピース）", "製品の最小単位（1個）。棚卸・出荷時にケース未満の端数として入力します。"],
                                            ["引き当て", "受注に対して、倉庫の製品在庫（Lot）を割り当て・確保すること。"],
                                            ["棚卸", "実際の在庫数を数えてシステムの数値と照合し、ズレを修正する作業。"],
                                            ["マスタ", "製品・原料・得意先など、業務の基本情報を登録した設定データ。"],
                                            ["ロールバック", "製造計画を削除した際に、連動して増減した在庫を自動で元に戻す機能。"],
                                            ["HACCP", "食品製造における危害分析・重要管理点方式。衛生管理記録の根拠文書。"],
                                            ["管理者モード", "データの編集・登録・削除・在庫操作ができる権限。ヘッダーのスイッチで切り替え。"],
                                            ["閲覧者モード", "データの参照のみ可能。誤操作防止のためフィールド作業時に推奨。"],
                                        ].map(([term, desc], i) => (
                                            <tr key={term as string} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                                                <td className="px-3 py-2 border border-slate-200 font-bold text-blue-800 text-xs align-top whitespace-nowrap">{term as string}</td>
                                                <td className="px-3 py-2 border border-slate-200 text-slate-600">{desc as string}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* ── 権限ロール ── */}
                        <section id="roles" className="avoid-break scroll-mt-20">
                            <SectionTitle id="roles">
                                <Shield className="inline h-6 w-6 mr-2 text-blue-600" />権限ロール別 操作可否一覧
                            </SectionTitle>
                            <p className="text-sm text-slate-600 mb-4">
                                ヘッダー右上の「👑 管理者 / 👀 閲覧者」スイッチで切り替えます。フィールド作業中は必ず<strong>閲覧者モード</strong>にしておくことを推奨します。
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-700 text-white text-xs">
                                            <th className="px-3 py-2 border border-slate-600 text-left">操作</th>
                                            <th className="px-3 py-2 border border-slate-600 text-center">管理者</th>
                                            <th className="px-3 py-2 border border-slate-600 text-center">閲覧者</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {[
                                            ["各画面の閲覧・印刷・MRP予測の参照", true, true],
                                            ["マスタ（製品・原料・得意先）の編集・追加", true, false],
                                            ["受注の新規登録・編集・削除", true, false],
                                            ["発注書 PDF の作成・印刷", true, false],
                                            ["入荷済ボタン（原料在庫加算）", true, false],
                                            ["製造計画の登録・分割", true, false],
                                            ["製造開始ボタン（原料在庫減算）", true, false],
                                            ["製造完了ボタン（製品在庫加算）", true, false],
                                            ["製造計画の削除（ロールバック）", true, false],
                                            ["棚卸の実行・一括保存", true, false],
                                            ["出荷引き当て・確定", true, false],
                                            ["カレンダーへのイベント追加・削除", true, false],
                                            ["HACCP 資料の新規登録・編集", true, false],
                                        ].map(([op, admin, viewer]) => (
                                            <tr key={op as string} className="even:bg-slate-50">
                                                <td className="px-3 py-2 border border-slate-200">{op as string}</td>
                                                <td className="px-3 py-2 border border-slate-200 text-center">
                                                    {admin ? <span className="text-green-600 font-bold">✓</span> : <span className="text-red-400">—</span>}
                                                </td>
                                                <td className="px-3 py-2 border border-slate-200 text-center">
                                                    {viewer ? <span className="text-green-600 font-bold">✓</span> : <span className="text-red-400">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* ── はじめに ── */}
                        <section id="intro" className="avoid-break scroll-mt-20">
                            <SectionTitle id="intro">はじめに</SectionTitle>
                            <p className="text-sm text-slate-700 leading-relaxed mb-4">
                                本システムは、災害備蓄用パンの「受注〜製造〜出荷」に至るすべてのモノの流れ（サプライチェーン）を一元管理し、在庫の自動計算やLot番号の自動採番を行うことで、業務効率化とミス防止を実現するシステムです。
                            </p>
                            <div className="space-y-3">
                                <InfoBox color="amber" icon={<AlertCircle className="h-4 w-4 shrink-0" />} title="重要：在庫との連動ルール">
                                    <p>システム内の在庫数は、各画面のステータス更新と<strong>完全に連動</strong>して増減します。</p>
                                    <ul className="list-disc pl-4 mt-2 space-y-1">
                                        <li>「入荷済」ボタン → 原料在庫 <span className="text-green-700 font-bold">＋加算</span></li>
                                        <li>「製造開始」ボタン → 原料在庫 <span className="text-red-600 font-bold">－減算</span></li>
                                        <li>「製造完了」ボタン → 製品在庫 <span className="text-green-700 font-bold">＋加算</span></li>
                                        <li>「出荷確定」ボタン → 製品在庫 <span className="text-red-600 font-bold">－減算</span></li>
                                        <li>「計画削除（キャンセル）」→ 連動した在庫変動を<span className="text-blue-700 font-bold">自動で元に戻す（ロールバック）</span></li>
                                    </ul>
                                    <p className="mt-2">必ず実際の作業と<strong>同時</strong>にシステムを操作してください。</p>
                                </InfoBox>
                                <InfoBox color="blue" icon={<ShieldAlert className="h-4 w-4 shrink-0" />} title="権限について">
                                    ヘッダー右上のスイッチで「管理者モード（👑）」と「閲覧モード（👀）」を切り替えられます。情報の新規登録・編集・削除、在庫を動かすボタンの操作は<strong>管理者モードでのみ可能</strong>です。
                                </InfoBox>
                            </div>
                        </section>

                        <div className="page-break" />

                        {/* ── スイムレーン ── */}
                        <section id="swimlane" className="avoid-break scroll-mt-20">
                            <SectionTitle id="swimlane">1. 業務フロー（スイムレーン図）</SectionTitle>
                            <p className="text-sm text-slate-600 mb-4">
                                担当者ごとにレーンを色分けし、システムが自動処理するステップを右端レーンに表示しています。
                            </p>
                            <SwimlaneChart />
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                {LANES.map((l) => (
                                    <div key={l.label} className={`border rounded px-2 py-1 text-center font-bold ${l.color}`}>
                                        {l.label.replace("\n", " ")}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* ── マスタ管理 ── */}
                        <section id="master" className="avoid-break scroll-mt-20">
                            <SectionTitle id="master">2. マスタ管理（初期設定）</SectionTitle>
                            <p className="text-sm text-slate-700 mb-4">システムを正しく動かすための「基礎データ」を登録・編集する画面です。編集は<strong>管理者モードのみ</strong>可能です。</p>

                            <SubTitle>■ 編集・新規登録の方法</SubTitle>
                            <ol className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label="一覧表の編集したいセルを直接クリックします。入力枠に変わります。" />
                                <StepBadge n={2} label="値を書き換えて Enter キー、または入力枠の外をクリックすると自動保存されます。" />
                                <StepBadge n={3} label="新しく追加する場合は右上の「新規データ登録」ボタンを使います。" />
                            </ol>

                            <SubTitle>■ 主要マスタと登録項目</SubTitle>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700">
                                            <th className="px-3 py-2 border text-left">マスタ名</th>
                                            <th className="px-3 py-2 border text-left">主な登録項目</th>
                                            <th className="px-3 py-2 border text-left">注意点</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-600">
                                        {[
                                            ["製品マスタ", "製品名 / 種類(味) / 1kgあたり個数 / 1c/sあたり入数(unit_per_cs)", "unit_per_cs を間違えると在庫計算が狂う。変更時は必ず棚卸を実施すること。"],
                                            ["品目マスタ（原料・資材）", "品目名 / 種別 / 単位 / 安全在庫数量", "安全在庫を設定すると MRP 予測での欠品警告が早めに出るようになる。"],
                                            ["BOM（レシピ）", "製品ID / 品目ID / 使用量 / 基準（kg or c/s）", "変更は次回製造計画から反映。過去のLotには影響しない。"],
                                            ["得意先マスタ", "得意先名 / 住所 / 電話番号", "受注登録時のプルダウン・検索に連動する。名前の一部入力で絞り込み可能。"],
                                        ].map(([name, fields, note]) => (
                                            <tr key={name as string} className="even:bg-slate-50">
                                                <td className="px-3 py-2 border font-bold text-blue-800 whitespace-nowrap">{name as string}</td>
                                                <td className="px-3 py-2 border">{fields as string}</td>
                                                <td className="px-3 py-2 border text-amber-700">{note as string}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <div className="page-break" />

                        {/* ── 受注管理 ── */}
                        <section id="order" className="avoid-break scroll-mt-20">
                            <SectionTitle id="order">3. 受注管理（注文の登録と編集）</SectionTitle>

                            <SubTitle>■ 新規受注の登録手順</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='画面右上の「新規受注登録」ボタンを押します。（管理者モード時のみ表示）' />
                                <StepBadge n={2} label='以下の項目を入力します：' />
                                <div className="ml-9 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                                    {[
                                        ["希望納期", "カレンダーから選択", "必須"],
                                        ["出荷先", "得意先名の一部を入力して検索・選択", "必須"],
                                        ["製品名", "製品マスタから選択", "必須"],
                                        ["種類（味）", "製品名を選ぶと自動で絞り込まれる", "必須"],
                                        ["受注数 (c/s)", "ケース単位で数値入力", "必須"],
                                        ["備考", "自由記入", "任意"],
                                    ].map(([field, hint, req]) => (
                                        <div key={field as string} className="flex items-start gap-2 text-sm">
                                            <span className="font-bold text-blue-800 shrink-0 w-28">{field as string}</span>
                                            <span className="text-slate-600 flex-1">{hint as string}</span>
                                            <span className={`text-xs font-bold shrink-0 ${req === "必須" ? "text-red-600" : "text-slate-400"}`}>{req as string}</span>
                                        </div>
                                    ))}
                                </div>
                                <StepBadge n={3} label='数量を入力した瞬間、BOMシミュレーション結果が右側に表示されます。' />
                                <StepBadge n={4} label='BOM 確認後、「受注を確定する」ボタンを押して保存します。' />
                            </div>

                            <SubTitle>■ 登録後の編集・キャンセル</SubTitle>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
                                <div className="flex items-start gap-2">
                                    <Edit className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <p><strong>編集：</strong>受注カード右上の「鉛筆アイコン（✏）」をクリックすると編集モードになります。内容を修正して保存してください。</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                    <p><strong>削除・キャンセル：</strong>「削除」ボタンを押すと受注が取り消されます。製造計画が紐づいている場合は先に計画を削除してください。</p>
                                </div>
                            </div>

                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <InfoBox color="green" icon={<CheckCircle2 className="h-4 w-4" />} title="在庫が足りている場合">
                                    必要量・現在庫・過不足が<span className="font-bold text-green-700">緑色</span>で表示されます。そのまま確定できます。
                                </InfoBox>
                                <InfoBox color="red" icon={<AlertTriangle className="h-4 w-4" />} title="在庫が不足している場合">
                                    不足品目が<span className="font-bold text-red-700">赤色</span>で警告表示されます。受注登録は可能ですが、製造前に<strong>入荷管理</strong>で調達を行ってください。
                                </InfoBox>
                            </div>
                        </section>

                        {/* ── 入荷管理 ── */}
                        <section id="arrival" className="avoid-break scroll-mt-20">
                            <SectionTitle id="arrival">4. 入荷管理（発注と発注書PDF）</SectionTitle>

                            <SubTitle>■ 発注登録の手順</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='「入荷管理」画面を開きます。' />
                                <StepBadge n={2} label='左側フォームから「品目」「数量」を入力します。（ステータスは「発注済」になります）' />
                                <StepBadge n={3} label='「発注登録」ボタンを押すと右側リストに追加されます。この時点では在庫は未加算です。' />
                            </div>

                            <SubTitle>■ 発注書 PDF の作成</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='画面右上の「発注書(PDF)作成」ボタンを押します。' />
                                <StepBadge n={2} label='取引先（橋谷㈱・㈱ネクス等）向けの FAX フォーマットで、A4 サイズの発注書が印刷されます。' />
                            </div>

                            <SubTitle>■ 入荷受け入れの手順（在庫加算）</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='実際に資材が届いたら、右側リストの該当行の「確認」ボタンを押します。' />
                                <StepBadge n={2} label='確認ダイアログが開きます。実際の入荷数量を確認または修正します。' />
                                <StepBadge n={3} label='緑色の「入荷済にする（在庫に加算）」ボタンを押します。' />
                                <StepBadge n={4} label='item_stocks の数量が即時更新され、在庫管理画面に反映されます。' />
                            </div>
                            <InfoBox color="amber" icon={<AlertCircle className="h-4 w-4" />} title="注意">
                                「確認」ボタンを押しただけでは在庫に加算されません。必ず<strong>「入荷済にする」</strong>まで押してください。
                            </InfoBox>
                        </section>

                        <div className="page-break" />

                        {/* ── 製造管理 ── */}
                        <section id="production" className="avoid-break scroll-mt-20">
                            <SectionTitle id="production">5. 製造管理（計画と Lot 自動発行）</SectionTitle>

                            <SubTitle>■ 製造計画の登録手順</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='「製造管理」画面を開きます。' />
                                <StepBadge n={2} label='左側「未計画の残数がある受注」リストから、製造したい受注をクリックします。' />
                                <StepBadge n={3} label='右側フォームに以下を入力します：' />
                                <div className="ml-9 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                                    {[
                                        ["製造予定日", "カレンダーから選択", "必須"],
                                        ["製造量 (kg)", "数値入力。全量を一度に製造しない場合は分割量を入力", "必須"],
                                        ["製造 Lot 番号", "自動生成（変更不可）", "自動"],
                                        ["賞味期限", "製造日 ＋ 5年6ヶ月を自動計算（変更不可）", "自動"],
                                    ].map(([field, hint, req]) => (
                                        <div key={field as string} className="flex items-start gap-2 text-sm">
                                            <span className="font-bold text-blue-800 shrink-0 w-32">{field as string}</span>
                                            <span className="text-slate-600 flex-1">{hint as string}</span>
                                            <span className={`text-xs font-bold shrink-0 ${req === "必須" ? "text-red-600" : req === "自動" ? "text-blue-500" : "text-slate-400"}`}>{req as string}</span>
                                        </div>
                                    ))}
                                </div>
                                <StepBadge n={4} label='「計画を追加する」ボタンを押します。この時点では在庫は動きません。' />
                                <StepBadge n={5} label='残数がゼロになるまで繰り返して分割登録できます。' />
                            </div>

                            <SubTitle>■ 製造実行（在庫連動）の手順</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='リスト下の「確認」ボタン、またはカレンダー（予定表）から計画カードをクリックします。' />
                                <StepBadge n={2} label='詳細ダイアログが開きます。' />
                                <StepBadge n={3} label='製造を開始する際：「製造を開始する」ボタンを押します。' />
                                <div className="ml-9">
                                    <InfoBox color="red" icon={<AlertTriangle className="h-4 w-4" />} title="原料在庫が自動でマイナスされます">
                                        BOMに登録されたすべての原料・資材が item_stocks から即時減算されます。
                                    </InfoBox>
                                </div>
                                <StepBadge n={4} label='パンが完成したら：「製造を完了する」ボタンを押します。' />
                                <div className="ml-9">
                                    <InfoBox color="green" icon={<CheckCircle2 className="h-4 w-4" />} title="製品在庫が自動でプラスされます">
                                        完成した製品が Lot 番号・賞味期限付きで product_stocks に加算されます。
                                    </InfoBox>
                                </div>
                            </div>

                            <SubTitle>■ 計画の取り消し（ロールバック機能）</SubTitle>
                            <InfoBox color="red" icon={<AlertCircle className="h-4 w-4" />} title="間違えても安心：自動ロールバック機能">
                                <p>計画の「削除（キャンセル）」を行うと、システムが以下を<strong>全自動</strong>で処理します。</p>
                                <ul className="list-disc pl-4 mt-2 space-y-1">
                                    <li>「製造中」を削除 ⇒ 引き落とされた<strong>原料・資材の在庫が元に戻ります</strong></li>
                                    <li>「完了」を削除 ⇒ 増えた<strong>製品 Lot の在庫が取り消し（マイナス）されます</strong></li>
                                </ul>
                            </InfoBox>

                            <SubTitle>■ ステータスの流れ</SubTitle>
                            <div className="flex flex-wrap gap-2 items-center text-xs font-bold mt-2">
                                {[
                                    { label: "計画済", color: "bg-blue-100 text-blue-800 border-blue-300" },
                                    { label: "→", color: "text-slate-400 border-0 bg-transparent" },
                                    { label: "製造中", color: "bg-orange-100 text-orange-800 border-orange-300" },
                                    { label: "→", color: "text-slate-400 border-0 bg-transparent" },
                                    { label: "完了", color: "bg-green-100 text-green-800 border-green-300" },
                                ].map((s, i) => (
                                    <span key={i} className={`px-3 py-1 border rounded-full ${s.color}`}>{s.label}</span>
                                ))}
                            </div>
                        </section>

                        {/* ── 在庫管理 ── */}
                        <section id="inventory" className="avoid-break scroll-mt-20">
                            <SectionTitle id="inventory">6. 在庫管理・棚卸（実数調整）</SectionTitle>

                            <SubTitle>■ 在庫予測（MRP）カレンダーの見方</SubTitle>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700 mb-4">
                                <li>製造計画による消費予定と入荷予定を考慮し、今後 <strong>30 日分</strong>の在庫推移を自動計算して表示します。</li>
                                <li>安全在庫を下回る（欠品が予測される）日付は<span className="text-red-600 font-bold">赤色</span>でハイライトされます。</li>
                                <li>計算式：<code className="bg-slate-100 px-1 rounded text-xs text-slate-700">翌日の在庫 ＝ 本日の在庫 ＋ 入荷予定数 − 製造予定のBOM消費量</code></li>
                            </ul>

                            <SubTitle>■ スマホ一括棚卸の手順</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='「在庫管理」画面を開き、「一括棚卸を開始」ボタンを押します。' />
                                <StepBadge n={2} label='全項目に入力枠が現れます。実際に在庫を数えながら、ズレている項目を書き換えます。' />
                                <StepBadge n={3} label='製品在庫はケース (c/s) とピース (p) を別々の枠に入力できます。' />
                                <StepBadge n={4} label='変更した項目は黄色くハイライトされます。内容を確認したら「一括保存」ボタンを押します。' />
                                <StepBadge n={5} label='調整履歴（変更前・変更後・差分・日時）が inventory_adjustments テーブルに自動記録されます。' />
                            </div>
                            <InfoBox color="blue" icon={<Info className="h-4 w-4" />} title="棚卸の推奨タイミング">
                                月末、製造前後、入荷後の確認として実施することを推奨します。スマホからも操作可能です。
                            </InfoBox>
                        </section>

                        <div className="page-break" />

                        {/* ── 出荷管理 ── */}
                        <section id="shipment" className="avoid-break scroll-mt-20">
                            <SectionTitle id="shipment">7. 出荷管理（手動引き当て）</SectionTitle>

                            <SubTitle>■ 出荷手順</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='「出荷管理」画面を開きます。' />
                                <StepBadge n={2} label='左側リストから出荷する受注をクリックして選択します。' />
                                <StepBadge n={3} label='右側に「出荷可能な Lot 一覧」が古い順（先入れ先出し）で表示されます。' />
                                <StepBadge n={4} label='出荷するLotにチェックを入れ、出荷数量（c/s と p）を手入力します。複数 Lot にまたがる場合は複数行に入力してください。' />
                                <StepBadge n={5} label='画面下部の合計数が受注数量と一致することを確認します。' />
                                <StepBadge n={6} label='「出荷を確定」ボタンを押します。該当 Lot の product_stocks が即時減算されます。' />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <InfoBox color="amber" icon={<AlertCircle className="h-4 w-4" />} title="顧客の残存賞味期限要求に注意">
                                    古い Lot を優先しつつ、お客様が要求する残存賞味期限を下回らない Lot を選んでください。
                                </InfoBox>
                                <InfoBox color="red" icon={<AlertTriangle className="h-4 w-4" />} title="出荷確定は取り消せません">
                                    確定後に在庫を戻す場合は棚卸（手動調整）で対応してください。
                                </InfoBox>
                            </div>
                        </section>

                        {/* ── カレンダー ── */}
                        <section id="calendar" className="avoid-break scroll-mt-20">
                            <SectionTitle id="calendar">8. 予定表（カレンダー）の活用と印刷</SectionTitle>

                            <SubTitle>■ 基本の見方</SubTitle>
                            <div className="flex flex-wrap gap-2 text-xs font-bold mb-3">
                                {[
                                    { label: "計画済（青）", color: "bg-blue-100 text-blue-800 border-blue-300" },
                                    { label: "製造中（オレンジ）", color: "bg-orange-100 text-orange-800 border-orange-300" },
                                    { label: "完了（緑）", color: "bg-green-100 text-green-800 border-green-300" },
                                    { label: "社内イベント（グレー）", color: "bg-slate-100 text-slate-700 border-slate-300" },
                                ].map((s) => (
                                    <span key={s.label} className={`px-3 py-1 border rounded-full ${s.color}`}>{s.label}</span>
                                ))}
                            </div>
                            <InfoBox color="blue" icon={<Info className="h-4 w-4" />} title="PC・スマホの自動切り替え">
                                PCでは横型のマス目カレンダー、スマホでは指でスクロールしやすい縦型リストカレンダーが自動で表示されます。
                            </InfoBox>

                            <SubTitle>■ イベントの追加手順</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='カレンダー上の日付右側にある「＋」ボタンをクリックします。' />
                                <StepBadge n={2} label='タイトル・メモを入力して「保存」を押します。' />
                                <StepBadge n={3} label='登録されたイベントは events テーブルに保存され、全員の画面に表示されます。' />
                            </div>

                            <SubTitle>■ 印刷の手順</SubTitle>
                            <div className="space-y-2 text-sm">
                                <StepBadge n={1} label='カレンダー右上の「予定表を印刷」ボタンを押します。' />
                                <StepBadge n={2} label='ブラウザの印刷ダイアログが開きます。用紙サイズは A4 縦を推奨します。' />
                                <StepBadge n={3} label='白黒印刷で綺麗にA4用紙に収まる専用レイアウトで印刷されます。' />
                            </div>
                        </section>

                        {/* ── HACCP ── */}
                        <section id="haccp" className="avoid-break scroll-mt-20">
                            <SectionTitle id="haccp">9. HACCP・各種マニュアル閲覧</SectionTitle>
                            <p className="text-sm text-slate-600 mb-4">
                                HACCP関連書類や、オーブン・包装機などの機械の取扱説明書（PDF等）を一元管理するポータル画面です。
                            </p>
                            <SubTitle>■ 閲覧手順</SubTitle>
                            <div className="space-y-2 text-sm mb-4">
                                <StepBadge n={1} label='メニューから「HACCP 資料」を開きます。' />
                                <StepBadge n={2} label='カテゴリでフィルタして目的の資料を探します。' />
                                <StepBadge n={3} label='「閲覧する」ボタンを押すと PDF 等の資料が開きます。' />
                            </div>
                            <SubTitle>■ 資料登録手順（管理者のみ）</SubTitle>
                            <div className="space-y-2 text-sm">
                                <StepBadge n={1} label='Google ドライブ等に PDF をアップロードし、共有リンクを取得します。' />
                                <StepBadge n={2} label='「新規資料の登録」ボタンを押します。' />
                                <StepBadge n={3} label='タイトル・カテゴリ・バージョン・URL を入力して保存します。' />
                            </div>
                        </section>

                        <div className="page-break" />

                        {/* ── エラー対処 ── */}
                        <section id="errors" className="avoid-break scroll-mt-20">
                            <SectionTitle id="errors">
                                <AlertTriangle className="inline h-6 w-6 mr-2 text-amber-500" />エラー・警告メッセージの対処法
                            </SectionTitle>
                            <div className="space-y-4">
                                {[
                                    { color: "red" as const, msg: "原料・資材の在庫が不足しています（赤色表示）", cause: "BOM 計算の結果、現在庫が必要量に満たない。", action: "入荷管理から不足品目を発注・受け入れてから再度操作してください。" },
                                    { color: "amber" as const, msg: "製造計画が未計画の状態です", cause: "受注は登録されているが製造計画がまだない。", action: "製造管理画面で製造予定日・kg数を入力して計画を追加してください。" },
                                    { color: "amber" as const, msg: "出荷可能な Lot がありません", cause: "製品在庫に該当製品の Lot が存在しない。", action: "製造管理で「製造完了」まで処理されているか確認してください。" },
                                    { color: "red" as const, msg: "保存に失敗しました（ネットワークエラー）", cause: "インターネット接続切断または DB タイムアウト。", action: "ページをリロードして再度操作してください。データは入力前の状態に戻ります。" },
                                    { color: "amber" as const, msg: "在庫がマイナスになっています", cause: "棚卸漏れ、または二重操作による数値のズレ。", action: "在庫管理の棚卸機能で実数を入力し直してください。調整履歴が残ります。" },
                                ].map((e) => (
                                    <InfoBox key={e.msg} color={e.color} icon={<AlertTriangle className="h-4 w-4 shrink-0" />} title={e.msg}>
                                        <p><span className="font-bold">原因：</span>{e.cause}</p>
                                        <p className="mt-1"><span className="font-bold">対処：</span>{e.action}</p>
                                    </InfoBox>
                                ))}
                            </div>
                        </section>

                        {/* ── トラブルシューティング ── */}
                        <section id="trouble" className="avoid-break scroll-mt-20">
                            <SectionTitle id="trouble">
                                <HelpCircle className="inline h-6 w-6 mr-2 text-blue-500" />トラブルシューティング Q&A
                            </SectionTitle>
                            <div className="space-y-4">
                                {[
                                    { q: "受注登録ボタンが表示されない", a: "ヘッダーのスイッチが「👀 閲覧者」になっています。「👑 管理者」に切り替えてください。" },
                                    { q: "発注書 PDF のフォーマットが崩れる", a: "ブラウザの印刷設定で「背景のグラフィック」を有効にしてください。または Chrome 最新版をお使いください。" },
                                    { q: "Lot 番号が重複してしまった", a: "同一日・同一製品で複数計画を立てると連番で区別されます。重複している場合は技術管理者へ連絡してください。" },
                                    { q: "製造完了したのに製品在庫が増えていない", a: "「製造完了」ボタンではなく「製造開始」で止まっていないか確認してください。カレンダーのカードを開いてステータスを確認できます。" },
                                    { q: "誤って「製造開始」を押してしまった", a: "計画の「削除（キャンセル）」を行うと、引き落とされた原料在庫が自動でロールバックされます。" },
                                    { q: "棚卸で保存したのに数値が元に戻った", a: "「一括保存」を押す前にブラウザがリロードされた可能性があります。保存後に調整履歴を確認してください。" },
                                    { q: "スマホでカレンダーがマス目表示になる", a: "スマホでは自動的に縦型リストカレンダーに切り替わります。PCモードになっている場合はブラウザのズームを 100% に戻してください。" },
                                    { q: "HACCP 資料のリンクを押しても開かない", a: "Google ドライブの共有設定が「リンクを知っている全員」になっているか確認してください。" },
                                ].map((qa) => (
                                    <div key={qa.q} className="border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="bg-slate-100 px-4 py-2 font-bold text-sm text-slate-800 flex items-center gap-2">
                                            <HelpCircle className="h-4 w-4 text-blue-500 shrink-0" />Q. {qa.q}
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
                    <aside className="hidden md:block w-56 shrink-0 border-r border-slate-200 p-4 sticky top-0 self-start">
                        <p className="font-mono text-[9px] tracking-[0.2em] text-slate-400 uppercase mb-2">目次</p>
                        {TECH_TOC.map((row) => (
                            <TocRow key={row.num} label={`${row.num}. ${row.label}`} onClick={() => scrollToTech(row.num)} />
                        ))}
                    </aside>

                    <div className="md:hidden border-b border-slate-200">
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700"
                            onClick={() => setTechTocOpen(!techTocOpen)}
                        >
                            <span className="font-mono text-[10px] tracking-[0.2em] text-slate-400 uppercase">目次</span>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${techTocOpen ? "rotate-180" : ""}`} />
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

                    <main className="flex-1 p-4 md:p-10 space-y-12 min-w-0">

                        {/* 01 */}
                        <section id="tech-01" className="scroll-mt-20">
                            <SectionTitle id="tech-01-h">01. システム・アーキテクチャ</SectionTitle>
                            <div className="bg-slate-800 text-white rounded-xl p-4 md:p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                    {[
                                        { label: "フロントエンド", items: ["Next.js (App Router) + React", "TypeScript", "Tailwind CSS (shadcn/ui)"] },
                                        { label: "バックエンド / DB", items: ["Neon (Serverless PostgreSQL)", "Drizzle ORM", "NextAuth v5"] },
                                        { label: "特徴", items: ["Responsive UI (PC / スマホ自動切替)", "Server / Client Components", "Role-based Access Control", "MRP Inventory Forecast"] },
                                    ].map((col) => (
                                        <div key={col.label} className="bg-slate-700/50 rounded border border-slate-600 p-3">
                                            <div className="font-bold text-blue-300 mb-2 text-xs tracking-widest uppercase">{col.label}</div>
                                            {col.items.map((it) => <div key={it} className="text-slate-300 text-sm">{it}</div>)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* 02 */}
                        <section id="tech-02" className="scroll-mt-20">
                            <SectionTitle id="tech-02-h">02. Lot 番号の自動生成ルール</SectionTitle>
                            <p className="text-sm text-slate-600 mb-3">
                                <code className="bg-slate-100 px-1 rounded text-slate-700 text-xs">src/lib/lot-generator.ts</code> にて制御。入力された日付と製品IDから一意の文字列を生成します。
                            </p>
                            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
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

                        {/* 03 */}
                        <section id="tech-03" className="scroll-mt-20">
                            <SectionTitle id="tech-03-h">03. ケース・ピース混在管理</SectionTitle>
                            <p className="text-sm text-slate-600 mb-3">繰り下がりバグを防ぐため、DB と画面でデータの持ち方を分けています。</p>
                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                    <div className="font-bold text-blue-800 mb-2">DB（Neon）</div>
                                    <p className="text-slate-600 mb-2"><code className="bg-white px-1 rounded border text-xs">product_stocks.total_pieces</code> に総ピース数で保存</p>
                                    <div className="bg-white border rounded px-3 py-2 font-mono text-xs">例: 10 c/s + 5 p → <strong>245</strong></div>
                                </div>
                                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                    <div className="font-bold text-blue-800 mb-2">フロントエンド（表示時変換）</div>
                                    <div className="font-mono text-xs space-y-1 bg-white border rounded px-3 py-2 break-all">
                                        <div><span className="text-blue-600">cs</span> = Math.floor( total_pieces / unit_per_cs )</div>
                                        <div><span className="text-blue-600">p</span>  = total_pieces % unit_per_cs</div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 04 MRP */}
                        <section id="tech-04" className="scroll-mt-20">
                            <SectionTitle id="tech-04-h">04. MRP（資材所要量計画）計算ロジック</SectionTitle>
                            <p className="text-sm text-slate-700 mb-3">
                                在庫管理画面の「在庫予測」は、以下の数式で30日先までの在庫推移を自動計算します。
                            </p>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm text-slate-800 break-all">
                                翌日の在庫 ＝ 本日の在庫 ＋ 入荷予定数（pending） − 製造予定のBOM消費量（planned）
                            </div>
                            <ul className="mt-3 list-disc pl-5 text-sm text-slate-600 space-y-1">
                                <li><strong>入荷予定数：</strong>arrivals テーブルの status = 'pending' かつ expected_date が対象日のレコードを合計</li>
                                <li><strong>BOM消費量：</strong>production_plans テーブルの対象日の計画に対して BOM の usage_rate を乗算した値を合計</li>
                                <li>安全在庫（safety_stock）を下回る日付を赤色でフラグ表示します。</li>
                            </ul>
                        </section>

                        {/* 05 DB */}
                        <section id="tech-05" className="scroll-mt-20">
                            <SectionTitle id="tech-05-h">05. データベース・テーブル構成</SectionTitle>
                            <div className="sm:hidden space-y-2">
                                {[
                                    ["products", "製品マスタ（完成品）", "id, name, variant_name, unit_per_cs, unit_per_kg"],
                                    ["items", "品目マスタ（原料・資材）", "id, item_type, unit_size, safety_stock"],
                                    ["bom", "部品表（レシピ）", "product_id(FK), item_id(FK), usage_rate, basis_type"],
                                    ["customers", "得意先マスタ", "id, name, address, phone"],
                                    ["orders", "受注データ", "id, customer_id(FK), product_id(FK), quantity, status"],
                                    ["production_plans", "製造計画・実績", "id, order_id(FK), production_date, planned_cs, lot_code, status"],
                                    ["item_stocks", "原料・資材の現在庫", "item_id(FK), quantity"],
                                    ["product_stocks", "完成品の現在庫（Lot 別）", "id, lot_code, product_id(FK), total_pieces, expiry_date"],
                                    ["arrivals", "入荷予定・発注", "id, item_id(FK), expected_date, quantity, status"],
                                    ["shipments", "出荷実績（引き当て）", "id, order_id(FK), lot_code, qty_cs, qty_piece"],
                                    ["inventory_adjustments", "棚卸・調整履歴", "id, adjusted_at, item_id/product_id, before_qty, after_qty, diff, reason"],
                                    ["events", "社内イベント（カレンダー）", "id, event_date, title, notes"],
                                    ["haccp_documents", "HACCP / 機械マニュアル等", "id, title, category, file_url, version"],
                                ].map(([name, role, cols]) => (
                                    <div key={name as string} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                                        <div className="font-mono text-xs font-bold text-blue-700 mb-0.5">{name as string}</div>
                                        <div className="text-sm text-slate-600 mb-1">{role as string}</div>
                                        <div className="font-mono text-[11px] text-slate-400 break-all">{cols as string}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-sm border-collapse border border-slate-300">
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
                                            ["item_stocks", "原料・資材の現在庫", "item_id(FK), quantity"],
                                            ["product_stocks", "完成品の現在庫（Lot 別）", "id, lot_code, product_id(FK), total_pieces, expiry_date"],
                                            ["arrivals", "入荷予定・発注", "id, item_id(FK), expected_date, quantity, status"],
                                            ["shipments", "出荷実績（引き当て）", "id, order_id(FK), lot_code, qty_cs, qty_piece"],
                                            ["inventory_adjustments", "棚卸・調整履歴", "id, adjusted_at, item_id/product_id, before_qty, after_qty, diff, reason"],
                                            ["events", "社内イベント（カレンダー）", "id, event_date, title, notes"],
                                            ["haccp_documents", "HACCP / 機械マニュアル等", "id, title, category, file_url, version", true, "#d1fae5"],
                                        ].map(([name, role, cols, highlight, bg], i) => (
                                            <tr key={name as string}
                                                style={highlight ? { backgroundColor: typeof bg === 'string' ? bg : "#eff6ff" } : undefined}
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
            <footer className="border-t border-slate-200 px-4 md:px-8 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[10px] font-mono text-slate-400">
                <span>災害備蓄用パン 製造・HACCP 統合管理システム</span>
                <span>取扱説明書 — REV. 2.1.0</span>
            </footer>
        </div>
    );
}