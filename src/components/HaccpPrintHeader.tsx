import React from 'react';

type Props = {
    title: string;
    subtitle?: React.ReactNode;
    docNo: string;
    establishedDate: string;
    revisedDate: string;
    hasSubChecker?: boolean; // 副担当者の有無
};

export default function HaccpPrintHeader({
    title, subtitle, docNo, establishedDate, revisedDate, hasSubChecker = false
}: Props) {

    // 副担当の有無によってテーブル全体の横幅を変える
    // （副担当なし: 340px, 副担当あり: 400px）
    const tableWidthClass = hasSubChecker ? "w-[400px]" : "w-[340px]";

    return (
        <div className="flex justify-between items-end mb-4 shrink-0">
            <div className="flex flex-col justify-end">
                <h1 className="text-2xl font-bold tracking-widest leading-none mb-1">{title}</h1>
                {subtitle && <div className="text-lg font-bold">{subtitle}</div>}
            </div>

            {/* テーブル全体 */}
            <table className={`border-collapse border-2 border-black text-[11px] text-center leading-none ${tableWidthClass}`}>
                <tbody>
                    <tr className="h-5">
                        {/* 左側：情報欄（幅を固定してスリムに） */}
                        <th className="border border-black font-medium bg-gray-50 w-14">文章No.</th>
                        <td className="border border-black font-mono font-bold tracking-wider w-20">{docNo}</td>

                        {/* 右側：確認印・承認印欄 */}
                        {/* 担当・副担当は標準サイズ（幅 14 = 56px 程度）に固定 */}
                        <th className="border border-black font-medium w-14">担当</th>
                        {hasSubChecker && <th className="border border-black font-medium w-14">副担当</th>}
                        {/* 施設長は残りの幅をすべて使い、広めに確保 */}
                        <th className="border border-black font-medium">施設長</th>
                    </tr>
                    <tr className="h-5">
                        <th className="border border-black font-medium bg-gray-50">制定日</th>
                        <td className="border border-black font-mono">{establishedDate}</td>

                        {/* 担当印 */}
                        <td className="border border-black relative h-20" rowSpan={3}>
                            <span className="absolute inset-0 flex items-center justify-center text-gray-300 font-serif text-3xl print:text-black/15">印</span>
                        </td>

                        {/* 副担当印 (ある場合のみ) */}
                        {hasSubChecker && (
                            <td className="border border-black relative h-20" rowSpan={3}>
                                <span className="absolute inset-0 flex items-center justify-center text-gray-300 font-serif text-3xl print:text-black/15">印</span>
                            </td>
                        )}

                        {/* 施設長印（広め） */}
                        <td className="border border-black relative h-20" rowSpan={3}>
                            <span className="absolute inset-0 flex items-center justify-center text-gray-300 font-serif text-3xl print:text-black/15">印</span>
                        </td>
                    </tr>
                    <tr className="h-5">
                        <th className="border border-black font-medium bg-gray-50">改定日</th>
                        <td className="border border-black font-mono">{revisedDate || "　"}</td>
                    </tr>
                    <tr className="h-5">
                        <td className="border border-black text-[9px] bg-gray-50" colSpan={2}>ワークセンター・やまびこ</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}