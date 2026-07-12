"use client";

import { useState, useEffect } from "react";
import {
  BookOpen, Printer, Menu as MenuIcon, Settings, Info,
  ChevronDown, AlertCircle, CheckCircle2, FileText,
  AlertTriangle, HelpCircle, ChevronRight, Truck, Calendar, Factory, Package, ArrowRight,
  ArrowDownToLine, ShoppingCart, Edit, ShieldCheck, LineChart, Search, Bug
} from "lucide-react";
import { Button } from "@/components/ui/button";
import document from "next/document";

// ─────────────────────────────────────────────
type TabKey = "user" | "tech";

// ─────────────────────────────────────────────
//  目次データ
// ─────────────────────────────────────────────
const USER_TOC = [
  { id: "intro", title: "はじめに" },
  { id: "glossary", title: "用語集" },
  { id: "swimlane", title: "第1章　業務フロー（全体図）" },
  { id: "order", title: "第2章　受注管理" },
  { id: "arrival", title: "第3章　入荷管理" },
  { id: "production", title: "第4章　製造管理" },
  { id: "inventory", title: "第5章　在庫予測・棚卸" },
  { id: "shipment", title: "第6章　出荷管理" },
  { id: "calendar", title: "第7章　スケジュール表・備考" },
  { id: "haccp", title: "第8章　HACCP・衛生管理記録" },
  { id: "fuji-steamy", title: "第9章　フジスチーミー自動解析" },
  { id: "traceability", title: "第10章　トレーサビリティ追跡機能" },
  { id: "faq", title: "第11章　よくある質問（FAQ）" },
];

const TECH_TOC = [
  { num: "01", label: "システム・アーキテクチャ" },
  { num: "02", label: "Lot 番号の自動生成ルール" },
  { num: "03", label: "ケース・ピース混在管理" },
  { num: "04", label: "監査ログのトリガー機構" },
  { num: "05", label: "データベース・スキーマ定義" },
];

