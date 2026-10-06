"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { usePrefetchStore } from "@/stores/prefetch-store"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Banknote, CreditCard, QrCode, ChevronLeft, ChevronRight, AlertTriangle, Package, ArrowUpRight, ArrowDownRight, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ReportsInlineSkeleton } from "@/components/inline-skeletons"
import {
    getPnLSummary,
    getWeeklyPnL,
    type PnLSummary,
    type DailyPnL,
} from "@/actions/daily-pnl"
import {
    getCOGSRecords,
    getCOGSSummary,
    getFinanceSummary,
    getExpenseBreakdown,
    getCOGSByProduct,
    type COGSRecord,
    type FinanceSummary,
    type ExpenseCategory,
} from "@/actions/finance"

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n) }
function fmtK(n: number) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return String(n)
}

type MainTab = "pnl" | "finance"

export type ReportsPnlData = { s: PnLSummary; w: DailyPnL[] }
export type ReportsFinanceData = {
    records: COGSRecord[]; summary: Awaited<ReturnType<typeof getCOGSSummary>>;
    finance: FinanceSummary; exp: ExpenseCategory[]; products: Awaited<ReturnType<typeof getCOGSByProduct>>;
}

export function ReportsClient({
    initialPnlData, initialFinanceData,
}: {
    initialPnlData: ReportsPnlData; initialFinanceData: ReportsFinanceData;
}) {
    const [mainTab, setMainTab] = useState<MainTab>("pnl")

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Lãi Lỗ (P&L)</h1>
                        <p className="text-sm text-cream-500">Báo cáo lãi lỗ & phân tích tài chính</p>
                    </div>
                </div>
            </div>

            {/* Main Tab Switch */}
            <div className="flex gap-1 rounded-lg bg-cream-200 p-0.5 w-fit">
                {([
                    { key: "pnl" as MainTab, label: "P&L hàng ngày", desc: "Lãi lỗ theo ngày" },
                    { key: "finance" as MainTab, label: "Giá vốn & Chi phí", desc: "COGS, biên LN" },
                ]).map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setMainTab(t.key)}
                        className={cn(
                            "rounded-md px-4 py-2 text-xs font-semibold transition-all",
                            mainTab === t.key
                                ? "bg-green-900 text-cream-50 shadow-sm"
                                : "text-cream-500 hover:text-cream-700"
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {mainTab === "pnl" && <DailyPnLView initialData={initialPnlData} />}
            {mainTab === "finance" && <FinanceView initialData={initialFinanceData} />}
        </div>
    )
}

// ============================================================
// TAB 1: DAILY P&L VIEW (from old Reports page)
// ============================================================

function DailyPnLView({ initialData }: { initialData: ReportsPnlData }) {
    const [summary, setSummary] = useState<PnLSummary>(initialData.s)
    const [weekData, setWeekData] = useState<DailyPnL[]>(initialData.w)
    const [selectedDay, setSelectedDay] = useState(0)

    useEffect(() => {
        const store = usePrefetchStore.getState()
        store.set("reports:pnl", initialData)
        store.registerPrefetch("reports:pnl", async () => {
            const [s, w] = await Promise.all([getPnLSummary(), getWeeklyPnL()])
            return { s, w }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const day = weekData[selectedDay] ?? null

    if (!day) return <ReportsInlineSkeleton />

    const isToday = selectedDay === 0
    const dateStr = new Date(day.date).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

    return (
        <div className="space-y-5">
            {/* Day selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedDay(Math.min(selectedDay + 1, weekData.length - 1))} className="p-1.5 rounded-lg hover:bg-cream-200 text-cream-500 transition-all">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-center min-w-[200px]">
                        <p className="text-sm font-bold text-green-900">{isToday ? "Hôm nay" : dateStr}</p>
                        <p className="text-[10px] text-cream-400">{day.date}</p>
                    </div>
                    <button onClick={() => setSelectedDay(Math.max(selectedDay - 1, 0))} disabled={selectedDay === 0} className="p-1.5 rounded-lg hover:bg-cream-200 text-cream-500 transition-all disabled:opacity-30">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Comparison KPIs (only show for today) */}
            {isToday && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        label="Doanh thu"
                        value={`₫${fmtK(summary.today.revenue)}`}
                        change={summary.revenueChangeVsYesterday}
                        sub={`TB tuần: ₫${fmtK(summary.weekAvg.revenue)}`}
                        icon={<DollarSign className="h-4 w-4" />}
                        color="green"
                    />
                    <StatCard
                        label="Lợi nhuận ròng"
                        value={`₫${fmtK(summary.today.netProfit)}`}
                        change={summary.profitChangeVsYesterday}
                        sub={`Margin: ${summary.today.netMargin}%`}
                        icon={<TrendingUp className="h-4 w-4" />}
                        color="blue"
                    />
                    <StatCard
                        label="Đơn hàng"
                        value={String(summary.today.orderCount)}
                        sub={`TB: ₫${fmtK(summary.today.avgOrderValue)}/đơn`}
                        icon={<ShoppingCart className="h-4 w-4" />}
                        color="amber"
                    />
                    <StatCard
                        label="Hao hụt"
                        value={`₫${fmtK(summary.today.wasteAndSpoilage)}`}
                        sub={summary.today.wasteAndSpoilage > 0 ? "Cần xem lại" : "Không hao hụt ✓"}
                        icon={<AlertTriangle className="h-4 w-4" />}
                        color={summary.today.wasteAndSpoilage > 0 ? "red" : "green"}
                    />
                </div>
            )}

            {/* Main P&L waterfall */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                {/* LEFT: P&L Breakdown */}
                <div className="col-span-2 rounded-xl border border-cream-200 bg-white shadow-sm">
                    <div className="px-5 py-3.5 border-b border-cream-200">
                        <h2 className="text-sm font-bold text-green-900">Bảng P&L — {isToday ? "Hôm nay" : new Date(day.date).toLocaleDateString("vi-VN")}</h2>
                    </div>

                    <div className="p-5 space-y-1">
                        <PnLRow label="Doanh thu (Revenue)" value={day.revenue} accent="green" bold />
                        <PnLRow label="Giá vốn (COGS)" value={-day.costOfGoods} accent="red" indent />
                        <div className="border-t border-cream-200 my-1.5" />
                        <PnLRow label="Lợi nhuận gộp (Gross Profit)" value={day.grossProfit} accent="green" bold />
                        <div className="flex justify-end"><Badge className="text-[8px] bg-green-100 text-green-700 border-green-300">Margin {day.grossMargin}%</Badge></div>

                        <div className="border-t border-cream-200 my-2" />

                        <p className="text-[9px] font-bold uppercase text-cream-400 pt-1">CHI PHÍ VẬN HÀNH</p>
                        {day.expenses.map((group) => (
                            <div key={group.category}>
                                <PnLRow label={group.category} value={-group.amount} accent="red" indent />
                                {group.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between pl-10 py-0.5">
                                        <span className="text-[10px] text-cream-400 flex items-center gap-1">{item.description}</span>
                                        <span className="text-[10px] font-mono text-cream-400">-₫{fmt(item.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        ))}

                        <div className="border-t border-cream-200 my-1.5" />
                        <PnLRow label="Tổng chi phí (Total Expenses)" value={-day.totalExpenses} accent="red" bold />

                        <div className="border-t-2 border-green-300 my-2" />

                        <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-green-50 border border-green-200">
                            <span className="text-sm font-bold text-green-900">LỢI NHUẬN RÒNG (Net Profit)</span>
                            <div className="text-right">
                                <span className={cn("font-mono text-xl font-bold", day.netProfit >= 0 ? "text-green-700" : "text-red-600")}>
                                    ₫{fmt(day.netProfit)}
                                </span>
                                <p className="text-[9px] text-green-600">Net margin: {day.netMargin}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Supporting data */}
                <div className="space-y-4">
                    {/* Payment Breakdown */}
                    <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-4">
                        <h3 className="text-[10px] font-bold uppercase text-cream-400 mb-3">PHƯƠNG THỨC THANH TOÁN</h3>
                        <div className="space-y-2">
                            <PaymentRow icon={<Banknote className="h-3.5 w-3.5 text-green-600" />} label="Tiền mặt" value={day.paymentBreakdown.cash} total={day.revenue} color="green" />
                            <PaymentRow icon={<CreditCard className="h-3.5 w-3.5 text-blue-600" />} label="Thẻ" value={day.paymentBreakdown.card} total={day.revenue} color="blue" />
                            <PaymentRow icon={<QrCode className="h-3.5 w-3.5 text-wine-600" />} label="QR Pay" value={day.paymentBreakdown.qr} total={day.revenue} color="wine" />
                        </div>
                    </div>

                    {/* Top Products */}
                    <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-4">
                        <h3 className="text-[10px] font-bold uppercase text-cream-400 mb-3">TOP SẢN PHẨM</h3>
                        <div className="space-y-2">
                            {day.topProducts.slice(0, 5).map((p, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn(
                                            "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
                                            i === 0 ? "bg-amber-100 text-amber-700" :
                                                i === 1 ? "bg-slate-100 text-slate-600" :
                                                    "bg-cream-100 text-cream-500"
                                        )}>{i + 1}</span>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-medium text-green-900 truncate">{p.name}</p>
                                            <p className="text-[9px] text-cream-400">{p.qty} sold</p>
                                        </div>
                                    </div>
                                    <span className="font-mono text-[11px] font-bold text-wine-700 whitespace-nowrap ml-2">₫{fmtK(p.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Weekly mini chart */}
                    <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-4">
                        <h3 className="text-[10px] font-bold uppercase text-cream-400 mb-3 flex items-center gap-1">BIỂU ĐỒ 7 NGÀY</h3>
                        <div className="space-y-1.5">
                            {weekData.map((d, i) => {
                                const maxRev = Math.max(...weekData.map((dd) => dd.revenue))
                                const pct = maxRev > 0 ? (d.revenue / maxRev) * 100 : 0
                                const dayLabel = new Date(d.date).toLocaleDateString("vi-VN", { weekday: "short", day: "numeric" })
                                return (
                                    <button
                                        key={d.date}
                                        onClick={() => setSelectedDay(i)}
                                        className={cn("w-full flex items-center gap-2 rounded-lg py-1 px-1.5 transition-all", selectedDay === i ? "bg-green-50 ring-1 ring-green-300" : "hover:bg-cream-50")}
                                    >
                                        <span className="text-[9px] w-14 text-left text-cream-500 font-medium">{dayLabel}</span>
                                        <div className="flex-1 h-3 rounded-full bg-cream-100 overflow-x-auto">
                                            <div
                                                className={cn("h-full rounded-full transition-all", d.netProfit > 0 ? "bg-green-400" : "bg-red-400")}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="font-mono text-[9px] font-bold text-green-700 w-12 text-right">₫{fmtK(d.revenue)}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// TAB 2: FINANCE VIEW (merged from old Finance page)
// ============================================================

type FinanceTab = "overview" | "cogs" | "products"

function FinanceView({ initialData }: { initialData: ReportsFinanceData }) {
    const [tab, setTab] = useState<FinanceTab>("overview")
    const [cogsRecords] = useState<COGSRecord[]>(initialData.records)
    const [cogsSummary] = useState(initialData.summary)
    const [financeSummary] = useState<FinanceSummary>(initialData.finance)
    const [expenses] = useState<ExpenseCategory[]>(initialData.exp)
    const [productCOGS] = useState(initialData.products)

    useEffect(() => {
        const store = usePrefetchStore.getState()
        store.set("reports:finance", initialData)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const TH = "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-cream-400 bg-cream-50 border-b border-cream-200 whitespace-nowrap"
    const THR = cn(TH, "text-right")
    const THC = cn(TH, "text-center")
    const TD = "px-3 py-3 text-xs text-green-900 border-b border-cream-100 whitespace-nowrap"
    const TDR = cn(TD, "text-right font-mono")
    const TDC = cn(TD, "text-center")

    return (
        <div className="space-y-5">
            {/* KPI Cards */}
            {financeSummary && cogsSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    <FinanceStatCard label="Doanh thu" value={`₫${fmtK(financeSummary.totalRevenue ?? 0)}`} sub="Tháng này" color="text-green-700" icon={TrendingUp} accent="bg-green-100" />
                    <FinanceStatCard label="Giá vốn (COGS)" value={`₫${fmtK(financeSummary.totalCOGS ?? 0)}`} sub="FIFO method" color="text-wine-700" icon={Package} accent="bg-wine-100" />
                    <FinanceStatCard label="Lợi nhuận gộp" value={`₫${fmtK(financeSummary.grossProfit ?? 0)}`} sub={`GM: ${financeSummary.grossMargin ?? 0}%`} color="text-green-600" icon={ArrowUpRight} accent="bg-green-100" />
                    <FinanceStatCard label="Chi phí vận hành" value={`₫${fmtK(financeSummary.operatingExpenses ?? 0)}`} sub="Nhân sự, mặt bằng..." color="text-blue-600" icon={Layers} accent="bg-blue-100" />
                    <FinanceStatCard label="Khấu hao CCDC" value={`₫${fmtK(financeSummary.depreciationExpense ?? 0)}`} sub="Tháng này" color="text-amber-600" icon={TrendingDown} accent="bg-amber-100" />
                    <FinanceStatCard
                        label="Lợi nhuận ròng" value={`₫${fmtK(financeSummary.netProfit ?? 0)}`}
                        sub={`NM: ${financeSummary.netMargin ?? 0}%`}
                        color={(financeSummary.netProfit ?? 0) >= 0 ? "text-green-700" : "text-red-600"}
                        icon={(financeSummary.netProfit ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
                        accent={(financeSummary.netProfit ?? 0) >= 0 ? "bg-green-100" : "bg-red-100"}
                    />
                </div>
            )}

            {/* Sub Tab Switch */}
            <div className="flex gap-1 rounded-lg bg-cream-200 p-0.5 w-fit">
                {([
                    { key: "overview" as FinanceTab, label: "Tổng quan P&L" },
                    { key: "cogs" as FinanceTab, label: "Chi tiết COGS" },
                    { key: "products" as FinanceTab, label: "Biên LN sản phẩm" },
                ]).map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-all", tab === t.key ? "bg-green-900 text-cream-50 shadow-sm" : "text-cream-500 hover:text-cream-700")}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ═══ P&L OVERVIEW ═══ */}
            {tab === "overview" && financeSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
                    {/* P&L Statement */}
                    <div className="col-span-3 rounded-xl border border-cream-200 bg-white p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-green-900 mb-4 flex items-center gap-2">
                            Báo cáo Lãi / Lỗ — Tháng này
                        </h3>
                        <div className="space-y-0.5">
                            <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-2.5">
                                <span className="text-xs font-bold text-green-900">Doanh thu thuần</span>
                                <span className="font-mono text-sm font-bold text-green-700">₫{fmt(financeSummary.totalRevenue ?? 0)}</span>
                            </div>
                            <div className="flex items-center justify-between px-4 py-2">
                                <span className="text-xs text-cream-500 pl-4">(-) Giá vốn hàng bán (COGS - FIFO)</span>
                                <span className="font-mono text-xs text-red-600">-₫{fmt(financeSummary.totalCOGS ?? 0)}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-cream-50 border border-cream-200 px-4 py-2.5">
                                <span className="text-xs font-bold text-green-900">
                                    Lợi nhuận gộp <span className="ml-1 text-[10px] text-cream-400 font-normal">({financeSummary.grossMargin ?? 0}%)</span>
                                </span>
                                <span className="font-mono text-sm font-bold text-green-600">₫{fmt(financeSummary.grossProfit ?? 0)}</span>
                            </div>
                            {expenses.filter((e) => e.category !== "Giá vốn hàng bán (COGS)").map((exp) => (
                                <div key={exp.category} className="flex items-center justify-between px-4 py-1.5">
                                    <span className="text-[11px] text-cream-500 pl-4">(-) {exp.category}</span>
                                    <span className="font-mono text-[11px] text-cream-600">-₫{fmt(exp.amount)}</span>
                                </div>
                            ))}
                            <div className={cn(
                                "flex items-center justify-between rounded-lg px-4 py-3 mt-2",
                                (financeSummary.netProfit ?? 0) >= 0 ? "bg-green-100 border border-green-300" : "bg-red-100 border border-red-300"
                            )}>
                                <span className="text-sm font-bold text-green-900">
                                    LỢI NHUẬN RÒNG <span className="ml-1 text-[10px] text-cream-500 font-normal">({financeSummary.netMargin ?? 0}%)</span>
                                </span>
                                <span className={cn("font-mono text-lg font-bold", (financeSummary.netProfit ?? 0) >= 0 ? "text-green-700" : "text-red-600")}>
                                    ₫{fmt(financeSummary.netProfit ?? 0)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Expense Breakdown */}
                    <div className="col-span-2 rounded-xl border border-cream-200 bg-white p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-green-900 mb-4 flex items-center gap-2">
                            Cơ cấu chi phí
                        </h3>
                        <div className="space-y-2.5 mb-4">
                            {expenses.map((exp) => (
                                <div key={exp.category}>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[10px] text-cream-500 truncate max-w-[160px]">{exp.category}</span>
                                        <span className="font-mono text-[10px] font-bold text-cream-600">₫{fmtK(exp.amount)} ({exp.percentage}%)</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${exp.percentage}%`, backgroundColor: exp.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {cogsSummary && (
                            <div className="border-t border-cream-200 pt-3 space-y-2">
                                <h4 className="text-[10px] font-bold text-cream-400 uppercase">COGS Insights</h4>
                                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                                    <div><p className="text-[9px] text-cream-400">Biên cao nhất</p><p className="text-[11px] font-bold text-green-700">{cogsSummary.topMarginProduct}</p></div>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                                    <div><p className="text-[9px] text-cream-400">Biên thấp nhất</p><p className="text-[11px] font-bold text-amber-700">{cogsSummary.lowestMarginProduct}</p></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ COGS DETAIL ═══ */}
            {tab === "cogs" && (
                <div className="rounded-xl border border-cream-200 bg-white overflow-hidden shadow-sm">
                    {cogsRecords.length === 0 ? (
                        <div className="text-center py-12 text-cream-400 text-sm">Chưa có dữ liệu COGS</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className={TH}>Sản phẩm</th>
                                    <th className={THR} style={{ width: 110 }}>Giá bán</th>
                                    <th className={THR} style={{ width: 110 }}>Giá vốn FIFO</th>
                                    <th className={THR} style={{ width: 110 }}>Lợi nhuận gộp</th>
                                    <th className={THC} style={{ width: 80 }}>Biên LN</th>
                                    <th className={THC} style={{ width: 60 }}>SL bán</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cogsRecords.map((record) => {
                                    const margin = record.grossMargin ?? 0
                                    const cls = margin >= 70 ? "bg-green-100 text-green-700"
                                        : margin >= 50 ? "bg-blue-100 text-blue-700"
                                            : margin >= 30 ? "bg-amber-100 text-amber-700"
                                                : "bg-red-100 text-red-700"
                                    return (
                                        <tr key={record.id} className="hover:bg-green-50/50 transition-colors">
                                            <td className={TD}>
                                                <p className="font-medium leading-tight">{record.productName}</p>
                                            </td>
                                            <td className={TDR}>₫{fmt(record.sellingPrice ?? 0)}</td>
                                            <td className={cn(TDR, "text-wine-600")}>₫{fmt(record.fifoCost ?? 0)}</td>
                                            <td className={cn(TDR, "font-bold text-green-600")}>₫{fmt(record.grossProfit)}</td>
                                            <td className={TDC}>
                                                <span className={cn("inline-block rounded-full px-2 py-0.5 text-[9px] font-bold leading-tight", cls)}>{margin}%</span>
                                            </td>
                                            <td className={cn(TDC, "text-cream-600")}>{record.soldQty}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ═══ PRODUCT MARGIN ═══ */}
            {tab === "products" && (
                <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                    {productCOGS.length === 0 ? (
                        <div className="text-center py-12 text-cream-400 text-sm">Chưa có dữ liệu biên lợi nhuận</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className={TH} style={{ width: 24 }}>#</th>
                                    <th className={TH}>Sản phẩm</th>
                                    <th className={THR} style={{ width: 100 }}>Doanh thu</th>
                                    <th className={THR} style={{ width: 100 }}>COGS</th>
                                    <th className={THR} style={{ width: 100 }}>Lợi nhuận</th>
                                    <th className={TH} style={{ width: 130 }}>Mức biên</th>
                                    <th className={THC} style={{ width: 60 }}>SL bán</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productCOGS.map((product: any, idx: number) => {
                                    const mc = product.grossMargin >= 70 ? "text-green-700" : product.grossMargin >= 50 ? "text-blue-700" : product.grossMargin >= 30 ? "text-amber-700" : "text-red-700"
                                    const bc = product.grossMargin >= 70 ? "bg-green-500" : product.grossMargin >= 50 ? "bg-blue-500" : product.grossMargin >= 30 ? "bg-amber-500" : "bg-red-500"
                                    return (
                                        <tr key={product.productName} className="hover:bg-green-50/50 transition-colors">
                                            <td className={cn(TD, "text-cream-400 text-center font-mono")}>{idx + 1}</td>
                                            <td className={cn(TD, "font-medium")}>{product.productName}</td>
                                            <td className={TDR}>₫{fmtK(product.totalRevenue)}</td>
                                            <td className={cn(TDR, "text-wine-600")}>₫{fmtK(product.totalCOGS)}</td>
                                            <td className={cn(TDR, "font-bold text-green-600")}>₫{fmtK(product.grossProfit)}</td>
                                            <td className={TD}>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="flex-1 h-1.5 rounded-full bg-cream-200 overflow-hidden">
                                                        <div className={cn("h-full rounded-full", bc)} style={{ width: `${product.grossMargin}%` }} />
                                                    </div>
                                                    <span className={cn("text-[10px] font-bold min-w-[32px] text-right", mc)}>{product.grossMargin}%</span>
                                                </div>
                                            </td>
                                            <td className={cn(TDC, "text-cream-600")}>{product.totalQty}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    )
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function StatCard({ label, value, change, sub, icon, color }: {
    label: string; value: string; change?: number; sub: string; icon: React.ReactNode; color: string
}) {
    const colorMap: Record<string, string> = {
        green: "text-green-700", blue: "text-blue-700", amber: "text-amber-700", red: "text-red-600",
    }
    return (
        <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
                <span className="text-cream-400">{icon}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">{label}</span>
            </div>
            <div className="flex items-end gap-2">
                <p className={cn("font-mono text-2xl font-bold", colorMap[color])}>{value}</p>
                {change !== undefined && (
                    <Badge className={cn("text-[9px] font-bold mb-1", change >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
                        {change >= 0 ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                        {change >= 0 ? "+" : ""}{change}%
                    </Badge>
                )}
            </div>
            <p className="text-[10px] text-cream-400 mt-1">{sub}</p>
        </div>
    )
}

function FinanceStatCard({ label, value, sub, color, icon: Icon, accent }: { label: string; value: string; sub: string; color: string; icon: typeof DollarSign; accent: string }) {
    return (
        <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">{label}</span>
                <div className={cn("flex h-5 w-5 items-center justify-center rounded-md", accent)}><Icon className="h-3 w-3" /></div>
            </div>
            <p className={cn("font-mono text-xl font-bold leading-none", color)}>{value}</p>
            <p className="text-[9px] text-cream-400 mt-1">{sub}</p>
        </div>
    )
}

function PnLRow({ label, value, accent, bold, indent }: {
    label: string; value: number; accent: "green" | "red"; bold?: boolean; indent?: boolean
}) {
    const negative = value < 0
    return (
        <div className={cn("flex justify-between items-center py-1", indent && "pl-4")}>
            <span className={cn("text-xs", bold ? "font-bold text-green-900" : "text-cream-600")}>{label}</span>
            <span className={cn(
                "font-mono text-xs",
                bold ? "font-bold" : "font-medium",
                accent === "green" ? "text-green-700" : "text-red-600"
            )}>
                {negative ? "-" : ""}₫{fmt(Math.abs(value))}
            </span>
        </div>
    )
}

function PaymentRow({ icon, label, value, total, color }: {
    icon: React.ReactNode; label: string; value: number; total: number; color: string
}) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0
    const barColor: Record<string, string> = { green: "bg-green-400", blue: "bg-blue-400", wine: "bg-wine-400" }
    return (
        <div>
            <div className="flex justify-between items-center mb-0.5">
                <span className="flex items-center gap-1.5 text-[11px]">{icon} {label}</span>
                <span className="font-mono text-[11px] font-bold text-green-900">₫{fmt(value)} <span className="text-cream-400 font-normal">({pct}%)</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-cream-100 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor[color])} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}
