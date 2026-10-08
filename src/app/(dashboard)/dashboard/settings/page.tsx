"use client"

import { useState, useEffect, useCallback } from "react"
import { Settings, Store, Printer, Bell, Shield, Palette, Receipt, Save, Check, Plus, Pencil, Trash2, X, BadgePercent, FileText, Star, Banknote, HandCoins, SlidersHorizontal, Users, Clock, Calendar, Wallet, Briefcase, CreditCard, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    getAllTaxRates,
    createTaxRate,
    updateTaxRate,
    deleteTaxRate,
    getTaxConfig,
    updateTaxConfig,
    getTaxReport,
    getTaxBreakdownByRate,
} from "@/actions/tax"
import { getServiceChargeConfig, updateServiceChargeConfig } from "@/actions/operational"
import { getBankConfig, updateBankConfig, type QRPaymentConfig } from "@/actions/qr-payment"
import type { TaxRate } from "@/types"
import { getHrConfig, updateHrConfig, type HrConfigData } from "@/actions/hr-config"
import { getPosConfig, updatePosConfig, type PosConfig, type PaymentMode } from "@/actions/pos-config"
import { isKpiEnabled, setKpiEnabled } from "@/actions/kpi"
import { ThemePicker } from "@/components/theme-switcher"
import {
    getRbacConfig, updateRbacConfig, resetRbacToDefault,
} from "@/actions/rbac"
import {
    MODULES as RBAC_MODULES, ALL_ROLES, PERMISSION_LABELS,
    type RbacConfig, type Permission,
} from "@/lib/rbac-constants"
import { useAuthStore } from "@/stores/auth-store"
import {
    getStoreInfo, updateStoreInfo, type StoreInfo,
    getReceiptConfig, updateReceiptConfig, type ReceiptConfig,
    getDisplayConfig, updateDisplayConfig, type DisplayConfig,
    getNotificationConfig, updateNotificationConfig, type NotificationConfig as NotifConfig,
    getSystemConfig, updateSystemConfig, type SystemConfig,
} from "@/actions/store-config"
import { getInvoiceConfig, updateInvoiceConfig, type InvoiceConfig } from "@/actions/invoices"

type TaxReportLine = Awaited<ReturnType<typeof getTaxReport>>[number]
type TaxBreakdown = Awaited<ReturnType<typeof getTaxBreakdownByRate>>[number]

type SettingSection = "store" | "tax" | "service-charge" | "payment" | "receipt" | "notification" | "display" | "operational" | "system" | "hr" | "setup" | "rbac" | "invoice-config"

type NavGroup = {
    label: string
    items: { id: SettingSection; label: string; icon: typeof Store }[]
}

const NAV_GROUPS: NavGroup[] = [
    {
        label: "Cửa hàng",
        items: [
            { id: "store", label: "Thông tin quán", icon: Store },
            { id: "operational", label: "Vận hành POS", icon: SlidersHorizontal },
            { id: "setup", label: "Cấu hình ban đầu", icon: Settings },
        ],
    },
    {
        label: "Thanh toán & Tài chính",
        items: [
            { id: "payment", label: "Thanh toán QR", icon: Banknote },
            { id: "tax", label: "Thuế (VAT)", icon: Receipt },
            { id: "invoice-config", label: "Cấu hình Hoá đơn VAT", icon: FileText },
            { id: "service-charge", label: "Phí dịch vụ", icon: HandCoins },
            { id: "receipt", label: "Hoá đơn & In", icon: Printer },
        ],
    },
    {
        label: "Hệ thống & Giao diện",
        items: [
            { id: "display", label: "Giao diện", icon: Palette },
            { id: "notification", label: "Thông báo", icon: Bell },
            { id: "hr", label: "Cài đặt nhân sự", icon: Users },
            { id: "rbac", label: "Phân quyền (RBAC)", icon: Shield },
            { id: "system", label: "Hệ thống", icon: Settings },
        ],
    },
]

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState<SettingSection>("store")

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Cài đặt</h1>
                        <p className="text-sm text-cream-500">Tuỳ chỉnh hệ thống POS — tự động lưu khi thay đổi</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-[220px,1fr] gap-4 lg:gap-6">
                {/* Settings Nav — Grouped */}
                <div className="flex lg:flex-col gap-2 lg:gap-0 lg:space-y-4 overflow-x-auto scroll-hide-bar pb-2 lg:pb-0">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label}>
                            <p className="hidden lg:block mb-1.5 px-2 text-[9px] font-bold uppercase tracking-wider text-cream-400">
                                {group.label}
                            </p>
                            <div className="flex lg:flex-col gap-1 lg:gap-0 lg:space-y-0.5">
                                {group.items.map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveSection(item.id)}
                                            className={cn(
                                                "flex items-center gap-2 lg:gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all touch-target",
                                                activeSection === item.id
                                                    ? "bg-green-900 text-cream-50"
                                                    : "text-cream-500 hover:bg-cream-200",
                                                "lg:w-full"
                                            )}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {item.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Settings Content */}
                <div className="rounded-xl border border-cream-300 bg-cream-100 p-4 lg:p-6">
                    {activeSection === "setup" && <SetupSettings />}
                    {activeSection === "store" && <StoreSettings />}
                    {activeSection === "tax" && <TaxSettings />}
                    {activeSection === "invoice-config" && <InvoiceConfigSettings />}
                    {activeSection === "service-charge" && <ServiceChargeSettings />}
                    {activeSection === "payment" && <PaymentSettings />}
                    {activeSection === "receipt" && <ReceiptSettings />}
                    {activeSection === "notification" && <NotificationSettings />}
                    {activeSection === "display" && <DisplaySettings />}
                    {activeSection === "operational" && <OperationalSettings />}
                    {activeSection === "hr" && <HrSettings />}
                    {activeSection === "rbac" && <RbacSettings />}
                    {activeSection === "system" && <SystemSettings />}
                </div>
            </div>
        </div>
    )
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3 mb-6 last:mb-0">
            <h3 className="font-display text-sm font-bold text-green-900 pb-1 border-b border-cream-200">
                {title}
            </h3>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex-1">
                <p className="text-xs font-medium text-green-900">{label}</p>
                {description && <p className="text-[10px] text-cream-400 mt-0.5">{description}</p>}
            </div>
            <div className="shrink-0 ml-4">
                {children}
            </div>
        </div>
    )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                "relative h-5 w-9 rounded-full transition-all",
                checked ? "bg-green-700" : "bg-cream-300"
            )}
        >
            <div className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                checked ? "left-[18px]" : "left-0.5"
            )} />
        </button>
    )
}

// ============================================================
// TAX SETTINGS — Full VAT Management
// ============================================================

function TaxSettings() {
    const [taxEnabled, setTaxEnabled] = useState(false)
    const [taxInclusive, setTaxInclusive] = useState(true)
    const [taxRates, setTaxRates] = useState<TaxRate[]>([])
    const [loading, setLoading] = useState(true)
    const [editingRate, setEditingRate] = useState<TaxRate | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [activeTab, setActiveTab] = useState<"config" | "report">("config")
    const [taxReport, setTaxReport] = useState<TaxReportLine[]>([])
    const [taxBreakdown, setTaxBreakdown] = useState<TaxBreakdown[]>([])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [config, rates] = await Promise.all([getTaxConfig(), getAllTaxRates()])
            setTaxEnabled(config.enabled)
            setTaxInclusive(config.inclusive)
            setTaxRates(rates)
        } catch (err) {
            console.error("[TaxSettings] loadData failed:", err)
            toast.error("Không thể tải cấu hình thuế")
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const loadReport = useCallback(async () => {
        try {
            const [report, breakdown] = await Promise.all([
                getTaxReport("2026"),
                getTaxBreakdownByRate(),
            ])
            setTaxReport(report)
            setTaxBreakdown(breakdown)
        } catch (err) {
            console.error("[TaxSettings] loadReport failed:", err)
        }
    }, [])

    useEffect(() => {
        if (activeTab === "report") loadReport()
    }, [activeTab, loadReport])

    const handleToggleTax = async (enabled: boolean) => {
        setTaxEnabled(enabled)
        await updateTaxConfig({ enabled })
        toast.success(enabled ? "Đã bật thuế VAT" : "Đã tắt thuế VAT")
    }

    const handleToggleInclusive = async (inclusive: boolean) => {
        setTaxInclusive(inclusive)
        await updateTaxConfig({ inclusive })
        toast.success(inclusive ? "Giá đã bao gồm VAT" : "Giá chưa bao gồm VAT")
    }

    const handleDeleteRate = async (id: string) => {
        if (!window.confirm("Bạn chắc chắn muốn xoá thuế suất này? Thao tác này không thể hoàn tác.")) return
        await deleteTaxRate(id)
        toast.success("Đã xoá thuế suất")
        loadData()
    }

    const formatVND = (n: number) => n.toLocaleString("vi-VN") + "₫"

    if (loading) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <div>
            {/* Tab Switcher */}
            <div className="flex gap-1 mb-5 p-1 bg-cream-200 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab("config")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        activeTab === "config"
                            ? "bg-green-900 text-cream-50 shadow-sm"
                            : "text-cream-500 hover:text-green-800"
                    )}
                >
                    <BadgePercent className="h-3.5 w-3.5" />
                    Cấu hình thuế
                </button>
                <button
                    onClick={() => setActiveTab("report")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        activeTab === "report"
                            ? "bg-green-900 text-cream-50 shadow-sm"
                            : "text-cream-500 hover:text-green-800"
                    )}
                >
                    <FileText className="h-3.5 w-3.5" />
                    Báo cáo thuế
                </button>
            </div>

            {activeTab === "config" ? (
                <>
                    {/* System Toggle */}
                    <SettingGroup title="Cài đặt hệ thống thuế">
                        <SettingRow
                            label="Sử dụng thuế VAT"
                            description="Bật/tắt thuế cho toàn bộ hệ thống. Khi tắt, giá hiển thị sẽ không bao gồm thuế."
                        >
                            <Toggle checked={taxEnabled} onChange={handleToggleTax} />
                        </SettingRow>

                        {taxEnabled && (
                            <SettingRow
                                label="Giá đã bao gồm VAT"
                                description="Nếu bật: giá bán = giá cuối cùng (VAT đã tính trong). Nếu tắt: VAT cộng thêm vào giá bán."
                            >
                                <Toggle checked={taxInclusive} onChange={handleToggleInclusive} />
                            </SettingRow>
                        )}
                    </SettingGroup>

                    {taxEnabled && (
                        <>
                            {/* Tax Rates Table */}
                            <SettingGroup title="Bảng thuế suất">
                                <div className="rounded-lg border border-cream-200 overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-cream-200/60">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold text-green-900">Tên</th>
                                                <th className="px-3 py-2 text-left font-semibold text-green-900">Mã</th>
                                                <th className="px-3 py-2 text-center font-semibold text-green-900">Thuế suất</th>
                                                <th className="px-3 py-2 text-left font-semibold text-green-900">Mô tả</th>
                                                <th className="px-3 py-2 text-center font-semibold text-green-900">Mặc định</th>
                                                <th className="px-3 py-2 text-center font-semibold text-green-900">Trạng thái</th>
                                                <th className="px-3 py-2 text-center font-semibold text-green-900">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-cream-200">
                                            {taxRates.map((rate) => (
                                                <tr key={rate.id} className={cn("hover:bg-cream-50 transition-colors", !rate.isActive && "opacity-50")}>
                                                    <td className="px-3 py-2.5 font-medium text-green-900">{rate.name}</td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="font-mono bg-cream-200 px-1.5 py-0.5 rounded text-[10px]">{rate.code}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className="inline-flex items-center justify-center h-6 min-w-[40px] rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                                            {rate.rate}%
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-cream-500 max-w-[200px] truncate">{rate.description}</td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        {rate.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 mx-auto" />}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={cn(
                                                            "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold",
                                                            rate.isActive
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-red-100 text-red-600"
                                                        )}>
                                                            {rate.isActive ? "Hoạt động" : "Tắt"}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => setEditingRate(rate)}
                                                                className="p-1 rounded hover:bg-cream-200 text-cream-400 hover:text-green-700 transition-colors"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRate(rate.id)}
                                                                className="p-1 rounded hover:bg-red-50 text-cream-400 hover:text-red-600 transition-colors"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => setShowAddForm(true)}
                                    className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-8"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Thêm thuế suất
                                </Button>
                            </SettingGroup>

                            {/* Info Card */}
                            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                                <p className="text-[10px] font-semibold text-amber-800 mb-1">Lưu ý nghiệp vụ</p>
                                <ul className="text-[10px] text-amber-700 space-y-0.5 list-disc list-inside">
                                    <li><strong>Thuế đầu ra</strong>: VAT tính trên giá bán cho khách (theo thuế suất gán cho sản phẩm)</li>
                                    <li><strong>Thuế đầu vào</strong>: VAT trên hoá đơn mua hàng (ghi nhận khi nhập kho/PO)</li>
                                    <li><strong>Thuế phải nộp</strong> = Đầu ra − Đầu vào (khấu trừ đầy đủ)</li>
                                    <li>Quán sử dụng phương pháp khấu trừ → cần lưu hoá đơn GTGT đầu vào</li>
                                </ul>
                            </div>
                        </>
                    )}
                </>
            ) : (
                /* TAX REPORT TAB */
                <TaxReportView taxReport={taxReport} taxBreakdown={taxBreakdown} formatVND={formatVND} />
            )}

            {/* Add/Edit Modal */}
            {(showAddForm || editingRate) && (
                <TaxRateFormModal
                    rate={editingRate}
                    onClose={() => { setShowAddForm(false); setEditingRate(null) }}
                    onSaved={() => { setShowAddForm(false); setEditingRate(null); loadData() }}
                />
            )}
        </div>
    )
}

