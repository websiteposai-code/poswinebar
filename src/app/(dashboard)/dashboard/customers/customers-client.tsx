"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, UserPlus, Phone, Mail, Calendar, ChevronDown, ChevronUp, ShoppingBag, X, Clock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    getAllCustomers,
    searchCRMCustomers,
    createCustomer,
    getCustomerStats,
    getCustomerProfile,
    type CustomerProfile,
    type CustomerDetailProfile,
    type CustomerStats,
} from "@/actions/customers"
import { DashboardInlineSkeleton } from "@/components/inline-skeletons"
import { usePrefetchStore } from "@/stores/prefetch-store"

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n) }
function fmtK(n: number) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return String(n)
}

type TierKey = "REGULAR" | "SILVER" | "GOLD" | "PLATINUM" | "VIP"

const TIER_DISPLAY: Record<TierKey, { label: string; cls: string; icon: string; bg: string }> = {
    REGULAR: { label: "Standard", cls: "text-stone-600", icon: "•", bg: "bg-cream-100 border-cream-300 text-stone-600" },
    SILVER: { label: "Silver", cls: "text-stone-700", icon: "✦", bg: "bg-stone-100 border-stone-300 text-stone-700" },
    GOLD: { label: "Gold Club", cls: "text-amber-800", icon: "★", bg: "bg-amber-100 border-amber-300 text-amber-800" },
    PLATINUM: { label: "Platinum", cls: "text-stone-900 font-bold", icon: "✦✦", bg: "bg-stone-900 border-stone-800 text-cream-100" },
    VIP: { label: "Private Reserve", cls: "text-wine-800 font-bold", icon: "♛", bg: "bg-wine-100 border-wine-300 text-wine-800" },
}

export type CustomersInitialData = { list: CustomerProfile[]; stats: CustomerStats }

