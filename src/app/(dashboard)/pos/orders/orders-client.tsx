"use client"

import { useState, useCallback } from "react"
import { Search, Clock, ChefHat, CheckCircle2, XCircle, Banknote, CreditCard, QrCode, Receipt, RefreshCcw, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getOrders, type Order, type OrderStatus } from "@/actions/orders"
import { ReceiptPrintFrame } from "@/components/pos/receipt"

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

function formatDateTime(date: Date): string {
    return new Date(date).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: typeof Clock }> = {
    OPEN: { label: "Mở", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Clock },
    PENDING: { label: "Chờ xử lý", color: "bg-amber-100 text-amber-700 border-amber-300", icon: Clock },
    PREPARING: { label: "Đang làm", color: "bg-orange-100 text-orange-700 border-orange-300", icon: ChefHat },
    READY: { label: "Sẵn sàng", color: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle2 },
    SERVED: { label: "Đã phục vụ", color: "bg-blue-100 text-blue-700 border-blue-300", icon: CheckCircle2 },
    COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle2 },
    PAID: { label: "Đã TT", color: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle2 },
    CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-700 border-red-300", icon: XCircle },
    VOID: { label: "Hủy", color: "bg-red-100 text-red-700 border-red-300", icon: XCircle },
}

const PAYMENT_ICONS: Record<string, typeof Banknote> = {
    CASH: Banknote,
    CARD: CreditCard,
    QR: QrCode,
    MIXED: Receipt,
}

interface OrdersClientProps {
    initialOrders: Order[]
}