// ============================================================
// Tax Rate Form Modal
// ============================================================

function TaxRateFormModal({
    rate,
    onClose,
    onSaved,
}: {
    rate: TaxRate | null
    onClose: () => void
    onSaved: () => void
}) {
    const [name, setName] = useState(rate?.name ?? "")
    const [code, setCode] = useState(rate?.code ?? "")
    const [rateValue, setRateValue] = useState(rate?.rate?.toString() ?? "")
    const [description, setDescription] = useState(rate?.description ?? "")
    const [isDefault, setIsDefault] = useState(rate?.isDefault ?? false)
    const [saving, setSaving] = useState(false)

    const handleSubmit = async () => {
        if (!name || !code || rateValue === "") return

        setSaving(true)
        const data = {
            name,
            code: code.toUpperCase(),
            rate: parseFloat(rateValue),
            description: description || undefined,
            isDefault,
        }

        if (rate) {
            const res = await updateTaxRate(rate.id, data)
            if (res.success) toast.success("Đã cập nhật thuế suất")
            else toast.error(res.error?.message)
        } else {
            const res = await createTaxRate(data)
            if (res.success) toast.success("Đã thêm thuế suất mới")
            else toast.error(res.error?.message)
        }

        setSaving(false)
        onSaved()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-cream-100 rounded-xl border border-cream-300 p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <h3 className="font-display text-sm font-bold text-green-900">
                        {rate ? "Chỉnh sửa thuế suất" : "Thêm thuế suất mới"}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-cream-200 text-cream-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] font-semibold text-green-900 mb-1 block">Tên thuế suất *</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: VAT 10%"
                            className="h-8 text-xs border-cream-300"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-green-900 mb-1 block">Mã thuế *</label>
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="VD: VAT10"
                                className="h-8 text-xs font-mono border-cream-300"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-green-900 mb-1 block">Thuế suất (%) *</label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={rateValue}
                                onChange={(e) => setRateValue(e.target.value)}
                                placeholder="10"
                                className="h-8 text-xs border-cream-300"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold text-green-900 mb-1 block">Mô tả</label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả ngắn..."
                            className="h-8 text-xs border-cream-300"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Toggle checked={isDefault} onChange={setIsDefault} />
                        <span className="text-xs text-green-900">Thuế suất mặc định</span>
                    </div>
                </div>

                <div className="flex gap-2 mt-5">
                    <Button variant="outline" onClick={onClose} className="flex-1 text-xs h-8 border-cream-300">
                        Huỷ
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving || !name || !code || rateValue === ""}
                        className="flex-1 bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-8"
                    >
                        {saving ? "Đang lưu..." : (rate ? "Cập nhật" : "Thêm")}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// Tax Report View
// ============================================================

