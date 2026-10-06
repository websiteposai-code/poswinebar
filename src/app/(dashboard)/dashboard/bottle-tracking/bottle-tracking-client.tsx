"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Package, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    getAllOpenedBottles,
    getBottleHistory,
    getByGlassDashboardStats,
    type OpenedBottleSummary,
} from "@/actions/wine"
import { toast } from "sonner"

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

export interface BottleTrackingInitialData {
    openedBottles: OpenedBottleSummary[]
    history: Awaited<ReturnType<typeof getBottleHistory>>
    stats: Awaited<ReturnType<typeof getByGlassDashboardStats>>
}

export function BottleTrackingClient({ initial }: { initial: BottleTrackingInitialData }) {
    const [openedBottles, setOpenedBottles] = useState<OpenedBottleSummary[]>(initial.openedBottles)
    const [history, setHistory] = useState<Awaited<ReturnType<typeof getBottleHistory>>>(initial.history)
    const [stats, setStats] = useState<Awaited<ReturnType<typeof getByGlassDashboardStats>> | null>(initial.stats)
    const [loading, setLoading] = useState(false)
    const [historyExpanded, setHistoryExpanded] = useState(false)
    const [historyDays, setHistoryDays] = useState(7)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const [o, h, s] = await Promise.all([
                getAllOpenedBottles(),
                getBottleHistory({ days: historyDays }),
                getByGlassDashboardStats(),
            ])
            setOpenedBottles(o)
            setHistory(h)
            setStats(s)
        } catch (err) {
            console.error("[BottleTracking] refresh failed:", err)
            toast.error("Không thể tải dữ liệu chai")
        }
        setLoading(false)
    }, [historyDays])

    useEffect(() => {
        const interval = setInterval(refresh, 30000)
        return () => clearInterval(interval)
    }, [refresh])

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                <div>
                    <h1 className="text-2xl font-display font-bold text-green-900 flex items-center gap-3">
                        Quản lý bán theo ly
                    </h1>
                    <p className="text-sm text-cream-500 mt-0.5">
                        Theo dõi chai mở, oxy hóa, tốc độ bán & doanh thu
                    </p>
                </div>
                <Button
                    onClick={refresh}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className="border-green-300 text-green-800 hover:bg-green-50"
                >
                    <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {/* Stats Grid */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="rounded-xl border border-wine-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-wine-600 uppercase mb-1">
                            Chai đang mở
                        </div>
                        <p className="text-2xl font-bold text-wine-800">{stats.openedBottles}</p>
                        {stats.expiredBottles > 0 && (
                            <p className="text-[10px] text-red-600 font-bold mt-0.5">
                                {stats.expiredBottles} chai quá hạn oxy hóa
                            </p>
                        )}
                    </div>
                    <div className="rounded-xl border border-green-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-green-600 uppercase mb-1">
                            Tổng ly đã bán
                        </div>
                        <p className="text-2xl font-bold text-green-800">{stats.totalGlassesSold}</p>
                        <p className="text-[10px] text-cream-500 mt-0.5">
                            Từ {stats.bottlesConsumed} chai đã hết
                        </p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase mb-1">
                            Doanh thu by Glass
                        </div>
                        <p className="text-2xl font-bold text-amber-800">₫{formatPrice(stats.totalGlassRevenue)}</p>
                        <p className="text-[10px] text-green-600 font-bold mt-0.5">
                            Lợi nhuận: ₫{formatPrice(stats.profit)}
                        </p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-cream-600 uppercase mb-1">
                            Tốc độ TB
                        </div>
                        <p className="text-2xl font-bold text-green-800">{stats.avgSellSpeedPerHour}</p>
                        <p className="text-[10px] text-cream-500 mt-0.5">ly / giờ / chai</p>
                    </div>
                </div>
            )}

            {/* Currently Opened Bottles */}
            <div className="mb-6">
                <h2 className="text-base font-bold text-green-900 mb-3 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                    Chai đang mở ({openedBottles.length})
                </h2>

                {openedBottles.length === 0 ? (
                    <div className="rounded-xl border border-cream-200 bg-white p-8 text-center">
                        <p className="text-sm text-cream-500">Không có chai nào đang mở</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {openedBottles.map((bottle) => {
                            const oxPct = bottle.maxOxidationHours > 0
                                ? Math.min(100, (bottle.oxidationHours / bottle.maxOxidationHours) * 100)
                                : 0
                            const glassRatio = bottle.glassesTotal > 0
                                ? ((bottle.glassesTotal - bottle.glassesRemaining) / bottle.glassesTotal) * 100
                                : 0

                            return (
                                <div
                                    key={bottle.id}
                                    className={cn(
                                        "rounded-xl border p-4 bg-white transition-all hover:shadow-md",
                                        bottle.isExpired ? "border-red-300 ring-1 ring-red-200" :
                                            oxPct > 70 ? "border-amber-300" : "border-green-200"
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-green-900">{bottle.productName}</h3>
                                            <p className="text-[10px] text-cream-500 font-mono mt-0.5">{bottle.batchCode}</p>
                                        </div>
                                        <div className="text-right">
                                            {bottle.isExpired ? (
                                                <Badge className="bg-red-600 text-white text-[9px]">Quá hạn</Badge>
                                            ) : oxPct > 70 ? (
                                                <Badge className="bg-amber-500 text-white text-[9px]">Cảnh báo</Badge>
                                            ) : (
                                                <Badge className="bg-green-600 text-white text-[9px]">Tốt</Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Glass progress */}
                                    <div className="mb-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-green-800">Ly đã rót</span>
                                            <span className="text-[10px] font-mono text-wine-600 font-bold">
                                                {bottle.glassesPoured}/{bottle.glassesTotal}
                                            </span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-cream-200 overflow-x-auto">
                                            <div className="h-full rounded-full bg-wine-600 transition-all" style={{ width: `${glassRatio}%` }} />
                                        </div>
                                    </div>

                                    {/* Oxidation progress */}
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-cream-600 flex items-center gap-1">
                                                Oxy hóa
                                            </span>
                                            <span className="text-[10px] font-mono text-cream-600">
                                                {bottle.oxidationHours}h / {bottle.maxOxidationHours}h
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all",
                                                    oxPct > 90 ? "bg-red-500" : oxPct > 70 ? "bg-amber-500" : "bg-green-500"
                                                )}
                                                style={{ width: `${Math.min(oxPct, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Metrics */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-cream-200 pt-3">
                                        <div className="text-center">
                                            <p className="font-mono text-lg font-bold text-green-900">{bottle.glassesRemaining}</p>
                                            <p className="text-[9px] text-cream-500">ly còn lại</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-mono text-lg font-bold text-wine-600">
                                                {bottle.sellSpeedPerHour}
                                            </p>
                                            <p className="text-[9px] text-cream-500">ly/giờ</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-mono text-lg font-bold text-amber-700">
                                                {formatPrice(bottle.estimatedRevenueRemaining)}
                                            </p>
                                            <p className="text-[9px] text-cream-500">₫ còn lại</p>
                                        </div>
                                    </div>

                                    {/* Opened by */}
                                    <div className="mt-3 pt-2 border-t border-cream-200">
                                        <p className="text-[9px] text-cream-400">
                                            Mở bởi <span className="font-bold text-cream-600">{bottle.openedByName ?? "—"}</span>
                                            {" · "}
                                            {new Date(bottle.openedAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Bottle History */}
            <div>
                <button
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="w-full flex items-center justify-between mb-3 group"
                >
                    <h2 className="text-base font-bold text-green-900 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Lịch sử chai ({history.length})
                    </h2>
                    {historyExpanded ? <ChevronUp className="h-4 w-4 text-cream-500" /> : <ChevronDown className="h-4 w-4 text-cream-500" />}
                </button>

                {historyExpanded && (
                    <div>
                        {/* Time filter */}
                        <div className="flex gap-2 mb-4">
                            {[7, 14, 30].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setHistoryDays(d)}
                                    className={cn(
                                        "rounded-full px-3 py-1 text-xs font-bold transition-all",
                                        historyDays === d ? "bg-green-900 text-cream-50" : "bg-cream-200 text-cream-600 hover:bg-cream-300"
                                    )}
                                >
                                    {d} ngày
                                </button>
                            ))}
                        </div>

                        <div className="rounded-xl border border-cream-200 bg-white overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-green-900 text-cream-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-[10px] uppercase">Sản phẩm</th>
                                        <th className="px-4 py-2 text-left text-[10px] uppercase">Batch</th>
                                        <th className="px-4 py-2 text-center text-[10px] uppercase">Trạng thái</th>
                                        <th className="px-4 py-2 text-center text-[10px] uppercase">Ly bán</th>
                                        <th className="px-4 py-2 text-center text-[10px] uppercase">Thời gian</th>
                                        <th className="px-4 py-2 text-right text-[10px] uppercase">Doanh thu</th>
                                        <th className="px-4 py-2 text-right text-[10px] uppercase">Lợi nhuận</th>
                                        <th className="px-4 py-2 text-left text-[10px] uppercase">Mở bởi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream-100">
                                    {history.map((h) => (
                                        <tr key={h.id} className="hover:bg-cream-50">
                                            <td className="px-4 py-2 text-xs font-bold text-green-900">{h.productName}</td>
                                            <td className="px-4 py-2 text-[10px] font-mono text-cream-500">{h.batchCode}</td>
                                            <td className="px-4 py-2 text-center">
                                                <Badge className={cn(
                                                    "text-[9px]",
                                                    h.status === "SOLD" ? "bg-green-100 text-green-700" :
                                                        h.status === "OPENED" ? "bg-blue-100 text-blue-700" :
                                                            "bg-red-100 text-red-700"
                                                )}>
                                                    {h.status === "SOLD" ? "Đã bán" : h.status === "OPENED" ? "Đang mở" : h.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2 text-center text-xs font-bold">{h.glassesPoured}/{h.glassesTotal}</td>
                                            <td className="px-4 py-2 text-center text-[10px] text-cream-500">
                                                {h.durationHours ? `${h.durationHours}h` : "—"}
                                            </td>
                                            <td className="px-4 py-2 text-right text-xs font-bold text-green-800">
                                                ₫{formatPrice(h.revenue)}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <span className={cn(
                                                    "text-xs font-bold",
                                                    h.profit >= 0 ? "text-green-600" : "text-red-600"
                                                )}>
                                                    ₫{formatPrice(h.profit)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-[10px] text-cream-500">{h.openedByName ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
