"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Flame, Clock, Download, Crown, Medal, Star, MapPin, RefreshCw } from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
    LineChart, Line,
} from "recharts"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { usePrefetchStore } from "@/stores/prefetch-store"
import {
    getMonthlyRevenue, getCategoryRevenue, getZoneHeatmap,
    getHourlyHeatmap, getStaffLeaderboard, getAnalyticsSummary,
    getExportData,
    type MonthlyRevenue, type CategoryRevenue, type ZoneHeatmap,
    type HourlyHeatmap, type StaffLeaderboard, type AnalyticsSummary,
} from "@/actions/analytics"
import {
    getWeeklyRevenue, getTopProducts, getHourlyData, getPaymentBreakdown,
    type DailyRevenue, type TopProduct, type HourlyData, type PaymentBreakdown,
} from "@/actions/reports"

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n) }
function fmtK(n: number) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return String(Math.round(n))
}

const CHART_COLORS = {
    revenue: "#166534",
    profit: "#15803d",
    orders: "#b45309",
    primary: "#166534",
    secondary: "#7c2d12",
    accent: "#b45309",
}

type TabId = "overview" | "revenue" | "products" | "zones" | "staff"
const TABS: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Tổng quan", icon: BarChart3 },
    { id: "revenue", label: "Doanh thu", icon: DollarSign },
    { id: "products", label: "Sản phẩm", icon: ShoppingCart },
    { id: "zones", label: "Khu vực", icon: MapPin },
    { id: "staff", label: "Nhân viên", icon: Users },
]

// ============================================================
// MAIN PAGE
// ============================================================
export type AnalyticsInitialData = {
    sum: AnalyticsSummary; mon: MonthlyRevenue[]; cat: CategoryRevenue[];
    zone: ZoneHeatmap[]; hour: HourlyHeatmap[]; stf: StaffLeaderboard[];
    wRev: DailyRevenue[]; topP: TopProduct[]; hData: HourlyData[]; pay: PaymentBreakdown[];
}

