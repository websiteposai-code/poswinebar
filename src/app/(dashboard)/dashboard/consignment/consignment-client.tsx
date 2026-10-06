"use client"

import { useState, useCallback } from "react"
import { CheckCircle2, DollarSign, ChevronDown, ChevronUp, RefreshCcw, X, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    getConsignments,
    getSettlements,
    createSettlement,
    confirmSettlement,
    returnConsignmentItem,
    markConsignmentItemDamaged,
    createConsignment,
    type Consignment,
    type ConsignmentSettlement,
} from "@/actions/consignment"

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n) }
function fmtK(n: number) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return String(n)
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    ACTIVE: { label: "Đang bán", color: "bg-green-100 border-green-300 text-green-700", icon: "" },
    SETTLED: { label: "Đã quyết toán", color: "bg-blue-100 border-blue-300 text-blue-700", icon: "" },
    RETURNED: { label: "Đã trả", color: "bg-cream-200 border-cream-300 text-cream-500", icon: "↩️" },
}

const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
    IN_STOCK: { label: "Đang bán", cls: "bg-green-100 text-green-700" },
    SOLD: { label: "Đã bán", cls: "bg-blue-100 text-blue-700" },
    RETURNED: { label: "Trả lại", cls: "bg-cream-200 text-cream-500" },
    DAMAGED: { label: "Hỏng", cls: "bg-red-100 text-red-600" },
}

export interface ConsignmentInitialData {
    consignments: Consignment[]
    settlements: ConsignmentSettlement[]
}