function TaxReportView({
    taxReport,
    taxBreakdown,
    formatVND,
}: {
    taxReport: TaxReportLine[]
    taxBreakdown: TaxBreakdown[]
    formatVND: (n: number) => string
}) {
    const totalOutput = taxReport.reduce((s, r) => s + r.outputTax, 0)
    const totalInput = taxReport.reduce((s, r) => s + r.inputTax, 0)
    const totalPayable = totalOutput - totalInput

    return (
        <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <p className="text-[10px] text-green-600 font-medium mb-0.5">Thuế đầu ra (Output)</p>
                    <p className="text-sm font-bold text-green-800">{formatVND(totalOutput)}</p>
                    <p className="text-[9px] text-green-500 mt-0.5">VAT trên doanh số bán hàng</p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-[10px] text-blue-600 font-medium mb-0.5">Thuế đầu vào (Input)</p>
                    <p className="text-sm font-bold text-blue-800">{formatVND(totalInput)}</p>
                    <p className="text-[9px] text-blue-500 mt-0.5">VAT trên hoá đơn mua hàng</p>
                </div>
                <div className={cn(
                    "rounded-lg border p-3",
                    totalPayable >= 0
                        ? "bg-amber-50 border-amber-200"
                        : "bg-emerald-50 border-emerald-200"
                )}>
                    <p className={cn("text-[10px] font-medium mb-0.5", totalPayable >= 0 ? "text-amber-600" : "text-emerald-600")}>
                        {totalPayable >= 0 ? "Thuế phải nộp" : "Thuế được khấu trừ"}
                    </p>
                    <p className={cn("text-sm font-bold", totalPayable >= 0 ? "text-amber-800" : "text-emerald-800")}>
                        {formatVND(Math.abs(totalPayable))}
                    </p>
                    <p className={cn("text-[9px] mt-0.5", totalPayable >= 0 ? "text-amber-500" : "text-emerald-500")}>
                        Đầu ra − Đầu vào
                    </p>
                </div>
            </div>

            {/* Breakdown by Tax Rate */}
            <SettingGroup title="Phân tích theo thuế suất">
                <div className="rounded-lg border border-cream-200 overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-cream-200/60">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-green-900">Thuế suất</th>
                                <th className="px-3 py-2 text-right font-semibold text-green-900">Doanh số</th>
                                <th className="px-3 py-2 text-right font-semibold text-green-900">VAT đầu ra</th>
                                <th className="px-3 py-2 text-center font-semibold text-green-900">Số HĐ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cream-200">
                            {taxBreakdown.map((b) => (
                                <tr key={b.taxRateCode} className="hover:bg-cream-50">
                                    <td className="px-3 py-2.5">
                                        <span className="font-medium text-green-900">{b.taxRateName}</span>
                                        <span className="ml-1.5 text-[9px] text-cream-400 font-mono">{b.taxRateCode}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-medium">{formatVND(b.totalSales)}</td>
                                    <td className="px-3 py-2.5 text-right font-medium text-amber-700">{formatVND(b.outputTax)}</td>
                                    <td className="px-3 py-2.5 text-center text-cream-500">{b.itemCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SettingGroup>

            {/* Monthly Report */}
            <SettingGroup title="Báo cáo thuế theo tháng (2026)">
                <div className="rounded-lg border border-cream-200 overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-cream-200/60 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-green-900">Kỳ</th>
                                <th className="px-3 py-2 text-right font-semibold text-green-900">Doanh thu</th>
                                <th className="px-3 py-2 text-right font-semibold text-green-900">Thuế đầu ra</th>
                                <th className="px-3 py-2 text-right font-semibold text-green-900">Mua hàng</th>
                                <th className="px-3 py-2 text-right font-semibold text-green-900">Thuế đầu vào</th>
                                <th className="px-3 py-2 text-right font-semibold text-green-900">Phải nộp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cream-200">
                            {taxReport.map((r) => (
                                <tr key={r.period} className="hover:bg-cream-50">
                                    <td className="px-3 py-2 font-medium text-green-900">{r.period}</td>
                                    <td className="px-3 py-2 text-right">{formatVND(r.totalRevenue)}</td>
                                    <td className="px-3 py-2 text-right text-green-700">{formatVND(r.outputTax)}</td>
                                    <td className="px-3 py-2 text-right">{formatVND(r.totalPurchases)}</td>
                                    <td className="px-3 py-2 text-right text-blue-600">{formatVND(r.inputTax)}</td>
                                    <td className={cn("px-3 py-2 text-right font-bold", r.taxPayable >= 0 ? "text-amber-700" : "text-emerald-600")}>
                                        {r.taxPayable >= 0 ? "" : "−"}{formatVND(Math.abs(r.taxPayable))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SettingGroup>
        </>
    )
}

// ============================================================
// EXISTING SETTINGS (kept from original)
// ============================================================

function StoreSettings() {
    const [info, setInfo] = useState<StoreInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        getStoreInfo().then((data) => { setInfo(data); setLoading(false) })
    }, [])

    const handleSave = async (field: string, value: string) => {
        if (!info) return
        setSaving(true)
        await updateStoreInfo({ [field]: value })
        setSaving(false)
        toast.success("Đã lưu")
    }

    if (loading || !info) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <>
            <SettingGroup title="Thông tin cửa hàng">
                <SettingRow label="Tên quán" description="Hiển thị trên hoá đơn và ứng dụng">
                    <Input value={info.storeName} onChange={(e) => setInfo({ ...info, storeName: e.target.value })} onBlur={() => handleSave("storeName", info.storeName)} className="w-48 h-8 text-xs border-cream-300" />
                </SettingRow>
                <SettingRow label="Tagline" description="Slogan hoặc mô tả ngắn">
                    <Input value={info.tagline} onChange={(e) => setInfo({ ...info, tagline: e.target.value })} onBlur={() => handleSave("tagline", info.tagline)} className="w-48 h-8 text-xs border-cream-300" />
                </SettingRow>
                <SettingRow label="Số điện thoại">
                    <Input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} onBlur={() => handleSave("phone", info.phone)} className="w-48 h-8 text-xs border-cream-300" />
                </SettingRow>
                <SettingRow label="Địa chỉ">
                    <Input value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} onBlur={() => handleSave("address", info.address)} className="w-64 h-8 text-xs border-cream-300" />
                </SettingRow>
            </SettingGroup>

            <SettingGroup title="Thuế & Tài chính">
                <SettingRow label="Mã số thuế">
                    <Input value={info.taxId} onChange={(e) => setInfo({ ...info, taxId: e.target.value })} onBlur={() => handleSave("taxId", info.taxId)} className="w-48 h-8 text-xs font-mono border-cream-300" />
                </SettingRow>
                <SettingRow label="Đơn vị tiền tệ">
                    <select
                        value={info.currency}
                        onChange={(e) => { setInfo({ ...info, currency: e.target.value }); handleSave("currency", e.target.value) }}
                        className="w-48 h-8 rounded-md border border-cream-300 bg-cream-50 px-2 text-xs"
                    >
                        <option value="VND">VND (₫)</option>
                        <option value="USD">USD ($)</option>
                    </select>
                </SettingRow>
            </SettingGroup>

            <SettingGroup title="Giờ hoạt động">
                <SettingRow label="Giờ mở cửa">
                    <Input type="time" value={info.openTime} onChange={(e) => setInfo({ ...info, openTime: e.target.value })} onBlur={() => handleSave("openTime", info.openTime)} className="w-32 h-8 text-xs border-cream-300" />
                </SettingRow>
                <SettingRow label="Giờ đóng cửa">
                    <Input type="time" value={info.closeTime} onChange={(e) => setInfo({ ...info, closeTime: e.target.value })} onBlur={() => handleSave("closeTime", info.closeTime)} className="w-32 h-8 text-xs border-cream-300" />
                </SettingRow>
            </SettingGroup>

            {saving && <p className="text-center text-xs text-cream-400 mt-2 animate-pulse">Đang lưu...</p>}
        </>
    )
}

function ReceiptSettings() {
    const [cfg, setCfg] = useState<ReceiptConfig | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getReceiptConfig().then((c) => { setCfg(c); setLoading(false) })
    }, [])

    const save = async (updates: Partial<ReceiptConfig>) => {
        if (!cfg) return
        const merged = { ...cfg, ...updates }
        setCfg(merged)
        await updateReceiptConfig(updates)
        toast.success("Đã lưu cài đặt hoá đơn")
    }

    if (loading || !cfg) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <>
            <SettingGroup title="In hoá đơn">
                <SettingRow label="Tự động in" description="In hoá đơn khi thanh toán thành công">
                    <Toggle checked={cfg.autoPrint} onChange={(v) => save({ autoPrint: v })} />
                </SettingRow>
                <SettingRow label="Hiện logo" description="Hiển thị logo Noon & Noir trên hoá đơn">
                    <Toggle checked={cfg.showLogo} onChange={(v) => save({ showLogo: v })} />
                </SettingRow>
                <SettingRow label="Khổ giấy" description="Kích thước cuộn giấy nhiệt">
                    <select
                        value={cfg.paperWidth}
                        onChange={(e) => save({ paperWidth: e.target.value as "58" | "80" })}
                        className="w-32 h-8 rounded-md border border-cream-300 bg-cream-50 px-2 text-xs"
                    >
                        <option value="58">58mm</option>
                        <option value="80">80mm</option>
                    </select>
                </SettingRow>
            </SettingGroup>

            <SettingGroup title="Chân hoá đơn">
                <SettingRow label="Hiện footer" description="Thêm thông điệp cuối hoá đơn">
                    <Toggle checked={cfg.showFooter} onChange={(v) => save({ showFooter: v })} />
                </SettingRow>
                <SettingRow label="Nội dung footer">
                    <Input value={cfg.footerText} onChange={(e) => setCfg({ ...cfg, footerText: e.target.value })} onBlur={() => save({ footerText: cfg.footerText })} className="w-48 h-8 text-xs border-cream-300" />
                </SettingRow>
            </SettingGroup>
        </>
    )
}

function NotificationSettings() {
    const [cfg, setCfg] = useState<NotifConfig | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getNotificationConfig().then((c) => { setCfg(c); setLoading(false) })
    }, [])

    const save = async (updates: Partial<NotifConfig>) => {
        if (!cfg) return
        setCfg({ ...cfg, ...updates })
        await updateNotificationConfig(updates)
        toast.success("Đã lưu cài đặt thông báo")
    }

    if (loading || !cfg) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <>
            <SettingGroup title="Thông báo đẩy">
                <SettingRow label="Đơn hàng mới" description="Thông báo khi có đơn hàng mới tạo">
                    <Toggle checked={cfg.newOrder} onChange={(v) => save({ newOrder: v })} />
                </SettingRow>
                <SettingRow label="Tồn kho thấp" description="Cảnh báo khi sản phẩm sắp hết hàng">
                    <Toggle checked={cfg.lowStock} onChange={(v) => save({ lowStock: v })} />
                </SettingRow>
                <SettingRow label="Bếp sẵn sàng" description="Thông báo khi món ăn đã xong">
                    <Toggle checked={cfg.kitchenReady} onChange={(v) => save({ kitchenReady: v })} />
                </SettingRow>
                <SettingRow label="Báo cáo hàng ngày" description="Gửi tóm tắt doanh thu lúc đóng cửa">
                    <Toggle checked={cfg.dailyReport} onChange={(v) => save({ dailyReport: v })} />
                </SettingRow>
            </SettingGroup>

            <SettingGroup title="Âm thanh">
                <SettingRow label="Hiệu ứng âm thanh" description="Phát âm thanh khi có thông báo">
                    <Toggle checked={cfg.sound} onChange={(v) => save({ sound: v })} />
                </SettingRow>
            </SettingGroup>
        </>
    )
}

function DisplaySettings() {
    const [cfg, setCfg] = useState<DisplayConfig | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getDisplayConfig().then((c) => { setCfg(c); setLoading(false) })
    }, [])

    const save = async (updates: Partial<DisplayConfig>) => {
        if (!cfg) return
        setCfg({ ...cfg, ...updates })
        await updateDisplayConfig(updates)
        toast.success("Đã lưu cài đặt giao diện")
    }

    if (loading || !cfg) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <>
            <ThemePicker />
            <div className="my-5 border-t border-cream-300" />

            <SettingGroup title="Giao diện">
                <SettingRow label="Chế độ tối" description="Sử dụng theme tối cho POS">
                    <Toggle checked={cfg.darkMode} onChange={(v) => save({ darkMode: v })} />
                </SettingRow>
                <SettingRow label="Chế độ compact" description="Giảm khoảng cách giữa các phần tử">
                    <Toggle checked={cfg.compactMode} onChange={(v) => save({ compactMode: v })} />
                </SettingRow>
                <SettingRow label="Hiện hình sản phẩm" description="Hiển thị ảnh thumbnail trong menu POS">
                    <Toggle checked={cfg.showImages} onChange={(v) => save({ showImages: v })} />
                </SettingRow>
            </SettingGroup>

            <SettingGroup title="Bố cục POS">
                <SettingRow label="Số cột sản phẩm" description="Số lượng cột hiển thị trong grid menu">
                    <select
                        value={cfg.gridCols}
                        onChange={(e) => save({ gridCols: e.target.value as "3" | "4" | "5" })}
                        className="w-32 h-8 rounded-md border border-cream-300 bg-cream-50 px-2 text-xs"
                    >
                        <option value="3">3 cột</option>
                        <option value="4">4 cột</option>
                        <option value="5">5 cột</option>
                    </select>
                </SettingRow>
                <SettingRow label="Ngôn ngữ" description="Ngôn ngữ hiển thị ứng dụng">
                    <select
                        value={cfg.language}
                        onChange={(e) => save({ language: e.target.value as "vi" | "en" })}
                        className="w-32 h-8 rounded-md border border-cream-300 bg-cream-50 px-2 text-xs"
                    >
                        <option value="vi">Tiếng Việt</option>
                        <option value="en">English</option>
                    </select>
                </SettingRow>
            </SettingGroup>
        </>
    )
}