export function AnalyticsClient({ initialData }: { initialData: AnalyticsInitialData }) {
    const [activeTab, setActiveTab] = useState<TabId>("overview")
    const [summary, setSummary] = useState<AnalyticsSummary>(initialData.sum)
    const [monthly, setMonthly] = useState<MonthlyRevenue[]>(initialData.mon)
    const [categories, setCategories] = useState<CategoryRevenue[]>(initialData.cat)
    const [zones, setZones] = useState<ZoneHeatmap[]>(initialData.zone)
    const [hourly, setHourly] = useState<HourlyHeatmap[]>(initialData.hour)
    const [staff, setStaff] = useState<StaffLeaderboard[]>(initialData.stf)
    const [weeklyRev, setWeeklyRev] = useState<DailyRevenue[]>(initialData.wRev)
    const [topProducts, setTopProducts] = useState<TopProduct[]>(initialData.topP)
    const [hourlyData, setHourlyData] = useState<HourlyData[]>(initialData.hData)
    const [payments, setPayments] = useState<PaymentBreakdown[]>(initialData.pay)
    const [refreshing, setRefreshing] = useState(false)

    const applyData = useCallback((d: AnalyticsInitialData) => {
        setSummary(d.sum); setMonthly(d.mon); setCategories(d.cat)
        setZones(d.zone); setHourly(d.hour); setStaff(d.stf)
        setWeeklyRev(d.wRev); setTopProducts(d.topP)
        setHourlyData(d.hData); setPayments(d.pay)
    }, [])

    const fetchFromServer = useCallback(async () => {
        const { getAnalyticsInitialData } = await import("@/actions/analytics-loader")
        return getAnalyticsInitialData()
    }, [])

    const loadData = useCallback(async () => {
        setRefreshing(true)
        try {
            const data = await fetchFromServer()
            applyData(data)
            usePrefetchStore.getState().set("analytics:all", data)
        } catch (e) {
            console.error("Analytics refresh error:", e)
        }
        setRefreshing(false)
    }, [fetchFromServer, applyData])

    useEffect(() => {
        // Cache the SSR data for instant navigation back
        const store = usePrefetchStore.getState()
        store.set("analytics:all", initialData)
        store.registerPrefetch("analytics:all", fetchFromServer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleExport = async (type: "revenue" | "products" | "staff" | "orders") => {
        const data = await getExportData(type)
        const csv = convertToCSV(data as Record<string, unknown>[])
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `noonnoir-${type}-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="min-h-screen bg-cream-50">
            {/* Header */}
            <div className="border-b border-cream-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Phân tích</h1>
                            <p className="text-xs text-cream-400 flex items-center gap-1">
                                Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleExport("orders")}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cream-200 bg-white text-xs font-medium text-green-900 hover:bg-cream-50 transition-all shadow-sm"
                        >
                            <Download className="h-3.5 w-3.5" /> Xuất CSV
                        </button>
                        <button
                            onClick={loadData}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-800 text-xs font-medium text-cream-50 hover:bg-green-700 transition-all shadow-sm"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Tải lại
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-4 lg:px-6 pb-0 overflow-x-auto scroll-hide-bar">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 lg:px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap",
                                activeTab === id
                                    ? "border-green-700 text-green-900 bg-cream-50"
                                    : "border-transparent text-cream-400 hover:text-green-700 hover:bg-cream-50/50"
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 lg:p-6">
                {activeTab === "overview" && (
                    <OverviewTab
                        summary={summary} monthly={monthly} categories={categories}
                        weeklyRev={weeklyRev} hourlyData={hourlyData} payments={payments}
                        staff={staff} topProducts={topProducts}
                    />
                )}
                {activeTab === "revenue" && (
                    <RevenueTab monthly={monthly} weeklyRev={weeklyRev} hourlyData={hourlyData} payments={payments} onExport={handleExport} />
                )}
                {activeTab === "products" && (
                    <ProductsTab categories={categories} topProducts={topProducts} onExport={handleExport} />
                )}
                {activeTab === "zones" && (
                    <ZonesTab zones={zones} hourly={hourly} />
                )}
                {activeTab === "staff" && (
                    <StaffTab staff={staff} onExport={handleExport} />
                )}
            </div>
        </div>
    )
}

// ============================================================
// TAB: OVERVIEW
// ============================================================
function OverviewTab({
    summary, monthly, categories, weeklyRev, hourlyData, payments, staff, topProducts,
}: {
    summary: AnalyticsSummary; monthly: MonthlyRevenue[]; categories: CategoryRevenue[]
    weeklyRev: DailyRevenue[]; hourlyData: HourlyData[]; payments: PaymentBreakdown[]
    staff: StaffLeaderboard[]; topProducts: TopProduct[]
}) {
    return (
        <div className="space-y-5">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KPICard icon={DollarSign} label="Doanh thu tháng" value={`₫${fmtK(summary.totalRevenue)}`} change={summary.revenueGrowth} color="green" />
                <KPICard icon={ShoppingCart} label="Tổng đơn" value={String(summary.totalOrders)} change={summary.ordersGrowth} color="amber" />
                <KPICard icon={TrendingUp} label="Giá trị TB/đơn" value={`₫${fmtK(summary.avgTicket)}`} color="blue" />
                <KPICard icon={Flame} label="Ngày bán tốt nhất" value={summary.bestDay} sub={`₫${fmtK(summary.bestDayRevenue)}`} color="wine" />
                <KPICard icon={Clock} label="Giờ cao điểm" value={summary.peakHour} sub={`${summary.peakHourOrders} đơn`} color="amber" />
            </div>

            {/* Charts Row 1: Revenue + Category Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                {/* Weekly Revenue Chart */}
                <div className="col-span-2 rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4 flex items-center gap-1.5">
                        Doanh thu 7 ngày gần nhất
                    </h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={weeklyRev} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d5" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b7355" }} />
                            <YAxis tickFormatter={(v) => fmtK(v)} tick={{ fontSize: 10, fill: "#8b7355" }} />
                            <Tooltip
                                contentStyle={{ borderRadius: 12, border: "1px solid #e8e0d5", boxShadow: "0 4px 12px rgba(0,0,0,.08)" }}
                                formatter={(v: number) => [`₫${fmt(v)}`, ""]}
                            />
                            <Bar dataKey="revenue" fill="#166534" radius={[6, 6, 0, 0]} name="Doanh thu" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Category Pie */}
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Doanh thu theo danh mục</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={categories}
                                dataKey="revenue"
                                nameKey="name"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={3}
                                strokeWidth={2}
                                stroke="#fff"
                            >
                                {categories.map((c, i) => (
                                    <Cell key={i} fill={c.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => [`₫${fmt(v)}`, ""]} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2 max-h-[80px] overflow-y-auto">
                        {categories.slice(0, 5).map((c) => (
                            <div key={c.name} className="flex items-center justify-between text-[10px]">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                                    <span className="text-cream-600 truncate max-w-[100px]">{c.name}</span>
                                </span>
                                <span className="font-mono font-bold text-green-800">{c.percentage}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Charts Row 2: Hourly + Payments + Top products */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                {/* Hourly Line */}
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4 flex items-center gap-1.5">
                        Phân bổ theo giờ (hôm nay)
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={hourlyData}>
                            <defs>
                                <linearGradient id="hourGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#166534" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d5" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#8b7355" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#8b7355" }} />
                            <Tooltip formatter={(v: number, name: string) => [name === "orders" ? `${v} đơn` : `₫${fmt(v)}`, ""]} />
                            <Area type="monotone" dataKey="orders" stroke="#166534" fill="url(#hourGradient)" strokeWidth={2} name="orders" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Payment Breakdown donut */}
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Phương thức thanh toán</h3>
                    {payments.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie
                                        data={payments}
                                        dataKey="total"
                                        nameKey="method"
                                        innerRadius={40}
                                        outerRadius={65}
                                        paddingAngle={4}
                                        strokeWidth={2}
                                        stroke="#fff"
                                    >
                                        {payments.map((_, i) => (
                                            <Cell key={i} fill={["#166534", "#1e40af", "#7c2d12", "#b45309"][i] ?? "#6b7280"} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => [`₫${fmt(v)}`, ""]} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1.5 mt-2">
                                {payments.map((p, i) => (
                                    <div key={p.method} className="flex items-center justify-between text-[10px]">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full" style={{ background: ["#166534", "#1e40af", "#7c2d12", "#b45309"][i] ?? "#6b7280" }} />
                                            <span className="text-cream-600">{p.method}</span>
                                        </span>
                                        <span className="font-mono font-bold text-green-800">₫{fmtK(p.total)} ({p.percentage}%)</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-cream-400 text-center py-10">Chưa có dữ liệu thanh toán hôm nay</p>
                    )}
                </div>

                {/* Top Products mini list */}
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4 flex items-center gap-1.5">
                        Top sản phẩm hôm nay
                    </h3>
                    <div className="space-y-2.5">
                        {topProducts.length > 0 ? topProducts.slice(0, 7).map((p, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold shrink-0",
                                    i === 0 ? "bg-amber-100 text-amber-700" :
                                        i === 1 ? "bg-slate-100 text-slate-600" :
                                            i === 2 ? "bg-orange-50 text-orange-600" :
                                                "bg-cream-100 text-cream-500"
                                )}>{i + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-medium text-green-900 truncate">{p.name}</p>
                                    <p className="text-[9px] text-cream-400">{p.quantity} bán · {p.category}</p>
                                </div>
                                <span className="font-mono text-[10px] font-bold text-wine-700 whitespace-nowrap">₫{fmtK(p.revenue)}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-cream-400 text-center py-8">Chưa có dữ liệu</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Staff mini leaderboard */}
            {staff.length > 0 && (
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4 flex items-center gap-1.5">
                        Bảng xếp hạng nhân viên (tháng này)
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {staff.slice(0, 3).map((s, i) => (
                            <div key={s.id} className={cn(
                                "rounded-xl p-4 text-center",
                                i === 0 ? "bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200" :
                                    i === 1 ? "bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200" :
                                        "bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200"
                            )}>
                                <div className="mb-2">
                                    {i === 0 ? <Crown className="h-6 w-6 mx-auto text-amber-500" /> :
                                        i === 1 ? <Medal className="h-6 w-6 mx-auto text-slate-500" /> :
                                            <Star className="h-6 w-6 mx-auto text-orange-500" />}
                                </div>
                                <p className="font-display text-sm font-bold text-green-900">{s.name}</p>
                                <Badge variant="outline" className="text-[9px] mt-1">{s.role}</Badge>
                                <p className="font-mono text-lg font-bold text-green-700 mt-2">₫{fmtK(s.revenue)}</p>
                                <p className="text-[9px] text-cream-400">{s.orders} đơn · TB ₫{fmtK(s.avgTicket)}/đơn</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================
// TAB: REVENUE
// ============================================================
function RevenueTab({
    monthly, weeklyRev, hourlyData, payments, onExport,
}: {
    monthly: MonthlyRevenue[]; weeklyRev: DailyRevenue[]; hourlyData: HourlyData[]
    payments: PaymentBreakdown[]; onExport: (t: "revenue") => void
}) {
    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h2 className="font-display text-lg font-bold text-green-900">Phân tích doanh thu</h2>
                <button onClick={() => onExport("revenue")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cream-200 bg-white text-xs font-medium text-green-900 hover:bg-cream-50 shadow-sm">
                    <Download className="h-3.5 w-3.5" /> Xuất doanh thu
                </button>
            </div>

            {/* Monthly Revenue + Profit Dual Axis */}
            <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Doanh thu & lợi nhuận 6 tháng</h3>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={monthly} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d5" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8b7355" }} />
                        <YAxis yAxisId="left" tickFormatter={(v) => fmtK(v)} tick={{ fontSize: 10, fill: "#8b7355" }} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmtK(v)} tick={{ fontSize: 10, fill: "#8b7355" }} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e8e0d5" }} formatter={(v: number) => [`₫${fmt(v)}`, ""]} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="revenue" fill="#166534" radius={[6, 6, 0, 0]} name="Doanh thu" />
                        <Bar yAxisId="left" dataKey="profit" fill="#15803d" radius={[6, 6, 0, 0]} name="Lợi nhuận" opacity={0.7} />
                        <Line yAxisId="right" type="monotone" dataKey="avgTicket" stroke="#b45309" strokeWidth={2} name="TB/đơn" dot={{ fill: "#b45309", r: 4 }} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Weekly Bar */}
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Doanh thu 7 ngày</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={weeklyRev}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d5" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b7355" }} />
                            <YAxis tickFormatter={(v) => fmtK(v)} tick={{ fontSize: 10, fill: "#8b7355" }} />
                            <Tooltip formatter={(v: number) => [`₫${fmt(v)}`, ""]} />
                            <Bar dataKey="revenue" fill="#166534" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Hourly Area */}
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Phân bổ theo giờ</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={hourlyData}>
                            <defs>
                                <linearGradient id="hourG2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#166534" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d5" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#8b7355" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#8b7355" }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="revenue" stroke="#166534" fill="url(#hourG2)" strokeWidth={2} name="Doanh thu" />
                            <Area type="monotone" dataKey="orders" stroke="#b45309" fill="transparent" strokeWidth={2} strokeDasharray="4 4" name="Đơn hàng" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly Table */}
            <div className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-x-auto">
                <div className="px-5 py-3.5 bg-green-900">
                    <h3 className="text-xs font-bold uppercase text-cream-100">Chi tiết doanh thu 6 tháng</h3>
                </div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-cream-50 border-b border-cream-200">
                            <th className="text-left px-4 py-2.5 font-bold text-cream-500">Tháng</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">Doanh thu</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">Lợi nhuận</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">Đơn hàng</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">TB/đơn</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthly.map((m, i) => (
                            <tr key={m.month} className={cn("border-b border-cream-100 hover:bg-cream-50 transition", i === monthly.length - 1 && "font-bold")}>
                                <td className="px-4 py-2.5 font-medium text-green-900">{m.month}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-green-700">₫{fmt(m.revenue)}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-green-600">₫{fmt(m.profit)}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-cream-600">{m.orders}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-amber-700">₫{fmt(m.avgTicket)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ============================================================
// TAB: PRODUCTS
// ============================================================
function ProductsTab({
    categories, topProducts, onExport,
}: {
    categories: CategoryRevenue[]; topProducts: TopProduct[]; onExport: (t: "products") => void
}) {
    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h2 className="font-display text-lg font-bold text-green-900">Phân tích sản phẩm</h2>
                <button onClick={() => onExport("products")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cream-200 bg-white text-xs font-medium text-green-900 hover:bg-cream-50 shadow-sm">
                    <Download className="h-3.5 w-3.5" /> Xuất sản phẩm
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Category Bar Chart */}
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Doanh thu theo danh mục</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={categories} layout="vertical" barCategoryGap="15%">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d5" horizontal={false} />
                            <XAxis type="number" tickFormatter={(v) => fmtK(v)} tick={{ fontSize: 10, fill: "#8b7355" }} />
                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#8b7355" }} />
                            <Tooltip formatter={(v: number) => [`₫${fmt(v)}`, ""]} />
                            <Bar dataKey="revenue" radius={[0, 6, 6, 0]} name="Doanh thu">
                                {categories.map((c, i) => (
                                    <Cell key={i} fill={c.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Category Pie Full */}
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Tỷ trọng danh mục</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={categories} dataKey="revenue" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={3} strokeWidth={2} stroke="#fff">
                                {categories.map((c, i) => (<Cell key={i} fill={c.color} />))}
                            </Pie>
                            <Tooltip formatter={(v: number) => [`₫${fmt(v)}`, ""]} />
                            <Legend formatter={(value) => <span className="text-[10px]">{value}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Products Table */}
            <div className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-x-auto">
                <div className="px-5 py-3.5 bg-green-900">
                    <h3 className="text-xs font-bold uppercase text-cream-100">Top sản phẩm bán chạy (hôm nay)</h3>
                </div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-cream-50 border-b border-cream-200">
                            <th className="text-left px-4 py-2.5 font-bold text-cream-500">#</th>
                            <th className="text-left px-4 py-2.5 font-bold text-cream-500">Sản phẩm</th>
                            <th className="text-left px-4 py-2.5 font-bold text-cream-500">Danh mục</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">SL bán</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">Doanh thu</th>
                        </tr>
                    </thead>
                    <tbody>
                        {topProducts.map((p, i) => (
                            <tr key={i} className="border-b border-cream-100 hover:bg-cream-50 transition">
                                <td className="px-4 py-2">
                                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold",
                                        i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : "bg-cream-100 text-cream-500"
                                    )}>{i + 1}</span>
                                </td>
                                <td className="px-4 py-2 font-medium text-green-900">{p.name}</td>
                                <td className="px-4 py-2"><Badge variant="outline" className="text-[9px]">{p.category}</Badge></td>
                                <td className="px-4 py-2 text-right font-mono">{p.quantity}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-green-700">₫{fmt(p.revenue)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ============================================================
// TAB: ZONES
// ============================================================
function ZonesTab({ zones, hourly }: { zones: ZoneHeatmap[]; hourly: HourlyHeatmap[] }) {
    return (
        <div className="space-y-5">
            <h2 className="font-display text-lg font-bold text-green-900">Phân tích khu vực & thời gian</h2>

            {/* Zone Cards with Table Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {zones.map((zone) => (
                    <div key={zone.zoneId} className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                            <h3 className="font-display text-sm font-bold text-green-900">{zone.zoneName}</h3>
                            <div className="text-right">
                                <p className="font-mono text-sm font-bold text-green-700">₫{fmtK(zone.totalRevenue)}</p>
                                <p className="text-[9px] text-cream-400">{zone.totalOrders} đơn</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {zone.tables.map((table) => (
                                <div
                                    key={table.tableId}
                                    className="rounded-lg p-2.5 text-center border transition"
                                    style={{
                                        backgroundColor: `rgba(22, 101, 52, ${table.heatLevel / 100 * 0.25 + 0.03})`,
                                        borderColor: `rgba(22, 101, 52, ${table.heatLevel / 100 * 0.4 + 0.1})`,
                                    }}
                                >
                                    <p className="text-[10px] font-bold text-green-900">{table.tableNumber}</p>
                                    <p className="font-mono text-[9px] text-green-700">₫{fmtK(table.revenue)}</p>
                                    <p className="text-[8px] text-cream-400">{table.orders} đơn</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Hourly Heatmap Grid */}
            <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Biểu đồ nhiệt: Ngày × Giờ (7 ngày)</h3>
                <div className="overflow-x-auto">
                    <div className="inline-block min-w-full">
                        {/* Hour headers */}
                        <div className="flex gap-1 mb-1 pl-12">
                            {Array.from({ length: 14 }, (_, i) => 10 + i).map((h) => (
                                <div key={h} className="w-10 text-center text-[8px] font-bold text-cream-400">{h}h</div>
                            ))}
                        </div>
                        {/* Day rows */}
                        {hourly.map((day) => (
                            <div key={day.day} className="flex gap-1 mb-1 items-center">
                                <div className="w-12 text-[10px] font-bold text-cream-500 text-right pr-2">{day.day}</div>
                                {day.hours.map((h) => (
                                    <div
                                        key={h.hour}
                                        className="w-10 h-8 rounded flex items-center justify-center text-[8px] font-mono font-bold transition"
                                        style={{
                                            backgroundColor: h.intensity > 0
                                                ? `rgba(22, 101, 52, ${h.intensity / 100 * 0.7 + 0.05})`
                                                : "rgba(0,0,0,0.02)",
                                            color: h.intensity > 50 ? "#fff" : "#8b7355",
                                        }}
                                        title={`${day.day} ${h.hour}h: ${h.orders} đơn, ₫${fmt(h.revenue)}`}
                                    >
                                        {h.orders > 0 ? h.orders : ""}
                                    </div>
                                ))}
                            </div>
                        ))}
                        {/* Legend */}
                        <div className="flex items-center gap-2 mt-3 pl-12">
                            <span className="text-[8px] text-cream-400">Ít</span>
                            {[10, 30, 50, 70, 90].map((v) => (
                                <div key={v} className="w-6 h-3 rounded" style={{ backgroundColor: `rgba(22, 101, 52, ${v / 100 * 0.7 + 0.05})` }} />
                            ))}
                            <span className="text-[8px] text-cream-400">Nhiều</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// TAB: STAFF
// ============================================================
function StaffTab({ staff, onExport }: { staff: StaffLeaderboard[]; onExport: (t: "staff") => void }) {
    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h2 className="font-display text-lg font-bold text-green-900">Hiệu suất nhân viên</h2>
                <button onClick={() => onExport("staff")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cream-200 bg-white text-xs font-medium text-green-900 hover:bg-cream-50 shadow-sm">
                    <Download className="h-3.5 w-3.5" /> Xuất nhân viên
                </button>
            </div>

            {/* Podium */}
            {staff.length >= 3 && (
                <div className="flex flex-col lg:flex-row justify-center items-center lg:items-end gap-4 py-4">
                    {/* 2nd place */}
                    <div className="text-center w-40">
                        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-5">
                            <p className="font-display text-sm font-bold text-green-900">{staff[1].name}</p>
                            <Badge variant="outline" className="text-[9px] mt-1">{staff[1].role}</Badge>
                            <p className="font-mono text-xl font-bold text-green-700 mt-3">₫{fmtK(staff[1].revenue)}</p>
                            <p className="text-[9px] text-cream-400 mt-1">{staff[1].orders} đơn</p>
                        </div>
                        <div className="h-20 bg-slate-100 rounded-b-xl -mt-2 flex items-center justify-center">
                            <span className="font-display text-3xl font-bold text-slate-400">2</span>
                        </div>
                    </div>

                    {/* 1st place */}
                    <div className="text-center w-44 -mb-4">
                        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 p-6 shadow-lg relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <Crown className="h-7 w-7 text-amber-500 drop-shadow-md" />
                            </div>
                            <div className="mt-2">
                                <p className="font-display text-base font-bold text-green-900">{staff[0].name}</p>
                                <Badge className="text-[9px] mt-1 bg-amber-200 text-amber-800">{staff[0].role}</Badge>
                                <p className="font-mono text-2xl font-bold text-green-700 mt-3">₫{fmtK(staff[0].revenue)}</p>
                                <p className="text-[9px] text-cream-400 mt-1">{staff[0].orders} đơn · TB ₫{fmtK(staff[0].avgTicket)}</p>
                            </div>
                        </div>
                        <div className="h-28 bg-amber-100 rounded-b-xl -mt-2 flex items-center justify-center">
                            <span className="font-display text-4xl font-bold text-amber-400">1</span>
                        </div>
                    </div>

                    {/* 3rd place */}
                    <div className="text-center w-40">
                        <div className="rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 p-5">
                            <p className="font-display text-sm font-bold text-green-900">{staff[2].name}</p>
                            <Badge variant="outline" className="text-[9px] mt-1">{staff[2].role}</Badge>
                            <p className="font-mono text-xl font-bold text-green-700 mt-3">₫{fmtK(staff[2].revenue)}</p>
                            <p className="text-[9px] text-cream-400 mt-1">{staff[2].orders} đơn</p>
                        </div>
                        <div className="h-14 bg-orange-100 rounded-b-xl -mt-2 flex items-center justify-center">
                            <span className="font-display text-3xl font-bold text-orange-400">3</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Table */}
            <div className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-x-auto">
                <div className="px-5 py-3.5 bg-green-900">
                    <h3 className="text-xs font-bold uppercase text-cream-100">Bảng xếp hạng đầy đủ</h3>
                </div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-cream-50 border-b border-cream-200">
                            <th className="text-left px-4 py-2.5 font-bold text-cream-500">#</th>
                            <th className="text-left px-4 py-2.5 font-bold text-cream-500">Nhân viên</th>
                            <th className="text-left px-4 py-2.5 font-bold text-cream-500">Vai trò</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">Đơn hàng</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">Doanh thu</th>
                            <th className="text-right px-4 py-2.5 font-bold text-cream-500">TB/đơn</th>
                            <th className="text-left px-4 py-2.5 font-bold text-cream-500">Top SP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.map((s) => (
                            <tr key={s.id} className="border-b border-cream-100 hover:bg-cream-50 transition">
                                <td className="px-4 py-2">
                                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold",
                                        s.rank === 1 ? "bg-amber-100 text-amber-700" : s.rank === 2 ? "bg-slate-100 text-slate-600" : s.rank === 3 ? "bg-orange-50 text-orange-600" : "bg-cream-100 text-cream-500"
                                    )}>{s.rank}</span>
                                </td>
                                <td className="px-4 py-2 font-medium text-green-900">{s.name}</td>
                                <td className="px-4 py-2"><Badge variant="outline" className="text-[9px]">{s.role}</Badge></td>
                                <td className="px-4 py-2 text-right font-mono">{s.orders}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-green-700">₫{fmt(s.revenue)}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700">₫{fmt(s.avgTicket)}</td>
                                <td className="px-4 py-2 text-cream-500 truncate max-w-[120px]">{s.topProduct}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Staff Revenue Chart */}
            {staff.length > 0 && (
                <div className="rounded-xl border border-cream-200 bg-white shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase text-cream-400 mb-4">Doanh thu theo nhân viên</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={staff} layout="vertical" barCategoryGap="15%">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d5" horizontal={false} />
                            <XAxis type="number" tickFormatter={(v) => fmtK(v)} tick={{ fontSize: 10, fill: "#8b7355" }} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#8b7355" }} />
                            <Tooltip formatter={(v: number) => [`₫${fmt(v)}`, ""]} />
                            <Bar dataKey="revenue" fill="#166534" radius={[0, 6, 6, 0]} name="Doanh thu" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function KPICard({
    icon: Icon, label, value, change, sub, color,
}: {
    icon: typeof TrendingUp; label: string; value: string; change?: number; sub?: string
    color: "green" | "amber" | "blue" | "wine"
}) {
    const colorMap = {
        green: "from-green-50 to-green-100 border-green-200",
        amber: "from-amber-50 to-amber-100 border-amber-200",
        blue: "from-blue-50 to-blue-100 border-blue-200",
        wine: "from-rose-50 to-rose-100 border-rose-200",
    }
    const iconColor = {
        green: "text-green-700", amber: "text-amber-700", blue: "text-blue-700", wine: "text-wine-700",
    }
    return (
        <div className={cn("rounded-xl p-4 border bg-gradient-to-br shadow-sm", colorMap[color])}>
            <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-cream-500">{label}</span>
            </div>
            <div className="flex items-end gap-2">
                <p className={cn("font-mono text-xl font-bold", iconColor[color])}>{value}</p>
                {change !== undefined && (
                    <Badge className={cn("text-[8px] font-bold mb-0.5", change >= 0 ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-600 border-red-300")}>
                        {change >= 0 ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                        {change >= 0 ? "+" : ""}{change}%
                    </Badge>
                )}
            </div>
            {sub && <p className="text-[9px] text-cream-400 mt-1">{sub}</p>}
        </div>
    )
}

// CSV Export helper
function convertToCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) return ""
    const headers = Object.keys(data[0])
    const rows = data.map((row) => headers.map((h) => `"${String(row[h] ?? "")}"`).join(","))
    return [headers.join(","), ...rows].join("\n")
}
