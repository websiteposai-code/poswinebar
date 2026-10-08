"use client"

import { useState, useCallback, useMemo } from "react"
import { Trash2, RefreshCw, Plus, Wine, AlertTriangle, Package, Layers, X, TrendingDown, DollarSign, Search, Filter, ArrowDownRight, Target, Clock, Percent, FileWarning, ShieldCheck, Droplets, GlassWater } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    recordWaste,
    getWasteReport,
    getOpenedWineBottles,
    settleSupplierClaim,
    type WasteReport,
    type WasteType,
    type WasteRecord,
    type WasteReasonCategory,
    type OpenedWineBottle,
} from "@/actions/waste"
import { WASTE_REASON_LABELS } from "@/lib/waste-types"
import { useAuthStore } from "@/stores/auth-store"

const TYPE_CONFIG: Record<WasteType, { label: string; icon: typeof Trash2; color: string; bgColor: string; borderColor: string }> = {
    WASTE: { label: "Hao hụt", icon: Trash2, color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200" },
    SPOILAGE: { label: "Hư hỏng", icon: AlertTriangle, color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
    BREAKAGE: { label: "Vỡ / Đổ", icon: Trash2, color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
}

const REASON_ICONS: Record<WasteReasonCategory, typeof Wine> = {
    CORKED: Wine,
    OXIDATION: Clock,
    BREAKAGE: Trash2,
    SPILLAGE: Droplets,
    TASTING: GlassWater,
    SPOILAGE: AlertTriangle,
    OTHER: Package,
}

const formatVND = (v: number) =>
    v.toLocaleString("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })

export default function WasteClient({
    initial,
    formOptions,
    openedBottles = [],
}: {
    initial: WasteReport
    formOptions: {
        products: { id: string; name: string; type: string; costPrice: number }[]
        ingredients: { id: string; name: string; unit: string; costPerUnit: number }[]
    }
    openedBottles?: OpenedWineBottle[]
}) {
    const [report, setReport] = useState<WasteReport>(initial)
    const [openWines, setOpenWines] = useState<OpenedWineBottle[]>(openedBottles)
    const [loading, setLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [filterType, setFilterType] = useState<WasteType | "ALL">("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("all")
    const [activeSection, setActiveSection] = useState<"all" | "opened_bottles" | "claims">("all")
    const { staff } = useAuthStore()

    // Form state
    const [formType, setFormType] = useState<WasteType>("WASTE")
    const [formTarget, setFormTarget] = useState<"product" | "ingredient" | "opened_bottle">("product")
    const [formProductId, setFormProductId] = useState("")
    const [formIngredientId, setFormIngredientId] = useState("")
    const [formBottleId, setFormBottleId] = useState("")
    const [formQty, setFormQty] = useState(1)
    const [formReasonCategory, setFormReasonCategory] = useState<WasteReasonCategory>("OTHER")
    const [formPendingSupplierClaim, setFormPendingSupplierClaim] = useState(false)
    const [formReason, setFormReason] = useState("")
    const [submitting, setSubmitting] = useState(false)

    // Settle claim modal state
    const [settleRecord, setSettleRecord] = useState<WasteRecord | null>(null)
    const [settleAction, setSettleAction] = useState<"REPLACED_BOTTLE" | "REFUNDED" | "REJECTED">("REPLACED_BOTTLE")
    const [settleNotes, setSettleNotes] = useState("")
    const [settling, setSettling] = useState(false)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const [data, bottles] = await Promise.all([
                getWasteReport(),
                getOpenedWineBottles(),
            ])
            setReport(data)
            setOpenWines(bottles)
        } catch {
            toast.error("Không thể tải dữ liệu hao hụt")
        }
        setLoading(false)
    }, [])

    const handleSubmit = async () => {
        if (!formReason.trim()) {
            toast.error("Vui lòng nhập lý do")
            return
        }
        if (formTarget === "product" && !formProductId) {
            toast.error("Vui lòng chọn sản phẩm")
            return
        }
        if (formTarget === "ingredient" && !formIngredientId) {
            toast.error("Vui lòng chọn nguyên liệu")
            return
        }
        if (formTarget === "opened_bottle" && !formBottleId) {
            toast.error("Vui lòng chọn chai vang mở ly")
            return
        }

        setSubmitting(true)
        const result = await recordWaste({
            type: formType,
            productId: formTarget === "product" ? formProductId : undefined,
            ingredientId: formTarget === "ingredient" ? formIngredientId : undefined,
            bottleId: formTarget === "opened_bottle" ? formBottleId : undefined,
            quantity: formQty,
            reason: formReason,
            reasonCategory: formReasonCategory,
            pendingSupplierClaim: formPendingSupplierClaim,
            staffId: staff?.id ?? "",
        })

        if (result.success) {
            toast.success("Đã ghi nhận hao hụt")
            setShowForm(false)
            setFormReason("")
            setFormQty(1)
            setFormProductId("")
            setFormIngredientId("")
            setFormBottleId("")
            setFormPendingSupplierClaim(false)
            setFormReasonCategory("OTHER")
            await refresh()
        } else {
            toast.error(result.error ?? "Lỗi không xác định")
        }
        setSubmitting(false)
    }

    const handleSettleClaim = async () => {
        if (!settleRecord) return
        setSettling(true)
        const res = await settleSupplierClaim({
            movementId: settleRecord.id,
            action: settleAction,
            staffId: staff?.id ?? "",
            notes: settleNotes,
        })
        if (res.success) {
            toast.success("Đã cập nhật đối soát nhà cung cấp thành công")
            setSettleRecord(null)
            setSettleNotes("")
            await refresh()
        } else {
            toast.error(res.error ?? "Lỗi cập nhật đối soát")
        }
        setSettling(false)
    }

    // Filtered records
    const filtered: WasteRecord[] = useMemo(() => {
        let result = report.records
        if (filterType !== "ALL") {
            result = result.filter((r) => r.type === filterType)
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(
                (r) =>
                    (r.productName?.toLowerCase().includes(q) ?? false) ||
                    (r.ingredientName?.toLowerCase().includes(q) ?? false) ||
                    (r.reason?.toLowerCase().includes(q) ?? false) ||
                    (r.staffName?.toLowerCase().includes(q) ?? false)
            )
        }
        if (dateRange !== "all") {
            const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90
            const cutoff = new Date(Date.now() - days * 86400000)
            result = result.filter((r) => new Date(r.createdAt) >= cutoff)
        }
        return result
    }, [report.records, filterType, searchQuery, dateRange])

    // Analytics
    const topOffenders = useMemo(() => {
        const map = new Map<string, { name: string; count: number; cost: number; type: "product" | "ingredient" }>()
        for (const r of report.records) {
            const name = r.productName ?? r.ingredientName ?? "Unknown"
            const key = r.productId ?? r.ingredientId ?? name
            const entry = map.get(key) ?? { name, count: 0, cost: 0, type: r.productId ? "product" as const : "ingredient" as const }
            entry.count += r.quantity
            entry.cost += r.totalCost
            map.set(key, entry)
        }
        return Array.from(map.values()).sort((a, b) => b.cost - a.cost).slice(0, 8)
    }, [report.records])

    const staffBreakdown = useMemo(() => {
        const map = new Map<string, { name: string; count: number; cost: number }>()
        for (const r of report.records) {
            const name = r.staffName ?? "Không rõ"
            const entry = map.get(name) ?? { name, count: 0, cost: 0 }
            entry.count++
            entry.cost += r.totalCost
            map.set(name, entry)
        }
        return Array.from(map.values()).sort((a, b) => b.cost - a.cost).slice(0, 5)
    }, [report.records])

    // Recent trend — compare current 7 days vs previous 7 days
    const recentTrend = useMemo(() => {
        const now = Date.now()
        const sevenDaysMs = 7 * 86400000
        const current = report.records.filter(
            (r) => now - new Date(r.createdAt).getTime() < sevenDaysMs
        )
        const previous = report.records.filter(
            (r) => {
                const age = now - new Date(r.createdAt).getTime()
                return age >= sevenDaysMs && age < 2 * sevenDaysMs
            }
        )
        const currentCost = current.reduce((s, r) => s + r.totalCost, 0)
        const previousCost = previous.reduce((s, r) => s + r.totalCost, 0)
        const change = previousCost > 0 ? Math.round(((currentCost - previousCost) / previousCost) * 100) : 0
        return { currentCost, previousCost, currentCount: current.length, previousCount: previous.length, change }
    }, [report.records])

    // Average cost per incident
    const avgCostPerIncident = report.summary.totalRecords > 0
        ? Math.round(report.summary.totalCost / report.summary.totalRecords)
        : 0

    return (
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900 flex items-center gap-2">
                        Quản lý Hao hụt & Hư hỏng
                    </h1>
                    <p className="text-sm text-cream-500 mt-0.5">
                        Ghi nhận, phân tích waste / spoilage / breakage — Tự động vào P&L chi phí
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setShowForm(true)}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Ghi nhận mới
                    </Button>
                    <Button
                        onClick={refresh}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        className="border-cream-300 text-cream-600 hover:border-green-600 hover:text-green-700"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Summary Cards - Full width 6-col */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 px-4 py-4 relative overflow-x-auto">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <DollarSign className="h-14 w-14 text-red-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-red-700">Tổng giá trị</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-red-800">
                        {formatVND(report.summary.totalCost)}
                    </p>
                    <p className="text-[10px] text-red-600/70 mt-1">toàn bộ thời gian</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 px-4 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <Layers className="h-14 w-14 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-amber-700">Tổng sự cố</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-amber-800">
                        {report.summary.totalRecords}
                    </p>
                    <p className="text-[10px] text-amber-600/70 mt-1">lần ghi nhận</p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 px-4 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <Percent className="h-14 w-14 text-orange-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-orange-700">% Doanh thu</span>
                    </div>
                    <p className={cn("mt-2 font-mono text-2xl font-bold",
                        report.summary.wastePctOfRevenue > 3 ? "text-red-700" :
                            report.summary.wastePctOfRevenue > 1.5 ? "text-amber-700" : "text-green-700"
                    )}>
                        {report.summary.wastePctOfRevenue}%
                    </p>
                    <p className="text-[10px] text-orange-600/70 mt-1">30 ngày qua</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 px-4 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <Target className="h-14 w-14 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-blue-700">TB / sự cố</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-blue-800">
                        {formatVND(avgCostPerIncident)}
                    </p>
                    <p className="text-[10px] text-blue-600/70 mt-1">chi phí bình quân</p>
                </div>
                <div className="rounded-xl border border-cream-200 bg-gradient-to-br from-cream-50 to-cream-100/50 px-4 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <TrendingDown className="h-14 w-14 text-cream-400" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-cream-600">7 ngày qua</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-cream-700">
                        {formatVND(recentTrend.currentCost)}
                    </p>
                    <p className={cn("text-[10px] mt-1 font-medium",
                        recentTrend.change > 0 ? "text-red-600" : recentTrend.change < 0 ? "text-green-600" : "text-cream-400"
                    )}>
                        {recentTrend.change > 0 ? "↑" : recentTrend.change < 0 ? "↓" : "→"} {Math.abs(recentTrend.change)}% vs tuần trước
                    </p>
                </div>
                <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 px-4 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <FileWarning className="h-14 w-14 text-green-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-green-700">Benchmark</span>
                    </div>
                    <p className={cn("mt-2 font-mono text-2xl font-bold",
                        report.summary.wastePctOfRevenue <= 2 ? "text-green-700" : "text-amber-700"
                    )}>
                        {report.summary.wastePctOfRevenue <= 2 ? "Tốt" : report.summary.wastePctOfRevenue <= 4 ? "TB" : "Cao"}
                    </p>
                    <p className="text-[10px] text-green-600/70 mt-1">mục tiêu: &lt;2%</p>
                </div>
            </div>

            {/* By Type breakdown - horizontal mini cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {report.summary.byType.map((t) => {
                    const config = TYPE_CONFIG[t.type]
                    const pct = report.summary.totalCost > 0 ? Math.round((t.cost / report.summary.totalCost) * 100) : 0
                    return (
                        <div key={t.type} className={cn("rounded-xl border px-4 py-3", config.bgColor, config.borderColor)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div>
                                        <span className={cn("text-xs font-bold", config.color)}>{config.label}</span>
                                        <p className={cn("font-mono text-lg font-bold", config.color)}>
                                            {formatVND(t.cost)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={cn("font-mono text-2xl font-bold", config.color)}>{t.count}</p>
                                    <p className="text-[10px] text-cream-400">{pct}% tổng</p>
                                </div>
                            </div>
                            <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-500",
                                        t.type === "WASTE" ? "bg-red-400" :
                                            t.type === "SPOILAGE" ? "bg-amber-400" : "bg-orange-400"
                                    )}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Section Switcher Tabs */}
            <div className="flex items-center gap-2 border-b border-cream-200 pb-2">
                <button
                    onClick={() => setActiveSection("all")}
                    className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                        activeSection === "all"
                            ? "bg-green-900 text-cream-50 shadow-xs font-bold"
                            : "text-stone-600 hover:bg-cream-100"
                    )}
                >
                    Tất cả sự cố ({report.records.length})
                </button>
                <button
                    onClick={() => setActiveSection("opened_bottles")}
                    className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                        activeSection === "opened_bottles"
                            ? "bg-green-900 text-cream-50 shadow-xs font-bold"
                            : "text-stone-600 hover:bg-cream-100"
                    )}
                >
                    <Wine className="h-3.5 w-3.5 text-amber-700" />
                    Vang mở ly By-the-glass ({openWines.length})
                    {openWines.some((w) => w.isOxidizedWarning) && (
                        <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" title="Có chai quá 72h" />
                    )}
                </button>
                <button
                    onClick={() => setActiveSection("claims")}
                    className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                        activeSection === "claims"
                            ? "bg-green-900 text-cream-50 shadow-xs font-bold"
                            : "text-stone-600 hover:bg-cream-100"
                    )}
                >
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
                    Chờ NCC đổi bù ({report.records.filter((r) => r.isPendingSupplierClaim && !r.isClaimSettled).length})
                </button>
            </div>

            {/* Main Content: 2-column layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left (2/3) */}
                <div className="xl:col-span-2 space-y-4">
                    {/* SECTION: OPENED BOTTLES */}
                    {activeSection === "opened_bottles" && (
                        <div className="space-y-3">
                            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                        Giám sát Chai vang đang mở bán ly (By-the-glass)
                                    </h3>
                                    <p className="text-[11px] text-amber-800/80 mt-0.5">
                                        Chai mở quá 72h (3 ngày) có nguy cơ oxy hoá mất vị. Thanh lý số ly còn lại để hạch toán vào COGS.
                                    </p>
                                </div>
                            </div>

                            {openWines.length === 0 ? (
                                <div className="rounded-xl border border-cream-200 bg-white p-8 text-center text-stone-400">
                                    <p className="text-xs font-medium">Hiện không có chai vang nào đang mở ly trong quầy bar</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {openWines.map((bottle) => (
                                        <div
                                            key={bottle.id}
                                            className={cn(
                                                "rounded-xl border p-4 bg-white shadow-xs transition-all",
                                                bottle.isOxidizedWarning
                                                    ? "border-red-300 ring-1 ring-red-200"
                                                    : "border-cream-200 hover:border-cream-300"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h4 className="text-xs font-bold text-green-950 leading-tight">
                                                        {bottle.productName}
                                                    </h4>
                                                    {bottle.batchCode && (
                                                        <span className="text-[10px] text-stone-400 font-mono">
                                                            Lô: {bottle.batchCode}
                                                        </span>
                                                    )}
                                                </div>
                                                {bottle.isOxidizedWarning ? (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                                                        Quá {bottle.hoursOpened}h
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">
                                                        Mở {bottle.hoursOpened}h
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-3 space-y-1.5 text-xs">
                                                <div className="flex justify-between text-stone-600">
                                                    <span>Số ly còn lại:</span>
                                                    <span className="font-mono font-bold text-stone-900">
                                                        {bottle.glassesLeft} / {bottle.glassesTotal} ly
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-stone-600">
                                                    <span>Giá trị còn lại:</span>
                                                    <span className="font-mono font-bold text-red-700">
                                                        {formatVND(bottle.remainingCost)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3.5 pt-2.5 border-t border-cream-100 flex justify-end">
                                                <Button
                                                    size="xs"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setFormTarget("opened_bottle")
                                                        setFormBottleId(bottle.id)
                                                        setFormQty(bottle.glassesLeft)
                                                        setFormReasonCategory("OXIDATION")
                                                        setFormReason(`Chai mở ly quá ${bottle.hoursOpened}h bị oxy hoá`)
                                                        setShowForm(true)
                                                    }}
                                                    className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
                                                >
                                                    <Trash2 className="h-3 w-3 mr-1 text-red-600" />
                                                    Thanh lý ly oxy hoá
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECTION: SUPPLIER CLAIMS */}
                    {activeSection === "claims" && (
                        <div className="space-y-3">
                            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60">
                                <h3 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                                    Danh mục Vang hỏng chờ Nhà cung cấp đổi bù (Supplier Claims)
                                </h3>
                                <p className="text-[11px] text-blue-800/80 mt-0.5">
                                    Các chai lỗi nút bần (Corked / TCA) hoặc vỡ hỏng do vận chuyển được tách riêng, không tính mất đứt vào COGS cho tới khi đối soát hoàn tất.
                                </p>
                            </div>

                            {report.records.filter((r) => r.isPendingSupplierClaim).length === 0 ? (
                                <div className="rounded-xl border border-cream-200 bg-white p-8 text-center text-stone-400">
                                    <p className="text-xs font-medium">Hiện không có yêu cầu đổi bù nào đang chờ xử lý</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {report.records
                                        .filter((r) => r.isPendingSupplierClaim)
                                        .map((r) => (
                                            <div
                                                key={r.id}
                                                className="p-3.5 rounded-xl border border-cream-200 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-green-950">
                                                            {r.productName ?? r.ingredientName}
                                                        </span>
                                                        {r.isClaimSettled ? (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                Đã đổi bù
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                                                Chờ NCC đổi bù
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-stone-600">
                                                        SL: <span className="font-mono font-bold">{r.quantity}</span> · Giá trị: <span className="font-mono font-bold text-red-700">{formatVND(r.totalCost)}</span>
                                                    </p>
                                                    <p className="text-[11px] text-stone-500 italic">{r.reason}</p>
                                                </div>

                                                {!r.isClaimSettled && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => setSettleRecord(r)}
                                                        className="h-8 text-xs bg-green-900 hover:bg-green-800 text-cream-50"
                                                    >
                                                        Xử lý đổi bù NCC
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECTION: ALL RECORDS TABLE */}
                    {activeSection === "all" && (
                        <>
                            {/* Search, Filter, Date Range */}
                            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-cream-200 bg-white">
                                <div className="relative flex-1 min-w-[180px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm sản phẩm, lý do, nhân viên..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-cream-200 bg-cream-50 text-green-900 focus:border-green-600 focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {(["ALL", "WASTE", "SPOILAGE", "BREAKAGE"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setFilterType(t)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all",
                                                filterType === t
                                                    ? "bg-green-800 text-cream-50"
                                                    : "bg-cream-100 text-cream-500 hover:bg-cream-200"
                                            )}
                                        >
                                            {t === "ALL" ? (
                                                "Tất cả"
                                            ) : (
                                                <span className="inline-flex items-center gap-1">
                                                    {(() => {
                                                        const Icon = TYPE_CONFIG[t].icon
                                                        return <Icon className="h-3 w-3" />
                                                    })()}
                                                    {TYPE_CONFIG[t].label}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {(["7d", "30d", "90d", "all"] as const).map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDateRange(d)}
                                            className={cn(
                                                "px-2 py-1 rounded-lg text-[10px] font-medium transition-all",
                                                dateRange === d
                                                    ? "bg-green-800 text-cream-50"
                                                    : "bg-cream-100 text-cream-500 hover:bg-cream-200"
                                            )}
                                        >
                                            {d === "all" ? "Tất cả" : d === "7d" ? "7 ngày" : d === "30d" ? "30 ngày" : "90 ngày"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Records Table */}
                            <div className="rounded-xl border border-cream-200 bg-white overflow-hidden shadow-xs">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-green-900 text-cream-50 text-xs">
                                            <th className="px-4 py-2.5 text-left font-semibold">Loại & Nguyên nhân</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Sản phẩm / Nguyên liệu</th>
                                            <th className="px-4 py-2.5 text-right font-semibold">SL</th>
                                            <th className="px-4 py-2.5 text-right font-semibold">Giá trị</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Chi tiết lý do</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Thời gian</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-12 text-center text-cream-400">
                                                    <p className="text-xs">
                                                        Chưa có ghi nhận nào {filterType !== "ALL" || searchQuery ? "phù hợp bộ lọc" : ""}
                                                    </p>
                                                </td>
                                            </tr>
                                        )}
                                        {filtered.map((r, i) => {
                                            const config = TYPE_CONFIG[r.type]
                                            const reasonLabel = r.reasonCategory ? WASTE_REASON_LABELS[r.reasonCategory] : null
                                            const ReasonIcon = r.reasonCategory ? (REASON_ICONS[r.reasonCategory] || Package) : null

                                            return (
                                                <tr
                                                    key={r.id}
                                                    className={cn(
                                                        "border-t border-cream-100 hover:bg-cream-50/50 transition-colors",
                                                        i % 2 === 0 && "bg-cream-50/30"
                                                    )}
                                                >
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <Badge className={cn("text-[10px] px-1.5 inline-flex items-center gap-1", config.bgColor, config.color, "border border-current/20")}>
                                                                {config.label}
                                                            </Badge>
                                                            {reasonLabel && ReasonIcon && (
                                                                <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium inline-flex items-center gap-1", reasonLabel.badge)}>
                                                                    {reasonLabel.label}
                                                                </span>
                                                            )}
                                                            {r.isPendingSupplierClaim && (
                                                                <span
                                                                    className={cn(
                                                                        "text-[9px] px-1.5 py-0.5 rounded border font-medium inline-flex items-center gap-1",
                                                                        r.isClaimSettled
                                                                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                                            : "bg-blue-50 text-blue-800 border-blue-200"
                                                                    )}
                                                                >
                                                                    {r.isClaimSettled ? "Đã đổi bù" : "Chờ NCC bù"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            {r.productId ? (
                                                                <Wine className="h-3.5 w-3.5 text-wine-600 shrink-0" />
                                                            ) : (
                                                                <Package className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                                            )}
                                                            <span className="text-xs font-medium text-green-950">
                                                                {r.productName ?? r.ingredientName ?? "—"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-mono text-xs text-green-900">
                                                        {r.quantity}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-red-700">
                                                        {formatVND(r.totalCost)}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs text-stone-600 max-w-[200px] truncate" title={r.reason ?? undefined}>
                                                        {r.reason ?? "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-[11px] text-cream-500 whitespace-nowrap">
                                                        {new Date(r.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                                                        {" "}
                                                        {new Date(r.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                                {filtered.length > 0 && (
                                    <div className="px-4 py-2.5 border-t border-cream-100 bg-cream-50/50 flex items-center justify-between">
                                        <span className="text-[11px] text-cream-500">
                                            Hiển thị {filtered.length} / {report.records.length} bản ghi
                                        </span>
                                        <span className="text-[11px] font-mono font-bold text-red-700">
                                            Tổng: {formatVND(filtered.reduce((s, r) => s + r.totalCost, 0))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Monthly Trend Chart */}
                    {report.summary.byMonth.length > 0 && (
                        <div className="rounded-xl border border-cream-200 bg-white p-5">
                            <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                                Xu hướng Theo tháng
                            </h3>
                            <div className="flex items-end gap-3 h-40">
                                {report.summary.byMonth.slice(-6).map((m, idx) => {
                                    const maxCost = Math.max(...report.summary.byMonth.map((x) => x.cost), 1)
                                    const heightPct = Math.max(5, (m.cost / maxCost) * 100)
                                    return (
                                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-[9px] font-mono text-cream-500">
                                                {formatVND(m.cost)}
                                            </span>
                                            <span className="text-[9px] font-mono text-cream-400">
                                                {m.count} lần
                                            </span>
                                            <div
                                                className="w-full bg-gradient-to-t from-red-500 to-red-300 rounded-t-md transition-all hover:from-red-600 hover:to-red-400"
                                                style={{ height: `${heightPct}%` }}
                                            />
                                            <span className="text-[10px] text-cream-600 font-medium">
                                                {m.month.slice(5)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Analytics Sidebar (1/3) */}
                <div className="space-y-4">
                    {/* Top Offenders */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Top Hao hụt Nhiều nhất
                        </h3>
                        {topOffenders.length > 0 ? (
                            <div className="space-y-2.5">
                                {topOffenders.map((item, idx) => (
                                    <div
                                        key={item.name}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cream-50/70 border border-cream-100 hover:border-cream-300 transition-all"
                                    >
                                        <span className={cn(
                                            "flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold shrink-0",
                                            idx === 0 ? "bg-red-100 text-red-700" :
                                                idx === 1 ? "bg-amber-100 text-amber-700" :
                                                    idx === 2 ? "bg-orange-100 text-orange-700" :
                                                        "bg-cream-200 text-cream-600"
                                        )}>
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                {item.type === "product" ? (
                                                    <Wine className="h-3 w-3 text-wine-600 shrink-0" />
                                                ) : (
                                                    <Package className="h-3 w-3 text-green-600 shrink-0" />
                                                )}
                                                <p className="text-[11px] font-semibold text-green-900 truncate">{item.name}</p>
                                            </div>
                                            <p className="text-[9px] text-cream-400">{item.count} đơn vị</p>
                                        </div>
                                        <span className="text-[11px] font-mono font-bold text-red-700 shrink-0">
                                            {formatVND(item.cost)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-cream-400 text-center py-4">Chưa có dữ liệu</p>
                        )}
                    </div>

                    {/* Staff Breakdown */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Theo Nhân viên
                        </h3>
                        {staffBreakdown.length > 0 ? (
                            <div className="space-y-3">
                                {staffBreakdown.map((item) => {
                                    const maxCost = staffBreakdown[0]?.cost ?? 1
                                    const pct = Math.round((item.cost / maxCost) * 100)
                                    return (
                                        <div key={item.name}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px] text-cream-600">{item.name}</span>
                                                <span className="text-[11px] font-mono text-cream-500">
                                                    {item.count} lần · <span className="text-red-700 font-bold">{formatVND(item.cost)}</span>
                                                </span>
                                            </div>
                                            <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-300 rounded-full transition-all duration-500"
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

                    {/* Week over Week */}
                    <div className="rounded-xl border border-cream-200 bg-gradient-to-br from-cream-50 to-cream-100/30 p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            So sánh Tuần
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-white border border-cream-200 text-center">
                                <p className="text-[9px] text-cream-400 uppercase mb-1">Tuần này</p>
                                <p className="font-mono text-lg font-bold text-green-900">{formatVND(recentTrend.currentCost)}</p>
                                <p className="text-[10px] text-cream-400">{recentTrend.currentCount} sự cố</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white border border-cream-200 text-center">
                                <p className="text-[9px] text-cream-400 uppercase mb-1">Tuần trước</p>
                                <p className="font-mono text-lg font-bold text-cream-600">{formatVND(recentTrend.previousCost)}</p>
                                <p className="text-[10px] text-cream-400">{recentTrend.previousCount} sự cố</p>
                            </div>
                        </div>
                        <div className={cn(
                            "mt-3 p-2.5 rounded-lg text-center text-xs font-bold",
                            recentTrend.change > 0 ? "bg-red-50 text-red-700 border border-red-200" :
                                recentTrend.change < 0 ? "bg-green-50 text-green-700 border border-green-200" :
                                    "bg-cream-100 text-cream-500 border border-cream-200"
                        )}>
                            {recentTrend.change > 0 && <ArrowDownRight className="h-4 w-4 inline mr-1 rotate-180" />}
                            {recentTrend.change < 0 && <ArrowDownRight className="h-4 w-4 inline mr-1" />}
                            {recentTrend.change === 0 ? "Ổn định" :
                                recentTrend.change > 0 ? `Tăng ${recentTrend.change}% — Cần chú ý` :
                                    `Giảm ${Math.abs(recentTrend.change)}% — Tốt!`}
                        </div>
                    </div>

                    {/* Benchmark Info */}
                    <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100/30 p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-3">
                            Tiêu chuẩn Ngành F&B
                        </h3>
                        <div className="space-y-2.5 text-[11px] text-cream-600">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-green-100/50 border border-green-200">
                                <span>Waste vs Revenue thấp</span>
                                <span className="font-bold text-green-700">&lt; 2%</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200">
                                <span>Trung bình ngành</span>
                                <span className="font-bold text-amber-700">2-4%</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-200">
                                <span>Cao — cần cải thiện</span>
                                <span className="font-bold text-red-700">&gt; 5%</span>
                            </div>
                            <div className="mt-2 p-2.5 rounded-lg bg-white border border-cream-200 text-center">
                                <p className="text-[10px] text-cream-400">Kết quả của bạn</p>
                                <p className={cn("font-mono text-xl font-bold mt-1",
                                    report.summary.wastePctOfRevenue <= 2 ? "text-green-700" :
                                        report.summary.wastePctOfRevenue <= 4 ? "text-amber-700" : "text-red-700"
                                )}>
                                    {report.summary.wastePctOfRevenue}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Record Waste Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-cream-200 p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
                            <div>
                                <h2 className="font-display text-lg font-bold text-green-900">
                                    Ghi nhận Hao hụt / Vang hỏng
                                </h2>
                                <p className="text-xs text-cream-500 mt-0.5">
                                    Ghi nhận chính xác nguyên nhân để phân bổ đúng vào True COGS
                                </p>
                            </div>
                            <button onClick={() => setShowForm(false)} className="text-cream-400 hover:text-cream-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Type */}
                            <div>
                                <label className="text-xs font-semibold text-green-900 mb-1 block">Loại hao hụt</label>
                                <div className="flex gap-2">
                                    {(["WASTE", "SPOILAGE", "BREAKAGE"] as WasteType[]).map((t) => {
                                        const config = TYPE_CONFIG[t]
                                        return (
                                            <button
                                                key={t}
                                                onClick={() => setFormType(t)}
                                                className={cn(
                                                    "flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                                                    formType === t
                                                        ? `${config.bgColor} ${config.color} border-current`
                                                        : "bg-cream-50 text-cream-500 border-cream-200 hover:bg-cream-100"
                                                )}
                                            >
                                                <span className="inline-flex items-center gap-1.5">
                                                    <config.icon className="h-3.5 w-3.5 shrink-0" />
                                                    {config.label}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Target: Product, Opened Wine Bottle, or Ingredient */}
                            <div>
                                <label className="text-xs font-semibold text-green-900 mb-1 block">Đối tượng hao hụt</label>
                                <div className="grid grid-cols-3 gap-1.5 mb-2">
                                    <button
                                        onClick={() => {
                                            setFormTarget("product")
                                            setFormBottleId("")
                                        }}
                                        className={cn(
                                            "px-2 py-2 rounded-lg border text-xs font-medium text-center",
                                            formTarget === "product"
                                                ? "bg-green-50 text-green-800 border-green-300 font-bold"
                                                : "bg-cream-50 text-cream-500 border-cream-200"
                                        )}
                                    >
                                        <Wine className="h-3.5 w-3.5 mx-auto mb-0.5" /> Sản phẩm / Rượu
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFormTarget("opened_bottle")
                                            setFormProductId("")
                                            setFormIngredientId("")
                                        }}
                                        className={cn(
                                            "px-2 py-2 rounded-lg border text-xs font-medium text-center",
                                            formTarget === "opened_bottle"
                                                ? "bg-amber-50 text-amber-900 border-amber-300 font-bold"
                                                : "bg-cream-50 text-cream-500 border-cream-200"
                                        )}
                                    >
                                        <Wine className="h-3.5 w-3.5 mx-auto mb-0.5 text-amber-700" /> Vang mở ly ({openWines.length})
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFormTarget("ingredient")
                                            setFormBottleId("")
                                        }}
                                        className={cn(
                                            "px-2 py-2 rounded-lg border text-xs font-medium text-center",
                                            formTarget === "ingredient"
                                                ? "bg-green-50 text-green-800 border-green-300 font-bold"
                                                : "bg-cream-50 text-cream-500 border-cream-200"
                                        )}
                                    >
                                        <Package className="h-3.5 w-3.5 mx-auto mb-0.5" /> Nguyên liệu
                                    </button>
                                </div>

                                {formTarget === "opened_bottle" ? (
                                    <div className="space-y-2">
                                        <select
                                            value={formBottleId}
                                            onChange={(e) => {
                                                const id = e.target.value
                                                setFormBottleId(id)
                                                const bottle = openWines.find((b) => b.id === id)
                                                if (bottle) {
                                                    setFormQty(bottle.glassesLeft)
                                                    setFormReasonCategory("OXIDATION")
                                                    setFormReason(`Chai mở ly quá ${bottle.hoursOpened}h bị oxy hoá`)
                                                }
                                            }}
                                            className="w-full rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-2 text-xs text-amber-950 focus:border-amber-600 focus:outline-none"
                                        >
                                            <option value="">— Chọn chai vang đang mở ly —</option>
                                            {openWines.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.productName} (Còn {b.glassesLeft}/{b.glassesTotal} ly · Đã mở {b.hoursOpened}h) — {formatVND(b.remainingCost)}
                                                </option>
                                            ))}
                                        </select>
                                        {openWines.length === 0 && (
                                            <p className="text-[11px] text-stone-400 italic">Hiện không có chai vang nào đang mở ly trong kho.</p>
                                        )}
                                    </div>
                                ) : formTarget === "product" ? (
                                    <select
                                        value={formProductId}
                                        onChange={(e) => setFormProductId(e.target.value)}
                                        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs text-green-900 focus:border-green-600 focus:outline-none"
                                    >
                                        <option value="">— Chọn sản phẩm —</option>
                                        {formOptions.products.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.type}) — {formatVND(p.costPrice)}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <select
                                        value={formIngredientId}
                                        onChange={(e) => setFormIngredientId(e.target.value)}
                                        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs text-green-900 focus:border-green-600 focus:outline-none"
                                    >
                                        <option value="">— Chọn nguyên liệu —</option>
                                        {formOptions.ingredients.map((i) => (
                                            <option key={i.id} value={i.id}>
                                                {i.name} ({i.unit}) — {formatVND(i.costPerUnit)}/{i.unit}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Reason Category (Wine Bar Specialization) */}
                            <div>
                                <label className="text-xs font-semibold text-green-900 mb-1 block">
                                    Nguyên nhân cụ thể (Wine Bar)
                                </label>
                                <select
                                    value={formReasonCategory}
                                    onChange={(e) => {
                                        const cat = e.target.value as WasteReasonCategory
                                        setFormReasonCategory(cat)
                                        if (cat === "CORKED") {
                                            setFormPendingSupplierClaim(true)
                                            if (!formReason) setFormReason("Chai vang bị lỗi nút bần TCA mốc ẩm, khách yêu cầu đổi chai")
                                        }
                                    }}
                                    className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs text-green-900 focus:border-green-600 focus:outline-none"
                                >
                                    <option value="CORKED">Lỗi nút bần (Corked / TCA mốc)</option>
                                    <option value="OXIDATION">Oxy hoá vang mở ly (Oxidized)</option>
                                    <option value="BREAKAGE">Rơi vỡ chai / ly</option>
                                    <option value="SPILLAGE">Đổ / tràn khi phục vụ</option>
                                    <option value="TASTING">Nếm thử / Training / Sample</option>
                                    <option value="SPOILAGE">Hư hỏng nguyên liệu bếp</option>
                                    <option value="OTHER">Lý do khác</option>
                                </select>
                            </div>

                            {/* Quantity */}
                            <div>
                                <label className="text-xs font-semibold text-green-900 mb-1 block">
                                    Số lượng {formTarget === "opened_bottle" ? "(Số ly huỷ)" : "(Chai / Suất / Kg)"}
                                </label>
                                <input
                                    type="number"
                                    min={0.1}
                                    step={formTarget === "opened_bottle" ? 1 : 0.1}
                                    value={formQty}
                                    onChange={(e) => setFormQty(Number(e.target.value))}
                                    className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs text-green-900 focus:border-green-600 focus:outline-none font-mono"
                                />
                            </div>

                            {/* Pending Supplier Claim Checkbox */}
                            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-200 bg-blue-50/70 text-xs text-blue-950 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formPendingSupplierClaim}
                                    onChange={(e) => setFormPendingSupplierClaim(e.target.checked)}
                                    className="mt-0.5 rounded border-blue-300 text-blue-700 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="font-bold block">Yêu cầu Nhà cung cấp đổi bù (Supplier Claim)</span>
                                    <span className="text-[11px] text-blue-800/80 block mt-0.5">
                                        Vang lỗi corked / vỡ do vận chuyển: Tạm thời theo dõi riêng, không tính mất đứt vào COGS cho tới khi đối soát xong.
                                    </span>
                                </div>
                            </label>

                            {/* Reason details */}
                            <div>
                                <label className="text-xs font-semibold text-green-900 mb-1 block">Chi tiết lý do *</label>
                                <textarea
                                    value={formReason}
                                    onChange={(e) => setFormReason(e.target.value)}
                                    rows={2}
                                    placeholder="VD: Khách thử thấy mùi nút bần ẩm, đã mở chai mới thay thế..."
                                    className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs text-green-900 focus:border-green-600 focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-5">
                            <Button
                                onClick={() => setShowForm(false)}
                                variant="outline"
                                className="flex-1 border-cream-300"
                            >
                                Hủy
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {submitting ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                ) : (
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Ghi nhận hao hụt
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settle Supplier Claim Modal */}
            {settleRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-cream-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-display text-base font-bold text-green-900 flex items-center gap-1.5">
                                Đối soát Đổi bù Nhà cung cấp
                            </h2>
                            <button onClick={() => setSettleRecord(null)} className="text-stone-400 hover:text-stone-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 mb-4 text-xs space-y-1">
                            <p className="font-bold text-blue-950">{settleRecord.productName ?? "Sản phẩm"}</p>
                            <p className="text-blue-800">
                                Giá trị: <span className="font-mono font-bold">{formatVND(settleRecord.totalCost)}</span> · SL: {settleRecord.quantity}
                            </p>
                            <p className="text-blue-700/80 text-[11px] truncate">Lý do: {settleRecord.reason}</p>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-stone-800 block">Kết quả đối soát với NCC:</label>
                            <div className="space-y-2">
                                {(
                                    [
                                        { action: "REPLACED_BOTTLE", label: "NCC đã giao chai mới đền bù (Hoàn nhập kho)" },
                                        { action: "REFUNDED", label: "NCC hoàn tiền / trừ vào công nợ NCC" },
                                        { action: "REJECTED", label: "NCC từ chối (Chuyển thành chi phí mất đứt của quán)" },
                                    ] as const
                                ).map((item) => (
                                    <label
                                        key={item.action}
                                        className={cn(
                                            "flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all",
                                            settleAction === item.action
                                                ? "border-green-600 bg-green-50/70 text-green-950 font-bold"
                                                : "border-cream-200 hover:bg-cream-50 text-stone-700"
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="settleAction"
                                            checked={settleAction === item.action}
                                            onChange={() => setSettleAction(item.action)}
                                            className="text-green-800"
                                        />
                                        <span>{item.label}</span>
                                    </label>
                                ))}
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-stone-800 mb-1 block">Ghi chú đối soát (tùy chọn)</label>
                                <textarea
                                    value={settleNotes}
                                    onChange={(e) => setSettleNotes(e.target.value)}
                                    rows={2}
                                    placeholder="VD: Số phiếu giao hàng NCC, người giao hàng..."
                                    className="w-full rounded-lg border border-cream-300 px-3 py-2 text-xs focus:border-green-600 focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-5">
                            <Button
                                onClick={() => setSettleRecord(null)}
                                variant="outline"
                                className="flex-1 border-cream-300"
                            >
                                Đóng
                            </Button>
                            <Button
                                onClick={handleSettleClaim}
                                disabled={settling}
                                className="flex-1 bg-green-900 hover:bg-green-800 text-white"
                            >
                                {settling ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                Xác nhận đối soát
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="text-center pt-2 border-t border-cream-100">
                <p className="text-[10px] text-cream-400 italic">
                    Hao hụt tự động tính vào chi phí P&L · Bao gồm waste, spoilage, và breakage · Benchmark ngành F&B: &lt;2%
                </p>
            </div>
        </div>
    )
}