function SystemSettings() {
    const [cfg, setCfg] = useState<SystemConfig | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getSystemConfig().then((c) => { setCfg(c); setLoading(false) })
    }, [])

    const save = async (updates: Partial<SystemConfig>) => {
        if (!cfg) return
        setCfg({ ...cfg, ...updates })
        await updateSystemConfig(updates)
        toast.success("Đã lưu cài đặt hệ thống")
    }

    if (loading || !cfg) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <>
            <SettingGroup title="Bảo mật">
                <SettingRow label="Tự động khoá" description="Khoá phiên sau thời gian không hoạt động">
                    <select
                        value={cfg.sessionTimeout}
                        onChange={(e) => save({ sessionTimeout: e.target.value as SystemConfig["sessionTimeout"] })}
                        className="w-32 h-8 rounded-md border border-cream-300 bg-cream-50 px-2 text-xs"
                    >
                        <option value="15">15 phút</option>
                        <option value="30">30 phút</option>
                        <option value="60">1 giờ</option>
                        <option value="0">Không khoá</option>
                    </select>
                </SettingRow>
            </SettingGroup>

            <SettingGroup title="Dữ liệu">
                <SettingRow label="Tự động sao lưu" description="Sao lưu dữ liệu hàng ngày lúc 3:00 AM">
                    <Toggle checked={cfg.autoBackup} onChange={(v) => save({ autoBackup: v })} />
                </SettingRow>
                <SettingRow label="Database" description="Kết nối đến Supabase PostgreSQL">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">
                        Connected
                    </span>
                </SettingRow>
            </SettingGroup>

            <SettingGroup title="Phiên bản">
                <SettingRow label="POS Version" description="Noonnoir POS System">
                    <span className="font-mono text-[10px] text-cream-400">v1.0.0</span>
                </SettingRow>
                <SettingRow label="Framework" description="Next.js 16 + Tailwind CSS">
                    <span className="font-mono text-[10px] text-cream-400">Next.js 16.1.6</span>
                </SettingRow>
            </SettingGroup>
        </>
    )
}

// ============================================================
// SERVICE CHARGE SETTINGS
// ============================================================
function ServiceChargeSettings() {
    const [enabled, setEnabled] = useState(true)
    const [rate, setRate] = useState("5")
    const [applyTo, setApplyTo] = useState<"ALL" | "DINE_IN_ONLY">("DINE_IN_ONLY")
    const [label, setLabel] = useState("Phí dịch vụ")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getServiceChargeConfig().then((cfg) => {
            setEnabled(cfg.enabled)
            setRate(String(Math.round(cfg.rate * 100)))
            setApplyTo(cfg.applyTo)
            setLabel(cfg.label)
            setLoading(false)
        })
    }, [])

    const handleSave = async (field: string, value: unknown) => {
        await updateServiceChargeConfig({ [field]: value })
        toast.success("Đã cập nhật phí dịch vụ")
    }

    if (loading) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <>
            <SettingGroup title="Cấu hình phí dịch vụ (Service Charge)">
                <SettingRow label="Bật phí dịch vụ" description="Thu phí dịch vụ trên đơn hàng">
                    <Toggle checked={enabled} onChange={(v) => { setEnabled(v); handleSave("enabled", v) }} />
                </SettingRow>

                {enabled && (
                    <>
                        <SettingRow label="Tên hiển thị" description="Tên hiển thị trên hoá đơn">
                            <Input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => handleSave("label", label)} className="w-40 h-8 text-xs border-cream-300" />
                        </SettingRow>
                        <SettingRow label="Phần trăm (%)" description="Tỷ lệ phí dịch vụ tính trên tổng tiền">
                            <div className="flex items-center gap-1">
                                <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={rate}
                                    onChange={(e) => setRate(e.target.value)}
                                    onBlur={() => handleSave("rate", Number(rate) / 100)}
                                    className="w-20 h-8 text-xs border-cream-300 text-center"
                                />
                                <span className="text-xs text-cream-400">%</span>
                            </div>
                        </SettingRow>
                        <SettingRow label="Áp dụng cho" description="Loại đơn hàng nào bị tính phí">
                            <select
                                value={applyTo}
                                onChange={(e) => {
                                    const v = e.target.value as "ALL" | "DINE_IN_ONLY"
                                    setApplyTo(v)
                                    handleSave("applyTo", v)
                                }}
                                className="w-40 h-8 rounded-md border border-cream-300 bg-cream-50 px-2 text-xs"
                            >
                                <option value="DINE_IN_ONLY">Chỉ dùng tại quán</option>
                                <option value="ALL">Tất cả đơn</option>
                            </select>
                        </SettingRow>
                    </>
                )}
            </SettingGroup>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-[10px] font-semibold text-blue-800 mb-1">Hướng dẫn</p>
                <p className="text-[10px] text-blue-700">Phí dịch vụ sẽ tự động tính vào tổng đơn tại POS. Khách hàng sẽ thấy dòng “Phí dịch vụ X%” trên hoá đơn.</p>
            </div>
        </>
    )
}

// ============================================================
// QR / BANK PAYMENT SETTINGS
// ============================================================
function PaymentSettings() {
    const [config, setConfig] = useState<QRPaymentConfig | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getBankConfig().then((c) => { setConfig(c); setLoading(false) })
    }, [])

    const handleSave = async (field: string, value: string) => {
        if (!config) return
        const updated = { ...config, [field]: value }
        setConfig(updated)
        await updateBankConfig({ [field]: value })
        toast.success("Đã cập nhật thông tin ngân hàng")
    }

    if (loading || !config) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <>
            <SettingGroup title="Cấu hình VietQR / Ngân hàng">
                <SettingRow label="Tên ngân hàng" description="VD: MB Bank, Vietcombank, Techcombank">
                    <Input value={config.bankName} onChange={(e) => setConfig({ ...config, bankName: e.target.value })} onBlur={() => handleSave("bankName", config.bankName)} className="w-48 h-8 text-xs border-cream-300" />
                </SettingRow>
                <SettingRow label="Mã ngân hàng" description="Mã BIN theo VietQR (VD: 970422)">
                    <Input value={config.bankId} onChange={(e) => setConfig({ ...config, bankId: e.target.value })} onBlur={() => handleSave("bankId", config.bankId)} className="w-32 h-8 text-xs font-mono border-cream-300" />
                </SettingRow>
                <SettingRow label="Số tài khoản" description="Số tài khoản nhận tiền">
                    <Input value={config.accountNumber} onChange={(e) => setConfig({ ...config, accountNumber: e.target.value })} onBlur={() => handleSave("accountNumber", config.accountNumber)} className="w-48 h-8 text-xs font-mono border-cream-300" />
                </SettingRow>
                <SettingRow label="Chủ tài khoản" description="Tên chủ TK (in hoa, không dấu)">
                    <Input value={config.accountName} onChange={(e) => setConfig({ ...config, accountName: e.target.value })} onBlur={() => handleSave("accountName", config.accountName)} className="w-56 h-8 text-xs border-cream-300" />
                </SettingRow>
                <SettingRow label="Template QR" description="Kiểu hiển thị mã QR">
                    <select value={config.template} onChange={(e) => handleSave("template", e.target.value)} className="w-36 h-8 rounded-md border border-cream-300 bg-cream-50 px-2 text-xs">
                        <option value="compact">Compact</option>
                        <option value="compact2">Compact 2</option>
                        <option value="print">Print</option>
                    </select>
                </SettingRow>
            </SettingGroup>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-[10px] font-semibold text-amber-800 mb-1">Lưu ý</p>
                <p className="text-[10px] text-amber-700">Thông tin này sẽ được dùng để tạo mã QR VietQR khi khách chọn thanh toán chuyển khoản tại POS.</p>
            </div>
        </>
    )
}

