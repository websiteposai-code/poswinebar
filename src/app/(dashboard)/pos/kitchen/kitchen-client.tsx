"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
    RefreshCcw,
    Volume2,
    VolumeX,
    Wine,
    UtensilsCrossed,
    Layers,
    Clock,
    Check,
    CheckCircle2,
    AlertTriangle,
    Flame,
    Thermometer
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getActiveOrders, updateOrderStatus, type Order, type OrderStatus } from "@/actions/orders"

function formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
    })
}

function getElapsedMinutes(date: Date): number {
    return Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000))
}

// Pleasant chime for restaurant call bell
function playKitchenChime() {
    try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioContextClass()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = "sine"
        osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12)

        gain.gain.setValueAtTime(0.25, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.35)
    } catch {
        // AudioContext not allowed or unsupported
    }
}

type StationFilter = "ALL" | "BAR" | "KITCHEN"

const STATUS_FLOW: Record<string, { next: OrderStatus; label: string; color: string }> = {
    PENDING: { next: "PREPARING", label: "Bắt đầu làm", color: "bg-amber-600 hover:bg-amber-700" },
    PREPARING: { next: "READY", label: "Xong! Sẵn sàng", color: "bg-green-700 hover:bg-green-800" },
    READY: { next: "SERVED", label: "Đã bưng ra bàn", color: "bg-green-900 hover:bg-green-950" },
}

interface KitchenClientProps {
    initialOrders: Order[]
}

const BAR_PRODUCT_TYPES = ["WINE_BOTTLE", "WINE_GLASS", "WINE_TASTING", "DRINK"]

