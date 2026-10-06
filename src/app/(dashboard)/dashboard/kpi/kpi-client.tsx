"use client"

import { useState, useCallback } from "react"
import { Target, Plus, TrendingUp, TrendingDown, Settings2, Check, Loader2, Trophy, BarChart3, X, Zap } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    getKpiMetrics, getKpiOverview, upsertTarget, bulkUpsertTargets,
    cascadeMonthlyToWeekly, createKpiMetric, toggleKpiMetric, deleteKpiMetric,
    getKpiHistory, isKpiEnabled, setKpiEnabled,
    type KpiMetricData, type KpiOverview,
} from "@/actions/kpi"
import { useAuthStore } from "@/stores/auth-store"

const MONTH_NAMES = ["", "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"]

function formatKpiValue(value: number, unit: string): string {
    if (unit === "₫" || unit === "₫/đơn") {
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
        if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
        return value.toLocaleString("vi-VN")
    }
    return value.toLocaleString("vi-VN")
}

function ProgressBar({ pct, size = "md" }: { pct: number; size?: "sm" | "md" }) {
    const clamped = Math.min(pct, 150)
    const color = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"
    const bgColor = pct >= 100 ? "bg-green-100" : pct >= 70 ? "bg-amber-100" : "bg-red-100"
    return (
        <div className={cn("w-full rounded-full overflow-hidden", bgColor, size === "sm" ? "h-1.5" : "h-2.5")}>
            <div
                className={cn("h-full rounded-full transition-all duration-500", color)}
                style={{ width: `${Math.min(clamped, 100)}%` }}
            />
        </div>
    )
}

function GradeIcon({ pct }: { pct: number }) {
    if (pct >= 100) return <Trophy className="h-5 w-5 text-green-600" />
    if (pct >= 70) return <TrendingUp className="h-5 w-5 text-amber-600" />
    return <TrendingDown className="h-5 w-5 text-red-500" />
}

interface KpiClientProps {
    initialEnabled: boolean
    initialMetrics: KpiMetricData[]
    initialOverview: KpiOverview[]
}

