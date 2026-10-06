"use client"

import { useState } from "react"
import { Clock, Percent, Gift, DollarSign, ToggleLeft, ToggleRight, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    getAllPromotions,
    togglePromoStatus,
    getPromoStats,
    createPromotion,
    deletePromotion,
    type Promotion,
    type PromoStats,
} from "@/actions/promotions"


function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n) }

const TYPE_CFG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
    HAPPY_HOUR: { label: "Happy Hour", icon: Clock, color: "text-amber-700", bg: "bg-amber-100 border-amber-300 text-amber-700" },
    PERCENT_OFF: { label: "Giảm %", icon: Percent, color: "text-blue-700", bg: "bg-blue-100 border-blue-300 text-blue-700" },
    COMBO: { label: "Combo", icon: Gift, color: "text-green-700", bg: "bg-green-100 border-green-300 text-green-700" },
    FIXED_AMOUNT: { label: "Giảm ₫", icon: DollarSign, color: "text-wine-700", bg: "bg-wine-100 border-wine-300 text-wine-700" },
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Đang chạy", cls: "bg-green-100 text-green-700" },
    SCHEDULED: { label: "Lên lịch", cls: "bg-blue-100 text-blue-700" },
    EXPIRED: { label: "Hết hạn", cls: "bg-cream-200 text-cream-500" },
    DISABLED: { label: "Tắt", cls: "bg-red-100 text-red-600" },
}

const DAY_LABELS: Record<string, string> = { MON: "T2", TUE: "T3", WED: "T4", THU: "T5", FRI: "T6", SAT: "T7", SUN: "CN" }

export interface PromotionsInitialData {
    promos: Promotion[]
    stats: PromoStats
}