export default function KitchenClient({ initialOrders }: KitchenClientProps) {
    const [orders, setOrders] = useState<Order[]>(initialOrders)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [station, setStation] = useState<StationFilter>("ALL")
    const [doneItems, setDoneItems] = useState<Record<string, boolean>>({})

    const prevOrderCountRef = useRef(initialOrders.length)

    const loadOrders = useCallback(async () => {
        try {
            const data = await getActiveOrders()
            if (data.length > prevOrderCountRef.current && soundEnabled) {
                playKitchenChime()
                toast.info("Có đơn hàng mới gửi xuống!")
            }
            prevOrderCountRef.current = data.length
            setOrders(data)
        } catch {
            toast.error("Không thể cập nhật đơn hàng")
        }
    }, [soundEnabled])

    // Auto-refresh every 8s
    useEffect(() => {
        if (!autoRefresh) return
        const interval = setInterval(loadOrders, 8000)
        return () => clearInterval(interval)
    }, [autoRefresh, loadOrders])

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        const result = await updateOrderStatus(orderId, newStatus)
        if (result.success) {
            setOrders(prev =>
                prev
                    .map(o => (o.id === orderId ? { ...o, status: newStatus } : o))
                    .filter(o => !["COMPLETED", "PAID", "CANCELLED", "VOID"].includes(o.status))
            )
            if (newStatus === "READY") {
                if (soundEnabled) playKitchenChime()
                toast.success("Đơn hàng đã sẵn sàng phục vụ!", { duration: 3000 })
            }
        }
    }

    const toggleItemDone = (itemId: string) => {
        setDoneItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId],
        }))
    }

    // Filter orders according to station
    const filteredOrders = useMemo(() => {
        if (station === "ALL") return orders

        return orders.filter(order => {
            const hasBarItems = order.items.some(i =>
                i.productType ? BAR_PRODUCT_TYPES.includes(i.productType) : true
            )
            const hasKitchenItems = order.items.some(i =>
                i.productType ? !BAR_PRODUCT_TYPES.includes(i.productType) : true
            )

            if (station === "BAR") return hasBarItems
            if (station === "KITCHEN") return hasKitchenItems
            return true
        })
    }, [orders, station])

    const pendingOrders = filteredOrders.filter(o => o.status === "PENDING")
    const preparingOrders = filteredOrders.filter(o => o.status === "PREPARING")
    const readyOrders = filteredOrders.filter(o => o.status === "READY")

    const totalActive = pendingOrders.length + preparingOrders.length + readyOrders.length

    return (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-cream-100 font-sans">
            {/* Header Bar */}
            <div className="flex flex-wrap items-center justify-between border-b border-cream-300 bg-cream-50 px-3 sm:px-5 py-2 sm:py-3 gap-2 shrink-0">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-display text-base sm:text-lg font-bold text-green-950">
                                KDS Điều Phối
                            </h1>
                            <Badge className="bg-green-800 text-cream-50 text-[10px] px-2 py-0.5">
                                {totalActive} đơn ca trực
                            </Badge>
                        </div>
                        <p className="text-[10px] text-cream-600">
                            Hiển thị trạng thái chế biến Bếp & Quầy Bar theo thời gian thực
                        </p>
                    </div>
                </div>

                {/* Station Filter Tabs */}
                <div className="flex items-center bg-cream-200/80 p-1 rounded-xl border border-cream-300">
                    <button
                        type="button"
                        onClick={() => setStation("ALL")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all touch-target",
                            station === "ALL"
                                ? "bg-green-900 text-cream-50 shadow-xs"
                                : "text-green-950 hover:bg-cream-100"
                        )}
                    >
                        <Layers className="h-3.5 w-3.5" />
                        <span>Tất cả</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setStation("BAR")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all touch-target",
                            station === "BAR"
                                ? "bg-wine-700 text-white shadow-xs"
                                : "text-wine-900 hover:bg-wine-100"
                        )}
                    >
                        <Wine className="h-3.5 w-3.5" />
                        <span>Quầy Bar</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setStation("KITCHEN")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all touch-target",
                            station === "KITCHEN"
                                ? "bg-green-800 text-cream-50 shadow-xs"
                                : "text-green-900 hover:bg-cream-100"
                        )}
                    >
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        <span>Bếp</span>
                    </button>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (!soundEnabled) playKitchenChime()
                            setSoundEnabled(!soundEnabled)
                        }}
                        className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl border transition-all touch-target",
                            soundEnabled
                                ? "border-green-600 bg-green-100 text-green-800"
                                : "border-cream-300 bg-cream-200 text-cream-400"
                        )}
                        title={soundEnabled ? "Tắt âm thanh chuông" : "Bật âm thanh chuông"}
                    >
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>

                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={cn(
                            "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all touch-target",
                            autoRefresh
                                ? "border-green-600 bg-green-100 text-green-800"
                                : "border-cream-300 bg-cream-200 text-cream-500"
                        )}
                    >
                        <RefreshCcw className={cn("h-3.5 w-3.5", autoRefresh && "animate-spin")} />
                        <span>Auto</span>
                    </button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadOrders}
                        className="h-9 border-cream-300 text-green-900 text-xs font-semibold"
                    >
                        <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* 3-Column Kanban Board */}
            <div className="flex flex-col lg:flex-row flex-1 gap-3 sm:gap-4 overflow-y-auto lg:overflow-hidden p-3 sm:p-4">
                {/* 1. CHỜ XỬ LÝ (PENDING) */}
                <div className="flex flex-1 flex-col rounded-2xl border border-amber-300 bg-amber-50/40 min-h-[220px] lg:min-h-0 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between border-b border-amber-200 bg-amber-100/70 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-700" />
                            <span className="text-sm font-bold text-amber-900">1. Chờ xử lý</span>
                        </div>
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1.5 text-[10px] font-bold text-white font-mono">
                            {pendingOrders.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {pendingOrders.map(order => (
                            <KDSTicketCard
                                key={order.id}
                                order={order}
                                station={station}
                                doneItems={doneItems}
                                onToggleDone={toggleItemDone}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                        {pendingOrders.length === 0 && <EmptyState message="Không có đơn chờ" />}
                    </div>
                </div>

                {/* 2. ĐANG CHẾ BIẾN (PREPARING) */}
                <div className="flex flex-1 flex-col rounded-2xl border border-orange-300 bg-orange-50/40 min-h-[220px] lg:min-h-0 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between border-b border-orange-200 bg-orange-100/70 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-orange-700" />
                            <span className="text-sm font-bold text-orange-950">2. Đang pha chế & Nấu</span>
                        </div>
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white font-mono">
                            {preparingOrders.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {preparingOrders.map(order => (
                            <KDSTicketCard
                                key={order.id}
                                order={order}
                                station={station}
                                doneItems={doneItems}
                                onToggleDone={toggleItemDone}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                        {preparingOrders.length === 0 && <EmptyState message="Không có đơn đang làm" />}
                    </div>
                </div>

                {/* 3. SẴN SÀNG PHỤC VỤ (READY) */}
                <div className="flex flex-1 flex-col rounded-2xl border border-green-300 bg-green-50/40 min-h-[220px] lg:min-h-0 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between border-b border-green-200 bg-green-100/70 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-700" />
                            <span className="text-sm font-bold text-green-950">3. Sẵn sàng bưng món</span>
                        </div>
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-700 px-1.5 text-[10px] font-bold text-white font-mono">
                            {readyOrders.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {readyOrders.map(order => (
                            <KDSTicketCard
                                key={order.id}
                                order={order}
                                station={station}
                                doneItems={doneItems}
                                onToggleDone={toggleItemDone}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                        {readyOrders.length === 0 && <EmptyState message="Không có đơn sẵn sàng" />}
                    </div>
                </div>
            </div>

            {/* Empty state when no orders at all */}
            {totalActive === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center p-6 bg-cream-50/90 rounded-2xl border border-cream-300 shadow-sm max-w-sm">
                        <Wine className="h-10 w-10 text-green-900 mx-auto mb-2 opacity-50" />
                        <p className="font-display text-lg font-bold text-green-950">Bếp & Quầy Bar đang trống</p>
                        <p className="text-xs text-cream-600 mt-1">Chưa có món nào cần chuẩn bị vào lúc này</p>
                        <p className="font-script text-xs text-cream-500 mt-2 italic">
                            drink slowly · laugh quietly · stay longer
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

function KDSTicketCard({
    order,
    station,
    doneItems,
    onToggleDone,
    onStatusChange,
}: {
    order: Order
    station: StationFilter
    doneItems: Record<string, boolean>
    onToggleDone: (itemId: string) => void
    onStatusChange: (orderId: string, status: OrderStatus) => void
}) {
    const elapsed = getElapsedMinutes(order.createdAt)
    const flow = STATUS_FLOW[order.status]

    // Aging color tiers:
    // < 5m: Normal (green tint)
    // 5-10m: Warning (amber tint)
    // > 10m: Urgent (wine red / danger tint)
    const isUrgent = elapsed >= 10
    const isWarning = elapsed >= 5 && elapsed < 10

    // Filter items inside card by station if chosen
    const displayItems = order.items.filter(item => {
        if (station === "ALL") return true
        const isBar = item.productType ? BAR_PRODUCT_TYPES.includes(item.productType) : true
        if (station === "BAR") return isBar
        if (station === "KITCHEN") return !isBar
        return true
    })

    const allChecked = displayItems.length > 0 && displayItems.every(i => doneItems[i.id])

    return (
        <div
            className={cn(
                "rounded-2xl border-2 transition-all overflow-hidden flex flex-col shadow-sm",
                isUrgent
                    ? "border-red-400 bg-red-50/60 ring-2 ring-red-400/40 animate-pulse"
                    : isWarning
                        ? "border-amber-300 bg-amber-50/60"
                        : "border-cream-300 bg-cream-50"
            )}
        >
            {/* Card Header */}
            <div
                className={cn(
                    "flex items-center justify-between px-3.5 py-2.5 border-b",
                    isUrgent
                        ? "bg-red-700 text-white border-red-800"
                        : isWarning
                            ? "bg-amber-600 text-white border-amber-700"
                            : "bg-green-900 text-cream-50 border-green-950"
                )}
            >
                <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold tracking-wide">
                        {order.orderNumber}
                    </span>
                    <Badge className="bg-white/20 text-white text-[10px] border-none font-bold">
                        {order.tableNumber ? `Bàn ${order.tableNumber}` : "Mang đi"}
                    </Badge>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{elapsed}p</span>
                    {isUrgent && <span className="text-[10px] bg-white text-red-700 px-1 rounded font-bold">GẤP</span>}
                </div>
            </div>

            {/* Subheader: Order details & staff */}
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-cream-100/70 border-b border-cream-200 text-[11px] text-cream-600">
                <span>{formatTime(order.createdAt)}</span>
                <span>Phục vụ: <strong className="text-green-950">{order.staffName}</strong></span>
            </div>

            {/* Items Checklist List */}
            <div className="p-3 space-y-2 flex-1">
                {displayItems.map(item => {
                    const isDone = doneItems[item.id]
                    const isWine = item.productType && BAR_PRODUCT_TYPES.includes(item.productType)

                    return (
                        <div
                            key={item.id}
                            onClick={() => onToggleDone(item.id)}
                            className={cn(
                                "flex items-start gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.98] touch-target",
                                isDone
                                    ? "border-green-300 bg-green-100/50 opacity-60"
                                    : "border-cream-300 bg-white hover:border-green-600 hover:bg-cream-50 shadow-2xs"
                            )}
                        >
                            {/* Checkbox button */}
                            <div
                                className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-bold text-xs transition-colors mt-0.5",
                                    isDone
                                        ? "bg-green-700 border-green-700 text-white"
                                        : "border-cream-400 bg-cream-100 text-green-900"
                                )}
                            >
                                {isDone ? <Check className="h-3.5 w-3.5" /> : item.quantity}
                            </div>

                            {/* Item info */}
                            <div className="flex-1 min-w-0">
                                <p
                                    className={cn(
                                        "text-xs font-semibold leading-tight",
                                        isDone ? "line-through text-cream-500" : "text-green-950"
                                    )}
                                >
                                    {item.productName}
                                </p>

                                {/* Wine or Serving Modifiers Badge */}
                                {item.notes && (
                                    <div className="mt-1 flex items-center gap-1 rounded-md bg-wine-100 border border-wine-200 px-2 py-0.5 text-[10px] text-wine-900 font-medium">
                                        {isWine ? <Wine className="h-3 w-3 shrink-0 text-wine-700" /> : <UtensilsCrossed className="h-3 w-3 shrink-0 text-amber-700" />}
                                        <span className="truncate">{item.notes}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Action Button: Touch Target >= 52px */}
            {flow && (
                <div className="p-3 pt-0">
                    <Button
                        onClick={() => onStatusChange(order.id, flow.next)}
                        className={cn(
                            "w-full h-12 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-[0.98] touch-target",
                            flow.color,
                            allChecked && "ring-2 ring-green-600 ring-offset-1"
                        )}
                    >
                        {flow.label}
                        {allChecked && " (Đã gạch đủ món ✓)"}
                    </Button>
                </div>
            )}
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-1 items-center justify-center py-10 text-center">
            <p className="text-xs text-cream-500 italic">{message}</p>
        </div>
    )
}