export function ConsignmentClient({ initial }: { initial: ConsignmentInitialData }) {
    const [consignments, setConsignments] = useState<Consignment[]>(initial.consignments)
    const [settlements, setSettlements] = useState<ConsignmentSettlement[]>(initial.settlements)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"list" | "settlements">("list")
    const [showCreate, setShowCreate] = useState(false)

    const loadData = useCallback(async () => {
        try {
            const [cList, sList] = await Promise.all([
                getConsignments(),
                getSettlements(),
            ])
            setConsignments(cList)
            setSettlements(sList)
        } catch (err) {
            console.error("[Consignment] loadData failed:", err)
            toast.error("Không thể tải dữ liệu ký gửi")
        }
    }, [])

    const handleReturn = async (consignmentId: string, itemId: string) => {
        const result = await returnConsignmentItem(consignmentId, itemId)
        if (result.success) {
            toast.success("↩️ Đã trả lại sản phẩm")
            loadData()
        }
    }

    const handleDamaged = async (consignmentId: string, itemId: string) => {
        const result = await markConsignmentItemDamaged(consignmentId, itemId)
        if (result.success) {
            toast.success("Đã đánh dấu hỏng")
            loadData()
        }
    }

    const handleSettle = async (consignmentId: string) => {
        const result = await createSettlement({
            consignmentId,
            periodStart: new Date(Date.now() - 30 * 86400000),
            periodEnd: new Date(),
        })
        if (result.success) {
            toast.success("Đã tạo quyết toán!")
            loadData()
        }
    }

    const handleConfirmSettlement = async (settlementId: string) => {
        const result = await confirmSettlement(settlementId)
        if (result.success) {
            toast.success("Đã xác nhận quyết toán!")
            loadData()
        }
    }

    const totalActive = consignments.filter((c) => c.status === "ACTIVE").length
    const totalItems = consignments.reduce((s, c) => s + c.totalItems, 0)
    const totalSold = consignments.reduce((s, c) => s + c.soldItems, 0)
    const totalRevenue = consignments.reduce((s, c) => s + c.totalRevenue, 0)



    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Ký gửi (Consignment)</h1>
                        <p className="text-sm text-cream-500">Quản lý hàng ký gửi NCC, quyết toán hoa hồng</p>
                    </div>
                </div>
                <Button onClick={loadData} variant="outline" size="sm" className="border-cream-300 text-cream-500">
                    <RefreshCcw className="mr-1 h-3 w-3" /> Refresh
                </Button>
                <Button onClick={() => setShowCreate(true)} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                    <Plus className="mr-1 h-3 w-3" /> Tạo đơn ký gửi
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Đang ký gửi</span></div>
                    <p className="font-mono text-xl font-bold text-green-900">{totalActive}</p>
                </div>
                <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Tổng SP</span></div>
                    <p className="font-mono text-xl font-bold text-blue-600">{totalItems}</p>
                </div>
                <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Đã bán</span></div>
                    <p className="font-mono text-xl font-bold text-green-600">{totalSold}</p>
                </div>
                <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Doanh thu</span></div>
                    <p className="font-mono text-xl font-bold text-wine-700">₫{fmtK(totalRevenue)}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1">
                <button
                    onClick={() => setActiveTab("list")}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-all", activeTab === "list" ? "bg-green-900 text-cream-50" : "bg-cream-200 text-cream-500")}
                >
                    Đơn ký gửi ({consignments.length})
                </button>
                <button
                    onClick={() => setActiveTab("settlements")}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-all", activeTab === "settlements" ? "bg-green-900 text-cream-50" : "bg-cream-200 text-cream-500")}
                >
                    Quyết toán ({settlements.length})
                </button>
            </div>

            {/* Consignment List */}
            {activeTab === "list" && (
                <div className="space-y-2">
                    {consignments.map((csm) => {
                        const isExpanded = expandedId === csm.id
                        const sCfg = STATUS_CONFIG[csm.status] ?? STATUS_CONFIG.ACTIVE
                        const soldPct = csm.totalItems > 0 ? Math.round((csm.soldItems / csm.totalItems) * 100) : 0

                        return (
                            <div key={csm.id} className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-x-auto hover:shadow-md transition-all">
                                <div
                                    className={cn("flex items-center cursor-pointer px-5 py-4 gap-4", isExpanded && "bg-cream-50")}
                                    onClick={() => setExpandedId(isExpanded ? null : csm.id)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-sm font-bold text-green-900">{csm.consignmentNo}</span>
                                            <Badge className={cn("text-[8px] font-bold border", sCfg.color)}>{sCfg.label}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-cream-500">
                                            <span>{csm.supplierName}</span>
                                            <span>{new Date(csm.receivedAt).toLocaleDateString("vi-VN")}</span>
                                            <span>Hoa hồng: {csm.commissionRate}%</span>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-28">
                                        <div className="flex justify-between text-[9px] text-cream-400 mb-0.5">
                                            <span>{csm.soldItems}/{csm.totalItems} bán</span>
                                            <span>{soldPct}%</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden">
                                            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${soldPct}%` }} />
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className="font-mono text-sm font-bold text-wine-700">₫{fmt(csm.totalRevenue)}</p>
                                        <p className="text-[9px] text-cream-400">doanh thu</p>
                                    </div>

                                    <div className="w-6 text-center">
                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-cream-400" /> : <ChevronDown className="h-4 w-4 text-cream-400" />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-cream-200 bg-cream-50 px-5 py-4">
                                        {/* Items Table */}
                                        <div className="rounded-lg border border-cream-200 bg-white overflow-hidden mb-3">
                                            <table className="w-full text-xs">
                                                <thead className="bg-cream-100">
                                                    <tr className="text-[10px] font-bold uppercase text-cream-400">
                                                        <th className="px-3 py-2 text-left">Sản phẩm</th>
                                                        <th className="px-3 py-2 text-left">Batch</th>
                                                        <th className="px-3 py-2 text-right">Giá vốn</th>
                                                        <th className="px-3 py-2 text-right">Giá bán</th>
                                                        <th className="px-3 py-2 text-center">Trạng thái</th>
                                                        <th className="px-3 py-2 text-center">Thao tác</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-cream-100">
                                                    {csm.items.map((item) => {
                                                        const iCfg = ITEM_STATUS[item.status] ?? ITEM_STATUS.IN_STOCK
                                                        return (
                                                            <tr key={item.id} className="hover:bg-cream-50">
                                                                <td className="px-3 py-2 font-medium text-green-900">{item.productName}</td>
                                                                <td className="px-3 py-2 font-mono text-cream-500">{item.batchCode}</td>
                                                                <td className="px-3 py-2 text-right font-mono text-cream-500">₫{fmt(item.costPrice)}</td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold text-green-900">₫{fmt(item.sellPrice)}</td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", iCfg.cls)}>{iCfg.label}</span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    {item.status === "IN_STOCK" && (
                                                                        <div className="flex justify-center gap-1">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleReturn(csm.id, item.id) }}
                                                                                className="rounded px-1.5 py-0.5 text-[9px] bg-cream-200 text-cream-500 hover:bg-cream-300"
                                                                            >↩️ Trả</button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleDamaged(csm.id, item.id) }}
                                                                                className="rounded px-1.5 py-0.5 text-[9px] bg-red-50 text-red-500 hover:bg-red-100"
                                                                            >Hỏng</button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Settlement action */}
                                        {csm.status === "ACTIVE" && (
                                            <Button
                                                onClick={() => handleSettle(csm.id)}
                                                size="sm"
                                                className="bg-green-900 text-white hover:bg-green-800"
                                            >
                                                <DollarSign className="mr-1 h-3 w-3" /> Tạo quyết toán
                                            </Button>
                                        )}

                                        {csm.notes && (
                                            <p className="text-[10px] text-cream-500 italic mt-2">{csm.notes}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Settlements */}
            {activeTab === "settlements" && (
                <div className="space-y-2">
                    {settlements.map((stl) => (
                        <div key={stl.id} className="rounded-xl border border-cream-200 bg-white shadow-sm px-5 py-4 hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-bold text-green-900">{stl.consignmentNo}</span>
                                        <span className={cn(
                                            "rounded-full border px-2 py-0.5 text-[9px] font-bold",
                                            stl.status === "PAID" ? "bg-green-100 border-green-300 text-green-700" :
                                                stl.status === "CONFIRMED" ? "bg-blue-100 border-blue-300 text-blue-700" :
                                                    "bg-amber-100 border-amber-300 text-amber-700"
                                        )}>
                                            {stl.status === "PAID" ? "Đã thanh toán" : stl.status === "CONFIRMED" ? "Đã xác nhận" : "Chờ xác nhận"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-cream-500">
                                        <span>{stl.supplierName}</span>
                                        <span>{new Date(stl.periodStart).toLocaleDateString("vi-VN")} → {new Date(stl.periodEnd).toLocaleDateString("vi-VN")}</span>
                                        <span>{stl.totalSoldItems} chai</span>
                                    </div>
                                </div>
                                <div className="text-right space-y-0.5">
                                    <p className="text-[10px] text-cream-400">Doanh thu: <span className="font-mono font-bold text-green-900">₫{fmt(stl.totalRevenue)}</span></p>
                                    <p className="text-[10px] text-cream-400">Hoa hồng ({stl.commissionRate}%): <span className="font-mono font-bold text-wine-700">₫{fmt(stl.commissionAmount)}</span></p>
                                    <p className="text-xs font-bold text-green-900">Trả NCC: <span className="font-mono text-blue-700">₫{fmt(stl.amountDue)}</span></p>
                                </div>
                                {stl.status === "DRAFT" && (
                                    <Button
                                        onClick={() => handleConfirmSettlement(stl.id)}
                                        size="sm"
                                        variant="outline"
                                        className="border-green-300 text-green-700 hover:bg-green-50"
                                    >
                                        <CheckCircle2 className="mr-1 h-3 w-3" /> Xác nhận
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                    {settlements.length === 0 && (
                        <div className="py-12 text-center text-sm text-cream-400">Chưa có quyết toán nào</div>
                    )}
                </div>
            )}

            {showCreate && <CreateConsignmentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadData() }} />}
        </div>
    )
}

// ============================================================
// CREATE CONSIGNMENT MODAL
// ============================================================
type NewItem = { productName: string; batchCode: string; costPrice: string; sellPrice: string }
const emptyItem = (): NewItem => ({ productName: "", batchCode: "", costPrice: "", sellPrice: "" })

function CreateConsignmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [supplierName, setSupplierName] = useState("")
    const [commissionRate, setCommissionRate] = useState("30")
    const [items, setItems] = useState<NewItem[]>([emptyItem()])
    const [submitting, setSubmitting] = useState(false)

    const updateItem = (i: number, field: keyof NewItem, value: string) => {
        setItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
    }

    const handleSubmit = async () => {
        if (!supplierName.trim()) { toast.error("Nhập tên NCC"); return }
        const validItems = items.filter((i) => i.productName.trim() && i.batchCode.trim())
        if (validItems.length === 0) { toast.error("Thêm ít nhất 1 sản phẩm"); return }
        setSubmitting(true)
        const r = await createConsignment({
            supplierId: `sup-${Date.now()}`,
            supplierName: supplierName.trim(),
            commissionRate: Number(commissionRate),
            items: validItems.map((i) => ({
                productId: `prod-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                productName: i.productName,
                batchCode: i.batchCode,
                costPrice: Number(i.costPrice) || 0,
                sellPrice: Number(i.sellPrice) || 0,
            })),
            receivedBy: "Chien (Owner)",
        })
        setSubmitting(false)
        if (r.success) { toast.success("Đã tạo đơn ký gửi!"); onCreated() }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-cream-200 bg-white shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-cream-200 bg-white z-10">
                    <h2 className="text-lg font-bold text-green-900">Tạo đơn ký gửi mới</h2>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100"><X className="h-4 w-4 text-cream-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Nhà cung cấp *</label>
                            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="VD: Wine Importers Co." className="h-9 text-xs border-cream-300" autoFocus />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Hoa hồng (%)</label>
                            <Input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} min={0} max={100} className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold uppercase text-cream-400">Danh sách sản phẩm</label>
                            <button onClick={() => setItems((p) => [...p, emptyItem()])} className="text-[10px] text-green-700 font-bold hover:underline">+ Thêm SP</button>
                        </div>
                        <div className="space-y-2">
                            {items.map((item, i) => (
                                <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_28px] gap-1.5 items-end">
                                    <div>
                                        {i === 0 && <label className="text-[8px] text-cream-400 mb-0.5 block">Sản phẩm</label>}
                                        <Input value={item.productName} onChange={(e) => updateItem(i, "productName", e.target.value)} placeholder="Tên SP" className="h-8 text-[11px] border-cream-300" />
                                    </div>
                                    <div>
                                        {i === 0 && <label className="text-[8px] text-cream-400 mb-0.5 block">Batch</label>}
                                        <Input value={item.batchCode} onChange={(e) => updateItem(i, "batchCode", e.target.value)} placeholder="Batch" className="h-8 text-[11px] border-cream-300 font-mono" />
                                    </div>
                                    <div>
                                        {i === 0 && <label className="text-[8px] text-cream-400 mb-0.5 block">Giá vốn</label>}
                                        <Input type="number" value={item.costPrice} onChange={(e) => updateItem(i, "costPrice", e.target.value)} placeholder="0" className="h-8 text-[11px] border-cream-300" />
                                    </div>
                                    <div>
                                        {i === 0 && <label className="text-[8px] text-cream-400 mb-0.5 block">Giá bán</label>}
                                        <Input type="number" value={item.sellPrice} onChange={(e) => updateItem(i, "sellPrice", e.target.value)} placeholder="0" className="h-8 text-[11px] border-cream-300" />
                                    </div>
                                    <button onClick={() => setItems((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : p)} className="h-8 flex items-center justify-center rounded text-cream-400 hover:text-red-500">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button onClick={onClose} variant="outline" size="sm" className="flex-1 border-cream-300 text-cream-500">Hủy</Button>
                        <Button onClick={handleSubmit} disabled={submitting} size="sm" className="flex-1 bg-green-900 text-white hover:bg-green-800">
                            {submitting ? "Đang tạo..." : "Tạo đơn ký gửi"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
