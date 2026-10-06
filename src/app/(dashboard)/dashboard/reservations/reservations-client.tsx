"use client"

import { useState, useEffect, useCallback } from "react"
import { CalendarDays, Plus, X, Check, XCircle, Armchair, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    getReservations,
    getTodayReservations,
    getReservationStats,
    createReservation,
    updateReservationStatus,
    assignTableToReservation,
    deleteReservation,
    type Reservation,
    type ReservationStatus,
} from "@/actions/reservations"
import { getTables, getZones } from "@/actions/tables"
import { DashboardInlineSkeleton } from "@/components/inline-skeletons"
import { usePrefetchStore } from "@/stores/prefetch-store"
import { useAuthStore } from "@/stores/auth-store"

const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string; icon: string }> = {
    PENDING: { label: "Chờ xác nhận", color: "bg-amber-100 border-amber-300 text-amber-700", icon: "" },
    CONFIRMED: { label: "Đã xác nhận", color: "bg-blue-100 border-blue-300 text-blue-700", icon: "" },
    SEATED: { label: "Đã ngồi", color: "bg-green-100 border-green-300 text-green-700", icon: "" },
    COMPLETED: { label: "Hoàn tất", color: "bg-cream-200 border-cream-300 text-cream-500", icon: "" },
    CANCELLED: { label: "Đã hủy", color: "bg-red-100 border-red-300 text-red-600", icon: "" },
    NO_SHOW: { label: "Không đến", color: "bg-red-50 border-red-200 text-red-500", icon: "" },
}

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
    PHONE: { label: "Điện thoại", icon: "" },
    WALK_IN: { label: "Walk-in", icon: "" },
    WEBSITE: { label: "Website", icon: "" },
    ZALO: { label: "Zalo", icon: "" },
}

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n) }

export type ReservationsInitialData = {
    list: Reservation[]
    stats: { todayTotal: number; pending: number; confirmed: number; seated: number; noShow: number; totalGuests: number }
    zones: Awaited<ReturnType<typeof getZones>>
    tables: Awaited<ReturnType<typeof getTables>>
}