// ============================================================
// HR SETTINGS — Full HR Configuration
// ============================================================
function HrSettings() {
    const [config, setConfig] = useState<HrConfigData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<"shifts" | "attendance" | "payroll" | "leave" | "roles">("shifts")

    useEffect(() => {
        (async () => {
            const data = await getHrConfig()
            setConfig(data)
            setLoading(false)
        })()
    }, [])

    const handleSave = async (updates: Partial<HrConfigData>) => {
        setSaving(true)
        const merged = { ...config, ...updates } as HrConfigData
        setConfig(merged)
        const result = await updateHrConfig(updates)
        setSaving(false)
        if (result.success) toast.success("Đã lưu cài đặt nhân sự")
        else toast.error("Lỗi lưu cài đặt")
    }

    const formatVND = (n: number) => n.toLocaleString("vi-VN") + "₫"

    if (loading || !config) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải cấu hình HR...</div>

    const tabs = [
        { key: "shifts" as const, label: "Ca làm", icon: Clock },
        { key: "attendance" as const, label: "Chấm công", icon: Calendar },
        { key: "payroll" as const, label: "Lương", icon: Wallet },
        { key: "leave" as const, label: "Nghỉ phép", icon: Calendar },
        { key: "roles" as const, label: "Vai trò", icon: Briefcase },
    ]

    return (
        <div>
            {/* Sub-Tab Navigation */}
            <div className="flex gap-1 mb-5 p-1 bg-cream-200 rounded-lg w-fit">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                activeTab === tab.key
                                    ? "bg-green-900 text-cream-50 shadow-sm"
                                    : "text-cream-500 hover:text-green-800"
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* ===== SHIFTS TAB ===== */}
            {activeTab === "shifts" && (
                <>
                    <SettingGroup title="Định nghĩa ca làm việc">
                        <div className="rounded-lg border border-cream-200 overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-cream-200/60">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-green-900">Tên ca</th>
                                        <th className="px-3 py-2 text-center font-semibold text-green-900">Bắt đầu</th>
                                        <th className="px-3 py-2 text-center font-semibold text-green-900">Kết thúc</th>
                                        <th className="px-3 py-2 text-center font-semibold text-green-900">Màu</th>
                                        <th className="px-3 py-2 text-center font-semibold text-green-900">Kích hoạt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream-200">
                                    {config.shifts.map((shift, idx) => (
                                        <tr key={shift.key} className="hover:bg-cream-50 transition-colors">
                                            <td className="px-3 py-2.5">
                                                <Input
                                                    value={shift.label}
                                                    onChange={(e) => {
                                                        const newShifts = [...config.shifts]
                                                        newShifts[idx] = { ...shift, label: e.target.value }
                                                        setConfig({ ...config, shifts: newShifts })
                                                    }}
                                                    className="h-7 w-32 text-xs border-cream-300"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <Input
                                                    type="time"
                                                    value={shift.startTime}
                                                    onChange={(e) => {
                                                        const newShifts = [...config.shifts]
                                                        newShifts[idx] = { ...shift, startTime: e.target.value }
                                                        setConfig({ ...config, shifts: newShifts })
                                                    }}
                                                    className="h-7 w-28 text-xs border-cream-300"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <Input
                                                    type="time"
                                                    value={shift.endTime}
                                                    onChange={(e) => {
                                                        const newShifts = [...config.shifts]
                                                        newShifts[idx] = { ...shift, endTime: e.target.value }
                                                        setConfig({ ...config, shifts: newShifts })
                                                    }}
                                                    className="h-7 w-28 text-xs border-cream-300"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <input
                                                    type="color"
                                                    value={shift.color}
                                                    onChange={(e) => {
                                                        const newShifts = [...config.shifts]
                                                        newShifts[idx] = { ...shift, color: e.target.value }
                                                        setConfig({ ...config, shifts: newShifts })
                                                    }}
                                                    className="h-7 w-10 rounded border border-cream-300 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <Toggle
                                                    checked={shift.isActive}
                                                    onChange={(v) => {
                                                        const newShifts = [...config.shifts]
                                                        newShifts[idx] = { ...shift, isActive: v }
                                                        setConfig({ ...config, shifts: newShifts })
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => handleSave({ shifts: config.shifts })}
                            disabled={saving}
                            className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-8 mt-2"
                        >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {saving ? "Đang lưu..." : "Lưu cài đặt ca"}
                        </Button>
                    </SettingGroup>

                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-4">
                        <p className="text-[10px] font-semibold text-amber-800 mb-1">Lưu ý</p>
                        <p className="text-[10px] text-amber-700">Thay đổi thời gian ca sẽ áp dụng cho các lịch ca mới. Lịch ca đã gán trước đó sẽ không bị ảnh hưởng.</p>
                    </div>
                </>
            )}

            {/* ===== ATTENDANCE TAB ===== */}
            {activeTab === "attendance" && (
                <SettingGroup title="Quy tắc chấm công">
                    <SettingRow
                        label="Dung sai đi muộn (phút)"
                        description="Số phút sau giờ bắt đầu ca được phép trễ mà không bị tính đi muộn"
                    >
                        <Input
                            type="number"
                            min="0"
                            max="120"
                            value={config.attendance.lateTolerance}
                            onChange={(e) => setConfig({
                                ...config,
                                attendance: { ...config.attendance, lateTolerance: parseInt(e.target.value) || 0 }
                            })}
                            className="w-20 h-8 text-xs border-cream-300 text-center"
                        />
                    </SettingRow>
                    <SettingRow
                        label="Ngưỡng tính vắng (phút)"
                        description="Sau bao nhiêu phút không check-in sẽ tự động tính vắng mặt"
                    >
                        <Input
                            type="number"
                            min="0"
                            max="480"
                            value={config.attendance.absentThreshold}
                            onChange={(e) => setConfig({
                                ...config,
                                attendance: { ...config.attendance, absentThreshold: parseInt(e.target.value) || 0 }
                            })}
                            className="w-20 h-8 text-xs border-cream-300 text-center"
                        />
                    </SettingRow>
                    <SettingRow
                        label="Giờ tự động check-out"
                        description="Hệ thống sẽ tự checkout nếu nhân viên quên"
                    >
                        <Input
                            type="time"
                            value={config.attendance.autoCheckoutHour}
                            onChange={(e) => setConfig({
                                ...config,
                                attendance: { ...config.attendance, autoCheckoutHour: e.target.value }
                            })}
                            className="w-28 h-8 text-xs border-cream-300"
                        />
                    </SettingRow>
                    <SettingRow
                        label="Giờ làm tối thiểu / ngày"
                        description="Số giờ tối thiểu để tính đủ 1 ngày công"
                    >
                        <Input
                            type="number"
                            min="1"
                            max="24"
                            value={config.attendance.minWorkHours}
                            onChange={(e) => setConfig({
                                ...config,
                                attendance: { ...config.attendance, minWorkHours: parseInt(e.target.value) || 8 }
                            })}
                            className="w-20 h-8 text-xs border-cream-300 text-center"
                        />
                    </SettingRow>
                    <SettingRow
                        label="Yêu cầu ảnh check-in"
                        description="Bắt buộc chụp ảnh selfie khi check-in"
                    >
                        <Toggle
                            checked={config.attendance.requirePhoto}
                            onChange={(v) => setConfig({
                                ...config,
                                attendance: { ...config.attendance, requirePhoto: v }
                            })}
                        />
                    </SettingRow>

                    <Button
                        size="sm"
                        onClick={() => handleSave({ attendance: config.attendance })}
                        disabled={saving}
                        className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-8 mt-2"
                    >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        {saving ? "Đang lưu..." : "Lưu quy tắc chấm công"}
                    </Button>
                </SettingGroup>
            )}

            {/* ===== PAYROLL TAB ===== */}
            {activeTab === "payroll" && (
                <>
                    <SettingGroup title="Cấu hình lương cơ bản">
                        <SettingRow
                            label="Giờ chuẩn / ngày"
                            description="Số giờ làm tiêu chuẩn mỗi ngày"
                        >
                            <Input
                                type="number"
                                min="1"
                                max="24"
                                value={config.payroll.standardHoursPerDay}
                                onChange={(e) => setConfig({
                                    ...config,
                                    payroll: { ...config.payroll, standardHoursPerDay: parseInt(e.target.value) || 8 }
                                })}
                                className="w-20 h-8 text-xs border-cream-300 text-center"
                            />
                        </SettingRow>
                        <SettingRow
                            label="Hệ số OT (overtime)"
                            description="Hệ số nhân cho giờ làm thêm (VD: 1.5 = +50%)"
                        >
                            <Input
                                type="number"
                                min="1"
                                max="5"
                                step="0.1"
                                value={config.payroll.overtimeMultiplier}
                                onChange={(e) => setConfig({
                                    ...config,
                                    payroll: { ...config.payroll, overtimeMultiplier: parseFloat(e.target.value) || 1.5 }
                                })}
                                className="w-20 h-8 text-xs border-cream-300 text-center"
                            />
                        </SettingRow>
                        <SettingRow
                            label="Hệ số ca đêm"
                            description="Hệ số nhân cho ca tối/đêm"
                        >
                            <Input
                                type="number"
                                min="1"
                                max="5"
                                step="0.1"
                                value={config.payroll.nightShiftMultiplier}
                                onChange={(e) => setConfig({
                                    ...config,
                                    payroll: { ...config.payroll, nightShiftMultiplier: parseFloat(e.target.value) || 1.3 }
                                })}
                                className="w-20 h-8 text-xs border-cream-300 text-center"
                            />
                        </SettingRow>
                        <SettingRow
                            label="Ngày trả lương"
                            description="Ngày trong tháng để trả lương"
                        >
                            <Input
                                type="number"
                                min="1"
                                max="31"
                                value={config.payroll.payDay}
                                onChange={(e) => setConfig({
                                    ...config,
                                    payroll: { ...config.payroll, payDay: parseInt(e.target.value) || 5 }
                                })}
                                className="w-20 h-8 text-xs border-cream-300 text-center"
                            />
                        </SettingRow>
                    </SettingGroup>

                    <SettingGroup title="Thưởng doanh thu">
                        <SettingRow
                            label="Bật thưởng doanh thu"
                            description="Tính thưởng thêm dựa trên doanh thu cá nhân"
                        >
                            <Toggle
                                checked={config.payroll.bonusEnabled}
                                onChange={(v) => setConfig({
                                    ...config,
                                    payroll: { ...config.payroll, bonusEnabled: v }
                                })}
                            />
                        </SettingRow>

                        {config.payroll.bonusEnabled && (
                            <>
                                <SettingRow
                                    label="Loại thưởng"
                                    description="Thưởng cố định hoặc theo % doanh thu"
                                >
                                    <select
                                        value={config.payroll.bonusType}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            payroll: { ...config.payroll, bonusType: e.target.value as "FIXED" | "PERCENT_REVENUE" }
                                        })}
                                        className="w-40 h-8 rounded-md border border-cream-300 bg-cream-50 px-2 text-xs"
                                    >
                                        <option value="PERCENT_REVENUE">% Doanh thu</option>
                                        <option value="FIXED">Cố định</option>
                                    </select>
                                </SettingRow>
                                <SettingRow
                                    label="Ngưỡng kích hoạt thưởng"
                                    description={`Doanh thu tối thiểu để nhận thưởng (hiện: ${formatVND(config.payroll.bonusThreshold)})`}
                                >
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1000000"
                                        value={config.payroll.bonusThreshold}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            payroll: { ...config.payroll, bonusThreshold: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-36 h-8 text-xs border-cream-300"
                                    />
                                </SettingRow>
                                <SettingRow
                                    label={config.payroll.bonusType === "PERCENT_REVENUE" ? "% Thưởng" : "Số tiền thưởng"}
                                    description={config.payroll.bonusType === "PERCENT_REVENUE" ? "% doanh thu cá nhân" : "Số tiền thưởng cố định"}
                                >
                                    <Input
                                        type="number"
                                        min="0"
                                        step={config.payroll.bonusType === "PERCENT_REVENUE" ? "0.5" : "100000"}
                                        value={config.payroll.bonusValue}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            payroll: { ...config.payroll, bonusValue: parseFloat(e.target.value) || 0 }
                                        })}
                                        className="w-28 h-8 text-xs border-cream-300 text-center"
                                    />
                                </SettingRow>
                            </>
                        )}
                    </SettingGroup>

                    <SettingGroup title="Phí dịch vụ cho nhân viên">
                        <SettingRow
                            label="Chia phí dịch vụ cho NV"
                            description="Trích % phí dịch vụ (service charge) vào lương nhân viên"
                        >
                            <Toggle
                                checked={config.payroll.includeServiceCharge}
                                onChange={(v) => setConfig({
                                    ...config,
                                    payroll: { ...config.payroll, includeServiceCharge: v }
                                })}
                            />
                        </SettingRow>
                        {config.payroll.includeServiceCharge && (
                            <SettingRow
                                label="% phí dịch vụ chia cho NV"
                                description="Phần trăm phí dịch vụ chia cho tất cả nhân viên"
                            >
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={config.payroll.serviceChargePercent}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        payroll: { ...config.payroll, serviceChargePercent: parseInt(e.target.value) || 0 }
                                    })}
                                    className="w-20 h-8 text-xs border-cream-300 text-center"
                                />
                            </SettingRow>
                        )}
                    </SettingGroup>

                    <Button
                        size="sm"
                        onClick={() => handleSave({ payroll: config.payroll })}
                        disabled={saving}
                        className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-8"
                    >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        {saving ? "Đang lưu..." : "Lưu cài đặt lương"}
                    </Button>
                </>
            )}

            {/* ===== LEAVE TAB ===== */}
            {activeTab === "leave" && (
                <SettingGroup title="Chính sách nghỉ phép">
                    <SettingRow
                        label="Phép năm (ngày)"
                        description="Số ngày phép năm mỗi nhân viên được hưởng"
                    >
                        <Input
                            type="number"
                            min="0"
                            max="30"
                            value={config.leave.annualLeaveDays}
                            onChange={(e) => setConfig({
                                ...config,
                                leave: { ...config.leave, annualLeaveDays: parseInt(e.target.value) || 0 }
                            })}
                            className="w-20 h-8 text-xs border-cream-300 text-center"
                        />
                    </SettingRow>
                    <SettingRow
                        label="Nghỉ ốm (ngày)"
                        description="Số ngày nghỉ ốm có lương"
                    >
                        <Input
                            type="number"
                            min="0"
                            max="30"
                            value={config.leave.sickLeaveDays}
                            onChange={(e) => setConfig({
                                ...config,
                                leave: { ...config.leave, sickLeaveDays: parseInt(e.target.value) || 0 }
                            })}
                            className="w-20 h-8 text-xs border-cream-300 text-center"
                        />
                    </SettingRow>
                    <SettingRow
                        label="Cho phép cộng dồn phép"
                        description="Phép năm chưa dùng có thể chuyển sang năm sau"
                    >
                        <Toggle
                            checked={config.leave.carryOverEnabled}
                            onChange={(v) => setConfig({
                                ...config,
                                leave: { ...config.leave, carryOverEnabled: v }
                            })}
                        />
                    </SettingRow>
                    {config.leave.carryOverEnabled && (
                        <SettingRow
                            label="Số ngày cộng dồn tối đa"
                            description="Giới hạn số ngày phép cộng dồn sang năm mới"
                        >
                            <Input
                                type="number"
                                min="0"
                                max="30"
                                value={config.leave.maxCarryOverDays}
                                onChange={(e) => setConfig({
                                    ...config,
                                    leave: { ...config.leave, maxCarryOverDays: parseInt(e.target.value) || 0 }
                                })}
                                className="w-20 h-8 text-xs border-cream-300 text-center"
                            />
                        </SettingRow>
                    )}
                    <SettingRow
                        label="Yêu cầu phê duyệt"
                        description="Nghỉ phép phải được quản lý phê duyệt trước"
                    >
                        <Toggle
                            checked={config.leave.requireApproval}
                            onChange={(v) => setConfig({
                                ...config,
                                leave: { ...config.leave, requireApproval: v }
                            })}
                        />
                    </SettingRow>

                    <Button
                        size="sm"
                        onClick={() => handleSave({ leave: config.leave })}
                        disabled={saving}
                        className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-8 mt-2"
                    >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        {saving ? "Đang lưu..." : "Lưu chính sách nghỉ phép"}
                    </Button>
                </SettingGroup>
            )}

            {/* ===== ROLES TAB ===== */}
            {activeTab === "roles" && (
                <SettingGroup title="Vai trò & Thang lương">
                    <div className="rounded-lg border border-cream-200 overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-cream-200/60">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-green-900">Vai trò</th>
                                    <th className="px-3 py-2 text-left font-semibold text-green-900">Mã</th>
                                    <th className="px-3 py-2 text-right font-semibold text-green-900">Lương tối thiểu</th>
                                    <th className="px-3 py-2 text-right font-semibold text-green-900">Lương tối đa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-200">
                                {config.roles.map((role, idx) => (
                                    <tr key={role.key} className="hover:bg-cream-50 transition-colors">
                                        <td className="px-3 py-2.5">
                                            <Input
                                                value={role.label}
                                                onChange={(e) => {
                                                    const newRoles = [...config.roles]
                                                    newRoles[idx] = { ...role, label: e.target.value }
                                                    setConfig({ ...config, roles: newRoles })
                                                }}
                                                className="h-7 w-32 text-xs border-cream-300"
                                            />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="font-mono bg-cream-200 px-1.5 py-0.5 rounded text-[10px]">{role.key}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <Input
                                                type="number"
                                                min="0"
                                                step="500000"
                                                value={role.minSalary}
                                                onChange={(e) => {
                                                    const newRoles = [...config.roles]
                                                    newRoles[idx] = { ...role, minSalary: parseInt(e.target.value) || 0 }
                                                    setConfig({ ...config, roles: newRoles })
                                                }}
                                                className="h-7 w-32 text-xs border-cream-300 text-right"
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <Input
                                                type="number"
                                                min="0"
                                                step="500000"
                                                value={role.maxSalary}
                                                onChange={(e) => {
                                                    const newRoles = [...config.roles]
                                                    newRoles[idx] = { ...role, maxSalary: parseInt(e.target.value) || 0 }
                                                    setConfig({ ...config, roles: newRoles })
                                                }}
                                                className="h-7 w-32 text-xs border-cream-300 text-right"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                        {config.roles.map((role) => (
                            <div key={role.key} className="flex-1 rounded-lg bg-cream-200/50 border border-cream-200 p-3 text-center">
                                <p className="text-xs font-bold text-green-900">{role.label}</p>
                                <p className="text-[9px] text-cream-400 mt-1">
                                    {formatVND(role.minSalary)} — {formatVND(role.maxSalary)}
                                </p>
                            </div>
                        ))}
                    </div>

                    <Button
                        size="sm"
                        onClick={() => handleSave({ roles: config.roles })}
                        disabled={saving}
                        className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-8 mt-4"
                    >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        {saving ? "Đang lưu..." : "Lưu cấu hình vai trò"}
                    </Button>
                </SettingGroup>
            )}
        </div>
    )
}

// ============================================================
// OPERATIONAL SETTINGS
// ============================================================
function OperationalSettings() {
    const [discountThreshold, setDiscountThreshold] = useState("10")
    const [kpiEnabled, setKpiEnabledState] = useState(false)
    const [kpiLoading, setKpiLoading] = useState(true)

    useEffect(() => {
        isKpiEnabled().then(v => { setKpiEnabledState(v); setKpiLoading(false) })
    }, [])

    const handleToggleKpi = async (v: boolean) => {
        setKpiEnabledState(v)
        await setKpiEnabled(v)
        toast.success(v ? "Đã bật chỉ tiêu KPI" : "Đã tắt chỉ tiêu KPI")
    }

    return (
        <>
            <SettingGroup title="Chỉ tiêu KPI">
                <SettingRow label="Bật tính năng KPI" description="Cho phép đặt chỉ tiêu doanh thu, đơn hàng, v.v. theo tháng/tuần/ca">
                    {kpiLoading ? (
                        <div className="w-11 h-6 rounded-full bg-cream-200 animate-pulse" />
                    ) : (
                        <Toggle checked={kpiEnabled} onChange={handleToggleKpi} />
                    )}
                </SettingRow>
                {kpiEnabled && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                        <p className="text-[10px] text-green-700">
                            KPI đang bật — Chủ quán có thể đặt chỉ tiêu tháng/tuần tại <strong>Dashboard → Chỉ tiêu KPI</strong>.
                            Quản lý ca set chỉ tiêu đầu ca. Hệ thống tự cascade: Tháng → Tuần → Ca.
                        </p>
                    </div>
                )}
            </SettingGroup>

            <SettingGroup title="Giới hạn giảm giá">
                <SettingRow label="Ngưỡng giảm giá cần xác thực" description="Giảm giá vượt mức này cần Manager PIN">
                    <div className="flex items-center gap-1">
                        <Input
                            type="number"
                            min={5}
                            max={50}
                            value={discountThreshold}
                            onChange={(e) => setDiscountThreshold(e.target.value)}
                            className="w-20 h-8 text-xs border-cream-300 text-center"
                        />
                        <span className="text-xs text-cream-400">%</span>
                    </div>
                </SettingRow>
            </SettingGroup>

            <SettingGroup title="Manager PIN's">
                <div className="rounded-lg bg-cream-50 border border-cream-200 p-3">
                    <p className="text-[10px] text-cream-500 mb-2">Danh sách PIN Manager/Owner được quản lý qua module Nhân sự. Nhân viên có role MANAGER hoặc OWNER được dùng PIN để xác thực giảm giá.</p>
                    <p className="text-[10px] text-cream-400">Đi đến: Quản lý → Nhân sự để cập nhật PIN.</p>
                </div>
            </SettingGroup>

            <SettingGroup title="86 / Hết hàng">
                <div className="rounded-lg bg-cream-50 border border-cream-200 p-3">
                    <p className="text-[10px] text-cream-500">Sản phẩm bị đánh dấu 86 (hết hàng) sẽ tự động ẩn khỏi POS. Nhân viên bếp có thể đánh dấu/bỏ đánh dấu trực tiếp từ Kitchen Display.</p>
                </div>
            </SettingGroup>
        </>
    )
}

