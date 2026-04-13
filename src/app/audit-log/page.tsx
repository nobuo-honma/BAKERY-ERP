"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Loader2, ArrowRight, Search, FileSignature, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type AuditLog = {
    id: string;
    table_name: string;
    record_id: string;
    check_date: string;
    action: string;
    old_data: any;
    new_data: any;
    changed_at: string;
};

// テーブル名を日本語に変換
const TABLE_NAMES: Record<string, string> = {
    cleaning_checks: "清掃・点検表 (YO-22)",
    facility_checks: "施設設備チェック表 (YO-26)",
    manufacturing_checks: "製造施設チェック表 (YO-27)",
    area_cleaning_checks: "清掃チェック表 (YO-21)",
};

export default function AuditLogsPage() {
    const { canEdit } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        // 最新の変更履歴を100件取得
        const { data } = await supabase
            .from('haccp_audit_logs')
            .select('*')
            .order('changed_at', { ascending: false })
            .limit(100);

        if (data) setLogs(data as AuditLog[]);
        setLoading(false);
    };

    // 担当者名を抽出するヘルパー関数
    const getCheckerName = (log: AuditLog) => {
        if (log.action === 'DELETE') return log.old_data?.checker_name || "不明";
        return log.new_data?.checker_name || "不明";
    };

    return (
        <div className="bg-transparent">
            <div className="flex items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <ShieldAlert className="h-6 w-6 text-red-600" />
                    監査ログ (HACCP記録の改竄防止・変更履歴)
                </h1>
                {!canEdit && <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 px-3 py-1 shadow-sm"><Lock className="w-3 h-3 mr-1" /> 閲覧モード</Badge>}
            </div>

            <Card className="border-slate-200 shadow-sm overflow-hidden mb-6">
                <CardHeader className="bg-red-50/50 border-b pb-4">
                    <CardTitle className="text-sm text-red-900 flex items-center gap-2">
                        <FileSignature className="h-5 w-5 text-red-600" /> 記録の変更履歴（直近100件）
                    </CardTitle>
                    <p className="text-xs text-slate-600 mt-1">データベース側で強制的にすべての追加・修正・削除を記録しています。この記録はアプリケーションから削除・改竄することはできません。</p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="w-full table-fixed min-w-[1000px] text-sm">
                            <TableHeader className="bg-slate-100">
                                <TableRow>
                                    <TableHead className="w-[15%] pl-4">変更日時</TableHead>
                                    <TableHead className="w-[8%] text-center">操作</TableHead>
                                    <TableHead className="w-[20%]">対象帳票 / 点検日</TableHead>
                                    <TableHead className="w-[12%]">入力担当者</TableHead>
                                    <TableHead className="w-[45%]">変更内容の詳細 (システムデータ)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400 mx-auto" /></TableCell></TableRow>
                                ) : (
                                    logs.map((log) => {
                                        const dateObj = new Date(log.changed_at);
                                        const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                                        return (
                                            <TableRow key={log.id} className="hover:bg-slate-50 border-b">
                                                <TableCell className="pl-4 text-xs font-mono text-slate-600">{dateStr}</TableCell>
                                                <TableCell className="text-center">
                                                    {log.action === 'INSERT' && <Badge className="bg-blue-100 text-blue-800 border-none shadow-none">新規</Badge>}
                                                    {log.action === 'UPDATE' && <Badge className="bg-amber-100 text-amber-800 border-none shadow-none">更新</Badge>}
                                                    {log.action === 'DELETE' && <Badge className="bg-red-100 text-red-800 border-none shadow-none">削除</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-800 text-xs">{TABLE_NAMES[log.table_name] || log.table_name}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">対象日: <span className="font-bold text-slate-700">{log.check_date}</span></div>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-700 text-xs">{getCheckerName(log)}</TableCell>
                                                <TableCell className="p-2">
                                                    <div className="bg-slate-50 border rounded p-2 text-[10px] font-mono text-slate-600 max-h-24 overflow-y-auto break-all">
                                                        {log.action === 'UPDATE' ? (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="text-slate-400 line-through">前: {JSON.stringify(log.old_data?.results)}</div>
                                                                <div className="text-amber-700 font-bold">後: {JSON.stringify(log.new_data?.results)}</div>
                                                            </div>
                                                        ) : log.action === 'DELETE' ? (
                                                            <span className="text-red-600">削除されたデータ: {JSON.stringify(log.old_data?.results)}</span>
                                                        ) : (
                                                            <span className="text-blue-700">登録されたデータ: {JSON.stringify(log.new_data?.results)}</span>
                                                        )}
                                                    </div>
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