export function ReservationsClient({ initialData }: { initialData: ReservationsInitialData }) {
    const store = usePrefetchStore()

    const [reservations, setReservations] = useState<Reservation[]>(initialData.list)
    const [stats, setStats] = useState(initialData.stats)
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState<ReservationStatus | "ALL">("ALL")
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0])
    const [showAddModal, setShowAddModal] = useState(false)
    const [showAssignModal, setShowAssignModal] = useState<string | null>(null)

    type DbZone = Awaited<ReturnType<typeof getZones>>[number]
    type DbTable = Awaited<ReturnType<typeof getTables>>[number]
    const [dbZones] = useState<DbZone[]>(initialData.zones)
    const [dbTables] = useState<DbTable[]>(initialData.tables)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const params: { date?: string; status?: ReservationStatus } = {}
            if (dateFilter) params.date = dateFilter
            if (statusFilter !== "ALL") params.status = statusFilter

            const [list, s] = await Promise.all([
                getReservations(params),
                getReservationStats(),
            ])
            setReservations(list)
            setStats(s)
            store.set("resv:list", list)
            store.set("resv:stats", s)
        } catch (err) {
            console.error("[Reservations] loadData failed:", err)
            toast.error("Không thể tải dữ liệu đặt bàn")
        }
        setLoading(false)
    }, [dateFilter, statusFilter, store])

    // Only re-fetch when filters change, not on mount
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        if (mounted) loadData()
        else { setMounted(true); store.set("resv:list", initialData.list); store.set("resv:stats", initialData.stats) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFilter, statusFilter])

    const handleStatusChange = async (id: string, status: ReservationStatus) => {
        const result = await updateReservationStatus(id, status)
        if (result.success) {
            toast.success(STATUS_CONFIG[status].label)
            loadData()
        } else {
            toast.error(result.error ?? "Lỗi")
        }
    }

    const handleDelete = async (id: string) => {
        await deleteReservation(id)
        toast.success("Đã xóa đặt bàn")
        loadData()
    }

    const isToday = dateFilter === new Date().toISOString().split("T")[0]

    if (loading && reservations.length === 0) {
        return <DashboardInlineSkeleton />
    }

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Đặt bàn</h1>
                        <p className="text-sm text-cream-500">Quản lý reservation, xếp bàn khách</p>
                    </div>
                </div>
                <Button onClick={() => setShowAddModal(true)} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Đặt bàn mới
                </Button>
            </div>

            {/* Stats */}
            {stats && isToday && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Hôm nay</span></div>
                        <p className="font-mono text-xl font-bold text-green-900">{stats.todayTotal}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Chờ XN</span></div>
                        <p className="font-mono text-xl font-bold text-amber-600">{stats.pending}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Đã XN</span></div>
                        <p className="font-mono text-xl font-bold text-blue-600">{stats.confirmed}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Đã ngồi</span></div>
                        <p className="font-mono text-xl font-bold text-green-600">{stats.seated}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">No-show</span></div>
                        <p className="font-mono text-xl font-bold text-red-500">{stats.noShow}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Tổng khách</span></div>
                        <p className="font-mono text-xl font-bold text-wine-700">{stats.totalGuests}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3">
                <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="h-8 w-40 text-xs border-cream-300 bg-white"
                />
                <div className="flex gap-1">
                    {(["ALL", "PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                "rounded-md px-2.5 py-1 text-[10px] font-medium transition-all",
                                statusFilter === s
                                    ? "bg-green-900 text-cream-50"
                                    : "bg-cream-200 text-cream-500"
                            )}
                        >
                            {s === "ALL" ? "Tất cả" : STATUS_CONFIG[s].label}
                        </button>
                    ))}
                </div>
                <span className="text-xs text-cream-400 ml-auto">{reservations.length} đặt bàn</span>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
                {reservations.map((rsv) => {
                    const sCfg = STATUS_CONFIG[rsv.status]
                    const srcCfg = SOURCE_LABELS[rsv.source] ?? { label: rsv.source }

                    return (
                        <div key={rsv.id} className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-all">
                            <div className="flex items-center px-5 py-4 gap-4">
                                {/* Time */}
                                <div className="w-16 shrink-0 text-center">
                                    <p className="font-mono text-xl font-bold text-green-900">{rsv.time}</p>
                                    <p className="text-[9px] text-cream-400">{new Date(rsv.date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                                </div>

                                {/* Divider */}
                                <div className="w-px h-12 bg-cream-200" />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-green-900">{rsv.customerName}</span>
                                        <Badge className={cn("text-[8px] font-bold border", sCfg.color)}>
                                            {sCfg.label}
                                        </Badge>
                                        <span className="text-[9px] text-cream-400 bg-cream-100 rounded-full px-2 py-0.5">{srcCfg.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-cream-500">
                                        <span className="flex items-center gap-1">{rsv.customerPhone}</span>
                                        <span className="flex items-center gap-1">{rsv.guestCount} khách</span>
                                        {rsv.zonePreference && <span className="flex items-center gap-1">{rsv.zonePreference}</span>}
                                        {rsv.tableNumber && (
                                            <span className="flex items-center gap-1 font-bold text-green-700">
                                                {rsv.tableNumber}
                                            </span>
                                        )}
                                    </div>
                                    {(rsv.notes || rsv.specialRequests) && (
                                        <div className="mt-1.5 flex gap-2 text-[10px]">
                                            {rsv.notes && <span className="text-cream-500 bg-cream-100 rounded px-2 py-0.5">{rsv.notes}</span>}
                                            {rsv.specialRequests && <span className="text-amber-700 bg-amber-50 rounded px-2 py-0.5 border border-amber-200">★ {rsv.specialRequests}</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {rsv.status === "PENDING" && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[10px] border-green-300 text-green-700 hover:bg-green-50"
                                                onClick={() => handleStatusChange(rsv.id, "CONFIRMED")}
                                            >
                                                <Check className="mr-1 h-3 w-3" /> Xác nhận
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[10px] border-red-300 text-red-600 hover:bg-red-50"
                                                onClick={() => handleStatusChange(rsv.id, "CANCELLED")}
                                            >
                                                <XCircle className="mr-1 h-3 w-3" /> Hủy
                                            </Button>
                                        </>
                                    )}
                                    {rsv.status === "CONFIRMED" && (
                                        <>
                                            {!rsv.tableId && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-[10px] border-blue-300 text-blue-700 hover:bg-blue-50"
                                                    onClick={() => setShowAssignModal(rsv.id)}
                                                >
                                                    <Armchair className="mr-1 h-3 w-3" /> Xếp bàn
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[10px] border-green-300 text-green-700 hover:bg-green-50"
                                                onClick={() => handleStatusChange(rsv.id, "SEATED")}
                                            >
                                                <UserCheck className="mr-1 h-3 w-3" /> Đã ngồi
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[10px] border-red-200 text-red-500 hover:bg-red-50"
                                                onClick={() => handleStatusChange(rsv.id, "NO_SHOW")}
                                            >
                                                Không đến
                                            </Button>
                                        </>
                                    )}
                                    {rsv.status === "SEATED" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[10px] border-cream-300 text-cream-500 hover:bg-cream-100"
                                            onClick={() => handleStatusChange(rsv.id, "COMPLETED")}
                                        >
                                            <Check className="mr-1 h-3 w-3" /> Xong
                                        </Button>
                                    )}
                                    {["CANCELLED", "NO_SHOW", "COMPLETED"].includes(rsv.status) && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-[10px] text-red-400 hover:text-red-600"
                                            onClick={() => handleDelete(rsv.id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {reservations.length === 0 && !loading && (
                    <div className="py-16 text-center">
                        <p className="text-sm text-cream-400">Không có đặt bàn nào</p>
                        <p className="text-xs text-cream-300 mt-1">Nhấn &quot;Đặt bàn mới&quot; để tạo</p>
                    </div>
                )}
            </div>

            {/* Add Reservation Modal */}
            {showAddModal && (
                <AddReservationModal
                    onClose={() => setShowAddModal(false)}
                    onCreated={() => { setShowAddModal(false); loadData(); toast.success("Đặt bàn thành công!") }}
                    zones={dbZones}
                />
            )}

            {/* Assign Table Modal */}
            {showAssignModal && (
                <AssignTableModal
                    reservationId={showAssignModal}
                    reservation={reservations.find((r) => r.id === showAssignModal)!}
                    onClose={() => setShowAssignModal(null)}
                    onAssigned={() => { setShowAssignModal(null); loadData(); toast.success("Đã xếp bàn!") }}
                    zones={dbZones}
                    tables={dbTables}
                />
            )}
        </div>
    )
}

// ============================================================
// ADD RESERVATION MODAL
// ============================================================
function AddReservationModal({ onClose, onCreated, zones }: { onClose: () => void; onCreated: () => void; zones: Awaited<ReturnType<typeof getZones>> }) {
    const { staff } = useAuthStore()
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [guestCount, setGuestCount] = useState(2)
    const [date, setDate] = useState(new Date().toISOString().split("T")[0])
    const [time, setTime] = useState("19:00")
    const [zone, setZone] = useState("")
    const [notes, setNotes] = useState("")
    const [specialRequests, setSpecialRequests] = useState("")
    const [source, setSource] = useState<"PHONE" | "WALK_IN" | "WEBSITE" | "ZALO">("PHONE")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!name.trim()) { toast.error("Nhập tên khách"); return }
        if (!phone.trim()) { toast.error("Nhập SĐT"); return }

        setSubmitting(true)
        const result = await createReservation({
            customerName: name.trim(),
            customerPhone: phone.trim(),
            customerEmail: email.trim() || undefined,
            guestCount,
            zonePreference: zone || undefined,
            date,
            time,
            notes: notes.trim() || undefined,
            specialRequests: specialRequests.trim() || undefined,
            source,
            staffId: staff?.id ?? "",
            staffName: staff?.fullName ?? "Staff",
        })
        setSubmitting(false)

        if (result.success) onCreated()
        else toast.error(result.error ?? "Lỗi")
    }

    const fieldLabel = "text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1.5 block"

    // Quick time slots
    const timeSlots = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-cream-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
                    <div>
                        <h2 className="text-lg font-bold text-green-900">Đặt bàn mới</h2>
                        <p className="text-xs text-cream-500">Tạo reservation cho khách</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100 transition-all"><X className="h-4 w-4 text-cream-400" /></button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Tên khách *</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" className="h-9 text-xs border-cream-300" autoFocus />
                        </div>
                        <div>
                            <label className={fieldLabel}>SĐT *</label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912 xxx xxx" className="h-9 text-xs border-cream-300" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Ngày</label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs border-cream-300" />
                        </div>
                        <div>
                            <label className={fieldLabel}>Số khách</label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream-300 bg-cream-100 text-cream-500 hover:bg-cream-200">−</button>
                                <span className="font-mono text-lg font-bold text-green-900 w-8 text-center">{guestCount}</span>
                                <button onClick={() => setGuestCount(guestCount + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream-300 bg-cream-100 text-cream-500 hover:bg-cream-200">+</button>
                            </div>
                        </div>
                    </div>

                    {/* Time Slots */}
                    <div>
                        <label className={fieldLabel}>Giờ</label>
                        <div className="flex flex-wrap gap-1.5">
                            {timeSlots.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTime(t)}
                                    className={cn(
                                        "rounded-lg px-3 py-1.5 text-xs font-mono font-medium transition-all",
                                        time === t
                                            ? "bg-green-900 text-cream-50"
                                            : "bg-cream-100 text-cream-500 border border-cream-300 hover:border-green-600"
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Zone + Source */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Khu vực ưa thích</label>
                            <select
                                value={zone}
                                onChange={(e) => setZone(e.target.value)}
                                className="h-9 w-full rounded-md border border-cream-300 bg-white px-3 text-xs text-green-900"
                            >
                                <option value="">Bất kỳ</option>
                                {zones.map((z) => (
                                    <option key={z.id} value={z.name}>{z.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={fieldLabel}>Nguồn</label>
                            <div className="flex gap-1">
                                {(["PHONE", "WALK_IN", "WEBSITE", "ZALO"] as const).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setSource(s)}
                                        className={cn(
                                            "rounded-md px-2 py-1 text-[10px] font-medium transition-all",
                                            source === s ? "bg-green-900 text-cream-50" : "bg-cream-100 text-cream-500 border border-cream-300"
                                        )}
                                    >
                                        {SOURCE_LABELS[s].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={fieldLabel}>Ghi chú</label>
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VIP, quen, lần đầu..." className="h-9 text-xs border-cream-300" />
                    </div>
                    <div>
                        <label className={fieldLabel}>Yêu cầu đặc biệt</label>
                        <Input value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Pre-order, high chair, trang trí sinh nhật..." className="h-9 text-xs border-cream-300" />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-cream-200 bg-cream-50 rounded-b-2xl">
                    <Button onClick={onClose} variant="outline" size="sm" className="border-cream-300 text-cream-500">Hủy</Button>
                    <Button onClick={handleSubmit} disabled={submitting} size="sm" className="bg-green-900 text-white hover:bg-green-800">
                        <CalendarDays className="mr-1 h-3 w-3" /> {submitting ? "Đang lưu..." : "Đặt bàn"}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// ASSIGN TABLE MODAL
// ============================================================
function AssignTableModal({
    reservationId,
    reservation,
    onClose,
    onAssigned,
    zones,
    tables,
}: {
    reservationId: string
    reservation: Reservation
    onClose: () => void
    onAssigned: () => void
    zones: Awaited<ReturnType<typeof getZones>>
    tables: Awaited<ReturnType<typeof getTables>>
}) {
    const [selectedZone, setSelectedZone] = useState(zones[0]?.id ?? "")

    const filteredTables = tables.filter(
        (t) => t.zoneId === selectedZone && t.isActive && t.status === "AVAILABLE" && t.seats >= reservation.guestCount
    )

    const handleAssign = async (tableId: string, tableNumber: string) => {
        const result = await assignTableToReservation(reservationId, tableId, tableNumber)
        if (result.success) onAssigned()
        else toast.error(result.error ?? "Lỗi")
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[500px] max-h-[70vh] rounded-2xl border border-cream-200 bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                    <div>
                        <h2 className="text-lg font-bold text-green-900">Xếp bàn</h2>
                        <p className="text-xs text-cream-500">{reservation.customerName} · {reservation.guestCount} khách · {reservation.time}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100"><X className="h-4 w-4 text-cream-400" /></button>
                </div>

                {/* Zone tabs */}
                <div className="flex gap-1 border-b border-cream-200 px-4 py-2">
                    {zones.map((z) => (
                        <button
                            key={z.id}
                            onClick={() => setSelectedZone(z.id)}
                            className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                                selectedZone === z.id ? "bg-green-900 text-cream-50" : "text-cream-500 hover:bg-cream-200"
                            )}
                        >
                            {z.name}
                        </button>
                    ))}
                </div>

                {/* Tables */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto">
                    {filteredTables.length > 0 ? filteredTables.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => handleAssign(t.id, t.tableNumber)}
                            className="flex flex-col items-center rounded-xl border-2 border-green-300 bg-green-50 p-4 hover:bg-green-100 hover:border-green-600 transition-all cursor-pointer"
                        >
                            <span className="font-display text-lg font-bold text-green-900">{t.tableNumber}</span>
                            <span className="text-[10px] text-cream-500">{t.seats} chỗ</span>
                        </button>
                    )) : (
                        <p className="col-span-3 text-center text-xs text-cream-400 py-8">
                            Không có bàn trống phù hợp ({reservation.guestCount}+ chỗ)
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
