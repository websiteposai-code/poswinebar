"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Users, UserPlus, Search, Shield, Phone, Mail, Clock, Award, X, KeyRound, UserCheck, UserX, Palmtree, RefreshCcw, Wine, ChefHat, Martini, HandPlatter, LogIn, LogOut, CalendarDays, Download, Timer, CheckCircle2, AlertCircle, Wallet, Calendar, ChevronLeft, ChevronRight, Copy, Plus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    getStaffList,
    createStaff,
    updateStaff,
    updateStaffStatus,
    resetStaffPin,
    type Staff,
    type StaffRole,
    type StaffStatus,
} from "@/actions/staff"
import {
    checkIn,
    checkOut,
    getTodayAttendance,
    getStaffAttendance,
    getAttendanceSummary,
    markAbsent,
    markLeave,
    type AttendanceRecord,
} from "@/actions/attendance"
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/staff-constants"
import { DashboardInlineSkeleton } from "@/components/inline-skeletons"
import {
    calculatePayroll,
    exportPayrollCSV,
    type PayrollRecord,
} from "@/actions/payroll"
import {
    getWeekSchedule,
    assignShift,
    removeShift,
    copyWeekSchedule,
    type ScheduleEntry,
} from "@/actions/schedule"
import { SHIFT_TYPES } from "@/lib/shift-types"

