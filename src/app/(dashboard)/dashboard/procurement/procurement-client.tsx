"use client"

import { useState } from "react"
import {
    Truck,
    Search,
    Plus,
    FileText,
    CheckCircle2,
    Clock,
    AlertTriangle,
    XCircle,
    ChevronDown,
    ChevronUp,
    Building2,
    RefreshCcw,
    Send,
    Download,
    X,
    Layers,
    Trash2,
    Wine,
    Handshake,
    RotateCcw,
    DollarSign,
    CircleCheck,
    Ban,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    getPurchaseOrders,
    getSuppliers,
    getGoodsReceipts,
    getFIFOBatches,
    getProcurementStats,
    getPurchaseReceipts,
    updatePOStatus,
    receivePurchaseOrder,
    createPurchaseOrder,
    createSupplier,
    createPurchaseReceipt,
    type PurchaseOrder,
    type Supplier,
    type GoodsReceipt,
    type FIFOBatch,
    type POStatus,
    type PurchaseReceipt,
} from "@/actions/procurement"
import { getRawMaterials, type RawMaterial } from "@/actions/assets"
import {
    getConsignments,
    getSettlements,
    getConsignmentStats,
    returnConsignmentItem,
    markConsignmentItemDamaged,
    confirmSettlement,
    markSettlementPaid,
    type Consignment,
    type ConsignmentSettlement,
} from "@/actions/consignment"
import { useAuthStore } from "@/stores/auth-store"

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n) }
function fmtK(n: number) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return String(n)
}

