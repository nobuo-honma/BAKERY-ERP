"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Settings, Info, ArrowRight, Play, CheckCircle2, Truck, Package, Database, Key, ShoppingCart, Factory } from "lucide-react";

export default function ManualPage() {
    return (
        <div className="bg-white p-6 md:p-10 rounded-xl shadow-sm border border-slate-200 min-h-[80vh]">

            <div className="flex items-center gap-3 mb-8 border-b pb-6">
                <div className="bg-blue-100 p-3 rounded-lg">
                    <BookOpen className="h-8 w-8 text-blue-700" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">システム・マニュアル</h1>
                    <p className="text-slate-500 mt-1">災害備蓄用パン 製造・HACCP統合管理システムの操作と仕様</p>
                </div>
            </div>

            <Tabs defaultValue="user" className="w-full">
                <TabsList className="mb-8 bg-slate-100 p-1.5 rounded-lg h-auto flex w-fit">
                    <TabsTrigger value="user" className="font-bold py-2.5 px-8 text-base data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                        <Info className="h-5 w-5 mr-2" /> 操作マニュアル (User)
                    </TabsTrigger>
                    <TabsTrigger value="tech" className="font-bold py-2.5 px-8 text-base data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                        <Settings className="h-5 w-5 mr-2" /> 技術マニュアル (Tech)
                    </TabsTrigger>
                </TabsList>

                {/* ==========================================
            操作マニュアル (User Manual)
        ========================================== */}
                <TabsContent value="user" className="space-y-12 animate-in fade-in duration-500">

                    {/* 全体フロー */}
                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                            システムの全体業務フロー
                        </h2>
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 flex flex-wrap md:flex-nowrap items-center justify-center gap-2 md:gap-4 font-bold text-sm md:text-base text-slate-700 text-center">
                            <div className="bg-white p-3 md:p-4 rounded-md border shadow-sm w-full md:w-auto">1. 受注登録<br /><span className="text-xs text-blue-600 font-normal">(必要資材を計算)</span></div>
                            <ArrowRight className="text-slate-300 hidden md:block" />
                            <div className="bg-white p-3 md:p-4 rounded-md border shadow-sm w-full md:w-auto">2. 製造計画<br /><span className="text-xs text-blue-600 font-normal">(Lot番号を自動発行)</span></div>
                            <ArrowRight className="text-slate-300 hidden md:block" />
                            <div className="bg-white p-3 md:p-4 rounded-md border shadow-sm w-full md:w-auto">3. 製造開始<br /><span className="text-xs text-blue-600 font-normal">(資材在庫を減らす)</span></div>
                            <ArrowRight className="text-slate-300 hidden md:block" />
                            <div className="bg-white p-3 md:p-4 rounded-md border shadow-sm w-full md:w-auto">4. 製造完了<br /><span className="text-xs text-blue-600 font-normal">(製品在庫を増やす)</span></div>
                            <ArrowRight className="text-slate-300 hidden md:block" />
                            <div className="bg-white p-3 md:p-4 rounded-md border shadow-sm w-full md:w-auto">5. 出荷・引当<br /><span className="text-xs text-blue-600 font-normal">(古いLotから減らす)</span></div>
                        </div>
                    </section>

                    {/* 各機能の解説 */}
                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                            各画面の使い方
                        </h2>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* 受注管理 */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-100 p-4 border-b font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5 text-blue-600" /> 受注管理
                                </div>
                                <div className="p-5 space-y-3 text-sm text-slate-600">
                                    <p>顧客からの注文を登録する画面です。「新規受注登録」から行います。</p>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li><strong className="text-slate-800">製品と種類の選択:</strong> 「製品名」を選ぶと、連動して「種類(味)」が選べるようになります。</li>
                                        <li><strong className="text-slate-800">BOMシミュレーション:</strong> 数量(c/s)を入力すると、その製造に必要な「原料・資材」と「現在の在庫」が瞬時に計算され、不足がある場合は赤色で警告が出ます。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* 製造管理 */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-100 p-4 border-b font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Factory className="h-5 w-5 text-blue-600" /> 製造管理
                                </div>
                                <div className="p-5 space-y-3 text-sm text-slate-600">
                                    <p>受注に基づいて、いつ製造するかの計画を立てる最重要画面です。</p>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li><strong className="text-slate-800">Lot・賞味期限の自動計算:</strong> 製造予定日とkg数を入力すると、社内ルールに従ったLot番号と、製造日+5年6ヶ月の賞味期限が自動計算されます。</li>
                                        <li><strong className="text-slate-800">分割計画:</strong> 一つの受注を複数日に分けて製造することも可能です（未計画の残数がゼロになるまで何度でも登録可）。</li>
                                        <li><strong className="text-amber-600">製造開始 (重要):</strong> 予定表上で「製造を開始する」を押すと、BOMに基づいて<strong>資材の在庫が自動で減算</strong>されます。</li>
                                        <li><strong className="text-green-600">製造完了 (重要):</strong> 「製造を完了する」を押すと、完成したLotが<strong>製品在庫に自動で加算</strong>されます。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* 在庫管理 */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-100 p-4 border-b font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-600" /> 在庫管理・棚卸
                                </div>
                                <div className="p-5 space-y-3 text-sm text-slate-600">
                                    <p>現在の在庫を確認し、システムと実数がズレた際に修正(棚卸)する画面です。</p>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li><strong className="text-slate-800">一括棚卸モード:</strong> 月末などに、一覧画面から直接数値を入力し、変更のあった項目だけを一括で保存できます。</li>
                                        <li><strong className="text-slate-800">c/s・pの混在入力:</strong> 製品在庫は、ケース(c/s)と端数(ピース)を分けて入力でき、自動で合算されます。</li>
                                        <li><strong className="text-slate-800">調整履歴:</strong> 全ての棚卸・修正の履歴は記録され、後から追跡可能です。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* 出荷管理 */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-100 p-4 border-b font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-blue-600" /> 出荷管理
                                </div>
                                <div className="p-5 space-y-3 text-sm text-slate-600">
                                    <p>完成品を在庫から引き当てて出荷する画面です。</p>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li><strong className="text-slate-800">手動引き当て:</strong> 顧客の残存賞味期限の要求に合わせて、出荷するLotを目視で選び、数量を手動で入力します。</li>
                                        <li><strong className="text-slate-800">複数Lotの合算:</strong> 複数のLotから少しずつ出荷する場合も、画面下部で合計数が自動計算されます。</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>
                </TabsContent>


                {/* ==========================================
            技術マニュアル (Technical Manual)
        ========================================== */}
                <TabsContent value="tech" className="space-y-12 animate-in fade-in duration-500">

                    <section>
                        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-md">
                            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                                <Settings className="h-6 w-6 text-blue-400" /> システム・アーキテクチャ
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                                    <div className="font-bold text-blue-300 mb-1">フロントエンド</div>
                                    <div>Next.js (App Router) + React<br />TypeScript<br />Tailwind CSS (shadcn/ui)</div>
                                </div>
                                <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                                    <div className="font-bold text-blue-300 mb-1">バックエンド / データベース</div>
                                    <div>Supabase (BaaS)<br />PostgreSQL<br />Row Level Security (RLS) 対応可</div>
                                </div>
                                <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                                    <div className="font-bold text-blue-300 mb-1">ホスティング (推奨)</div>
                                    <div>Vercel または Supabase Hosting</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-2">独自のビジネスロジック仕様</h2>

                        <div className="space-y-6">
                            {/* Lot番号ルール */}
                            <div>
                                <h3 className="text-lg font-bold text-blue-800 mb-2">1. Lot番号の自動生成ルール</h3>
                                <p className="text-sm text-slate-600 mb-2"><code>src/lib/lot-generator.ts</code> にて制御。入力された日付と製品IDから一意の文字列を生成します。</p>
                                <div className="bg-slate-50 p-4 rounded border font-mono text-sm space-y-2 overflow-x-auto">
                                    <div><span className="font-bold text-slate-700">【通常品】</span> 例: キュウメイパン シーベリー味 (SB)</div>
                                    <div className="text-blue-600">ルール: カタカナ(日付) + 月alpha + 年2桁 + 製品ID</div>
                                    <div className="text-slate-500">変換表: 日付(タ行抜きア〜ヤ), 月(A〜L)</div>
                                    <div className="bg-white p-2 rounded border border-slate-200">2026年2月13日 製造 ⇒ 「ス(13) B(2) 26 SB」 ⇒ <strong className="text-black">スB26SB</strong></div>

                                    <div className="mt-4"><span className="font-bold text-slate-700">【MA / FD 複合製品】</span></div>
                                    <div className="text-blue-600">ルール: yy(年2桁) + MA/FD + 連番2桁</div>
                                    <div className="bg-white p-2 rounded border border-slate-200">2026年 製造 ⇒ <strong className="text-black">26MA01</strong></div>

                                    <div className="mt-4"><span className="font-bold text-slate-700">【YC50 / YO50】</span></div>
                                    <div className="text-blue-600">ルール: dd(日付2桁) + 月alpha + 年2桁 + 製品ID</div>
                                    <div className="bg-white p-2 rounded border border-slate-200">2026年2月13日 製造 ⇒ 「13 B 26 YC50」 ⇒ <strong className="text-black">13B26YC50</strong></div>
                                </div>
                            </div>

                            {/* 在庫管理ルール */}
                            <div>
                                <h3 className="text-lg font-bold text-blue-800 mb-2">2. 製品在庫の「ケース・ピース混在」管理の仕組み</h3>
                                <p className="text-sm text-slate-600 mb-2">計算バグ（繰り下がり等の複雑化）を防ぐため、データベース上と画面表示上でデータの持ち方を分けています。</p>
                                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-2">
                                    <li><strong>データベース (Supabase):</strong> <code>product_stocks</code> テーブルの <code>total_pieces</code> というカラム1つに、<strong>「総ピース数」として保存</strong>します。（例: 10 c/s と 5 p の場合、245 として保存）</li>
                                    <li><strong>フロントエンド画面:</strong> 取得した <code>total_pieces</code> を、製品マスタに登録されている <code>unit_per_cs</code> (1ケースあたりの入数) で割り算し、商をケース(c/s)、余りをピース(p)として画面に描画します。<br />
                                        <code className="bg-slate-100 px-1 rounded text-blue-600">cs = Math.floor(total_pieces / unit_per_cs)</code><br />
                                        <code className="bg-slate-100 px-1 rounded text-blue-600">piece = total_pieces % unit_per_cs</code>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-2">データベース・テーブル構成</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700">
                                        <th className="p-3 border">テーブル名</th>
                                        <th className="p-3 border">役割</th>
                                        <th className="p-3 border">主要カラム / リレーション</th>
                                    </tr>
                                </thead>
                                <tbody className="text-slate-600">
                                    <tr><td className="p-3 border font-bold">products</td><td className="p-3 border">製品マスタ (完成品)</td><td className="p-3 border">id, name, variant_name, unit_per_cs, unit_per_kg</td></tr>
                                    <tr><td className="p-3 border font-bold">items</td><td className="p-3 border">品目マスタ (原料・資材)</td><td className="p-3 border">id, item_type, unit_size, safety_stock</td></tr>
                                    <tr><td className="p-3 border font-bold">bom</td><td className="p-3 border">部品表 (レシピ)</td><td className="p-3 border">product_id(FK), item_id(FK), usage_rate, basis_type(kg/cs基準)</td></tr>
                                    <tr><td className="p-3 border font-bold">customers</td><td className="p-3 border">出荷先マスタ</td><td className="p-3 border">id, name, address, phone</td></tr>
                                    <tr><td className="p-3 border font-bold bg-blue-50">orders</td><td className="p-3 border bg-blue-50">受注データ</td><td className="p-3 border bg-blue-50">id, customer_id(FK), product_id(FK), quantity, status(received/in_production/shipped)</td></tr>
                                    <tr><td className="p-3 border font-bold bg-amber-50">production_plans</td><td className="p-3 border bg-amber-50">製造計画・実績</td><td className="p-3 border bg-amber-50">id, order_id(FK), production_date, planned_cs, lot_code, status</td></tr>
                                    <tr><td className="p-3 border font-bold">item_stocks</td><td className="p-3 border">原料・資材の現在庫</td><td className="p-3 border">item_id(FK), quantity</td></tr>
                                    <tr><td className="p-3 border font-bold">product_stocks</td><td className="p-3 border">完成品の現在庫(Lot別)</td><td className="p-3 border">id, lot_code, product_id(FK), total_pieces, expiry_date</td></tr>
                                    <tr><td className="p-3 border font-bold">arrivals</td><td className="p-3 border">入荷予定・発注</td><td className="p-3 border">id, item_id(FK), expected_date, quantity, status</td></tr>
                                    <tr><td className="p-3 border font-bold">shipments</td><td className="p-3 border">出荷実績 (引き当て)</td><td className="p-3 border">id, order_id(FK), lot_code, qty_cs, qty_piece</td></tr>
                                    <tr><td className="p-3 border font-bold">inventory_adjustments</td><td className="p-3 border">棚卸・調整履歴</td><td className="p-3 border">id, adjusted_at, item_id/product_id, before_qty, after_qty, diff, reason</td></tr>
                                    <tr><td className="p-3 border font-bold">events</td><td className="p-3 border">社内イベント (カレンダー用)</td><td className="p-3 border">id, event_date, title, notes</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                </TabsContent>
            </Tabs>
        </div>
    );
}