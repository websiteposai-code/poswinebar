"use client"

import { useState, useEffect } from "react"
import { Wine, ShoppingCart, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Armchair, ChefHat, BarChart3, UtensilsCrossed, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import { usePrefetchStore } from "@/stores/prefetch-store"
import { getDashboardInitialData } from "@/actions/dashboard-loader"
import { DashboardInlineSkeleton } from "@/components/inline-skeletons"

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

function formatCompact(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`
    return String(amount)
}

function formatTime(date: string | Date): string {
    return new Date(date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
}

type DashboardData = Awaited<ReturnType<typeof getDashboardInitialData>>

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
    const { staff } = useAuthStore()
    const [data, setData] = useState<DashboardData>(initialData)

    useEffect(() => {
        // Cache the server-passed data + register for future prefetch
        const store = usePrefetchStore.getState()
        store.set('dashboard', initialData)
        store.registerPrefetch('dashboard', getDashboardInitialData)
    }, [initialData])

    const weeklyRevenue = data?.weeklyRevenue ?? []
    const stats = data?.stats ?? null
    const tableStats = data?.tableStats ?? null
    const recentOrders = data?.recentOrders ?? []
    const maxRevenue = Math.max(...weeklyRevenue.map((d) => d.revenue), 1)
    const greeting = (() => {
        const h = new Date().getHours()
        if (h < 12) return "Chào buổi sáng"
        if (h < 18) return "Chào buổi chiều"
        return "Chào buổi tối"
    })()

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up">
                <div>
                    <h1 className="font-display text-xl lg:text-2xl font-bold text-green-900">
                        {greeting}, {staff?.fullName?.split(" ").pop()}
                    </h1>
                    <p className="text-xs lg:text-sm text-cream-500">
                        {new Date().toLocaleDateString("vi-VN", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                        })}
                    </p>
                </div>
                <Link
                    href="/pos"
                    className="hidden sm:flex items-center gap-2 rounded-xl bg-green-900 px-5 py-2.5 text-sm font-medium text-cream-50 btn-press hover:bg-green-800 hover:shadow-lg"
                >
                    <Wine className="h-4 w-4" />
                    Mở POS
                </Link>
            </div>

            {/* KPI Cards */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                    <KPICard
                        icon={TrendingUp}
                        label="Doanh thu hôm nay"
                        value={stats.todayRevenue > 0 ? `₫${formatCompact(stats.todayRevenue)}` : "—"}
                        change={stats.todayRevenue > 0 ? stats.revenueChange : undefined}
                        subtext={`Hôm qua: ₫${formatCompact(stats.yesterdayRevenue)}`}
                        color="wine"
                    />
                    <KPICard
                        icon={ShoppingCart}
                        label="Số đơn hàng"
                        value={String(stats.todayOrders)}
                        change={stats.ordersChange}
                        subtext={`Hôm qua: ${stats.yesterdayOrders} đơn`}
                        color="green"
                    />
                    <KPICard
                        icon={Clock}
                        label="Giá trị TB / đơn"
                        value={stats.avgOrderValue > 0 ? `₫${formatCompact(stats.avgOrderValue)}` : "—"}
                        subtext={`Thời gian TB: ${stats.avgTimeMinutes}p`}
                        color="amber"
                    />
                    <KPICard
                        icon={Armchair}
                        label="Sử dụng bàn"
                        value={`${stats.tableOccupancy}%`}
                        subtext={tableStats ? `${tableStats.available} bàn trống` : ""}
                        color="blue"
                    />
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Mini Revenue Chart */}
                <div className="lg:col-span-2 rounded-xl border border-cream-300 bg-cream-100 p-4 lg:p-5">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <h3 className="font-display text-sm font-bold text-green-900">
                            Doanh thu 7 ngày
                        </h3>
                        <Link href="/dashboard/reports" className="text-[10px] text-cream-400 hover:text-green-700 flex items-center gap-0.5 transition-all">
                            Chi tiết <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                    </div>
                    <div className="flex items-end gap-1.5 lg:gap-2 h-[120px] lg:h-[140px]">
                        {weeklyRevenue.map((day, i) => {
                            const height = (day.revenue / maxRevenue) * 100
                            const isToday = i === weeklyRevenue.length - 1
                            return (
                                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[7px] lg:text-[8px] font-mono text-cream-500">{formatCompact(day.revenue)}</span>
                                    <div
                                        className={cn(
                                            "w-full rounded-t-lg transition-all",
                                            isToday
                                                ? "bg-gradient-to-t from-wine-600 to-wine-400"
                                                : "bg-gradient-to-t from-green-700 to-green-500"
                                        )}
                                        style={{ height: `${height}%` }}
                                    />
                                    <span className={cn("text-[9px] lg:text-[10px]", isToday ? "font-bold text-wine-700" : "text-cream-500")}>
                                        {day.date}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Table Overview */}
                <div className="rounded-xl border border-cream-300 bg-cream-100 p-4 lg:p-5">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <h3 className="font-display text-sm font-bold text-green-900">Bàn</h3>
                        <Link href="/dashboard/tables" className="text-[10px] text-cream-400 hover:text-green-700 flex items-center gap-0.5 transition-all">
                            Quản lý <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                    </div>
                    {tableStats && (
                        <div className="space-y-3">
                            {[
                                { label: "Trống", count: tableStats.available, total: tableStats.total, color: "bg-green-500" },
                                { label: "Đang dùng", count: tableStats.occupied, total: tableStats.total, color: "bg-wine-500" },
                                { label: "Đặt trước", count: tableStats.reserved, total: tableStats.total, color: "bg-amber-500" },
                                { label: "Dọn dẹp", count: tableStats.cleaning, total: tableStats.total, color: "bg-cream-400" },
                            ].map((item) => (
                                <div key={item.label}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-cream-500">{item.label}</span>
                                        <span className="font-mono font-bold text-green-900">
                                            {item.count}/{item.total}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all", item.color)}
                                            style={{ width: `${item.total > 0 ? (item.count / item.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Orders */}
            <div className="rounded-xl border border-cream-300 bg-cream-100 p-4 lg:p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h3 className="font-display text-sm font-bold text-green-900">
                        Đơn hàng gần đây
                    </h3>
                    <Link href="/pos/orders" className="text-[10px] text-cream-400 hover:text-green-700 flex items-center gap-0.5 transition-all">
                        Xem tất cả <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                </div>
                {recentOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <p className="text-xs text-cream-400">Chưa có đơn hàng hôm nay</p>
                        <Link href="/pos" className="text-[10px] font-medium text-green-700 hover:underline">Mở POS để bắt đầu →</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {recentOrders.map((order) => {
                            const statusColor =
                                order.status === "COMPLETED" ? "text-green-600" :
                                    order.status === "PREPARING" ? "text-orange-600" :
                                        order.status === "PENDING" ? "text-amber-600" :
                                            "text-cream-500"
                            const StatusIcon =
                                order.status === "COMPLETED" ? CheckCircle2 :
                                    order.status === "PREPARING" ? ChefHat :
                                        order.status === "PENDING" ? AlertCircle :
                                            Clock
                            return (
                                <div
                                    key={order.id}
                                    className="flex items-center gap-3 rounded-lg bg-cream-50 px-3 py-2.5"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-[10px] text-cream-400">{order.orderNumber}</span>
                                            <span className="rounded bg-green-900 px-1 py-0.5 text-[8px] font-bold text-cream-50">
                                                {order.tableNumber ?? "TK"}
                                            </span>
                                            <span className="text-[10px] text-cream-400">
                                                {order.items.length} món · {formatTime(order.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="font-mono text-xs font-bold text-green-900 shrink-0">
                                        ₫{formatPrice(order.total)}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "POS Terminal", href: "/pos", icon: Wine, desc: "Bán hàng" },
                    { label: "Kitchen", href: "/pos/kitchen", icon: ChefHat, desc: "Xem bếp" },
                    { label: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed, desc: "Sản phẩm" },
                    { label: "Lãi Lỗ", href: "/dashboard/reports", icon: BarChart3, desc: "P&L" },
                ].map((link) => {
                    const Icon = link.icon
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="flex items-center gap-3 rounded-xl border border-cream-300 bg-cream-100 p-3 transition-all hover:border-green-300 hover:shadow-md group"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700 group-hover:bg-green-900 group-hover:text-cream-50 transition-all">
                                <Icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-green-900">{link.label}</p>
                                <p className="text-[9px] text-cream-400">{link.desc}</p>
                            </div>
                        </Link>
                    )
                })}
            </div>

            {/* Tagline */}
            <p className="text-center font-script text-base text-cream-400 pt-2">
                drink slowly · laugh quietly · stay longer
            </p>
        </div>
    )
}

function KPICard({
    icon: Icon, label, value, change, subtext, color,
}: {
    icon: typeof TrendingUp; label: string; value: string; change?: number; subtext: string
    color: "wine" | "green" | "amber" | "blue"
}) {
    const colorMap = {
        wine: { bg: "bg-wine-50", border: "border-wine-200", text: "text-wine-700", icon: "bg-wine-100 text-wine-600" },
        green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: "bg-green-100 text-green-600" },
        amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "bg-amber-100 text-amber-600" },
        blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "bg-blue-100 text-blue-600" },
    }
    const c = colorMap[color]
    return (
        <div className={cn("rounded-xl border p-3 lg:p-4 card-hover", c.bg, c.border)}>
            <div className="flex items-center justify-between mb-2 lg:mb-3">
                <div className={cn("flex h-7 w-7 lg:h-8 lg:w-8 items-center justify-center rounded-lg icon-hover", c.icon)}>
                    <Icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                </div>
                {change !== undefined && (
                    <span className={cn(
                        "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] lg:text-[10px] font-bold",
                        change >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                        {change >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                        {Math.abs(change)}%
                    </span>
                )}
            </div>
            <p className={cn("font-mono text-xl lg:text-2xl font-bold", c.text)}>{value}</p>
            <p className="text-[9px] lg:text-[10px] text-cream-400 mt-0.5">{label}</p>
            <p className="text-[8px] lg:text-[9px] text-cream-400 mt-1">{subtext}</p>
        </div>
    )
}
