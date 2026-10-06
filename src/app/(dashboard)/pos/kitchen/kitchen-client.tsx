"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCcw, Volume2, VolumeX } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

const STATUS_FLOW: Record<string, { next: OrderStatus; label: string; color: string }> = {
    PENDING: { next: "PREPARING", label: "Bắt đầu làm", color: "bg-amber-500 hover:bg-amber-600" },
    PREPARING: { next: "READY", label: "Xong!", color: "bg-green-600 hover:bg-green-700" },
    READY: { next: "SERVED", label: "Đã phục vụ", color: "bg-blue-600 hover:bg-blue-700" },
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; icon: string; glow: string }> = {
    PENDING: {
        bg: "bg-amber-50",
        border: "border-amber-300",
        text: "text-amber-700",
        icon: "text-amber-500",
        glow: "shadow-amber-200/50",
    },
    PREPARING: {
        bg: "bg-orange-50",
        border: "border-orange-400",
        text: "text-orange-700",
        icon: "text-orange-500",
        glow: "shadow-orange-200/50 animate-pulse",
    },
    READY: {
        bg: "bg-green-50",
        border: "border-green-400",
        text: "text-green-700",
        icon: "text-green-500",
        glow: "shadow-green-200/50",
    },
    SERVED: {
        bg: "bg-blue-50",
        border: "border-blue-300",
        text: "text-blue-700",
        icon: "text-blue-500",
        glow: "",
    },
}

interface KitchenClientProps {
    initialOrders: Order[]
}

