"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { TrendingUp, TrendingDown, Search, AlertTriangle, Wine, Trash2, ShieldCheck, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

function formatPrice(n: number) {
    return new Intl.NumberFormat("vi-VN").format(Math.round(n))
}

export interface ProductMargin {
    productName: string
    totalRevenue: number
    totalCOGS: number
    soldCOGS?: number
    wasteCOGS?: number
    supplierClaim?: number
    grossProfit: number
    grossMargin: number
    theoreticalMargin?: number
    wasteRate?: number
    totalQty: number
    wasteQty?: number
    hasWaste?: boolean
}

export interface Summary {
    todayCOGS: number
    monthCOGS: number
    soldCOGS?: number
    wasteCOGS?: number
    netWasteCOGS?: number
    supplierClaimCost?: number
    todayWasteCost?: number
    totalRevenue?: number
    trueGrossProfit?: number
    trueGrossMargin?: number
    theoreticalMargin?: number
    avgMargin: number
    wastePctOfRevenue?: number
    wasteBreakdown?: {
        corked: number
        oxidation: number
        breakage: number
        other: number
    }
    totalOrders: number
    topMarginProduct: string
    lowestMarginProduct: string
}

interface Props {
    initial: {
        byProduct: ProductMargin[]
        summary: Summary
    }
}

