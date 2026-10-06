"use client"

import { useState, useEffect, useCallback } from "react"
import { Armchair, Plus, RefreshCcw, Users, Clock, DollarSign, Check, Trash2, Sparkles, X, MapPin } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateTableStatus, createTable, createZone, deleteTable, deleteZone } from "@/actions/tables"
import { getTablesPageData } from "@/actions/tables-loader"
import { TablesInlineSkeleton } from "@/components/inline-skeletons"
import { usePrefetchStore } from "@/stores/prefetch-store"
import dynamic from "next/dynamic"

const FloorPlanEditor = dynamic(() => import("@/components/floor-plan-editor"), { ssr: false })

type TablesPageData = Awaited<ReturnType<typeof getTablesPageData>>
type FloorTable = TablesPageData["tables"][number]
type TableZone = TablesPageData["zones"][number]

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}p`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${m}p` : `${h}h`
}

const STATUS_CONFIG: Record<
    FloorTable["status"],
    { label: string; color: string; bg: string; border: string; ring: string }
> = {
    AVAILABLE: {
        label: "Trống",
        color: "text-green-700",
        bg: "bg-green-50",
        border: "border-green-300",
        ring: "ring-green-400/30",
    },
    OCCUPIED: {
        label: "Đang dùng",
        color: "text-wine-700",
        bg: "bg-wine-50",
        border: "border-wine-300",
        ring: "ring-wine-400/30",
    },
    RESERVED: {
        label: "Đặt trước",
        color: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-300",
        ring: "ring-amber-400/30",
    },
    CLEANING: {
        label: "Dọn dẹp",
        color: "text-cream-600",
        bg: "bg-cream-100",
        border: "border-cream-400",
        ring: "ring-cream-400/30",
    },
    MERGED: {
        label: "Ghép bàn",
        color: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-300",
        ring: "ring-blue-400/30",
    },
}