// ─────────────────────────────────────────────
//  スイムレーン
// ─────────────────────────────────────────────
const LANES = [
  { label: "営業 / 管理者", color: "bg-blue-50 border-blue-200 text-blue-800" },
  { label: "製造担当", color: "bg-amber-50 border-amber-200 text-amber-800" },
  { label: "倉庫担当", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { label: "システム (自動)", color: "bg-slate-100 border-slate-300 text-slate-700" },
];

const SWIM_STEPS: [number, string, string][] = [
  [0, "受注登録", "注文書単位で複数製品を登録"],
  [3, "BOM シミュレーション", "必要資材・不足をリアルタイム計算"],
  [0, "資材発注登録", "不足資材を入荷管理に登録"],
  [0, "発注書 PDF 作成", "メーカー毎のFAXフォーム印刷"],
  [2, "資材受入", "届いた資材を「入荷済」にする"],
  [3, "原料在庫 ＋加算", "item_stocks が自動更新"],
  [1, "製造計画登録", "受注引当 または 見込み生産 で登録"],
  [3, "Lot・賞味期限 自動発行", "lot-generator.ts が自動計算"],
  [1, "製造開始ボタン", "実作業スタート"],
  [3, "原料在庫 －減算", "BOM に基づき自動引き落とし"],
  [1, "フジスチーミー加熱", "装置で加熱・記録(CSV出力)"],
  [1, "製造完了・実績入力", "完成したケース/パック数を入力"],
  [3, "キープサンプル自動引当", "5個 または 10個を自動確保"],
  [3, "製品在庫 ＋加算", "残数が product_stocks へ"],
  [0, "QRラベル・各種記録", "サンプルラベル発行、HACCP記録入力"],
  [2, "実地棚卸", "一括棚卸でシステムのズレを修正"],
  [0, "出荷引き当て", "古いLotを優先して手入力で確定"],
  [3, "製品在庫 －減算", "0 になった Lot は自動削除"],
];

function SwimlaneChart() {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[650px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {LANES.map((l) => (
            <div key={l.label} className={`border rounded-lg px-2 py-2 text-xs font-bold text-center whitespace-pre-line shadow-sm ${l.color}`}>
              {l.label}
            </div>
          ))}
        </div>
        <div className="space-y-1.5 relative">
          {SWIM_STEPS.map(([laneIdx, label, sub], i) => (
            <div key={i} className="grid grid-cols-4 gap-2 relative z-10">
              {[0, 1, 2, 3].map((col) => {
                if (col !== laneIdx) return <div key={col} className="border-r border-dashed border-slate-200 h-14 last:border-r-0" />;
                const lane = LANES[laneIdx];
                return (
                  <div key={col} className={`border rounded-lg px-3 py-2 shadow-sm ${lane.color} relative flex flex-col justify-center`}>
                    <div className="text-xs font-bold leading-tight">{label}</div>
                    <div className="text-[10px] opacity-70 leading-tight mt-1">{sub}</div>
                    {i < SWIM_STEPS.length - 1 && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-slate-400 z-20">
                        <ArrowDownToLine className="w-4 h-4" />
                      </div>
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

function Breadcrumb({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-blue-600/80 font-medium mb-5 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
          <span className={i === items.length - 1 ? "text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md" : ""}>{item}</span>
        </span>
      ))}
    </div>
  );
}

function ChapterTitle({ id, num, title, bread }: { id: string; num?: string; title: string; bread?: string[] }) {
  return (
    <div id={id} className="scroll-mt-24 mb-8 pt-8 border-t border-slate-200 first:border-0 first:pt-0">
      {bread && <Breadcrumb items={bread} />}
      <div className="flex items-center gap-4">
        {num && (
          <div className="flex flex-col items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-[linear-gradient(to_bottom_right,var(--color-blue-600),var(--color-indigo-700))] text-white shadow-md print:bg-slate-800 print:text-white">
            <span className="text-[10px] font-bold opacity-80 leading-none -mb-1">{num.replace('第', '').replace('章', '')}</span>
            <span className="text-lg font-black leading-none">CH</span>
          </div>
        )}
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{title}</h2>
      </div>
    </div>
  );
}

function SectionHead({ children, icon: Icon }: { children: React.ReactNode, icon?: any }) {
  return (
    <h3 className="text-lg font-bold text-slate-800 mb-4 mt-8 flex items-center gap-2 border-b border-slate-100 pb-2">
      {Icon && <Icon className="w-5 h-5 text-blue-600" />}
      {!Icon && <span className="w-1.5 h-5 bg-[linear-gradient(to_bottom,var(--color-blue-500),var(--color-indigo-600))] rounded-full inline-block shrink-0 print:bg-slate-800" />}
      {children}
    </h3>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 bg-white border border-slate-100 shadow-sm rounded-xl p-4 md:p-5 hover:border-blue-200 transition-colors break-inside-avoid">
      <div className="flex items-start gap-3 md:gap-4 mb-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black shrink-0 text-lg print:bg-slate-200 print:text-slate-800">
          {n}
        </div>
        <div className="pt-1">
          <h4 className="text-base font-bold text-slate-800 leading-snug">{title}</h4>
          {children && <div className="mt-3 text-sm text-slate-600 space-y-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function NoteBox({ type, children }: { type: "caution" | "supplement" | "info" | "check"; children: React.ReactNode }) {
  const cfg = {
    caution: { bg: "bg-red-50/50 border-red-200", icon: <AlertCircle className="h-5 w-5 text-red-600" />, title: "注意・警告", titleColor: "text-red-800" },
    supplement: { bg: "bg-slate-50 border-slate-200", icon: <Info className="h-5 w-5 text-slate-500" />, title: "補足情報", titleColor: "text-slate-700" },
    info: { bg: "bg-blue-50/50 border-blue-200", icon: <AlertTriangle className="h-5 w-5 text-blue-600" />, title: "重要ポイント", titleColor: "text-blue-800" },
    check: { bg: "bg-emerald-50/50 border-emerald-200", icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, title: "確認事項", titleColor: "text-emerald-800" },
  };
  const c = cfg[type];
  return (
    <div className={`border rounded-xl p-4 my-4 shadow-sm break-inside-avoid ${c.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        {c.icon}
        <span className={`text-sm font-black tracking-wide ${c.titleColor}`}>{c.title}</span>
      </div>
      <div className="text-sm text-slate-700 leading-relaxed ml-7">{children}</div>
    </div>
  );
}

function TocRow({ label, onClick, isActive = false }: { label: string; onClick?: () => void, isActive?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-start gap-2 py-2 px-3 rounded-lg group text-left transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
      <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-400'}`} />
      <span className={`text-sm font-medium leading-tight ${isActive ? 'font-bold' : ''}`}>{label}</span>
    </button>
  );
}

function FieldTable({ rows }: { rows: [string, string, string?][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm my-4">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
          <tr>
            <th className="px-4 py-3 font-bold w-1/3">入力項目</th>
            <th className="px-4 py-3 font-bold">説明・内容</th>
            <th className="px-4 py-3 font-bold text-center w-16">必須</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map(([field, hint, req]) => (
            <tr key={field} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-4 py-3 font-bold text-slate-800">{field}</td>
              <td className="px-4 py-3 text-slate-600">{hint}</td>
              <td className="px-4 py-3 text-center">
                {req === "必須" ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 font-bold text-xs">必</span>
                  : req === "自動" ? <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-bold text-[10px]">自動</span>
                    : <span className="text-slate-400 text-xs font-medium">任意</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden my-4 bg-slate-50/30 shadow-sm transition-all hover:border-blue-200 print:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white text-left font-bold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2.5 text-sm md:text-base font-bold text-slate-800">
          <HelpCircle className="w-5 h-5 text-blue-500 shrink-0" />
          {title}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1500px] opacity-100 border-t border-slate-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-5 bg-white text-sm text-slate-600 leading-relaxed space-y-4">
          {children}
        </div>
      </div>
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
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const tocItems = tab === "user" ? USER_TOC : [];
      for (const item of [...tocItems].reverse()) {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [tab]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
    setMobileTocOpen(false);
    setActiveSection(id);
  };

  const scrollToTech = (num: string) => {
    const el = document.getElementById(`tech-${num}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
    setTechTocOpen(false);
  };

  if (!mounted) return null;

  return (
    <div className="bg-slate-50/50 min-h-screen pb-12 print:bg-white print:p-0">
      <style>{`@media print { @page { size: A4 portrait; margin: 15mm; } .print-hidden { display: none !important; } .page-break { page-break-before: always; } .avoid-break { page-break-inside: avoid; } body { background-color: white !important; } }`}</style>

      <div className="max-w-7xl mx-auto md:px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">

          {/* ── 表紙ヘッダー ── */}
          <header className="bg-[linear-gradient(to_right,var(--color-slate-900),var(--color-slate-800))] px-6 md:px-10 py-8 print:bg-white print:text-black print:border-b-2 print:border-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="bg-white/10 p-3 rounded-xl shrink-0 print:hidden backdrop-blur-sm">
                  <BookOpen className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <div className="text-blue-300 font-mono tracking-widest text-xs font-bold mb-1.5 print:text-slate-500">
                    OPERATION MANUAL - REV. 4.0.0
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight print:text-black">
                    システム取り扱い説明書
                  </h1>
                  <p className="text-slate-400 text-sm mt-2 hidden sm:block print:text-slate-600">
                    災害備蓄用パン 製造・HACCP 統合管理システム
                  </p>
                </div>
              </div>
              <Button
                onClick={() => window.print()}
                variant="outline"
                className="print-hidden shrink-0 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm font-bold shadow-sm"
              >
                <Printer className="h-4 w-4 mr-2" />
                マニュアルを印刷する
              </Button>
            </div>

            {/* タブ */}
            <div className="flex gap-2 mt-8 print-hidden">
              {[
                { key: "user" as const, icon: <Info className="h-4 w-4" />, label: "操作マニュアル" },
                { key: "tech" as const, icon: <Settings className="h-4 w-4" />, label: "技術仕様 (Tech)" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-t-lg transition-colors ${tab === t.key
                    ? "bg-white text-slate-900"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
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
            <div className="flex flex-col md:flex-row relative">

              {/* PC サイドバー (目次) */}
              <aside className="hidden md:block w-72 shrink-0 border-r border-slate-100 bg-slate-50/50 print-hidden">
                <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4 custom-scrollbar">
                  <div className="text-xs font-black text-slate-444 tracking-widest uppercase mb-4 ml-2">Table of Contents</div>
                  <nav className="space-y-1">
                    {USER_TOC.map((item) => (
                      <TocRow key={item.id} label={item.title} isActive={activeSection === item.id} onClick={() => scrollTo(item.id)} />
                    ))}
                  </nav>
                </div>
              </aside>

              {/* モバイル 目次 */}
              <div className="md:hidden border-b border-slate-200 bg-slate-50 print-hidden sticky top-16 z-30">
                <button
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold text-slate-800"
                  onClick={() => setMobileTocOpen(!mobileTocOpen)}
                >
                  <span className="flex items-center gap-2"><MenuIcon className="h-4 w-4 text-blue-600" />目次を開く</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${mobileTocOpen ? "rotate-180" : ""}`} />
                </button>
                {mobileTocOpen && (
                  <nav className="px-4 pb-4 bg-white border-t border-slate-100 shadow-inner max-h-[60vh] overflow-y-auto">
                    {USER_TOC.map((item) => (
                      <button key={item.id} onClick={() => scrollTo(item.id)}
                        className={`block w-full text-left py-3 text-sm font-bold border-b border-slate-50 last:border-0 ${activeSection === item.id ? "text-blue-600 font-black" : "text-slate-600 hover:text-blue-600"}`}>
                        {item.title}
                      </button>
                    ))}
                  </nav>
                )}
              </div>

              {/* 本文 */}
              <main className="flex-1 px-5 md:px-12 py-8 md:py-10 min-w-0 print:p-0">

                {/* ── はじめに ── */}
                <section>
                  <ChapterTitle id="intro" title="はじめに" bread={["操作マニュアル", "はじめに"]} />
                  <p className="text-base text-slate-700 leading-relaxed mb-6">
                    本システムは、災害備蓄用パンの「受注〜製造〜出荷」に至るすべてのモノの流れを一元管理し、在庫の自動計算やLot番号の自動生成によって<strong>業務効率化とヒューマンエラー防止</strong>を実現する基幹システム（ERP）です。
                  </p>
                  <NoteBox type="info">
                    <p className="font-bold mb-2 text-base">在庫数は「完全連動」で増減します</p>
                    <p className="mb-3 text-slate-600">システム内の在庫データは、各画面でのステータス変更操作と同時に自動で計算されます。必ず実際の作業と同じタイミングでシステムを操作してください。</p>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm font-medium">
                      <div className="bg-white p-3 rounded border shadow-sm flex items-center justify-between">
                        <span>入荷予定の確定操作</span>
                        <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-slate-400" /><strong className="text-emerald-600">原料在庫 ＋加算</strong></span>
                      </div>
                      <div className="bg-white p-3 rounded border shadow-sm flex items-center justify-between">
                        <span>製造計画の開始操作</span>
                        <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-slate-400" /><strong className="text-red-600">原料在庫 －減算</strong></span>
                      </div>
                      <div className="bg-white p-3 rounded border shadow-sm flex items-center justify-between">
                        <span>製造完了の実績入力</span>
                        <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-slate-400" /><strong className="text-emerald-600">製品在庫 ＋加算</strong></span>
                      </div>
                      <div className="bg-white p-3 rounded border shadow-sm flex items-center justify-between">
                        <span>出荷指示の確定操作</span>
                        <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-slate-400" /><strong className="text-red-600">製品在庫 －減算</strong></span>
                      </div>
                    </div>
                  </NoteBox>
                  <NoteBox type="supplement">
                    <strong>権限制御スイッチ：</strong>ヘッダー右上に配置されている「👑 管理者 / 👀 閲覧者」のトグルスイッチにより、編集・登録・削除権限が制御されます。閲覧者モードでは、入力フォームや登録用ボタンが非活性、または非表示となり誤入力を防ぎます。
                  </NoteBox>
                </section>

                <div className="page-break" />

                {/* ── 用語集 ── */}
                <section>
                  <ChapterTitle id="glossary" title="用語集" bread={["操作マニュアル", "用語集"]} />
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { t: "Lot（ロット）", d: "一度の製造バッチに付与される識別番号。賞味期限管理とトレーサビリティに使用します。" },
                      { t: "BOM（部品表）", d: "製品のレシピデータ。どの原料を何kg使うかが登録されており、消費量の自動計算に使われます。" },
                      { t: "MRP（資材所要量計画）", d: "製造計画と入荷予定から、30日先までの在庫推移を自動計算する予測機能です。" },
                      { t: "c/s（ケース）と p（パック）", d: "ケースは出荷の基本単位、パックは端数です。パックは常に2個入りとして計算されます。" },
                      { t: "キープサンプル", d: "製造完了時に品質保持のために保管するサンプル。実績入力時に自動で引き当てられます。" },
                      { t: "見込み生産", d: "受注残に関係なく、在庫補充を目的として計画する製造のことです。" },
                      { t: "ロールバック", d: "製造計画をキャンセル（削除）した際、連動して動いた在庫を自動で元の数に戻す安全機能です。" },
                    ].map((item) => (
                      <div key={item.t} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-100 transition-colors">
                        <div className="font-bold text-blue-800 mb-1">{item.t}</div>
                        <div className="text-sm text-slate-600 leading-relaxed">{item.d}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── 業務フロー ── */}
                <section>
                  <ChapterTitle id="swimlane" num="第1章" title="業務フロー（全体図）" bread={["操作マニュアル", "第1章　業務フロー"]} />
                  <p className="text-slate-600 mb-6 leading-relaxed">担当者ごとの作業レーンと、システムが裏側で自動処理するステップ（右端）を時系列で表しています。各工程が次の工程へデータを引き継いでいく流れをご確認ください。</p>
                  <SwimlaneChart />
                </section>

                <div className="page-break" />

                {/* ── 受注管理 ── */}
                <section>
                  <ChapterTitle id="order" num="第2章" title="受注管理（注文の登録と計算）" bread={["操作マニュアル", "第2章　受注管理"]} />

                  <SectionHead icon={ShoppingCart}>受注データの新規登録手順</SectionHead>
                  <Step n={1} title="「新規受注登録」ボタンの押下">
                    <p>受注一覧画面（`/orders`）の右上にある青色の<strong>「新規受注登録」</strong>ボタンを押します（管理者モードのみ表示）。</p>
                  </Step>
                  <Step n={2} title="基本情報の入力">
                    <p>注文書に記載された情報を正確に入力します。カレンダー選択ツールを利用して日付を指定します。</p>
                    <FieldTable rows={[
                      ["出荷予定日", "工場から製品をトラック等に積み込み搬出する日", "必須"],
                      ["納品先への着予定日", "お客様が指定した、納品先への配達予定日", "必須"],
                      ["出荷先名", "入力欄をクリックすると登録済みの出荷先リストが表示され、フィルタ検索も可能です", "必須"],
                      ["発注番号", "お客様が発行した注文書番号（FAX注番等）。トレーサビリティの検索フックにもなります", "任意"],
                      ["摘要", "受注連絡票や出荷案内書に付記する特記事項（例：「午前着指定」など）", "任意"],
                    ]} />
                  </Step>
                  <Step n={3} title="製品と数量の指定 ＆ BOMリアルタイムシミュレーション">
                    <p>製品を追加し、数量をケース（c/s）単位で入力します。複数のフレーバーをまとめて1枚の受注として登録可能です。</p>
                    <NoteBox type="info">
                      <p className="font-bold mb-1">BOM（部品表）シミュレーションアラートの動作</p>
                      数量を入力した瞬間、裏側で必要となる原材料・外箱・缶・ラベルなどの「必要量」が自動計算され、現在の倉庫在庫と比較されます。
                      <strong>不足する原材料・資材がある場合、不足数が赤い文字で警告表示されます。</strong> この状態でも受注登録自体は可能ですが、速やかに「入荷管理（発注）」を計画してください。
                    </NoteBox>
                  </Step>
                  <Step n={4} title="「受注を確定する」ボタンで保存">
                    <p>エラーや不足アラートを確認後、問題がなければ下部の「受注を確定する」ボタンを押して登録を完了します。</p>
                  </Step>

                  <Accordion title="応用: 受注情報の編集・キャンセルとBOM警告時の連動">
                    <div className="space-y-3">
                      <p className="font-bold text-slate-800">■ 登録後の内容変更と削除ルール</p>
                      <p>一度登録した受注は、受注カード右上の<strong>鉛筆アイコン（✏）</strong>から編集画面を開くことができます。ただし、該当の受注に対してすでに「製造計画」が1つでも作成されている場合、安全のために受注数量の変更および削除はロックされます。変更したい場合は、先に製造計画側を削除（ロールバック）してください。</p>
                      <p className="font-bold text-slate-800 mt-4">■ BOM警告から入荷管理へのスマート連携</p>
                      <p>受注登録時に不足アラートが出た資材は、「在庫予測カレンダー（MRP）」にも自動で欠品予定として反映されます。入荷管理（`/arrivals`）画面に移動し、欠品する予定日の前日までに入荷が完了するよう発注処理（大槻食材等）を行ってください。</p>
                    </div>
                  </Accordion>
                </section>

                <div className="page-break" />

                {/* ── 入荷管理 ── */}
                <section>
                  <ChapterTitle id="arrival" num="第3章" title="入荷管理（資材の発注と受入）" bread={["操作マニュアル", "第3章　入荷管理"]} />

                  <SectionHead icon={FileText}>資材の発注およびPDF書式作成</SectionHead>
                  <Step n={1} title="新規発注データの起票">
                    <p>入荷管理画面の左側の登録パネルで、発注日、入荷予定日、品目、数量を入力します。この時点のステータスは「発注済」となり、在庫にはまだ加算されません（MRPカレンダー上の「入荷予定数」として組み込まれます）。</p>
                  </Step>
                  <Step n={2} title="発注書 PDF の自動出力と送付">
                    <p>右上の「発注書（PDF）作成」ボタンを押すと、登録されたデータに基づきメーカー・取引先別の正式な発注書フォーマットがレイアウトされます。ブラウザの印刷ダイアログから紙に印刷、またはPDF保存してFAX・メールで送信します。</p>
                    <p className="text-xs text-slate-500 mt-1">※大槻食材への発注は専用ボタンから別サイトを開いて行います。</p>
                  </Step>

                  <SectionHead icon={Truck}>入荷受け入れ（現物チェックと在庫確定）</SectionHead>
                  <Step n={1} title="入荷予定リスト・カレンダーの現物照合">
                    <p>資材が工場に届いたら、現物と納品書を確認します。画面の「入荷予定」一覧から該当する資材の「受入確認」ボタンを押します。</p>
                  </Step>
                  <Step n={2} title="「入荷済にする」ボタンの押下で在庫加算">
                    <p>数量に間違いがなければ緑色のボタンを押します。</p>
                    <NoteBox type="check">
                      「入荷済にする」ボタンが押された瞬間に、データベースの <strong>item_stocks（原材料・資材在庫）に実数量が加算</strong>され、MRP予測の予定値が「実績値」に切り替わります。
                    </NoteBox>
                  </Step>

                  <Accordion title="トラブル解決: 届いた現物の数量が発注時と異なっていた場合">
                    <div className="space-y-2">
                      <p className="font-bold text-slate-800">現物が不足・破損していた場合の「一部入荷」処理</p>
                      <p>納品された数量が発注数より少ない場合、または運送破損があり一部を返品する場合は、受入画面で<strong>「受入数量」の数値を手動で実際に届いた良品数に書き換えてから</strong>「入荷済にする」を実行してください。</p>
                      <p>システムは「実際に受け入れた数」だけを在庫に加算し、残りの不足分は自動的に「発注残（未納）」ステータスとして入荷予定リストに残留します。後日追加で届いた際に、再度残分を受け入れることが可能です。</p>
                    </div>
                  </Accordion>
                </section>

                <div className="page-break" />

                {/* ── 製造管理 ── */}
                <section>
                  <ChapterTitle id="production" num="第4章" title="製造管理（計画とLot発行）" bread={["操作マニュアル", "第4章　製造管理"]} />
                  <p className="text-slate-600 mb-6 leading-relaxed">システムの心臓部です。製造計画を立て、実際の製造に合わせてステータスを進めることで在庫が自動連動します。</p>

                  <SectionHead icon={Calendar}>1. 製造計画の登録（分割・見込み生産）</SectionHead>
                  <Step n={1} title="製造対象（受注引当 または 在庫補充）の選択">
                    <p>画面左側の「未計画受注リスト」から対象を選ぶ（受注紐付け製造）、または「見込み生産（在庫品として製造）」ボタンを押して製品と製造予定量を決定します。</p>
                  </Step>
                  <Step n={2} title="製造予定日と製造量(kg)を入力する">
                    <p>一度に全量を作れない場合は、少ないkg数を入力して<strong>何日にも分割して計画を登録</strong>することが可能です（残数は自動計算されます）。</p>
                  </Step>
                  <Step n={3} title="自動発行されたLot番号と賞味期限を確認し、保存する">
                    <p>入力した日付と製品情報を元に、システムがルールに則って正確な Lot番号 と 賞味期限 を発行します。※任意の番号に手書き修正することも可能です。</p>
                  </Step>

                  <SectionHead icon={Factory}>2. 製造の実行と実績入力（自動在庫コントロール）</SectionHead>
                  <Step n={1} title="製造開始操作（原材料の自動引き落とし）">
                    <p>製造当日に該当計画の「製造を開始する」ボタンを押します。</p>
                    <NoteBox type="caution">
                      この操作が行われると、登録されているBOM（レシピ）に基づき、<strong>必要な小麦粉や缶などの原材料・資材在庫が即時にマイナス（引き落とし）処理</strong>されます。
                    </NoteBox>
                  </Step>
                  <Step n={2} title="製造完了・実績数入力（製品在庫の加算とサンプル除外）">
                    <p>製造作業がすべて完了したら、「完了実績を入力」ボタンを押し、実際に包装・仕上がったケース（c/s）数およびパック（p）数を入力します。</p>
                    <NoteBox type="info">
                      <p className="font-bold mb-1">キープサンプルの自動引当ルール</p>
                      実績確定時、システムは品質検査用に保管する「キープサンプル」を自動的に計算して引き抜きます。
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-700">
                        <li><strong>MA製品 / FD製品:</strong> 実績数から自動で <strong>5個（pieces）</strong> を除外保管。</li>
                        <li><strong>上記以外の通常製品:</strong> 実績数から自動で <strong>10個（pieces）</strong> を除外保管。</li>
                      </ul>
                      サンプル差し引き後の製品数が、最終的な製品倉庫の利用可能在庫（`product_stocks`）に加算されます。
                    </NoteBox>
                  </Step>

                  <Accordion title="解説: 計画の削除と安全な自動復元（ロールバック）機構">
                    <div className="space-y-2">
                      <p className="font-bold text-slate-800">■ 万が一のミスを救済する「ロールバック」機能</p>
                      <p>操作を間違えて「製造開始」を押してしまった、あるいは途中で計画が中止になった場合、該当の計画を削除すると、システムが現在のステータスを自動検知して以下のように安全に巻き戻しを行います。</p>
                      <ul className="list-disc pl-5 text-slate-700 space-y-1">
                        <li><strong>「製造中」で削除した場合:</strong> すでに引き落とされたBOM原料・資材在庫が、元あった数量へと自動で復元されます。</li>
                        <li><strong>「完了済」で削除した場合:</strong> 加算された製品在庫が消去されると同時に、自動キープサンプル引当データも破棄され、消費されたBOM原料在庫が元の数に復元されます。</li>
                      </ul>
                      <p className="text-xs text-red-600 font-bold">※手動で原料在庫テーブルを直接編集して修正する必要はありません。必ず計画の「削除ボタン」によるロールバックを行ってください。</p>
                    </div>
                  </Accordion>
                </section>

                <div className="page-break" />

                {/* ── 在庫予測 ── */}
                <section>
                  <ChapterTitle id="inventory" num="第5章" title="在庫予測カレンダー・棚卸" bread={["操作マニュアル", "第5章　在庫予測・棚卸"]} />

                  <SectionHead icon={Calendar}>MRP（資材所要量計画）在庫予測カレンダー</SectionHead>
                  <p className="text-slate-700 mb-4">今日から30日先までの原料・資材の在庫推移を自動シミュレーションする機能です。「在庫予測」タブを開いて確認します。</p>

                  <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4 mb-8">
                    <div>
                      <div className="font-bold text-blue-800 mb-1">予測の計算ルール</div>
                      <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700">翌日在庫 ＝ 前日在庫 ＋ 入荷予定（発注済） － 製造計画のBOM消費量</code>
                    </div>
                    <div>
                      <div className="font-bold text-blue-800 mb-1">アラート機能（赤色表示）</div>
                      <p className="text-sm text-slate-600">在庫がマイナス（欠品）になる日は背景が赤く染まります。また、安全在庫を下回る日はオレンジ色で発注検討のサインが出ます。</p>
                    </div>
                    <div>
                      <div className="font-bold text-blue-800 mb-1">表示フィルター</div>
                      <p className="text-sm text-slate-600">カレンダー右上のボタンで、「すべて / 原材料のみ / 資材のみ」をワンタッチで切り替えて表示をスッキリさせることができます。</p>
                    </div>
                  </div>

                  <SectionHead icon={Edit}>一括棚卸（実数調整）</SectionHead>
                  <Step n={1} title="「一括入力モード」をオンにする">
                    <p>スマホやタブレットで画面を開き、ボタンを押すと全項目が入力枠に変わります。</p>
                  </Step>
                  <Step n={2} title="実際の数を入力して一括保存">
                    <p>実際の在庫を数えながら入力します。変更された項目は黄色くハイライトされます。「一括保存」を押すと、すべての差異が調整履歴として記録されます。</p>
                  </Step>
                </section>

                <div className="page-break" />

                {/* ── 出荷管理 ── */}
                <section>
                  <ChapterTitle id="shipment" num="第6章" title="出荷管理（手動引き当て）" bread={["操作マニュアル", "第6章　出荷管理"]} />
                  <Step n={1} title="出荷対象の受注を選ぶ">
                    <p>左側リストから出荷する注文書を選びます。</p>
                  </Step>
                  <Step n={2} title="引き当てるLotを指定する">
                    <p>右側に「出荷可能なLot」が<strong>古い順</strong>で表示されます。顧客の賞味期限要求を満たすLotを選び、出荷数量を手入力します。</p>
                  </Step>
                  <Step n={3} title="出荷を確定する">
                    <p>「一括で出荷を確定」ボタンを押すと、選んだLotの製品在庫が減算され、出荷管理票に出力可能になります。</p>
                  </Step>
                </section>

                {/* ── カレンダー ── */}
                <section>
                  <ChapterTitle id="calendar" num="第7章" title="スケジュール表と備考の活用" bread={["操作マニュアル", "第7章　スケジュール表"]} />
                  <p className="text-slate-700 mb-4">製造管理や入荷管理の「カレンダー表示」は、工場全体のスケジュールボードとして機能します。</p>

                  <Step n={1} title="月別の備考・連絡事項を入力する">
                    <p>カレンダーの下部に、その月の「備考・連絡事項」を書き込めるテキストエリアがあります。特記事項や共有事項のメモに活用してください。（入力して別の場所をクリックすると自動保存されます）</p>
                  </Step>
                  <Step n={2} title="社内イベントを登録する">
                    <p>日付の「＋」ボタンから、清掃日や会議などの社内イベントを登録し、カレンダー上に表示できます。</p>
                  </Step>
                  <Step n={3} title="A4サイズで白黒印刷する">
                    <p>右上の「印刷」ボタンを押すと、メニュー等が消え、A4横サイズに綺麗に収まるモノクロレイアウトで印刷できます。現場の掲示板用に出力してください。</p>
                  </Step>
                </section>

                <div className="page-break" />

                {/* ── HACCP・衛生管理 ── */}
                <section>
                  <ChapterTitle id="haccp" num="第8章" title="HACCP・衛生管理記録" bread={["操作マニュアル", "第8章　HACCP・衛生管理記録"]} />
                  <p className="text-slate-700 mb-6">各種チェック表や関連資料をスマホやタブレットから簡単に入力し、専用のPDFフォーマットとして一括出力できる機能群です。</p>

                  <SectionHead icon={ShieldCheck}>各帳票の入力方法</SectionHead>

                  <Accordion title="1. 日次・月次チェック表（清掃・施設・廃棄物など）">
                    <div className="space-y-3">
                      <p><strong>対象:</strong> YO-22(清掃・点検)、YO-26(施設設備)、YO-27(製造施設)、YO-21(エリア清掃)、YO-41(廃棄物)</p>
                      <ul className="list-decimal pl-5 space-y-2">
                        <li>ポータルから目的の帳票パネルをクリックします。</li>
                        <li>「対象日付」のカレンダーから、入力したい日を選択します（デフォルトは今日）。</li>
                        <li>各項目の右側にある<strong>トグルボタンをタップ</strong>して、「良(〇)」「不良(×)」を切り替えます。<br /><span className="text-xs text-slate-500">※スマホでの操作に最適化された大きなボタンになっています。</span></li>
                        <li>画面下部の「この日の記録を保存」ボタンを押して完了です。</li>
                      </ul>
                      <NoteBox type="supplement">
                        <strong>PDF出力:</strong> 「月間一覧」タブを開くと、その月に入力されたデータがマトリックス（表）形式で表示されます。右上の「PDF帳票を出力」ボタンを押すと、指定された原本とそっくりのフォーマットで印刷できます。
                      </NoteBox>
                    </div>
                  </Accordion>

                  <Accordion title="2. 電子はかり 日常点検データシート (YO-15)">
                    <div className="space-y-3">
                      <p>水平やゼロ点の確認（〇/×）に加えて、<strong>重量の数値入力</strong>と誤差の自動計算を行います。</p>
                      <ul className="list-decimal pl-5 space-y-2">
                        <li>日付と点検時間を選択します。</li>
                        <li>基本状態（A, B, C）をボタンでチェックします。</li>
                        <li>Dの重量表示確認にて、1〜5の測定箇所ごとに、100gの標準分銅を載せた際の<strong>「重量表示(g)」に数値を入力</strong>します。</li>
                        <li>数値を入力すると、自動的に100gからの<strong>「差(g)」が計算</strong>されます。</li>
                      </ul>
                      <NoteBox type="caution">
                        計算された「差(g)」が <strong>±0.2gの誤差を超えた場合、入力枠が赤く警告表示</strong>されます。すぐに上長に報告し、はかりの校正を行ってください。
                      </NoteBox>
                    </div>
                  </Accordion>

                  <Accordion title="3. 官能検査実施表 (YO-30)">
                    <div className="space-y-3">
                      <p>製造された製品ロットに対する、視覚・嗅覚等の官能検査結果を記録します。</p>
                      <ul className="list-decimal pl-5 space-y-2">
                        <li>製造日を選択すると、その日に製造された「Lot番号」がプルダウンで選べるようになります。</li>
                        <li>小箱・アルミ・パンの状態ごとに、該当する結果のボタンをタップします（複数選択可）。</li>
                        <li><strong>「問題ない」「規格内」を選択すると青色</strong>に、<strong>それ以外の異常を選択すると赤色</strong>にボタンが変化します。</li>
                        <li>「その他」を選択した場合は、表示されるテキストボックスに詳細を入力してください。</li>
                      </ul>
                    </div>
                  </Accordion>

                  <Accordion title="4. 製品説明書 と 製造工程フロー図 の作成">
                    <div className="space-y-3">
                      <p>HACCPの前提となる基本情報やフローチャートをシステム上で作成し、美しいPDFとして出力します。</p>
                      <p className="font-bold mt-2">■ 製品説明書 (HACCP-P1)</p>
                      <ul className="list-disc pl-5 space-y-1 mb-2 text-sm text-slate-700">
                        <li>リストから対象製品の「作成（編集）」ボタンを押します。</li>
                        <li>原材料名やアレルギー物質、賞味期限などをテキストで入力して保存します。</li>
                      </ul>

                      <p className="font-bold mt-4">■ 製造工程フロー図 (HACCP-F1)</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                        <li>まず「連携用 原材料・資材リスト」に原料を登録し、それが「どの工程で投入されるか（合流先）」をプルダウンで指定します。</li>
                        <li>「工程（ステップ）の設定」で、計量・ミキシング等の工程を順に追加していきます。<br /><span className="text-xs text-red-600">※ CCP（重要管理点）に該当する工程はチェックを入れてCCP番号を入力してください。</span></li>
                        <li>上下の矢印ボタンで工程の順番を入れ替えることができます。</li>
                      </ul>
                      <NoteBox type="info">
                        <strong>自動結線システム:</strong> フロー図をPDF出力する際、設定した「原料の合流先」のデータに基づき、システムが自動的に線のルートを計算し、美しいフローチャートとしてA4用紙に描画します。図形作成ソフトを使う必要はありません。
                      </NoteBox>
                    </div>
                  </Accordion>

                  <SectionHead icon={AlertCircle}>監査ログ（改竄防止機能）について</SectionHead>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm mt-2">
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                      HACCPの信頼性を担保するため、システムに入力された衛生管理記録は<strong>「いつ・誰が・どのデータを・どのように書き換えたか」</strong>がデータベースの裏側で強制的に追跡（トレース）されています。
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-red-800 font-medium">
                      <li>過去のデータをこっそり修正したり削除したりした場合でも、全て履歴として残ります（変更前と変更後の差分が色付きで表示されます）。</li>
                      <li>この監査ログは、システム利用者からは絶対に削除・改竄できない仕組みになっています。</li>
                      <li>保健所等の監査時にデータの信頼性を証明する強力なエビデンスとなります。</li>
                    </ul>
                  </div>
                </section>

                <div className="page-break" />

                {/* ── フジスチーミー自動解析 ── */}
                <section>
                  <ChapterTitle id="fuji-steamy" num="第9章" title="フジスチーミー自動解析" bread={["操作マニュアル", "第9章　フジスチーミー解析"]} />
                  <p className="text-slate-700 mb-6">加熱装置（フジスチーミー）から出力されるCSVログを読み込み、加熱記録表（YO-5）を自動生成する機能です。</p>

                  <Step n={1} title="CSVファイルをドラッグ＆ドロップ">
                    <p>USBメモリ等から取り出した複数のCSVファイルを、画面の破線エリアに投入します。</p>
                  </Step>
                  <Step n={2} title="解析結果の確認と補完">
                    <p>システムが自動的に「80℃到達時間」や「最高温度」を抽出します。必要に応じて「製造種類」をプルダウンから選び、「数量」を入力します（数量を入れると廃棄数が自動計算されます）。</p>
                  </Step>
                  <Step n={3} title="DB保存とPDF出力">
                    <p>「すべてDBに保存」を押すとデータが確定します。一覧タブから月を指定して印刷ボタンを押すと、A4横の綺麗な加熱調理記録が出力されます。</p>
                  </Step>
                </section>

                <div className="page-break" />

                {/* ── トレーサビリティ ── */}
                <section>
                  <ChapterTitle id="traceability" num="第10章" title="トレーサビリティ追跡機能" bread={["操作マニュアル", "第10章　トレーサビリティ"]} />
                  <p className="text-slate-700 mb-6">万が一のクレームや監査時に、システム内の全データを横断して履歴を一瞬で検索する機能です。</p>

                  <Step n={1} title="Lot番号を入力して検索">
                    <p>メニューの「トレース (追跡)」を開き、調べたい製品のLot番号（例: スB26SB）を入力して検索ボタンを押します。</p>
                  </Step>
                  <Step n={2} title="全履歴を1画面で確認">
                    <p>以下の情報が瞬時に表示され、品質保証のエビデンスとして活用できます。</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-slate-600 font-medium">
                      <li>いつ・どこに出荷されたか（出荷先履歴）</li>
                      <li>どの原材料を使って製造されたか（BOM）</li>
                      <li>そのLotの官能検査（YO-30）の結果はどうだったか</li>
                      <li>製造時の加熱温度（フジスチーミー記録）は適切だったか</li>
                    </ul>
                  </Step>
                  <NoteBox type="supplement">
                    <strong>QRラベル連携：</strong> 「キープサンプル管理」画面から、Lot番号が埋め込まれたQRコード付きの専用ラベル（段ボール貼付用）を印刷できます。このQRをスマホで読み取ると、すぐに検索が行えます。
                  </NoteBox>
                </section>

                <div className="page-break" />

                {/* ── FAQ ── */}
                <section>
                  <ChapterTitle id="faq" num="第11章" title="よくある質問（FAQ）" bread={["操作マニュアル", "第11章　FAQ"]} />

                  <div className="space-y-4">
                    <Accordion title="Q. 製造計画を間違えて「開始」してしまいました。元に戻せますか？">
                      はい、戻せます。<br />
                      製造管理の画面で該当する計画の「確認」を開き、左下の「キャンセル（削除）」ボタンを押してください。システムが自動的に、引き落とされた原料・資材在庫を元の数に戻して計画を白紙にします。
                    </Accordion>

                    <Accordion title="Q. 受注内容を変更したいのですが、ロックされていて編集できません。">
                      すでにその受注に対して「製造計画」が組まれていると、整合性を保つために編集がロックされます。<br />
                      製造管理の画面から、対象の受注に紐付いている製造計画を一度削除してから、受注内容を変更してください。
                    </Accordion>

                    <Accordion title="Q. 発注した資材が、発注数より少なく届きました（一部未納）。">
                      入荷管理の「確認」画面で、数量の項目を<strong>「実際に届いた数」</strong>に書き換えてから「入荷済にする」を押してください。<br />
                      入力した数だけが在庫に加算され、残りの未納分は引き続き「発注済」ステータスとして一覧に残りますので、後日追加で届いた際に再度受け入れが可能です。
                    </Accordion>

                    <Accordion title="Q. キープサンプルのラベルを印刷したいのに「印刷するサンプルが選択されていません」と出ます。">
                      キープサンプル管理の「記録一覧」タブで、左端のチェックボックス（四角い枠）をクリックして、印刷したい対象のサンプルにチェック（青色）を入れてください。<br />
                      その後、右上に出現する「選択した〇件のラベルを作成」ボタンを押すと印刷画面に進めます。
                    </Accordion>
                  </div>
                </section>

              </main>
            </div>
          )}

          {/* ══════════════════════════════════════
              技術仕様
          ══════════════════════════════════════ */}
          {tab === "tech" && (
            <div className="flex flex-col md:flex-row relative">
              <aside className="hidden md:block w-72 shrink-0 border-r border-slate-100 bg-slate-50/50 print-hidden">
                <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4 custom-scrollbar">
                  <div className="text-xs font-black text-slate-444 tracking-widest uppercase mb-4 ml-2">Tech Specs</div>
                  <nav className="space-y-1">
                    {TECH_TOC.map((row) => (
                      <TocRow key={row.num} label={`${row.num}. ${row.label}`} onClick={() => scrollToTech(row.num)} />
                    ))}
                  </nav>
                </div>
              </aside>

              <main className="flex-1 px-5 md:px-12 py-8 md:py-10 space-y-16 min-w-0">

                <section id="tech-01" className="scroll-mt-24">
                  <SectionHead icon={Settings}>01. システム・アーキテクチャ</SectionHead>
                  <div className="bg-slate-900 text-slate-300 rounded-2xl p-6 md:p-8 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: "Frontend", items: ["Next.js (App Router)", "React + TypeScript", "Tailwind CSS", "shadcn/ui", "Lucide Icons"] },
                        { label: "Backend / Database", items: ["Supabase (BaaS)", "PostgreSQL", "Supabase Auth", "Row Level Security (RLS)"] },
                        { label: "Key Features", items: ["Responsive UI", "Server Actions", "MRP Inventory Forecast", "Print-optimized CSS"] },
                      ].map((col) => (
                        <div key={col.label}>
                          <div className="font-bold text-blue-400 mb-3 text-xs tracking-widest uppercase border-b border-slate-700 pb-2">{col.label}</div>
                          <ul className="space-y-2">
                            {col.items.map((it) => <li key={it} className="text-sm font-medium">{it}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section id="tech-02" className="scroll-mt-24">
                  <SectionHead icon={Settings}>02. Lot 番号の自動生成ルール</SectionHead>
                  <p className="text-sm text-slate-600 mb-4">
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 text-xs font-mono">src/lib/lot-generator.ts</code> にて制御。入力日付と製品IDから一意の文字列を生成します。
                  </p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {[
                      { type: "通常品（例: SB）", rule: "カタカナ(日付) + 月(アルファベット) + 年2桁 + 製品ID", note: "変換表: 日付 (タ行抜き ア〜ヤ)、月 (A〜L)", example: "2026年2月13日", result: "スB26SB" },
                      { type: "MA / FD 複合製品", rule: "yy(年2桁) + MA/FD + 連番2桁", note: "", example: "2026年製造", result: "26MA01" },
                      { type: "YC50 / YO50", rule: "dd(日付2桁) + 月(アルファベット) + 年2桁 + 製品ID", note: "", example: "2026年2月13日", result: "13B26YC50" },
                    ].map((row) => (
                      <div key={row.type} className="p-5 bg-white">
                        <div className="font-black text-slate-800 mb-2">{row.type}</div>
                        <div className="text-slate-600 text-sm mb-1">ルール: <code className="text-blue-700 bg-blue-50 px-1 rounded text-xs">{row.rule}</code></div>
                        {row.note && <div className="text-slate-500 text-xs mb-3">{row.note}</div>}
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-mono text-sm">
                          <span className="text-slate-500">{row.example}</span>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                          <strong className="text-blue-700 text-base">{row.result}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section id="tech-03" className="scroll-mt-24">
                  <SectionHead icon={Settings}>03. ケース・ピース混在管理</SectionHead>
                  <p className="text-sm text-slate-600 mb-4">繰り下がり計算のバグを防ぐため、DBの保存形式と画面の表示形式を分離しています。</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/50">
                      <div className="font-black text-blue-800 mb-3 text-xs tracking-widest uppercase flex items-center gap-2"><DatabaseIcon /> DB（Supabase）</div>
                      <p className="text-slate-700 text-sm mb-3">製品在庫テーブルの <code className="bg-white px-1 border rounded">total_pieces</code> カラムに<strong>総個数（ピース数）</strong>で保存します。</p>
                      <div className="bg-white border rounded-lg px-3 py-2 font-mono text-xs shadow-sm">保存例: 10 c/s + 5 p <ArrowRight className="inline w-3 h-3 mx-1" /> <strong>250個</strong></div>
                    </div>
                    <div className="border border-emerald-200 rounded-xl p-5 bg-emerald-50/50">
                      <div className="font-black text-emerald-800 mb-3 text-xs tracking-widest uppercase flex items-center gap-2"><MonitorIcon /> Frontend</div>
                      <p className="text-slate-700 text-sm mb-3">画面表示時に以下のロジックで商と余りを計算し、c/s と p に変換して表示します。</p>
                      <div className="font-mono text-[11px] space-y-1.5 bg-white border rounded-lg px-3 py-2 shadow-sm text-slate-700">
                        <div><span className="text-emerald-700 font-bold">cs</span> = Math.floor( total / unit_per_cs )</div>
                        <div><span className="text-emerald-700 font-bold">p</span>  = Math.floor( (total % unit_per_cs) / 2 )</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section id="tech-04" className="scroll-mt-24">
                  <SectionHead icon={ShieldCheck}>04. 監査ログのトリガー機構</SectionHead>
                  <p className="text-sm text-slate-600 mb-4">
                    HACCP記録の改竄を防ぐため、フロントエンドを介さずにデータベース(PostgreSQL)のレイヤーで直接変更を監視・記録しています。
                  </p>
                  <div className="bg-slate-900 rounded-xl p-5 overflow-x-auto shadow-inner">
                    <pre className="text-green-400 font-mono text-[11px] leading-relaxed">
                      <code>
                        {`CREATE OR REPLACE FUNCTION log_haccp_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- 変更前(OLD)と変更後(NEW)をJSON形式で記録
    INSERT INTO haccp_audit_logs (
        table_name, record_id, action, old_data, new_data
    ) VALUES (
        TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`}
                      </code>
                    </pre>
                  </div>
                </section>

                <section id="tech-05" className="scroll-mt-24">
                  <SectionHead icon={Settings}>05. データベース・スキーマ定義</SectionHead>
                  <p className="text-sm text-slate-600 mb-4">
                    データ整合性を担保するため、外部キー制約（`REFERENCES`）およびオンデリート・カスケード / レストリクトを適切に設定しています。
                  </p>
                  <div className="bg-slate-900 rounded-xl p-5 overflow-x-auto shadow-inner">
                    <pre className="text-blue-400 font-mono text-[11px] leading-relaxed">
                      <code>
                        {`-- 製品マスタ
CREATE TABLE m_products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    unit_per_cs INT NOT NULL DEFAULT 24, -- 1ケースあたりのピース数
    safety_stock INT NOT NULL DEFAULT 0
);

-- 製品在庫状況テーブル (Lot単位管理)
CREATE TABLE product_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(50) REFERENCES m_products(id),
    lot_number VARCHAR(100) NOT NULL UNIQUE,
    expiration_date DATE NOT NULL,
    total_pieces INT NOT NULL DEFAULT 0 CHECK (total_pieces >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 原材料・資材在庫テーブル
CREATE TABLE item_stocks (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    stock_qty NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(20) NOT NULL,
    safety_stock NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);`}
                      </code>
                    </pre>
                  </div>
                </section>

              </main>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// 簡易アイコンコンポーネント群
function DatabaseIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" /></svg>;
}
function MonitorIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>;
}