export default function KpiClient({ initialEnabled, initialMetrics, initialOverview }: KpiClientProps) {
    const { staff } = useAuthStore()
    const now = new Date()
    const [year] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)

    const [enabled, setEnabled] = useState(initialEnabled)
    const [metrics, setMetrics] = useState<KpiMetricData[]>(initialMetrics)
    const [overview, setOverview] = useState<KpiOverview[]>(initialOverview)

    const [activeTab, setActiveTab] = useState<"overview" | "set_targets" | "metrics">("overview")
    const [loading, setLoading] = useState(false)

    // Set targets state
    const [targetValues, setTargetValues] = useState<Record<string, string>>({})
    const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
    const [historyData, setHistoryData] = useState<Record<string, { label: string; target: number; actual: number; pct: number }[]>>({})

    // New metric dialog
    const [newMetricOpen, setNewMetricOpen] = useState(false)
    const [newCode, setNewCode] = useState("")
    const [newName, setNewName] = useState("")
    const [newUnit, setNewUnit] = useState("")

    const refreshData = useCallback(async () => {
        setLoading(true)
        const [m, o, e] = await Promise.all([
            getKpiMetrics(),
            getKpiOverview(year, month),
            isKpiEnabled(),
        ])
        setMetrics(m)
        setOverview(o)
        setEnabled(e)
        setLoading(false)
    }, [year, month])

    const handleToggleKpi = async () => {
        const newVal = !enabled
        await setKpiEnabled(newVal)
        setEnabled(newVal)
        toast.success(newVal ? "Đã bật chỉ tiêu KPI" : "Đã tắt chỉ tiêu KPI")
    }

    const handleSetMonthlyTargets = async () => {
        if (!staff) return
        const targets = Object.entries(targetValues)
            .filter(([, v]) => v && Number(v) > 0)
            .map(([metricId, v]) => ({
                metricId, period: "MONTHLY" as const, year, month,
                targetValue: Number(v), setBy: staff.id,
            }))

        if (targets.length === 0) { toast.error("Chưa nhập chỉ tiêu nào"); return }

        setLoading(true)
        await bulkUpsertTargets(targets)
        await cascadeMonthlyToWeekly({ year, month, setBy: staff.id })
        await refreshData()
        setTargetValues({})
        toast.success(`Đã lưu ${targets.length} chỉ tiêu tháng ${month} + tự chia tuần`)
    }

    const handleSaveSingleTarget = async (metricId: string, value: number) => {
        if (!staff) return
        await upsertTarget({
            metricId, period: "MONTHLY", year, month,
            targetValue: value, setBy: staff.id,
        })
        await cascadeMonthlyToWeekly({ year, month, setBy: staff.id })
        await refreshData()
        toast.success("Đã lưu chỉ tiêu")
    }

    const handleLoadHistory = async (code: string) => {
        if (historyData[code]) return
        const data = await getKpiHistory(code, 6)
        setHistoryData(prev => ({ ...prev, [code]: data }))
    }

    const handleCreateMetric = async () => {
        if (!newCode.trim() || !newName.trim()) { toast.error("Thiếu mã hoặc tên"); return }
        setLoading(true)
        const result = await createKpiMetric({ code: newCode.trim(), name: newName.trim(), unit: newUnit.trim(), icon: "" })
        if (result.success) {
            toast.success(`Đã tạo chỉ số "${newName}"`)
            setNewMetricOpen(false)
            setNewCode(""); setNewName(""); setNewUnit("")
            await refreshData()
        } else {
            toast.error(result.error)
        }
        setLoading(false)
    }

    // ─── Not enabled state
    if (!enabled) {
        return (
            <div className="min-h-screen">
                <div className="border-b border-cream-300 bg-cream-50 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Chỉ tiêu KPI</h1>
                            <p className="text-sm text-cream-500">Quản lý chỉ tiêu doanh thu, đơn hàng, và các KPI khác</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-32 px-6">
                    <h2 className="text-xl font-bold text-green-900 mb-2">Tính năng KPI chưa được bật</h2>
                    <p className="text-sm text-cream-500 text-center max-w-md mb-6">
                        Bật tính năng chỉ tiêu KPI để theo dõi doanh thu, số đơn, số khách và nhiều chỉ số khác theo tháng, tuần và ca.
                    </p>
                    <Button onClick={handleToggleKpi} className="bg-green-700 text-white hover:bg-green-600">
                        <Zap className="mr-2 h-4 w-4" />
                        Bật KPI ngay
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <div className="border-b border-cream-300 bg-cream-50 px-6 py-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Chỉ tiêu KPI</h1>
                            <p className="text-sm text-cream-500">
                                {MONTH_NAMES[month]} {year} · {metrics.length} chỉ số đang theo dõi
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Month selector */}
                        <select
                            value={month}
                            onChange={async (e) => { setMonth(Number(e.target.value)); setLoading(true); const o = await getKpiOverview(year, Number(e.target.value)); setOverview(o); setLoading(false) }}
                            className="rounded-lg border border-cream-300 bg-cream-100 px-3 py-2 text-sm font-medium text-green-900"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>T{i + 1}/{year}</option>
                            ))}
                        </select>
                        <Badge className={cn("text-xs", enabled ? "bg-green-100 text-green-700" : "bg-cream-200 text-cream-500")}>
                            {enabled ? "KPI Bật" : "KPI Tắt"}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-cream-300 bg-cream-50 px-6">
                {[
                    { key: "overview", label: "Tổng quan", icon: BarChart3 },
                    { key: "set_targets", label: "Đặt chỉ tiêu", icon: Target },
                    { key: "metrics", label: "Quản lý chỉ số", icon: Settings2 },
                ].map(tab => {
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as typeof activeTab)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                                activeTab === tab.key
                                    ? "border-green-700 text-green-900"
                                    : "border-transparent text-cream-500 hover:text-green-900"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            <div className="p-6">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-cream-400" />
                    </div>
                )}

                {/* ═══════ TAB: OVERVIEW ═══════ */}
                {!loading && activeTab === "overview" && (
                    <div className="space-y-6">
                        {/* KPI Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {overview.filter(o => o.monthly).map(o => {
                                const m = o.monthly!
                                return (
                                    <div
                                        key={o.metric.id}
                                        onClick={() => {
                                            if (expandedMetric === o.metric.code) {
                                                setExpandedMetric(null)
                                            } else {
                                                setExpandedMetric(o.metric.code)
                                                handleLoadHistory(o.metric.code)
                                            }
                                        }}
                                        className="rounded-xl border border-cream-300 bg-cream-50 p-5 hover:border-green-400 hover:shadow-sm transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <p className="text-sm font-bold text-green-900">{o.metric.name}</p>
                                                    <p className="text-[10px] text-cream-500">Tháng {month}</p>
                                                </div>
                                            </div>
                                            <GradeIcon pct={m.pct} />
                                        </div>

                                        <div className="flex items-end justify-between mb-2">
                                            <div>
                                                <p className="text-2xl font-mono font-bold text-green-900">
                                                    {formatKpiValue(m.actual, o.metric.unit)}
                                                </p>
                                                <p className="text-[10px] text-cream-400">
                                                    / {formatKpiValue(m.target, o.metric.unit)} {o.metric.unit}
                                                </p>
                                            </div>
                                            <div className={cn(
                                                "text-right",
                                                m.pct >= 100 ? "text-green-600" : m.pct >= 70 ? "text-amber-600" : "text-red-500"
                                            )}>
                                                <p className="text-xl font-mono font-bold">{m.pct}%</p>
                                            </div>
                                        </div>

                                        <ProgressBar pct={m.pct} />

                                        {/* Weekly breakdown */}
                                        {o.weekly && (
                                            <div className="mt-3 pt-3 border-t border-cream-200 flex items-center justify-between">
                                                <p className="text-[10px] text-cream-500">Tuần này</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-green-900">
                                                        {formatKpiValue(o.weekly.actual, o.metric.unit)}
                                                    </span>
                                                    <span className="text-[10px] text-cream-400">
                                                        / {formatKpiValue(o.weekly.target, o.metric.unit)}
                                                    </span>
                                                    <Badge className={cn(
                                                        "text-[9px] px-1 py-0",
                                                        o.weekly.pct >= 100 ? "bg-green-100 text-green-700" :
                                                            o.weekly.pct >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                                    )}>
                                                        {o.weekly.pct}%
                                                    </Badge>
                                                </div>
                                            </div>
                                        )}

                                        {/* Expanded: History chart */}
                                        {expandedMetric === o.metric.code && historyData[o.metric.code] && (
                                            <div className="mt-4 pt-4 border-t border-cream-200">
                                                <p className="text-[10px] font-bold uppercase text-cream-500 mb-2">Lịch sử 6 tháng</p>
                                                <div className="flex items-end gap-1 h-20">
                                                    {historyData[o.metric.code].map((h, i) => {
                                                        const maxVal = Math.max(...historyData[o.metric.code].map(x => Math.max(x.target, x.actual)), 1)
                                                        const tH = (h.target / maxVal) * 100
                                                        const aH = (h.actual / maxVal) * 100
                                                        return (
                                                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                                                <div className="w-full flex gap-0.5 items-end" style={{ height: "60px" }}>
                                                                    <div className="flex-1 bg-cream-200 rounded-t" style={{ height: `${tH}%` }} title={`Target: ${h.target}`} />
                                                                    <div className={cn("flex-1 rounded-t", h.pct >= 100 ? "bg-green-400" : h.pct >= 70 ? "bg-amber-400" : "bg-red-400")} style={{ height: `${aH}%` }} title={`Actual: ${h.actual}`} />
                                                                </div>
                                                                <p className="text-[8px] text-cream-400">{h.label}</p>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-cream-200" /><span className="text-[8px] text-cream-400">Chỉ tiêu</span></div>
                                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-green-400" /><span className="text-[8px] text-cream-400">Thực tế</span></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {overview.filter(o => o.monthly).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-cream-300 bg-cream-100">
                                <p className="text-cream-500 font-medium">Chưa có chỉ tiêu nào cho tháng {month}</p>
                                <Button onClick={() => setActiveTab("set_targets")} variant="outline" className="mt-3">
                                    <Plus className="mr-1 h-4 w-4" />
                                    Đặt chỉ tiêu ngay
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════ TAB: SET TARGETS ═══════ */}
                {!loading && activeTab === "set_targets" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-green-900">Đặt chỉ tiêu {MONTH_NAMES[month]}</h2>
                                <p className="text-sm text-cream-500">
                                    Nhập mục tiêu tháng → hệ thống tự chia đều theo tuần
                                </p>
                            </div>
                            <Button onClick={handleSetMonthlyTargets} disabled={loading} className="bg-green-700 text-white hover:bg-green-600">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Lưu & Chia tuần
                            </Button>
                        </div>

                        <div className="rounded-xl border border-cream-300 bg-cream-50 divide-y divide-cream-200">
                            {metrics.map(m => {
                                const existing = overview.find(o => o.metric.id === m.id)
                                const currentTarget = existing?.monthly?.target ?? 0
                                return (
                                    <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-green-900">{m.name}</p>
                                            {currentTarget > 0 && (
                                                <p className="text-[10px] text-cream-500">
                                                    Hiện tại: {formatKpiValue(currentTarget, m.unit)} {m.unit}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                placeholder={currentTarget > 0 ? String(currentTarget) : `Mục tiêu (${m.unit})`}
                                                value={targetValues[m.id] ?? ""}
                                                onChange={(e) => setTargetValues(prev => ({ ...prev, [m.id]: e.target.value }))}
                                                className="w-40 h-9 text-sm border-cream-300 bg-cream-100 font-mono"
                                            />
                                            <span className="text-xs text-cream-400 w-12">{m.unit}</span>
                                            {targetValues[m.id] && Number(targetValues[m.id]) > 0 && (
                                                <button
                                                    onClick={() => handleSaveSingleTarget(m.id, Number(targetValues[m.id]))}
                                                    className="rounded-lg p-2 text-green-700 hover:bg-green-100 transition-all"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Cascade explanation */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                            <div className="flex items-start gap-3">
                                <div>
                                    <p className="text-sm font-bold text-blue-800">Cascade tự động</p>
                                    <p className="text-xs text-blue-600 mt-1">
                                        Khi bạn lưu chỉ tiêu tháng, hệ thống sẽ <strong>tự chia đều</strong> sang các tuần trong tháng.
                                        Quản lý ca có thể điều chỉnh chỉ tiêu ca dựa trên chỉ tiêu tuần.
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 text-blue-700">
                                        <Badge className="bg-blue-100 text-blue-700 text-[9px]">Tháng</Badge>
                                        <Badge className="bg-blue-100 text-blue-700 text-[9px]">Tuần (÷4~5)</Badge>
                                        <Badge className="bg-blue-100 text-blue-700 text-[9px]">Ca (gợi ý)</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════ TAB: MANAGE METRICS ═══════ */}
                {!loading && activeTab === "metrics" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-green-900">Quản lý chỉ số KPI</h2>
                                <p className="text-sm text-cream-500">Thêm, bật/tắt các chỉ số theo dõi</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={() => setNewMetricOpen(true)} className="bg-green-700 text-white hover:bg-green-600">
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Thêm chỉ số
                                </Button>
                                <Button onClick={handleToggleKpi} variant="outline" className={cn("border-cream-300", !enabled && "border-red-300 text-red-600")}>
                                    <Settings2 className="mr-1.5 h-4 w-4" />
                                    {enabled ? "Tắt KPI" : "Bật KPI"}
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-xl border border-cream-300 bg-cream-50 divide-y divide-cream-200">
                            {metrics.map(m => (
                                <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-green-900">{m.name}</p>
                                            <Badge className="text-[9px] bg-cream-200 text-cream-500 border-cream-300">{m.code}</Badge>
                                            {m.isDefault && <Badge className="text-[9px] bg-blue-100 text-blue-600">Mặc định</Badge>}
                                        </div>
                                        <p className="text-[10px] text-cream-400">Đơn vị: {m.unit || "—"}</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={async () => { await toggleKpiMetric(m.id, !m.isActive); await refreshData() }}
                                            className={cn("rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all",
                                                m.isActive ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700" : "bg-cream-200 text-cream-500 hover:bg-green-100 hover:text-green-700"
                                            )}
                                        >
                                            {m.isActive ? "Đang bật" : "Đã tắt"}
                                        </button>
                                        {!m.isDefault && (
                                            <button
                                                onClick={async () => {
                                                    const r = await deleteKpiMetric(m.id)
                                                    if (r.success) { toast.success("Đã xóa"); await refreshData() }
                                                    else toast.error(r.error)
                                                }}
                                                className="rounded-lg p-1.5 text-cream-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* New Metric Dialog */}
            <Dialog open={newMetricOpen} onOpenChange={setNewMetricOpen}>
                <DialogContent className="bg-cream-50 border-cream-300 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-display text-xl text-green-900">Thêm chỉ số KPI</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-green-900">Mã chỉ số <span className="text-red-500">*</span></Label>
                            <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. new_customers" className="border-cream-300 bg-cream-100" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-green-900">Tên hiển thị <span className="text-red-500">*</span></Label>
                            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Khách mới" className="border-cream-300 bg-cream-100" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-green-900">Đơn vị</Label>
                            <Input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="e.g. khách" className="border-cream-300 bg-cream-100" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewMetricOpen(false)} className="border-cream-300">Hủy</Button>
                        <Button onClick={handleCreateMetric} disabled={loading || !newCode.trim() || !newName.trim()} className="bg-green-700 text-white hover:bg-green-600">
                            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                            Tạo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
