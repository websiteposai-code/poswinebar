"use client"

import {
    X,
    Loader2,
    Utensils,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { Order } from "@/actions/orders"

interface TableOrderDetailModalProps {
    open: boolean
    table: {
        id: string
        tableNumber: string
        seats: number
        zone?: { name: string } | null
        status: string
    } | null
    order: Order | null
    isLoading: boolean
    onClose: () => void
    onPay: (order: Order) => void
    onAddItems: (table: any, order: Order) => void
    onPrintBill: (order: Order) => void
    onCleanTable: (tableId: string) => void
}

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

function formatDuration(createdAt: Date | string): string {
    const start = new Date(createdAt).getTime()
    const diff = Math.max(0, Math.floor((Date.now() - start) / 60000))
    if (diff < 60) return `${diff} phút`
    const h = Math.floor(diff / 60)
    const m = diff % 60
    return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`
}

export function TableOrderDetailModal({
    open,
    table,
    order,
    isLoading,
    onClose,
    onPay,
    onAddItems,
    onPrintBill,
    onCleanTable,
}: TableOrderDetailModalProps) {
    if (!open || !table) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
            <div
                className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-cream-300 bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-cream-200 bg-wine-50/70 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-wine-700 text-white font-display text-lg font-bold shadow-sm">
                            {table.tableNumber}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-green-950 font-display">
                                    Bàn {table.tableNumber}
                                </h3>
                                <span className="text-[10px] font-semibold text-wine-900 bg-wine-100/90 border border-wine-200/80 px-2 py-0.5 rounded-md">
                                    Đang phục vụ
                                </span>
                            </div>
                            <p className="text-xs text-cream-600 mt-0.5 font-medium">
                                {table.zone?.name ?? "Khu vực"} · {table.seats} chỗ ngồi
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-cream-400 hover:text-cream-600 hover:bg-cream-100 transition-all"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Sub-header: Order meta info */}
                {order && (
                    <div className="px-5 py-2.5 bg-cream-50 border-b border-cream-200 flex items-center justify-between text-xs text-cream-600">
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-wine-900 bg-white border border-wine-200/80 px-2 py-0.5 rounded-md">
                                {order.orderNumber}
                            </span>
                            <span className="font-mono text-[11px] text-cream-500">
                                {formatDuration(order.createdAt)}
                            </span>
                        </div>
                        <span className="text-[11px] text-cream-500 font-medium">
                            {order.items?.length ?? 0} món
                        </span>
                    </div>
                )}

                {/* Body: Items list or loading */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-cream-400">
                            <Loader2 className="h-8 w-8 animate-spin text-wine-600 mb-2" />
                            <p className="text-xs">Đang tải đơn hàng...</p>
                        </div>
                    ) : !order || !order.items || order.items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-cream-400">
                            <Utensils className="h-10 w-10 text-cream-300 mb-2" />
                            <p className="text-sm font-medium text-cream-600">Bàn chưa có món nào</p>
                            <p className="text-xs text-cream-400 mt-1">
                                Nhấn &quot;Thêm món&quot; để mở menu và gọi món cho khách
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-cream-400 px-1 mb-1">
                                Danh sách món đang dùng
                            </div>
                            {order.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-start justify-between rounded-xl border border-cream-200 bg-cream-50/60 p-3 hover:bg-cream-100/60 transition-colors"
                                >
                                    <div className="flex-1 min-w-0 pr-3">
                                        <p className="text-xs font-semibold text-green-950 leading-tight">
                                            {item.productName}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[11px] text-cream-500 font-mono">
                                                ₫{formatPrice(item.unitPrice)}
                                            </span>
                                            {item.notes && (
                                                <span className="text-[10px] text-amber-800 italic">
                                                    · Ghi chú: {item.notes}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="inline-block rounded-md bg-wine-100 px-2 py-0.5 text-xs font-bold text-wine-800 font-mono">
                                            ×{item.quantity}
                                        </span>
                                        <p className="font-mono text-xs font-bold text-green-950 mt-1">
                                            ₫{formatPrice(item.subtotal || item.unitPrice * item.quantity)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bill Summary */}
                {order && (
                    <div className="px-5 py-3 border-t border-cream-200 bg-cream-50 shrink-0 space-y-1 text-xs">
                        <div className="flex justify-between text-cream-600">
                            <span>Tạm tính</span>
                            <span className="font-mono font-medium">₫{formatPrice(order.subtotal ?? order.total)}</span>
                        </div>
                        {order.discount > 0 && (
                            <div className="flex justify-between text-green-700 font-medium">
                                <span>Giảm giá</span>
                                <span className="font-mono">-₫{formatPrice(order.discount)}</span>
                            </div>
                        )}
                        {order.tax > 0 && (
                            <div className="flex justify-between text-cream-500">
                                <span>Thuế / Phí</span>
                                <span className="font-mono">₫{formatPrice(order.tax)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-baseline pt-2 border-t border-cream-300">
                            <span className="text-sm font-bold text-green-950">Tổng thanh toán</span>
                            <span className="font-mono text-lg font-bold text-wine-800">
                                ₫{formatPrice(order.total)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Footer Action Buttons */}
                <div className="p-4 border-t border-cream-200 bg-white shrink-0">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        {/* Thêm món */}
                        <Button
                            onClick={() => {
                                if (order) onAddItems(table, order)
                                else onAddItems(table, { id: "", orderNumber: "", items: [], total: 0 } as any)
                            }}
                            className="h-11 bg-wine-700 text-white hover:bg-wine-800 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center"
                        >
                            Thêm món
                        </Button>

                        {/* Thanh toán */}
                        <Button
                            onClick={() => {
                                if (order) onPay(order)
                            }}
                            disabled={!order || (order.items?.length ?? 0) === 0}
                            className="h-11 bg-green-800 text-white hover:bg-green-700 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center disabled:opacity-50"
                        >
                            Thanh toán
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {/* In tạm tính */}
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (order) onPrintBill(order)
                            }}
                            disabled={!order}
                            className="h-9 border-cream-300 text-cream-600 hover:bg-cream-100 text-xs rounded-xl flex items-center justify-center disabled:opacity-40"
                        >
                            In tạm tính
                        </Button>

                        {/* Dọn bàn */}
                        <Button
                            variant="outline"
                            onClick={() => onCleanTable(table.id)}
                            className="h-9 border-cream-300 text-cream-600 hover:bg-cream-100 text-xs rounded-xl flex items-center justify-center"
                        >
                            Dọn bàn xong
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
