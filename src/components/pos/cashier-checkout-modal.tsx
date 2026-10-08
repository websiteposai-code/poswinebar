"use client"

import { useState, useEffect, useMemo } from "react"
import {
    Banknote,
    CreditCard,
    QrCode,
    Users,
    Scissors,
    Check,
    X,
    Receipt,
    Loader2,
    Copy,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    ArrowRight
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { processOrderWithCOGS, type PaymentMethod, type Order, type SplitPaymentEntry } from "@/actions/orders"
import { splitBill } from "@/actions/tables"
import { generateQRPayment, getBankConfig, type QRPaymentRequest, type QRPaymentConfig } from "@/actions/qr-payment"

interface CashierCheckoutModalProps {
    open: boolean
    order: Order
    staffName: string
    onClose: () => void
    onPaidSuccess: (paidOrder: Order) => void
    onSplitSuccess?: () => void
}

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

type MainTab = "PAYMENT" | "SPLIT_ITEMS"

export function CashierCheckoutModal({
    open,
    order,
    staffName,
    onClose,
    onPaidSuccess,
    onSplitSuccess,
}: CashierCheckoutModalProps) {
    if (!open || !order) return null

    const totalAmount = order.total ?? 0

    // Tab & mode state
    const [mainTab, setMainTab] = useState<MainTab>("PAYMENT")
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Equal split state
    const [equalSplitCount, setEqualSplitCount] = useState<number>(1)
    const [equalPaidMap, setEqualPaidMap] = useState<Record<number, boolean>>({})

    // Numpad state for Cash
    const [cashGiven, setCashGiven] = useState<number>(totalAmount)

    // VietQR state
    const [qrData, setQrData] = useState<QRPaymentRequest | null>(null)
    const [qrConfig, setQrConfig] = useState<QRPaymentConfig | null>(null)
    const [qrLoading, setQrLoading] = useState(false)

    // Split items state
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
    const [splitting, setSplitting] = useState(false)

    // Calculate equal split price
    const perPersonPrice = useMemo(() => {
        if (equalSplitCount <= 1) return totalAmount
        return Math.ceil(totalAmount / equalSplitCount)
    }, [totalAmount, equalSplitCount])

    // Change due
    const currentTargetAmount = equalSplitCount > 1 ? perPersonPrice : totalAmount
    const changeDue = Math.max(0, cashGiven - currentTargetAmount)
    const isShort = cashGiven < currentTargetAmount

    // Auto load QR when switching to BANK_TRANSFER
    useEffect(() => {
        if (paymentMethod === "BANK_TRANSFER" && !qrData && !qrLoading) {
            setQrLoading(true)
            getBankConfig().then((cfg) => {
                setQrConfig(cfg)
                return generateQRPayment({
                    orderId: order.orderNumber ?? order.id,
                    amount: currentTargetAmount,
                    description: `${order.orderNumber ?? order.id.slice(-6)} NoonNoir`,
                })
            }).then((res) => {
                if (res.success && res.data) {
                    setQrData(res.data)
                }
            }).catch(() => {
                toast.error("Không thể tải mã VietQR")
            }).finally(() => {
                setQrLoading(false)
            })
        }
    }, [paymentMethod, currentTargetAmount, order, qrData, qrLoading])

    // Numpad input handler
    const handleNumpadPress = (val: string) => {
        if (val === "C") {
            setCashGiven(0)
            return
        }
        if (val === "DEL") {
            const str = cashGiven.toString()
            setCashGiven(str.length > 1 ? Number(str.slice(0, -1)) : 0)
            return
        }
        if (val === "000") {
            setCashGiven(prev => prev * 1000)
            return
        }
        const str = cashGiven === 0 ? val : `${cashGiven}${val}`
        setCashGiven(Number(str))
    }

    // Submit Payment
    const handleExecutePayment = async () => {
        setIsSubmitting(true)
        try {
            let paymentPayload: PaymentMethod | SplitPaymentEntry[] = paymentMethod

            // If equal split with multiple paid people
            if (equalSplitCount > 1) {
                paymentPayload = Array.from({ length: equalSplitCount }).map((_, idx) => ({
                    method: paymentMethod,
                    amount: perPersonPrice,
                    reference: `Khách ${idx + 1}/${equalSplitCount}`,
                }))
            }

            const result = await processOrderWithCOGS(order.id, paymentPayload)
            if (result.success) {
                if (result.stockWarnings && result.stockWarnings.length > 0) {
                    for (const w of result.stockWarnings) toast.warning(w)
                }
                toast.success(`Đã thanh toán đơn ${order.orderNumber}!`, {
                    description: `Tổng tiền: ₫${formatPrice(totalAmount)} · Phương thức: ${
                        paymentMethod === "CASH" ? "Tiền mặt" : paymentMethod === "CARD" ? "Thẻ" : "VietQR"
                    }`,
                })
                onPaidSuccess(order)
            } else {
                toast.error(result.errors?.[0] ?? "Thanh toán không thành công")
            }
        } catch {
            toast.error("Lỗi kết nối khi thanh toán")
        } finally {
            setIsSubmitting(false)
        }
    }

    // Submit Split Items to New Order
    const handleSplitSelectedItems = async () => {
        if (selectedItemIds.length === 0) {
            toast.error("Vui lòng chọn ít nhất 1 món để tách")
            return
        }
        if (selectedItemIds.length === order.items.length) {
            toast.error("Không thể tách toàn bộ món, hãy dùng tính năng thanh toán trực tiếp")
            return
        }
        setSplitting(true)
        try {
            const res = await splitBill({
                orderId: order.id,
                itemIds: selectedItemIds,
            })
            if (res.success) {
                toast.success(`Đã tách ${selectedItemIds.length} món sang bill mới!`)
                onSplitSuccess?.()
                onClose()
            } else {
                toast.error(res.error ?? "Không thể tách bill")
            }
        } catch {
            toast.error("Lỗi khi xử lý tách món")
        } finally {
            setSplitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
            <div className="w-full max-w-4xl h-[92vh] max-h-[820px] rounded-2xl border border-cream-300 bg-cream-50 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cream-300 bg-green-900 px-5 py-3 text-cream-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-800 border border-green-700">
                            <Receipt className="h-5 w-5 text-cream-100" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-display text-base font-bold text-cream-50">
                                    Thanh toán · {order.orderNumber}
                                </h2>
                                <Badge className="bg-green-700/80 text-cream-100 text-[10px] border-none font-sans">
                                    {order.tableNumber ? `Bàn ${order.tableNumber}` : "Mang đi"}
                                </Badge>
                            </div>
                            <p className="text-[11px] text-green-300">
                                Thu ngân: <span className="font-semibold text-cream-100">{staffName}</span> · {order.items?.length ?? 0} món
                            </p>
                        </div>
                    </div>

                    {/* Mode Navigation Tabs */}
                    <div className="flex items-center gap-1.5 bg-green-950/60 p-1 rounded-xl border border-green-800">
                        <button
                            type="button"
                            onClick={() => setMainTab("PAYMENT")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all touch-target",
                                mainTab === "PAYMENT"
                                    ? "bg-green-700 text-cream-50 shadow-xs"
                                    : "text-green-300 hover:text-cream-50 hover:bg-green-900"
                            )}
                        >
                            <Banknote className="h-3.5 w-3.5" />
                            <span>Thanh toán</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMainTab("SPLIT_ITEMS")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all touch-target",
                                mainTab === "SPLIT_ITEMS"
                                    ? "bg-wine-700 text-cream-50 shadow-xs"
                                    : "text-green-300 hover:text-cream-50 hover:bg-green-900"
                            )}
                        >
                            <Scissors className="h-3.5 w-3.5" />
                            <span>Tách món</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-1 rounded-lg p-1.5 text-green-300 hover:text-cream-50 hover:bg-green-800 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {mainTab === "PAYMENT" ? (
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-cream-300">
                        {/* Left Side: Order Items & Split Person Calculator (5 cols) */}
                        <div className="md:col-span-5 flex flex-col bg-cream-100/50 min-h-0">
                            {/* Equal split person bar */}
                            <div className="border-b border-cream-200 bg-cream-100 p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-cream-600 flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-green-800" />
                                        Chia đều theo người
                                    </span>
                                    {equalSplitCount > 1 && (
                                        <span className="font-mono text-xs font-bold text-wine-800">
                                            ₫{formatPrice(perPersonPrice)} / người
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {[1, 2, 3, 4, 5].map((cnt) => (
                                        <button
                                            key={cnt}
                                            type="button"
                                            onClick={() => {
                                                setEqualSplitCount(cnt)
                                                if (cnt === 1) setCashGiven(totalAmount)
                                                else setCashGiven(Math.ceil(totalAmount / cnt))
                                            }}
                                            className={cn(
                                                "py-1.5 text-xs font-bold rounded-lg border transition-all touch-target",
                                                equalSplitCount === cnt
                                                    ? "border-green-800 bg-green-800 text-cream-50 shadow-2xs"
                                                    : "border-cream-300 bg-cream-50 text-cream-700 hover:bg-cream-200"
                                            )}
                                        >
                                            {cnt === 1 ? "1 Bill" : `${cnt} người`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Item list */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                                {order.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between rounded-xl border border-cream-200 bg-cream-50 px-3 py-2 text-xs"
                                    >
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className="font-medium text-green-950 truncate">
                                                {item.productName}
                                            </p>
                                            {item.notes && (
                                                <p className="text-[10px] text-wine-700 italic truncate">
                                                    📝 {item.notes}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-[10px] text-cream-500 font-mono">
                                                ×{item.quantity}
                                            </span>
                                            <p className="font-mono font-bold text-green-900">
                                                ₫{formatPrice(item.unitPrice * item.quantity)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Totals Summary Footer */}
                            <div className="border-t border-cream-300 bg-cream-100 p-4 shrink-0">
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between text-cream-600">
                                        <span>Tạm tính</span>
                                        <span className="font-mono">₫{formatPrice(order.subtotal ?? totalAmount)}</span>
                                    </div>
                                    {order.discount && Number(order.discount) > 0 && (
                                        <div className="flex justify-between text-wine-700 font-medium">
                                            <span>Giảm giá</span>
                                            <span className="font-mono">-₫{formatPrice(Number(order.discount))}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-2 border-t border-cream-200">
                                        <span className="font-bold text-green-950 text-sm">TỔNG CỘNG</span>
                                        <span className="font-mono text-xl font-bold text-green-900">
                                            ₫{formatPrice(totalAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Channels & Cash Numpad / VietQR (7 cols) */}
                        <div className="md:col-span-7 flex flex-col p-4 sm:p-5 bg-cream-50 min-h-0 overflow-y-auto">
                            {/* Payment Channels Grid */}
                            <div className="grid grid-cols-3 gap-2.5 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("CASH")}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-95 touch-target",
                                        paymentMethod === "CASH"
                                            ? "border-green-800 bg-green-50 text-green-900 shadow-xs ring-1 ring-green-800"
                                            : "border-cream-300 bg-cream-100 text-cream-600 hover:border-green-600"
                                    )}
                                >
                                    <Banknote className="h-5 w-5 text-green-800" />
                                    <span className="text-xs font-bold">Tiền mặt</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("CARD")}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-95 touch-target",
                                        paymentMethod === "CARD"
                                            ? "border-green-800 bg-green-50 text-green-900 shadow-xs ring-1 ring-green-800"
                                            : "border-cream-300 bg-cream-100 text-cream-600 hover:border-green-600"
                                    )}
                                >
                                    <CreditCard className="h-5 w-5 text-green-800" />
                                    <span className="text-xs font-bold">Thẻ quẹt</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("BANK_TRANSFER")}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-95 touch-target",
                                        paymentMethod === "BANK_TRANSFER"
                                            ? "border-wine-700 bg-wine-50 text-wine-900 shadow-xs ring-1 ring-wine-700"
                                            : "border-cream-300 bg-cream-100 text-cream-600 hover:border-wine-500"
                                    )}
                                >
                                    <QrCode className="h-5 w-5 text-wine-700" />
                                    <span className="text-xs font-bold">VietQR</span>
                                </button>
                            </div>

                            {/* View A: Tiền mặt with Touch Numpad */}
                            {paymentMethod === "CASH" && (
                                <div className="flex-1 flex flex-col space-y-3">
                                    {/* Denomination quick presets */}
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setCashGiven(currentTargetAmount)}
                                            className="rounded-lg border border-green-700 bg-green-100 px-2 py-2 text-xs font-bold text-green-900 hover:bg-green-200 transition-colors"
                                        >
                                            Vừa đủ
                                        </button>
                                        {[100000, 200000, 500000, 1000000, 2000000].map(amt => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setCashGiven(amt)}
                                                className={cn(
                                                    "rounded-lg border px-2 py-2 text-xs font-mono font-bold transition-all",
                                                    cashGiven === amt
                                                        ? "border-green-800 bg-green-800 text-cream-50"
                                                        : "border-cream-300 bg-cream-100 text-green-900 hover:bg-cream-200"
                                                )}
                                            >
                                                {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}K`}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Input & Change display cards */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-xl border border-cream-300 bg-cream-100 p-3">
                                            <span className="text-[10px] uppercase font-bold text-cream-600 block mb-0.5">
                                                Khách đưa
                                            </span>
                                            <p className="font-mono text-xl font-bold text-green-950">
                                                ₫{formatPrice(cashGiven)}
                                            </p>
                                        </div>

                                        <div className={cn(
                                            "rounded-xl border p-3 transition-colors",
                                            isShort
                                                ? "border-red-300 bg-red-50 text-red-700"
                                                : "border-green-300 bg-green-50 text-green-800"
                                        )}>
                                            <span className="text-[10px] uppercase font-bold block mb-0.5">
                                                {isShort ? "Còn thiếu" : "Tiền thối lại"}
                                            </span>
                                            <p className="font-mono text-xl font-bold">
                                                ₫{formatPrice(isShort ? currentTargetAmount - cashGiven : changeDue)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Full Touch Screen Numpad (for Cashier POS Terminals) */}
                                    <div className="grid grid-cols-3 gap-2 flex-1 pt-1">
                                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "DEL"].map((key) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => handleNumpadPress(key)}
                                                className={cn(
                                                    "h-12 sm:h-13 rounded-xl border font-mono text-lg font-bold transition-all active:scale-95 shadow-2xs touch-target",
                                                    key === "DEL"
                                                        ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                                        : key === "000"
                                                            ? "border-cream-300 bg-cream-200 text-green-900"
                                                            : "border-cream-300 bg-white text-green-950 hover:bg-cream-100"
                                                )}
                                            >
                                                {key === "DEL" ? "⌫" : key}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* View B: VietQR Code Generator & Verification */}
                            {paymentMethod === "BANK_TRANSFER" && (
                                <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-xl border border-wine-200 bg-wine-50/50 text-center">
                                    {qrLoading ? (
                                        <div className="flex flex-col items-center gap-2 py-10">
                                            <Loader2 className="h-8 w-8 animate-spin text-wine-700" />
                                            <p className="text-xs text-wine-900">Đang khởi tạo mã VietQR...</p>
                                        </div>
                                    ) : qrData ? (
                                        <div className="flex flex-col items-center space-y-3">
                                            <div className="relative p-2 bg-white rounded-2xl shadow-md border border-wine-200">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={qrData.qrDataUrl}
                                                    alt="VietQR Payment"
                                                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
                                                />
                                            </div>

                                            <div className="space-y-0.5">
                                                <p className="font-mono text-lg font-bold text-wine-900">
                                                    ₫{formatPrice(currentTargetAmount)}
                                                </p>
                                                <p className="text-xs text-cream-600">
                                                    {qrConfig?.bankName} · {qrConfig?.accountNumber}
                                                </p>
                                                <p className="text-[11px] font-semibold text-green-900">
                                                    Nội dung: <span className="font-mono bg-cream-200 px-1.5 py-0.5 rounded">{qrData.description}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-red-500">Chưa cấu hình thông tin ngân hàng VietQR</p>
                                    )}
                                </div>
                            )}

                            {/* View C: Card Swiping */}
                            {paymentMethod === "CARD" && (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl border border-cream-300 bg-cream-100 text-center space-y-3">
                                    <div className="h-16 w-16 rounded-2xl bg-green-100 border border-green-300 flex items-center justify-center text-green-800">
                                        <CreditCard className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h4 className="font-display text-base font-bold text-green-950">
                                            Thanh toán qua máy POS quẹt thẻ
                                        </h4>
                                        <p className="text-xs text-cream-600 mt-1 max-w-xs">
                                            Vui lòng quẹt hoặc chạm thẻ ngân hàng của khách trên máy POS cố định tại quầy với số tiền:
                                        </p>
                                        <p className="font-mono text-2xl font-bold text-green-900 mt-2">
                                            ₫{formatPrice(currentTargetAmount)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Main Payment Submit CTA Button */}
                            <div className="pt-4 shrink-0">
                                <Button
                                    onClick={handleExecutePayment}
                                    disabled={isSubmitting || (paymentMethod === "CASH" && isShort)}
                                    className={cn(
                                        "w-full h-12 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99]",
                                        paymentMethod === "BANK_TRANSFER"
                                            ? "bg-wine-700 text-white hover:bg-wine-800"
                                            : "bg-green-900 text-cream-50 hover:bg-green-800"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="mr-2 h-5 w-5" />
                                    )}
                                    <span>
                                        {isSubmitting
                                            ? "Đang hoàn tất hóa đơn..."
                                            : `Xác nhận thanh toán ₫${formatPrice(currentTargetAmount)}`}
                                    </span>
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* SPLIT BY ITEMS VIEW */
                    <div className="flex-1 flex flex-col p-5 bg-cream-50 overflow-hidden">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <div>
                                <h3 className="font-display text-base font-bold text-green-950">
                                    Tách món sang hóa đơn mới
                                </h3>
                                <p className="text-xs text-cream-600">
                                    Chọn các món khách muốn tách riêng để thanh toán độc lập.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (selectedItemIds.length === order.items.length) {
                                            setSelectedItemIds([])
                                        } else {
                                            setSelectedItemIds(order.items.map(i => i.id))
                                        }
                                    }}
                                    className="text-xs border-cream-300"
                                >
                                    {selectedItemIds.length === order.items.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                </Button>
                            </div>
                        </div>

                        {/* Items Checklist Grid */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {order.items.map((item) => {
                                const selected = selectedItemIds.includes(item.id)
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            setSelectedItemIds(prev =>
                                                prev.includes(item.id)
                                                    ? prev.filter(id => id !== item.id)
                                                    : [...prev, item.id]
                                            )
                                        }}
                                        className={cn(
                                            "flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.99]",
                                            selected
                                                ? "border-wine-700 bg-wine-50 text-wine-950 shadow-xs"
                                                : "border-cream-300 bg-cream-100 text-green-950 hover:bg-cream-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn(
                                                "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                                selected
                                                    ? "bg-wine-700 border-wine-700 text-white"
                                                    : "border-cream-400 bg-white"
                                            )}>
                                                {selected && <Check className="h-3.5 w-3.5" />}
                                            </div>
                                            <div className="truncate">
                                                <p className="font-semibold text-sm truncate">{item.productName}</p>
                                                {item.notes && <p className="text-xs text-wine-700 italic">📝 {item.notes}</p>}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 font-mono">
                                            <span className="text-xs text-cream-500 mr-2">×{item.quantity}</span>
                                            <span className="text-sm font-bold">₫{formatPrice(item.unitPrice * item.quantity)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Split Action Footer */}
                        <div className="border-t border-cream-300 pt-4 mt-3 flex items-center justify-between shrink-0">
                            <div>
                                <span className="text-xs text-cream-600 block">Đã chọn tách</span>
                                <span className="font-mono text-base font-bold text-wine-900">
                                    {selectedItemIds.length} món · ₫{formatPrice(
                                        order.items
                                            .filter(i => selectedItemIds.includes(i.id))
                                            .reduce((s, i) => s + (i.unitPrice * i.quantity), 0)
                                    )}
                                </span>
                            </div>
                            <Button
                                onClick={handleSplitSelectedItems}
                                disabled={splitting || selectedItemIds.length === 0}
                                className="h-11 px-5 rounded-xl bg-wine-700 text-white hover:bg-wine-800 font-bold text-xs shadow-md"
                            >
                                {splitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Scissors className="mr-2 h-4 w-4" />
                                )}
                                <span>Tách sang Bill mới</span>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
