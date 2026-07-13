"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Loader2, ArrowRight, FileSignature, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type AuditLog = {
    id: string;
    table_name: string;
    record_id: string;
    check_date: string;
    action: string;
    old_data: RecordData | null;
    new_data: RecordData | null;
    changed_at: string;
};

type RecordData = Record<string, unknown> & {
    results?: Record<string, unknown>;
    notes?: string;
    improvement_done?: string;
    improvement_planned?: string;
    checker_name?: string;
    sub_checker_name?: string;
    product_name?: string;
    lot_code?: string;
    test_date?: string;
};

type DiffEntry = {
    path: string;
    oldVal: unknown;
    newVal: unknown;
};

// テーブル名を日本語に変換
const TABLE_NAMES: Record<string, string> = {
    cleaning_checks: "清掃・点検表 (YO-22)",
    facility_checks: "施設設備チェック表 (YO-26)",
    manufacturing_checks: "製造施設チェック表 (YO-27)",
    area_cleaning_checks: "清掃チェック表 (YO-21)",
    waste_checks: "廃棄物チェック表 (YO-41)",
    material_receiving_checks: "原材料受入台帳 (YO-14)",
    sensory_tests: "官能検査実施表 (YO-30)",
    ecopack_checks: "エコパック製品チェック表 (YO-4)"
};

// ============================================================================
// 差分抽出・表示用 ユーティリティ
// ============================================================================

// 値を見やすくフォーマットする
const renderValue = (val: unknown) => {
    if (val === 'ok') return <span className="text-emerald-600 font-bold">〇 (良)</span>;
    if (val === 'ng') return <span className="text-red-600 font-bold">× (不良)</span>;
    if (val === null || val === undefined || val === "") return <span className="text-slate-400 text-[10px]">未入力</span>;
    if (Array.isArray(val)) return <span className="text-slate-800">{val.join(" / ")}</span>;
    if (typeof val === 'object') return <span className="text-slate-600 text-[10px] break-all">{JSON.stringify(val)}</span>;
    return <span className="text-slate-800">{String(val)}</span>;
};

// フィールド名を日本語にマッピング
const FIELD_LABELS: Record<string, string> = {
    checker_name: "担当者",
    sub_checker_name: "副担当",
    notes: "備考・特記事項",
    improvement_done: "改善内容",
    improvement_planned: "改善予定",
    product_name: "製品名",
    lot_code: "Lot番号"
};

// 前後のデータから差分を抽出する
function getDifferences(oldData: RecordData | null, newData: RecordData | null) {
    const diffs: DiffEntry[] = [];

    // 1. 基本フィールドの比較
    const baseKeys = ['checker_name', 'sub_checker_name', 'notes', 'improvement_done', 'improvement_planned', 'product_name', 'lot_code'];
    baseKeys.forEach(key => {
        if ((oldData?.[key] || "") !== (newData?.[key] || "")) {
            diffs.push({ path: FIELD_LABELS[key] || key, oldVal: oldData?.[key], newVal: newData?.[key] });
        }
    });

    // 2. results (チェック項目) の比較
    const res1: Record<string, unknown> = oldData?.results ?? {};
    const res2: Record<string, unknown> = newData?.results ?? {};
    const resKeys = Array.from(new Set([...Object.keys(res1), ...Object.keys(res2)]));

    resKeys.forEach(key => {
        const v1 = res1[key];
        const v2 = res2[key];
        if (JSON.stringify(v1) !== JSON.stringify(v2)) {
            // ネストしている場合 (YO-14など)
            if ((typeof v1 === 'object' && v1 !== null && !Array.isArray(v1)) || (typeof v2 === 'object' && v2 !== null && !Array.isArray(v2))) {
                const nestedV1 = (typeof v1 === 'object' && v1 !== null && !Array.isArray(v1) ? v1 : {}) as Record<string, unknown>;
                const nestedV2 = (typeof v2 === 'object' && v2 !== null && !Array.isArray(v2) ? v2 : {}) as Record<string, unknown>;
                const nestedKeys = Array.from(new Set([...Object.keys(nestedV1), ...Object.keys(nestedV2)]));
                nestedKeys.forEach(nk => {
                    if ((nestedV1[nk] ?? "") !== (nestedV2[nk] ?? "")) {
                        // expiry -> 賞味期限 などの簡単な変換
                        const subLabel = nk === 'expiry' ? '期限' : nk === 'lot' ? 'Lot' : nk === 'qty' ? '数量' : nk === 'appearance' ? '外観' : nk === 'smell' ? '臭い' : nk;
                        diffs.push({ path: `[品目 ${key}] の ${subLabel}`, oldVal: nestedV1[nk], newVal: nestedV2[nk] });
                    }
                });
            } else {
                diffs.push({ path: `項目 [${key}]`, oldVal: v1, newVal: v2 });
            }
        }
    });

    return diffs;
}