const PO_STATUS: Record<POStatus, { label: string; cls: string }> = {
    DRAFT: { label: "Nháp", cls: "bg-cream-200 text-cream-600" },
    ORDERED: { label: "Đã đặt", cls: "bg-blue-100 text-blue-600" },
    SENT: { label: "Đã gửi", cls: "bg-blue-100 text-blue-700" },
    PARTIAL: { label: "Nhận 1 phần", cls: "bg-amber-100 text-amber-700" },
    RECEIVED: { label: "Đã nhận", cls: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Đã hủy", cls: "bg-red-100 text-red-700" },
}

const TH = "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-cream-400 bg-cream-50 border-b border-cream-200 whitespace-nowrap"
const THR = cn(TH, "text-right")
const THC = cn(TH, "text-center")
const TD = "px-3 py-3 text-xs text-green-900 border-b border-cream-100 whitespace-nowrap"
const TDR = cn(TD, "text-right font-mono")
const TDC = cn(TD, "text-center")

function StatCard({ label, value, color, icon: Icon }: { label: string; value: string | number; color: string; icon: typeof Truck }) {
    return (
        <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-3.5 w-3.5 text-cream-400" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">{label}</span>
            </div>
            <p className={cn("font-mono text-xl font-bold leading-none", color)}>{value}</p>
        </div>
    )
}

type TabType = "purchase" | "orders" | "suppliers" | "receipts" | "fifo" | "consignment" | "settlement"

export interface ProcurementInitialData {
    orders: PurchaseOrder[]
    suppliers: Supplier[]
    receipts: GoodsReceipt[]
    fifoBatches: FIFOBatch[]
    stats: Awaited<ReturnType<typeof getProcurementStats>>
    consignments: Consignment[]
    settlements: ConsignmentSettlement[]
    csmStats: Awaited<ReturnType<typeof getConsignmentStats>>
    purchaseReceipts: PurchaseReceipt[]
    ingredients: RawMaterial[]
}

export function ProcurementClient({ initial }: { initial: ProcurementInitialData }) {
    const { staff } = useAuthStore()
    const [tab, setTab] = useState<TabType>("purchase")
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<POStatus | "ALL">("ALL")
    const [expandedPO, setExpandedPO] = useState<string | null>(null)
    const [showCreatePO, setShowCreatePO] = useState(false)
    const [showCreateSupplier, setShowCreateSupplier] = useState(false)
    const [expandedCSM, setExpandedCSM] = useState<string | null>(null)

    const [orders, setOrders] = useState(initial.orders)
    const [suppliers, setSuppliers] = useState(initial.suppliers)
    const [receipts, setReceipts] = useState(initial.receipts)
    const [fifoBatches, setFifoBatches] = useState(initial.fifoBatches)
    const [stats, setStats] = useState(initial.stats)
    const [consignments, setConsignments] = useState(initial.consignments)
    const [settlements, setSettlements] = useState(initial.settlements)
    const [csmStats, setCsmStats] = useState(initial.csmStats)
    const [purchaseReceipts, setPurchaseReceipts] = useState(initial.purchaseReceipts)
    const [ingredientsList, setIngredientsList] = useState(initial.ingredients)

    // Purchase receipt form state
    const [prSupplierId, setPrSupplierId] = useState("")
    const [prNotes, setPrNotes] = useState("")
    const [prItems, setPrItems] = useState<Array<{ ingredientId: string; quantity: string; unitCost: string }>>([{ ingredientId: "", quantity: "", unitCost: "" }])
    const [prSubmitting, setPrSubmitting] = useState(false)

    const loadData = async () => {
        const [o, s, r, f, st, c, se, cs, pr, ing] = await Promise.all([
            getPurchaseOrders(), getSuppliers(), getGoodsReceipts(), getFIFOBatches(),
            getProcurementStats(), getConsignments(), getSettlements(), getConsignmentStats(),
            getPurchaseReceipts(), getRawMaterials(),
        ])
        setOrders(o); setSuppliers(s); setReceipts(r); setFifoBatches(f)
        setStats(st); setConsignments(c); setSettlements(se); setCsmStats(cs)
        setPurchaseReceipts(pr); setIngredientsList(ing)
    }

    const handlePurchaseReceipt = async () => {
        if (!prSupplierId) { toast.error("Chọn nhà cung cấp"); return }
        const validItems = prItems.filter(i => i.ingredientId && Number(i.quantity) > 0 && Number(i.unitCost) > 0)
        if (validItems.length === 0) { toast.error("Thêm ít nhất 1 nguyên liệu"); return }
        setPrSubmitting(true)
        const result = await createPurchaseReceipt({
            supplierId: prSupplierId,
            items: validItems.map(i => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })),
            notes: prNotes || undefined,
        })
        setPrSubmitting(false)
        if (result.success) {
            toast.success(`Nhập hàng thành công! ${result.receiptNo}`)
            if (result.results) {
                for (const r of result.results) {
                    if (r.oldCost !== r.newCost) {
                        toast.info(`${r.ingredientName}: ₫${fmt(r.oldCost)} → ₫${fmt(r.newCost)}`, { duration: 5000 })
                    }
                }
            }
            setPrSupplierId(""); setPrNotes(""); setPrItems([{ ingredientId: "", quantity: "", unitCost: "" }])
            loadData()
        } else {
            toast.error(result.error ?? "Lỗi tạo phiếu nhập")
        }
    }

    const filteredOrders = orders.filter((po) => {
        const matchSearch = !searchTerm
            || po.poNumber.toLowerCase().includes(searchTerm.toLowerCase())
            || po.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
        const matchStatus = statusFilter === "ALL" || po.status === statusFilter
        return matchSearch && matchStatus
    })

    const handleStatusChange = async (poId: string, status: POStatus) => {
        const result = await updatePOStatus(poId, status)
        if (result.success) {
            toast.success(`Cập nhật → ${PO_STATUS[status].label}`)
            loadData()
        }
    }

    const handleReceive = async (po: PurchaseOrder) => {
        const unreceived = po.items.filter((i) => i.receivedQty < i.quantity)
        if (unreceived.length === 0) { toast.info("Đã nhận đủ hàng"); return }
        const receivedItems = unreceived.map((item) => ({ itemId: item.id, receivedQty: item.quantity - item.receivedQty }))
        const result = await receivePurchaseOrder(po.id, receivedItems, staff?.fullName ?? "Staff")
        if (result.success) {
            toast.success("Nhận hàng thành công! → Tạo FIFO batch")
            setExpandedPO(null)
            loadData()
        }
    }

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                        <Truck className="h-5 w-5 text-blue-700" />
                    </div>
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Mua hàng</h1>
                        <p className="text-sm text-cream-500">Đơn hàng nhập, nhà cung cấp, phiếu nhận & FIFO</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowCreatePO(true)} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Tạo PO
                    </Button>
                    <Button onClick={loadData} variant="outline" size="sm" className="border-cream-300 text-cream-500">
                        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <StatCard label="Tổng PO" value={stats.totalPOs} color="text-green-900" icon={FileText} />
                    <StatCard label="Đang chờ" value={stats.pendingPOs} color="text-blue-600" icon={Clock} />
                    <StatCard label="Nháp" value={stats.draftPOs} color="text-cream-500" icon={FileText} />
                    <StatCard label="Tổng chi" value={`₫${fmtK(stats.totalSpent)}`} color="text-wine-700" icon={Truck} />
                    <StatCard label="NCC Hoạt động" value={stats.totalSuppliers} color="text-green-600" icon={Building2} />
                </div>
            )}

            {/* Tabs + Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 rounded-lg bg-cream-200 p-0.5 overflow-x-auto scroll-hide-bar">
                    {([
                        { key: "purchase" as TabType, label: "📥 Nhập hàng", count: purchaseReceipts.length },
                        { key: "orders" as TabType, label: "📦 Đơn nhập", count: orders.length },
                        { key: "suppliers" as TabType, label: "🏢 NCC", count: suppliers.length },
                        { key: "receipts" as TabType, label: "📋 Phiếu nhận", count: receipts.length },
                        { key: "fifo" as TabType, label: "📊 FIFO", count: fifoBatches.length },
                        { key: "consignment" as TabType, label: "🤝 Ký gửi", count: consignments.length },
                        { key: "settlement" as TabType, label: "💰 Quyết toán", count: settlements.length },
                    ]).map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn("rounded-md px-4 py-2 text-xs font-semibold transition-all", tab === t.key ? "bg-green-900 text-cream-50 shadow-sm" : "text-cream-500 hover:text-cream-700")}
                        >
                            {t.label} <span className="ml-1 opacity-60">{t.count}</span>
                        </button>
                    ))}
                </div>
                {tab === "orders" && (
                    <>
                        <div className="relative max-w-[220px]">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm PO, NCC..." className="h-8 pl-8 text-xs border-cream-300 bg-white" />
                        </div>
                        <div className="flex gap-1">
                            {(["ALL", "DRAFT", "SENT", "PARTIAL", "RECEIVED"] as const).map((s) => (
                                <button key={s} onClick={() => setStatusFilter(s)} className={cn("rounded-md px-2.5 py-1 text-[10px] font-medium transition-all", statusFilter === s ? "bg-green-900 text-cream-50" : "bg-cream-200 text-cream-500")}>{s === "ALL" ? "Tất cả" : PO_STATUS[s].label}</button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════ PURCHASE RECEIPT TAB (NHẬP HÀNG) ═══════════ */}
            {tab === "purchase" && (
                <div className="space-y-5">
                    {/* Create Receipt Form */}
                    <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-green-900 mb-4 flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Tạo phiếu nhập hàng
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 mb-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Nhà cung cấp *</label>
                                <select
                                    value={prSupplierId}
                                    onChange={(e) => setPrSupplierId(e.target.value)}
                                    className="w-full rounded-lg border border-cream-300 px-3 py-2 text-xs text-green-900 bg-white focus:ring-2 focus:ring-green-200 focus:border-green-400"
                                >
                                    <option value="">Chọn NCC...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Ghi chú</label>
                                <Input value={prNotes} onChange={(e) => setPrNotes(e.target.value)} placeholder="Mặt hàng bổ sung, số HĐ..." className="h-9 text-xs border-cream-300" />
                            </div>
                        </div>

                        {/* Item Lines */}
                        <div className="space-y-2 mb-4">
                            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-cream-400">
                                <div className="col-span-5">Nguyên liệu</div>
                                <div className="col-span-2">Số lượng (base unit)</div>
                                <div className="col-span-2">Đơn giá / base unit (₫)</div>
                                <div className="col-span-2 text-right">Thành tiền</div>
                                <div className="col-span-1"></div>
                            </div>
                            {prItems.map((item, idx) => {
                                const ing = ingredientsList.find(i => i.id === item.ingredientId)
                                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0)
                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-5">
                                            <select
                                                value={item.ingredientId}
                                                onChange={(e) => {
                                                    const newItems = [...prItems]
                                                    newItems[idx].ingredientId = e.target.value
                                                    setPrItems(newItems)
                                                }}
                                                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-xs"
                                            >
                                                <option value="">Chọn nguyên liệu...</option>
                                                {ingredientsList.map(i => (
                                                    <option key={i.id} value={i.id}>{i.name} ({i.baseUnit}) — Tồn: {i.currentStock} · GV: ₫{fmt(i.costPrice)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <Input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const newItems = [...prItems]
                                                    newItems[idx].quantity = e.target.value
                                                    setPrItems(newItems)
                                                }}
                                                placeholder={ing ? ing.baseUnit : "SL"}
                                                className="h-9 text-xs border-cream-300 font-mono"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Input
                                                type="number"
                                                value={item.unitCost}
                                                onChange={(e) => {
                                                    const newItems = [...prItems]
                                                    newItems[idx].unitCost = e.target.value
                                                    setPrItems(newItems)
                                                }}
                                                placeholder="₫"
                                                className="h-9 text-xs border-cream-300 font-mono"
                                            />
                                        </div>
                                        <div className="col-span-2 text-right font-mono text-xs font-bold text-wine-700">
                                            {lineTotal > 0 ? `₫${fmt(Math.round(lineTotal))}` : "—"}
                                        </div>
                                        <div className="col-span-1 text-center">
                                            {prItems.length > 1 && (
                                                <button onClick={() => setPrItems(prItems.filter((_, i) => i !== idx))} className="text-cream-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex items-center justify-between">
                            <Button onClick={() => setPrItems([...prItems, { ingredientId: "", quantity: "", unitCost: "" }])} variant="outline" size="sm" className="h-8 text-xs border-cream-300 text-cream-500">
                                <Plus className="mr-1 h-3 w-3" /> Thêm dòng
                            </Button>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-cream-500">Tổng: <span className="font-mono font-bold text-green-900">₫{fmt(Math.round(prItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0)))}</span></span>
                                <Button onClick={handlePurchaseReceipt} disabled={prSubmitting} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                                    {prSubmitting ? "Đang xử lý..." : "📥 Nhập hàng"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Purchase History */}
                    <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                        <div className="px-4 py-3 border-b border-cream-200 bg-cream-50">
                            <h3 className="text-xs font-bold text-green-900 uppercase tracking-wider">Lịch sử nhập hàng</h3>
                        </div>
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className={TH}>Phiếu nhập</th>
                                    <th className={TH}>NCC</th>
                                    <th className={TH}>Nguyên liệu</th>
                                    <th className={THR} style={{ width: 120 }}>Tổng tiền</th>
                                    <th className={TH} style={{ width: 130 }}>Ngày nhập</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchaseReceipts.map((pr) => (
                                    <tr key={pr.receiptNo} className="hover:bg-green-50/50 transition-colors align-top">
                                        <td className={TD}>
                                            <span className="font-mono font-bold text-green-900">{pr.receiptNo}</span>
                                        </td>
                                        <td className={cn(TD, "font-medium")}>{pr.supplierName}</td>
                                        <td className={TD}>
                                            <div className="space-y-0.5">
                                                {pr.items.map((item, i) => (
                                                    <p key={i} className="text-[11px] text-cream-600 leading-tight">
                                                        <span className="text-green-600">✓</span> {item.ingredientName}{" "}
                                                        <span className="font-mono">×{item.quantity} {item.unit}</span>{" "}
                                                        <span className="text-cream-400">@₫{fmt(Math.round(item.unitCost))}/{item.unit}</span>
                                                        {item.balanceCost !== null && (
                                                            <span className="ml-1.5 text-[10px] text-blue-600 font-medium">→ BQGQ: ₫{fmt(Math.round(item.balanceCost))}</span>
                                                        )}
                                                    </p>
                                                ))}
                                            </div>
                                        </td>
                                        <td className={cn(TDR, "font-bold text-wine-700")}>₫{fmtK(pr.totalAmount)}</td>
                                        <td className={cn(TD, "text-[11px] text-cream-500")}>{new Date(pr.date).toLocaleString("vi-VN")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {purchaseReceipts.length === 0 && <div className="py-12 text-center text-sm text-cream-400">Chưa có phiếu nhập hàng nào</div>}
                    </div>
                </div>
            )}

            {/* ═══════════ ORDERS TAB ═══════════ */}
            {tab === "orders" && (
                <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className={TH} style={{ width: 120 }}>Số PO</th>
                                <th className={TH}>Nhà cung cấp</th>
                                <th className={THR} style={{ width: 120 }}>Tổng tiền</th>
                                <th className={THC} style={{ width: 90 }}>Trạng thái</th>
                                <th className={THC} style={{ width: 90 }}>Ngày DK</th>
                                <th className={THC} style={{ width: 60 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((po) => {
                                const cfg = PO_STATUS[po.status]
                                const isExpanded = expandedPO === po.id
                                return (
                                    <tr key={po.id} className="group">
                                        <td className={TD} colSpan={6} style={{ padding: 0 }}>
                                            {/* Main Row */}
                                            <div
                                                className={cn("flex items-center cursor-pointer transition-colors hover:bg-green-50/50", isExpanded && "bg-green-50")}
                                                onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                                            >
                                                <div className="px-3 py-3 w-[120px]">
                                                    <span className="font-mono text-xs font-bold text-green-900">{po.poNumber}</span>
                                                    <p className="text-[10px] text-cream-400 leading-tight">{new Date(po.createdAt).toLocaleDateString("vi-VN")}</p>
                                                </div>
                                                <div className="flex-1 min-w-0 px-3 py-3">
                                                    <p className="text-xs font-medium text-green-900 truncate">{po.supplierName}</p>
                                                    <p className="text-[10px] text-cream-400 leading-tight">{po.items.length} sản phẩm · {po.createdBy}</p>
                                                </div>
                                                <div className="w-[120px] px-3 py-3 text-right">
                                                    <span className="font-mono text-xs font-bold text-wine-700">₫{fmtK(po.totalAmount)}</span>
                                                </div>
                                                <div className="w-[90px] px-3 py-3 text-center">
                                                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[9px] font-bold leading-tight", cfg.cls)}>{cfg.label}</span>
                                                </div>
                                                <div className="w-[90px] px-3 py-3 text-center text-[11px] text-cream-500">{po.expectedDate ? (typeof po.expectedDate === 'string' ? po.expectedDate : new Date(po.expectedDate).toLocaleDateString('vi-VN')) : '—'}</div>
                                                <div className="w-[60px] px-3 py-3 text-center">
                                                    {isExpanded ? <ChevronUp className="inline h-3.5 w-3.5 text-cream-400" /> : <ChevronDown className="inline h-3.5 w-3.5 text-cream-400" />}
                                                </div>
                                            </div>

                                            {/* Expanded Detail */}
                                            {isExpanded && (
                                                <div className="border-t border-cream-200 bg-cream-50 px-5 py-4">
                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5">
                                                        {/* Items */}
                                                        <div className="col-span-2">
                                                            <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-2">Chi tiết sản phẩm</h4>
                                                            <table className="w-full">
                                                                <thead>
                                                                    <tr>
                                                                        <th className="text-left text-[9px] font-bold text-cream-400 pb-1.5">Sản phẩm</th>
                                                                        <th className="text-center text-[9px] font-bold text-cream-400 pb-1.5">Loại</th>
                                                                        <th className="text-right text-[9px] font-bold text-cream-400 pb-1.5">Đơn giá</th>
                                                                        <th className="text-center text-[9px] font-bold text-cream-400 pb-1.5">SL</th>
                                                                        <th className="text-center text-[9px] font-bold text-cream-400 pb-1.5">Đã nhận</th>
                                                                        <th className="text-right text-[9px] font-bold text-cream-400 pb-1.5">Thành tiền</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {po.items.map((item) => (
                                                                        <tr key={item.id} className="border-t border-cream-200">
                                                                            <td className="py-2 text-xs text-green-900">
                                                                                <span className="font-medium">{item.productName}</span>
                                                                                <span className="ml-1.5 text-[9px] text-cream-400">{item.sku}</span>
                                                                            </td>
                                                                            <td className="py-2 text-center">
                                                                                <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-bold",
                                                                                    item.category === "GOODS" ? "bg-blue-100 text-blue-700" : item.category === "NPL" ? "bg-amber-100 text-amber-700" : "bg-cream-200 text-stone-700 border border-cream-300"
                                                                                )}>{item.category === "GOODS" ? "Hàng" : item.category}</span>
                                                                            </td>
                                                                            <td className="py-2 text-right font-mono text-[11px] text-cream-600">₫{fmt(item.unitPrice)}</td>
                                                                            <td className="py-2 text-center text-[11px] text-cream-600">{item.quantity} {item.unit}</td>
                                                                            <td className="py-2 text-center">
                                                                                <span className={cn("font-mono text-[11px] font-bold", item.receivedQty >= item.quantity ? "text-green-600" : "text-amber-600")}>
                                                                                    {item.receivedQty}/{item.quantity}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 text-right font-mono text-[11px] font-bold text-wine-700">₫{fmt(item.totalPrice)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* Summary + Actions */}
                                                        <div>
                                                            <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-2">Tóm tắt</h4>
                                                            <div className="rounded-lg bg-white border border-cream-200 p-3 space-y-2">
                                                                <div className="flex justify-between text-xs text-cream-500">
                                                                    <span>Tạm tính</span>
                                                                    <span className="font-mono">₫{fmt(po.subtotal)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-xs text-cream-500">
                                                                    <span>VAT (10%)</span>
                                                                    <span className="font-mono">₫{fmt(po.tax)}</span>
                                                                </div>
                                                                <div className="border-t border-cream-200 pt-2 flex justify-between text-sm font-bold text-green-900">
                                                                    <span>Tổng cộng</span>
                                                                    <span className="font-mono text-wine-700">₫{fmt(po.totalAmount)}</span>
                                                                </div>
                                                            </div>
                                                            {po.notes && <p className="mt-2 text-[10px] text-cream-400 italic">📝 {po.notes}</p>}

                                                            <div className="flex flex-wrap gap-2 mt-3">
                                                                {po.status === "DRAFT" && (
                                                                    <>
                                                                        <Button onClick={() => handleStatusChange(po.id, "SENT")} size="sm" className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white">
                                                                            <Send className="mr-1 h-3 w-3" /> Gửi NCC
                                                                        </Button>
                                                                        <Button onClick={() => handleStatusChange(po.id, "CANCELLED")} size="sm" variant="outline" className="h-7 text-[10px] border-red-300 text-red-600 hover:bg-red-50">
                                                                            <XCircle className="mr-1 h-3 w-3" /> Hủy
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                {(po.status === "SENT" || po.status === "PARTIAL") && (
                                                                    <Button onClick={() => handleReceive(po)} size="sm" className="h-7 text-[10px] bg-green-700 hover:bg-green-800 text-white">
                                                                        <Download className="mr-1 h-3 w-3" /> Nhận hàng
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {filteredOrders.length === 0 && <div className="py-12 text-center text-sm text-cream-400">Không tìm thấy đơn hàng nhập</div>}
                </div>
            )}

            {/* ═══════════ SUPPLIERS TAB ═══════════ */}
            {tab === "suppliers" && (
                <div className="space-y-3">
                    <div className="flex justify-end">
                        <Button onClick={() => setShowCreateSupplier(true)} size="sm" className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs">
                            <Plus className="mr-1 h-3.5 w-3.5" /> Thêm NCC
                        </Button>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className={TH}>Nhà cung cấp</th>
                                    <th className={TH} style={{ width: 80 }}>Ngành</th>
                                    <th className={TH} style={{ width: 120 }}>Liên hệ</th>
                                    <th className={TH} style={{ width: 100 }}>SĐT</th>
                                    <th className={THC} style={{ width: 60 }}>PO</th>
                                    <th className={THR} style={{ width: 100 }}>Tổng chi</th>
                                    <th className={THC} style={{ width: 90 }}>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suppliers.map((sup) => (
                                    <tr key={sup.id} className="hover:bg-green-50/50 transition-colors">
                                        <td className={TD}>
                                            <p className="font-medium leading-tight">{sup.name}</p>
                                            <p className="text-[10px] text-cream-400 leading-tight">MST: {sup.taxCode}</p>
                                        </td>
                                        <td className={cn(TD, "text-cream-500")}>{sup.category}</td>
                                        <td className={cn(TD, "font-medium")}>{sup.contactPerson}</td>
                                        <td className={cn(TD, "font-mono text-[11px] text-cream-500")}>{sup.phone}</td>
                                        <td className={cn(TDC, "font-bold")}>{sup.totalOrders}</td>
                                        <td className={cn(TDR, "font-bold text-wine-700")}>₫{fmtK(sup.totalSpent)}</td>
                                        <td className={TDC}>
                                            <span className={cn("inline-block rounded-full px-2 py-0.5 text-[9px] font-bold leading-tight", sup.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-cream-200 text-cream-500")}>{sup.status === "ACTIVE" ? "Hoạt động" : "Ngưng"}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════════ RECEIPTS TAB ═══════════ */}
            {tab === "receipts" && (
                <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className={TH}>Phiếu nhận</th>
                                <th className={TH}>Sản phẩm nhận</th>
                                <th className={THR} style={{ width: 120 }}>Tổng tiền</th>
                                <th className={TH} style={{ width: 100 }}>Người nhận</th>
                                <th className={TH} style={{ width: 130 }}>Thời gian</th>
                            </tr>
                        </thead>
                        <tbody>
                            {receipts.map((gr) => (
                                <tr key={gr.id} className="hover:bg-green-50/50 transition-colors align-top">
                                    <td className={TD}>
                                        <span className="font-mono font-bold">{gr.poNumber}</span>
                                        <p className="text-[10px] text-cream-400 leading-tight">{gr.supplierName}</p>
                                    </td>
                                    <td className={TD}>
                                        <div className="space-y-0.5">
                                            {gr.receivedItems.map((item, i) => (
                                                <p key={i} className="text-[11px] text-cream-600 leading-tight">
                                                    <span className="text-green-600">✓</span> {(item as any).productName} <span className="font-mono">×{(item as any).receivedQty}</span> <span className="text-cream-400">@₫{fmt((item as any).unitPrice ?? 0)}</span>
                                                </p>
                                            ))}
                                        </div>
                                    </td>
                                    <td className={cn(TDR, "font-bold text-wine-700")}>₫{fmtK(gr.totalAmount)}</td>
                                    <td className={cn(TD, "text-cream-500")}>{gr.receivedBy}</td>
                                    <td className={cn(TD, "text-[11px] text-cream-500")}>{new Date(gr.receivedAt).toLocaleString("vi-VN")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══════════ FIFO BATCHES TAB ═══════════ */}
            {tab === "fifo" && (
                <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className={TH}>Sản phẩm</th>
                                <th className={TH} style={{ width: 90 }}>SKU</th>
                                <th className={TH} style={{ width: 110 }}>Lô nhập (PO)</th>
                                <th className={THC} style={{ width: 80 }}>Ngày nhập</th>
                                <th className={THC} style={{ width: 70 }}>Ban đầu</th>
                                <th className={THC} style={{ width: 70 }}>Còn lại</th>
                                <th className={TH} style={{ width: 100 }}>Tiêu thụ</th>
                                <th className={THR} style={{ width: 100 }}>Giá vốn/đvt</th>
                                <th className={THR} style={{ width: 100 }}>Giá trị còn</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fifoBatches.map((batch) => {
                                const usedPct = batch.initialQty > 0 ? ((batch.initialQty - batch.remainingQty) / batch.initialQty) * 100 : 0
                                const remainValue = batch.remainingQty * batch.unitCost
                                return (
                                    <tr key={batch.id} className="hover:bg-green-50/50 transition-colors">
                                        <td className={TD}>
                                            <p className="font-medium leading-tight">{batch.productName}</p>
                                            <p className="text-[10px] text-cream-400 leading-tight">{batch.supplierName}</p>
                                        </td>
                                        <td className={cn(TD, "font-mono text-[11px] text-cream-500")}>{batch.sku}</td>
                                        <td className={cn(TD, "font-mono text-[11px] text-blue-700 font-bold")}>{batch.poNumber}</td>
                                        <td className={cn(TDC, "text-[11px] text-cream-500")}>{batch.batchDate ? (typeof batch.batchDate === 'string' ? batch.batchDate : new Date(batch.batchDate).toLocaleDateString('vi-VN')) : '—'}</td>
                                        <td className={cn(TDC, "text-cream-500")}>{batch.initialQty}</td>
                                        <td className={TDC}>
                                            <span className={cn("font-bold", batch.remainingQty <= 2 ? "text-amber-600" : "text-green-900")}>{batch.remainingQty}</span>
                                        </td>
                                        <td className={TD}>
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex-1 h-1.5 rounded-full bg-cream-200 overflow-x-auto">
                                                    <div className="h-full rounded-full bg-wine-400 transition-all" style={{ width: `${usedPct}%` }} />
                                                </div>
                                                <span className="text-[9px] text-cream-500 min-w-[28px] text-right">{Math.round(usedPct)}%</span>
                                            </div>
                                        </td>
                                        <td className={cn(TDR, "text-cream-600")}>₫{fmt(batch.unitCost)}</td>
                                        <td className={cn(TDR, "font-bold text-green-700")}>₫{fmtK(remainValue)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {fifoBatches.length === 0 && <div className="py-12 text-center text-sm text-cream-400">Chưa có lô hàng FIFO</div>}
                </div>
            )}

            {/* ═══════════ CONSIGNMENT TAB ═══════════ */}
            {tab === "consignment" && (
                <div className="space-y-4">
                    {/* Consignment Stats */}
                    {csmStats && (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <StatCard label="Tổng lô" value={csmStats.totalConsignments} color="text-green-900" icon={Handshake} />
                            <StatCard label="Lô đang hoạt động" value={csmStats.activeConsignments} color="text-blue-600" icon={Wine} />
                            <StatCard label="Tổng chai" value={csmStats.totalItems} color="text-cream-600" icon={Layers} />
                            <StatCard label="Đã bán" value={csmStats.soldItems} color="text-green-600" icon={CheckCircle2} />
                            <StatCard label="Doanh thu" value={`₫${fmtK(csmStats.totalRevenue)}`} color="text-wine-700" icon={DollarSign} />
                        </div>
                    )}

                    {/* Consignment List */}
                    <div className="rounded-xl border border-cream-200 bg-white overflow-hidden shadow-sm">
                        {consignments.map((csm) => {
                            const isExpanded = expandedCSM === csm.id
                            const inStock = csm.items.filter((i) => i.status === "IN_STOCK").length
                            const sold = csm.items.filter((i) => i.status === "SOLD").length
                            const returned = csm.items.filter((i) => i.status === "RETURNED").length
                            const damaged = csm.items.filter((i) => i.status === "DAMAGED").length
                            const soldRevenue = csm.items.filter((i) => i.status === "SOLD").reduce((s, i) => s + i.sellPrice, 0)

                            return (
                                <div key={csm.id} className="border-b border-cream-100 last:border-b-0">
                                    {/* Header Row */}
                                    <div
                                        className={cn("flex items-center cursor-pointer transition-colors hover:bg-green-50/50 px-4 py-3", isExpanded && "bg-green-50")}
                                        onClick={() => setExpandedCSM(isExpanded ? null : csm.id)}
                                    >
                                        <div className="w-[140px]">
                                            <span className="font-mono text-xs font-bold text-green-900">{csm.consignmentNo}</span>
                                            <p className="text-[10px] text-cream-400">{new Date(csm.receivedAt).toLocaleDateString("vi-VN")}</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-green-900">{csm.supplierName}</p>
                                            <p className="text-[10px] text-cream-400">HH: {csm.commissionRate}% · {csm.totalItems} chai · Nhận bởi {csm.receivedBy}</p>
                                        </div>
                                        <div className="flex items-center gap-2 mr-4">
                                            {inStock > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">{inStock} trong kho</span>}
                                            {sold > 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">{sold} đã bán</span>}
                                            {returned > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">{returned} trả lại</span>}
                                            {damaged > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">{damaged} hỏng</span>}
                                        </div>
                                        <div className="w-[100px] text-right">
                                            <span className={cn(
                                                "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold leading-tight",
                                                csm.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                                                    csm.status === "SETTLED" ? "bg-blue-100 text-blue-700" :
                                                        "bg-cream-200 text-cream-600"
                                            )}>
                                                {csm.status === "ACTIVE" ? "Hoạt động" : csm.status === "SETTLED" ? "Đã QT" : "Trả lại"}
                                            </span>
                                        </div>
                                        <div className="w-[40px] text-center">
                                            {isExpanded ? <ChevronUp className="inline h-3.5 w-3.5 text-cream-400" /> : <ChevronDown className="inline h-3.5 w-3.5 text-cream-400" />}
                                        </div>
                                    </div>

                                    {/* Expanded: Item List */}
                                    {isExpanded && (
                                        <div className="border-t border-cream-200 bg-cream-50 px-5 py-4">
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5">
                                                <div className="col-span-2">
                                                    <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-2">Chi tiết chai ký gửi</h4>
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr>
                                                                <th className="text-left text-[9px] font-bold text-cream-400 pb-1.5">Sản phẩm</th>
                                                                <th className="text-left text-[9px] font-bold text-cream-400 pb-1.5" style={{ width: 100 }}>Batch</th>
                                                                <th className="text-right text-[9px] font-bold text-cream-400 pb-1.5" style={{ width: 90 }}>Giá vốn</th>
                                                                <th className="text-right text-[9px] font-bold text-cream-400 pb-1.5" style={{ width: 90 }}>Giá bán</th>
                                                                <th className="text-center text-[9px] font-bold text-cream-400 pb-1.5" style={{ width: 80 }}>Trạng thái</th>
                                                                <th className="text-center text-[9px] font-bold text-cream-400 pb-1.5" style={{ width: 80 }}>Thao tác</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {csm.items.map((item) => (
                                                                <tr key={item.id} className="border-t border-cream-200">
                                                                    <td className="py-2 text-xs text-green-900 font-medium">{item.productName}</td>
                                                                    <td className="py-2 font-mono text-[11px] text-cream-500">{item.batchCode}</td>
                                                                    <td className="py-2 text-right font-mono text-[11px] text-cream-600">₫{fmt(item.costPrice)}</td>
                                                                    <td className="py-2 text-right font-mono text-[11px] font-bold text-green-700">₫{fmt(item.sellPrice)}</td>
                                                                    <td className="py-2 text-center">
                                                                        <span className={cn(
                                                                            "inline-block rounded-full px-2 py-0.5 text-[8px] font-bold",
                                                                            item.status === "IN_STOCK" ? "bg-blue-100 text-blue-700" :
                                                                                item.status === "SOLD" ? "bg-green-100 text-green-700" :
                                                                                    item.status === "RETURNED" ? "bg-amber-100 text-amber-700" :
                                                                                        "bg-red-100 text-red-700"
                                                                        )}>
                                                                            {item.status === "IN_STOCK" ? "Trong kho" :
                                                                                item.status === "SOLD" ? "Đã bán" :
                                                                                    item.status === "RETURNED" ? "Trả lại" : "Hỏng"}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 text-center">
                                                                        {item.status === "IN_STOCK" && (
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        await returnConsignmentItem(csm.id, item.id)
                                                                                        toast.success("Đã đánh dấu trả lại NCC")
                                                                                        loadData()
                                                                                    }}
                                                                                    className="p-1 rounded hover:bg-amber-50 text-cream-400 hover:text-amber-600 transition-all"
                                                                                    title="Trả lại NCC"
                                                                                >
                                                                                    <RotateCcw className="h-3 w-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        await markConsignmentItemDamaged(csm.id, item.id)
                                                                                        toast.error("Đã đánh dấu hỏng")
                                                                                        loadData()
                                                                                    }}
                                                                                    className="p-1 rounded hover:bg-red-50 text-cream-400 hover:text-red-600 transition-all"
                                                                                    title="Đánh dấu hỏng"
                                                                                >
                                                                                    <Ban className="h-3 w-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        {item.status === "SOLD" && item.soldAt && (
                                                                            <span className="text-[10px] text-cream-400">{new Date(item.soldAt).toLocaleDateString("vi-VN")}</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Summary */}
                                                <div>
                                                    <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-2">Tóm tắt</h4>
                                                    <div className="rounded-lg bg-white border border-cream-200 p-3 space-y-2">
                                                        <div className="flex justify-between text-xs text-cream-500">
                                                            <span>Tổng chai</span>
                                                            <span className="font-bold">{csm.totalItems}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-green-700">
                                                            <span>Đã bán</span>
                                                            <span className="font-bold">{sold}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-blue-600">
                                                            <span>Còn trong kho</span>
                                                            <span className="font-bold">{inStock}</span>
                                                        </div>
                                                        <div className="border-t border-cream-200 pt-2 flex justify-between text-xs text-cream-500">
                                                            <span>Doanh thu bán</span>
                                                            <span className="font-mono font-bold text-wine-700">₫{fmt(soldRevenue)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-cream-500">
                                                            <span>Hoa hồng ({csm.commissionRate}%)</span>
                                                            <span className="font-mono font-bold text-green-700">₫{fmt(Math.round(soldRevenue * csm.commissionRate / 100))}</span>
                                                        </div>
                                                        <div className="border-t border-cream-200 pt-2 flex justify-between text-sm font-bold text-green-900">
                                                            <span>Phải trả NCC</span>
                                                            <span className="font-mono text-wine-700">₫{fmt(soldRevenue - Math.round(soldRevenue * csm.commissionRate / 100))}</span>
                                                        </div>
                                                    </div>
                                                    {csm.notes && <p className="mt-2 text-[10px] text-cream-400 italic">📝 {csm.notes}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {consignments.length === 0 && <div className="py-12 text-center text-sm text-cream-400">Chưa có lô ký gửi nào</div>}
                    </div>
                </div>
            )}

            {/* ═══════════ SETTLEMENT TAB ═══════════ */}
            {tab === "settlement" && (
                <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className={TH}>Lô ký gửi</th>
                                <th className={TH} style={{ width: 130 }}>NCC</th>
                                <th className={TH} style={{ width: 120 }}>Kỳ QT</th>
                                <th className={THC} style={{ width: 60 }}>SL bán</th>
                                <th className={THR} style={{ width: 110 }}>Doanh thu</th>
                                <th className={THR} style={{ width: 100 }}>Hoa hồng</th>
                                <th className={THR} style={{ width: 110 }}>Phải trả</th>
                                <th className={THC} style={{ width: 90 }}>Trạng thái</th>
                                <th className={THC} style={{ width: 100 }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settlements.map((stl) => (
                                <tr key={stl.id} className="hover:bg-green-50/50 transition-colors">
                                    <td className={TD}>
                                        <span className="font-mono font-bold">{stl.consignmentNo}</span>
                                        <p className="text-[10px] text-cream-400">{new Date(stl.createdAt).toLocaleDateString("vi-VN")}</p>
                                    </td>
                                    <td className={cn(TD, "font-medium")}>{stl.supplierName}</td>
                                    <td className={cn(TD, "text-[11px] text-cream-500")}>
                                        {new Date(stl.periodStart).toLocaleDateString("vi-VN")} → {new Date(stl.periodEnd).toLocaleDateString("vi-VN")}
                                    </td>
                                    <td className={cn(TDC, "font-bold")}>{stl.totalSoldItems}</td>
                                    <td className={cn(TDR, "font-bold text-green-700")}>₫{fmt(stl.totalRevenue)}</td>
                                    <td className={TDR}>
                                        <span className="text-cream-500">{stl.commissionRate}% = </span>
                                        <span className="font-bold text-green-700">₫{fmt(stl.commissionAmount)}</span>
                                    </td>
                                    <td className={cn(TDR, "font-bold text-wine-700")}>₫{fmt(stl.amountDue)}</td>
                                    <td className={TDC}>
                                        <span className={cn(
                                            "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold leading-tight",
                                            stl.status === "DRAFT" ? "bg-cream-200 text-cream-600" :
                                                stl.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" :
                                                    "bg-green-100 text-green-700"
                                        )}>
                                            {stl.status === "DRAFT" ? "Nháp" : stl.status === "CONFIRMED" ? "Xác nhận" : "Đã trả"}
                                        </span>
                                    </td>
                                    <td className={TDC}>
                                        <div className="flex items-center justify-center gap-1">
                                            {stl.status === "DRAFT" && (
                                                <Button
                                                    onClick={async () => {
                                                        await confirmSettlement(stl.id)
                                                        toast.success("Xác nhận quyết toán!")
                                                        loadData()
                                                    }}
                                                    size="sm"
                                                    className="h-6 text-[9px] bg-blue-600 hover:bg-blue-700 text-white"
                                                >
                                                    <CircleCheck className="mr-1 h-3 w-3" /> Duyệt
                                                </Button>
                                            )}
                                            {stl.status === "CONFIRMED" && (
                                                <Button
                                                    onClick={async () => {
                                                        await markSettlementPaid(stl.id)
                                                        toast.success("Đã thanh toán cho NCC!")
                                                        loadData()
                                                    }}
                                                    size="sm"
                                                    className="h-6 text-[9px] bg-green-700 hover:bg-green-800 text-white"
                                                >
                                                    <DollarSign className="mr-1 h-3 w-3" /> Chuyển tiền
                                                </Button>
                                            )}
                                            {stl.status === "PAID" && (
                                                <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    {stl.paidAt ? new Date(stl.paidAt).toLocaleDateString("vi-VN") : "Đã trả"}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {settlements.length === 0 && <div className="py-12 text-center text-sm text-cream-400">Chưa có phiếu quyết toán</div>}
                </div>
            )}

            {/* ═══════════ CREATE PO MODAL ═══════════ */}
            {showCreatePO && (
                <CreatePOModal
                    suppliers={suppliers}
                    staffName={staff?.fullName ?? "Staff"}
                    onClose={() => setShowCreatePO(false)}
                    onCreated={() => { setShowCreatePO(false); loadData(); toast.success("Tạo PO thành công!") }}
                />
            )}

            {/* ═══════════ CREATE SUPPLIER MODAL ═══════════ */}
            {showCreateSupplier && (
                <CreateSupplierModal
                    onClose={() => setShowCreateSupplier(false)}
                    onCreated={() => { setShowCreateSupplier(false); loadData(); toast.success("✅ Thêm nhà cung cấp thành công!") }}
                />
            )}
        </div>
    )
}

/* ─── Create PO Modal ─── */
type NewItem = { productName: string; sku: string; quantity: string; unitPrice: string; unit: string; category: "GOODS" | "NPL" | "CCDC" }
const UNIT_OPTIONS = ["chai", "thùng", "kg", "g", "lít", "lon", "hộp", "gói", "bộ", "cái", "m", "cuộn"]

function CreatePOModal({ suppliers, staffName, onClose, onCreated }: { suppliers: Supplier[]; staffName: string; onClose: () => void; onCreated: () => void }) {
    const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "")
    const [expectedDate, setExpectedDate] = useState("")
    const [notes, setNotes] = useState("")
    const [items, setItems] = useState<NewItem[]>([{ productName: "", sku: "", quantity: "", unitPrice: "", unit: "chai", category: "GOODS" }])
    const [vatRate, setVatRate] = useState(10)
    const [submitting, setSubmitting] = useState(false)

    const addItem = () => setItems([...items, { productName: "", sku: "", quantity: "", unitPrice: "", unit: "chai", category: "GOODS" }])
    const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))
    const updateItem = (i: number, field: keyof NewItem, value: string) => {
        const updated = [...items]
        updated[i] = { ...updated[i], [field]: value }
        setItems(updated)
    }

    const supplier = suppliers.find((s) => s.id === supplierId)

    const handleSubmit = async () => {
        if (!supplierId) { toast.error("Chọn nhà cung cấp"); return }
        if (!expectedDate) { toast.error("Chọn ngày dự kiến"); return }
        const validItems = items.filter((i) => i.productName && i.quantity && i.unitPrice)
        if (validItems.length === 0) { toast.error("Thêm ít nhất 1 sản phẩm"); return }

        setSubmitting(true)
        await createPurchaseOrder({
            supplierId,
            supplierName: supplier?.name ?? "",
            items: validItems.map((i) => ({
                productName: i.productName,
                sku: i.sku || "N/A",
                qty: parseInt(i.quantity),
                quantity: parseInt(i.quantity),
                unitCost: parseInt(i.unitPrice),
                unitPrice: parseInt(i.unitPrice),
                totalPrice: parseInt(i.quantity) * parseInt(i.unitPrice),
                unit: i.unit,
                category: i.category,
            })),
            notes,
            expectedDate: new Date(expectedDate),
            createdBy: staffName,
        })
        setSubmitting(false)
        onCreated()
    }

    const total = items.reduce((s, i) => s + (parseInt(i.quantity) || 0) * (parseInt(i.unitPrice) || 0), 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-2xl border border-cream-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
                    <div>
                        <h2 className="text-lg font-bold text-green-900">Tạo Đơn nhập mới</h2>
                        <p className="text-xs text-cream-500">Điền thông tin sản phẩm cần nhập</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100 transition-all"><X className="h-4 w-4 text-cream-400" /></button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Supplier + Date */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1.5 block">Nhà cung cấp</label>
                            <select
                                value={supplierId}
                                onChange={(e) => setSupplierId(e.target.value)}
                                className="w-full h-9 rounded-lg border border-cream-300 bg-white px-3 text-xs text-green-900 focus:outline-none focus:ring-2 focus:ring-green-200"
                            >
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1.5 block">Ngày dự kiến nhận</label>
                            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>

                    {/* Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-cream-400">Sản phẩm</label>
                            <button onClick={addItem} className="flex items-center gap-1 text-[10px] font-bold text-green-700 hover:text-green-800 transition-all">
                                <Plus className="h-3 w-3" /> Thêm dòng
                            </button>
                        </div>
                        <div className="rounded-lg border border-cream-200 overflow-x-auto">
                            <table className="w-full table-fixed">
                                <colgroup>
                                    <col />
                                    <col style={{ width: 72 }} />
                                    <col style={{ width: 62 }} />
                                    <col style={{ width: 56 }} />
                                    <col style={{ width: 80 }} />
                                    <col style={{ width: 100 }} />
                                    <col style={{ width: 100 }} />
                                    <col style={{ width: 32 }} />
                                </colgroup>
                                <thead>
                                    <tr className="bg-cream-50 border-b border-cream-200">
                                        <th className="text-left text-[10px] font-bold text-cream-500 px-2.5 py-2">Tên SP</th>
                                        <th className="text-left text-[10px] font-bold text-cream-500 px-1 py-2">SKU</th>
                                        <th className="text-center text-[10px] font-bold text-cream-500 px-1 py-2">Loại</th>
                                        <th className="text-center text-[10px] font-bold text-cream-500 px-1 py-2">SL</th>
                                        <th className="text-center text-[10px] font-bold text-cream-500 px-1 py-2">ĐVT</th>
                                        <th className="text-right text-[10px] font-bold text-cream-500 px-1 py-2">Đơn giá</th>
                                        <th className="text-right text-[10px] font-bold text-cream-500 px-2.5 py-2">Thành tiền</th>
                                        <th className="px-1 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, i) => {
                                        const subtotal = (parseInt(item.quantity) || 0) * (parseInt(item.unitPrice) || 0)
                                        return (
                                            <tr key={i} className="border-t border-cream-100 hover:bg-cream-50/50">
                                                <td className="py-1.5 px-2.5">
                                                    <Input value={item.productName} onChange={(e) => updateItem(i, "productName", e.target.value)} placeholder="Tên sản phẩm" className="h-9 text-xs border-cream-300 bg-white" />
                                                </td>
                                                <td className="py-1.5 px-1">
                                                    <Input value={item.sku} onChange={(e) => updateItem(i, "sku", e.target.value)} placeholder="SKU" className="h-9 text-xs border-cream-300 bg-white" />
                                                </td>
                                                <td className="py-1.5 px-1">
                                                    <select value={item.category} onChange={(e) => updateItem(i, "category", e.target.value)} className="h-9 w-full rounded-lg border border-cream-300 bg-white px-1.5 text-xs font-medium text-green-900 focus:outline-none focus:ring-2 focus:ring-green-200">
                                                        <option value="GOODS">Hàng</option>
                                                        <option value="NPL">NPL</option>
                                                        <option value="CCDC">CCDC</option>
                                                    </select>
                                                </td>
                                                <td className="py-1.5 px-1">
                                                    <Input value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value.replace(/\D/g, ""))} placeholder="0" className="h-9 text-xs text-center border-cream-300 bg-white font-mono" />
                                                </td>
                                                <td className="py-1.5 px-1">
                                                    <select value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="h-9 w-full rounded-lg border border-cream-300 bg-white px-1.5 text-sm font-semibold text-green-900 focus:outline-none focus:ring-2 focus:ring-green-200">
                                                        {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                                                    </select>
                                                </td>
                                                <td className="py-1.5 px-1">
                                                    <Input value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value.replace(/\D/g, ""))} placeholder="0" className="h-9 text-xs text-right border-cream-300 bg-white font-mono" />
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right">
                                                    <span className="font-mono text-sm font-bold text-wine-700">
                                                        {subtotal > 0 ? `₫${fmt(subtotal)}` : "—"}
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-1">
                                                    {items.length > 1 && (
                                                        <button onClick={() => removeItem(i)} className="p-1 rounded hover:bg-red-50 text-cream-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1.5 block">Ghi chú</label>
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú cho đơn hàng..." className="h-9 text-xs border-cream-300 bg-white" />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-cream-200 bg-cream-50 rounded-b-2xl">
                    <div className="flex items-center gap-4">
                        <div className="text-sm">
                            <span className="text-cream-500">{items.filter((i) => i.productName).length} sản phẩm · </span>
                            <span className="font-mono font-bold text-wine-700">Tạm tính: ₫{fmt(total)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-2 py-1">
                            <span className="text-[10px] font-bold text-cream-500">VAT</span>
                            <select
                                value={vatRate}
                                onChange={(e) => setVatRate(parseInt(e.target.value))}
                                className="h-6 rounded border-0 bg-transparent text-sm font-bold text-green-900 focus:outline-none focus:ring-0 pr-1 appearance-none cursor-pointer"
                            >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={8}>8%</option>
                                <option value={10}>10%</option>
                            </select>
                            <span className="text-xs text-cream-400">= ₫{fmt(Math.round(total * vatRate / 100))}</span>
                        </div>
                        <span className="font-mono text-sm font-bold text-green-900">Tổng: ₫{fmt(Math.round(total * (1 + vatRate / 100)))}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={onClose} variant="outline" size="sm" className="border-cream-300 text-cream-500">Hủy</Button>
                        <Button onClick={handleSubmit} disabled={submitting} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                            <Plus className="mr-1 h-3 w-3" /> Tạo PO (Nháp)
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ─── Create Supplier Modal ─── */
function CreateSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState("")
    const [contactPerson, setContactPerson] = useState("")
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [address, setAddress] = useState("")
    const [taxCode, setTaxCode] = useState("")
    const [category, setCategory] = useState<"WINE" | "FOOD" | "SPIRITS" | "EQUIPMENT" | "OTHER">("WINE")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!name.trim()) { toast.error("Nhập tên nhà cung cấp"); return }
        if (!phone.trim()) { toast.error("Nhập số điện thoại"); return }

        setSubmitting(true)
        await createSupplier({
            name: name.trim(),
            contactPerson: contactPerson.trim() || "N/A",
            phone: phone.trim(),
            email: email.trim() || "",
            address: address.trim() || "",
            taxCode: taxCode.trim() || "",
            category,
        })
        setSubmitting(false)
        onCreated()
    }

    const fieldLabel = "text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1.5 block"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-cream-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
                    <div>
                        <h2 className="text-lg font-bold text-green-900">🏢 Thêm nhà cung cấp mới</h2>
                        <p className="text-xs text-cream-500">Điền thông tin nhà cung cấp</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100 transition-all"><X className="h-4 w-4 text-cream-400" /></button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Name + Category */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                        <div className="col-span-2">
                            <label className={fieldLabel}>Tên nhà cung cấp *</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Vang Đại Việt" className="h-9 text-xs border-cream-300" autoFocus />
                        </div>
                        <div>
                            <label className={fieldLabel}>Ngành</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="w-full h-9 rounded-lg border border-cream-300 bg-white px-3 text-xs text-green-900 focus:outline-none focus:ring-2 focus:ring-green-200">
                                <option value="WINE">Wine</option>
                                <option value="FOOD">Food</option>
                                <option value="SPIRITS">Spirits</option>
                                <option value="EQUIPMENT">Equipment</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Contact + Phone */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Người liên hệ</label>
                            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="VD: Anh Minh" className="h-9 text-xs border-cream-300" />
                        </div>
                        <div>
                            <label className={fieldLabel}>Số điện thoại *</label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912 xxx xxx" className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>

                    {/* Email + Tax Code */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Email</label>
                            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" className="h-9 text-xs border-cream-300" />
                        </div>
                        <div>
                            <label className={fieldLabel}>Mã số thuế</label>
                            <Input value={taxCode} onChange={(e) => setTaxCode(e.target.value)} placeholder="0123456789" className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <label className={fieldLabel}>Địa chỉ</label>
                        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số 1, Đường X, Quận Y, TP.HCM" className="h-9 text-xs border-cream-300" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-cream-200 bg-cream-50 rounded-b-2xl">
                    <Button onClick={onClose} variant="outline" size="sm" className="border-cream-300 text-cream-500">Hủy</Button>
                    <Button onClick={handleSubmit} disabled={submitting} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                        <Building2 className="mr-1 h-3 w-3" /> {submitting ? "Đang lưu..." : "Thêm NCC"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
