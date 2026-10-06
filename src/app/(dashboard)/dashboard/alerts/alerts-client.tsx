"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { RefreshCw, ShieldAlert, AlertCircle, Info, ChevronDown, ChevronUp, Filter, Bell, BellOff, Eye, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getInventoryAlerts, type InventoryAlert, type AlertSeverity } from "@/actions/inventory-alerts"
import { toast } from "sonner"

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; bgColor: string; borderColor: string; textDark: string; icon: React.ComponentType<{ className?: string }> }> = {
    CRITICAL: {
        label: "Quan trọng",
        color: "text-red-700",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        textDark: "text-red-800",
        icon: ShieldAlert,
    },
    WARNING: {
        label: "Cảnh báo",
        color: "text-amber-700",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-200",
        textDark: "text-amber-800",
        icon: AlertCircle,
    },
    INFO: {
        label: "Thông tin",
        color: "text-blue-700",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        textDark: "text-blue-800",
        icon: Info,
    },
}

const ALERT_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
    OUT_OF_STOCK: { label: "Hết hàng", icon: "" },
    LOW_STOCK: { label: "Tồn kho thấp", icon: "" },
    OXIDATION_RISK: { label: "Nguy cơ oxy hóa", icon: "" },
    LOW_GLASSES: { label: "Còn ít ly", icon: "" },
    EXPIRY_APPROACHING: { label: "Sắp hết hạn", icon: "" },
}

