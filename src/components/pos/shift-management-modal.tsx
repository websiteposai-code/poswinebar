"use client"

import { useState, useEffect } from "react"
import {
    Timer,
    Clock,
    X,
    Printer,
    Coins,
    DollarSign,
    ArrowDownRight,
    ArrowUpRight,
    AlertCircle,
    CheckCircle2,
    ShieldCheck,
    FileText,
    TrendingUp,
    Receipt,
    Loader2
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    openShift,
    closeShift,
    getShiftZReport,
    type Shift,
    type ShiftZReport,
    type DenominationCount
} from "@/actions/shifts"
import { ZReportModal } from "./z-report-modal"
import { DenominationCounter } from "./denomination-counter"
import { ShiftCashMovementModal } from "./shift-cash-movement-modal"

function fmt(n: number): string {
    return new Intl.NumberFormat("vi-VN").format(n)
}

interface ShiftManagementModalProps {
    currentShift: Shift | null
    staffId: string
    staffName: string
    staffRole: string
    onClose: () => void
    onShiftChange: () => void
}

export function ShiftManagementModal({
    currentShift,
    staffId,
    staffName,
    staffRole,
    onClose,
    onShiftChange,
}: ShiftManagementModalProps) {
    const [openingCash, setOpeningCash] = useState("")
    const [closingCash, setClosingCash] = useState("")
    const [closeNotes, setCloseNotes] = useState("")
    const [loading, setLoading] = useState(false)
    const [showClose, setShowClose] = useState(false)
    const [countMode, setCountMode] = useState<"DENOM" | "DIRECT">("DIRECT")
    const [denominations, setDenominations] = useState<DenominationCount>({})

    // Sub-modals
    const [cashMovementModalOpen, setCashMovementModalOpen] = useState(false)
    const [zReportData, setZReportData] = useState<ShiftZReport | null>(null)
    const [zReportModalOpen, setZReportModalOpen] = useState(false)

    // Shift Targets suggestion
    const [targetSuggestion, setTargetSuggestion] = useState<{
        revenueTarget: number
        orderTarget: number
        customerTarget: number
        pushProducts: { productId: string; productName: string; reason: string }[]
        basedOn: string
    } | null>(null)
    const [editRevTarget, setEditRevTarget] = useState("")
    const [editOrdTarget, setEditOrdTarget] = useState("")
    const [editCustTarget, setEditCustTarget] = useState("")
    const [targetApproved, setTargetApproved] = useState(false)
    const [evaluationNotes, setEvaluationNotes] = useState("")

    useEffect(() => {
        if (currentShift) {
            import("@/actions/shift-targets")
                .then(({ suggestShiftTargets }) => {
                    suggestShiftTargets(currentShift.id).then((s) => {
                        setTargetSuggestion(s)
                        setEditRevTarget(String(s.revenueTarget))
                        setEditOrdTarget(String(s.orderTarget))
                        setEditCustTarget(String(s.customerTarget))
                    })
                })
                .catch(() => {
                    // target suggestion optional
                })
        }
    }, [currentShift])

    // Handle Open Shift
    const handleOpenShift = async () => {
        const amt = parseInt(openingCash.replace(/\D/g, ""), 10) || 0
        if (amt < 0) {
            toast.error("Vui lòng nhập quỹ mở ca hợp lệ")
            return
        }
        setLoading(true)
        try {
            const result = await openShift({
                staffId,
                staffName,
                staffRole,
                openingCash: amt,
            })
            if (result.success) {
                toast.success(`Mở ca thành công — Quỹ ban đầu: ₫${fmt(amt)}`)
                onShiftChange()
            } else {
                toast.error(result.error ?? "Không thể mở ca")
            }
        } catch {
            toast.error("Lỗi kết nối khi mở ca")
        } finally {
            setLoading(false)
        }
    }

    // Handle Close Shift
    const handleCloseShift = async () => {
        if (!currentShift) return
        const amt = parseInt(closingCash.replace(/\D/g, ""), 10)
        if (isNaN(amt) || amt < 0) {
            toast.error("Vui lòng nhập hoặc kiểm đếm tiền mặt thực tế cuối ca")
            return
        }

        setLoading(true)
        try {
            const result = await closeShift({
                shiftId: currentShift.id,
                closingCash: amt,
                denominations: Object.keys(denominations).length > 0 ? denominations : undefined,
                notes: closeNotes.trim() || undefined,
            })

            if (result.success && result.data) {
                const diff = result.data.variance ?? 0
                if (Math.abs(diff) <= 10000) {
                    toast.success("Đóng ca thành công — Két tiền khớp!")
                } else if (diff > 0) {
                    toast.warning(`Đóng ca — Thừa két ₫${fmt(diff)}`)
                } else {
                    toast.error(`Đóng ca — Thiếu két ₫${fmt(Math.abs(diff))}`)
                }

                // Show Z-Report print preview modal immediately
                setZReportData(result.data)
                setZReportModalOpen(true)
                onShiftChange()
            } else {
                toast.error(result.error ?? "Không thể đóng ca")
            }
        } catch {
            toast.error("Lỗi khi gửi yêu cầu đóng ca")
        } finally {
            setLoading(false)
        }
    }

    // Handle X-Report (Mid-shift print preview)
    const handlePrintXReport = async () => {
        if (!currentShift) return
        setLoading(true)
        try {
            const res = await getShiftZReport(currentShift.id)
            if (res.success && res.data) {
                setZReportData(res.data)
                setZReportModalOpen(true)
            } else {
                toast.error(res.error || "Không thể tải báo cáo ca")
            }
        } catch {
            toast.error("Lỗi kết nối khi tải báo cáo X-Report")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4">
                <div className="w-full max-w-lg rounded-2xl border border-cream-300 bg-white shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-cream-200 bg-green-900 text-cream-50 shrink-0">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-display text-base font-bold">
                                    {currentShift ? `Ca ${currentShift.shiftNumber}` : "Mở ca làm việc mới"}
                                </h2>
                                {currentShift && (
                                    <Badge className="bg-emerald-700/80 text-white text-[10px] border-none">
                                        Đang hoạt động
                                    </Badge>
                                )}
                            </div>
                            <p className="text-[11px] text-green-300 mt-0.5">
                                {currentShift
                                    ? `Mở lúc ${new Date(currentShift.openedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · Thu ngân: ${staffName}`
                                    : "Nhập quỹ tiền mặt ban đầu để bắt đầu bán hàng"}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-green-300 hover:text-cream-50 hover:bg-green-800 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* VIEW 1: NO SHIFT OPEN */}
                    {!currentShift && (
                        <div className="p-5 space-y-4">
                            <div className="rounded-xl border border-cream-200 bg-cream-50 p-4 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-green-950 block">
                                    Quỹ tiền mặt mở ca (Opening Float) <span className="text-rose-600">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-cream-400 font-mono font-bold">
                                        ₫
                                    </span>
                                    <Input
                                        value={openingCash}
                                        onChange={(e) => setOpeningCash(e.target.value.replace(/\D/g, ""))}
                                        placeholder="2,000,000"
                                        className="h-11 pl-7 text-lg font-mono font-bold border-cream-300 bg-white text-green-950"
                                        autoFocus
                                    />
                                </div>
                                {openingCash && (
                                    <p className="text-[11px] text-green-800 font-mono font-semibold">
                                        = ₫{fmt(parseInt(openingCash, 10) || 0)}
                                    </p>
                                )}
                                <div className="flex gap-1.5 pt-1">
                                    {[1000000, 2000000, 3000000, 5000000].map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => setOpeningCash(String(v))}
                                            className="flex-1 rounded-lg border border-cream-300 bg-white py-1.5 text-xs font-mono font-medium text-cream-700 hover:border-green-700 hover:bg-green-50 transition-colors"
                                        >
                                            ₫{fmt(v)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={handleOpenShift}
                                disabled={loading || !openingCash}
                                className="w-full h-11 bg-green-900 text-cream-50 hover:bg-green-800 text-sm font-bold shadow-md"
                            >
                                <Timer className="mr-2 h-4 w-4" />
                                {loading ? "Đang mở ca..." : "Xác nhận Mở ca bán hàng"}
                            </Button>
                        </div>
                    )}

                    {/* VIEW 2: SHIFT ACTIVE (DASHBOARD & ACTIONS) */}
                    {currentShift && !showClose && (
                        <div className="p-5 space-y-4">
                            {/* Stats 3 cards */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-xl border border-cream-200 bg-cream-50 p-2.5">
                                    <p className="text-[10px] font-bold uppercase text-cream-500">Doanh thu thực</p>
                                    <p className="font-mono text-base font-bold text-green-950 mt-0.5">
                                        ₫{fmt(currentShift.totalSales)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-cream-200 bg-cream-50 p-2.5">
                                    <p className="text-[10px] font-bold uppercase text-cream-500">Đơn hoàn tất</p>
                                    <p className="font-mono text-base font-bold text-green-900 mt-0.5">
                                        {currentShift.orderCount} đơn
                                    </p>
                                </div>
                                <div className="rounded-xl border border-cream-200 bg-cream-50 p-2.5">
                                    <p className="text-[10px] font-bold uppercase text-cream-500">Sản phẩm bán</p>
                                    <p className="font-mono text-base font-bold text-wine-900 mt-0.5">
                                        {currentShift.itemsSold} món
                                    </p>
                                </div>
                            </div>

                            {/* Payment Breakdown & Cash Drawer Status */}
                            <div className="rounded-xl border border-cream-200 bg-white p-3.5 space-y-2 text-xs">
                                <div className="flex items-center justify-between border-b border-cream-100 pb-1.5">
                                    <span className="font-bold text-green-950 uppercase tracking-wider text-[10px]">
                                        Kênh thu tiền
                                    </span>
                                    <span className="font-bold text-green-950 uppercase tracking-wider text-[10px]">
                                        Số tiền
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-cream-600">Tiền mặt (Cash):</span>
                                    <span className="font-mono font-bold text-green-900">₫{fmt(currentShift.totalCash)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-cream-600">Thẻ POS ngân hàng:</span>
                                    <span className="font-mono font-bold text-green-900">₫{fmt(currentShift.totalCard)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-cream-600">VietQR / Chuyển khoản:</span>
                                    <span className="font-mono font-bold text-wine-900">₫{fmt(currentShift.totalQR)}</span>
                                </div>

                                {/* Drawer summary */}
                                <div className="pt-2 border-t border-cream-200 space-y-1">
                                    <div className="flex justify-between font-medium">
                                        <span className="text-cream-600">Quỹ tiền mở ca:</span>
                                        <span className="font-mono">₫{fmt(currentShift.openingCash)}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline pt-1 border-t border-cream-100 text-sm font-bold">
                                        <span className="text-green-950">Tiền lý thuyết trong két:</span>
                                        <span className="font-mono text-green-900 text-base">
                                            ₫{fmt(currentShift.expectedCash ?? currentShift.openingCash)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions (Thu/Chi két & In X-Report) */}
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setCashMovementModalOpen(true)}
                                    className="border-cream-300 bg-cream-50 hover:bg-cream-100 text-green-950 text-xs font-semibold h-10 flex items-center justify-center gap-1.5"
                                >
                                    <DollarSign className="h-4 w-4 text-green-800" />
                                    <span>Thu / Chi két tiền</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handlePrintXReport}
                                    disabled={loading}
                                    className="border-cream-300 bg-cream-50 hover:bg-cream-100 text-green-950 text-xs font-semibold h-10 flex items-center justify-center gap-1.5"
                                >
                                    <Printer className="h-4 w-4 text-green-800" />
                                    <span>In kiểm ca (X-Report)</span>
                                </Button>
                            </div>

                            {/* Recent Cash Movements if any */}
                            {currentShift.movements && currentShift.movements.length > 0 && (
                                <div className="rounded-xl border border-cream-200 bg-white p-3 space-y-1.5">
                                    <p className="text-[10px] font-bold uppercase text-cream-500">
                                        Thu / Chi két gần đây ({currentShift.movements.length})
                                    </p>
                                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                        {currentShift.movements.map((m) => (
                                            <div key={m.id} className="flex justify-between text-[11px] items-center">
                                                <span className="text-cream-600 truncate pr-2">
                                                    {m.type === "CASH_OUT" ? "🔴 [CHI]" : "🟢 [THU]"} {m.reason}
                                                </span>
                                                <span className={cn("font-mono font-bold shrink-0", m.type === "CASH_OUT" ? "text-rose-700" : "text-emerald-700")}>
                                                    {m.type === "CASH_OUT" ? "-" : "+"}₫{fmt(m.amount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Close Shift CTA */}
                            <Button
                                type="button"
                                onClick={() => {
                                    setShowClose(true)
                                    setClosingCash("")
                                    setDenominations({})
                                }}
                                className="w-full h-11 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md"
                            >
                                <Clock className="mr-2 h-4 w-4" />
                                Tiến hành Đóng ca & In Báo cáo Z-Report
                            </Button>
                        </div>
                    )}

                    {/* VIEW 3: CLOSE SHIFT CASH RECONCILIATION */}
                    {currentShift && showClose && (
                        <div className="p-5 space-y-4">
                            {/* Summary banner */}
                            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-xs space-y-1">
                                <div className="flex justify-between text-amber-950 font-bold">
                                    <span>Quỹ tiền mặt kỳ vọng:</span>
                                    <span className="font-mono text-sm">₫{fmt(currentShift.expectedCash ?? currentShift.openingCash)}</span>
                                </div>
                                <p className="text-[11px] text-amber-700">
                                    = Quỹ mở (₫{fmt(currentShift.openingCash)}) + Bán tiền mặt (₫{fmt(currentShift.totalCash)}) + Thu/Chi két
                                </p>
                            </div>

                            {/* Count Mode Tabs */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-green-950">
                                    Phương thức kiểm đếm:
                                </span>
                                <div className="flex gap-1 bg-cream-100 p-0.5 rounded-lg border border-cream-200">
                                    <button
                                        type="button"
                                        onClick={() => setCountMode("DIRECT")}
                                        className={cn(
                                            "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                                            countMode === "DIRECT" ? "bg-white text-green-950 shadow-2xs" : "text-cream-600"
                                        )}
                                    >
                                        Nhập trực tiếp
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCountMode("DENOM")}
                                        className={cn(
                                            "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                                            countMode === "DENOM" ? "bg-white text-green-950 shadow-2xs" : "text-cream-600"
                                        )}
                                    >
                                        <Coins className="h-3 w-3" />
                                        Đếm theo mệnh giá
                                    </button>
                                </div>
                            </div>

                            {/* Mode A: Direct input */}
                            {countMode === "DIRECT" ? (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-green-950">
                                        Tiền mặt thực tế đếm được <span className="text-rose-600">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-cream-400">₫</span>
                                        <Input
                                            value={closingCash}
                                            onChange={(e) => setClosingCash(e.target.value.replace(/\D/g, ""))}
                                            placeholder="Nhập tổng số tiền thực đếm..."
                                            autoFocus
                                            className="pl-7 font-mono text-lg font-bold h-11 border-cream-300 bg-cream-50"
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* Mode B: Denomination Counter */
                                <DenominationCounter
                                    initialCounts={denominations}
                                    onApply={(total, counts) => {
                                        setClosingCash(String(total))
                                        setDenominations(counts)
                                        toast.success(`Đã cập nhật tiền thực tế: ₫${fmt(total)}`)
                                    }}
                                />
                            )}

                            {/* Live Discrepancy / Variance Calculation */}
                            {closingCash && (
                                (() => {
                                    const counted = parseInt(closingCash, 10) || 0
                                    const expected = currentShift.expectedCash ?? currentShift.openingCash
                                    const diff = counted - expected
                                    const isMatch = Math.abs(diff) <= 10000

                                    return (
                                        <div
                                            className={cn(
                                                "rounded-xl border p-3 flex items-center justify-between text-xs",
                                                isMatch
                                                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                                    : diff > 0
                                                        ? "border-amber-300 bg-amber-50 text-amber-950"
                                                        : "border-rose-300 bg-rose-50 text-rose-950"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isMatch ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                                                ) : (
                                                    <AlertCircle className="h-4 w-4 text-amber-700" />
                                                )}
                                                <div>
                                                    <p className="font-bold">
                                                        {isMatch ? "Két tiền khớp hoàn toàn" : diff > 0 ? "Thừa két tiền" : "Thiếu két tiền"}
                                                    </p>
                                                    <p className="text-[10px] opacity-80">
                                                        {isMatch ? "Chênh lệch trong ngưỡng cho phép (<= 10k)" : "Cần giải trình lý do bên dưới"}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="font-mono text-base font-bold">
                                                {diff >= 0 ? "+" : ""}₫{fmt(diff)}
                                            </span>
                                        </div>
                                    )
                                })()
                            )}

                            {/* Close Notes */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-green-950">
                                    Ghi chú bàn giao ca
                                </label>
                                <Input
                                    value={closeNotes}
                                    onChange={(e) => setCloseNotes(e.target.value)}
                                    placeholder="VD: Khách boa thêm 20k, bù chênh lệch tiền lẻ..."
                                    className="text-xs h-9 border-cream-300"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2 border-t border-cream-200">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowClose(false)}
                                    className="flex-1 border-cream-300 text-cream-600 text-xs h-10"
                                >
                                    ← Quay lại
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleCloseShift}
                                    disabled={loading || !closingCash}
                                    className="flex-1 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs h-10 shadow-md"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Printer className="h-4 w-4 mr-1.5" />}
                                    Xác nhận Đóng ca & In Z-Report
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-Modal: Cash Movement (Thu/Chi két) */}
            {cashMovementModalOpen && currentShift && (
                <ShiftCashMovementModal
                    shiftId={currentShift.id}
                    staffName={staffName}
                    onClose={() => setCashMovementModalOpen(false)}
                    onSuccess={() => onShiftChange()}
                />
            )}

            {/* Sub-Modal: Z-Report Thermal Slip */}
            {zReportModalOpen && zReportData && (
                <ZReportModal
                    report={zReportData}
                    onClose={() => setZReportModalOpen(false)}
                />
            )}
        </>
    )
}