// ============================================================
// SETUP BAN ĐẦU — One-time POS configuration
// ============================================================
function SetupSettings() {
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("PAY_AFTER")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        getPosConfig().then(config => {
            setPaymentMode(config.paymentMode)
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    const handleModeChange = async (mode: PaymentMode) => {
        setPaymentMode(mode)
        setSaving(true)
        const res = await updatePosConfig({ paymentMode: mode })
        setSaving(false)
        if (res.success) {
            toast.success(mode === "PAY_FIRST" ? "Đã chuyển sang Thanh toán trước" : "Đã chuyển sang Thanh toán sau")
        } else {
            toast.error("Lỗi khi lưu cài đặt")
        }
    }

    if (loading) return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>

    return (
        <>
            <SettingGroup title="Chế độ thanh toán POS">
                <p className="text-[10px] text-cream-500 mb-4">Chọn quy trình thanh toán phù hợp với mô hình kinh doanh. Thay đổi sẽ áp dụng cho các đơn hàng mới.</p>

                {/* Warning banner */}
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
                    <div className="flex items-start gap-2">
                        <div>
                            <p className="text-[10px] font-semibold text-amber-800">Cài đặt quan trọng</p>
                            <p className="text-[10px] text-amber-700 mt-0.5">Đây là cài đặt cấu hình ban đầu. Việc thay đổi giữa chừng có thể gây nhầm lẫn cho nhân viên và ảnh hưởng đến quy trình vận hành.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* PAY AFTER */}
                    <button
                        onClick={() => handleModeChange("PAY_AFTER")}
                        disabled={saving}
                        className={cn(
                            "rounded-xl border-2 p-4 text-left transition-all",
                            paymentMode === "PAY_AFTER"
                                ? "border-green-600 bg-green-50 shadow-md"
                                : "border-cream-200 bg-cream-50 hover:border-cream-400"
                        )}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg",
                                paymentMode === "PAY_AFTER" ? "bg-green-600 text-white" : "bg-cream-200 text-cream-500"
                            )}>
                                <Banknote className="h-4 w-4" />
                            </div>
                            <div>
                                <p className={cn("text-sm font-bold", paymentMode === "PAY_AFTER" ? "text-green-900" : "text-cream-600")}>Thanh toán sau</p>
                                <p className="text-[9px] text-cream-400">Nhà hàng · Wine bar · Bistro</p>
                            </div>
                            {paymentMode === "PAY_AFTER" && <Check className="h-4 w-4 text-green-600 ml-auto" />}
                        </div>
                        <div className="space-y-1 mt-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-cream-600">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-700">1</span>
                                Chọn bàn
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-cream-600">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-700">2</span>
                                Gọi món → Gửi bếp
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-cream-600">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-700">3</span>
                                Phục vụ (có thể gọi thêm)
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-cream-600">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[8px] font-bold text-green-700">4</span>
                                <strong>Thanh toán</strong> khi xong
                            </div>
                        </div>
                    </button>

                    {/* PAY FIRST */}
                    <button
                        onClick={() => handleModeChange("PAY_FIRST")}
                        disabled={saving}
                        className={cn(
                            "rounded-xl border-2 p-4 text-left transition-all",
                            paymentMode === "PAY_FIRST"
                                ? "border-green-600 bg-green-50 shadow-md"
                                : "border-cream-200 bg-cream-50 hover:border-cream-400"
                        )}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg",
                                paymentMode === "PAY_FIRST" ? "bg-green-600 text-white" : "bg-cream-200 text-cream-500"
                            )}>
                                <CreditCard className="h-4 w-4" />
                            </div>
                            <div>
                                <p className={cn("text-sm font-bold", paymentMode === "PAY_FIRST" ? "text-green-900" : "text-cream-600")}>Thanh toán trước</p>
                                <p className="text-[9px] text-cream-400">Coffee shop · Trà sữa · Fast food</p>
                            </div>
                            {paymentMode === "PAY_FIRST" && <Check className="h-4 w-4 text-green-600 ml-auto" />}
                        </div>
                        <div className="space-y-1 mt-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-cream-600">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-700">1</span>
                                Chọn món
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-cream-600">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[8px] font-bold text-green-700">2</span>
                                <strong>Thanh toán</strong> ngay
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-cream-600">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-700">3</span>
                                Gửi bếp pha chế
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-cream-600">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-700">4</span>
                                Chọn bàn phục vụ (tuỳ chọn)
                            </div>
                        </div>
                    </button>
                </div>
            </SettingGroup>

            {/* Current mode indicator */}
            <div className={cn(
                "rounded-xl border p-4 mt-4",
                paymentMode === "PAY_FIRST" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
            )}>
                <p className={cn("text-xs font-bold mb-1", paymentMode === "PAY_FIRST" ? "text-amber-800" : "text-green-800")}>
                    {paymentMode === "PAY_FIRST" ? "Chế độ: Thanh toán trước" : "Chế độ: Thanh toán sau"}
                </p>
                <ul className="text-[10px] space-y-0.5 list-disc list-inside">
                    {paymentMode === "PAY_FIRST" ? (
                        <>
                            <li className="text-amber-700">Khách thanh toán ngay khi gọi món</li>
                            <li className="text-amber-700">Không cần chọn bàn trước</li>
                            <li className="text-amber-700">Có thể gán bàn sau khi phục vụ</li>
                            <li className="text-amber-700">Takeaway luôn thanh toán trước</li>
                        </>
                    ) : (
                        <>
                            <li className="text-green-700">Khách ngồi bàn → gọi món → thanh toán khi xong</li>
                            <li className="text-green-700">Bắt buộc chọn bàn trước khi gọi</li>
                            <li className="text-green-700">Có thể gọi thêm nhiều lần</li>
                            <li className="text-green-700">Takeaway vẫn luôn thanh toán trước</li>
                        </>
                    )}
                </ul>
            </div>

            {saving && <p className="text-center text-xs text-cream-400 mt-3 animate-pulse">Đang lưu...</p>}
        </>
    )
}