export default function AlertsClient({ initial }: { initial: InventoryAlert[] }) {
    const [alerts, setAlerts] = useState<InventoryAlert[]>(initial)
    const [loading, setLoading] = useState(false)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
    const [expandedSeverity, setExpandedSeverity] = useState<Record<string, boolean>>({
        CRITICAL: true,
        WARNING: true,
        INFO: false,
    })
    const [activeFilter, setActiveFilter] = useState<string>("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

    const loadAlerts = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getInventoryAlerts()
            setAlerts(data)
            setLastRefresh(new Date())
        } catch (err) {
            console.error("[Alerts] loadAlerts failed:", err)
            toast.error("Không thể tải cảnh báo tồn kho")
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        const interval = setInterval(loadAlerts, 60000)
        return () => clearInterval(interval)
    }, [loadAlerts])

    const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL")
    const warningAlerts = alerts.filter((a) => a.severity === "WARNING")
    const infoAlerts = alerts.filter((a) => a.severity === "INFO")

    // Analytics
    const alertTypeDistribution = useMemo(() => {
        const map = new Map<string, number>()
        for (const a of alerts) {
            map.set(a.type, (map.get(a.type) ?? 0) + 1)
        }
        return Array.from(map.entries())
            .map(([type, count]) => ({ type, count, label: ALERT_TYPE_LABELS[type]?.label ?? type }))
            .sort((a, b) => b.count - a.count)
    }, [alerts])

    const topAffectedProducts = useMemo(() => {
        const map = new Map<string, { name: string; count: number; types: Set<string> }>()
        for (const a of alerts) {
            const name = a.productName ?? "Unknown"
            const entry = map.get(name) ?? { name, count: 0, types: new Set() }
            entry.count++
            entry.types.add(a.type)
            map.set(name, entry)
        }
        return Array.from(map.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [alerts])

    // Filtered alerts
    const filteredAlerts = useMemo(() => {
        let result = alerts.filter((a) => !dismissedAlerts.has(a.id))
        if (activeFilter !== "ALL") {
            result = result.filter((a) => a.type === activeFilter)
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(
                (a) =>
                    a.title.toLowerCase().includes(q) ||
                    a.description.toLowerCase().includes(q) ||
                    (a.productName?.toLowerCase().includes(q) ?? false)
            )
        }
        return result
    }, [alerts, activeFilter, searchQuery, dismissedAlerts])

    const grouped: { severity: AlertSeverity; items: InventoryAlert[] }[] = [
        { severity: "CRITICAL", items: filteredAlerts.filter((a) => a.severity === "CRITICAL") },
        { severity: "WARNING", items: filteredAlerts.filter((a) => a.severity === "WARNING") },
        { severity: "INFO", items: filteredAlerts.filter((a) => a.severity === "INFO") },
    ]

    const activeAlerts = alerts.length - dismissedAlerts.size

    // Unique alert types for filter
    const alertTypes = useMemo(() => {
        const types = new Set(alerts.map((a) => a.type))
        return Array.from(types)
    }, [alerts])

    return (
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900 flex items-center gap-2">
                        Trung tâm Cảnh báo
                    </h1>
                    <p className="text-sm text-cream-500 mt-0.5">
                        Giám sát toàn diện tồn kho, oxy hóa, hết hạn, và xu hướng bán hàng — Realtime
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-200">
                        <span className="text-[11px] text-cream-500">
                            Live · {lastRefresh.toLocaleTimeString("vi-VN")}
                        </span>
                    </div>
                    <Button
                        onClick={loadAlerts}
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

            {/* Summary Cards - Full width */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 px-5 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <ShieldAlert className="h-16 w-16 text-red-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-red-700">Quan trọng</span>
                    </div>
                    <p className="mt-2 font-mono text-3xl font-bold text-red-800">{criticalAlerts.length}</p>
                    <p className="text-[10px] text-red-600/70 mt-1">Cần xử lý ngay</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 px-5 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <AlertCircle className="h-16 w-16 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-amber-700">Cảnh báo</span>
                    </div>
                    <p className="mt-2 font-mono text-3xl font-bold text-amber-800">{warningAlerts.length}</p>
                    <p className="text-[10px] text-amber-600/70 mt-1">Nên theo dõi</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 px-5 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <Info className="h-16 w-16 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-blue-700">Thông tin</span>
                    </div>
                    <p className="mt-2 font-mono text-3xl font-bold text-blue-800">{infoAlerts.length}</p>
                    <p className="text-[10px] text-blue-600/70 mt-1">Tham khảo</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 px-5 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <Bell className="h-16 w-16 text-green-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-green-700">Đang hoạt động</span>
                    </div>
                    <p className="mt-2 font-mono text-3xl font-bold text-green-800">{activeAlerts}</p>
                    <p className="text-[10px] text-green-600/70 mt-1">/ {alerts.length} tổng cộng</p>
                </div>
                <div className="rounded-xl border border-cream-200 bg-gradient-to-br from-cream-50 to-cream-100/50 px-5 py-4 relative overflow-hidden">
                    <div className="absolute -right-3 -top-3 opacity-10">
                        <BellOff className="h-16 w-16 text-cream-400" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-cream-500">Đã xem</span>
                    </div>
                    <p className="mt-2 font-mono text-3xl font-bold text-cream-600">{dismissedAlerts.size}</p>
                    <p className="text-[10px] text-cream-400 mt-1">Đã bỏ qua</p>
                </div>
            </div>

            {/* Main Content: 2-column layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: Alert List (2/3) */}
                <div className="xl:col-span-2 space-y-4">
                    {/* Search & Filter Bar */}
                    <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-cream-200 bg-white">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm sản phẩm, cảnh báo..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-cream-200 bg-cream-50 text-green-900 focus:border-green-600 focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                onClick={() => setActiveFilter("ALL")}
                                className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all",
                                    activeFilter === "ALL"
                                        ? "bg-green-800 text-cream-50"
                                        : "bg-cream-100 text-cream-500 hover:bg-cream-200"
                                )}
                            >
                                Tất cả ({alerts.length})
                            </button>
                            {alertTypes.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setActiveFilter(t)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all",
                                        activeFilter === t
                                            ? "bg-green-800 text-cream-50"
                                            : "bg-cream-100 text-cream-500 hover:bg-cream-200"
                                    )}
                                >
                                    {ALERT_TYPE_LABELS[t]?.label ?? t} ({alerts.filter((a) => a.type === t).length})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Alert Groups */}
                    <div className="space-y-4">
                        {grouped.map(({ severity, items }) => {
                            const config = SEVERITY_CONFIG[severity]
                            const isExpanded = expandedSeverity[severity]
                            const Icon = config.icon

                            return (
                                <div key={severity} className={cn("rounded-xl border", config.borderColor, config.bgColor)}>
                                    {/* Group Header */}
                                    <button
                                        onClick={() =>
                                            setExpandedSeverity((prev) => ({ ...prev, [severity]: !prev[severity] }))
                                        }
                                        className="flex w-full items-center justify-between px-5 py-3.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon className={cn("h-4 w-4", config.color)} />
                                            <span className={cn("text-sm font-bold", config.color)}>
                                                {config.label}
                                            </span>
                                            <Badge className={cn("text-[10px] px-1.5 py-0", config.bgColor, config.color, "border", config.borderColor)}>
                                                {items.length}
                                            </Badge>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className={cn("h-4 w-4", config.color)} />
                                        ) : (
                                            <ChevronDown className={cn("h-4 w-4", config.color)} />
                                        )}
                                    </button>

                                    {/* Alert Items */}
                                    {isExpanded && items.length > 0 && (
                                        <div className="border-t px-5 pb-4 pt-2 space-y-2" style={{ borderColor: "inherit" }}>
                                            {items.map((alert) => (
                                                <div
                                                    key={alert.id}
                                                    className="flex items-start gap-3 rounded-lg bg-white/90 border border-cream-200 px-4 py-3 hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="text-xs font-bold text-green-900">
                                                                {alert.title}
                                                            </h4>
                                                            {alert.type && (
                                                                <Badge className="text-[8px] px-1 py-0 bg-cream-200 text-cream-600 border-cream-300">
                                                                    {ALERT_TYPE_LABELS[alert.type]?.label ?? alert.type.replace(/_/g, " ")}
                                                                </Badge>
                                                            )}
                                                            {alert.productSku && (
                                                                <Badge className="text-[8px] px-1 py-0 bg-cream-100 text-cream-500 border-cream-200">
                                                                    {alert.productSku}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="mt-0.5 text-xs text-cream-500">
                                                            {alert.description}
                                                        </p>
                                                        {alert.action && (
                                                            <p className="mt-1.5 text-[10px] text-green-700 font-medium flex items-center gap-1">
                                                                {alert.action}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="shrink-0 flex flex-col items-end gap-2">
                                                        {alert.value && (
                                                            <span className="font-mono text-xs font-bold text-green-900 bg-cream-100 px-2 py-0.5 rounded">
                                                                {alert.value}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setDismissedAlerts((prev) => new Set([...prev, alert.id]))
                                                                toast.success("Đã bỏ qua cảnh báo")
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-cream-400 hover:text-cream-600 flex items-center gap-1"
                                                        >
                                                            <Eye className="h-3 w-3" />
                                                            Đã xem
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {isExpanded && items.length === 0 && (
                                        <div className="border-t px-5 py-6 text-center" style={{ borderColor: "inherit" }}>
                                            <p className="text-xs text-cream-400">Không có cảnh báo nào</p>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Right: Analytics Sidebar (1/3) */}
                <div className="space-y-4">
                    {/* Alert Type Distribution */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Phân bố Loại cảnh báo
                        </h3>
                        {alertTypeDistribution.length > 0 ? (
                            <div className="space-y-3">
                                {alertTypeDistribution.map((item) => {
                                    const maxCount = alertTypeDistribution[0]?.count ?? 1
                                    const pct = Math.round((item.count / maxCount) * 100)
                                    return (
                                        <div key={item.type}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px] text-cream-600 flex items-center gap-1.5">
                                                    {item.label}
                                                </span>
                                                <span className="text-[11px] font-mono font-bold text-green-900">{item.count}</span>
                                            </div>
                                            <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-cream-400 text-center py-4">Không có dữ liệu</p>
                        )}
                    </div>

                    {/* Top Affected Products */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Sản phẩm bị ảnh hưởng nhiều nhất
                        </h3>
                        {topAffectedProducts.length > 0 ? (
                            <div className="space-y-2.5">
                                {topAffectedProducts.map((item, idx) => (
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
                                            <p className="text-xs font-semibold text-green-900 truncate">{item.name}</p>
                                            <div className="flex gap-1 mt-0.5 flex-wrap">
                                                {Array.from(item.types).map((t) => (
                                                    <span key={t} className="text-[8px] px-1 py-0 rounded bg-cream-200 text-cream-500">
                                                        {ALERT_TYPE_LABELS[t]?.label ?? t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <Badge className={cn(
                                            "text-[10px] px-1.5 py-0 font-mono",
                                            item.count >= 3 ? "bg-red-100 text-red-700" : "bg-cream-200 text-cream-600"
                                        )}>
                                            {item.count}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-cream-400 text-center py-4">Không có dữ liệu</p>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100/30 p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-4">
                            Hành động nhanh
                        </h3>
                        <div className="space-y-2">
                            {criticalAlerts.length > 0 && (
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                                    <div>
                                        <p className="text-[11px] font-bold text-red-800">
                                            {criticalAlerts.length} cảnh báo cần xử lý ngay
                                        </p>
                                        <p className="text-[10px] text-red-600 mt-0.5">
                                            {criticalAlerts.filter((a) => a.type === "OUT_OF_STOCK").length > 0 && "• Có sản phẩm hết hàng"}
                                            {criticalAlerts.filter((a) => a.type === "OXIDATION_RISK").length > 0 && " • Rượu có nguy cơ oxy hóa"}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {warningAlerts.filter((a) => a.type === "EXPIRY_APPROACHING").length > 0 && (
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                                    <div>
                                        <p className="text-[11px] font-bold text-amber-800">
                                            {warningAlerts.filter((a) => a.type === "EXPIRY_APPROACHING").length} nguyên liệu sắp hết hạn
                                        </p>
                                        <p className="text-[10px] text-amber-600 mt-0.5">Kiểm tra và sử dụng trước</p>
                                    </div>
                                </div>
                            )}
                            {warningAlerts.filter((a) => a.type === "LOW_STOCK").length > 0 && (
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                                    <div>
                                        <p className="text-[11px] font-bold text-blue-800">
                                            {warningAlerts.filter((a) => a.type === "LOW_STOCK").length} sản phẩm tồn thấp
                                        </p>
                                        <p className="text-[10px] text-blue-600 mt-0.5">Lên PO bổ sung</p>
                                    </div>
                                </div>
                            )}
                            {alerts.length === 0 && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 border border-green-200">
                                    <p className="text-xs font-bold text-green-800">
                                        Tuyệt! Tất cả đều ổn
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* System Status */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5">
                        <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-3">
                            Tình trạng hệ thống
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-cream-500">Cảnh báo hoạt động</span>
                                <span className={cn("text-[11px] font-bold font-mono",
                                    activeAlerts > 5 ? "text-red-700" : activeAlerts > 2 ? "text-amber-700" : "text-green-700"
                                )}>
                                    {activeAlerts}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-cream-500">Loại sản phẩm theo dõi</span>
                                <span className="text-[11px] font-bold font-mono text-green-700">
                                    {new Set(alerts.map((a) => a.productName).filter(Boolean)).size}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-cream-500">Cập nhật tiếp theo</span>
                                <span className="text-[11px] font-bold font-mono text-cream-500">~60s</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-cream-500">Nguồn dữ liệu</span>
                                <span className="text-[11px] text-cream-500">Kho, Đơn hàng, NL</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t border-cream-100">
                <p className="text-[10px] text-cream-400 italic">
                    Tự động cập nhật mỗi 60 giây · Dữ liệu từ hệ thống kho, đơn hàng, chai rượu, và nguyên liệu · Thông báo realtime
                </p>
            </div>
        </div>
    )
}
