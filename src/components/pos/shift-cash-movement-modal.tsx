"use client"

import { useState } from "react"
import { ArrowDownRight, ArrowUpRight, X, Loader2, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addShiftCashMovement, type CashMovementType } from "@/actions/shifts"

function fmt(n: number): string {
    return new Intl.NumberFormat("vi-VN").format(n)
}

const OUT_PRESETS = [
    "Mua đá lạnh",
    "Mua chanh / lá thơm / đồ bar khẩn",
    "Trả tiền ship Grab / Ahamove",
    "Rút bớt tiền nộp két sắt (Cash Drop)",
    "Chi tiền vệ sinh / rác ca",
]

const IN_PRESETS = [
    "Bổ sung tiền lẻ thối trong ca",
    "Chủ quán / Quản lý nạp thêm tiền két",
    "Hoàn ứng tiền mua đồ thừa",
]

const AMOUNT_PRESETS = [50000, 100000, 200000, 500000, 1000000]

interface ShiftCashMovementModalProps {
    shiftId: string
    staffName: string
    onClose: () => void
    onSuccess: () => void
}

export function ShiftCashMovementModal({
    shiftId,
    staffName,
    onClose,
    onSuccess,
}: ShiftCashMovementModalProps) {
    const [type, setType] = useState<CashMovementType>("CASH_OUT")
    const [amount, setAmount] = useState("")
    const [reason, setReason] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const num = parseInt(amount.replace(/\D/g, ""), 10) || 0
        if (num <= 0) {
            toast.error("Vui lòng nhập số tiền hợp lệ")
            return
        }
        if (!reason.trim()) {
            toast.error("Vui lòng nhập lý do thu/chi")
            return
        }

        setLoading(true)
        try {
            const res = await addShiftCashMovement({
                shiftId,
                type,
                amount: num,
                reason: reason.trim(),
                staffName,
            })
            if (res.success) {
                toast.success(
                    type === "CASH_OUT"
                        ? `Đã ghi nhận CHI KÉT: ₫${fmt(num)}`
                        : `Đã ghi nhận NẠP KÉT: ₫${fmt(num)}`
                )
                onSuccess()
                onClose()
            } else {
                toast.error(res.error || "Không thể lưu phiếu thu/chi")
            }
        } catch {
            toast.error("Lỗi khi kết nối máy chủ")
        } finally {
            setLoading(false)
        }
    }

    const presets = type === "CASH_OUT" ? OUT_PRESETS : IN_PRESETS

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-cream-300 bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cream-200 pb-3">
                    <h3 className="font-display text-base font-bold text-green-950 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-800" />
                        Ghi nhận Thu / Chi két tiền mặt
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-cream-400 hover:text-cream-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    {/* Type Selector */}
                    <div className="grid grid-cols-2 gap-2 bg-cream-100/70 p-1 rounded-xl border border-cream-200">
                        <button
                            type="button"
                            onClick={() => { setType("CASH_OUT"); setReason("") }}
                            className={cn(
                                "flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold transition-all",
                                type === "CASH_OUT"
                                    ? "bg-rose-700 text-white shadow-xs"
                                    : "text-cream-600 hover:text-green-950"
                            )}
                        >
                            <ArrowDownRight className="h-3.5 w-3.5" />
                            Chi tiền két (Cash Out)
                        </button>
                        <button
                            type="button"
                            onClick={() => { setType("CASH_IN"); setReason("") }}
                            className={cn(
                                "flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold transition-all",
                                type === "CASH_IN"
                                    ? "bg-emerald-800 text-white shadow-xs"
                                    : "text-cream-600 hover:text-green-950"
                            )}
                        >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            Nạp thêm quỹ (Cash In)
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-green-950">
                            Số tiền {type === "CASH_OUT" ? "chi ra" : "nạp vào"} <span className="text-rose-600">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-cream-400 text-sm">
                                ₫
                            </span>
                            <Input
                                value={amount}
                                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                                placeholder="0"
                                autoFocus
                                className="pl-7 font-mono text-base font-bold h-10 border-cream-300 bg-cream-50/60"
                            />
                        </div>
                        {amount && (
                            <p className="text-[11px] text-green-800 font-mono font-semibold">
                                = ₫{fmt(parseInt(amount, 10) || 0)}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {AMOUNT_PRESETS.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setAmount(String(p))}
                                    className="px-2 py-1 rounded-md border border-cream-200 bg-cream-100/60 hover:bg-cream-200 text-[10px] font-mono font-semibold text-cream-700 transition-colors"
                                >
                                    ₫{fmt(p)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reason Presets */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-green-950">
                            Lý do {type === "CASH_OUT" ? "chi" : "nạp"} <span className="text-rose-600">*</span>
                        </label>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                            {presets.map((pr) => (
                                <button
                                    key={pr}
                                    type="button"
                                    onClick={() => setReason(pr)}
                                    className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                                        reason === pr
                                            ? "border-green-800 bg-green-50 text-green-900 font-semibold"
                                            : "border-cream-200 bg-cream-50 text-cream-600 hover:border-cream-300"
                                    )}
                                >
                                    {pr}
                                </button>
                            ))}
                        </div>
                        <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Nhập chi tiết lý do hoặc ghi chú..."
                            className="text-xs h-8 border-cream-300"
                        />
                    </div>

                    {/* Footer CTA */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-cream-200">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="border-cream-300 text-cream-600 text-xs h-9"
                        >
                            Huỷ
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !amount || !reason.trim()}
                            className={cn(
                                "text-white text-xs h-9 font-bold px-4",
                                type === "CASH_OUT" ? "bg-rose-700 hover:bg-rose-800" : "bg-emerald-800 hover:bg-emerald-900"
                            )}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            {type === "CASH_OUT" ? "Xác nhận Chi tiền" : "Xác nhận Nạp tiền"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