export default function KitchenClient({ initialOrders }: KitchenClientProps) {
    const [orders, setOrders] = useState<Order[]>(initialOrders)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [autoRefresh, setAutoRefresh] = useState(true)

    const loadOrders = useCallback(async () => {
        try {
            const data = await getActiveOrders()
            setOrders(data)
        } catch {
            toast.error("Không thể tải đơn hàng")
        }
    }, [])

    // Auto-refresh every 10s
    useEffect(() => {
        if (!autoRefresh) return
        const interval = setInterval(loadOrders, 10000)
        return () => clearInterval(interval)
    }, [autoRefresh, loadOrders])

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        const result = await updateOrderStatus(orderId, newStatus)
        if (result.success) {
            // Optimistic update — no full refetch
            setOrders(prev => prev.map(o =>
                o.id === orderId ? { ...o, status: newStatus } : o
            ).filter(o => !["COMPLETED", "PAID", "CANCELLED", "VOID"].includes(o.status)))
            if (newStatus === "READY" && soundEnabled) {
                toast.success("Đơn đã sẵn sàng!", { duration: 3000 })
            }
        }
    }

    const pendingOrders = orders.filter((o) => o.status === "PENDING")
    const preparingOrders = orders.filter((o) => o.status === "PREPARING")
    const readyOrders = orders.filter((o) => o.status === "READY")

    const totalActive = pendingOrders.length + preparingOrders.length + readyOrders.length

    return (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-cream-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cream-300 bg-cream-50 px-3 lg:px-5 py-2.5 lg:py-3">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-base lg:text-lg font-bold text-green-900">
                            Kitchen Display
                        </h1>
                        <p className="text-[10px] text-cream-400">
                            {totalActive} đơn đang hoạt động
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                            soundEnabled
                                ? "bg-green-100 text-green-700"
                                : "bg-cream-200 text-cream-400"
                        )}
                    >
                        {soundEnabled ? (
                            <Volume2 className="h-4 w-4" />
                        ) : (
                            <VolumeX className="h-4 w-4" />
                        )}
                    </button>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={cn(
                            "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium transition-all",
                            autoRefresh
                                ? "bg-green-100 text-green-700"
                                : "bg-cream-200 text-cream-400"
                        )}
                    >
                        <RefreshCcw className={cn("h-3 w-3", autoRefresh && "animate-spin")} />
                        Auto
                    </button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadOrders}
                        className="border-cream-300 text-cream-500 text-xs"
                    >
                        <RefreshCcw className="mr-1 h-3 w-3" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* 3-Column Kanban */}
            <div className="flex flex-col lg:flex-row flex-1 gap-3 lg:gap-4 overflow-y-auto lg:overflow-hidden p-3 lg:p-4">
                {/* PENDING Column */}
                <div className="flex flex-1 flex-col rounded-xl border border-amber-200 bg-amber-50/30 min-h-[200px] lg:min-h-0">
                    <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-3">
                        <span className="text-sm font-bold text-amber-800">Chờ xử lý</span>
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                            {pendingOrders.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {pendingOrders.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                        {pendingOrders.length === 0 && (
                            <EmptyColumn message="Không có đơn chờ" />
                        )}
                    </div>
                </div>

                {/* PREPARING Column */}
                <div className="flex flex-1 flex-col rounded-xl border border-orange-200 bg-orange-50/30 min-h-[200px] lg:min-h-0">
                    <div className="flex items-center gap-2 border-b border-orange-200 px-4 py-3">
                        <span className="text-sm font-bold text-orange-800">Đang làm</span>
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                            {preparingOrders.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {preparingOrders.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                        {preparingOrders.length === 0 && (
                            <EmptyColumn message="Không có đơn đang làm" />
                        )}
                    </div>
                </div>

                {/* READY Column */}
                <div className="flex flex-1 flex-col rounded-xl border border-green-200 bg-green-50/30 min-h-[200px] lg:min-h-0">
                    <div className="flex items-center gap-2 border-b border-green-200 px-4 py-3">
                        <span className="text-sm font-bold text-green-800">Sẵn sàng</span>
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                            {readyOrders.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {readyOrders.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                        {readyOrders.length === 0 && (
                            <EmptyColumn message="Không có đơn sẵn sàng" />
                        )}
                    </div>
                </div>
            </div>

            {/* Empty state when no orders at all */}
            {totalActive === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <p className="font-display text-xl font-bold text-cream-400">Bếp đang nghỉ</p>
                        <p className="text-sm text-cream-400 mt-1">Chưa có đơn hàng nào</p>
                        <p className="font-script text-xs text-cream-300 mt-3 italic">
                            drink slowly · laugh quietly · stay longer
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

function OrderCard({
    order,
    onStatusChange,
}: {
    order: Order
    onStatusChange: (orderId: string, status: OrderStatus) => void
}) {
    const elapsed = getElapsedMinutes(order.createdAt)
    const colors = STATUS_COLORS[order.status] ?? STATUS_COLORS.PENDING
    const flow = STATUS_FLOW[order.status]
    const isUrgent = order.status === "PENDING" && elapsed > 10
    const isCritical = order.status === "PREPARING" && elapsed > 20

    return (
        <div
            className={cn(
                "rounded-xl border-2 p-3 transition-all",
                colors.bg,
                colors.border,
                (isUrgent || isCritical) && "ring-2 ring-red-400/50 border-red-400",
                colors.glow && `shadow-lg ${colors.glow}`
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-green-900">
                        {order.orderNumber}
                    </span>
                    {(isUrgent || isCritical) && (
                        <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                            Trễ!
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className={cn(
                            "font-mono text-[10px] font-bold",
                            elapsed > 15 ? "text-red-600" : "text-cream-500"
                        )}
                    >
                        {elapsed}p
                    </span>
                </div>
            </div>

            {/* Table / Type */}
            <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md bg-green-900 px-1.5 py-0.5 text-[9px] font-bold text-cream-50">
                    {order.tableNumber ?? "TAKEAWAY"}
                </span>
                <span className="text-[10px] text-cream-400">
                    {formatTime(order.createdAt)}
                </span>
                <span className="text-[10px] text-cream-400">·</span>
                <span className="text-[10px] text-cream-400">
                    {order.staffName}
                </span>
            </div>

            {/* Items */}
            <div className="space-y-1 mb-3">
                {order.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-green-900 text-[9px] font-bold text-cream-50">
                            {item.quantity}
                        </span>
                        <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-green-900 leading-tight">
                                {item.productName}
                            </span>
                            {item.notes && (
                                <p className="text-[9px] text-wine-600 italic">
                                    {item.notes}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Action Button */}
            {flow && (
                <button
                    onClick={() => onStatusChange(order.id, flow.next)}
                    className={cn(
                        "w-full rounded-lg py-3 lg:py-2 text-sm lg:text-xs font-bold text-white transition-all active:scale-95 touch-target",
                        flow.color
                    )}
                >
                    {flow.label}
                </button>
            )}
        </div>
    )
}

function EmptyColumn({ message }: { message: string }) {
    return (
        <div className="flex flex-1 items-center justify-center py-12">
            <p className="text-xs text-cream-400">{message}</p>
        </div>
    )
}
