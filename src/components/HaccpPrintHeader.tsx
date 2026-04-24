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

    // 副担当の有無によってテーブルの構造（セルの数）を変える
    return (
        <div className="flex justify-between items-end mb-4 shrink-0">
            <div className="flex flex-col justify-end">
                <h1 className="text-3xl font-bold tracking-widest leading-none mb-1">{title}</h1>
                {subtitle && <div className="text-lg font-bold">{subtitle}</div>}
            </div>

            <table className="border-collapse border-2 border-black text-[11px] text-center leading-none">
                <tbody>
                    <tr className="h-5">
                        {/* 左側：情報欄（幅を固定） */}
                        <th className="border border-black font-medium bg-gray-50 w-14">文章No.</th>
                        <td className="border border-black font-mono font-bold tracking-wider w-20">{docNo}</td>

                        {/* 右側：承認印欄（施設長・担当者・副担当者） */}
                        {/* 約2.5cm(約96px)の幅を確保するために w-24 を指定 */}
                        <th className="border border-black font-medium w-24">施設長</th>
                        <th className="border border-black font-medium w-24">担当者</th>
                        {hasSubChecker && <th className="border border-black font-medium w-24">副担当者</th>}
                    </tr>
                    <tr className="h-5">
                        <th className="border border-black font-medium bg-gray-50">制定日</th>
                        <td className="border border-black font-mono">{establishedDate}</td>

                        {/* 施設長印（高さも 約2.5cm/96px に固定して正方形にするため h-24 を指定） */}
                        <td className="border border-black relative h-24" rowSpan={3}>
                            {/* 「印」の文字は削除しました */}
                        </td>

                        {/* 担当者印 */}
                        <td className="border border-black relative h-24" rowSpan={3}></td>

                        {/* 副担当者印 (ある場合のみ) */}
                        {hasSubChecker && (
                            <td className="border border-black relative h-24" rowSpan={3}></td>
                        )}
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