"use client"

import { useState, useEffect, useMemo, useTransition } from "react"
import {
    FileText,
    Search,
    Filter,
    Download,
    CheckCircle2,
    Clock,
    XCircle,
    ExternalLink,
    Building2,
    Mail,
    Phone,
    Calendar,
    Receipt,
    RefreshCw,
    QrCode,
    SlidersHorizontal,
    ChevronRight,
    Loader2,
    X
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    getInvoiceRequests,
    updateInvoiceRequestStatus,
    type InvoiceRequest,
    type InvoiceRequestStatus
} from "@/actions/invoices"

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr)
        return d.toLocaleDateString("vi-VN", {
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

export default function InvoicesDashboardPage() {
    const [requests, setRequests] = useState<InvoiceRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceRequestStatus>("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [isPending, startTransition] = useTransition()

    // Modals
    const [selectedRequest, setSelectedRequest] = useState<InvoiceRequest | null>(null)
    const [issueModalOpen, setIssueModalOpen] = useState(false)
    const [eInvoiceInput, setEInvoiceInput] = useState("")
    const [rejectModalOpen, setRejectModalOpen] = useState(false)
    const [rejectReasonInput, setRejectReasonInput] = useState("")
    const [actionLoading, setActionLoading] = useState(false)

    // Load data
    const fetchRequests = async () => {
        setLoading(true)
        try {
            const data = await getInvoiceRequests()
            setRequests(data)
        } catch {
            toast.error("Không thể tải danh sách hoá đơn")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRequests()
    }, [])

    // Stats
    const stats = useMemo(() => {
        const total = requests.length
        const pending = requests.filter((r) => r.status === "PENDING").length
        const issued = requests.filter((r) => r.status === "ISSUED").length
        const rejected = requests.filter((r) => r.status === "REJECTED").length
        const totalVat = requests.reduce((sum, r) => sum + (r.vatAmount || 0), 0)
        return { total, pending, issued, rejected, totalVat }
    }, [requests])

    // Filter & Search
    const filteredRequests = useMemo(() => {
        return requests.filter((r) => {
            if (statusFilter !== "ALL" && r.status !== statusFilter) return false
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const matchOrder = r.orderNumber.toLowerCase().includes(q)
                const matchMst = r.customerTaxCode.toLowerCase().includes(q)
                const matchCompany = r.companyName.toLowerCase().includes(q)
                const matchEmail = r.recipientEmail.toLowerCase().includes(q)
                if (!matchOrder && !matchMst && !matchCompany && !matchEmail) return false
            }
            return true
        })
    }, [requests, statusFilter, searchQuery])

    // Handle Confirm Issued
    const handleConfirmIssue = async () => {
        if (!selectedRequest) return
        if (!eInvoiceInput.trim()) {
            toast.error("Vui lòng nhập Ký hiệu & Số hoá đơn (VD: 1C26TNN-0001234)")
            return
        }

        setActionLoading(true)
        try {
            const res = await updateInvoiceRequestStatus({
                requestId: selectedRequest.id,
                status: "ISSUED",
                eInvoiceNumber: eInvoiceInput.trim(),
            })
            if (res.success) {
                toast.success(`Đã cập nhật xuất HĐ số ${eInvoiceInput.trim()}!`)
                setIssueModalOpen(false)
                setSelectedRequest(null)
                setEInvoiceInput("")
                fetchRequests()
            } else {
                toast.error(res.error || "Không thể cập nhật trạng thái")
            }
        } catch {
            toast.error("Lỗi kết nối khi cập nhật hoá đơn")
        } finally {
            setActionLoading(false)
        }
    }

    // Handle Reject Request
    const handleConfirmReject = async () => {
        if (!selectedRequest) return
        if (!rejectReasonInput.trim()) {
            toast.error("Vui lòng nhập lý do từ chối (để khách biết đường chỉnh sửa)")
            return
        }

        setActionLoading(true)
        try {
            const res = await updateInvoiceRequestStatus({
                requestId: selectedRequest.id,
                status: "REJECTED",
                rejectedReason: rejectReasonInput.trim(),
            })
            if (res.success) {
                toast.success("Đã từ chối yêu cầu xuất hoá đơn")
                setRejectModalOpen(false)
                setSelectedRequest(null)
                setRejectReasonInput("")
                fetchRequests()
            } else {
                toast.error(res.error || "Không thể từ chối yêu cầu")
            }
        } catch {
            toast.error("Lỗi kết nối khi từ chối")
        } finally {
            setActionLoading(false)
        }
    }

    // Export CSV
    const handleExportCsv = () => {
        if (filteredRequests.length === 0) {
            toast.warning("Không có dữ liệu hoá đơn để xuất")
            return
        }

        const headers = [
            "Mã Đơn",
            "Bàn",
            "Ngày Order",
            "Mã Số Thuế",
            "Tên Công Ty",
            "Địa Chỉ",
            "Email Nhận HĐ",
            "Người Nhận",
            "SĐT",
            "Tiền Hàng (Chưa VAT)",
            "Tiền VAT",
            "Tổng Tiền",
            "Trạng Thái",
            "Số HĐ Điện Tử",
            "Kênh Yêu Cầu"
        ]

        const rows = filteredRequests.map((r) => [
            `"${r.orderNumber}"`,
            `"${r.tableNumber || "Mang đi"}"`,
            `"${formatDate(r.orderDate)}"`,
            `"${r.customerTaxCode}"`,
            `"${r.companyName.replace(/"/g, '""')}"`,
            `"${r.companyAddress.replace(/"/g, '""')}"`,
            `"${r.recipientEmail}"`,
            `"${r.recipientName || ""}"`,
            `"${r.recipientPhone || ""}"`,
            r.orderSubtotal,
            r.vatAmount,
            r.orderTotal,
            r.status,
            `"${r.eInvoiceNumber || ""}"`,
            r.source === "QR_CUSTOMER" ? "Khách quét QR" : "Thu ngân POS"
        ])

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `danh-sach-xuat-vat-noonnoir-${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success(`Đã xuất ${filteredRequests.length} hoá đơn sang file CSV!`)
    }

    return (
        <div className="min-h-screen bg-cream-50 p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-green-900 text-cream-50 flex items-center justify-center shadow-xs">
                            <FileText className="h-5 w-5" />
                        </div>
                        <h1 className="font-display text-xl sm:text-2xl font-bold text-green-950">
                            Quản lý Hoá đơn VAT Điện tử
                        </h1>
                    </div>
                    <p className="text-xs sm:text-sm text-cream-600 mt-1">
                        Theo dõi yêu cầu từ mã QR khách quét trên bill và đơn thu ngân ghi nhận tại quầy
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchRequests}
                        disabled={loading}
                        className="border-cream-300 bg-white text-cream-700 hover:bg-cream-100 text-xs h-9"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                        Làm mới
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleExportCsv}
                        className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-9 shadow-xs"
                    >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Xuất file Kế toán (CSV)
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-cream-600">Tổng yêu cầu HĐ</span>
                        <FileText className="h-4 w-4 text-green-900" />
                    </div>
                    <p className="font-mono text-2xl font-bold text-green-950 mt-2">
                        {stats.total}
                    </p>
                    <p className="text-[11px] text-cream-500 mt-0.5">
                        Tổng thuế: ₫{formatPrice(stats.totalVat)}
                    </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900">Chờ kế toán xuất</span>
                        <Clock className="h-4 w-4 text-amber-700" />
                    </div>
                    <p className="font-mono text-2xl font-bold text-amber-900 mt-2">
                        {stats.pending}
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                        Cần phát hành trong 24h
                    </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-900">Đã phát hành</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    </div>
                    <p className="font-mono text-2xl font-bold text-emerald-900 mt-2">
                        {stats.issued}
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                        Đã có số hoá đơn điện tử
                    </p>
                </div>

                <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-cream-600">Từ chối / Sai MST</span>
                        <XCircle className="h-4 w-4 text-rose-600" />
                    </div>
                    <p className="font-mono text-2xl font-bold text-cream-800 mt-2">
                        {stats.rejected}
                    </p>
                    <p className="text-[11px] text-cream-500 mt-0.5">
                        Yêu cầu khách gửi lại
                    </p>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="rounded-2xl border border-cream-200 bg-white p-3 sm:p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scroll-hide-bar pb-1 sm:pb-0">
                        {(["ALL", "PENDING", "ISSUED", "REJECTED"] as const).map((st) => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => setStatusFilter(st)}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all touch-target",
                                    statusFilter === st
                                        ? "bg-green-900 text-cream-50 shadow-2xs"
                                        : "bg-cream-100 text-cream-600 hover:bg-cream-200/70"
                                )}
                            >
                                {st === "ALL" && `Tất cả (${stats.total})`}
                                {st === "PENDING" && `Chờ xuất (${stats.pending})`}
                                {st === "ISSUED" && `Đã xuất (${stats.issued})`}
                                {st === "REJECTED" && `Từ chối (${stats.rejected})`}
                            </button>
                        ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream-400" />
                        <Input
                            placeholder="Tìm theo Mã đơn, MST, Tên Cty, Email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 text-xs bg-cream-50/70 border-cream-300 h-9"
                        />
                    </div>
                </div>
            </div>

            {/* Invoices List Table */}
            <div className="rounded-2xl border border-cream-200 bg-white shadow-xs overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-cream-500">
                        <Loader2 className="h-8 w-8 animate-spin text-green-900 mb-2" />
                        <p className="text-xs">Đang tải danh sách hoá đơn VAT...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <div className="h-12 w-12 rounded-2xl bg-cream-100 flex items-center justify-center text-cream-500 mb-3">
                            <FileText className="h-6 w-6" />
                        </div>
                        <p className="font-serif text-sm font-semibold text-green-950">
                            Không có yêu cầu hoá đơn nào
                        </p>
                        <p className="text-xs text-cream-500 max-w-sm mt-1">
                            Khi khách hàng quét mã QR trên bill thanh toán hoặc thu ngân tạo yêu cầu tại quầy POS, dữ liệu sẽ hiển thị tại đây.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-cream-200 bg-cream-100/60 text-cream-600 font-semibold uppercase tracking-wider text-[10px]">
                                    <th className="py-3 px-4">Đơn hàng / Ngày</th>
                                    <th className="py-3 px-4">Đơn vị mua hàng (MST & Tên)</th>
                                    <th className="py-3 px-4">Email nhận HĐ</th>
                                    <th className="py-3 px-4 text-right">Tổng tiền / VAT</th>
                                    <th className="py-3 px-4 text-center">Nguồn</th>
                                    <th className="py-3 px-4 text-center">Trạng thái</th>
                                    <th className="py-3 px-4 text-center">Ký hiệu & Số HĐ</th>
                                    <th className="py-3 px-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-100">
                                {filteredRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-cream-50/70 transition-colors">
                                        {/* Order & Date */}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-green-950">
                                                    {req.orderNumber}
                                                </span>
                                                <a
                                                    href={`/invoice-request/${req.orderNumber}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Mở cổng khách hàng"
                                                    className="text-cream-400 hover:text-green-800"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                            <p className="text-[10px] text-cream-500 mt-0.5">
                                                {formatDate(req.createdAt)}
                                            </p>
                                            <span className="text-[10px] text-cream-600 font-medium">
                                                {req.tableNumber ? `Bàn ${req.tableNumber}` : "Mang đi"}
                                            </span>
                                        </td>

                                        {/* Company & MST */}
                                        <td className="py-3 px-4 max-w-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-wine-900 bg-wine-50 px-1.5 py-0.5 rounded text-[11px] border border-wine-200">
                                                    {req.customerTaxCode}
                                                </span>
                                            </div>
                                            <p className="font-semibold text-green-950 mt-1 line-clamp-1">
                                                {req.companyName}
                                            </p>
                                            <p className="text-[10px] text-cream-500 line-clamp-1">
                                                {req.companyAddress}
                                            </p>
                                        </td>

                                        {/* Recipient Email & Contact */}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1 text-green-950 font-medium">
                                                <Mail className="h-3 w-3 text-cream-400 shrink-0" />
                                                <span className="truncate max-w-[180px]">{req.recipientEmail}</span>
                                            </div>
                                            {req.recipientPhone && (
                                                <p className="text-[10px] text-cream-500 flex items-center gap-1 mt-0.5">
                                                    <Phone className="h-2.5 w-2.5" />
                                                    {req.recipientPhone} {req.recipientName ? `(${req.recipientName})` : ""}
                                                </p>
                                            )}
                                        </td>

                                        {/* Financials */}
                                        <td className="py-3 px-4 text-right">
                                            <p className="font-mono font-bold text-green-950">
                                                ₫{formatPrice(req.orderTotal)}
                                            </p>
                                            <p className="font-mono text-[10px] text-cream-500">
                                                VAT: ₫{formatPrice(req.vatAmount)}
                                            </p>
                                        </td>

                                        {/* Source */}
                                        <td className="py-3 px-4 text-center">
                                            {req.source === "QR_CUSTOMER" ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-800 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                                    <QrCode className="h-3 w-3" /> QR Bill
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cream-700 bg-cream-100 px-2 py-0.5 rounded-full border border-cream-200">
                                                    <Receipt className="h-3 w-3" /> Thu ngân
                                                </span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="py-3 px-4 text-center">
                                            {req.status === "PENDING" && (
                                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-semibold">
                                                    Chờ xuất
                                                </Badge>
                                            )}
                                            {req.status === "ISSUED" && (
                                                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-semibold">
                                                    Đã xuất HĐ
                                                </Badge>
                                            )}
                                            {req.status === "REJECTED" && (
                                                <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[10px] font-semibold">
                                                    Từ chối
                                                </Badge>
                                            )}
                                        </td>

                                        {/* eInvoice Number */}
                                        <td className="py-3 px-4 text-center">
                                            {req.eInvoiceNumber ? (
                                                <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                    {req.eInvoiceNumber}
                                                </span>
                                            ) : (
                                                <span className="text-cream-400 text-[11px]">—</span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {req.status === "PENDING" && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedRequest(req)
                                                                setEInvoiceInput("")
                                                                setIssueModalOpen(true)
                                                            }}
                                                            className="h-7 px-2.5 bg-green-900 text-cream-50 hover:bg-green-800 text-[11px] font-medium"
                                                        >
                                                            Xác nhận xuất
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setSelectedRequest(req)
                                                                setRejectReasonInput("")
                                                                setRejectModalOpen(true)
                                                            }}
                                                            className="h-7 px-2 border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px]"
                                                        >
                                                            Từ chối
                                                        </Button>
                                                    </>
                                                )}
                                                {req.status === "ISSUED" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedRequest(req)
                                                            setEInvoiceInput(req.eInvoiceNumber || "")
                                                            setIssueModalOpen(true)
                                                        }}
                                                        className="h-7 px-2 text-cream-600 hover:bg-cream-100 text-[11px]"
                                                    >
                                                        Đổi số HĐ
                                                    </Button>
                                                )}
                                                {req.status === "REJECTED" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedRequest(req)
                                                            setEInvoiceInput("")
                                                            setIssueModalOpen(true)
                                                        }}
                                                        className="h-7 px-2 text-cream-600 hover:bg-cream-100 text-[11px]"
                                                    >
                                                        Duyệt lại
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL: Issue E-Invoice */}
            {issueModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl border border-cream-300 bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-cream-200 pb-3">
                            <h3 className="font-display text-base font-bold text-green-950 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                Xác nhận xuất Hoá đơn VAT
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIssueModalOpen(false)}
                                className="text-cream-400 hover:text-cream-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="rounded-xl bg-cream-100/60 p-3 space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-cream-600">Đơn hàng:</span>
                                <span className="font-mono font-bold text-green-950">{selectedRequest.orderNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-cream-600">Công ty:</span>
                                <span className="font-semibold text-green-950 text-right truncate max-w-[240px]">
                                    {selectedRequest.companyName}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-cream-600">MST:</span>
                                <span className="font-mono font-semibold text-wine-900">{selectedRequest.customerTaxCode}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-cream-600">Tổng tiền / VAT:</span>
                                <span className="font-mono font-bold text-green-950">
                                    ₫{formatPrice(selectedRequest.orderTotal)} (VAT ₫{formatPrice(selectedRequest.vatAmount)})
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-cream-600">Email nhận:</span>
                                <span className="font-medium text-green-950">{selectedRequest.recipientEmail}</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-green-950">
                                Ký hiệu & Số hoá đơn điện tử đã phát hành <span className="text-rose-600">*</span>
                            </label>
                            <Input
                                placeholder="VD: 1C26TNN-0001234"
                                value={eInvoiceInput}
                                onChange={(e) => setEInvoiceInput(e.target.value)}
                                className="font-mono text-sm bg-cream-50 border-cream-300"
                            />
                            <p className="text-[11px] text-cream-500">
                                Nhập mã số này từ phần mềm hoá đơn điện tử (MISA meInvoice, VNPT, Viettel, v.v.). Số hoá đơn sẽ được cập nhật lên cổng tra cứu của khách.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setIssueModalOpen(false)}
                                className="border-cream-300 text-cream-600 text-xs h-9"
                            >
                                Huỷ
                            </Button>
                            <Button
                                onClick={handleConfirmIssue}
                                disabled={actionLoading || !eInvoiceInput.trim()}
                                className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-9 font-semibold"
                            >
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                                Xác nhận hoàn tất
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Reject Request */}
            {rejectModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl border border-cream-300 bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-cream-200 pb-3">
                            <h3 className="font-display text-base font-bold text-rose-950 flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-rose-600" />
                                Từ chối yêu cầu xuất hoá đơn
                            </h3>
                            <button
                                type="button"
                                onClick={() => setRejectModalOpen(false)}
                                className="text-cream-400 hover:text-cream-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <p className="text-xs text-cream-600">
                            Yêu cầu xuất HĐ cho đơn <strong>{selectedRequest.orderNumber}</strong> ({selectedRequest.companyName}) sẽ chuyển sang trạng thái <strong>Từ chối</strong>. Khách hàng khi tra cứu sẽ thấy lý do này để bổ sung thông tin chính xác.
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-green-950">
                                Lý do từ chối <span className="text-rose-600">*</span>
                            </label>
                            <Input
                                placeholder="VD: Mã số thuế không khớp tên công ty; Sai email..."
                                value={rejectReasonInput}
                                onChange={(e) => setRejectReasonInput(e.target.value)}
                                className="text-xs bg-cream-50 border-cream-300"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setRejectModalOpen(false)}
                                className="border-cream-300 text-cream-600 text-xs h-9"
                            >
                                Huỷ
                            </Button>
                            <Button
                                onClick={handleConfirmReject}
                                disabled={actionLoading || !rejectReasonInput.trim()}
                                className="bg-rose-700 text-white hover:bg-rose-800 text-xs h-9 font-semibold"
                            >
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                                Xác nhận từ chối
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