export function CustomersClient({ initialData }: { initialData: CustomersInitialData }) {
    const store = usePrefetchStore()

    const [customers, setCustomers] = useState<CustomerProfile[]>(initialData.list)
    const [stats, setStats] = useState<CustomerStats>(initialData.stats)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [tierFilter, setTierFilter] = useState<TierKey | "ALL">("ALL")
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [expandedDetail, setExpandedDetail] = useState<CustomerDetailProfile | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)

    const handleExpand = useCallback(async (id: string) => {
        if (expandedId === id) { setExpandedId(null); setExpandedDetail(null); return }
        setExpandedId(id)
        setLoadingDetail(true)
        const detail = await getCustomerProfile(id)
        setExpandedDetail(detail)
        setLoadingDetail(false)
    }, [expandedId])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [cList, cStats] = await Promise.all([
                searchTerm ? searchCRMCustomers(searchTerm) : getAllCustomers(),
                getCustomerStats(),
            ])
            setCustomers(cList)
            setStats(cStats)
            if (!searchTerm) {
                store.set("customers:list", cList)
                store.set("customers:stats", cStats)
            }
        } catch (err) {
            console.error("[Customers] loadData failed:", err)
            toast.error("Không thể tải dữ liệu khách hàng")
        }
        setLoading(false)
    }, [searchTerm, store])

    // Only re-fetch when search term changes (not on mount — SSR data is already there)
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        if (mounted) loadData()
        else { setMounted(true); store.set("customers:list", initialData.list); store.set("customers:stats", initialData.stats) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm])

    const filteredCustomers = tierFilter === "ALL"
        ? customers
        : customers.filter((c) => c.tier === tierFilter)

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Khách hàng & CRM</h1>
                        <p className="text-sm text-cream-500">Quản lý profile, loyalty, sở thích rượu</p>
                    </div>
                </div>
                <Button onClick={() => setShowAddModal(true)} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Thêm khách
                </Button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Tổng KH</span></div>
                            <p className="font-mono text-xl font-bold text-green-900">{stats.totalCustomers}</p>
                        </div>
                        {(["PLATINUM", "GOLD", "SILVER", "REGULAR"] as TierKey[]).map((tier) => {
                            const cfg = TIER_DISPLAY[tier]
                            return (
                                <div key={tier} className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTierFilter(tierFilter === tier ? "ALL" : tier)}>
                                    <div className="flex items-center gap-1.5 mb-1"><span className="text-sm">{cfg.icon}</span><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">{cfg.label}</span></div>
                                    <p className={cn("font-mono text-xl font-bold", cfg.cls)}>{stats.byTier[tier] ?? 0}</p>
                                </div>
                            )
                        })}
                        <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">TB/đơn</span></div>
                            <p className="font-mono text-xl font-bold text-wine-700">₫{fmtK(stats.avgSpendPerVisit)}</p>
                        </div>
                    </div>
                    {/* RFM Segments */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-green-200 bg-green-50 p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-green-600">Active (≤30 ngày)</span></div>
                            <p className="font-mono text-xl font-bold text-green-700">{stats.segments?.active ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-amber-600">At Risk (31-90 ngày)</span></div>
                            <p className="font-mono text-xl font-bold text-amber-700">{stats.segments?.atRisk ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-red-500">Lost (90+ ngày)</span></div>
                            <p className="font-mono text-xl font-bold text-red-600">{stats.segments?.lost ?? 0}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative max-w-xs flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm tên, SĐT, email..."
                        className="h-8 pl-8 text-xs border-cream-300 bg-white"
                    />
                </div>
                <div className="flex gap-1">
                    {(["ALL", "PLATINUM", "GOLD", "SILVER", "REGULAR"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTierFilter(t)}
                            className={cn(
                                "rounded-md px-2.5 py-1 text-[10px] font-medium transition-all",
                                tierFilter === t
                                    ? "bg-green-900 text-cream-50"
                                    : "bg-cream-200 text-cream-500"
                            )}
                        >
                            {t === "ALL" ? "Tất cả" : `${TIER_DISPLAY[t].icon} ${TIER_DISPLAY[t].label}`}
                        </button>
                    ))}
                </div>
                <span className="text-xs text-cream-400 ml-auto">{filteredCustomers.length} khách hàng</span>
            </div>

            {/* Customer Cards */}
            <div className="space-y-2">
                {filteredCustomers.map((cust) => {
                    const isExpanded = expandedId === cust.id
                    const tierCfg = TIER_DISPLAY[(cust.tier as TierKey) in TIER_DISPLAY ? cust.tier as TierKey : "REGULAR"]

                    return (
                        <div key={cust.id} className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
                            {/* Main Row */}
                            <div
                                className={cn("flex items-center cursor-pointer transition-colors px-4 py-3.5", isExpanded && "bg-green-50")}
                                onClick={() => handleExpand(cust.id)}
                            >
                                {/* Avatar */}
                                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full border-2 mr-3 text-sm font-bold", tierCfg.bg)}>
                                    {(cust.fullName ?? cust.name ?? "?").split(" ").slice(-1)[0]?.[0] ?? "?"}
                                </div>

                                {/* Name + Contact */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-green-900">{cust.fullName}</span>
                                        <Badge className={cn("text-[8px] font-bold border", tierCfg.bg)}>
                                            {tierCfg.icon} {tierCfg.label}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="flex items-center gap-1 text-[11px] text-cream-500"><Phone className="h-3 w-3" /> {cust.phone}</span>
                                        {cust.email && <span className="flex items-center gap-1 text-[11px] text-cream-500"><Mail className="h-3 w-3" /> {cust.email}</span>}
                                        {cust.birthday && <span className="flex items-center gap-1 text-[11px] text-cream-500"><Calendar className="h-3 w-3" /> {typeof cust.birthday === 'string' ? cust.birthday : new Date(cust.birthday).toLocaleDateString('vi-VN')}</span>}
                                    </div>
                                </div>

                                {/* Last Visit */}
                                <div className="hidden xl:flex items-center gap-4 mr-4 text-[11px]">
                                    {cust.lastVisit && (
                                        <span className="text-cream-500">
                                            <Clock className="inline h-3 w-3 mr-0.5" />
                                            {new Date(cust.lastVisit).toLocaleDateString("vi-VN")}
                                        </span>
                                    )}
                                    <span className="text-cream-500">
                                        <ShoppingBag className="inline h-3 w-3 mr-0.5" />
                                        {cust.orderCount ?? cust.visitCount ?? 0} đơn
                                    </span>
                                </div>

                                {/* Spend + Points */}
                                <div className="text-right mr-3">
                                    <p className="font-mono text-sm font-bold text-wine-700">₫{fmtK(cust.totalSpent)}</p>
                                    <p className="text-[10px] text-cream-400">{cust.orderCount ?? cust.visitCount ?? 0} đơn · {fmt(cust.loyaltyPoints ?? cust.loyaltyPts ?? 0)} pts</p>
                                </div>

                                {/* Expand arrow */}
                                <div className="w-6 text-center">
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-cream-400" /> : <ChevronDown className="h-4 w-4 text-cream-400" />}
                                </div>
                            </div>

                            {/* Expanded Detail */}
                            {isExpanded && (
                                <div className="border-t border-cream-200 bg-cream-50 px-5 py-4">
                                    {loadingDetail ? (
                                        <div className="py-6 text-center text-sm text-cream-400">Đang tải chi tiết...</div>
                                    ) : expandedDetail ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5">
                                            {/* Left: Info + RFM */}
                                            <div className="space-y-3">
                                                <div>
                                                    <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-1.5">Thông tin</h4>
                                                    <div className="rounded-lg bg-white border border-cream-200 p-3 space-y-2 text-xs">
                                                        <div className="flex justify-between"><span className="text-cream-500">SĐT</span><span className="font-mono">{cust.phone}</span></div>
                                                        <div className="flex justify-between"><span className="text-cream-500">Email</span><span>{cust.email ?? "—"}</span></div>
                                                        <div className="flex justify-between"><span className="text-cream-500">Sinh nhật</span><span>{cust.birthday ? (typeof cust.birthday === 'string' ? cust.birthday : new Date(cust.birthday).toLocaleDateString('vi-VN')) : "—"}</span></div>
                                                        <div className="flex justify-between"><span className="text-cream-500">Khách từ</span><span>{new Date(cust.createdAt).toLocaleDateString("vi-VN")}</span></div>
                                                        <div className="flex justify-between"><span className="text-cream-500">Lần ghé cuối</span><span className="font-medium">{expandedDetail.daysSinceLastVisit === 0 ? "Hôm nay" : `${expandedDetail.daysSinceLastVisit} ngày trước`}</span></div>
                                                    </div>
                                                </div>

                                                {/* RFM Score */}
                                                <div>
                                                    <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-1.5 flex items-center gap-1">Phân tích RFM</h4>
                                                    <div className="rounded-lg bg-white border border-cream-200 p-3 space-y-1.5">
                                                        {(["recency", "frequency", "monetary"] as const).map((dim) => {
                                                            const val = expandedDetail.rfm[dim]
                                                            const labels = { recency: "Gần đây", frequency: "Tần suất", monetary: "Chi tiêu" }
                                                            const colors = { HIGH: "bg-green-100 text-green-700", MEDIUM: "bg-amber-100 text-amber-700", LOW: "bg-red-100 text-red-700" }
                                                            return (
                                                                <div key={dim} className="flex justify-between items-center text-xs">
                                                                    <span className="text-cream-500">{labels[dim]}</span>
                                                                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", colors[val])}>{val}</span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                {cust.notes && <p className="text-[11px] text-cream-500 italic bg-white rounded-lg border border-cream-200 p-2.5">{cust.notes}</p>}
                                            </div>

                                            {/* Middle: Loyalty & Favorites */}
                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-1.5">Loyalty & Thống kê</h4>
                                                <div className="rounded-lg bg-white border border-cream-200 p-3 space-y-2">
                                                    <div className="flex justify-between text-xs"><span className="text-cream-500 flex items-center gap-1">Hạng</span><Badge className={cn("text-[9px] font-bold border", tierCfg.bg)}>{tierCfg.icon} {tierCfg.label}</Badge></div>
                                                    <div className="flex justify-between text-xs"><span className="text-cream-500 flex items-center gap-1">Tổng chi</span><span className="font-mono font-bold text-wine-700">₫{fmt(cust.totalSpent)}</span></div>
                                                    <div className="flex justify-between text-xs"><span className="text-cream-500 flex items-center gap-1">Số đơn</span><span className="font-bold text-green-700">{expandedDetail.orderCount}</span></div>
                                                    <div className="border-t border-cream-200 pt-2 flex justify-between text-xs"><span className="text-cream-500">TB/đơn</span><span className="font-mono font-bold text-green-900">₫{fmt(expandedDetail.avgOrderValue)}</span></div>
                                                    <div className="flex justify-between text-xs"><span className="text-cream-500 flex items-center gap-1">Điểm</span><span className="font-mono font-bold text-amber-600">{fmt(cust.loyaltyPts)} pts</span></div>
                                                </div>

                                                {/* Favorite Products */}
                                                {expandedDetail.favoriteProducts.length > 0 && (
                                                    <div>
                                                        <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-1.5 flex items-center gap-1">Hay gọi nhất</h4>
                                                        <div className="rounded-lg bg-white border border-cream-200 p-3 space-y-1.5">
                                                            {expandedDetail.favoriteProducts.map((fp, i) => (
                                                                <div key={i} className="flex justify-between text-xs">
                                                                    <span className="text-cream-600 truncate max-w-[160px]">{fp.name}</span>
                                                                    <span className="font-mono text-cream-500">{fp.count}× · ₫{fmtK(fp.total)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Tier progress */}
                                                <div className="rounded-lg bg-white border border-cream-200 p-3">
                                                    <p className="text-[9px] font-bold uppercase text-cream-400 mb-1.5">Tiến trình hạng</p>
                                                    {(() => {
                                                        const tiers: TierKey[] = ["REGULAR", "SILVER", "GOLD", "PLATINUM"]
                                                        const currentIdx = tiers.indexOf(cust.tier as TierKey)
                                                        const nextTier = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null
                                                        const thresholds: Record<TierKey, number> = { REGULAR: 0, SILVER: 10000000, GOLD: 30000000, PLATINUM: 80000000, VIP: 100000000 }
                                                        if (!nextTier) return <p className="text-[10px] text-wine-800 font-bold flex items-center gap-1">✦ Đã đạt hạng cao nhất</p>
                                                        const needed = thresholds[nextTier] - cust.totalSpent
                                                        const progress = Math.min(100, (cust.totalSpent / thresholds[nextTier]) * 100)
                                                        return (<>
                                                            <div className="flex justify-between text-[10px] mb-1">
                                                                <span className="text-cream-500">{tierCfg.icon} {tierCfg.label}</span>
                                                                <span className={cn("font-bold", TIER_DISPLAY[nextTier].cls)}>{TIER_DISPLAY[nextTier].icon} {TIER_DISPLAY[nextTier].label}</span>
                                                            </div>
                                                            <div className="h-2 rounded-full bg-cream-200 overflow-hidden"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} /></div>
                                                            <p className="text-[9px] text-cream-400 mt-1">Còn ₫{fmt(needed)} để lên hạng</p>
                                                        </>)
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Right: Order History */}
                                            <div>
                                                <h4 className="text-[10px] font-bold uppercase text-cream-400 mb-1.5 flex items-center gap-1">Lịch sử ({expandedDetail.orderHistory?.length ?? 0} đơn gần nhất)</h4>
                                                <div className="space-y-2 max-h-72 overflow-y-auto">
                                                    {(expandedDetail.orderHistory ?? []).length > 0 ? (expandedDetail.orderHistory ?? []).map((order) => (
                                                        <div key={order.id} className="rounded-lg bg-white border border-cream-200 p-2.5">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <div>
                                                                    <span className="font-mono text-[11px] font-bold text-blue-700">{order.orderNumber}</span>
                                                                    <span className="text-[9px] text-cream-400 ml-1.5">{new Date(order.date).toLocaleDateString("vi-VN")}</span>
                                                                </div>
                                                                <span className="font-mono text-[11px] font-bold text-wine-700">₫{fmt(order.total)}</span>
                                                            </div>
                                                            <p className="text-[10px] text-cream-500 leading-tight">{order.items.join(", ")}</p>
                                                            <span className={cn("rounded-full px-1.5 py-0.5 text-[7px] font-bold mt-1 inline-block",
                                                                order.paymentMethod === "CASH" ? "bg-green-100 text-green-700" :
                                                                    order.paymentMethod === "CARD" ? "bg-blue-100 text-blue-700" : "bg-wine-100 text-wine-700"
                                                            )}>{order.paymentMethod}</span>
                                                        </div>
                                                    )) : (
                                                        <p className="text-[10px] text-cream-400 italic py-4 text-center">Chưa có lịch sử mua hàng</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-sm text-cream-400">Không tìm thấy thông tin chi tiết</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}

                {filteredCustomers.length === 0 && !loading && (
                    <div className="py-12 text-center text-sm text-cream-400">Không tìm thấy khách hàng</div>
                )}
            </div>

            {/* Add Customer Modal */}
            {showAddModal && (
                <AddCustomerModal
                    onClose={() => setShowAddModal(false)}
                    onCreated={() => { setShowAddModal(false); loadData(); toast.success("Thêm khách hàng thành công!") }}
                />
            )}
        </div>
    )
}

// ============================================================
// ADD CUSTOMER MODAL
// ============================================================

function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [birthday, setBirthday] = useState("")
    const [notes, setNotes] = useState("")
    const [prefs, setPrefs] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!name.trim()) { toast.error("Nhập tên khách hàng"); return }
        if (!phone.trim()) { toast.error("Nhập số điện thoại"); return }

        setSubmitting(true)
        await createCustomer({
            fullName: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
            birthday: birthday || undefined,
            notes: notes.trim() || undefined,
            winePreferences: prefs ? prefs.split(",").map((p) => p.trim()).filter(Boolean) : undefined,
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
                        <h2 className="text-lg font-bold text-green-900">Thêm khách hàng mới</h2>
                        <p className="text-xs text-cream-500">Tạo hồ sơ khách hàng CRM</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100 transition-all"><X className="h-4 w-4 text-cream-400" /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Họ tên *</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" className="h-9 text-xs border-cream-300" autoFocus />
                        </div>
                        <div>
                            <label className={fieldLabel}>Số điện thoại *</label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912 xxx xxx" className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Email</label>
                            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-xs border-cream-300" />
                        </div>
                        <div>
                            <label className={fieldLabel}>Sinh nhật</label>
                            <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>
                    <div>
                        <label className={fieldLabel}>Sở thích rượu (phân tách bằng dấu phẩy)</label>
                        <Input value={prefs} onChange={(e) => setPrefs(e.target.value)} placeholder="Cabernet Sauvignon, Bordeaux, Full-body reds" className="h-9 text-xs border-cream-300" />
                    </div>
                    <div>
                        <label className={fieldLabel}>Ghi chú</label>
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Đặc điểm, dị ứng, sở thích..." className="h-9 text-xs border-cream-300" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-cream-200 bg-cream-50 rounded-b-2xl">
                    <Button onClick={onClose} variant="outline" size="sm" className="border-cream-300 text-cream-500">Hủy</Button>
                    <Button onClick={handleSubmit} disabled={submitting} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                        <UserPlus className="mr-1 h-3 w-3" /> {submitting ? "Đang lưu..." : "Thêm khách hàng"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