function formatCompact(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`
    return String(amount)
}

const ROLE_ICONS: Record<StaffRole, typeof Wine> = {
    OWNER: Wine,
    MANAGER: Shield,
    BARTENDER: Martini,
    CASHIER: Award,
    WAITER: HandPlatter,
    KITCHEN: ChefHat,
}

const ROLE_COLORS: Record<StaffRole, string> = {
    OWNER: "bg-wine-100 text-wine-700 border-wine-300",
    MANAGER: "bg-blue-100 text-blue-700 border-blue-300",
    BARTENDER: "bg-amber-100 text-amber-700 border-amber-300",
    CASHIER: "bg-teal-100 text-teal-700 border-teal-300",
    WAITER: "bg-green-100 text-green-700 border-green-300",
    KITCHEN: "bg-orange-100 text-orange-700 border-orange-300",
}

const STATUS_COLORS: Record<StaffStatus, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    INACTIVE: "bg-red-100 text-red-700",
    ON_LEAVE: "bg-amber-100 text-amber-700",
}

const ATT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    PRESENT: { label: "Có mặt", color: "text-green-700 bg-green-100", icon: CheckCircle2 },
    LATE: { label: "Đi muộn", color: "text-amber-700 bg-amber-100", icon: AlertCircle },
    ABSENT: { label: "Vắng", color: "text-red-700 bg-red-100", icon: UserX },
    LEAVE: { label: "Nghỉ phép", color: "text-blue-700 bg-blue-100", icon: Palmtree },
}

type TabKey = "list" | "attendance" | "payroll" | "schedule"

const SHIFT_COLORS: Record<string, string> = {
    MORNING: "bg-amber-100 text-amber-700 border-amber-300",
    AFTERNOON: "bg-blue-100 text-blue-700 border-blue-300",
    EVENING: "bg-wine-100 text-wine-700 border-wine-300",
    FULL: "bg-green-100 text-green-700 border-green-300",
}

export type StaffInitialData = { list: Staff[]; attendance: AttendanceRecord[] }

export function StaffClient({ initialData }: { initialData: StaffInitialData }) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<TabKey>("list")
    const [staffList, setStaffList] = useState<Staff[]>(initialData.list)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [roleFilter, setRoleFilter] = useState<StaffRole | "ALL">("ALL")
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
    const [showPinReset, setShowPinReset] = useState<string | null>(null)
    const [newPin, setNewPin] = useState("")

    // Attendance state
    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>(initialData.attendance)
    const [attDetailStaff, setAttDetailStaff] = useState<string | null>(null)
    const [attHistory, setAttHistory] = useState<AttendanceRecord[]>([])
    const [attSummary, setAttSummary] = useState<{ present: number; absent: number; leave: number; late: number; totalHours: number; totalDays: number } | null>(null)

    // Payroll state
    const [payrollData, setPayrollData] = useState<{ records: PayrollRecord[]; totalPayroll: number; totalBonus: number; totalStaff: number; monthLabel: string } | null>(null)
    const [payrollLoading, setPayrollLoading] = useState(false)

    // Schedule state
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0); return d.toISOString().split("T")[0]
    })
    const [weekSchedule, setWeekSchedule] = useState<ScheduleEntry[]>([])
    const [showAssignModal, setShowAssignModal] = useState<{ staffId: string; date: string } | null>(null)
    const [assignType, setAssignType] = useState("FULL")

    const loadStaff = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getStaffList()
            setStaffList(data)
        } catch (err) {
            console.error("[Staff] loadStaff failed:", err)
            toast.error("Không thể tải danh sách nhân viên")
        }
        setLoading(false)
    }, [])

    const loadAttendance = useCallback(async () => {
        try {
            const data = await getTodayAttendance()
            setTodayAttendance(data)
        } catch (err) {
            console.error("[Staff] loadAttendance failed:", err)
        }
    }, [])

    const filtered = staffList.filter((s) => {
        const matchSearch =
            !searchTerm ||
            s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.email ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.phone ?? "").includes(searchTerm)
        const matchRole = roleFilter === "ALL" || s.role === roleFilter
        return matchSearch && matchRole
    })

    const stats = {
        total: staffList.length,
        active: staffList.filter((s) => s.status === "ACTIVE").length,
        onLeave: staffList.filter((s) => s.status === "ON_LEAVE").length,
        checkedIn: todayAttendance.filter((a) => a.checkIn && !a.checkOut).length,
    }

    const handleStatusChange = async (id: string, status: StaffStatus) => {
        const result = await updateStaffStatus(id, status)
        if (result.success) {
            toast.success("Cập nhật trạng thái thành công")
            loadStaff()
            setSelectedStaff(null)
        }
    }

    const handlePinReset = async () => {
        if (!showPinReset) return
        const result = await resetStaffPin(showPinReset, newPin)
        if (result.success) {
            toast.success("Đặt lại PIN thành công")
            setShowPinReset(null)
            setNewPin("")
        } else {
            toast.error(result.error ?? "Lỗi")
        }
    }

    const handleCheckIn = async (staffId: string) => {
        const result = await checkIn(staffId)
        if (result.success) {
            toast.success("Chấm công vào thành công")
            loadAttendance()
        } else {
            toast.error(result.error ?? "Lỗi")
        }
    }

    const handleCheckOut = async (staffId: string) => {
        const result = await checkOut(staffId)
        if (result.success) {
            toast.success(`Chấm công ra — ${result.hoursWorked}h`)
            loadAttendance()
        } else {
            toast.error(result.error ?? "Lỗi")
        }
    }

    const handleMarkAbsent = async (staffId: string) => {
        const result = await markAbsent(staffId)
        if (result.success) {
            toast.success("Đã đánh dấu vắng")
            loadAttendance()
        }
    }

    const handleMarkLeave = async (staffId: string) => {
        const result = await markLeave(staffId)
        if (result.success) {
            toast.success("Đã đánh dấu nghỉ phép")
            loadAttendance()
        }
    }

    const loadAttDetail = async (staffId: string) => {
        setAttDetailStaff(staffId)
        const [history, summary] = await Promise.all([
            getStaffAttendance(staffId),
            getAttendanceSummary(staffId),
        ])
        setAttHistory(history)
        setAttSummary(summary)
    }

    const exportStaffCSV = () => {
        const bom = "\uFEFF"
        const header = "Họ tên,Vai trò,SĐT,Email,Trạng thái,Lương cơ bản,Đơn hàng,Doanh thu\n"
        const rows = staffList.map((s) =>
            `"${s.fullName}","${ROLE_LABELS[s.role as StaffRole]}","${s.phone ?? ""}","${s.email ?? ""}","${STATUS_LABELS[s.status as StaffStatus]}",${s.baseSalary},${s.totalOrders ?? 0},${s.totalRevenue ?? 0}`
        ).join("\n")
        const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `nhan-su-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Đã xuất file CSV")
    }

    const loadPayroll = useCallback(async () => {
        setPayrollLoading(true)
        const data = await calculatePayroll()
        setPayrollData(data)
        setPayrollLoading(false)
    }, [])

    const loadSchedule = useCallback(async () => {
        const data = await getWeekSchedule(weekStart)
        setWeekSchedule(data)
    }, [weekStart])

    useEffect(() => {
        if (activeTab === "payroll" && !payrollData) loadPayroll()
    }, [activeTab, payrollData, loadPayroll])

    useEffect(() => {
        if (activeTab === "schedule") loadSchedule()
    }, [activeTab, loadSchedule])

    const getWeekDays = () => {
        const days = []
        const start = new Date(weekStart)
        for (let i = 0; i < 7; i++) {
            const d = new Date(start)
            d.setDate(d.getDate() + i)
            days.push(d.toISOString().split("T")[0])
        }
        return days
    }

    const shiftWeek = (dir: number) => {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + dir * 7)
        setWeekStart(d.toISOString().split("T")[0])
    }

    const handleAssignShift = async () => {
        if (!showAssignModal) return
        const result = await assignShift({ staffId: showAssignModal.staffId, date: showAssignModal.date, shiftType: assignType })
        if (result.success) {
            toast.success("Đã gán ca")
            setShowAssignModal(null)
            loadSchedule()
        }
    }

    const handleRemoveShift = async (staffId: string, date: string) => {
        const result = await removeShift(staffId, date)
        if (result.success) {
            toast.success("Đã xoá lịch ca")
            loadSchedule()
        }
    }

    const handleCopyWeek = async () => {
        const nextWeek = new Date(weekStart)
        nextWeek.setDate(nextWeek.getDate() + 7)
        const result = await copyWeekSchedule(weekStart, nextWeek.toISOString().split("T")[0])
        if (result.success) {
            toast.success(`Đã sao chép ${result.count} lịch ca sang tuần sau`)
        } else {
            toast.error(result.error ?? "Lỗi")
        }
    }

    const handleExportPayroll = async () => {
        const csv = await exportPayrollCSV()
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `bang-luong-${payrollData?.monthLabel ?? "thang"}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Đã xuất bảng lương CSV")
    }

    const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
        { key: "list", label: "Danh sách", icon: Users },
        { key: "attendance", label: "Chấm công", icon: CalendarDays },
        { key: "payroll", label: "Bảng lương", icon: Wallet },
        { key: "schedule", label: "Lịch ca", icon: Calendar },
    ]

    if (loading && staffList.length === 0) {
        return <DashboardInlineSkeleton />
    }

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Nhân sự</h1>
                        <p className="text-sm text-cream-500">Quản lý nhân viên Noon & Noir</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={exportStaffCSV}
                        className="border-cream-300 text-cream-500 hover:bg-cream-100"
                        size="sm"
                    >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Xuất CSV
                    </Button>
                    <Button
                        onClick={() => setShowAddModal(true)}
                        className="bg-green-900 text-cream-50 hover:bg-green-800"
                    >
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        Thêm nhân viên
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
                {[
                    { label: "Tổng nhân viên", value: stats.total, icon: Users, color: "text-green-900" },
                    { label: "Đang làm việc", value: stats.active, icon: UserCheck, color: "text-green-600" },
                    { label: "Nghỉ phép", value: stats.onLeave, icon: Palmtree, color: "text-amber-600" },
                    { label: "Đang trên ca", value: stats.checkedIn, icon: Timer, color: "text-blue-600" },
                ].map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.label} className="rounded-xl border border-cream-300 bg-cream-100 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] text-cream-400">{stat.label}</span>
                            </div>
                            <p className={cn("font-mono text-2xl font-bold", stat.color)}>{stat.value}</p>
                        </div>
                    )
                })}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-5 border-b border-cream-200">
                {tabs.map((tab) => {
                    const Icon = tab.icon
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
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* ============ TAB: DANH SÁCH ============ */}
            {activeTab === "list" && (
                <>
                    {/* Filters */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm tên, email, SĐT..."
                                className="h-9 pl-8 text-xs border-cream-300"
                            />
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setRoleFilter("ALL")}
                                className={cn(
                                    "rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-all",
                                    roleFilter === "ALL" ? "bg-green-900 text-cream-50" : "bg-cream-200 text-cream-500"
                                )}
                            >
                                Tất cả
                            </button>
                            {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setRoleFilter(role)}
                                    className={cn(
                                        "rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-all",
                                        roleFilter === role ? "bg-green-900 text-cream-50" : "bg-cream-200 text-cream-500"
                                    )}
                                >
                                    {ROLE_LABELS[role]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Staff Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                        {filtered.map((staff) => {
                            const RoleIcon = ROLE_ICONS[staff.role as StaffRole]
                            const isSelected = selectedStaff?.id === staff.id
                            const todayAtt = todayAttendance.find((a) => a.staffId === staff.id)
                            return (
                                <button
                                    key={staff.id}
                                    onClick={() => setSelectedStaff(isSelected ? null : staff)}
                                    onDoubleClick={() => router.push(`/dashboard/staff/${staff.id}`)}
                                    className={cn(
                                        "rounded-xl border bg-cream-100 p-4 text-left transition-all hover:shadow-md",
                                        isSelected
                                            ? "border-green-700 ring-2 ring-green-200"
                                            : "border-cream-300"
                                    )}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-900 text-cream-50 font-display font-bold text-sm">
                                                {staff.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-green-900">{staff.fullName}</p>
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium mt-0.5",
                                                    ROLE_COLORS[staff.role as StaffRole]
                                                )}>
                                                    {RoleIcon && <RoleIcon className="h-2.5 w-2.5" />}
                                                    {ROLE_LABELS[staff.role as StaffRole]}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={cn(
                                                "rounded-full px-2 py-0.5 text-[9px] font-bold",
                                                STATUS_COLORS[staff.status as StaffStatus]
                                            )}>
                                                {STATUS_LABELS[staff.status as StaffStatus]}
                                            </span>
                                            {todayAtt?.checkIn && (
                                                <span className="text-[8px] text-green-600 font-mono">
                                                    {todayAtt.checkIn}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact */}
                                    <div className="space-y-1 mb-3">
                                        <p className="flex items-center gap-1.5 text-[10px] text-cream-500">
                                            <Phone className="h-3 w-3" /> {staff.phone ?? "—"}
                                        </p>
                                        <p className="flex items-center gap-1.5 text-[10px] text-cream-500">
                                            <Mail className="h-3 w-3" /> {staff.email ?? "—"}
                                        </p>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="rounded-lg bg-cream-50 px-2.5 py-1.5 text-center">
                                            <p className="font-mono text-xs font-bold text-green-900">{staff.totalOrders ?? 0}</p>
                                            <p className="text-[8px] text-cream-400">đơn hàng</p>
                                        </div>
                                        <div className="rounded-lg bg-cream-50 px-2.5 py-1.5 text-center">
                                            <p className="font-mono text-xs font-bold text-wine-700">₫{formatCompact(staff.totalRevenue ?? 0)}</p>
                                            <p className="text-[8px] text-cream-400">doanh thu</p>
                                        </div>
                                        <div className="rounded-lg bg-cream-50 px-2.5 py-1.5 text-center">
                                            <p className="font-mono text-xs font-bold text-green-700">₫{formatCompact(staff.baseSalary ?? 0)}</p>
                                            <p className="text-[8px] text-cream-400">lương</p>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Empty state */}
                    {filtered.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <p className="text-sm text-cream-400">Không tìm thấy nhân viên</p>
                        </div>
                    )}
                </>
            )}

            {/* ============ TAB: CHẤM CÔNG ============ */}
            {activeTab === "attendance" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {/* Left — Attendance Grid */}
                    <div className="col-span-2">
                        <div className="rounded-xl border border-cream-300 bg-cream-100 overflow-x-auto">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-cream-200 bg-cream-50">
                                <h3 className="text-xs font-bold text-green-900 uppercase flex items-center gap-1.5">
                                    Chấm công hôm nay — {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
                                </h3>
                                <button onClick={loadAttendance} className="text-cream-400 hover:text-green-700 transition-colors">
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <div className="divide-y divide-cream-200">
                                {staffList.filter((s) => s.status === "ACTIVE").map((staff) => {
                                    const att = todayAttendance.find((a) => a.staffId === staff.id)
                                    const attStatus = att?.status ?? "NONE"
                                    const config = ATT_STATUS_CONFIG[attStatus]
                                    return (
                                        <div key={staff.id} className="flex items-center gap-4 px-5 py-3 hover:bg-cream-50/50 transition-all">
                                            {/* Avatar */}
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-900 text-cream-50 font-bold text-xs shrink-0">
                                                {staff.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-green-900 truncate">{staff.fullName}</p>
                                                <span className={cn(
                                                    "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[8px] font-medium",
                                                    ROLE_COLORS[staff.role as StaffRole]
                                                )}>
                                                    {ROLE_LABELS[staff.role as StaffRole]}
                                                </span>
                                            </div>

                                            {/* Attendance time */}
                                            <div className="text-right shrink-0 min-w-[100px]">
                                                {att?.checkIn && (
                                                    <p className="text-[10px] text-green-700 font-mono">
                                                        {att.checkIn}
                                                    </p>
                                                )}
                                                {att?.checkOut && (
                                                    <p className="text-[10px] text-wine-600 font-mono">
                                                        {att.checkOut}
                                                    </p>
                                                )}
                                                {att?.hoursWorked != null && (
                                                    <p className="text-[9px] text-cream-400">{att.hoursWorked}h làm việc</p>
                                                )}
                                            </div>

                                            {/* Status badge */}
                                            <div className="shrink-0 min-w-[70px]">
                                                {config ? (
                                                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", config.color)}>
                                                        {config.label}
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-cream-200 text-cream-500">
                                                        Chưa CC
                                                    </span>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                {!att?.checkIn && attStatus !== "ABSENT" && attStatus !== "LEAVE" && (
                                                    <>
                                                        <button
                                                            onClick={() => handleCheckIn(staff.id)}
                                                            className="rounded-lg bg-green-700 px-2.5 py-1 text-[9px] font-bold text-white hover:bg-green-800 transition-all"
                                                        >
                                                            <LogIn className="inline h-3 w-3 mr-0.5" /> Vào
                                                        </button>
                                                        <button
                                                            onClick={() => handleMarkAbsent(staff.id)}
                                                            className="rounded-lg bg-red-100 px-2 py-1 text-[9px] font-bold text-red-700 hover:bg-red-200 transition-all"
                                                            title="Đánh dấu vắng"
                                                        >
                                                            <UserX className="inline h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleMarkLeave(staff.id)}
                                                            className="rounded-lg bg-blue-100 px-2 py-1 text-[9px] font-bold text-blue-700 hover:bg-blue-200 transition-all"
                                                            title="Đánh dấu nghỉ phép"
                                                        >
                                                            <Palmtree className="inline h-3 w-3" />
                                                        </button>
                                                    </>
                                                )}
                                                {att?.checkIn && !att?.checkOut && (
                                                    <button
                                                        onClick={() => handleCheckOut(staff.id)}
                                                        className="rounded-lg bg-wine-700 px-2.5 py-1 text-[9px] font-bold text-white hover:bg-wine-800 transition-all"
                                                    >
                                                        <LogOut className="inline h-3 w-3 mr-0.5" /> Ra
                                                    </button>
                                                )}
                                                {(att?.checkOut || attStatus === "ABSENT" || attStatus === "LEAVE") && (
                                                    <span className="text-[9px] text-cream-400 italic">Xong ✓</span>
                                                )}
                                                <button
                                                    onClick={() => loadAttDetail(staff.id)}
                                                    className="rounded-lg bg-cream-200 px-2 py-1 text-[9px] font-bold text-cream-600 hover:bg-cream-300 transition-all"
                                                    title="Xem lịch sử"
                                                >
                                                    <Clock className="inline h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right — Summary / Detail */}
                    <div className="space-y-4">
                        {/* Today summary */}
                        <div className="rounded-xl border border-cream-300 bg-cream-100 p-4">
                            <h4 className="text-[10px] font-bold text-cream-400 uppercase mb-3">Tổng kết hôm nay</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
                                    <p className="font-mono text-lg font-bold text-green-700">
                                        {todayAttendance.filter((a) => a.status === "PRESENT").length}
                                    </p>
                                    <p className="text-[8px] text-green-600">Có mặt</p>
                                </div>
                                <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
                                    <p className="font-mono text-lg font-bold text-red-600">
                                        {todayAttendance.filter((a) => a.status === "ABSENT").length}
                                    </p>
                                    <p className="text-[8px] text-red-500">Vắng</p>
                                </div>
                                <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
                                    <p className="font-mono text-lg font-bold text-blue-600">
                                        {todayAttendance.filter((a) => a.status === "LEAVE").length}
                                    </p>
                                    <p className="text-[8px] text-blue-500">Nghỉ phép</p>
                                </div>
                                <div className="rounded-lg bg-cream-50 px-3 py-2 text-center">
                                    <p className="font-mono text-lg font-bold text-cream-600">
                                        {staffList.filter((s) => s.status === "ACTIVE").length - todayAttendance.length}
                                    </p>
                                    <p className="text-[8px] text-cream-400">Chưa CC</p>
                                </div>
                            </div>
                        </div>

                        {/* Staff detail */}
                        {attDetailStaff && attSummary && (
                            <div className="rounded-xl border border-cream-300 bg-cream-100 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200 bg-cream-50">
                                    <h4 className="text-xs font-bold text-green-900">
                                        {staffList.find((s) => s.id === attDetailStaff)?.fullName} — Tháng này
                                    </h4>
                                    <button onClick={() => setAttDetailStaff(null)} className="text-cream-400 hover:text-cream-600">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                                        <div>
                                            <p className="font-mono text-lg font-bold text-green-700">{attSummary.present}</p>
                                            <p className="text-[8px] text-cream-400">Có mặt</p>
                                        </div>
                                        <div>
                                            <p className="font-mono text-lg font-bold text-red-600">{attSummary.absent}</p>
                                            <p className="text-[8px] text-cream-400">Vắng</p>
                                        </div>
                                        <div>
                                            <p className="font-mono text-lg font-bold text-blue-600">{attSummary.leave}</p>
                                            <p className="text-[8px] text-cream-400">Nghỉ phép</p>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-cream-50 px-3 py-2 text-center">
                                        <p className="font-mono text-xl font-bold text-green-900">{attSummary.totalHours.toFixed(1)}h</p>
                                        <p className="text-[9px] text-cream-400">Tổng giờ làm tháng này</p>
                                    </div>
                                    {/* Recent history */}
                                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                        {attHistory.slice(0, 10).map((rec) => {
                                            const cfg = ATT_STATUS_CONFIG[rec.status]
                                            return (
                                                <div key={rec.id} className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-cream-50">
                                                    <span className="font-mono text-cream-500">{rec.date}</span>
                                                    <span className="font-mono text-green-800">
                                                        {rec.checkIn ?? "—"} → {rec.checkOut ?? "—"}
                                                    </span>
                                                    <span className={cn("rounded-full px-1.5 py-0 text-[8px] font-bold", cfg?.color ?? "bg-cream-200 text-cream-500")}>
                                                        {cfg?.label ?? rec.status}
                                                    </span>
                                                    {rec.hoursWorked != null && (
                                                        <span className="font-mono text-cream-400">{rec.hoursWorked}h</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============ TAB: BẢNG LƯƠNG ============ */}
            {activeTab === "payroll" && (
                <div>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                        <h3 className="text-xs font-bold text-green-900 uppercase flex items-center gap-1.5">
                            Bảng lương — {payrollData?.monthLabel ?? "..."}
                        </h3>
                        <Button
                            variant="outline"
                            onClick={handleExportPayroll}
                            size="sm"
                            className="border-cream-300 text-cream-500"
                        >
                            <Download className="mr-1.5 h-3 w-3" /> Xuất CSV
                        </Button>
                    </div>

                    {/* Summary KPIs */}
                    {payrollData && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 mb-4">
                            <div className="rounded-xl border border-cream-300 bg-cream-100 p-4 text-center">
                                <p className="font-mono text-2xl font-bold text-green-900">₫{formatCompact(payrollData.totalPayroll)}</p>
                                <p className="text-[9px] text-cream-400">Tổng quỹ lương</p>
                            </div>
                            <div className="rounded-xl border border-cream-300 bg-cream-100 p-4 text-center">
                                <p className="font-mono text-2xl font-bold text-wine-700">₫{formatCompact(payrollData.totalBonus)}</p>
                                <p className="text-[9px] text-cream-400">Tổng thưởng</p>
                            </div>
                            <div className="rounded-xl border border-cream-300 bg-cream-100 p-4 text-center">
                                <p className="font-mono text-2xl font-bold text-blue-700">{payrollData.totalStaff}</p>
                                <p className="text-[9px] text-cream-400">Nhân viên</p>
                            </div>
                        </div>
                    )}

                    {/* Payroll Table */}
                    <div className="rounded-xl border border-cream-300 bg-cream-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-cream-200 bg-cream-50/50">
                                        <th className="px-3 py-2 text-left font-medium text-cream-400">Nhân viên</th>
                                        <th className="px-3 py-2 text-center font-medium text-cream-400">Vai trò</th>
                                        <th className="px-3 py-2 text-right font-medium text-cream-400">Lương CB</th>
                                        <th className="px-3 py-2 text-center font-medium text-cream-400">Ngày công</th>
                                        <th className="px-3 py-2 text-center font-medium text-cream-400">Giờ làm</th>
                                        <th className="px-3 py-2 text-center font-medium text-cream-400">OT (h)</th>
                                        <th className="px-3 py-2 text-right font-medium text-cream-400">Lương TT</th>
                                        <th className="px-3 py-2 text-right font-medium text-cream-400">Lương OT</th>
                                        <th className="px-3 py-2 text-right font-medium text-cream-400">Thưởng DT</th>
                                        <th className="px-3 py-2 text-right font-medium text-cream-400 text-green-900">Tổng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream-100">
                                    {payrollLoading && (
                                        <tr><td colSpan={10} className="px-4 py-8 text-center text-cream-400">Đang tính lương...</td></tr>
                                    )}
                                    {payrollData?.records.map((rec) => (
                                        <tr key={rec.staffId} className="hover:bg-cream-50/50 transition-colors">
                                            <td className="px-3 py-2 font-bold text-green-900">{rec.staffName}</td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={cn("rounded-full border px-2 py-0.5 text-[8px] font-medium", ROLE_COLORS[rec.role as StaffRole])}>
                                                    {ROLE_LABELS[rec.role as StaffRole]}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-cream-600">₫{formatCompact(rec.baseSalary)}</td>
                                            <td className="px-3 py-2 text-center font-mono text-cream-700">{rec.daysWorked}</td>
                                            <td className="px-3 py-2 text-center font-mono text-cream-700">{rec.totalHours}</td>
                                            <td className="px-3 py-2 text-center font-mono text-amber-600 font-bold">
                                                {rec.overtimeHours > 0 ? rec.overtimeHours : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-cream-700">₫{formatCompact(rec.regularPay)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-amber-700 font-bold">
                                                {rec.overtimePay > 0 ? `₫${formatCompact(rec.overtimePay)}` : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-wine-600 font-bold">
                                                {rec.bonus > 0 ? `₫${formatCompact(rec.bonus)}` : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-green-900 font-bold text-sm">₫{formatCompact(rec.totalPay)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {payrollData && (
                                    <tfoot>
                                        <tr className="border-t-2 border-cream-300 bg-cream-50">
                                            <td colSpan={9} className="px-3 py-3 text-right text-xs font-bold text-green-900 uppercase">Tổng cộng</td>
                                            <td className="px-3 py-3 text-right font-mono text-lg font-bold text-green-900">₫{formatCompact(payrollData.totalPayroll)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ TAB: LỊCH CA ============ */}
            {activeTab === "schedule" && (
                <div>
                    {/* Week navigation */}
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => shiftWeek(-1)} className="rounded-lg p-1.5 hover:bg-cream-200 transition-all">
                                <ChevronLeft className="h-4 w-4 text-cream-500" />
                            </button>
                            <span className="text-sm font-bold text-green-900 min-w-[200px] text-center">
                                {new Date(weekStart).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                                {" — "}
                                {(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) })()}
                            </span>
                            <button onClick={() => shiftWeek(1)} className="rounded-lg p-1.5 hover:bg-cream-200 transition-all">
                                <ChevronRight className="h-4 w-4 text-cream-500" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopyWeek}
                                className="flex items-center gap-1 rounded-lg border border-cream-300 px-3 py-1.5 text-[10px] font-bold text-cream-600 hover:bg-cream-100 transition-all"
                            >
                                <Copy className="h-3 w-3" /> Sao chép → tuần sau
                            </button>
                        </div>
                    </div>

                    {/* Schedule Grid */}
                    <div className="rounded-xl border border-cream-300 bg-cream-100 overflow-x-auto">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-cream-200 bg-cream-50/50">
                                        <th className="px-3 py-2 text-left font-medium text-cream-400 min-w-[140px] sticky left-0 bg-cream-50/50 z-10">Nhân viên</th>
                                        {getWeekDays().map((day) => {
                                            const d = new Date(day)
                                            const isToday = day === new Date().toISOString().split("T")[0]
                                            const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
                                            return (
                                                <th key={day} className={cn(
                                                    "px-2 py-2 text-center font-medium min-w-[120px]",
                                                    isToday ? "text-green-700 bg-green-50/50" : "text-cream-400",
                                                    d.getDay() === 0 ? "text-red-400" : ""
                                                )}>
                                                    <div>{dayNames[d.getDay()]}</div>
                                                    <div className="font-mono text-[10px]">{d.getDate()}/{d.getMonth() + 1}</div>
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream-100">
                                    {staffList.filter((s) => s.status === "ACTIVE").map((staff) => (
                                        <tr key={staff.id} className="hover:bg-cream-50/30 transition-colors">
                                            <td className="px-3 py-2 sticky left-0 bg-cream-100 z-10">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-900 text-cream-50 text-[9px] font-bold shrink-0">
                                                        {staff.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-green-900 truncate max-w-[90px]">{staff.fullName}</p>
                                                        <span className={cn("text-[7px] rounded-full border px-1 py-0 font-medium", ROLE_COLORS[staff.role as StaffRole])}>
                                                            {ROLE_LABELS[staff.role as StaffRole]}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            {getWeekDays().map((day) => {
                                                const entry = weekSchedule.find((s) => s.staffId === staff.id && s.date === day)
                                                const isToday = day === new Date().toISOString().split("T")[0]
                                                return (
                                                    <td key={day} className={cn("px-1 py-1.5 text-center", isToday && "bg-green-50/30")}>
                                                        {entry ? (
                                                            <div className={cn("rounded-lg border px-1.5 py-1 text-[9px] font-bold relative group", SHIFT_COLORS[entry.shiftType] ?? "bg-cream-200 text-cream-600 border-cream-300")}>
                                                                {SHIFT_TYPES[entry.shiftType]?.label ?? entry.shiftType}
                                                                <div className="text-[7px] font-mono font-normal opacity-70">{entry.startTime}–{entry.endTime}</div>
                                                                <button
                                                                    onClick={() => handleRemoveShift(staff.id, day)}
                                                                    className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                                >
                                                                    <X className="h-2 w-2" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setShowAssignModal({ staffId: staff.id, date: day }); setAssignType("FULL") }}
                                                                className="w-full h-8 rounded-lg border border-dashed border-cream-300 flex items-center justify-center text-cream-300 hover:border-green-400 hover:text-green-500 transition-all"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Shift type legend */}
                    <div className="flex items-center gap-3 mt-3">
                        {Object.entries(SHIFT_TYPES).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-1">
                                <div className={cn("h-3 w-3 rounded border", SHIFT_COLORS[key])} />
                                <span className="text-[9px] text-cream-400">{val.label} ({val.start}–{val.end})</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Assign Shift Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-[340px] mx-4 rounded-xl bg-cream-50 p-6 shadow-2xl">
                        <h3 className="font-display text-lg font-bold text-green-900 mb-1">Gán ca làm</h3>
                        <p className="text-xs text-cream-500 mb-4">
                            {staffList.find((s) => s.id === showAssignModal.staffId)?.fullName} — {new Date(showAssignModal.date).toLocaleDateString("vi-VN")}
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {Object.entries(SHIFT_TYPES).map(([key, val]) => (
                                <button
                                    key={key}
                                    onClick={() => setAssignType(key)}
                                    className={cn(
                                        "rounded-lg border px-3 py-2 text-xs font-bold transition-all",
                                        assignType === key
                                            ? SHIFT_COLORS[key]
                                            : "border-cream-300 text-cream-400"
                                    )}
                                >
                                    {val.label}
                                    <span className="block text-[9px] font-mono font-normal opacity-70">{val.start}–{val.end}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleAssignShift} className="flex-1 bg-green-900 text-cream-50 hover:bg-green-800">
                                Gán ca
                            </Button>
                            <Button variant="outline" onClick={() => setShowAssignModal(null)} className="border-cream-300 text-cream-500">
                                Huỷ
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Staff Actions Panel */}
            {selectedStaff && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[95vw] max-w-[700px]">
                    <div className="flex items-center gap-2 rounded-xl border border-cream-300 bg-cream-50 px-4 py-3 shadow-xl flex-wrap">
                        <span className="text-xs font-bold text-green-900 mr-2">
                            {selectedStaff.fullName}
                        </span>
                        <div className="h-4 w-px bg-cream-300" />
                        <button
                            onClick={() => router.push(`/dashboard/staff/${selectedStaff.id}`)}
                            className="flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-green-800 transition-all"
                        >
                            <Users className="h-3 w-3" /> Chi tiết
                        </button>
                        {selectedStaff.status !== "ACTIVE" && (
                            <button
                                onClick={() => handleStatusChange(selectedStaff.id, "ACTIVE")}
                                className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-[10px] font-bold text-green-700 hover:bg-green-200 transition-all"
                            >
                                <UserCheck className="h-3 w-3" /> Kích hoạt
                            </button>
                        )}
                        {selectedStaff.status === "ACTIVE" && (
                            <button
                                onClick={() => handleStatusChange(selectedStaff.id, "ON_LEAVE")}
                                className="flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5 text-[10px] font-bold text-amber-700 hover:bg-amber-200 transition-all"
                            >
                                <Palmtree className="h-3 w-3" /> Cho nghỉ phép
                            </button>
                        )}
                        <button
                            onClick={() => setEditingStaff(selectedStaff)}
                            className="flex items-center gap-1 rounded-lg bg-cream-200 px-3 py-1.5 text-[10px] font-bold text-green-900 hover:bg-cream-300 transition-all"
                        >
                            <RefreshCcw className="h-3 w-3" /> Sửa
                        </button>
                        <button
                            onClick={() => {
                                setShowPinReset(selectedStaff.id)
                                setNewPin("")
                            }}
                            className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-200 transition-all"
                        >
                            <KeyRound className="h-3 w-3" /> Đổi PIN
                        </button>
                        {selectedStaff.status !== "INACTIVE" && selectedStaff.role !== "OWNER" && (
                            <button
                                onClick={() => handleStatusChange(selectedStaff.id, "INACTIVE")}
                                className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-200 transition-all"
                            >
                                <UserX className="h-3 w-3" /> Nghỉ việc
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedStaff(null)}
                            className="ml-1 rounded-lg p-1.5 text-cream-400 hover:bg-cream-200 transition-all"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* PIN Reset Modal */}
            {showPinReset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-[320px] mx-4 rounded-xl bg-cream-50 p-6 shadow-2xl">
                        <h3 className="font-display text-lg font-bold text-green-900 mb-1">Đặt lại PIN</h3>
                        <p className="text-xs text-cream-500 mb-4">Nhập mã PIN mới (4 chữ số)</p>
                        <Input
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="• • • •"
                            maxLength={4}
                            className="text-center font-mono text-2xl tracking-[0.5em] border-cream-300 mb-4"
                        />
                        <div className="flex gap-2">
                            <Button
                                onClick={handlePinReset}
                                disabled={newPin.length < 4}
                                className="flex-1 bg-green-900 text-cream-50 hover:bg-green-800"
                            >
                                Xác nhận
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => { setShowPinReset(null); setNewPin("") }}
                                className="border-cream-300 text-cream-500"
                            >
                                Huỷ
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Staff Modal */}
            {showAddModal && (
                <AddStaffModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => { setShowAddModal(false); loadStaff() }}
                />
            )}

            {/* Edit Staff Modal */}
            {editingStaff && (
                <EditStaffModal
                    staff={editingStaff}
                    onClose={() => setEditingStaff(null)}
                    onSuccess={() => { setEditingStaff(null); setSelectedStaff(null); loadStaff() }}
                />
            )}
        </div>
    )
}

function AddStaffModal({
    onClose,
    onSuccess,
}: {
    onClose: () => void
    onSuccess: () => void
}) {
    const [form, setForm] = useState({
        fullName: "",
        pin: "",
        role: "WAITER" as StaffRole,
        phone: "",
        email: "",
        baseSalary: 0,
        shiftStart: "10:00",
        shiftEnd: "22:00",
    })
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!form.fullName || !form.pin || !form.phone) {
            toast.error("Vui lòng nhập đầy đủ thông tin")
            return
        }
        setSubmitting(true)
        const result = await createStaff(form)
        if (result.success) {
            toast.success(`Đã thêm ${form.fullName}`)
            onSuccess()
        } else {
            toast.error(result.error ?? "Lỗi")
        }
        setSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-[420px] mx-4 rounded-xl bg-cream-50 shadow-2xl">
                <div className="flex items-center justify-between border-b border-cream-200 px-6 py-4">
                    <h3 className="font-display text-lg font-bold text-green-900">Thêm nhân viên</h3>
                    <button onClick={onClose} className="rounded-lg p-1 text-cream-400 hover:bg-cream-200">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-6 space-y-3">
                    <div>
                        <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Họ tên *</label>
                        <Input
                            value={form.fullName}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                            placeholder="Nguyễn Văn A"
                            className="mt-1 border-cream-300"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Mã PIN *</label>
                            <Input
                                value={form.pin}
                                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                                placeholder="4 chữ số"
                                maxLength={4}
                                className="mt-1 font-mono border-cream-300"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Vai trò *</label>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                                className="mt-1 w-full rounded-md border border-cream-300 bg-cream-50 px-3 py-2 text-sm"
                            >
                                {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
                                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">SĐT *</label>
                            <Input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="0901234567"
                                className="mt-1 border-cream-300"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Email</label>
                            <Input
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="name@noonnoir.vn"
                                className="mt-1 border-cream-300"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Lương cơ bản (₫)</label>
                        <Input
                            type="number"
                            value={form.baseSalary || ""}
                            onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) || 0 })}
                            placeholder="5,000,000"
                            className="mt-1 font-mono border-cream-300"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Ca bắt đầu</label>
                            <Input
                                type="time"
                                value={form.shiftStart}
                                onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
                                className="mt-1 border-cream-300"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Ca kết thúc</label>
                            <Input
                                type="time"
                                value={form.shiftEnd}
                                onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
                                className="mt-1 border-cream-300"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 border-t border-cream-200 px-6 py-4">
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 bg-green-900 text-cream-50 hover:bg-green-800"
                    >
                        {submitting ? "Đang thêm..." : "Thêm nhân viên"}
                    </Button>
                    <Button variant="outline" onClick={onClose} className="border-cream-300 text-cream-500">
                        Huỷ
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// EDIT STAFF MODAL
// ============================================================
function EditStaffModal({
    staff,
    onClose,
    onSuccess,
}: {
    staff: Staff
    onClose: () => void
    onSuccess: () => void
}) {
    const [form, setForm] = useState({
        fullName: staff.fullName,
        role: staff.role as StaffRole,
        phone: staff.phone,
        email: staff.email,
        baseSalary: staff.baseSalary ?? 0,
        shiftStart: staff.shiftStart,
        shiftEnd: staff.shiftEnd,
    })
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!form.fullName || !form.phone) {
            toast.error("Vui lòng nhập đầy đủ thông tin")
            return
        }
        setSubmitting(true)
        const result = await updateStaff(staff.id, form)
        if (result.success) {
            toast.success(`Đã cập nhật ${form.fullName}`)
            onSuccess()
        } else {
            toast.error(result.error ?? "Lỗi")
        }
        setSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-[420px] mx-4 rounded-xl bg-cream-50 shadow-2xl">
                <div className="flex items-center justify-between border-b border-cream-200 px-6 py-4">
                    <div>
                        <h3 className="font-display text-lg font-bold text-green-900">Chỉnh sửa nhân viên</h3>
                        <p className="text-[10px] text-cream-400">{staff.fullName} · {ROLE_LABELS[staff.role as StaffRole]}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1 text-cream-400 hover:bg-cream-200">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-6 space-y-3">
                    <div>
                        <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Họ tên *</label>
                        <Input
                            value={form.fullName}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                            className="mt-1 border-cream-300"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Vai trò</label>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                                className="mt-1 w-full rounded-md border border-cream-300 bg-cream-50 px-3 py-2 text-sm"
                            >
                                {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
                                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">SĐT *</label>
                            <Input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="mt-1 border-cream-300"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Email</label>
                        <Input
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="mt-1 border-cream-300"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Lương cơ bản (₫)</label>
                        <Input
                            type="number"
                            value={form.baseSalary || ""}
                            onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) || 0 })}
                            placeholder="5,000,000"
                            className="mt-1 font-mono border-cream-300"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Ca bắt đầu</label>
                            <Input
                                type="time"
                                value={form.shiftStart}
                                onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
                                className="mt-1 border-cream-300"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-400 uppercase tracking-wider">Ca kết thúc</label>
                            <Input
                                type="time"
                                value={form.shiftEnd}
                                onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
                                className="mt-1 border-cream-300"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 border-t border-cream-200 px-6 py-4">
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 bg-green-900 text-cream-50 hover:bg-green-800"
                    >
                        {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                    <Button variant="outline" onClick={onClose} className="border-cream-300 text-cream-500">
                        Huỷ
                    </Button>
                </div>
            </div>
        </div>
    )
}