export default function OrdersClient({ initialOrders }: OrdersClientProps) {
    const [orders, setOrders] = useState<Order[]>(initialOrders)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL")
    const [receiptOrder, setReceiptOrder] = useState<Order | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    const loadOrders = useCallback(async () => {
        setRefreshing(true)
        try {
            const data = await getOrders()
            setOrders(data)
        } catch {
            toast.error("Không thể tải đơn hàng")
        }
        setRefreshing(false)
    }, [])

    const filteredOrders = orders.filter((order) => {
        const matchesSearch =
            !searchTerm ||
            order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.tableNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.staffName.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus =
            statusFilter === "ALL" || order.status === statusFilter

        return matchesSearch && matchesStatus
    })

    const stats = {
        total: orders.length,
        completed: orders.filter((o) => ["COMPLETED", "PAID"].includes(o.status)).length,
        active: orders.filter((o) => !["COMPLETED", "PAID", "CANCELLED", "VOID"].includes(o.status)).length,
        revenue: orders
            .filter((o) => ["COMPLETED", "PAID"].includes(o.status))
            .reduce((sum, o) => sum + o.total, 0),
    }

    return (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-cream-50">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cream-300 bg-cream-100 px-3 lg:px-5 py-2.5 lg:py-3">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg font-bold text-green-900">
                            Đơn hàng
                        </h1>
                        <p className="text-[10px] text-cream-400">
                            Lịch sử đơn hàng hôm nay
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadOrders}
                        disabled={refreshing}
                        className="border-cream-300 text-cream-500 text-xs"
                    >
                        <RefreshCcw className={cn("mr-1 h-3 w-3", refreshing && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 px-3 lg:px-5 py-2.5 lg:py-3 border-b border-cream-200">
                {[
                    { label: "Tổng đơn", value: stats.total, color: "text-green-900" },
                    { label: "Đang xử lý", value: stats.active, color: "text-amber-600" },
                    { label: "Hoàn thành", value: stats.completed, color: "text-green-600" },
                    { label: "Doanh thu", value: `₫${formatPrice(stats.revenue)}`, color: "text-wine-700" },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2"
                    >
                        <div>
                            <p className={cn("font-mono text-lg font-bold", stat.color)}>{stat.value}</p>
                            <p className="text-[9px] text-cream-400">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 px-3 lg:px-5 py-2.5 lg:py-3 border-b border-cream-200">
                <div className="relative flex-1 lg:max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm đơn, bàn, nhân viên..."
                        className="h-8 pl-8 text-xs border-cream-300"
                    />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto scroll-hide-bar">
                    <button
                        onClick={() => setStatusFilter("ALL")}
                        className={cn(
                            "rounded-md px-2.5 py-1 text-[10px] font-medium transition-all",
                            statusFilter === "ALL"
                                ? "bg-green-900 text-cream-50"
                                : "bg-cream-200 text-cream-500 hover:bg-cream-300"
                        )}
                    >
                        Tất cả
                    </button>
                    {(["PENDING", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as OrderStatus[]).map(
                        (status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={cn(
                                    "rounded-md px-2.5 py-1 text-[10px] font-medium transition-all",
                                    statusFilter === status
                                        ? "bg-green-900 text-cream-50"
                                        : "bg-cream-200 text-cream-500 hover:bg-cream-300"
                                )}
                            >
                                {STATUS_CONFIG[status].label}
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Order List + Detail */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* Order List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredOrders.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center">
                                <p className="text-sm font-medium text-cream-400">
                                    {orders.length === 0
                                        ? "Chưa có đơn hàng nào"
                                        : "Không tìm thấy đơn phù hợp"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-cream-200">
                            {filteredOrders.map((order) => {
                                const statusCfg = STATUS_CONFIG[order.status]
                                const StatusIcon = statusCfg.icon
                                const PayIcon = order.paymentMethod
                                    ? PAYMENT_ICONS[order.paymentMethod]
                                    : null
                                const isSelected = selectedOrder?.id === order.id

                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => setSelectedOrder(isSelected ? null : order)}
                                        className={cn(
                                            "flex w-full items-center gap-2 lg:gap-4 px-3 lg:px-5 py-2.5 lg:py-3 text-left transition-all hover:bg-cream-100",
                                            isSelected && "bg-green-50 border-l-2 border-green-700"
                                        )}
                                    >
                                        {/* Order Number */}
                                        <div className="min-w-[70px] lg:min-w-[100px]">
                                            <p className="font-mono text-xs font-bold text-green-900">
                                                {order.orderNumber}
                                            </p>
                                            <p className="text-[9px] text-cream-400">
                                                {formatDateTime(order.createdAt)}
                                            </p>
                                        </div>

                                        {/* Table */}
                                        <span className="rounded-md bg-green-900 px-1.5 py-0.5 text-[9px] font-bold text-cream-50 min-w-[40px] text-center">
                                            {order.tableNumber ?? "TK"}
                                        </span>

                                        {/* Items count */}
                                        <span className="text-[10px] text-cream-500 min-w-[40px] hidden sm:inline">
                                            {order.items.length} món
                                        </span>

                                        {/* Status */}
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium min-w-[80px] justify-center",
                                                statusCfg.color
                                            )}
                                        >
                                            <StatusIcon className="h-2.5 w-2.5" />
                                            {statusCfg.label}
                                        </span>

                                        {/* Payment */}
                                        {PayIcon && (
                                            <span className="hidden sm:flex items-center gap-1 text-[10px] text-cream-500">
                                                <PayIcon className="h-3 w-3" />
                                                {order.paymentMethod}
                                            </span>
                                        )}

                                        {/* Total */}
                                        <span className="ml-auto font-mono text-sm font-bold text-green-900">
                                            ₫{formatPrice(order.total)}
                                        </span>

                                        {/* Staff */}
                                        <span className="hidden lg:inline text-[10px] text-cream-400 min-w-[60px] text-right">
                                            {order.staffName}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                {selectedOrder && (
                    <div className="absolute inset-0 lg:relative lg:inset-auto w-full lg:w-[380px] border-l-0 lg:border-l border-cream-300 bg-cream-50 overflow-y-auto z-20">
                        <div className="sticky top-0 bg-cream-50 border-b border-cream-200 px-5 py-3 flex items-center justify-between z-10">
                            <div>
                                <p className="font-mono text-sm font-bold text-green-900">
                                    {selectedOrder.orderNumber}
                                </p>
                                <p className="text-[10px] text-cream-400">
                                    {formatDateTime(selectedOrder.createdAt)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="rounded-lg p-1 text-cream-400 hover:bg-cream-200 transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                <InfoCell
                                    label="Bàn"
                                    value={selectedOrder.tableNumber ?? "Takeaway"}
                                />
                                <InfoCell
                                    label="Loại"
                                    value={selectedOrder.orderType === "DINE_IN" ? "Tại bàn" : "Mang đi"}
                                />
                                <InfoCell
                                    label="Nhân viên"
                                    value={selectedOrder.staffName}
                                />
                                <InfoCell
                                    label="Thanh toán"
                                    value={selectedOrder.paymentMethod ?? "Chưa TT"}
                                />
                            </div>

                            {/* Status Badge */}
                            <div className="flex items-center justify-center">
                                {(() => {
                                    const cfg = STATUS_CONFIG[selectedOrder.status]
                                    return (
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                                                cfg.color
                                            )}
                                        >
                                            {cfg.label}
                                        </span>
                                    )
                                })()}
                            </div>

                            {/* Items */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-2">
                                    Chi tiết đơn
                                </p>
                                <div className="space-y-2 rounded-xl border border-cream-300 bg-cream-100 p-3">
                                    {selectedOrder.items.map((item) => (
                                        <div key={item.id} className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 min-w-0">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-green-900 text-[9px] font-bold text-cream-50">
                                                    {item.quantity}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-green-900 truncate">
                                                        {item.productName}
                                                    </p>
                                                    {item.notes && (
                                                        <p className="text-[9px] text-wine-600 italic truncate">
                                                            {item.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="font-mono text-[10px] font-bold text-green-900 whitespace-nowrap">
                                                ₫{formatPrice(item.unitPrice * item.quantity)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="space-y-1.5 rounded-xl border border-cream-300 bg-cream-100 p-3">
                                <div className="flex justify-between text-[10px] text-cream-500">
                                    <span>Tạm tính</span>
                                    <span className="font-mono">₫{formatPrice(selectedOrder.subtotal)}</span>
                                </div>
                                {selectedOrder.discount > 0 && (
                                    <div className="flex justify-between text-[10px] text-wine-600">
                                        <span>Giảm giá</span>
                                        <span className="font-mono">-₫{formatPrice(selectedOrder.discount)}</span>
                                    </div>
                                )}
                                <div className="border-t border-cream-300 pt-1.5 flex justify-between">
                                    <span className="text-xs font-bold text-green-900">Tổng cộng</span>
                                    <span className="font-mono text-base font-bold text-green-900">
                                        ₫{formatPrice(selectedOrder.total)}
                                    </span>
                                </div>
                            </div>

                            {/* Print Receipt Button */}
                            <button
                                onClick={() => setReceiptOrder(selectedOrder)}
                                className="w-full rounded-xl border border-green-300 bg-green-50 py-2.5 text-xs font-bold text-green-700 hover:bg-green-100 transition-all flex items-center justify-center gap-1.5"
                            >
                                In hoá đơn
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Receipt Print Overlay */}
            {receiptOrder && (
                <ReceiptPrintFrame
                    order={receiptOrder}
                    onClose={() => setReceiptOrder(null)}
                />
            )}
        </div>
    )
}

function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-cream-300 bg-cream-100 px-3 py-2">
            <p className="text-[9px] text-cream-400">{label}</p>
            <p className="text-xs font-medium text-green-900">{value}</p>
        </div>
    )
}