// 差分を表示するコンポーネント
function DiffViewer({ action, oldData, newData }: { action: string; oldData: RecordData | null; newData: RecordData | null }) {
    if (action === 'UPDATE') {
        const diffs = getDifferences(oldData, newData);

        if (diffs.length === 0) return <div className="text-slate-400 text-xs italic">実質的な変更はありません</div>;

        return (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {diffs.map((diff, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs bg-white border border-amber-200 p-2 rounded-lg shadow-sm">
                        <Badge variant="outline" className="font-mono text-slate-600 bg-slate-50 border-slate-200 w-fit shrink-0">
                            {diff.path}
                        </Badge>
                        <div className="flex-1 flex items-center gap-2 overflow-hidden">
                            <div className="bg-slate-100 px-2 py-1 rounded line-through opacity-60 min-w-[40px] text-center shrink-0 border border-slate-200">
                                {renderValue(diff.oldVal)}
                            </div>
                            <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                            <div className="bg-amber-50 px-2 py-1 rounded font-bold min-w-[40px] text-center border border-amber-300 text-amber-900 flex-1 truncate">
                                {renderValue(diff.newVal)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // INSERT or DELETE の場合
    const targetData = action === 'INSERT' ? newData : oldData;
    if (!targetData) return null;

    const results: Record<string, unknown> = targetData.results ?? {};
    const keys = Object.keys(results);
    const displayKeys = keys.slice(0, 8); // 多すぎる場合は省略
    const hasMore = keys.length > 8;

    return (
        <div className="flex flex-col gap-2">
            <div className={`text-xs font-bold ${action === 'INSERT' ? 'text-blue-700' : 'text-red-700'}`}>
                {action === 'INSERT' ? '🆕 以下の内容で新規登録されました' : '🗑️ 以下のデータが削除されました'}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {displayKeys.map(k => (
                    <div key={k} className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border ${action === 'INSERT' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 line-through opacity-70 text-red-800'}`}>
                        <span className="font-mono opacity-60">{k}:</span>
                        <span>{renderValue(results[k])}</span>
                    </div>
                ))}
                {hasMore && <span className="text-[10px] text-slate-400 py-1 font-bold">...他 {keys.length - 8} 件の項目</span>}
            </div>
            {(targetData.notes || targetData.improvement_done) && (
                <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 shadow-sm truncate">
                    <span className="font-bold text-slate-400 mr-2">備考/特記:</span>
                    {targetData.notes || targetData.improvement_done}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// メインページ
// ============================================================================

export default function AuditLogsPage() {
    const { canEdit } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('haccp_audit_logs')
            .select('*')
            .order('changed_at', { ascending: false })
            .limit(100);

        if (data) setLogs(data as AuditLog[]);
        setLoading(false);
    };

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void (async () => {
                await fetchLogs();
            })();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, []);

    const getCheckerName = (log: AuditLog) => {
        if (log.action === 'DELETE') return log.old_data?.checker_name || "不明";
        return log.new_data?.checker_name || "不明";
    };

    return (
        <div className="bg-transparent">
            <div className="flex items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <ShieldAlert className="h-6 w-6 text-red-600" />
                    監査ログ (HACCP記録の変更履歴)
                </h1>
                {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
            </div>

            <Card className="border-slate-200 shadow-sm overflow-hidden mb-6">
                <CardHeader className="bg-red-50/50 border-b pb-4">
                    <CardTitle className="text-sm text-red-900 flex items-center gap-2">
                        <FileSignature className="h-5 w-5 text-red-600" /> 記録の変更履歴（直近100件）
                    </CardTitle>
                    <p className="text-xs text-slate-600 mt-1 font-medium">データベース側で強制的にすべての追加・修正・削除を監視・記録しています。この記録は隠蔽・改竄できません。</p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="w-full table-fixed min-w-[1000px] text-sm">
                            <TableHeader className="bg-slate-100">
                                <TableRow>
                                    <TableHead className="w-[12%] pl-4">変更日時</TableHead>
                                    <TableHead className="w-[8%] text-center">操作</TableHead>
                                    <TableHead className="w-[18%]">対象帳票 / 点検日</TableHead>
                                    <TableHead className="w-[10%]">担当者</TableHead>
                                    <TableHead className="w-[52%] pr-4">変更内容の詳細</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></TableCell></TableRow>
                                ) : (
                                    logs.map((log) => {
                                        const dateObj = new Date(log.changed_at);
                                        const dateStr = `${dateObj.toLocaleDateString('ja-JP')} ${dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;

                                        return (
                                            <TableRow key={log.id} className="hover:bg-slate-50 border-b">
                                                <TableCell className="pl-4">
                                                    <div className="text-[11px] font-black text-slate-700">{dateStr}</div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {log.action === 'INSERT' && <Badge className="bg-blue-100 text-blue-800 border-none shadow-sm w-12 text-center justify-center">新規</Badge>}
                                                    {log.action === 'UPDATE' && <Badge className="bg-amber-100 text-amber-800 border-none shadow-sm w-12 text-center justify-center">変更</Badge>}
                                                    {log.action === 'DELETE' && <Badge className="bg-red-100 text-red-800 border-none shadow-sm w-12 text-center justify-center">削除</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-800 text-xs mb-1">{TABLE_NAMES[log.table_name] || log.table_name}</div>
                                                    <div className="text-[11px] text-slate-500 font-medium">対象日: <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{log.check_date || log.new_data?.test_date || log.old_data?.test_date}</span></div>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-700 text-xs">
                                                    {getCheckerName(log)}
                                                </TableCell>
                                                <TableCell className="p-3 pr-4">
                                                    <DiffViewer action={log.action} oldData={log.old_data} newData={log.new_data} />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                                {!loading && logs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-16 text-slate-500 font-bold bg-slate-50">
                                            変更履歴はまだありません。
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}