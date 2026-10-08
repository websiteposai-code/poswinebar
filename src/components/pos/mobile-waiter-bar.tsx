"use client"

import { Armchair, ShoppingCart, ChevronUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { FloorTable } from "@/stores/cart-store"

interface MobileWaiterBarProps {
    orderType: "DINE_IN" | "TAKEAWAY"
    selectedTable: FloorTable | null
    itemCount: number
    totalAmount: number
    activeOrderId: string | null
    existingOrderTotal?: number
    isSubmitting: boolean
    onOpenTableSelector: () => void
    onOpenCart: () => void
    onSendToKitchen: () => void
    onPayExistingOrder?: () => void
}

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

export function MobileWaiterBar({
    orderType,
    selectedTable,
    itemCount,
    totalAmount,
    activeOrderId,
    existingOrderTotal,
    isSubmitting,
    onOpenTableSelector,
    onOpenCart,
    onSendToKitchen,
    onPayExistingOrder,
}: MobileWaiterBarProps) {
    const hasItems = itemCount > 0
    const needsTable = orderType === "DINE_IN" && !selectedTable

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-cream-100/95 backdrop-blur-md border-t border-cream-300 shadow-[0_-4px_16px_rgba(27,58,45,0.08)] px-3 py-2 safe-area-bottom">
            {needsTable ? (
                /* Prompt to select table if dine in and no table chosen yet */
                <button
                    onClick={onOpenTableSelector}
                    type="button"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-900 px-4 py-3 text-sm font-semibold text-cream-50 shadow-md active:scale-[0.98] transition-transform animate-pulse"
                >
                    <Armchair className="h-5 w-5 text-cream-200" />
                    <span>Chọn bàn để bắt đầu phục vụ</span>
                </button>
            ) : (
                /* Main Action Bar */
                <div className="flex items-center gap-2">
                    {/* Table Pill */}
                    {orderType === "DINE_IN" ? (
                        <button
                            onClick={onOpenTableSelector}
                            type="button"
                            className="flex flex-col justify-center items-start shrink-0 rounded-xl border border-green-700/30 bg-green-50 px-2.5 py-1.5 active:bg-green-100 transition-colors"
                        >
                            <span className="text-[9px] uppercase tracking-wider font-semibold text-green-700">
                                Bàn
                            </span>
                            <span className="font-display text-sm font-bold text-green-950 leading-tight">
                                {selectedTable?.tableNumber}
                            </span>
                        </button>
                    ) : (
                        <div className="flex flex-col justify-center items-start shrink-0 rounded-xl border border-cream-300 bg-cream-200 px-2.5 py-1.5">
                            <span className="text-[9px] uppercase tracking-wider font-semibold text-cream-600">
                                Đơn
                            </span>
                            <span className="text-xs font-bold text-green-900">
                                Mang đi
                            </span>
                        </div>
                    )}

                    {/* Cart Summary Tap Target (Opens Drawer) */}
                    <button
                        onClick={onOpenCart}
                        type="button"
                        className={cn(
                            "flex-1 flex items-center justify-between rounded-xl border px-3 py-2 transition-all active:scale-[0.98]",
                            hasItems
                                ? "border-cream-300 bg-cream-50 text-green-900 shadow-2xs hover:border-green-600"
                                : activeOrderId && existingOrderTotal
                                    ? "border-wine-300 bg-wine-50 text-wine-900 shadow-2xs"
                                    : "border-dashed border-cream-300 bg-cream-100/50 text-cream-500"
                        )}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="relative">
                                <ShoppingCart className={cn("h-4 w-4", activeOrderId && !hasItems ? "text-wine-800" : "text-green-800")} />
                                {hasItems && (
                                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-700 px-1 text-[9px] font-bold text-cream-50">
                                        {itemCount}
                                    </span>
                                )}
                            </div>
                            <div className="text-left truncate">
                                {hasItems ? (
                                    <p className="font-mono text-xs font-bold text-green-950 truncate">
                                        ₫{formatPrice(totalAmount)}
                                    </p>
                                ) : activeOrderId && existingOrderTotal ? (
                                    <div>
                                        <span className="text-[9px] font-semibold text-wine-700 block leading-none">Đang order</span>
                                        <p className="font-mono text-xs font-bold text-wine-950 truncate mt-0.5">
                                            ₫{formatPrice(existingOrderTotal)}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-cream-500 truncate">
                                        Giỏ hàng trống
                                    </p>
                                )}
                            </div>
                        </div>
                        <ChevronUp className="h-4 w-4 text-cream-400 shrink-0" />
                    </button>

                    {/* Action button */}
                    {hasItems ? (
                        <Button
                            onClick={onSendToKitchen}
                            disabled={isSubmitting}
                            type="button"
                            className={cn(
                                "shrink-0 h-11 px-4 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95",
                                activeOrderId
                                    ? "bg-wine-700 text-white hover:bg-wine-800"
                                    : "bg-green-900 text-cream-50 hover:bg-green-800"
                            )}
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <span>{activeOrderId ? "Thêm Món" : "Gửi Bếp"}</span>
                            )}
                        </Button>
                    ) : activeOrderId && onPayExistingOrder ? (
                        <Button
                            onClick={onPayExistingOrder}
                            type="button"
                            className="shrink-0 h-11 px-4 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 bg-green-800 text-white hover:bg-green-700"
                        >
                            <span>Tính tiền</span>
                        </Button>
                    ) : null}
                </div>
            )}
        </div>
    )
}