export default function MarginsClient({ initial }: Props) {
    const [search, setSearch] = useState("")
    const [sortBy, setSortBy] = useState<"profit" | "margin" | "waste" | "revenue">("profit")
    const [filterWasteOnly, setFilterWasteOnly] = useState(false)

    const summary = initial.summary
    const totalRevenue = summary.totalRevenue ?? initial.byProduct.reduce((s, p) => s + p.totalRevenue, 0)
    const soldCOGS = summary.soldCOGS ?? initial.byProduct.reduce((s, p) => s + (p.soldCOGS ?? p.totalCOGS), 0)
    const netWasteCOGS = summary.netWasteCOGS ?? initial.byProduct.reduce((s, p) => s + (p.wasteCOGS ?? 0), 0)
    const supplierClaim = summary.supplierClaimCost ?? 0
    const trueCOGS = summary.monthCOGS || (soldCOGS + netWasteCOGS)
    const trueGrossProfit = summary.trueGrossProfit ?? (totalRevenue - trueCOGS)
    const trueGrossMargin = summary.trueGrossMargin ?? (totalRevenue > 0 ? Math.round((trueGrossProfit / totalRevenue) * 100) : 0)
    const theoreticalMargin = summary.theoreticalMargin ?? (totalRevenue > 0 ? Math.round(((totalRevenue - soldCOGS) / totalRevenue) * 100) : 0)
    const wasteRate = summary.wastePctOfRevenue ?? (totalRevenue > 0 ? Math.round((netWasteCOGS / totalRevenue) * 1000) / 10 : 0)

    const filtered = useMemo(() => {
        let items = initial.byProduct
        if (search) {
            const q = search.toLowerCase()
            items = items.filter((p) => p.productName.toLowerCase().includes(q))
        }
        if (filterWasteOnly) {
            items = items.filter((p) => (p.wasteCOGS ?? 0) > 0)
        }
        return [...items].sort((a, b) => {
            if (sortBy === "margin") return b.grossMargin - a.grossMargin
            if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue
            if (sortBy === "waste") return (b.wasteCOGS ?? 0) - (a.wasteCOGS ?? 0)
            return b.grossProfit - a.grossProfit
        })
    }, [initial.byProduct, search, sortBy, filterWasteOnly])

    // Wine Bar waste rate benchmark
    const wasteStatus = useMemo(() => {
        if (wasteRate <= 2.0) {
            return {
                label: "Tối ưu (< 2%)",
                badgeClass: "bg-green-50 text-green-800 border-green-200",
                icon: ShieldCheck,
                tip: "Hao hụt trong ngưỡng cho phép chuẩn Wine Bar quốc tế.",
            }
        }
        if (wasteRate <= 4.0) {
            return {
                label: "Cảnh báo (2 - 4%)",
                badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
                icon: AlertTriangle,
                tip: "Cần kiểm tra kỹ các chai mở ly (By-the-glass) để tránh oxy hoá.",
            }
        }
        return {
            label: "Báo động (> 4%)",
            badgeClass: "bg-red-50 text-red-800 border-red-200",
            icon: AlertTriangle,
            tip: "Thất thoát / hỏng nút bần vượt ngưỡng! Cần đối soát đổi bù với Nhà cung cấp.",
        }
    }, [wasteRate])


    return (
        <div className="p-4 lg:p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-xl font-bold text-green-900 flex items-center gap-2">
                        Lợi nhuận & Biên lãi thực tế
                    </h1>
                    <p className="text-xs text-cream-500 mt-0.5">
                        Phân tích True COGS = Giá vốn bán hàng + Phân bổ Hao hụt / Vang hỏng (Corked & Spoilage)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/waste">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-cream-300 hover:bg-cream-100 hover:text-green-900 text-stone-700"
                        >
                            <Trash2 className="h-3.5 w-3.5 mr-1 text-red-600" />
                            Ghi nhận Hao hụt / Vang hỏng
                            <ArrowUpRight className="h-3 w-3 ml-1 opacity-60" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Main KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Doanh thu */}
                <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cream-400">Doanh thu tháng</p>
                    <p className="font-mono text-xl font-bold text-green-900 mt-1">₫{formatPrice(totalRevenue)}</p>
                    <p className="text-[10px] text-cream-500 mt-1.5 flex items-center gap-1">
                        Từ {summary.totalOrders} đơn thanh toán
                    </p>
                </div>

                {/* 2. COGS Bán hàng vs Hao hụt */}
                <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-cream-400">True COGS (Tổng giá vốn)</p>
                        <span className="text-[10px] font-mono text-stone-500">
                            {totalRevenue > 0 ? Math.round((trueCOGS / totalRevenue) * 100) : 0}% DS
                        </span>
                    </div>
                    <p className="font-mono text-xl font-bold text-red-700 mt-1">₫{formatPrice(trueCOGS)}</p>
                    <div className="text-[10px] text-stone-500 mt-1.5 space-y-0.5">
                        <div className="flex justify-between">
                            <span>Món bán:</span>
                            <span className="font-mono">₫{formatPrice(soldCOGS)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 font-medium">
                            <span>Hao hụt ròng:</span>
                            <span className="font-mono">+₫{formatPrice(netWasteCOGS)}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Lãi gộp thực tế */}
                <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cream-400">Lãi gộp thực tế</p>
                    <p className="font-mono text-xl font-bold text-green-700 mt-1">₫{formatPrice(trueGrossProfit)}</p>
                    <p className="text-[10px] text-cream-500 mt-1.5">
                        Sau khi khấu trừ vang hỏng & hao hụt
                    </p>
                </div>

                {/* 4. Biên lãi gộp thực tế vs lý thuyết */}
                <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-cream-400">Biên lãi thực tế</p>
                        <span className="text-[10px] font-medium text-stone-400">Lý thuyết {theoreticalMargin}%</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <p className="font-mono text-xl font-bold text-green-900">{trueGrossMargin}%</p>
                        {theoreticalMargin > trueGrossMargin && (
                            <span className="text-[10px] font-medium text-red-600">
                                -{theoreticalMargin - trueGrossMargin}% do hao hụt
                            </span>
                        )}
                    </div>
                    <p className="text-[9px] text-stone-500 mt-1.5 truncate">
                        Top: <span className="font-medium text-green-800">{summary.topMarginProduct}</span>
                    </p>
                </div>

                {/* 5. Tỷ lệ hao hụt / Doanh thu (Waste Rate %) */}
                <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-xs col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-cream-400">Tỷ lệ Hao hụt (Wine Loss)</p>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold border", wasteStatus.badgeClass)}>
                            {wasteRate}%
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-xs font-bold text-stone-800">{wasteStatus.label}</span>
                    </div>
                    <p className="text-[10px] text-cream-500 mt-1 leading-tight">
                        {wasteStatus.tip}
                    </p>
                </div>
            </div>

            {/* Wine Bar Loss Breakdown Banner */}
            {summary.wasteBreakdown && (netWasteCOGS > 0 || supplierClaim > 0) && (
                <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/60 to-cream-50 p-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-amber-900">Chi tiết Hao hụt & Vang hỏng trong kỳ</span>
                        </div>
                        {supplierClaim > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md px-2.5 py-0.5 font-medium">
                                Chờ NCC đổi bù: ₫{formatPrice(supplierClaim)} (không tính mất đứt)
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="rounded-lg bg-white/90 border border-amber-200/60 p-2.5 shadow-2xs">
                            <span className="text-[10px] text-stone-500 flex items-center gap-1 mb-0.5">
                                Lỗi nút bần (Corked / TCA)
                            </span>
                            <span className="font-mono font-bold text-red-700 text-sm">₫{formatPrice(summary.wasteBreakdown.corked)}</span>
                        </div>
                        <div className="rounded-lg bg-white/90 border border-amber-200/60 p-2.5 shadow-2xs">
                            <span className="text-[10px] text-stone-500 flex items-center gap-1 mb-0.5">
                                Oxy hoá vang mở ly
                            </span>
                            <span className="font-mono font-bold text-amber-800 text-sm">₫{formatPrice(summary.wasteBreakdown.oxidation)}</span>
                        </div>
                        <div className="rounded-lg bg-white/90 border border-amber-200/60 p-2.5 shadow-2xs">
                            <span className="text-[10px] text-stone-500 flex items-center gap-1 mb-0.5">
                                Rơi vỡ / Đổ tràn
                            </span>
                            <span className="font-mono font-bold text-orange-700 text-sm">₫{formatPrice(summary.wasteBreakdown.breakage)}</span>
                        </div>
                        <div className="rounded-lg bg-white/90 border border-amber-200/60 p-2.5 shadow-2xs">
                            <span className="text-[10px] text-stone-500 flex items-center gap-1 mb-0.5">
                                Hỏng nguyên liệu / Khác
                            </span>
                            <span className="font-mono font-bold text-stone-700 text-sm">₫{formatPrice(summary.wasteBreakdown.other)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter, Search & Sort Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm sản phẩm..."
                            className="h-8 pl-8 text-xs border-cream-300 bg-white"
                        />
                    </div>
                    <Button
                        variant={filterWasteOnly ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterWasteOnly(!filterWasteOnly)}
                        className={cn(
                            "h-8 text-xs border-cream-300",
                            filterWasteOnly ? "bg-red-700 hover:bg-red-800 text-white" : "text-stone-600 hover:bg-cream-100"
                        )}
                    >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Có hao hụt
                    </Button>
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-cream-300 bg-white p-0.5">
                    {(
                        [
                            { key: "profit", label: "Lãi gộp" },
                            { key: "margin", label: "Biên thực tế %" },
                            { key: "waste", label: "Hao hụt cao" },
                            { key: "revenue", label: "Doanh thu" },
                        ] as const
                    ).map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setSortBy(item.key)}
                            className={cn(
                                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                                sortBy === item.key
                                    ? "bg-green-900 text-cream-50 shadow-xs"
                                    : "text-stone-500 hover:text-green-900"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Margin Table */}
            <div className="rounded-xl border border-cream-300 bg-white overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-cream-200 bg-cream-50 text-[10px] font-bold uppercase text-stone-500">
                                <th className="px-4 py-3 text-left">Sản phẩm</th>
                                <th className="px-3 py-3 text-right">SL bán</th>
                                <th className="px-3 py-3 text-right">Doanh thu</th>
                                <th className="px-3 py-3 text-right">COGS bán</th>
                                <th className="px-3 py-3 text-right">Hao hụt / Hỏng</th>
                                <th className="px-3 py-3 text-right">True COGS</th>
                                <th className="px-3 py-3 text-right">Lãi gộp</th>
                                <th className="px-3 py-3 text-right">Biên % thực tế</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cream-100">
                            {filtered.map((p) => {
                                const hasWaste = (p.wasteCOGS ?? 0) > 0
                                const diffFromTheory =
                                    p.theoreticalMargin !== undefined ? p.theoreticalMargin - p.grossMargin : 0

                                return (
                                    <tr key={p.productName} className="hover:bg-cream-50/70 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium text-green-950 max-w-[220px] truncate">
                                                    {p.productName}
                                                </span>
                                                {hasWaste && (
                                                    <span
                                                        className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-700"
                                                        title={`Hao hụt: ₫${formatPrice(p.wasteCOGS ?? 0)}`}
                                                    >
                                                        Hao hụt
                                                    </span>
                                                )}
                                                {(p.supplierClaim ?? 0) > 0 && (
                                                    <span
                                                        className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700"
                                                        title={`NCC đổi bù: ₫${formatPrice(p.supplierClaim ?? 0)}`}
                                                    >
                                                        NCC bù
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-stone-500 font-mono">
                                            {p.totalQty}
                                            {(p.wasteQty ?? 0) > 0 && (
                                                <span className="text-[10px] text-red-600 block">
                                                    (-{p.wasteQty} hỏng)
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-green-900 font-medium">
                                            ₫{formatPrice(p.totalRevenue)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-stone-600">
                                            ₫{formatPrice(p.soldCOGS ?? p.totalCOGS)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono">
                                            {hasWaste ? (
                                                <span className="text-red-600 font-medium">
                                                    ₫{formatPrice(p.wasteCOGS ?? 0)}
                                                </span>
                                            ) : (
                                                <span className="text-stone-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-stone-800 font-semibold">
                                            ₫{formatPrice(p.totalCOGS)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                                            <span className={p.grossProfit >= 0 ? "text-green-700" : "text-red-700"}>
                                                ₫{formatPrice(p.grossProfit)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                                        p.grossMargin >= 65
                                                            ? "bg-green-100 text-green-800"
                                                            : p.grossMargin >= 45
                                                                ? "bg-amber-100 text-amber-800"
                                                                : "bg-red-100 text-red-800"
                                                    )}
                                                >
                                                    {p.grossMargin >= 65 ? (
                                                        <TrendingUp className="h-2.5 w-2.5" />
                                                    ) : (
                                                        <TrendingDown className="h-2.5 w-2.5" />
                                                    )}
                                                    {p.grossMargin}%
                                                </span>
                                                {diffFromTheory > 0 && (
                                                    <span className="text-[9px] text-red-500 font-mono">
                                                        (giảm -{diffFromTheory}%)
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-cream-300">
                    <p className="text-sm font-medium text-stone-600">Không tìm thấy sản phẩm phù hợp</p>
                    <p className="text-xs text-stone-400 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bỏ lọc</p>
                </div>
            )}
        </div>
    )
}