// ============================================================
// RBAC — Role-Based Access Control Settings
// ============================================================

const ROLE_LABELS_MAP: Record<string, string> = {
    OWNER: "Chủ quán",
    MANAGER: "Quản lý",
    CASHIER: "Thu ngân",
    BARTENDER: "Bartender",
    WAITER: "Phục vụ",
    KITCHEN: "Bếp",
}

const ROLE_COLORS_MAP: Record<string, string> = {
    OWNER: "bg-wine-100 text-wine-700",
    MANAGER: "bg-blue-100 text-blue-700",
    CASHIER: "bg-emerald-100 text-emerald-700",
    BARTENDER: "bg-amber-100 text-amber-700",
    WAITER: "bg-stone-100 text-stone-700 border border-stone-200",
    KITCHEN: "bg-orange-100 text-orange-700",
}

function RbacSettings() {
    const [config, setConfig] = useState<RbacConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [selectedRole, setSelectedRole] = useState<string>("MANAGER")
    const staff = useAuthStore(s => s.staff)
    const isOwner = staff?.role === "OWNER"

    useEffect(() => {
        getRbacConfig().then((c) => { setConfig(c); setLoading(false) })
    }, [])

    const handleToggle = async (
        role: string, moduleId: string, perm: Permission, checked: boolean
    ) => {
        if (!config || role === "OWNER") return // OWNER always has all permissions
        setSaving(true)

        const updated = { ...config }
        if (!updated.roles[role]) updated.roles[role] = {}
        if (!updated.roles[role][moduleId]) updated.roles[role][moduleId] = []

        if (checked) {
            if (!updated.roles[role][moduleId].includes(perm)) {
                updated.roles[role][moduleId] = [...updated.roles[role][moduleId], perm]
            }
        } else {
            updated.roles[role][moduleId] = updated.roles[role][moduleId].filter(p => p !== perm)
        }

        setConfig(updated)
        await updateRbacConfig(updated)
        setSaving(false)
        toast.success("Đã cập nhật quyền")
    }

    const handleToggleModule = async (role: string, moduleId: string, checked: boolean) => {
        if (!config || role === "OWNER") return
        setSaving(true)

        const module = RBAC_MODULES.find(m => m.moduleId === moduleId)
        if (!module) return

        const updated = { ...config }
        if (!updated.roles[role]) updated.roles[role] = {}
        updated.roles[role][moduleId] = checked ? [...module.permissions] : []

        setConfig(updated)
        await updateRbacConfig(updated)
        setSaving(false)
        toast.success(checked ? "Đã bật tất cả quyền" : "Đã tắt tất cả quyền")
    }

    const handleReset = async () => {
        if (!window.confirm("Khôi phục về quyền mặc định? Tất cả tuỳ chỉnh sẽ bị mất.")) return
        setSaving(true)
        await resetRbacToDefault()
        const fresh = await getRbacConfig()
        setConfig(fresh)
        setSaving(false)
        toast.success("Đã khôi phục quyền mặc định")
    }

    if (loading || !config) {
        return <div className="text-center py-12 text-cream-400 text-sm">Đang tải...</div>
    }

    if (!isOwner) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <h3 className="font-display text-sm font-bold text-green-900 mb-1">Không có quyền truy cập</h3>
                <p className="text-xs text-cream-400">Chỉ Chủ quán (Owner) mới được cấu hình phân quyền.</p>
            </div>
        )
    }

    const currentRolePerms = config.roles[selectedRole] ?? {}

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
                <div>
                    <h2 className="font-display text-base font-bold text-green-900 flex items-center gap-2">
                        Phân quyền (RBAC)
                    </h2>
                    <p className="text-[10px] text-cream-400 mt-0.5">
                        Cấu hình quyền truy cập cho từng vai trò. Owner luôn có toàn quyền.
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cream-300 text-[10px] font-medium text-cream-500 hover:bg-cream-200 hover:text-red-600 transition-all"
                >
                    <AlertTriangle className="h-3 w-3" />
                    Khôi phục mặc định
                </button>
            </div>

            {/* Role selector tabs */}
            <div className="flex gap-1.5 mb-5 overflow-x-auto scroll-hide-bar pb-1">
                {ALL_ROLES.filter(r => r !== "OWNER").map(role => (
                    <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                            selectedRole === role
                                ? "bg-green-900 text-cream-50 shadow-sm"
                                : cn("border border-cream-200 hover:bg-cream-200", ROLE_COLORS_MAP[role])
                        )}
                    >
                        {ROLE_LABELS_MAP[role]}
                    </button>
                ))}
            </div>

            {/* Info */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 mb-4">
                <p className="text-[10px] text-blue-700">
                    <strong>Đang chỉnh quyền cho:</strong>{" "}
                    <span className={cn("inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold", ROLE_COLORS_MAP[selectedRole])}>
                        {ROLE_LABELS_MAP[selectedRole]}
                    </span>
                    {" "}— Tick để bật, bỏ tick để tắt quyền.
                </p>
            </div>

            {/* Permission Matrix table */}
            <div className="rounded-xl border border-cream-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-cream-200/60">
                                <th className="px-3 py-2.5 text-left font-semibold text-green-900 min-w-[180px]">Module</th>
                                <th className="px-2 py-2.5 text-center font-semibold text-green-900 w-10">Tất cả</th>
                                {["view", "create", "edit", "delete", "approve"].map(p => (
                                    <th key={p} className="px-2 py-2.5 text-center font-semibold text-green-900 w-12">
                                        {PERMISSION_LABELS[p as Permission]}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cream-200">
                            {RBAC_MODULES.map((mod) => {
                                const roleModPerms = currentRolePerms[mod.moduleId] ?? []
                                const allChecked = mod.permissions.every(p => roleModPerms.includes(p))
                                const someChecked = mod.permissions.some(p => roleModPerms.includes(p))

                                return (
                                    <tr key={mod.moduleId} className="hover:bg-cream-50/80 transition-colors">
                                        <td className="px-3 py-2.5">
                                            <span className="font-medium text-green-900">{mod.label}</span>
                                        </td>
                                        {/* Toggle ALL for this module */}
                                        <td className="px-2 py-2.5 text-center">
                                            <input
                                                type="checkbox"
                                                checked={allChecked}
                                                ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                                                onChange={(e) => handleToggleModule(selectedRole, mod.moduleId, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded border-cream-300 text-green-700 focus:ring-green-500 cursor-pointer accent-green-700"
                                            />
                                        </td>
                                        {/* Individual permissions */}
                                        {(["view", "create", "edit", "delete", "approve"] as Permission[]).map(perm => {
                                            const available = mod.permissions.includes(perm)
                                            const checked = roleModPerms.includes(perm)

                                            if (!available) {
                                                return (
                                                    <td key={perm} className="px-2 py-2.5 text-center">
                                                        <span className="text-cream-300">—</span>
                                                    </td>
                                                )
                                            }

                                            return (
                                                <td key={perm} className="px-2 py-2.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => handleToggle(selectedRole, mod.moduleId, perm, e.target.checked)}
                                                        className="h-3.5 w-3.5 rounded border-cream-300 text-green-700 focus:ring-green-500 cursor-pointer accent-green-700"
                                                    />
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3">
                {(["view", "create", "edit", "delete", "approve"] as Permission[]).map(p => (
                    <div key={p} className="flex items-center gap-1 text-[10px] text-cream-500">
                        <span className="font-bold text-green-800">{PERMISSION_LABELS[p]}</span>
                        <span>—</span>
                        <span>
                            {p === "view" && "Xem danh sách và chi tiết"}
                            {p === "create" && "Tạo mới bản ghi"}
                            {p === "edit" && "Chỉnh sửa bản ghi"}
                            {p === "delete" && "Xoá bản ghi"}
                            {p === "approve" && "Duyệt/xác nhận action"}
                        </span>
                    </div>
                ))}
            </div>

            {/* Summary cards — all roles overview */}
            <div className="mt-6">
                <SettingGroup title="Tổng quan quyền — Tất cả vai trò">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {ALL_ROLES.map(role => {
                            const perms = config.roles[role] ?? {}
                            const moduleCount = Object.values(perms).filter(p => p.length > 0).length
                            const totalPerms = Object.values(perms).reduce((s, p) => s + p.length, 0)

                            return (
                                <button
                                    key={role}
                                    onClick={() => { if (role !== "OWNER") setSelectedRole(role) }}
                                    className={cn(
                                        "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                                        role === "OWNER"
                                            ? "border-wine-200 bg-wine-50/50"
                                            : selectedRole === role
                                                ? "border-green-400 bg-green-50 ring-1 ring-green-300"
                                                : "border-cream-200 bg-cream-50 hover:border-cream-300"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className={cn("inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold", ROLE_COLORS_MAP[role])}>
                                            {ROLE_LABELS_MAP[role]}
                                        </span>
                                        {role === "OWNER" && (
                                            <span className="text-[8px] text-wine-500 font-medium">TOÀN QUYỀN</span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-bold text-green-900">{moduleCount}</span>
                                        <span className="text-[10px] text-cream-400">modules</span>
                                        <span className="text-[10px] text-cream-300">·</span>
                                        <span className="text-sm font-bold text-green-700">{totalPerms}</span>
                                        <span className="text-[10px] text-cream-400">quyền</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </SettingGroup>
            </div>

            {saving && <p className="text-center text-xs text-cream-400 mt-3 animate-pulse">Đang lưu...</p>}
        </>
    )
}

function InvoiceConfigSettings() {
    const [config, setConfig] = useState<InvoiceConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        getInvoiceConfig().then((cfg) => {
            setConfig(cfg)
            setLoading(false)
        })
    }, [])

    const handleSave = async (updated: Partial<InvoiceConfig>) => {
        if (!config) return
        const next = { ...config, ...updated }
        setConfig(next)
        setSaving(true)
        try {
            const res = await updateInvoiceConfig(updated)
            if (res.success) {
                toast.success("Đã lưu cấu hình hoá đơn VAT")
            } else {
                toast.error(res.error || "Không thể lưu cấu hình")
            }
        } catch {
            toast.error("Lỗi khi lưu cài đặt")
        } finally {
            setSaving(false)
        }
    }

    if (loading || !config) {
        return (
            <div className="flex items-center justify-center py-12 text-cream-500">
                <p className="text-xs">Đang tải cài đặt hoá đơn VAT...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="font-display text-base font-bold text-green-900">
                    Cấu hình Hoá đơn Điện tử & Mã QR Bill
                </h2>
                <p className="text-xs text-cream-500">
                    Thiết lập thông tin pháp nhân của quán, thời hạn quét mã và in QR trên hoá đơn nhiệt
                </p>
            </div>

            {/* Toggle QR code on Receipt */}
            <SettingGroup title="In mã QR trên bill nhiệt">
                <div className="flex items-center justify-between rounded-xl border border-cream-200 bg-white p-4">
                    <div>
                        <p className="text-xs font-semibold text-green-950">
                            In mã QR xuất hoá đơn VAT ở chân bill
                        </p>
                        <p className="text-[11px] text-cream-500 mt-0.5">
                            Khi bật, mọi phiếu in thanh toán sẽ tự động kèm mã QR để khách dùng điện thoại quét và tự nhập MST lấy HĐ.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enableQrInvoice}
                            onChange={(e) => handleSave({ enableQrInvoice: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-cream-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-800"></div>
                    </label>
                </div>
            </SettingGroup>

            {/* Seller Business Information */}
            <SettingGroup title="Thông tin Doanh nghiệp xuất hoá đơn (Bên bán)">
                <div className="space-y-3 bg-white p-4 rounded-xl border border-cream-200">
                    <div>
                        <label className="text-xs font-semibold text-green-950">
                            Tên doanh nghiệp / Đơn vị
                        </label>
                        <Input
                            value={config.sellerCompanyName}
                            onChange={(e) => setConfig({ ...config, sellerCompanyName: e.target.value })}
                            onBlur={() => handleSave({ sellerCompanyName: config.sellerCompanyName })}
                            placeholder="CÔNG TY TNHH..."
                            className="text-xs mt-1 bg-cream-50"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-green-950">
                                Mã số thuế (MST) của quán
                            </label>
                            <Input
                                value={config.sellerTaxCode}
                                onChange={(e) => setConfig({ ...config, sellerTaxCode: e.target.value })}
                                onBlur={() => handleSave({ sellerTaxCode: config.sellerTaxCode })}
                                placeholder="0318xxxxxx"
                                className="text-xs font-mono mt-1 bg-cream-50"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-green-950">
                                Email kế toán nhận thông báo
                            </label>
                            <Input
                                type="email"
                                value={config.sellerEmail}
                                onChange={(e) => setConfig({ ...config, sellerEmail: e.target.value })}
                                onBlur={() => handleSave({ sellerEmail: config.sellerEmail })}
                                placeholder="ketoan@noonnoir.vn"
                                className="text-xs mt-1 bg-cream-50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-green-950">
                            Địa chỉ trụ sở đăng ký kinh doanh
                        </label>
                        <Input
                            value={config.sellerAddress}
                            onChange={(e) => setConfig({ ...config, sellerAddress: e.target.value })}
                            onBlur={() => handleSave({ sellerAddress: config.sellerAddress })}
                            placeholder="Địa chỉ trụ sở..."
                            className="text-xs mt-1 bg-cream-50"
                        />
                    </div>
                </div>
            </SettingGroup>

            {/* Expiry and VAT rate */}
            <SettingGroup title="Thời hạn & Thuế suất">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-cream-200">
                    <div>
                        <label className="text-xs font-semibold text-green-950">
                            Thời hạn quét QR (giờ)
                        </label>
                        <Input
                            type="number"
                            min={1}
                            max={168}
                            value={config.requestExpireHours}
                            onChange={(e) => setConfig({ ...config, requestExpireHours: Number(e.target.value) || 48 })}
                            onBlur={() => handleSave({ requestExpireHours: config.requestExpireHours })}
                            className="text-xs mt-1 font-mono bg-cream-50"
                        />
                        <p className="text-[11px] text-cream-500 mt-1">
                            Mặc định là 48 giờ. Sau thời gian này link QR của đơn hàng sẽ báo hết hạn.
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-green-950">
                            Thuế suất VAT (%)
                        </label>
                        <Input
                            type="number"
                            min={0}
                            max={20}
                            value={config.vatRate}
                            onChange={(e) => setConfig({ ...config, vatRate: Number(e.target.value) || 10 })}
                            onBlur={() => handleSave({ vatRate: config.vatRate })}
                            className="text-xs mt-1 font-mono bg-cream-50"
                        />
                        <p className="text-[11px] text-cream-500 mt-1">
                            Tỷ lệ VAT áp dụng trên các mặt hàng dịch vụ (thường là 8% hoặc 10%).
                        </p>
                    </div>
                </div>
            </SettingGroup>

            {saving && (
                <p className="text-center text-xs text-cream-500 animate-pulse">
                    Đang tự động lưu cài đặt...
                </p>
            )}
        </div>
    )
}

