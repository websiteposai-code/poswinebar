"use client"

import { forwardRef } from "react"
import { Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Order } from "@/actions/orders"

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

function formatDateTime(date: Date): string {
    return new Date(date).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

type ReceiptProps = {
    order: Order
    className?: string
    showInvoiceQr?: boolean
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
    function Receipt({ order, className, showInvoiceQr = true }, ref) {
        const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://poswinebar.vercel.app")
        const invoicePortalUrl = `${origin}/invoice-request/${order.orderNumber}`
        const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(invoicePortalUrl)}&size=140&margin=1`

        return (
            <div
                ref={ref}
                className={cn(
                    "w-[300px] bg-white p-6 font-mono text-black",
                    className
                )}
            >
                {/* Header */}
                <div className="text-center mb-4">
                    <h2 className="text-lg font-bold tracking-wide">NOON & NOIR</h2>
                    <p className="text-[10px] italic text-gray-500">Wine Alley</p>
                    <p className="text-[9px] text-gray-400 mt-1">
                        drink slowly · laugh quietly · stay longer
                    </p>
                </div>

                {/* Dashed divider */}
                <div className="border-t border-dashed border-gray-300 my-3" />

                {/* Order Info */}
                <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Đơn hàng:</span>
                        <span className="font-bold">{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Ngày:</span>
                        <span>{formatDateTime(order.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">
                            {order.orderType === "DINE_IN" ? "Bàn:" : "Loại:"}
                        </span>
                        <span className="font-bold">
                            {order.tableNumber ?? "Mang đi"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">NV:</span>
                        <span>{order.staffName}</span>
                    </div>
                    {order.guestCount && (
                        <div className="flex justify-between">
                            <span className="text-gray-500">Số khách:</span>
                            <span>{order.guestCount}</span>
                        </div>
                    )}
                </div>

                <div className="border-t border-dashed border-gray-300 my-3" />

                {/* Items */}
                <div className="space-y-1.5">
                    {order.items.map((item) => (
                        <div key={item.id}>
                            <div className="flex justify-between text-[11px]">
                                <span className="flex-1 truncate pr-2">
                                    {item.quantity}x {item.productName}
                                </span>
                                <span className="font-bold text-right min-w-[70px]">
                                    {formatPrice(item.unitPrice * item.quantity)}
                                </span>
                            </div>
                            {item.notes && (
                                <p className="text-[8px] text-gray-400 pl-3 italic">
                                    → {item.notes}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="border-t border-dashed border-gray-300 my-3" />

                {/* Totals */}
                <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">
                            Tạm tính ({order.items.length} món)
                        </span>
                        <span>{formatPrice(order.subtotal)}</span>
                    </div>
                    {order.discount > 0 && (
                        <div className="flex justify-between text-green-700">
                            <span>Giảm giá</span>
                            <span>-{formatPrice(order.discount)}</span>
                        </div>
                    )}
                    {order.tax > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-500">VAT (10%)</span>
                            <span>{formatPrice(order.tax)}</span>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-black my-2" />

                {/* Grand Total */}
                <div className="flex justify-between text-sm font-bold">
                    <span>TỔNG CỘNG</span>
                    <span>₫{formatPrice(order.total)}</span>
                </div>

                <div className="border-t border-dashed border-gray-300 my-3" />

                {/* Payment */}
                {order.paymentMethod && (
                    <div className="text-center text-[10px]">
                        <p className="text-gray-500">
                            Thanh toán:{" "}
                            <span className="font-bold">
                                {order.paymentMethod === "CASH"
                                    ? "Tiền mặt"
                                    : order.paymentMethod === "CARD"
                                        ? "Thẻ"
                                        : order.paymentMethod === "QR"
                                            ? "QR Pay"
                                            : "Hỗn hợp"}
                            </span>
                        </p>
                        {order.paidAt && (
                            <p className="text-gray-400 mt-0.5">
                                {formatDateTime(order.paidAt)}
                            </p>
                        )}
                    </div>
                )}

                {/* VAT E-INVOICE QR CODE SECTION */}
                {showInvoiceQr && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-400 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-black">
                            QUÉT MÃ ĐỂ LẤY HOÁ ĐƠN VAT
                        </p>
                        <p className="text-[8px] text-gray-500 mt-0.5">
                            Thời hạn tra cứu: 48h từ lúc thanh toán
                        </p>
                        <div className="my-2 flex justify-center">
                            <div className="p-1.5 bg-white border border-gray-300 rounded">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={qrCodeUrl}
                                    alt="QR Xuất Hóa Đơn VAT"
                                    width={105}
                                    height={105}
                                    className="block mx-auto"
                                    loading="eager"
                                />
                            </div>
                        </div>
                        <p className="text-[8px] font-mono text-gray-500">
                            {order.orderNumber}
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-4 text-center">
                    <div className="border-t border-dashed border-gray-300 mb-3" />
                    <p className="text-[10px] font-bold">Cảm ơn quý khách!</p>
                    <p className="text-[8px] text-gray-400 mt-1">
                        Noon & Noir Wine Alley
                    </p>
                    <p className="text-[8px] text-gray-400">
                        Hẹn gặp lại
                    </p>

                    {/* Decorative checkered pattern */}
                    <div className="mt-3 flex justify-center gap-[2px]">
                        {Array.from({ length: 30 }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "h-[4px] w-[4px]",
                                    i % 2 === 0 ? "bg-gray-800" : "bg-transparent"
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>
        )
    }
)

// Print-friendly wrapper that adds print styles
export function ReceiptPrintFrame({
    order,
    onClose,
}: {
    order: Order
    onClose: () => void
}) {
    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                {/* Receipt preview */}
                <div className="rounded-xl shadow-2xl overflow-hidden print:shadow-none">
                    <Receipt order={order} className="print:p-0" />
                </div>

                {/* Action buttons (hidden when printing) */}
                <div className="flex items-center gap-2 print:hidden">
                    <button
                        onClick={handlePrint}
                        className="rounded-lg bg-green-900 px-6 py-2 text-sm font-bold text-cream-50 hover:bg-green-800 transition-all flex items-center gap-2"
                    >
                        <Printer className="h-4 w-4" />
                        In hoá đơn
                    </button>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-cream-300 bg-cream-50 px-6 py-2 text-sm font-medium text-cream-600 hover:bg-cream-100 transition-all"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
