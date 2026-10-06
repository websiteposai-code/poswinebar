"use client"

import { useState, useMemo } from "react"
import { RefreshCw, CheckCircle2, XCircle, Package, ArrowUpRight, ArrowDownRight, DollarSign, Gauge, Activity, Filter, Info, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    calculateForecast,
    getForecastSummary,
    updateForecastStatus,
    type ForecastItem,
    type ForecastSummary,
} from "@/actions/forecast"

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

export interface ForecastInitialData {
    items: ForecastItem[]
    summary: ForecastSummary
}

export default function ForecastClient({ initial }: { initial: ForecastInitialData }) {
    const [items, setItems] = useState<ForecastItem[]>(initial.items)
    const [summary, setSummary] = useState<ForecastSummary | undefined>(initial.summary)
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [sortBy, setSortBy] = useState<"confidence" | "demand" | "cost" | "stock">("confidence")
    const [filterCategory, setFilterCategory] = useState<string>("ALL")

    const refresh = async () => {
        setLoading(true)
        const [i, s] = await Promise.all([calculateForecast(), getForecastSummary()])
        setItems(i); setSummary(s)
        setLoading(false)
    }

    const handleAction = async (id: string, status: "ACCEPTED" | "DISMISSED") => {
        await updateForecastStatus(id, status)
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
        toast.success(status === "ACCEPTED" ? "Đã duyệt gợi ý" : "Đã bỏ qua")
    }

    const pendingItems = items.filter((i) => i.status === "PENDING")
    const decidedItems = items.filter((i) => i.status !== "PENDING")
    const acceptedItems = decidedItems.filter((i) => i.status === "ACCEPTED")

    // Analytics
    const categories = useMemo(() => {
        const cats = new Set(items.map((i) => i.category).filter(Boolean))
        return Array.from(cats)
    }, [items])

    const filteredPending = useMemo(() => {
        let result = pendingItems
        if (filterCategory !== "ALL") {
            result = result.filter((i) => i.category === filterCategory)
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter((i) =>
                i.productName.toLowerCase().includes(q) ||
                i.productSku.toLowerCase().includes(q)
            )
        }
        // Sort
        switch (sortBy) {
            case "demand": result.sort((a, b) => b.predictedDemand - a.predictedDemand); break
            case "cost": result.sort((a, b) => b.estimatedCost - a.estimatedCost); break
            case "stock": result.sort((a, b) => a.currentStock - b.currentStock); break
            default: result.sort((a, b) => b.confidence - a.confidence)
        }
        return result
    }, [pendingItems, filterCategory, searchQuery, sortBy])

    // Top demand items
    const topDemand = useMemo(() =>
        [...pendingItems].sort((a, b) => b.predictedDemand - a.predictedDemand).slice(0, 5)
        , [pendingItems])

    // Trending items
    const trendingUp = useMemo(() =>
        pendingItems.filter((i) => i.trendFactor > 1.05).sort((a, b) => b.trendFactor - a.trendFactor)
        , [pendingItems])
    const trendingDown = useMemo(() =>
        pendingItems.filter((i) => i.trendFactor < 0.95).sort((a, b) => a.trendFactor - b.trendFactor)
        , [pendingItems])

    // Confidence distribution
    const confDist = useMemo(() => {
        const high = pendingItems.filter((i) => i.confidence >= 0.85).length
        const medium = pendingItems.filter((i) => i.confidence >= 0.7 && i.confidence < 0.85).length
        const low = pendingItems.filter((i) => i.confidence < 0.7).length
        return { high, medium, low }
    }, [pendingItems])

    // Cost by category
    const costByCategory = useMemo(() => {
        const map = new Map<string, number>()
        for (const i of pendingItems) {
            const cat = i.category || "Khác"
            map.set(cat, (map.get(cat) ?? 0) + i.estimatedCost)
        }
        return Array.from(map.entries())
            .map(([cat, cost]) => ({ category: cat, cost }))
            .sort((a, b) => b.cost - a.cost)
    }, [pendingItems])

    return (
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900 flex items-center gap-2">
                        Dự báo Đặt hàng
                    </h1>
                    <p className="text-sm text-cream-500 mt-0.5">
                        Phân tích thông minh dựa trên dữ liệu 8 tuần · WMA + Seasonal Decomposition + Trend Analysis
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {summary && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-200">
                            <span className="text-[11px] text-cream-500">
                                {new Date(summary.lastCalculated).toLocaleDateString("vi-VN")}
                            </span>
                        </div>
                    )}
                    <Button
                        onClick={refresh}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        className="border-cream-300 text-cream-600 hover:border-green-600 hover:text-green-700"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                        Tính lại
                    </Button>
                </div>
            </div>

            {/* Summary Cards - Full width */}
            {summary && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 px-5 py-4 relative overflow-x-auto">
                        <div className="absolute -right-3 -top-3 opacity-10">
                            <Package className="h-16 w-16 text-green-600" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-green-700">Cần nhập</span>
                        </div>
                        <p className="mt-2 font-mono text-3xl font-bold text-green-800">
                            {summary.totalItems}
                        </p>
                        <p className="text-[10px] text-green-600/70 mt-1">sản phẩm gợi ý</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 px-5 py-4 relative overflow-hidden">
                        <div className="absolute -right-3 -top-3 opacity-10">
                            <DollarSign className="h-16 w-16 text-amber-600" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-amber-700">Chi phí ước tính</span>
                        </div>
                        <p className="mt-2 font-mono text-3xl font-bold text-amber-800">
                            ₫{formatPrice(summary.totalEstimatedCost)}
                        </p>
                        <p className="text-[10px] text-amber-600/70 mt-1">tổng ngân sách</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 px-5 py-4 relative overflow-hidden">
                        <div className="absolute -right-3 -top-3 opacity-10">
                            <Gauge className="h-16 w-16 text-blue-600" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-blue-700">Độ tin cậy TB</span>
                        </div>
                        <p className="mt-2 font-mono text-3xl font-bold text-blue-800">
                            {summary.avgConfidence}%
                        </p>
                        <p className="text-[10px] text-blue-600/70 mt-1">trung bình tất cả</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-5 py-4 relative overflow-hidden">
                        <div className="absolute -right-3 -top-3 opacity-10">
                            <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-emerald-700">Đã duyệt</span>
                        </div>
                        <p className="mt-2 font-mono text-3xl font-bold text-emerald-800">
                            {acceptedItems.length}
                        </p>
                        <p className="text-[10px] text-emerald-600/70 mt-1">
                            ₫{formatPrice(acceptedItems.reduce((s, i) => s + i.estimatedCost, 0))}
                        </p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-gradient-to-br from-cream-50 to-cream-100/50 px-5 py-4 relative overflow-hidden">
                        <div className="absolute -right-3 -top-3 opacity-10">
                            <Activity className="h-16 w-16 text-cream-400" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-cream-500">Xu hướng</span>
                        </div>
                        <p className="mt-2 font-mono text-xl font-bold text-cream-700">
                            <span className="text-green-600">↑{trendingUp.length}</span>
                            {" / "}
                            <span className="text-red-500">↓{trendingDown.length}</span>
                        </p>
                        <p className="text-[10px] text-cream-400 mt-1">tăng / giảm</p>
                    </div>
                </div>
            )}

            {/* Main Content: 2-column layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: Forecast List (2/3) */}
                <div className="xl:col-span-2 space-y-4">
                    {/* Search, Filter, Sort */}
                    <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-cream-200 bg-white">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream-400" />
                            <input
                                type="text"
                                placeholder="Tìm sản phẩm, SKU..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-cream-200 bg-cream-50 text-green-900 focus:border-green-600 focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                onClick={() => setFilterCategory("ALL")}
                                className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all",
                                    filterCategory === "ALL" ? "bg-green-800 text-cream-50" : "bg-cream-100 text-cream-500 hover:bg-cream-200"
                                )}
                            >
                                Tất cả
                            </button>
                            {categories.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setFilterCategory(c)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all",
                                        filterCategory === c ? "bg-green-800 text-cream-50" : "bg-cream-100 text-cream-500 hover:bg-cream-200"
                                    )}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="px-2.5 py-1 rounded-lg border border-cream-200 bg-cream-50 text-[10px] text-cream-600 focus:outline-none"
                        >
                            <option value="confidence">Sắp xếp: Độ tin cậy</option>
                            <option value="demand">Sắp xếp: Nhu cầu</option>
                            <option value="cost">Sắp xếp: Chi phí</option>
                            <option value="stock">Sắp xếp: Tồn thấp nhất</option>
                        </select>
                    </div>

                    {/* Pending Suggestions */}
                    {filteredPending.length > 0 && (
                        <div>
                            <h2 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
                                Gợi ý chờ duyệt ({filteredPending.length})
                            </h2>
                            <div className="space-y-3">
                                {filteredPending.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-cream-200 bg-white p-4 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Product info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-bold text-green-900">
                                                        {item.productName}
                                                    </h3>
                                                    <Badge className="text-[9px] px-1.5 py-0 bg-cream-200 text-cream-600 border-cream-300">
                                                        {item.productSku}
                                                    </Badge>
                                                    {item.category && (
                                                        <Badge className="text-[9px] px-1.5 py-0 bg-cream-100 text-cream-500 border-cream-200">
                                                            {item.category}
                                                        </Badge>
                                                    )}
                                                    {item.trendFactor > 1.05 && (
                                                        <Badge className="text-[9px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 flex items-center gap-0.5">
                                                            Trending
                                                        </Badge>
                                                    )}
                                                    {item.trendFactor < 0.95 && (
                                                        <Badge className="text-[9px] px-1.5 py-0 bg-red-100 text-red-600 border-red-200 flex items-center gap-0.5">
                                                            Giảm
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-xs text-cream-500 leading-relaxed">
                                                    {item.reason}
                                                </p>

                                                {/* Metrics Grid */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-3 p-3 rounded-lg bg-cream-50/80 border border-cream-100">
                                                    <div>
                                                        <span className="text-[9px] text-cream-400 uppercase font-medium block">Tồn hiện tại</span>
                                                        <span className={cn("font-mono text-sm font-bold",
                                                            item.currentStock <= 2 ? "text-red-600" : "text-green-700"
                                                        )}>
                                                            {item.currentStock}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-cream-400 uppercase font-medium block">Bán TB/tuần</span>
                                                        <span className="font-mono text-sm font-bold text-blue-700">
                                                            {item.avgWeeklySales}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-cream-400 uppercase font-medium block">Dự báo</span>
                                                        <span className="font-mono text-sm font-bold text-wine-700 flex items-center gap-0.5">
                                                            {item.predictedDemand}
                                                            {item.predictedDemand > item.avgWeeklySales ? (
                                                                <ArrowUpRight className="h-3 w-3 text-green-600" />
                                                            ) : item.predictedDemand < item.avgWeeklySales ? (
                                                                <ArrowDownRight className="h-3 w-3 text-red-500" />
                                                            ) : null}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-cream-400 uppercase font-medium block">Tin cậy</span>
                                                        <span className={cn("font-mono text-sm font-bold",
                                                            item.confidence >= 0.85 ? "text-green-700" :
                                                                item.confidence >= 0.7 ? "text-amber-700" : "text-red-600"
                                                        )}>
                                                            {Math.round(item.confidence * 100)}%
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-cream-400 uppercase font-medium block">Mùa vụ</span>
                                                        <span className="font-mono text-sm font-bold text-cream-600">
                                                            ×{item.seasonFactor.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-cream-400 uppercase font-medium block">Lead Time</span>
                                                        <span className="font-mono text-sm font-bold text-cream-600">
                                                            {item.leadTimeDays} ngày
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Mini sparkline from weeklyBreakdown */}
                                                {item.weeklyBreakdown.length > 0 && (
                                                    <div className="mt-2 flex items-end gap-[3px] h-8">
                                                        {item.weeklyBreakdown.map((val, idx) => {
                                                            const max = Math.max(...item.weeklyBreakdown, 1)
                                                            const h = Math.max(4, (val / max) * 32)
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className={cn(
                                                                        "flex-1 rounded-t-sm transition-all",
                                                                        idx === item.weeklyBreakdown.length - 1
                                                                            ? "bg-green-500"
                                                                            : "bg-green-300/60"
                                                                    )}
                                                                    style={{ height: `${h}px` }}
                                                                    title={`Tuần ${idx + 1}: ${val} đơn vị`}
                                                                />
                                                            )
                                                        })}
                                                        <span className="text-[8px] text-cream-400 ml-1 self-end">8w</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Suggestion + Actions */}
                                            <div className="shrink-0 text-right space-y-3 min-w-[120px]">
                                                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                                                    <p className="text-[9px] text-green-600 uppercase font-medium">Gợi ý nhập</p>
                                                    <p className="font-mono text-2xl font-bold text-green-900">
                                                        {item.suggestedQty > 0 ? `+${item.suggestedQty}` : "—"}
                                                    </p>
                                                    {item.estimatedCost > 0 && (
                                                        <p className="text-[10px] font-mono text-green-600">
                                                            ≈ ₫{formatPrice(item.estimatedCost)}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <Button
                                                        onClick={() => handleAction(item.id, "ACCEPTED")}
                                                        size="sm"
                                                        className="h-7 flex-1 bg-green-700 text-white hover:bg-green-800 text-[10px]"
                                                    >
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Duyệt
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleAction(item.id, "DISMISSED")}
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 flex-1 border-cream-300 text-cream-500 text-[10px]"
                                                    >
                                                        <XCircle className="h-3 w-3 mr-1" />
                                                        Bỏ
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Decided Items */}
                    {decidedItems.length > 0 && (
                        <div className="rounded-xl border border-cream-200 bg-white overflow-hidden">
                            <div className="px-5 py-3 border-b border-cream-100 bg-cream-50/50">
                                <h2 className="text-sm font-bold text-cream-600 flex items-center gap-2">
                                    Đã xử lý ({decidedItems.length})
                                </h2>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-green-900/5 text-xs">
                                        <th className="px-4 py-2 text-left font-semibold text-cream-600">Trạng thái</th>
                                        <th className="px-4 py-2 text-left font-semibold text-cream-600">Sản phẩm</th>
                                        <th className="px-4 py-2 text-left font-semibold text-cream-600">SKU</th>
                                        <th className="px-4 py-2 text-right font-semibold text-cream-600">SL nhập</th>
                                        <th className="px-4 py-2 text-right font-semibold text-cream-600">Chi phí</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {decidedItems.map((item, i) => (
                                        <tr
                                            key={item.id}
                                            className={cn(
                                                "border-t border-cream-100 hover:bg-cream-50/50 transition-colors",
                                                i % 2 === 0 && "bg-cream-50/20"
                                            )}
                                        >
                                            <td className="px-4 py-2.5">
                                                {item.status === "ACCEPTED" ? (
                                                    <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">
                                                        Duyệt
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-[10px] px-1.5 py-0 bg-cream-200 text-cream-500 border-cream-300">
                                                        Bỏ qua
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-medium text-green-900">{item.productName}</td>
                                            <td className="px-4 py-2.5 text-[11px] text-cream-500 font-mono">{item.productSku}</td>
                                            <td className="px-4 py-2.5 text-right text-xs font-mono font-bold text-green-700">
                                                {item.status === "ACCEPTED" ? `+${item.suggestedQty}` : "—"}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-xs font-mono text-cream-500">
                                                {item.status === "ACCEPTED" ? `₫${formatPrice(item.estimatedCost)}` : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Empty state */}
                    {items.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-20 text-cream-400 rounded-xl border border-cream-200 bg-white">
                            <p className="text-sm font-medium">Chưa có dữ liệu để dự báo</p>
                            <p className="text-[11px] mt-1">Cần ít nhất 4 tuần dữ liệu bán hàng</p>
                        </div>
                    )}
                </div>

                {/* Right: Analytics Sidebar (1/3) */}
                <div className="space-y-4">
                    {/* Confidence Distribution */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Phân bố Độ tin cậy
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] text-green-700 font-medium">Cao (≥85%)</span>
                                    <span className="text-[11px] font-mono font-bold text-green-700">{confDist.high}</span>
                                </div>
                                <div className="h-2.5 bg-cream-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500"
                                        style={{ width: `${pendingItems.length > 0 ? (confDist.high / pendingItems.length) * 100 : 0}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] text-amber-700 font-medium">Trung bình (70-84%)</span>
                                    <span className="text-[11px] font-mono font-bold text-amber-700">{confDist.medium}</span>
                                </div>
                                <div className="h-2.5 bg-cream-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                                        style={{ width: `${pendingItems.length > 0 ? (confDist.medium / pendingItems.length) * 100 : 0}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] text-red-600 font-medium">Thấp (&lt;70%)</span>
                                    <span className="text-[11px] font-mono font-bold text-red-600">{confDist.low}</span>
                                </div>
                                <div className="h-2.5 bg-cream-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-red-500 to-red-300 rounded-full transition-all duration-500"
                                        style={{ width: `${pendingItems.length > 0 ? (confDist.low / pendingItems.length) * 100 : 0}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Demand */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Top Nhu cầu cao nhất
                        </h3>
                        {topDemand.length > 0 ? (
                            <div className="space-y-2.5">
                                {topDemand.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cream-50/70 border border-cream-100"
                                    >
                                        <span className={cn(
                                            "flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold shrink-0",
                                            idx === 0 ? "bg-green-100 text-green-700" :
                                                idx === 1 ? "bg-blue-100 text-blue-700" :
                                                    "bg-cream-200 text-cream-600"
                                        )}>
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-semibold text-green-900 truncate">{item.productName}</p>
                                            <p className="text-[9px] text-cream-400">{item.productSku}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-mono text-xs font-bold text-green-800">{item.predictedDemand}</p>
                                            <p className="text-[9px] text-cream-400">dự báo/tuần</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-cream-400 text-center py-4">Chưa có dữ liệu</p>
                        )}
                    </div>

                    {/* Cost by Category */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Chi phí theo Danh mục
                        </h3>
                        {costByCategory.length > 0 ? (
                            <div className="space-y-3">
                                {costByCategory.map((item) => {
                                    const maxCost = costByCategory[0]?.cost ?? 1
                                    const pct = Math.round((item.cost / maxCost) * 100)
                                    return (
                                        <div key={item.category}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px] text-cream-600">{item.category}</span>
                                                <span className="text-[11px] font-mono font-bold text-amber-700">₫{formatPrice(item.cost)}</span>
                                            </div>
                                            <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-cream-400 text-center py-4">Chưa có dữ liệu</p>
                        )}
                    </div>

                    {/* Trend Signals */}
                    <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100/30 p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Tín hiệu Xu hướng
                        </h3>
                        <div className="space-y-2">
                            {trendingUp.length > 0 && (
                                <div className="p-2.5 rounded-lg bg-green-100/50 border border-green-200">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[11px] font-bold text-green-800">Đang tăng ({trendingUp.length})</span>
                                    </div>
                                    <div className="space-y-1">
                                        {trendingUp.slice(0, 3).map((i) => (
                                            <p key={i.id} className="text-[10px] text-green-700 flex items-center justify-between">
                                                <span className="truncate">{i.productName}</span>
                                                <span className="font-mono font-bold ml-2">×{i.trendFactor.toFixed(2)}</span>
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {trendingDown.length > 0 && (
                                <div className="p-2.5 rounded-lg bg-red-50/50 border border-red-200">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[11px] font-bold text-red-700">Đang giảm ({trendingDown.length})</span>
                                    </div>
                                    <div className="space-y-1">
                                        {trendingDown.slice(0, 3).map((i) => (
                                            <p key={i.id} className="text-[10px] text-red-600 flex items-center justify-between">
                                                <span className="truncate">{i.productName}</span>
                                                <span className="font-mono font-bold ml-2">×{i.trendFactor.toFixed(2)}</span>
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {trendingUp.length === 0 && trendingDown.length === 0 && (
                                <p className="text-xs text-cream-400 text-center py-2">Ổn định — không có xu hướng rõ ràng</p>
                            )}
                        </div>
                    </div>

                    {/* Methodology Info */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-3">
                            Phương pháp
                        </h3>
                        <div className="space-y-2.5 text-[11px] text-cream-500">
                            <div className="flex items-start gap-2">
                                <span className="text-green-600 font-bold shrink-0">WMA</span>
                                <span>Weighted Moving Average — 8 tuần, trọng số tăng dần theo trước gần nhất</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-blue-600 font-bold shrink-0">SD</span>
                                <span>Seasonal Decomposition — Phân tích mùa vụ, yếu tố ngày trong tuần</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-amber-600 font-bold shrink-0">TA</span>
                                <span>Trend Analysis — Hồi quy tuyến tính 4 tuần gần nhất</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-wine-600 font-bold shrink-0">SS</span>
                                <span>Safety Stock — Tồn an toàn dựa trên lead time và ngưỡng cảnh báo</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t border-cream-100">
                <p className="text-[10px] text-cream-400 italic">
                    Weighted Moving Average + Seasonal Decomposition + Trend Analysis · Dữ liệu từ 8 tuần gần nhất · Cập nhật mỗi ngày
                </p>
            </div>
        </div>
    )
}