export function TablesClient({ initialData }: { initialData: TablesPageData }) {
    const [zones, setZones] = useState<TableZone[]>(initialData.zones as TableZone[])
    const [tables, setTables] = useState<FloorTable[]>(initialData.tables as FloorTable[])
    const [selectedZone, setSelectedZone] = useState<string>("all")
    const [stats, setStats] = useState(initialData.stats)
    const [loading, setLoading] = useState(false)
    const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null)
    const [showAddTable, setShowAddTable] = useState(false)
    const [showZoneManager, setShowZoneManager] = useState(false)
    const [viewMode, setViewMode] = useState<"list" | "floorplan">("list")

    const [activeOrderMap, setActiveOrderMap] = useState<Record<string, { orderNo: string; total: number; createdAt: Date; itemCount: number }>>(() => {
        const orderMap: Record<string, { orderNo: string; total: number; createdAt: Date; itemCount: number }> = {}
        for (const [tableId, order] of Object.entries(initialData.activeOrderMap as Record<string, any>)) {
            orderMap[tableId] = { ...order, createdAt: new Date(order.createdAt) }
        }
        return orderMap
    })

    const applyData = useCallback((data: any) => {
        setZones(data.zones as TableZone[])
        setTables(data.tables as FloorTable[])
        setStats(data.stats)
        const orderMap: Record<string, { orderNo: string; total: number; createdAt: Date; itemCount: number }> = {}
        for (const [tableId, order] of Object.entries(data.activeOrderMap as Record<string, any>)) {
            orderMap[tableId] = {
                ...order,
                createdAt: new Date(order.createdAt),
            }
        }
        setActiveOrderMap(orderMap)
    }, [])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getTablesPageData(selectedZone === "all" ? undefined : selectedZone)
            usePrefetchStore.getState().set('tables', data)
            applyData(data)
        } catch {
            toast.error("Không thể tải dữ liệu bàn")
        }
        setLoading(false)
    }, [selectedZone, applyData])

    useEffect(() => {
        usePrefetchStore.getState().set('tables', initialData)
        const interval = setInterval(loadData, 30000)
        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleStatusChange = async (tableId: string, newStatus: FloorTable["status"]) => {
        const result = await updateTableStatus(tableId, newStatus)
        if (result.success) {
            toast.success("Đã cập nhật trạng thái bàn")
            loadData()
            setSelectedTable(null)
        }
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Quản lý Bàn</h1>
                        <p className="text-sm text-cream-500">Sơ đồ bàn & trạng thái real-time</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        className="border-cream-300 text-cream-600 btn-press"
                    >
                        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                        Làm mới
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowZoneManager(true)}
                        className="border-cream-300 text-cream-600 btn-press"
                    >
                        <MapPin className="mr-1.5 h-3.5 w-3.5" />
                        Khu vực
                    </Button>
                    <Button size="sm" className="bg-green-900 text-cream-50 hover:bg-green-800 btn-press" onClick={() => setShowAddTable(true)}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Thêm bàn
                    </Button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                {[
                    { label: "Tổng bàn", value: stats.total, icon: Armchair, color: "text-green-900", bg: "bg-cream-100" },
                    { label: "Trống", value: stats.available, icon: Check, color: "text-green-600", bg: "bg-green-50" },
                    { label: "Đang dùng", value: stats.occupied, icon: Users, color: "text-wine-600", bg: "bg-wine-50" },
                    { label: "Đặt trước", value: stats.reserved, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "Dọn dẹp", value: stats.cleaning, icon: Sparkles, color: "text-cream-500", bg: "bg-cream-100" },
                ].map((stat) => {
                    return (
                        <div
                            key={stat.label}
                            className={cn(
                                "flex items-center gap-3 rounded-xl border border-cream-300 px-4 py-3",
                                stat.bg
                            )}
                        >
                            <div>
                                <p className={cn("font-mono text-xl font-bold", stat.color)}>{stat.value}</p>
                                <p className="text-[10px] text-cream-400">{stat.label}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* View Toggle + Zone Filter */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                        onClick={() => setSelectedZone("all")}
                        className={cn(
                            "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                            selectedZone === "all"
                                ? "bg-green-900 text-cream-50"
                                : "bg-cream-200 text-cream-500 hover:bg-cream-300"
                        )}
                    >
                        Tất cả
                    </button>
                    {zones.map((zone) => (
                        <button
                            key={zone.id}
                            onClick={() => setSelectedZone(zone.id)}
                            className={cn(
                                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                                selectedZone === zone.id
                                    ? "bg-green-900 text-cream-50"
                                    : "bg-cream-200 text-cream-500 hover:bg-cream-300"
                            )}
                        >
                            {zone.name}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 bg-cream-200 rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode("list")}
                        className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            viewMode === "list" ? "bg-white text-green-900 shadow-sm" : "text-cream-500 hover:text-green-900"
                        )}
                    >
                        Danh sách
                    </button>
                    <button
                        onClick={() => setViewMode("floorplan")}
                        className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            viewMode === "floorplan" ? "bg-white text-green-900 shadow-sm" : "text-cream-500 hover:text-green-900"
                        )}
                    >
                        Sơ đồ
                    </button>
                </div>
            </div>

            {/* Floor Plan View */}
            {viewMode === "floorplan" && selectedZone !== "all" && (
                <FloorPlanEditor
                    tables={tables.map(t => ({
                        id: t.id, tableNumber: t.tableNumber, seats: t.seats,
                        status: t.status, shape: t.shape,
                        posX: t.posX, posY: t.posY,
                        width: t.width, height: t.height,
                        rotation: t.rotation, zoneId: t.zoneId,
                    }))}
                    zoneId={selectedZone}
                    layoutData={zones.find(z => z.id === selectedZone)?.layoutData as { walls: Array<{ id: string; type: "wall" | "door" | "label"; x1: number; y1: number; x2: number; y2: number; label?: string }> } | null}
                    onSaved={loadData}
                />
            )}

            {viewMode === "floorplan" && selectedZone === "all" && (
                <div className="bg-white rounded-xl border border-cream-300 p-12 text-center">
                    <p className="text-green-800 font-medium">Chọn một khu vực để xem sơ đồ mặt bằng</p>
                    <p className="text-cream-400 text-sm mt-1">Sơ đồ hiển thị cho từng khu vực riêng biệt</p>
                </div>
            )}

            {/* Table Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 xl:grid-cols-6">
                {tables.map((table) => {
                    const cfg = STATUS_CONFIG[table.status]
                    const isSelected = selectedTable?.id === table.id
                    return (
                        <button
                            key={table.id}
                            onClick={() =>
                                setSelectedTable(isSelected ? null : table)
                            }
                            className={cn(
                                "relative flex flex-col items-center rounded-xl border-2 p-4 card-hover",
                                cfg.bg,
                                cfg.border,
                                isSelected && `ring-2 ${cfg.ring} shadow-lg scale-[1.02]`
                            )}
                        >
                            {/* Table number */}
                            <span className="font-display text-lg lg:text-2xl font-bold text-green-900">
                                {table.tableNumber}
                            </span>

                            {/* Seats */}
                            <span className="mt-0.5 text-[10px] text-cream-400 flex items-center gap-1">
                                <Users className="h-2.5 w-2.5" />
                                {table.seats} chỗ
                            </span>

                            {/* Zone */}
                            <span className="text-[9px] text-cream-400 mt-0.5">
                                {table.zone?.name ?? ""}
                            </span>

                            {/* Status badge */}
                            <span
                                className={cn(
                                    "mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                                    cfg.bg,
                                    cfg.color,
                                    "border",
                                    cfg.border
                                )}
                            >
                                {cfg.label}
                            </span>

                            {/* Occupied info — from real active orders */}
                            {table.status === "OCCUPIED" && activeOrderMap[table.id] && (() => {
                                const order = activeOrderMap[table.id]
                                const elapsed = Math.floor((Date.now() - order.createdAt.getTime()) / 60000)
                                return (
                                    <div className="mt-2 space-y-0.5 text-center">
                                        <p className="text-[10px] text-cream-500 font-mono">
                                            {order.orderNo}
                                        </p>
                                        <p className="text-[10px] text-wine-600">
                                            {order.itemCount} món
                                        </p>
                                        <p className="flex items-center justify-center gap-0.5 text-[10px] text-cream-500">
                                            {formatDuration(elapsed)}
                                        </p>
                                        <p className="font-mono text-xs font-bold text-wine-700">
                                            ₫{formatPrice(order.total)}
                                        </p>
                                    </div>
                                )
                            })()}
                        </button>
                    )
                })}
            </div>

            {/* Quick Action Panel */}
            {selectedTable && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 translate-x-[110px] z-30">
                    <div className="flex items-center gap-2 rounded-2xl border border-cream-300 bg-cream-50 px-5 py-3 shadow-2xl">
                        <span className="font-display text-sm font-bold text-green-900 mr-2">
                            {selectedTable.tableNumber}
                        </span>
                        <span className="text-[10px] text-cream-400 mr-3">
                            {STATUS_CONFIG[selectedTable.status].label}
                        </span>

                        {selectedTable.status === "AVAILABLE" && (
                            <>
                                <Button
                                    size="sm"
                                    className="bg-green-700 text-cream-50 hover:bg-green-600 text-xs"
                                    onClick={() => handleStatusChange(selectedTable.id, "OCCUPIED")}
                                >
                                    <Users className="mr-1 h-3 w-3" />
                                    Mở bàn
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs"
                                    onClick={() => handleStatusChange(selectedTable.id, "RESERVED")}
                                >
                                    <Clock className="mr-1 h-3 w-3" />
                                    Đặt trước
                                </Button>
                            </>
                        )}
                        {selectedTable.status === "OCCUPIED" && (
                            <>
                                <Button
                                    size="sm"
                                    className="bg-wine-700 text-cream-50 hover:bg-wine-600 text-xs"
                                    onClick={() => {
                                        toast.success(`Thanh toán bàn ${selectedTable.tableNumber}`)
                                        handleStatusChange(selectedTable.id, "CLEANING")
                                    }}
                                >
                                    <DollarSign className="mr-1 h-3 w-3" />
                                    Thanh toán
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-cream-300 text-cream-500 text-xs"
                                    onClick={() => handleStatusChange(selectedTable.id, "CLEANING")}
                                >
                                    <Sparkles className="mr-1 h-3 w-3" />
                                    Dọn bàn
                                </Button>
                            </>
                        )}
                        {selectedTable.status === "RESERVED" && (
                            <>
                                <Button
                                    size="sm"
                                    className="bg-green-700 text-cream-50 hover:bg-green-600 text-xs"
                                    onClick={() => handleStatusChange(selectedTable.id, "OCCUPIED")}
                                >
                                    <Users className="mr-1 h-3 w-3" />
                                    Khách đến
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-cream-300 text-cream-500 text-xs"
                                    onClick={() => handleStatusChange(selectedTable.id, "AVAILABLE")}
                                >
                                    Hủy đặt
                                </Button>
                            </>
                        )}
                        {selectedTable.status === "CLEANING" && (
                            <Button
                                size="sm"
                                className="bg-green-700 text-cream-50 hover:bg-green-600 text-xs"
                                onClick={() => handleStatusChange(selectedTable.id, "AVAILABLE")}
                            >
                                <Check className="mr-1 h-3 w-3" />
                                Sẵn sàng
                            </Button>
                        )}

                        {selectedTable.status === "AVAILABLE" && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-500 text-xs hover:bg-red-50"
                                onClick={async () => {
                                    const r = await deleteTable(selectedTable.id)
                                    if (r.success) { toast.success("Đã xóa bàn"); setSelectedTable(null); loadData() }
                                    else toast.error(r.error ?? "Lỗi")
                                }}
                            >
                                <Trash2 className="mr-1 h-3 w-3" /> Xóa
                            </Button>
                        )}

                        <button
                            onClick={() => setSelectedTable(null)}
                            className="ml-2 rounded-lg p-1.5 text-cream-400 hover:bg-cream-200 transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="mt-8 flex items-center justify-center gap-6">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <span key={key} className="flex items-center gap-1.5 text-[11px] text-cream-500">
                        <span className={cn("h-3 w-3 rounded-full border", cfg.bg, cfg.border)} />
                        {cfg.label}
                    </span>
                ))}
            </div>

            {/* Brand tagline */}
            <p className="mt-6 text-center font-script text-sm text-cream-400 italic">
                drink slowly · laugh quietly · stay longer
            </p>

            {/* ============ ADD TABLE MODAL ============ */}
            {showAddTable && (
                <AddTableModal zones={zones} onClose={() => setShowAddTable(false)} onCreated={() => { setShowAddTable(false); loadData() }} />
            )}

            {/* ============ ZONE MANAGER MODAL ============ */}
            {showZoneManager && (
                <ZoneManagerModal zones={zones} onClose={() => setShowZoneManager(false)} onChanged={loadData} />
            )}
        </div>
    )
}

