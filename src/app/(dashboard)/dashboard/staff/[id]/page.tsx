"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Shield, Award, Wine, ChefHat, Martini, HandPlatter, Users, TrendingUp, CalendarDays, Timer, DollarSign, BarChart3, ShoppingBag, CheckCircle2, AlertCircle, UserX, Palmtree } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    getStaffById,
    getStaffShiftHistory,
    getStaffPerformance,
    type StaffRole,
} from "@/actions/staff"
import {
    getStaffAttendance,
    getAttendanceSummary,
    type AttendanceRecord,
} from "@/actions/attendance"
import { ROLE_LABELS } from "@/lib/staff-constants"

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(Math.round(amount))
}

function formatCompact(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`
    return String(Math.round(amount))
}

const ROLE_ICONS: Record<string, typeof Wine> = {
    OWNER: Wine,
    MANAGER: Shield,
    BARTENDER: Martini,
    CASHIER: Award,
    WAITER: HandPlatter,
    KITCHEN: ChefHat,
}

const ROLE_COLORS: Record<string, string> = {
    OWNER: "bg-wine-100 text-wine-700 border-wine-300",
    MANAGER: "bg-blue-100 text-blue-700 border-blue-300",
    BARTENDER: "bg-amber-100 text-amber-700 border-amber-300",
    CASHIER: "bg-teal-100 text-teal-700 border-teal-300",
    WAITER: "bg-green-100 text-green-700 border-green-300",
    KITCHEN: "bg-orange-100 text-orange-700 border-orange-300",
}

const ATT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PRESENT: { label: "Có mặt", color: "text-green-700 bg-green-100" },
    LATE: { label: "Đi muộn", color: "text-amber-700 bg-amber-100" },
    ABSENT: { label: "Vắng", color: "text-red-700 bg-red-100" },
    LEAVE: { label: "Nghỉ phép", color: "text-blue-700 bg-blue-100" },
}

type TabKey = "overview" | "attendance" | "shifts" | "performance"

type StaffDetail = NonNullable<Awaited<ReturnType<typeof getStaffById>>>
type ShiftHistory = Awaited<ReturnType<typeof getStaffShiftHistory>>
type Performance = Awaited<ReturnType<typeof getStaffPerformance>>
type AttSummary = Awaited<ReturnType<typeof getAttendanceSummary>>

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [staff, setStaff] = useState<StaffDetail | null>(null)
    const [activeTab, setActiveTab] = useState<TabKey>("overview")
    const [shifts, setShifts] = useState<ShiftHistory>([])
    const [performance, setPerformance] = useState<Performance | null>(null)
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
    const [attSummary, setAttSummary] = useState<AttSummary | null>(null)
    const [loading, setLoading] = useState(true)

    const loadData = useCallback(async () => {
        setLoading(true)
        const [staffData, shiftData, perfData, attData, attSum] = await Promise.all([
            getStaffById(id),
            getStaffShiftHistory(id),
            getStaffPerformance(id),
            getStaffAttendance(id),
            getAttendanceSummary(id),
        ])
        setStaff(staffData)
        setShifts(shiftData)
        setPerformance(perfData)
        setAttendance(attData)
        setAttSummary(attSum)
        setLoading(false)
    }, [id])

    useEffect(() => { loadData() }, [loadData])

    if (loading) {
        return (
            <div className="min-h-screen bg-cream-50 flex items-center justify-center">
                <div className="animate-pulse text-cream-400">Đang tải...</div>
            </div>
        )
    }

    if (!staff) {
        return (
            <div className="min-h-screen bg-cream-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-cream-500">Không tìm thấy nhân viên</p>
                    <button onClick={() => router.push("/dashboard/staff")} className="mt-3 text-sm text-green-700 hover:underline">
                        ← Quay lại
                    </button>
                </div>
            </div>
        )
    }

    const RoleIcon = ROLE_ICONS[staff.role] ?? Users

    const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
        { key: "overview", label: "Tổng quan", icon: BarChart3 },
        { key: "attendance", label: "Chấm công", icon: CalendarDays },
        { key: "shifts", label: "Lịch sử ca", icon: Timer },
        { key: "performance", label: "Hiệu suất", icon: TrendingUp },
    ]

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6">
            {/* Back + Header */}
            <button
                onClick={() => router.push("/dashboard/staff")}
                className="flex items-center gap-1.5 text-xs text-cream-500 hover:text-green-900 mb-4 transition-colors"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> Quay lại danh sách
            </button>

            {/* Profile Header */}
            <div className="rounded-xl border border-cream-300 bg-cream-100 p-6 mb-6">
                <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-900 text-cream-50 font-display font-bold text-xl shrink-0">
                        {staff.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </div>
                    {/* Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">{staff.fullName}</h1>
                            <span className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                                ROLE_COLORS[staff.role]
                            )}>
                                {ROLE_LABELS[staff.role as StaffRole]}
                            </span>
                            <span className={cn(
                                "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                                staff.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                                {staff.status === "ACTIVE" ? "Đang làm" : "Nghỉ việc"}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-cream-500">
                            {staff.phone && (
                                <span className="flex items-center gap-1">{staff.phone}</span>
                            )}
                            {staff.email && (
                                <span className="flex items-center gap-1">{staff.email}</span>
                            )}
                            <span className="flex items-center gap-1">
                                Từ {staff.createdAt.toLocaleDateString("vi-VN")}
                            </span>
                        </div>
                    </div>
                    {/* Quick stats */}
                    <div className="flex gap-3 shrink-0">
                        {[
                            { label: "Đơn hàng", value: staff.totalOrders, icon: ShoppingBag, color: "text-green-900" },
                            { label: "Doanh thu", value: `₫${formatCompact(staff.totalRevenue)}`, icon: TrendingUp, color: "text-wine-700" },
                            { label: "Lương", value: `₫${formatCompact(staff.baseSalary)}`, icon: DollarSign, color: "text-green-700" },
                        ].map((stat) => {
                            return (
                                <div key={stat.label} className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-center min-w-[100px]">
                                    <p className={cn("font-mono text-lg font-bold", stat.color)}>{stat.value}</p>
                                    <p className="text-[8px] text-cream-400">{stat.label}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-5 border-b border-cream-200">
                {tabs.map((tab) => {
                    const TIcon = tab.icon
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px",
                                activeTab === tab.key
                                    ? "border-green-700 text-green-900"
                                    : "border-transparent text-cream-400 hover:text-cream-600"
                            )}
                        >
                            <TIcon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* ============ TAB: OVERVIEW ============ */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {/* Left — Attendance Summary */}
                    <div className="space-y-4">
                        <div className="rounded-xl border border-cream-300 bg-cream-100 p-5">
                            <h3 className="text-[10px] font-bold text-cream-400 uppercase mb-3 flex items-center gap-1.5">
                                Chấm công tháng này
                            </h3>
                            {attSummary && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-green-50 p-3 text-center">
                                        <p className="font-mono text-2xl font-bold text-green-700">{attSummary.present}</p>
                                        <p className="text-[9px] text-green-600">Ngày có mặt</p>
                                    </div>
                                    <div className="rounded-lg bg-red-50 p-3 text-center">
                                        <p className="font-mono text-2xl font-bold text-red-600">{attSummary.absent}</p>
                                        <p className="text-[9px] text-red-500">Ngày vắng</p>
                                    </div>
                                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                                        <p className="font-mono text-2xl font-bold text-blue-600">{attSummary.leave}</p>
                                        <p className="text-[9px] text-blue-500">Nghỉ phép</p>
                                    </div>
                                    <div className="rounded-lg bg-cream-50 p-3 text-center">
                                        <p className="font-mono text-2xl font-bold text-cream-700">{attSummary.totalHours.toFixed(1)}h</p>
                                        <p className="text-[9px] text-cream-400">Tổng giờ làm</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center — Performance */}
                    <div className="space-y-4">
                        <div className="rounded-xl border border-cream-300 bg-cream-100 p-5">
                            <h3 className="text-[10px] font-bold text-cream-400 uppercase mb-3 flex items-center gap-1.5">
                                Hiệu suất 30 ngày
                            </h3>
                            {performance && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-cream-50 p-3 text-center">
                                            <p className="font-mono text-xl font-bold text-green-900">{performance.totalOrders}</p>
                                            <p className="text-[9px] text-cream-400">Đơn hàng</p>
                                        </div>
                                        <div className="rounded-lg bg-cream-50 p-3 text-center">
                                            <p className="font-mono text-xl font-bold text-wine-700">₫{formatCompact(performance.totalRevenue)}</p>
                                            <p className="text-[9px] text-cream-400">Doanh thu</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-cream-50 p-3 text-center">
                                            <p className="font-mono text-lg font-bold text-cream-700">{performance.totalItems}</p>
                                            <p className="text-[9px] text-cream-400">Sản phẩm bán</p>
                                        </div>
                                        <div className="rounded-lg bg-cream-50 p-3 text-center">
                                            <p className="font-mono text-lg font-bold text-cream-700">₫{formatCompact(performance.avgOrderValue)}</p>
                                            <p className="text-[9px] text-cream-400">Trung bình/đơn</p>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-green-50 p-3 text-center">
                                        <p className="font-mono text-lg font-bold text-green-700">{performance.daysActive} / 30</p>
                                        <p className="text-[9px] text-green-600">Ngày có doanh thu</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right — Recent shifts */}
                    <div className="space-y-4">
                        <div className="rounded-xl border border-cream-300 bg-cream-100 p-5">
                            <h3 className="text-[10px] font-bold text-cream-400 uppercase mb-3 flex items-center gap-1.5">
                                Ca gần đây
                            </h3>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {shifts.length === 0 && <p className="text-xs text-cream-400 text-center py-4">Chưa có ca nào</p>}
                                {shifts.slice(0, 8).map((shift) => (
                                    <div key={shift.id} className="flex items-center justify-between rounded-lg bg-cream-50 px-3 py-2 text-[10px]">
                                        <div>
                                            <p className="font-mono text-cream-600">
                                                {new Date(shift.openedAt).toLocaleDateString("vi-VN")}
                                            </p>
                                            <p className="text-cream-400">
                                                {new Date(shift.openedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                                {shift.closedAt && ` → ${new Date(shift.closedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            {shift.totalRevenue != null && (
                                                <p className="font-mono font-bold text-green-700">₫{formatCompact(shift.totalRevenue)}</p>
                                            )}
                                            {shift.duration && <p className="text-cream-400">{shift.duration}h</p>}
                                        </div>
                                        <span className={cn(
                                            "rounded-full px-2 py-0.5 text-[8px] font-bold",
                                            shift.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-cream-200 text-cream-500"
                                        )}>
                                            {shift.status === "OPEN" ? "Đang mở" : "Đã đóng"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ TAB: ATTENDANCE ============ */}
            {activeTab === "attendance" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    <div className="col-span-2">
                        <div className="rounded-xl border border-cream-300 bg-cream-100 overflow-x-auto">
                            <div className="px-5 py-3 border-b border-cream-200 bg-cream-50">
                                <h3 className="text-xs font-bold text-green-900 uppercase flex items-center gap-1.5">
                                    Lịch sử chấm công
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-cream-200 bg-cream-50/50">
                                            <th className="px-4 py-2 text-left font-medium text-cream-400">Ngày</th>
                                            <th className="px-4 py-2 text-center font-medium text-cream-400">Giờ vào</th>
                                            <th className="px-4 py-2 text-center font-medium text-cream-400">Giờ ra</th>
                                            <th className="px-4 py-2 text-center font-medium text-cream-400">Giờ làm</th>
                                            <th className="px-4 py-2 text-center font-medium text-cream-400">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-cream-100">
                                        {attendance.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-cream-400">
                                                    Chưa có dữ liệu chấm công
                                                </td>
                                            </tr>
                                        )}
                                        {attendance.map((rec) => {
                                            const cfg = ATT_STATUS_CONFIG[rec.status]
                                            return (
                                                <tr key={rec.id} className="hover:bg-cream-50/50 transition-colors">
                                                    <td className="px-4 py-2.5 font-mono text-cream-700">{rec.date}</td>
                                                    <td className="px-4 py-2.5 text-center font-mono text-green-700">{rec.checkIn ?? "—"}</td>
                                                    <td className="px-4 py-2.5 text-center font-mono text-wine-600">{rec.checkOut ?? "—"}</td>
                                                    <td className="px-4 py-2.5 text-center font-mono text-cream-600">
                                                        {rec.hoursWorked != null ? `${rec.hoursWorked}h` : "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", cfg?.color ?? "bg-cream-200 text-cream-500")}>
                                                            {cfg?.label ?? rec.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div>
                        {attSummary && (
                            <div className="rounded-xl border border-cream-300 bg-cream-100 p-5">
                                <h3 className="text-[10px] font-bold text-cream-400 uppercase mb-3">Tổng kết tháng</h3>
                                <div className="space-y-2">
                                    {[
                                        { label: "Có mặt", value: attSummary.present, color: "text-green-700", icon: CheckCircle2 },
                                        { label: "Vắng", value: attSummary.absent, color: "text-red-600", icon: UserX },
                                        { label: "Nghỉ phép", value: attSummary.leave, color: "text-blue-600", icon: Palmtree },
                                        { label: "Đi muộn", value: attSummary.late, color: "text-amber-600", icon: AlertCircle },
                                    ].map((item) => {
                                        return (
                                            <div key={item.label} className="flex items-center justify-between rounded-lg bg-cream-50 px-3 py-2">
                                                <span className="flex items-center gap-1.5 text-[10px] text-cream-500">
                                                    {item.label}
                                                </span>
                                                <span className={cn("font-mono text-sm font-bold", item.color)}>{item.value}</span>
                                            </div>
                                        )
                                    })}
                                    <div className="rounded-lg bg-green-50 px-3 py-3 text-center mt-3">
                                        <p className="font-mono text-2xl font-bold text-green-700">{attSummary.totalHours.toFixed(1)}h</p>
                                        <p className="text-[9px] text-green-600">Tổng giờ làm</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============ TAB: SHIFTS ============ */}
            {activeTab === "shifts" && (
                <div className="rounded-xl border border-cream-300 bg-cream-100 overflow-x-auto">
                    <div className="px-5 py-3 border-b border-cream-200 bg-cream-50">
                        <h3 className="text-xs font-bold text-green-900 uppercase flex items-center gap-1.5">
                            Lịch sử ca làm ({shifts.length} ca)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-cream-200 bg-cream-50/50">
                                    <th className="px-4 py-2 text-left font-medium text-cream-400">Ngày</th>
                                    <th className="px-4 py-2 text-center font-medium text-cream-400">Mở ca</th>
                                    <th className="px-4 py-2 text-center font-medium text-cream-400">Đóng ca</th>
                                    <th className="px-4 py-2 text-center font-medium text-cream-400">Thời gian</th>
                                    <th className="px-4 py-2 text-right font-medium text-cream-400">Tiền mở</th>
                                    <th className="px-4 py-2 text-right font-medium text-cream-400">Tiền đóng</th>
                                    <th className="px-4 py-2 text-right font-medium text-cream-400">Chênh lệch</th>
                                    <th className="px-4 py-2 text-right font-medium text-cream-400">Doanh thu</th>
                                    <th className="px-4 py-2 text-center font-medium text-cream-400">TT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-100">
                                {shifts.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-cream-400">
                                            Chưa có lịch sử ca
                                        </td>
                                    </tr>
                                )}
                                {shifts.map((shift) => (
                                    <tr key={shift.id} className="hover:bg-cream-50/50 transition-colors">
                                        <td className="px-4 py-2.5 font-mono text-cream-700">
                                            {new Date(shift.openedAt).toLocaleDateString("vi-VN")}
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-mono text-green-700">
                                            {new Date(shift.openedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-mono text-wine-600">
                                            {shift.closedAt
                                                ? new Date(shift.closedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-mono text-cream-600">
                                            {shift.duration ? `${shift.duration}h` : "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-cream-600">
                                            ₫{formatPrice(shift.openingCash)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-cream-600">
                                            {shift.closingCash != null ? `₫${formatPrice(shift.closingCash)}` : "—"}
                                        </td>
                                        <td className={cn(
                                            "px-4 py-2.5 text-right font-mono font-bold",
                                            shift.variance != null && shift.variance < 0 ? "text-red-600" : "text-green-700"
                                        )}>
                                            {shift.variance != null ? `${shift.variance >= 0 ? "+" : ""}₫${formatPrice(shift.variance)}` : "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-green-900">
                                            {shift.totalRevenue != null ? `₫${formatPrice(shift.totalRevenue)}` : "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={cn(
                                                "rounded-full px-2 py-0.5 text-[8px] font-bold",
                                                shift.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-cream-200 text-cream-500"
                                            )}>
                                                {shift.status === "OPEN" ? "Mở" : "Đóng"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ============ TAB: PERFORMANCE ============ */}
            {activeTab === "performance" && performance && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
                    {[
                        { label: "Đơn hàng (30 ngày)", value: performance.totalOrders, color: "text-green-900" },
                        { label: "Doanh thu (30 ngày)", value: `₫${formatCompact(performance.totalRevenue)}`, color: "text-wine-700" },
                        { label: "TB/đơn", value: `₫${formatCompact(performance.avgOrderValue)}`, color: "text-green-700" },
                        { label: "Ngày có doanh thu", value: `${performance.daysActive}/30`, color: "text-blue-700" },
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-cream-300 bg-cream-100 p-5 text-center">
                            <p className={cn("font-mono text-2xl font-bold", stat.color)}>{stat.value}</p>
                            <p className="text-[9px] text-cream-400 mt-1">{stat.label}</p>
                        </div>
                    ))}

                    {/* Daily breakdown table */}
                    <div className="col-span-4 rounded-xl border border-cream-300 bg-cream-100 overflow-x-auto">
                        <div className="px-5 py-3 border-b border-cream-200 bg-cream-50">
                            <h3 className="text-xs font-bold text-green-900 uppercase flex items-center gap-1.5">
                                Chi tiết theo ngày
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-cream-200 bg-cream-50/50">
                                        <th className="px-4 py-2 text-left font-medium text-cream-400">Ngày</th>
                                        <th className="px-4 py-2 text-center font-medium text-cream-400">Đơn hàng</th>
                                        <th className="px-4 py-2 text-center font-medium text-cream-400">Sản phẩm</th>
                                        <th className="px-4 py-2 text-right font-medium text-cream-400">Doanh thu</th>
                                        <th className="px-4 py-2 text-right font-medium text-cream-400">TB/đơn</th>
                                        <th className="px-4 py-2 w-[200px] font-medium text-cream-400">Tiến trình</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream-100">
                                    {performance.dailyData.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-cream-400">Chưa có dữ liệu</td>
                                        </tr>
                                    )}
                                    {performance.dailyData.map((day) => {
                                        const maxRev = Math.max(...performance.dailyData.map((d) => d.revenue))
                                        const pct = maxRev > 0 ? (day.revenue / maxRev) * 100 : 0
                                        return (
                                            <tr key={day.date} className="hover:bg-cream-50/50 transition-colors">
                                                <td className="px-4 py-2 font-mono text-cream-700">{day.date}</td>
                                                <td className="px-4 py-2 text-center font-mono text-green-900 font-bold">{day.orders}</td>
                                                <td className="px-4 py-2 text-center font-mono text-cream-600">{day.items}</td>
                                                <td className="px-4 py-2 text-right font-mono text-wine-700 font-bold">₫{formatPrice(day.revenue)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-cream-500">₫{formatCompact(day.orders > 0 ? day.revenue / day.orders : 0)}</td>
                                                <td className="px-4 py-2">
                                                    <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                                                        <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
