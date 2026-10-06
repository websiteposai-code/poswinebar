"use client"

import { useState } from "react"
import { Package, Search, AlertTriangle, CheckCircle2, XCircle, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Trash2, X, Calendar, RefreshCcw, Archive, Clock, Wrench, Beaker, CookingPot, TrendingDown, Shield } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    getInventory,
    getInventoryStats,
    getStockMovements,
    adjustStock,
    type InventoryItem,
    type InventoryStatus,
    type StockMovement,
} from "@/actions/inventory"
import {
    getRawMaterials,
    getRawMaterialStats,
    getRecipes,
    getEquipment,
    getEquipmentStats,
    getDepreciationHistory,
    adjustRawMaterial,
    runMonthlyDepreciation,
    type RawMaterial,
    type Equipment,
    type Recipe,
    type DepreciationEntry,
} from "@/actions/assets"
import { useAuthStore } from "@/stores/auth-store"
import { AddIngredientModal, RecipeManagerModal } from "@/components/recipe-ingredient-modals"

function fmt(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

function fmtK(amount: number): string {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`
    return String(amount)
}

const STATUS_CFG: Record<InventoryStatus, { label: string; cls: string }> = {
    IN_STOCK: { label: "Còn hàng", cls: "bg-green-100 text-green-700" },
    LOW_STOCK: { label: "Sắp hết", cls: "bg-amber-100 text-amber-700" },
    OUT_OF_STOCK: { label: "Hết hàng", cls: "bg-red-100 text-red-700" },
}

const MV_LABELS: Record<string, string> = { IN: "Nhập kho", OUT: "Xuất kho", ADJUSTMENT: "Điều chỉnh", WASTE: "Hao hụt" }
const MV_COLORS: Record<string, string> = { IN: "text-green-600 bg-green-100", OUT: "text-wine-600 bg-wine-100", ADJUSTMENT: "text-blue-600 bg-blue-100", WASTE: "text-red-600 bg-red-100" }
const MV_ICONS: Record<string, typeof ArrowDownToLine> = { IN: ArrowDownToLine, OUT: ArrowUpFromLine, ADJUSTMENT: RotateCcw, WASTE: Trash2 }

const EQ_STATUS: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Đang dùng", cls: "bg-green-100 text-green-700" },
    MAINTENANCE: { label: "Bảo trì", cls: "bg-amber-100 text-amber-700" },
    RETIRED: { label: "Thanh lý", cls: "bg-cream-200 text-cream-600" },
    DAMAGED: { label: "Hư hỏng", cls: "bg-red-100 text-red-700" },
}

type MainTab = "inventory" | "npl" | "ccdc"

function StatCard({ label, value, color, icon: Icon }: { label: string; value: string | number; color: string; icon: typeof Package }) {
    return (
        <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">{label}</span>
            </div>
            <p className={cn("font-mono text-xl font-bold leading-none", color)}>{value}</p>
        </div>
    )
}

const TH = "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-cream-400 bg-cream-50 border-b border-cream-200 whitespace-nowrap"
const THR = cn(TH, "text-right")
const THC = cn(TH, "text-center")
const TD = "px-3 py-3 text-xs text-green-900 border-b border-cream-100 whitespace-nowrap"
const TDR = cn(TD, "text-right font-mono")
const TDC = cn(TD, "text-center")

export type InventoryInitialData = {
    items: InventoryItem[]
    stats: Awaited<ReturnType<typeof getInventoryStats>>
    movements: StockMovement[]
    materials: RawMaterial[]
    nplStats: Awaited<ReturnType<typeof getRawMaterialStats>>
    recipes: Recipe[]
    equipment: Equipment[]
    eqStats: Awaited<ReturnType<typeof getEquipmentStats>>
    depHistory: DepreciationEntry[]
}

export function InventoryClient({ initialData }: { initialData: InventoryInitialData }) {
    const { staff } = useAuthStore()

    const [items, setItems] = useState(initialData.items)
    const [stats, setStats] = useState(initialData.stats)
    const [movements, setMovements] = useState(initialData.movements)
    const [materials, setMaterials] = useState(initialData.materials)
    const [nplStats, setNplStats] = useState(initialData.nplStats)
    const [recipes, setRecipes] = useState(initialData.recipes)
    const [equipment, setEquipment] = useState(initialData.equipment)
    const [eqStats, setEqStats] = useState(initialData.eqStats)
    const [depHistory, setDepHistory] = useState(initialData.depHistory)

    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<InventoryStatus | "ALL">("ALL")
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
    const [showAdjust, setShowAdjust] = useState(false)
    const [subTab, setSubTab] = useState<"list" | "movements">("list")
    const [nplSubTab, setNplSubTab] = useState<"materials" | "recipes">("materials")
    const [selectedMat, setSelectedMat] = useState<RawMaterial | null>(null)
    const [showAddIngredient, setShowAddIngredient] = useState(false)
    const [editRecipe, setEditRecipe] = useState<{ productId: string; productName: string; recipe: Recipe | null } | null>(null)
    const [ccdcSubTab, setCcdcSubTab] = useState<"list" | "depreciation">("list")
    const [isRunningDep, setIsRunningDep] = useState(false)
    const [mainTab, setMainTab] = useState<MainTab>("inventory")

    const loadData = async () => {
        const [inv, invStats, mvs, mats, nStats, recs, eqs, eStats, deps] = await Promise.all([
            getInventory(),
            getInventoryStats(),
            getStockMovements(),
            getRawMaterials(),
            getRawMaterialStats(),
            getRecipes(),
            getEquipment(),
            getEquipmentStats(),
            getDepreciationHistory(),
        ])
        setItems(inv)
        setStats(invStats)
        setMovements(mvs)
        setMaterials(mats)
        setNplStats(nStats)
        setRecipes(recs)
        setEquipment(eqs)
        setEqStats(eStats)
        setDepHistory(deps)
    }

    const filtered = items.filter((item) => {
        const matchSearch = !searchTerm
            || item.productName.toLowerCase().includes(searchTerm.toLowerCase())
            || item.sku.toLowerCase().includes(searchTerm.toLowerCase())
        const matchStatus = statusFilter === "ALL" || item.status === statusFilter
        return matchSearch && matchStatus
    })

    const filteredMats = materials.filter((m) =>
        !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-5">
            {/* ── Header ── */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Kho hàng</h1>
                        <p className="text-sm text-cream-500">Hàng bán, Nguyên liệu & Công cụ dụng cụ</p>
                    </div>
                </div>
                <Button onClick={loadData} variant="outline" size="sm" className="border-cream-300 text-cream-500">
                    <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
                </Button>
            </div>

            {/* ── Main Tab Switch ── */}
            <div className="flex gap-1 rounded-lg bg-cream-200 p-0.5 w-fit">
                {([
                    { key: "inventory" as MainTab, label: "Hàng bán", count: items.length },
                    { key: "npl" as MainTab, label: "Nguyên liệu", count: materials.length },
                    { key: "ccdc" as MainTab, label: "CCDC", count: equipment.length },
                ] as const).map((t) => (
                    <button
                        key={t.key}
                        onClick={() => { setMainTab(t.key); setSearchTerm(""); setSelectedItem(null); setSelectedMat(null) }}
                        className={cn(
                            "rounded-md px-4 py-2 text-xs font-semibold transition-all",
                            mainTab === t.key ? "bg-green-900 text-cream-50 shadow-sm" : "text-cream-500 hover:text-cream-700"
                        )}
                    >
                        {t.label} <span className="ml-1 opacity-60">{t.count}</span>
                    </button>
                ))}
            </div>

            {/* ================================================================ */}
            {/*  INVENTORY TAB                                                    */}
            {/* ================================================================ */}
            {mainTab === "inventory" && (
                <>
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                            <StatCard label="Tổng SKU" value={stats.totalItems} color="text-green-900" icon={Package} />
                            <StatCard label="Còn hàng" value={stats.inStock} color="text-green-600" icon={CheckCircle2} />
                            <StatCard label="Sắp hết" value={stats.lowStock} color="text-amber-600" icon={AlertTriangle} />
                            <StatCard label="Hết hàng" value={stats.outOfStock} color="text-red-600" icon={XCircle} />
                            <StatCard label="Giá trị kho" value={`₫${fmtK(stats.totalValue)}`} color="text-wine-700" icon={Archive} />
                            <StatCard label="Sắp hết hạn" value={stats.expiringSoon} color="text-orange-600" icon={Calendar} />
                        </div>
                    )}

                    {/* Sub tabs + filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-1 rounded-lg bg-cream-200 p-0.5 overflow-x-auto scroll-hide-bar">
                            <button onClick={() => setSubTab("list")} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-all", subTab === "list" ? "bg-green-900 text-cream-50" : "text-cream-500")}>Tồn kho</button>
                            <button onClick={() => setSubTab("movements")} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-all", subTab === "movements" ? "bg-green-900 text-cream-50" : "text-cream-500")}>Lịch sử XNK</button>
                        </div>
                        {subTab === "list" && (
                            <>
                                <div className="relative max-w-[220px]">
                                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                                    <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm sản phẩm, SKU..." className="h-8 pl-8 text-xs border-cream-300 bg-white" />
                                </div>
                                <div className="flex gap-1">
                                    {(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const).map((s) => (
                                        <button key={s} onClick={() => setStatusFilter(s)} className={cn("rounded-md px-2.5 py-1 text-[10px] font-medium transition-all", statusFilter === s ? "bg-green-900 text-cream-50" : "bg-cream-200 text-cream-500")}>{s === "ALL" ? "Tất cả" : STATUS_CFG[s].label}</button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {subTab === "list" ? (
                        <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className={TH}>Sản phẩm</th>
                                        <th className={TH} style={{ width: 90 }}>SKU</th>
                                        <th className={THC} style={{ width: 70 }}>Tồn kho</th>
                                        <th className={THC} style={{ width: 70 }}>Min/Max</th>
                                        <th className={TH} style={{ width: 110 }}>Mức tồn</th>
                                        <th className={THR} style={{ width: 100 }}>Giá vốn</th>
                                        <th className={THC} style={{ width: 80 }}>Trạng thái</th>
                                        <th className={THC} style={{ width: 72 }}>Hạn SD</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((item) => {
                                        const cfg = STATUS_CFG[item.status]
                                        const stockPct = item.maxStock > 0 ? Math.min((item.currentStock / item.maxStock) * 100, 100) : 0
                                        const isSelected = selectedItem?.id === item.id
                                        const isExpiring = item.expiryDate && ((new Date(item.expiryDate).getTime() - Date.now()) / 86400000) <= 14
                                        return (
                                            <tr
                                                key={item.id}
                                                onClick={() => { setSelectedItem(isSelected ? null : item); setShowAdjust(false) }}
                                                className={cn("cursor-pointer transition-colors hover:bg-green-50/50", isSelected && "bg-green-50 ring-1 ring-inset ring-green-200")}
                                            >
                                                <td className={TD}>
                                                    <p className="font-medium leading-tight">{item.productName}</p>
                                                    <p className="text-[10px] text-cream-400 leading-tight">{item.category}</p>
                                                </td>
                                                <td className={cn(TD, "font-mono text-[11px] text-cream-500")}>{item.sku}</td>
                                                <td className={TDC}>
                                                    <span className={cn("font-bold text-sm", item.status === "OUT_OF_STOCK" ? "text-red-600" : item.status === "LOW_STOCK" ? "text-amber-600" : "text-green-900")}>{item.currentStock}</span>
                                                    <span className="text-[9px] text-cream-400 ml-0.5">{item.unit}</span>
                                                </td>
                                                <td className={cn(TDC, "text-[11px] text-cream-500")}>{item.minStock} / {item.maxStock}</td>
                                                <td className={TD}>
                                                    <div className="h-1.5 w-full rounded-full bg-cream-200 overflow-x-auto">
                                                        <div className={cn("h-full rounded-full transition-all", item.status === "OUT_OF_STOCK" ? "bg-red-400" : item.status === "LOW_STOCK" ? "bg-amber-400" : "bg-green-500")} style={{ width: `${stockPct}%` }} />
                                                    </div>
                                                </td>
                                                <td className={TDR}>₫{fmt(item.costPrice)}</td>
                                                <td className={TDC}>
                                                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[9px] font-bold leading-tight", cfg.cls)}>{cfg.label}</span>
                                                </td>
                                                <td className={cn(TDC, "text-[11px]", isExpiring ? "text-red-600 font-bold" : "text-cream-400")}>
                                                    {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : "—"}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {filtered.length === 0 && <div className="py-12 text-center text-sm text-cream-400">Không tìm thấy sản phẩm</div>}
                        </div>
                    ) : (
                        /* Movement History */
                        <div className="rounded-xl border border-cream-200 bg-white overflow-hidden shadow-sm divide-y divide-cream-100">
                            {movements.map((mv) => {
                                const Icon = MV_ICONS[mv.type] ?? RotateCcw
                                return (
                                    <div key={mv.id} className="flex items-center gap-3 px-4 py-3">
                                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", MV_COLORS[mv.type])}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-green-900 leading-tight">{mv.productName}</p>
                                            <p className="text-[10px] text-cream-400 leading-tight mt-0.5">
                                                {mv.reason} · {mv.staffName} · {new Date(mv.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        <span className={cn("font-mono text-[10px] font-bold rounded-full px-2 py-0.5", MV_COLORS[mv.type])}>{MV_LABELS[mv.type]}</span>
                                        <div className="text-right min-w-[80px]">
                                            <span className={cn("font-mono text-sm font-bold", mv.type === "IN" ? "text-green-700" : "text-red-600")}>{mv.type === "IN" ? "+" : "-"}{mv.quantity}</span>
                                            <p className="text-[9px] text-cream-400">{mv.previousStock} → {mv.newStock}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Floating Adjust Panel */}
                    {selectedItem && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
                            <div className="rounded-xl border border-cream-200 bg-white px-4 py-3 shadow-xl flex items-center gap-3">
                                {!showAdjust ? (
                                    <>
                                        <span className="text-xs font-bold text-green-900 max-w-[180px] truncate">{selectedItem.productName}</span>
                                        <span className="font-mono text-xs text-cream-500">({selectedItem.currentStock} {selectedItem.unit})</span>
                                        <div className="h-4 w-px bg-cream-200" />
                                        <button onClick={() => setShowAdjust(true)} className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-[10px] font-bold text-green-700 hover:bg-green-200 transition-all"><ArrowDownToLine className="h-3 w-3" /> Nhập kho</button>
                                        <button onClick={() => setShowAdjust(true)} className="flex items-center gap-1 rounded-lg bg-wine-100 px-3 py-1.5 text-[10px] font-bold text-wine-700 hover:bg-wine-200 transition-all"><ArrowUpFromLine className="h-3 w-3" /> Xuất kho</button>
                                        <button onClick={() => setSelectedItem(null)} className="rounded-lg p-1.5 text-cream-400 hover:bg-cream-200 transition-all"><X className="h-3.5 w-3.5" /></button>
                                    </>
                                ) : (
                                    <AdjustForm item={selectedItem} staffName={staff?.fullName ?? "Staff"} onSuccess={() => { setShowAdjust(false); setSelectedItem(null); loadData() }} onCancel={() => setShowAdjust(false)} />
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ================================================================ */}
            {/*  NPL TAB                                                          */}
            {/* ================================================================ */}
            {mainTab === "npl" && (
                <>
                    {nplStats && (
                        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                            <StatCard label="Tổng NPL" value={nplStats.totalItems} color="text-green-900" icon={Beaker} />
                            <StatCard label="Còn hàng" value={nplStats.inStock} color="text-green-600" icon={CheckCircle2} />
                            <StatCard label="Sắp hết" value={nplStats.lowStock} color="text-amber-600" icon={AlertTriangle} />
                            <StatCard label="Hết hàng" value={nplStats.outOfStock} color="text-red-600" icon={XCircle} />
                            <StatCard label="Giá trị" value={`₫${fmtK(nplStats.totalValue)}`} color="text-wine-700" icon={Archive} />
                            <StatCard label="Sắp hết hạn" value={nplStats.expiringSoon} color="text-orange-600" icon={Calendar} />
                            <StatCard label="Nhóm NPL" value={nplStats.categories} color="text-blue-600" icon={CookingPot} />
                        </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-1 rounded-lg bg-cream-200 p-0.5 overflow-x-auto scroll-hide-bar">
                            <button onClick={() => setNplSubTab("materials")} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-all", nplSubTab === "materials" ? "bg-green-900 text-cream-50" : "text-cream-500")}>Nguyên liệu</button>
                            <button onClick={() => setNplSubTab("recipes")} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-all", nplSubTab === "recipes" ? "bg-green-900 text-cream-50" : "text-cream-500")}>Công thức ({recipes.length})</button>
                        </div>
                        {nplSubTab === "materials" && (
                            <>
                                <div className="relative max-w-[220px]">
                                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                                    <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm nguyên liệu..." className="h-8 pl-8 text-xs border-cream-300 bg-white" />
                                </div>
                                <Button size="sm" className="bg-green-900 text-cream-50 hover:bg-green-800 ml-auto" onClick={() => setShowAddIngredient(true)}>
                                    + Thêm NL
                                </Button>
                            </>
                        )}
                    </div>

                    {nplSubTab === "materials" ? (
                        <div className="rounded-xl border border-cream-200 bg-white overflow-hidden shadow-sm">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className={TH}>Nguyên liệu</th>
                                        <th className={TH} style={{ width: 90 }}>SKU</th>
                                        <th className={THC} style={{ width: 80 }}>Tồn kho</th>
                                        <th className={THC} style={{ width: 50 }}>Min</th>
                                        <th className={TH} style={{ width: 100 }}>Mức tồn</th>
                                        <th className={THR} style={{ width: 110 }}>Đơn giá</th>
                                        <th className={THC} style={{ width: 80 }}>Trạng thái</th>
                                        <th className={THC} style={{ width: 72 }}>Hạn SD</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMats.map((mat) => {
                                        const cfg = STATUS_CFG[mat.status]
                                        const stockPct = mat.minStock > 0 ? Math.min((mat.currentStock / (mat.minStock * 3)) * 100, 100) : 100
                                        const isSelected = selectedMat?.id === mat.id
                                        const isExpiring = mat.expiryDate && ((new Date(mat.expiryDate).getTime() - Date.now()) / 86400000) <= 7
                                        return (
                                            <tr
                                                key={mat.id}
                                                onClick={() => setSelectedMat(isSelected ? null : mat)}
                                                className={cn("cursor-pointer transition-colors hover:bg-green-50/50", isSelected && "bg-green-50 ring-1 ring-inset ring-green-200")}
                                            >
                                                <td className={TD}>
                                                    <p className="font-medium leading-tight">{mat.name}</p>
                                                    <p className="text-[10px] text-cream-400 leading-tight">{mat.category}{mat.supplierName && ` · ${mat.supplierName}`}</p>
                                                </td>
                                                <td className={cn(TD, "font-mono text-[11px] text-cream-500")}>{mat.sku}</td>
                                                <td className={TDC}>
                                                    <span className={cn("font-bold text-sm", mat.status === "OUT_OF_STOCK" ? "text-red-600" : mat.status === "LOW_STOCK" ? "text-amber-600" : "text-green-900")}>{mat.currentStock}</span>
                                                    <span className="text-[9px] text-cream-400 ml-0.5">{mat.unit}</span>
                                                </td>
                                                <td className={cn(TDC, "text-[11px] text-cream-500")}>{mat.minStock}</td>
                                                <td className={TD}>
                                                    <div className="h-1.5 w-full rounded-full bg-cream-200 overflow-x-auto">
                                                        <div className={cn("h-full rounded-full", mat.status === "OUT_OF_STOCK" ? "bg-red-400" : mat.status === "LOW_STOCK" ? "bg-amber-400" : "bg-green-500")} style={{ width: `${stockPct}%` }} />
                                                    </div>
                                                </td>
                                                <td className={TDR}>₫{fmt(mat.costPrice)}/{mat.unit}</td>
                                                <td className={TDC}>
                                                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[9px] font-bold leading-tight", cfg.cls)}>{cfg.label}</span>
                                                </td>
                                                <td className={cn(TDC, "text-[11px]", isExpiring ? "text-red-600 font-bold" : "text-cream-400")}>
                                                    {mat.expiryDate ? new Date(mat.expiryDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : "—"}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Recipes */
                        <div className="space-y-4">
                            {recipes.map((recipe) => (
                                <div key={recipe.id} className="rounded-xl border border-cream-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-green-900">{recipe.productName}</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-wine-700">Giá vốn: ₫{fmt(recipe.totalCost)}</span>
                                            <button onClick={() => setEditRecipe({ productId: recipe.productId, productName: recipe.productName, recipe })} className="px-2 py-1 text-[10px] font-medium bg-green-100 text-green-700 rounded hover:bg-green-200">Sửa</button>
                                        </div>
                                    </div>
                                    <table className="w-full">
                                        <thead>
                                            <tr>
                                                <th className={TH}>Nguyên liệu</th>
                                                <th className={THR} style={{ width: 80 }}>Số lượng</th>
                                                <th className={THR} style={{ width: 100 }}>Đơn giá</th>
                                                <th className={THR} style={{ width: 100 }}>Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recipe.ingredients.map((ing, i) => (
                                                <tr key={i}>
                                                    <td className={TD}>{ing.materialName}</td>
                                                    <td className={TDR}>{ing.quantity} {ing.unit}</td>
                                                    <td className={TDR}>₫{fmt(ing.costPerUnit)}</td>
                                                    <td className={cn(TDR, "font-bold text-wine-700")}>₫{fmt(Math.round(ing.quantity * ing.costPerUnit))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {recipe.notes && <p className="mt-2 text-[10px] text-cream-400 italic">{recipe.notes}</p>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* NPL Adjust floating */}
                    {selectedMat && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
                            <div className="rounded-xl border border-cream-200 bg-white px-4 py-3 shadow-xl flex items-center gap-3">
                                <span className="text-xs font-bold text-green-900 max-w-[160px] truncate">{selectedMat.name}</span>
                                <span className="font-mono text-xs text-cream-500">({selectedMat.currentStock} {selectedMat.unit})</span>
                                <div className="h-4 w-px bg-cream-200" />
                                <button onClick={async () => { await adjustRawMaterial(selectedMat.id, "IN", 1, "Nhập thêm"); toast.success("Nhập +1 " + selectedMat.unit); setSelectedMat(null); loadData() }} className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-[10px] font-bold text-green-700 hover:bg-green-200 transition-all"><ArrowDownToLine className="h-3 w-3" /> +1</button>
                                <button onClick={async () => { const r = await adjustRawMaterial(selectedMat.id, "OUT", 1, "Xuất dùng"); if (r.success) { toast.success("Xuất -1 " + selectedMat.unit) } else { toast.error(r.error ?? "") }; setSelectedMat(null); loadData() }} className="flex items-center gap-1 rounded-lg bg-wine-100 px-3 py-1.5 text-[10px] font-bold text-wine-700 hover:bg-wine-200 transition-all"><ArrowUpFromLine className="h-3 w-3" /> -1</button>
                                <button onClick={() => setSelectedMat(null)} className="rounded-lg p-1.5 text-cream-400 hover:bg-cream-200"><X className="h-3.5 w-3.5" /></button>
                            </div>
                        </div>
                    )}

                    {/* GAP-15: Add Ingredient Modal */}
                    {showAddIngredient && (
                        <AddIngredientModal onClose={() => setShowAddIngredient(false)} onCreated={loadData} />
                    )}

                    {/* GAP-14: Recipe Editor Modal */}
                    {editRecipe && (
                        <RecipeManagerModal
                            productId={editRecipe.productId}
                            productName={editRecipe.productName}
                            recipe={editRecipe.recipe}
                            onClose={() => setEditRecipe(null)}
                            onSaved={loadData}
                        />
                    )}
                </>
            )}

            {/* ================================================================ */}
            {/*  CCDC TAB                                                         */}
            {/* ================================================================ */}
            {mainTab === "ccdc" && (
                <>
                    {eqStats && (
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                            <StatCard label="Tổng CCDC" value={eqStats.totalItems} color="text-green-900" icon={Wrench} />
                            <StatCard label="Đang dùng" value={eqStats.activeItems} color="text-green-600" icon={CheckCircle2} />
                            <StatCard label="Nguyên giá" value={`₫${fmtK(eqStats.totalOriginalValue)}`} color="text-blue-700" icon={Archive} />
                            <StatCard label="Hao mòn LK" value={`₫${fmtK(eqStats.totalAccumulatedDep)}`} color="text-wine-600" icon={TrendingDown} />
                            <StatCard label="Giá trị còn" value={`₫${fmtK(eqStats.totalNetBookValue)}`} color="text-green-700" icon={Shield} />
                            <StatCard label="KH / tháng" value={`₫${fmtK(eqStats.monthlyDepTotal)}`} color="text-amber-600" icon={Clock} />
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex gap-1 rounded-lg bg-cream-200 p-0.5 w-fit">
                            <button onClick={() => setCcdcSubTab("list")} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-all", ccdcSubTab === "list" ? "bg-green-900 text-cream-50" : "text-cream-500")}>Danh mục CCDC</button>
                            <button onClick={() => setCcdcSubTab("depreciation")} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-all", ccdcSubTab === "depreciation" ? "bg-green-900 text-cream-50" : "text-cream-500")}>Lịch sử khấu hao ({depHistory.length})</button>
                        </div>
                        <Button
                            onClick={async () => {
                                setIsRunningDep(true)
                                const result = await runMonthlyDepreciation()
                                if (result.success) {
                                    toast.success(`Khấu hao tháng ${result.month}`, {
                                        description: `${result.entriesCreated} CCDC · Tổng: ₫${fmtK(result.totalDepreciation)}`,
                                        duration: 6000,
                                    })
                                    for (const e of result.entries) {
                                        if (e.fullyDepreciated) {
                                            toast.warning(`${e.equipmentName} đã hết khấu hao`, {
                                                description: "Tự động chuyển trạng thái → Thanh lý",
                                                duration: 8000,
                                            })
                                        }
                                    }
                                    setCcdcSubTab("depreciation")
                                    loadData()
                                } else {
                                    toast.error(`${result.skipped[0]?.reason ?? "Lỗi không xác định"}`, { duration: 5000 })
                                }
                                setIsRunningDep(false)
                            }}
                            disabled={isRunningDep}
                            size="sm"
                            className="bg-wine-600 text-cream-50 hover:bg-wine-700 text-xs"
                        >
                            {isRunningDep ? (
                                <><RotateCcw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Đang chạy...</>
                            ) : (
                                <><TrendingDown className="mr-1.5 h-3.5 w-3.5" /> Chạy KH tháng này</>
                            )}
                        </Button>
                    </div>

                    {ccdcSubTab === "list" ? (
                        <div className="rounded-xl border border-cream-200 bg-white overflow-x-auto shadow-sm">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className={TH}>Tên CCDC</th>
                                        <th className={TH} style={{ width: 90 }}>Mã</th>
                                        <th className={THC} style={{ width: 40 }}>SL</th>
                                        <th className={THR} style={{ width: 100 }}>Nguyên giá</th>
                                        <th className={TH} style={{ width: 130 }}>Hao mòn LK</th>
                                        <th className={THR} style={{ width: 100 }}>Giá trị còn</th>
                                        <th className={THR} style={{ width: 85 }}>KH/tháng</th>
                                        <th className={THC} style={{ width: 80 }}>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipment.map((eq) => {
                                        const depPct = eq.totalValue > 0 ? (eq.accumulatedDepreciation / eq.totalValue) * 100 : 0
                                        const eqCfg = EQ_STATUS[eq.status] ?? EQ_STATUS.ACTIVE
                                        return (
                                            <tr key={eq.id} className="hover:bg-green-50/50 transition-colors">
                                                <td className={TD}>
                                                    <p className="font-medium leading-tight">{eq.name}</p>
                                                    <p className="text-[10px] text-cream-400 leading-tight">{eq.category} · {eq.location} · {eq.usefulLifeMonths}th</p>
                                                </td>
                                                <td className={cn(TD, "font-mono text-[11px] text-cream-500")}>{eq.code}</td>
                                                <td className={cn(TDC, "font-bold")}>{eq.quantity}</td>
                                                <td className={TDR}>₫{fmtK(eq.totalValue)}</td>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 rounded-full bg-cream-200 overflow-x-auto">
                                                            <div className="h-full rounded-full bg-wine-400 transition-all" style={{ width: `${depPct}%` }} />
                                                        </div>
                                                        <span className="font-mono text-[10px] text-wine-600 min-w-[48px] text-right">₫{fmtK(eq.accumulatedDepreciation)}</span>
                                                    </div>
                                                </td>
                                                <td className={cn(TDR, "font-bold text-green-700")}>₫{fmtK(eq.netBookValue)}</td>
                                                <td className={cn(TDR, "text-amber-600")}>₫{fmtK(eq.monthlyDepreciation)}</td>
                                                <td className={TDC}>
                                                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[9px] font-bold leading-tight", eqCfg.cls)}>{eqCfg.label}</span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-cream-200 bg-white overflow-hidden shadow-sm">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className={TH}>CCDC</th>
                                        <th className={THC} style={{ width: 80 }}>Tháng</th>
                                        <th className={THR} style={{ width: 100 }}>Khấu hao</th>
                                        <th className={THR} style={{ width: 100 }}>HM trước</th>
                                        <th className={THR} style={{ width: 100 }}>HM sau</th>
                                        <th className={THR} style={{ width: 100 }}>Giá trị còn</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {depHistory.map((dep) => (
                                        <tr key={dep.id} className="hover:bg-green-50/50 transition-colors">
                                            <td className={cn(TD, "font-medium")}>{dep.equipmentName}</td>
                                            <td className={cn(TDC, "font-mono text-cream-500")}>{dep.month}</td>
                                            <td className={cn(TDR, "font-bold text-wine-600")}>-₫{fmtK(dep.amount)}</td>
                                            <td className={cn(TDR, "text-cream-500")}>₫{fmtK(dep.accumulatedBefore)}</td>
                                            <td className={cn(TDR, "text-cream-600")}>₫{fmtK(dep.accumulatedAfter)}</td>
                                            <td className={cn(TDR, "font-bold text-green-700")}>₫{fmtK(dep.netBookValue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

/* ─── Adjust Stock Form ─── */
function AdjustForm({ item, staffName, onSuccess, onCancel }: { item: InventoryItem; staffName: string; onSuccess: () => void; onCancel: () => void }) {
    const [type, setType] = useState<"IN" | "OUT" | "WASTE">("IN")
    const [qty, setQty] = useState("")
    const [reason, setReason] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        const quantity = parseInt(qty)
        if (!quantity || quantity <= 0) { toast.error("Số lượng không hợp lệ"); return }
        if (!reason.trim()) { toast.error("Vui lòng nhập lý do"); return }
        setSubmitting(true)
        const result = await adjustStock(item.id, type, quantity, reason, staffName)
        if (result.success) { toast.success(`${type === "IN" ? "Nhập" : "Xuất"} ${quantity} ${item.unit} thành công`); onSuccess() }
        else { toast.error(result.error ?? "Lỗi") }
        setSubmitting(false)
    }

    return (
        <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-green-900 min-w-[100px] max-w-[140px] truncate">{item.productName}</span>
            <div className="flex gap-0.5 rounded-lg bg-cream-200 p-0.5">
                {(["IN", "OUT", "WASTE"] as const).map((t) => (
                    <button key={t} onClick={() => setType(t)} className={cn("rounded-md px-2 py-1 text-[9px] font-bold transition-all", type === t ? t === "IN" ? "bg-green-700 text-white" : t === "OUT" ? "bg-wine-700 text-white" : "bg-red-700 text-white" : "text-cream-500")}>{MV_LABELS[t]}</button>
                ))}
            </div>
            <Input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="SL" className="w-16 h-7 text-xs text-center border-cream-300 bg-white" />
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do..." className="w-32 h-7 text-xs border-cream-300 bg-white" />
            <Button onClick={handleSubmit} disabled={submitting} size="sm" className="h-7 bg-green-900 text-cream-50 text-[10px] hover:bg-green-800">Xác nhận</Button>
            <button onClick={onCancel} className="rounded-lg p-1 text-cream-400 hover:bg-cream-200"><X className="h-3 w-3" /></button>
        </div>
    )
}
