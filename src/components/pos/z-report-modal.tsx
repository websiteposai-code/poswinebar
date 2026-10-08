"use client"

import { forwardRef, useRef } from "react"
import { Printer, Copy, X, CheckCircle2, AlertTriangle, Clock, DollarSign, ArrowDownRight, ArrowUpRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { ShiftZReport } from "@/actions/shifts"

function fmt(n: number): string {
    return new Intl.NumberFormat("vi-VN").format(n)
}

function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return "Đang diễn ra"
    try {
        const d = new Date(dateStr)
        return d.toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return dateStr
    }
}

interface ZReportSlipProps {
    report: ShiftZReport
    className?: string
}

export const ZReportSlip = forwardRef<HTMLDivElement, ZReportSlipProps>(
    function ZReportSlip({ report, className }, ref) {
        const isXReport = !report.isClosed

        return (
            <div
                ref={ref}
                className={cn(
                    "w-[320px] bg-white p-5 font-mono text-black text-xs select-text",
                    className
                )}
            >
                {/* Header */}
                <div className="text-center mb-3">
                    <h2 className="text-base font-bold tracking-wider">NOON & NOIR</h2>
                    <p className="text-[10px] italic text-gray-500">Wine Alley</p>
                    <div className="mt-2 py-1 border-y border-dashed border-gray-400">
                        <p className="text-[11px] font-bold uppercase tracking-wide">
                            {isXReport ? "BÁO CÁO GIỮA CA (X-REPORT)" : "BÁO CÁO KẾT CA (Z-REPORT)"}
                        </p>
                    </div>
                </div>

                {/* Shift Info */}
                <div className="space-y-1 text-[10px] pb-2 border-b border-dashed border-gray-300">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Mã ca:</span>
                        <span className="font-bold">{report.shiftNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Thu ngân:</span>
                        <span className="font-bold">{report.staffName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Mở ca:</span>
                        <span>{formatDateTime(report.openedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Đóng ca:</span>
                        <span>{formatDateTime(report.closedAt)}</span>
                    </div>
                </div>

                {/* Section 1: Doanh thu bán hàng */}
                <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">
                        1. DOANH THU CA
                    </p>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-gray-600">Tổng tiền hàng:</span>
                        <span>₫{fmt(report.grossRevenue)}</span>
                    </div>
                    {report.discounts > 0 && (
                        <div className="flex justify-between text-[11px] text-gray-600">
                            <span>Giảm giá:</span>
                            <span>-₫{fmt(report.discounts)}</span>
                        </div>
                    )}
                    {report.taxAmount > 0 && (
                        <div className="flex justify-between text-[11px] text-gray-600">
                            <span>Thuế VAT:</span>
                            <span>+₫{fmt(report.taxAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xs font-bold pt-1 border-t border-dotted border-gray-300">
                        <span>THỰC THU (NET):</span>
                        <span>₫{fmt(report.netRevenue)}</span>
                    </div>
                </div>

                {/* Section 2: Kênh thanh toán */}
                <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">
                        2. KÊNH THANH TOÁN
                    </p>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-gray-600">Tiền mặt (Cash):</span>
                        <span className="font-bold">₫{fmt(report.cashRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-gray-600">Thẻ POS (Card):</span>
                        <span>₫{fmt(report.cardRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-gray-600">VietQR / Chuyển khoản:</span>
                        <span>₫{fmt(report.qrRevenue)}</span>
                    </div>
                </div>

                {/* Section 3: Đối soát két tiền mặt (Crucial for Cashiers) */}
                <div className="py-2.5 border-b-2 border-black space-y-1">
                    <p className="text-[10px] font-bold uppercase text-black tracking-wider">
                        3. ĐỐI SOÁT TIỀN KÉT
                    </p>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-gray-600">Quỹ tiền mở ca:</span>
                        <span>₫{fmt(report.openingCash)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-gray-600">(+) Bán hàng tiền mặt:</span>
                        <span>+₫{fmt(report.cashRevenue)}</span>
                    </div>
                    {report.cashInTotal > 0 && (
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600">(+) Nạp thêm quỹ két:</span>
                            <span>+₫{fmt(report.cashInTotal)}</span>
                        </div>
                    )}
                    {report.cashOutTotal > 0 && (
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600">(-) Chi tiêu / Rút két:</span>
                            <span>-₫{fmt(report.cashOutTotal)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-[11px] font-semibold pt-1 border-t border-dotted border-gray-300">
                        <span>Tiền lý thuyết (Expected):</span>
                        <span>₫{fmt(report.expectedCash)}</span>
                    </div>
                    {report.closingCash !== null && (
                        <>
                            <div className="flex justify-between text-xs font-bold pt-1">
                                <span>Tiền đếm thực tế:</span>
                                <span>₫{fmt(report.closingCash)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold pt-1 border-t border-dashed border-gray-400">
                                <span>CHÊNH LỆCH KÉT:</span>
                                <span className={cn(
                                    report.variance === 0 || Math.abs(report.variance ?? 0) <= 5000
                                        ? "text-black"
                                        : (report.variance ?? 0) > 0
                                            ? "text-black"
                                            : "text-black"
                                )}>
                                    {(report.variance ?? 0) === 0
                                        ? "KHỚP (0₫)"
                                        : (report.variance ?? 0) > 0
                                            ? `THỪA +₫${fmt(report.variance ?? 0)}`
                                            : `THIẾU -₫${fmt(Math.abs(report.variance ?? 0))}`}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* Section 4: Phiếu thu/chi trong ca (nếu có) */}
                {report.movements && report.movements.length > 0 && (
                    <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1">
                        <p className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">
                            4. THU / CHI KÉT TRONG CA ({report.movements.length})
                        </p>
                        <div className="space-y-1 pt-1">
                            {report.movements.map((m) => (
                                <div key={m.id} className="flex justify-between text-[10px]">
                                    <span className="truncate pr-2">
                                        {m.type === "CASH_OUT" ? "[CHI]" : "[THU]"} {m.reason}
                                    </span>
                                    <span className="font-bold shrink-0">
                                        {m.type === "CASH_OUT" ? "-" : "+"}₫{fmt(m.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Section 5: Bảng đếm mệnh giá (nếu có) */}
                {report.denominations && Object.keys(report.denominations).length > 0 && (
                    <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1">
                        <p className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">
                            5. BẢNG KIỂM ĐẾM MỆNH GIÁ
                        </p>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] pt-1">
                            {report.denominations.d500k ? <div>500k: ×{report.denominations.d500k} = ₫{fmt(report.denominations.d500k * 500000)}</div> : null}
                            {report.denominations.d200k ? <div>200k: ×{report.denominations.d200k} = ₫{fmt(report.denominations.d200k * 200000)}</div> : null}
                            {report.denominations.d100k ? <div>100k: ×{report.denominations.d100k} = ₫{fmt(report.denominations.d100k * 100000)}</div> : null}
                            {report.denominations.d50k ? <div>50k: ×{report.denominations.d50k} = ₫{fmt(report.denominations.d50k * 50000)}</div> : null}
                            {report.denominations.d20k ? <div>20k: ×{report.denominations.d20k} = ₫{fmt(report.denominations.d20k * 20000)}</div> : null}
                            {report.denominations.d10k ? <div>10k: ×{report.denominations.d10k} = ₫{fmt(report.denominations.d10k * 10000)}</div> : null}
                            {report.denominations.d5k ? <div>5k: ×{report.denominations.d5k} = ₫{fmt(report.denominations.d5k * 5000)}</div> : null}
                            {report.denominations.d2k ? <div>2k: ×{report.denominations.d2k} = ₫{fmt(report.denominations.d2k * 2000)}</div> : null}
                            {report.denominations.d1k ? <div>1k: ×{report.denominations.d1k} = ₫{fmt(report.denominations.d1k * 1000)}</div> : null}
                        </div>
                    </div>
                )}

                {/* Section 6: Vận hành & Món bán chạy */}
                <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">
                        6. THỐNG KÊ VẬN HÀNH
                    </p>
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">Số đơn hoàn tất:</span>
                        <span className="font-bold">{report.orderCount} đơn</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">Sản phẩm đã bán:</span>
                        <span className="font-bold">{report.itemsSold} món/ly</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">Giá trị đơn TB (AOV):</span>
                        <span>₫{fmt(report.avgOrderValue)}</span>
                    </div>
                    {report.topItems && report.topItems.length > 0 && (
                        <div className="pt-1.5 space-y-0.5">
                            <p className="text-[9px] text-gray-500 italic">Top bán chạy trong ca:</p>
                            {report.topItems.map((it, idx) => (
                                <div key={idx} className="flex justify-between text-[9px] text-gray-700">
                                    <span className="truncate pr-2">{idx + 1}. {it.name} (x{it.quantity})</span>
                                    <span>₫{fmt(it.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 7: Ghi chú */}
                {report.notes && (
                    <div className="py-2 border-b border-dashed border-gray-300 text-[10px]">
                        <span className="font-bold text-gray-700">Ghi chú ca: </span>
                        <span className="italic">{report.notes}</span>
                    </div>
                )}

                {/* Signature Block */}
                <div className="pt-4 pb-2 text-center space-y-8">
                    <div className="flex justify-between text-[10px]">
                        <div>
                            <p className="font-bold">Thu ngân giao ca</p>
                            <p className="text-[8px] text-gray-400 italic">(Ký, ghi rõ họ tên)</p>
                        </div>
                        <div>
                            <p className="font-bold">Quản lý nhận ca</p>
                            <p className="text-[8px] text-gray-400 italic">(Ký, ghi rõ họ tên)</p>
                        </div>
                    </div>
                    <div className="text-[8px] text-gray-400">
                        In lúc: {new Date().toLocaleString("vi-VN")} · POS Noon & Noir
                    </div>
                </div>
            </div>
        )
    }
)

interface ZReportModalProps {
    report: ShiftZReport
    onClose: () => void
}

export function ZReportModal({ report, onClose }: ZReportModalProps) {
    const slipRef = useRef<HTMLDivElement>(null)

    const handlePrint = () => {
        window.print()
    }

    const handleCopyText = () => {
        const text = `=== NOON & NOIR - ${report.isClosed ? "BÁO CÁO KẾT CA (Z-REPORT)" : "BÁO CÁO GIỮA CA (X-REPORT)"} ===
Mã ca: ${report.shiftNumber}
Thu ngân: ${report.staffName}
Thời gian: ${formatDateTime(report.openedAt)} -> ${formatDateTime(report.closedAt)}
--------------------------------
1. DOANH THU:
- Thực thu (Net): ₫${fmt(report.netRevenue)}
- Tiền mặt: ₫${fmt(report.cashRevenue)}
- Thẻ POS: ₫${fmt(report.cardRevenue)}
- QR Pay: ₫${fmt(report.qrRevenue)}
--------------------------------
2. ĐỐI SOÁT KÉT TIỀN MẶT:
- Quỹ mở ca: ₫${fmt(report.openingCash)}
- (+) Bán tiền mặt: +₫${fmt(report.cashRevenue)}
- (+) Nạp quỹ: +₫${fmt(report.cashInTotal)}
- (-) Chi két: -₫${fmt(report.cashOutTotal)}
- (=) Tiền kỳ vọng: ₫${fmt(report.expectedCash)}
- Tiền đếm thực tế: ${report.closingCash !== null ? `₫${fmt(report.closingCash)}` : "Chưa đóng ca"}
- Chênh lệch: ${(report.variance ?? 0) === 0 ? "Khớp (0₫)" : (report.variance ?? 0) > 0 ? `Thừa +₫${fmt(report.variance ?? 0)}` : `Thiếu -₫${fmt(Math.abs(report.variance ?? 0))}`}
--------------------------------
3. VẬN HÀNH:
- Số đơn: ${report.orderCount} | Số món/ly: ${report.itemsSold}
${report.notes ? `Ghi chú: ${report.notes}\n` : ""}`

        navigator.clipboard.writeText(text)
        toast.success("Đã sao chép nội dung báo cáo ca vào clipboard!")
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
            <div className="flex flex-col items-center gap-3 max-h-[95vh]">
                {/* Printable Frame */}
                <div className="rounded-xl shadow-2xl overflow-y-auto max-h-[82vh] print:max-h-none print:shadow-none border border-cream-300">
                    <ZReportSlip ref={slipRef} report={report} className="print:p-0" />
                </div>

                {/* Action buttons (hidden in print) */}
                <div className="flex items-center gap-2 print:hidden bg-cream-950/80 p-1.5 rounded-xl border border-cream-800 backdrop-blur-md">
                    <Button
                        onClick={handlePrint}
                        className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs font-bold h-9 px-4 flex items-center gap-2"
                    >
                        <Printer className="h-4 w-4" />
                        In phiếu {report.isClosed ? "Z-Report" : "X-Report"}
                    </Button>
                    <Button
                        onClick={handleCopyText}
                        variant="outline"
                        className="border-cream-700 bg-cream-900/60 text-cream-100 hover:bg-cream-800 text-xs h-9 px-3 flex items-center gap-1.5"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        Sao chép
                    </Button>
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="border-cream-700 bg-cream-900/60 text-cream-300 hover:bg-cream-800 text-xs h-9 px-3"
                    >
                        Đóng
                    </Button>
                </div>
            </div>
        </div>
    )
}
