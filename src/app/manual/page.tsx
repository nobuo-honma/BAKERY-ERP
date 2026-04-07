"use client";

import { useState } from "react";
import {
  BookOpen, Printer, Menu as MenuIcon, Settings, Info,
  ChevronDown, AlertCircle, CheckCircle2, FileText,
  AlertTriangle, HelpCircle, ChevronRight, Download, Truck, Calendar, Factory, Package, ArrowRight
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
  { id: "swimlane", title: "第1章　業務フロー（全体図）" },
  { id: "master", title: "第2章　マスタ管理" },
  { id: "order", title: "第3章　受注管理" },
  { id: "arrival", title: "第4章　入荷管理" },
  { id: "production", title: "第5章　製造管理" },
  { id: "inventory", title: "第6章　在庫予測・棚卸" },
  { id: "shipment", title: "第7章　出荷管理" },
  { id: "calendar", title: "第8章　スケジュール表・備考" },
  { id: "haccp", title: "第9章　HACCP・資料管理" },
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
  [1, "製造完了・実績入力", "完成したケース/パック数を入力"],
  [3, "キープサンプル自動引当", "5個 または 10個を自動確保"],
  [3, "製品在庫 ＋加算", "残数が product_stocks へ"],
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
          <div className="flex flex-col items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md print:bg-slate-800 print:text-white">
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
      {!Icon && <span className="w-1.5 h-5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full inline-block shrink-0 print:bg-slate-800" />}
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
    <div className="bg-slate-50/50 min-h-screen pb-12 print:bg-white print:p-0">
      <style>{`@media print { @page { size: A4 portrait; margin: 15mm; } .print-hidden { display: none !important; } .page-break { page-break-before: always; } .avoid-break { page-break-inside: avoid; } body { background-color: white !important; } }`}</style>

      <div className="max-w-7xl mx-auto md:px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
          
          {/* ── 表紙ヘッダー ── */}
          <header className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 md:px-10 py-8 print:bg-white print:text-black print:border-b-2 print:border-black">
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
                  <div className="text-xs font-black text-slate-400 tracking-widest uppercase mb-4 ml-2">Table of Contents</div>
                  <nav className="space-y-1">
                    {USER_TOC.map((item) => (
                      <TocRow key={item.id} label={item.title} onClick={() => scrollTo(item.id)} />
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
                        className="block w-full text-left py-3 text-sm font-bold text-slate-600 hover:text-blue-600 border-b border-slate-50 last:border-0">
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
                      <div className="bg-white p-3 rounded border shadow-sm">入荷済ボタン <ArrowRight className="inline w-3 h-3 mx-1 text-slate-400"/> <span className="text-blue-600 font-bold">原料在庫 ＋</span></div>
                      <div className="bg-white p-3 rounded border shadow-sm">製造開始ボタン <ArrowRight className="inline w-3 h-3 mx-1 text-slate-400"/> <span className="text-red-600 font-bold">原料在庫 －</span></div>
                      <div className="bg-white p-3 rounded border shadow-sm">製造完了ボタン <ArrowRight className="inline w-3 h-3 mx-1 text-slate-400"/> <span className="text-blue-600 font-bold">製品在庫 ＋</span></div>
                      <div className="bg-white p-3 rounded border shadow-sm">出荷確定ボタン <ArrowRight className="inline w-3 h-3 mx-1 text-slate-400"/> <span className="text-red-600 font-bold">製品在庫 －</span></div>
                    </div>
                  </NoteBox>
                  <NoteBox type="supplement">
                    <strong>権限について：</strong>ヘッダー右上のスイッチで「👑 管理者」と「👀 閲覧者」を切り替えられます。情報の登録・編集や在庫を動かす操作は管理者モードでのみ可能です。現場での確認作業時は閲覧者モードを推奨します。
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
                      <div key={item.t} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="font-bold text-blue-800 mb-1">{item.t}</div>
                        <div className="text-sm text-slate-600 leading-relaxed">{item.d}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── 業務フロー ── */}
                <section>
                  <ChapterTitle id="swimlane" num="第1章" title="業務フロー（全体図）" bread={["操作マニュアル", "第1章　業務フロー"]} />
                  <p className="text-slate-600 mb-6">担当者ごとの作業レーンと、システムが裏側で自動処理するステップ（右端）を時系列で表しています。</p>
                  <SwimlaneChart />
                </section>

                <div className="page-break" />

                {/* ── 受注管理 ── */}
                <section>
                  <ChapterTitle id="order" num="第3章" title="受注管理（注文の登録と計算）" bread={["操作マニュアル", "第3章　受注管理"]} />
                  
                  <SectionHead icon={ShoppingCart}>受注データの新規登録</SectionHead>
                  <Step n={1} title="「新規受注登録」ボタンを押します">
                    <p>管理者の場合のみボタンが表示されます。</p>
                  </Step>
                  <Step n={2} title="1枚の注文書（グループ）として基本情報を入力します">
                    <FieldTable rows={[
                      ["出荷予定日", "工場から製品を出す日", "必須"],
                      ["納品先への着予定日", "お客様の希望納期", "必須"],
                      ["出荷先名", "リストから検索して選択", "必須"],
                      ["発注番号", "お客様側の注番・FAX番号など", "任意"],
                    ]} />
                  </Step>
                  <Step n={3} title="製品と数量を入力し、BOMシミュレーションを確認します">
                    <p>「製品を追加する」ボタンで、複数の味を1つの注文書にまとめて登録できます。</p>
                    <NoteBox type="caution">
                      数値を入力すると右側に「必要資材のシミュレーション」がリアルタイムで表示されます。現在庫と比較して<strong>不足がある場合は赤色で警告</strong>が出ます。受注登録は可能ですが、必ず入荷管理で手配してください。
                    </NoteBox>
                  </Step>
                  <Step n={4} title="「受注を確定する」ボタンで保存します">
                    <p>保存後、リストに注文書単位のカードが追加されます。</p>
                  </Step>

                  <SectionHead icon={Edit}>登録後の編集・キャンセル</SectionHead>
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                    <div>
                      <span className="font-bold text-slate-800 bg-white px-2 py-1 rounded shadow-sm border mr-2">編集</span>
                      <span className="text-sm text-slate-600">受注カードの右上にある鉛筆アイコン（✏）から内容を修正できます。</span>
                    </div>
                    <div>
                      <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded shadow-sm border border-red-200 mr-2">キャンセル</span>
                      <span className="text-sm text-slate-600">編集画面の左下にあるボタンから、注文書全体を削除（キャンセル）できます。※製造計画が作成済みの場合は削除できません。</span>
                    </div>
                  </div>
                </section>

                <div className="page-break" />

                {/* ── 入荷管理 ── */}
                <section>
                  <ChapterTitle id="arrival" num="第4章" title="入荷管理（資材の発注と受入）" bread={["操作マニュアル", "第4章　入荷管理"]} />

                  <SectionHead icon={FileText}>資材の発注とPDF作成</SectionHead>
                  <Step n={1} title="発注データの登録">
                    <p>左側のフォームで対象品目、発注日、入荷予定日、数量を登録します。ステータスは「発注済」となり、この時点では在庫は増えません。</p>
                  </Step>
                  <Step n={2} title="発注書 (PDF) の作成">
                    <p>画面右上の「発注書(PDF)作成」ボタンを押すと、取引先別の発注書レイアウトに切り替わります。そのまま印刷してFAX等に利用できます。</p>
                    <p className="text-xs text-slate-500 mt-1">※大槻食材への発注は専用ボタンから別サイトを開いて行います。</p>
                  </Step>

                  <SectionHead icon={Truck}>入荷受け入れ（在庫加算）</SectionHead>
                  <Step n={1} title="届いた資材を確認する">
                    <p>リストまたはカレンダーから、該当する入荷予定の「確認」ボタンを押します。</p>
                  </Step>
                  <Step n={2} title="「入荷済にする」ボタンを押して確定">
                    <p>数量に間違いがなければ緑色のボタンを押します。</p>
                    <NoteBox type="check">このボタンを押した瞬間に <strong>item_stocks（原料在庫）に実数が加算</strong>されます。</NoteBox>
                  </Step>
                </section>

                <div className="page-break" />

                {/* ── 製造管理 ── */}
                <section>
                  <ChapterTitle id="production" num="第5章" title="製造管理（計画とLot発行）" bread={["操作マニュアル", "第5章　製造管理"]} />
                  <p className="text-slate-600 mb-6">システムの心臓部です。製造計画を立て、実際の製造に合わせてステータスを進めることで在庫が自動連動します。</p>

                  <SectionHead icon={Calendar}>1. 製造計画の登録（分割・見込み生産）</SectionHead>
                  <Step n={1} title="製造する対象を選ぶ">
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                      <li><strong>受注引当：</strong> 左側の「未計画の残数がある受注」リストから選びます。</li>
                      <li><strong>見込み生産：</strong> 右上の「在庫品として製造」ボタンを押し、対象製品をプルダウンで選びます。</li>
                    </ul>
                  </Step>
                  <Step n={2} title="製造予定日と製造量(kg)を入力する">
                    <p>一度に全量を作れない場合は、少ないkg数を入力して<strong>何日にも分割して計画を登録</strong>することができます（残数は自動計算されます）。</p>
                  </Step>
                  <Step n={3} title="自動発行されたLot番号と賞味期限を確認し、保存する">
                    <p>入力した日付と製品情報を元に、システムがルールに則って正確な Lot番号 と 賞味期限 を発行します。</p>
                  </Step>

                  <SectionHead icon={Factory}>2. 製造の実行と実績入力（在庫連動）</SectionHead>
                  <Step n={1} title="製造を開始する（原料の減算）">
                    <p>予定表（カレンダー）等から計画を開き、「製造を開始する」を押します。</p>
                    <NoteBox type="caution">この操作により、BOMレシピに基づいて<strong>必要な原料・資材が在庫から即時引き落とし</strong>されます。</NoteBox>
                  </Step>
                  <Step n={2} title="製造完了・実績数を入力する（製品の加算）">
                    <p>パンが焼き上がり包装が終わったら、「製造を完了し、実績数を入力」ボタンを押します。完成したケース数・パック数を入力して確定します。</p>
                    <NoteBox type="info">
                      <p className="font-bold mb-1">キープサンプルの自動引当機能</p>
                      <p>入力した完成数から、<strong>システムが自動的に品質検査用のキープサンプル（MA/FD製品は5個、それ以外は10個）を引き抜き</strong>ます。<br/>残りの数量が、製品在庫として倉庫に加算されます。</p>
                    </NoteBox>
                  </Step>
                  
                  <SectionHead icon={ArrowRight}>計画の取り消し（ロールバック）について</SectionHead>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                    製造中、または完了済みの計画を「キャンセル（削除）」した場合、システムは自動的に連動した在庫を元に戻します（原料の復元、または製品在庫の取り消し）。手動で在庫数を直す必要はありません。
                  </p>
                </section>

                <div className="page-break" />

                {/* ── 在庫予測 ── */}
                <section>
                  <ChapterTitle id="inventory" num="第6章" title="在庫予測カレンダー・棚卸" bread={["操作マニュアル", "第6章　在庫予測・棚卸"]} />

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

                {/* ── 出荷管理 ── */}
                <section>
                  <ChapterTitle id="shipment" num="第7章" title="出荷管理（手動引き当て）" bread={["操作マニュアル", "第7章　出荷管理"]} />
                  <Step n={1} title="出荷対象の受注を選ぶ">
                    <p>左側リストから出荷する注文書を選びます。</p>
                  </Step>
                  <Step n={2} title="引き当てるLotを指定する">
                    <p>右側に「出荷可能なLot」が<strong>古い順</strong>で表示されます。顧客の賞味期限要求を満たすLotを選び、出荷数量を手入力します。</p>
                  </Step>
                  <Step n={3} title="出荷を確定する">
                    <p>「出荷を確定」ボタンを押すと、選んだLotの製品在庫が減算されます。</p>
                  </Step>
                </section>
                
                {/* ── カレンダー ── */}
                <section>
                  <ChapterTitle id="calendar" num="第8章" title="スケジュール表と備考の活用" bread={["操作マニュアル", "第8章　スケジュール表"]} />
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
                  <div className="text-xs font-black text-slate-400 tracking-widest uppercase mb-4 ml-2">Tech Specs</div>
                  <nav className="space-y-1">
                    {TECH_TOC.map((row) => (
                      <TocRow key={row.num} label={`${row.num}. ${row.label}`} onClick={() => scrollToTech(`tech-${row.num}`)} />
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
                      <div className="bg-white border rounded-lg px-3 py-2 font-mono text-xs shadow-sm">保存例: 10 c/s + 5 p <ArrowRight className="inline w-3 h-3 mx-1"/> <strong>250個</strong></div>
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
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>;
}
function MonitorIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>;
}