export default function PromotionsClient({ initial }: { initial: PromotionsInitialData }) {
    const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED" | "DISABLED">("ALL")
    const [showCreate, setShowCreate] = useState(false)

    const [promos, setPromos] = useState(initial.promos)
    const [stats, setStats] = useState<PromoStats | undefined>(initial.stats)

    const loadData = async () => {
        const [p, s] = await Promise.all([getAllPromotions(), getPromoStats()])
        setPromos(p); setStats(s)
    }

    const handleToggle = async (id: string) => {
        await togglePromoStatus(id)
        toast.success("Cập nhật trạng thái!")
        loadData()
    }

    const handleDelete = async (id: string) => {
        await deletePromotion(id)
        toast.success("Đã xóa chương trình khuyến mãi!")
        loadData()
    }

    const filtered = filter === "ALL" ? promos : promos.filter((p) => p.status === filter)

    const now = new Date()
    const currentHour = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    const dayMap: Record<number, string> = { 0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT" }
    const today = dayMap[now.getDay()]

    const isActiveNow = (p: Promotion) => {
        if (p.status !== "ACTIVE") return false
        if (!p.activeDays.includes(today as never)) return false
        if (p.startTime && p.endTime && (currentHour < p.startTime || currentHour > p.endTime)) return false
        if (p.endDate && now > p.endDate) return false
        return true
    }

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Khuyến mãi</h1>
                        <p className="text-sm text-cream-500">Happy Hour, combo deals, giảm giá tự động</p>
                    </div>
                </div>
                <Button size="sm" className="bg-green-900 text-cream-50 hover:bg-green-800" onClick={() => setShowCreate(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Tạo CTKM
                </Button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Tổng KM</span></div>
                        <p className="font-mono text-xl font-bold text-green-900">{stats.totalPromotions}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Đang áp dụng</span></div>
                        <p className="font-mono text-xl font-bold text-green-600">{stats.activeNow}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Lượt sử dụng</span></div>
                        <p className="font-mono text-xl font-bold text-blue-700">{fmt(promos.reduce((s, p) => s + p.currentUsage, 0))}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">KM phổ biến</span></div>
                        <p className="text-[11px] font-bold text-wine-700 leading-tight mt-1">{stats.mostUsedPromo}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-amber-500">Active ngay lúc này</span></div>
                        <p className="font-mono text-xl font-bold text-amber-700">{promos.filter(isActiveNow).length}</p>
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
                {(["ALL", "ACTIVE", "EXPIRED", "DISABLED"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "rounded-md px-3 py-1.5 text-[11px] font-medium transition-all",
                            filter === f ? "bg-green-900 text-cream-50" : "bg-cream-200 text-cream-500"
                        )}
                    >
                        {f === "ALL" ? `Tất cả ${promos.length}` :
                            f === "ACTIVE" ? `Đang chạy ${promos.filter((p) => p.status === "ACTIVE").length}` :
                                f === "EXPIRED" ? `Hết hạn` : `Đã tắt`}
                    </button>
                ))}
                <span className="text-xs text-cream-400 ml-auto">Hiện tại: {currentHour} · {DAY_LABELS[today] ?? today}</span>
            </div>

            {/* Promotion Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered.map((promo) => {
                    const cfg = TYPE_CFG[promo.type]
                    const statusCfg = STATUS_CFG[promo.status]
                    const Icon = cfg.icon
                    const active = isActiveNow(promo)

                    return (
                        <div key={promo.id} className={cn(
                            "rounded-xl border bg-white shadow-sm overflow-hidden transition-all hover:shadow-md",
                            active ? "border-green-300 ring-2 ring-green-100" : "border-cream-200"
                        )}>
                            {/* Active indicator */}
                            {active && (
                                <div className="bg-green-600 px-4 py-1 text-[9px] font-bold text-white flex items-center gap-1">
                                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-300 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-green-200" /></span>
                                    ĐANG ÁP DỤNG NGAY
                                </div>
                            )}

                            <div className="p-4">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", cfg.bg)}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-green-900 leading-tight">{promo.name}</h3>
                                            <p className="text-[10px] text-cream-500 mt-0.5">{promo.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={cn("text-[8px] font-bold border", statusCfg.cls)}>{statusCfg.label}</Badge>
                                        <button
                                            onClick={() => handleToggle(promo.id)}
                                            className={cn("transition-all", promo.status === "ACTIVE" ? "text-green-600" : "text-cream-400")}
                                        >
                                            {promo.status === "ACTIVE"
                                                ? <ToggleRight className="h-6 w-6" />
                                                : <ToggleLeft className="h-6 w-6" />
                                            }
                                        </button>
                                    </div>
                                </div>

                                {/* Discount display */}
                                <div className="flex items-center gap-3 my-3">
                                    <div className={cn("rounded-lg px-3 py-2 text-center border", cfg.bg)}>
                                        {promo.discountPercent && (
                                            <p className="font-mono text-xl font-bold">-{promo.discountPercent}%</p>
                                        )}
                                        {promo.discountAmount && !promo.discountPercent && (
                                            <p className="font-mono text-xl font-bold">-₫{fmt(promo.discountAmount)}</p>
                                        )}
                                        {promo.type === "COMBO" && promo.discountAmount && (
                                            <p className="font-mono text-xl font-bold">FREE</p>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-cream-500 space-y-0.5">
                                        {promo.minOrderAmount && <p>Đơn tối thiểu: <span className="font-mono font-bold text-green-700">₫{fmt(promo.minOrderAmount)}</span></p>}
                                        {promo.maxDiscount && <p>Giảm tối đa: <span className="font-mono font-bold text-wine-600">₫{fmt(promo.maxDiscount)}</span></p>}
                                        {promo.comboRequirement && <p>{promo.comboRequirement}</p>}
                                        {promo.comboReward && <p>{promo.comboReward}</p>}
                                    </div>
                                </div>

                                {/* Schedule & Stats */}
                                <div className="border-t border-cream-200 pt-2.5 grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase text-cream-400 mb-1">LỊCH ÁP DỤNG</p>
                                        <div className="flex flex-wrap gap-0.5 mb-1">
                                            {(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const).map((day) => (
                                                <span key={day} className={cn(
                                                    "rounded px-1 py-0.5 text-[8px] font-bold",
                                                    promo.activeDays.includes(day)
                                                        ? day === today ? "bg-green-600 text-white" : "bg-green-100 text-green-700"
                                                        : "bg-cream-100 text-cream-300"
                                                )}>
                                                    {DAY_LABELS[day]}
                                                </span>
                                            ))}
                                        </div>
                                        {promo.startTime && promo.endTime && (
                                            <p className="text-[10px] text-cream-500 flex items-center gap-1">
                                                {promo.startTime} — {promo.endTime}
                                            </p>
                                        )}
                                        {promo.endDate && (
                                            <p className="text-[10px] text-cream-500 flex items-center gap-1">
                                                Đến {new Date(promo.endDate).toLocaleDateString("vi-VN")}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold uppercase text-cream-400 mb-1">THỐNG KÊ</p>
                                        <p className="text-[10px] text-cream-500">
                                            Đã dùng: <span className="font-mono font-bold text-green-700">{promo.currentUsage}</span>
                                            {promo.maxUsage && <span className="text-cream-400"> / {promo.maxUsage}</span>}
                                        </p>
                                        {promo.maxUsage && (
                                            <div className="mt-1 h-1.5 rounded-full bg-cream-200 overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full transition-all", promo.currentUsage / promo.maxUsage > 0.8 ? "bg-red-400" : "bg-green-400")}
                                                    style={{ width: `${Math.min(100, (promo.currentUsage / promo.maxUsage) * 100)}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-cream-400">Không có khuyến mãi nào</div>
            )}

            {showCreate && <CreatePromoModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadData() }} />}
        </div>
    )
}

// ============================================================
// CREATE PROMO MODAL
// ============================================================
type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"
const ALL_DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

function CreatePromoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [type, setType] = useState<"HAPPY_HOUR" | "PERCENT_OFF" | "COMBO" | "FIXED_AMOUNT">("PERCENT_OFF")
    const [discountPercent, setDiscountPercent] = useState("10")
    const [discountAmount, setDiscountAmount] = useState("50000")
    const [minOrder, setMinOrder] = useState("")
    const [maxDiscount, setMaxDiscount] = useState("")
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [days, setDays] = useState<DayKey[]>([...ALL_DAYS])
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
    const [endDate, setEndDate] = useState("")
    const [maxUsage, setMaxUsage] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const toggleDay = (d: DayKey) => setDays((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d])

    const handleSubmit = async () => {
        if (!name.trim() || !description.trim()) { toast.error("Nhập tên và mô tả"); return }
        setSubmitting(true)
        const r = await createPromotion({
            name: name.trim(),
            description: description.trim(),
            type,
            discountPercent: (type === "PERCENT_OFF" || type === "HAPPY_HOUR") ? Number(discountPercent) : undefined,
            discountAmount: (type === "FIXED_AMOUNT" || type === "COMBO") ? Number(discountAmount) : undefined,
            minOrderAmount: minOrder ? Number(minOrder) : undefined,
            maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            activeDays: days,
            startDate,
            endDate: endDate || undefined,
            maxUsage: maxUsage ? Number(maxUsage) : undefined,
        })
        setSubmitting(false)
        if (r.success) { toast.success("Đã tạo chương trình khuyến mãi!"); onCreated() }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-2xl border border-cream-200 bg-white shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-cream-200 bg-white z-10">
                    <h2 className="text-lg font-bold text-green-900">Tạo khuyến mãi mới</h2>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100"><X className="h-4 w-4 text-cream-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Tên CTKM *</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Happy Hour Rượu vang" className="h-9 text-xs border-cream-300" autoFocus />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Mô tả *</label>
                        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="VD: Giảm 15% by-glass từ 17h-19h" className="h-9 text-xs border-cream-300" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Loại CTKM</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
                            {(["PERCENT_OFF", "FIXED_AMOUNT", "HAPPY_HOUR", "COMBO"] as const).map((t) => (
                                <button key={t} onClick={() => setType(t)} className={cn("rounded-md py-2 text-[10px] font-medium border", type === t ? "bg-green-900 text-cream-50 border-green-900" : "border-cream-300 text-cream-500")}>
                                    {TYPE_CFG[t].label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {(type === "PERCENT_OFF" || type === "HAPPY_HOUR") && (
                            <div>
                                <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Giảm (%)</label>
                                <Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="h-9 text-xs border-cream-300" />
                            </div>
                        )}
                        {(type === "FIXED_AMOUNT" || type === "COMBO") && (
                            <div>
                                <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Giảm (đ)</label>
                                <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="h-9 text-xs border-cream-300" />
                            </div>
                        )}
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Giảm tối đa (đ)</label>
                            <Input type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="300000" className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Đơn tối thiểu (đ)</label>
                        <Input type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="0" className="h-9 text-xs border-cream-300" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Ngày áp dụng</label>
                        <div className="flex gap-1">
                            {ALL_DAYS.map((d) => (
                                <button key={d} onClick={() => toggleDay(d)} className={cn("flex-1 rounded-md py-1.5 text-[10px] font-bold border", days.includes(d) ? "bg-green-600 text-white border-green-600" : "border-cream-300 text-cream-400")}>
                                    {DAY_LABELS[d]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Từ giờ</label>
                            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9 text-xs border-cream-300" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Đến giờ</label>
                            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Ngày bắt đầu</label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs border-cream-300" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Ngày kết thúc</label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Giới hạn lượt dùng</label>
                        <Input type="number" value={maxUsage} onChange={(e) => setMaxUsage(e.target.value)} placeholder="Không giới hạn" className="h-9 text-xs border-cream-300" />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={onClose} variant="outline" size="sm" className="flex-1 border-cream-300 text-cream-500">Hủy</Button>
                        <Button onClick={handleSubmit} disabled={submitting} size="sm" className="flex-1 bg-green-900 text-white hover:bg-green-800">
                            {submitting ? "Đang tạo..." : "Tạo CTKM"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