// ============================================================
// ADD TABLE MODAL
// ============================================================
function AddTableModal({ zones, onClose, onCreated }: { zones: TableZone[]; onClose: () => void; onCreated: () => void }) {
    const [tableNumber, setTableNumber] = useState("")
    const [seats, setSeats] = useState(4)
    const [zoneId, setZoneId] = useState(zones[0]?.id ?? "")
    const [shape, setShape] = useState("square")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!tableNumber.trim()) { toast.error("Nhập số bàn"); return }
        setSubmitting(true)
        const r = await createTable({ zoneId, tableNumber: tableNumber.trim(), seats, shape })
        setSubmitting(false)
        if (r.success) { toast.success(`Đã thêm bàn ${tableNumber}`); onCreated() }
        else toast.error(r.error ?? "Lỗi")
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-modal-backdrop">
            <div className="w-full max-w-[380px] rounded-2xl border border-cream-200 bg-white shadow-2xl animate-modal-content">
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                    <h2 className="text-lg font-bold text-green-900">Thêm bàn mới</h2>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100"><X className="h-4 w-4 text-cream-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Số bàn *</label>
                        <Input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="VD: T15, VIP3" className="h-9 text-xs border-cream-300" autoFocus />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Khu vực *</label>
                        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="w-full h-9 rounded-md border border-cream-300 px-3 text-xs bg-white">
                            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Số chỗ</label>
                            <Input type="number" value={seats} onChange={(e) => setSeats(Number(e.target.value))} min={1} max={20} className="h-9 text-xs border-cream-300" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Hình dạng</label>
                            <div className="flex gap-1">
                                {["square", "circle", "rectangle"].map((s) => (
                                    <button key={s} onClick={() => setShape(s)} className={cn("flex-1 rounded-md py-1.5 text-[10px] font-medium border", shape === s ? "bg-green-900 text-cream-50 border-green-900" : "border-cream-300 text-cream-500")}>
                                        {s === "square" ? "Vuông" : s === "circle" ? "Tròn" : "Dài"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={onClose} variant="outline" size="sm" className="flex-1 border-cream-300 text-cream-500">Hủy</Button>
                        <Button onClick={handleSubmit} disabled={submitting} size="sm" className="flex-1 bg-green-900 text-white hover:bg-green-800">
                            {submitting ? "Đang tạo..." : "Tạo bàn"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// ZONE MANAGER MODAL
// ============================================================
function ZoneManagerModal({ zones, onClose, onChanged }: { zones: TableZone[]; onClose: () => void; onChanged: () => void }) {
    const [newName, setNewName] = useState("")
    const [adding, setAdding] = useState(false)

    const handleAdd = async () => {
        if (!newName.trim()) return
        setAdding(true)
        const r = await createZone({ name: newName.trim() })
        setAdding(false)
        if (r.success) { toast.success(`Đã thêm "${newName}"`); setNewName(""); onChanged() }
    }

    const handleDelete = async (id: string, name: string) => {
        const r = await deleteZone(id)
        if (r.success) { toast.success(`Đã xóa "${name}"`); onChanged() }
        else toast.error(r.error ?? "Lỗi")
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-modal-backdrop">
            <div className="w-full max-w-[360px] rounded-2xl border border-cream-200 bg-white shadow-2xl animate-modal-content">
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                    <h2 className="text-lg font-bold text-green-900">Quản lý khu vực</h2>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100"><X className="h-4 w-4 text-cream-400" /></button>
                </div>
                <div className="p-5 space-y-3">
                    {zones.map((zone) => (
                        <div key={zone.id} className="flex items-center justify-between rounded-lg border border-cream-200 px-3 py-2">
                            <span className="text-xs font-medium text-green-900">{zone.name}</span>
                            <button onClick={() => handleDelete(zone.id, zone.name)} className="rounded p-1 text-cream-400 hover:text-red-500 hover:bg-red-50 transition-all">
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    <div className="flex gap-2">
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tên khu vực mới" className="h-8 text-xs border-cream-300 flex-1" onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }} />
                        <Button onClick={handleAdd} disabled={adding} size="sm" className="bg-green-900 text-white hover:bg-green-800 h-8">
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
