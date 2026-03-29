"use client";

import { useState } from "react";
import { BookOpen, ArrowRight, Printer, Menu as MenuIcon, X, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ManualPage() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // 目次の項目定義
    const tableOfContents = [
        { id: "intro", title: "はじめに" },
        { id: "flow", title: "1. 全体の業務フロー (受注〜出荷)" },
        { id: "master", title: "2. マスタ管理 (初期設定)" },
        { id: "order", title: "3. 受注管理 (注文の登録と計算)" },
        { id: "arrival", title: "4. 入荷管理 (資材の発注と受入)" },
        { id: "production", title: "5. 製造管理 (計画とLot自動発行)" },
        { id: "inventory", title: "6. 在庫管理・棚卸 (実数調整)" },
        { id: "shipment", title: "7. 出荷管理 (手動引き当て)" },
        { id: "calendar", title: "8. 予定表(カレンダー)の活用" },
    ];

    // スムーズスクロール機能
    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            // ヘッダーの高さ分(約80px)を引いてスクロール
            const y = el.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
            setIsMobileMenuOpen(false); // スマホメニューを閉じる
        }
    };

    return (
        <div className="bg-white min-h-[80vh] rounded-xl shadow-sm border border-slate-200 relative print:border-none print:shadow-none print:bg-white">

            {/* --- 印刷専用スタイル (画面表示時は無視されます) --- */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          header, nav { display: none !important; }
          body { background-color: white !important; color: black !important; }
          .print-hidden { display: none !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}} />

            {/* --- ヘッダー領域 --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b print:border-b-2 print:border-black">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="bg-blue-100 p-3 rounded-lg print:hidden">
                        <BookOpen className="h-8 w-8 text-blue-700" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">システム取り扱い説明書</h1>
                        <p className="text-sm md:text-base text-slate-500 mt-1 font-bold">災害備蓄用パン 製造・HACCP統合管理システム</p>
                    </div>
                </div>
                <Button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white font-bold print-hidden shadow-sm">
                    <Printer className="h-4 w-4 mr-2" /> マニュアルを印刷する
                </Button>
            </div>

            <div className="flex flex-col md:flex-row">
                {/* --- 左側：目次ナビゲーション (PC表示) --- */}
                <div className="hidden md:block w-1/4 p-6 border-r bg-slate-50 print-hidden min-h-screen sticky top-16">
                    <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><MenuIcon className="h-5 w-5" /> 目次</h2>
                    <nav className="space-y-1">
                        {tableOfContents.map((item) => (
                            <button
                                key={item.id} onClick={() => scrollTo(item.id)}
                                className="block w-full text-left px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-white hover:text-blue-700 rounded-md transition-colors"
                            >
                                {item.title}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* --- スマホ用目次トグル --- */}
                <div className="md:hidden p-4 border-b bg-slate-50 print-hidden sticky top-16 z-40">
                    <Button variant="outline" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="w-full justify-between bg-white font-bold border-slate-300">
                        <span className="flex items-center gap-2"><MenuIcon className="h-4 w-4" /> {isMobileMenuOpen ? "目次を閉じる" : "目次を開く"}</span>
                        {isMobileMenuOpen ? <X className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    {isMobileMenuOpen && (
                        <nav className="mt-2 bg-white border rounded-lg shadow-lg overflow-hidden divide-y">
                            {tableOfContents.map((item) => (
                                <button
                                    key={item.id} onClick={() => scrollTo(item.id)}
                                    className="block w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    {item.title}
                                </button>
                            ))}
                        </nav>
                    )}
                </div>

                {/* --- 右側：マニュアル本文 --- */}
                <div className="w-full md:w-3/4 p-6 md:p-10 space-y-16 print:p-4 print:space-y-10">

                    {/* はじめに */}
                    <section id="intro" className="avoid-break">
                        <h2 className="text-xl font-bold text-blue-800 border-l-4 border-blue-600 pl-3 mb-4">はじめに</h2>
                        <p className="text-slate-700 leading-relaxed mb-4">
                            本システムは、災害備蓄用パンの「受注〜製造〜出荷」に至るすべてのモノの流れ（サプライチェーン）を一元管理し、在庫の自動計算やLot番号の自動採番を行うことで、業務効率化とミス防止を実現するシステムです。
                        </p>
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 text-sm text-amber-800 font-bold">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <p>システム内の在庫数は、各画面のステータス更新（「製造中」や「出荷済」にする操作）と完全に連動して増減します。必ず実際の作業と同時にシステムのステータスを更新するようにしてください。</p>
                        </div>
                    </section>

                    {/* 1. 業務フロー */}
                    <section id="flow" className="avoid-break">
                        <h2 className="text-2xl font-black text-slate-800 mb-6 border-b pb-2">1. 全体の業務フロー (受注〜出荷)</h2>
                        <div className="space-y-4">
                            <div className="flex gap-4 p-4 bg-slate-50 border rounded-lg items-start">
                                <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                                <div>
                                    <h3 className="font-bold text-lg text-blue-900 mb-1">【受注管理】 注文の登録</h3>
                                    <p className="text-slate-700 text-sm">お客様からの注文を入力します。この時、システムが自動的にBOM（レシピ）を計算し、必要な原材料と資材の不足分を知らせてくれます。</p>
                                </div>
                            </div>
                            <div className="flex justify-center text-slate-300 print-hidden"><ArrowRight className="rotate-90 md:rotate-0" /></div>

                            <div className="flex gap-4 p-4 bg-slate-50 border rounded-lg items-start">
                                <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                                <div>
                                    <h3 className="font-bold text-lg text-blue-900 mb-1">【入荷管理】 資材の発注・受け入れ</h3>
                                    <p className="text-slate-700 text-sm">不足している原料・資材の発注を登録します。実際にモノが届いたら「入荷済」ボタンを押すことで、システムの原材料在庫が増加します。</p>
                                </div>
                            </div>
                            <div className="flex justify-center text-slate-300 print-hidden"><ArrowRight className="rotate-90 md:rotate-0" /></div>

                            <div className="flex gap-4 p-4 bg-slate-50 border rounded-lg items-start">
                                <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                                <div>
                                    <h3 className="font-bold text-lg text-blue-900 mb-1">【製造管理】 計画立案と製造の実行</h3>
                                    <p className="text-slate-700 text-sm">受注データから製造計画（何日に何kg作るか）を立てます。この時、<strong>Lot番号と賞味期限が自動で発行</strong>されます。<br />予定表から「製造を開始」すると<strong>原料在庫が減り</strong>、「完了」すると完成した<strong>製品在庫が増えます</strong>。</p>
                                </div>
                            </div>
                            <div className="flex justify-center text-slate-300 print-hidden"><ArrowRight className="rotate-90 md:rotate-0" /></div>

                            <div className="flex gap-4 p-4 bg-slate-50 border rounded-lg items-start">
                                <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">4</div>
                                <div>
                                    <h3 className="font-bold text-lg text-blue-900 mb-1">【出荷管理】 製品の出荷</h3>
                                    <p className="text-slate-700 text-sm">出荷日が来たら、倉庫にある製品（Lot）の中から古いものを選んで出荷数を入力します。確定すると製品在庫が減り、一連の取引が完了します。</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="page-break"></div>

                    {/* 2. マスタ管理 */}
                    <section id="master" className="avoid-break">
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-b pb-2">2. マスタ管理 (初期設定)</h2>
                        <p className="text-slate-700 mb-4 text-sm">システムを正しく動かすための「基礎データ」を登録・編集する画面です。</p>
                        <div className="bg-slate-50 p-5 rounded-lg border space-y-3 text-sm">
                            <div><strong className="text-blue-800">■ 編集方法</strong><br />Excelのように、一覧表の<strong>文字（セル）を直接クリック</strong>すると入力枠に変わり、書き換えてEnterキーを押すだけで保存されます。</div>
                            <hr className="border-slate-200" />
                            <div><strong className="text-blue-800">■ 製品マスタの重要項目</strong><br />「1kgあたり個数」と「1c/sあたり入数」は、システムが裏側で自動計算を行うための非常に重要な数値です。必ず正しい値を設定してください。</div>
                            <hr className="border-slate-200" />
                            <div><strong className="text-blue-800">■ BOM (部品表) の設定</strong><br />製品1ケース（または1kg）を作るのに必要な材料の「使用率」を登録します。</div>
                        </div>
                    </section>

                    {/* 3. 受注管理 */}
                    <section id="order" className="avoid-break">
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-b pb-2">3. 受注管理 (注文の登録)</h2>
                        <p className="text-slate-700 mb-4 text-sm">お客様からの注文をシステムに入力する最初のステップです。</p>
                        <ul className="list-decimal pl-5 space-y-3 text-sm text-slate-800 font-bold">
                            <li>画面右上の「新規受注登録」ボタンを押します。</li>
                            <li>希望納期、出荷先、製品名、種類(味)、受注数(c/s)を入力します。<br /><span className="text-xs text-slate-500 font-normal">※出荷先は名前の一部を入力するだけで検索できます。</span></li>
                            <li><strong className="text-blue-600 bg-blue-50 px-1">【重要】BOMシミュレーションの確認:</strong> 数を入力した瞬間に、右側に「必要な資材と原料」が計算され、現在の在庫から引き算されます。<strong>赤色で「不足!」と出た品目は、すぐに発注（入荷管理）が必要です。</strong></li>
                            <li>「受注を確定する」を押して保存します。</li>
                        </ul>
                    </section>

                    {/* 4. 入荷管理 */}
                    <section id="arrival" className="avoid-break">
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-b pb-2">4. 入荷管理 (資材の発注と受入)</h2>
                        <p className="text-slate-700 mb-4 text-sm">原料や資材の発注記録と、届いた際の「在庫を増やす」処理を行います。</p>
                        <ul className="list-decimal pl-5 space-y-3 text-sm text-slate-800 font-bold">
                            <li>左側のフォームから、発注した品目と「入荷予定日」「数量」を登録します。</li>
                            <li>実際にモノが工場に届いたら、右側のリスト（または予定表）から該当のデータを見つけて「確認」を押します。</li>
                            <li>ダイアログ内の緑色の<strong>「入荷済にする (在庫に加算)」</strong>ボタンを押します。<br /><span className="text-xs text-red-600 font-normal">※このボタンを押さないと、システムの在庫は増えません！</span></li>
                        </ul>
                    </section>

                    <div className="page-break"></div>

                    {/* 5. 製造管理 */}
                    <section id="production" className="avoid-break">
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-b pb-2">5. 製造管理 (計画とLot自動発行)</h2>
                        <p className="text-slate-700 mb-4 text-sm">いつ・何を製造するかのスケジュールを立て、実際に在庫を動かすシステムの心臓部です。</p>

                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> 計画の立て方</h3>
                            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-800">
                                <li>左側の「未計画の残数がある受注」リストから、製造したい注文をクリックします。</li>
                                <li>右側の「製造予定日」と「製造量(kg)」を入力します。<br /><span className="font-normal text-slate-600">※一度に全て作れない場合は、少ないkg数を入力して「分割」して登録することも可能です。</span></li>
                                <li>自動計算された「製造Lot番号」と「賞味期限」を確認し、「計画を追加する」を押します。</li>
                            </ol>
                        </div>

                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                            <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> 製造の実行 (在庫連動)</h3>
                            <p className="text-sm text-slate-700 mb-2">計画を立てただけでは在庫は動きません。実際の作業に合わせてステータスを進めます。</p>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-800">
                                <li>予定表(カレンダー)から計画カードをクリックします。</li>
                                <li>製造開始時：<strong>「製造を開始する」</strong>ボタンを押します。<br /><span className="font-normal text-red-600">⇒ 使用する原料・資材が在庫から自動でマイナスされます。</span></li>
                                <li>パン完成時：<strong>「製造を完了する」</strong>ボタンを押します。<br /><span className="font-normal text-blue-600">⇒ 完成したパンが、Lot番号付きで製品在庫に自動でプラスされます。</span></li>
                            </ul>
                        </div>
                    </section>

                    {/* 6. 在庫管理 */}
                    <section id="inventory" className="avoid-break">
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-b pb-2">6. 在庫管理・棚卸 (実数調整)</h2>
                        <p className="text-slate-700 mb-4 text-sm">システム上の在庫と、倉庫の実際の在庫がズレた場合に修正を行う画面です。スマホでの操作に最適化されています。</p>
                        <ul className="list-decimal pl-5 space-y-3 text-sm text-slate-800 font-bold">
                            <li>スマホで画面を開き、<strong>「一括棚卸を開始」</strong>ボタンを押します。</li>
                            <li>全ての項目に入力枠が現れます。実際の在庫を数えながら、ズレている項目の数値を書き換えます。（製品はケースとピースを別々に入力できます）</li>
                            <li>変更した箇所は黄色くハイライトされます。最後に<strong>「一括保存」</strong>ボタンを押します。</li>
                            <li><span className="font-normal text-slate-600">※変更内容はすべて「調整履歴」タブに記録されるため、後から確認が可能です。</span></li>
                        </ul>
                    </section>

                    {/* 7. 出荷管理 */}
                    <section id="shipment" className="avoid-break">
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-b pb-2">7. 出荷管理 (手動引き当て)</h2>
                        <p className="text-slate-700 mb-4 text-sm">完成品をお客様へ出荷し、在庫を減らす最終工程です。</p>
                        <ul className="list-decimal pl-5 space-y-3 text-sm text-slate-800 font-bold">
                            <li>左側のリストから出荷対象の注文を選びます。</li>
                            <li>右側に、その製品の「出荷可能なLot一覧」が<strong>古い順</strong>で表示されます。</li>
                            <li>お客様の納品条件（賞味期限の残月数など）を満たすLotを選び、出荷する数量（c/sとp）を手入力します。複数のLotから少しずつ出荷することも可能です。</li>
                            <li>「出荷を確定」ボタンを押すと、製品在庫が正確に減算され、取引完了となります。</li>
                        </ul>
                    </section>

                    <div className="page-break"></div>

                    {/* 8. 予定表の活用 */}
                    <section id="calendar" className="avoid-break">
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-b pb-2">8. 予定表(カレンダー)の活用と印刷</h2>
                        <p className="text-slate-700 mb-4 text-sm">製造管理および入荷管理画面にある「予定表（カレンダー）」は、工場全体のスケジュールボードとして活躍します。</p>
                        <ul className="list-disc pl-5 space-y-3 text-sm text-slate-800 font-bold">
                            <li><strong>ステータスの色分け:</strong> 計画(青)・製造中(オレンジ)・完了(緑)が一目でわかります。</li>
                            <li><strong>イベントの追加:</strong> カレンダー上の「＋」ボタンから、会議や清掃、来客予定などを自由に書き込めます。</li>
                            <li><strong>印刷機能:</strong> 右上の「予定表を印刷」ボタンを押すと、メニューなどが消え、<strong>白黒印刷で綺麗にA4用紙に収まる専用レイアウト</strong>で印刷されます。毎朝印刷して現場に掲示する運用を推奨します。</li>
                        </ul>
                    </section>

                </div>
            </div>
        </div>
    );
}