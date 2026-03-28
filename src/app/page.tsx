import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Package, Truck, Calendar } from "lucide-react"

export default function Dashboard() {
  return (
    <>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">ダッシュボード</h1>

      {/* サマリーカードのグリッド配置 (スマホは縦1列、PCは横4列) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* 在庫アラート */}
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-red-800">在庫アラート</CardTitle>
            <AlertCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-700">3 <span className="text-lg font-normal">件</span></div>
            <p className="text-sm text-red-600 mt-2 font-medium">不足: 砂糖, 空缶<br/>注意: 小麦粉</p>
          </CardContent>
        </Card>

        {/* 本日の製造予定 */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-600">本日の製造予定</CardTitle>
            <Package className="h-5 w-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">120 <span className="text-lg font-normal text-slate-600">c/s</span></div>
            <p className="text-sm text-slate-500 mt-2">チョコパン 24缶入 他</p>
          </CardContent>
        </Card>

        {/* 本日の出荷予定 */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-600">本日の出荷予定</CardTitle>
            <Truck className="h-5 w-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">450 <span className="text-lg font-normal text-slate-600">c/s</span></div>
            <p className="text-sm text-slate-500 mt-2">A市役所 向け等 3件</p>
          </CardContent>
        </Card>
      </div>

      {/* お知らせ・受注状況エリア */}
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
        <Calendar className="h-5 w-5 text-blue-600" />
        進行中の受注・お知らせ
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          
          {/* リストアイテム 1 */}
          <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
            <div>
              <div className="font-bold text-lg text-slate-800">B県庁 備蓄パン入れ替え</div>
              <div className="text-sm text-slate-500 mt-1">納品期限: 2026/05/31</div>
            </div>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none px-3 py-1 text-sm w-fit">
              製造中
            </Badge>
          </div>

          {/* リストアイテム 2 */}
          <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
            <div>
              <div className="font-bold text-lg text-slate-800">C病院 新規備蓄</div>
              <div className="text-sm text-slate-500 mt-1">納品期限: 2026/04/15</div>
            </div>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none px-3 py-1 text-sm w-fit">
              未処理 (計画待)
            </Badge>
          </div>

        </div>
      </div>
    </>
  )
}