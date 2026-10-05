"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
    Move, RotateCw, Save, PenTool, DoorOpen,
    Trash2, Circle, Square, RectangleHorizontal, X, Type, Edit3, Check,
} from "lucide-react"
import { updateTablePositions, updateZoneLayout, updateTable } from "@/actions/tables"

// ============================================================
// TYPES
// ============================================================

type FloorTable = {
    id: string; tableNumber: string; seats: number; status: string
    shape: string; posX: number; posY: number; width: number; height: number; rotation: number
    zoneId: string
}

type WallElement = { id: string; type: "wall" | "door" | "label"; x1: number; y1: number; x2: number; y2: number; label?: string }

type LayoutData = { walls: WallElement[] }

type Props = {
    tables: FloorTable[]
    zoneId: string
    layoutData: LayoutData | null
    onSaved: () => void
}

// Table status colors
const STATUS_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
    AVAILABLE: { fill: "#E8F5E9", stroke: "#4CAF50", text: "#2E7D32" },
    OCCUPIED: { fill: "#FFF3E0", stroke: "#FF9800", text: "#E65100" },
    RESERVED: { fill: "#E3F2FD", stroke: "#2196F3", text: "#1565C0" },
    CLEANING: { fill: "#FFF9C4", stroke: "#FDD835", text: "#F57F17" },
    MERGED: { fill: "#E1F5FE", stroke: "#03A9F4", text: "#01579B" },
}

const GRID_SIZE = 20

function snap(v: number) { return Math.round(v / GRID_SIZE) * GRID_SIZE }

// ============================================================
// FLOOR PLAN EDITOR
// ============================================================

export default function FloorPlanEditor({ tables, zoneId, layoutData, onSaved }: Props) {
    const [editMode, setEditMode] = useState(false)
    const [tool, setTool] = useState<"select" | "wall" | "door" | "label">("select")
    const [localTables, setLocalTables] = useState(tables)
    const [walls, setWalls] = useState<WallElement[]>(layoutData?.walls ?? [])
    const [dragging, setDragging] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [drawing, setDrawing] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
    const [selectedTable, setSelectedTable] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        setLocalTables(tables)
        setWalls(layoutData?.walls ?? [])
    }, [tables, layoutData])

    const getSvgPoint = useCallback((e: React.MouseEvent) => {
        const svg = svgRef.current
        if (!svg) return { x: 0, y: 0 }
        const rect = svg.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }, [])

    // ---- DRAG TABLE ----
    const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
        if (!editMode || tool !== "select") return
        e.preventDefault()
        e.stopPropagation()
        const pt = getSvgPoint(e)
        const t = localTables.find(t => t.id === tableId)
        if (!t) return
        setDragging(tableId)
        setSelectedTable(tableId)
        setDragOffset({ x: pt.x - t.posX, y: pt.y - t.posY })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        const pt = getSvgPoint(e)

        if (dragging) {
            setLocalTables(prev => prev.map(t =>
                t.id === dragging ? { ...t, posX: snap(pt.x - dragOffset.x), posY: snap(pt.y - dragOffset.y) } : t
            ))
        }
        if (drawing) {
            setDrawing(prev => prev ? { ...prev, x2: snap(pt.x), y2: snap(pt.y) } : null)
        }
    }

    const handleMouseUp = () => {
        if (dragging) setDragging(null)
        if (drawing) {
            const dx = Math.abs(drawing.x2 - drawing.x1)
            const dy = Math.abs(drawing.y2 - drawing.y1)
            if (dx > 10 || dy > 10) {
                const newWall: WallElement = {
                    id: `w-${Date.now()}`,
                    type: tool === "door" ? "door" : tool === "label" ? "label" : "wall",
                    x1: drawing.x1, y1: drawing.y1, x2: drawing.x2, y2: drawing.y2,
                    ...(tool === "label" ? { label: prompt("Nhập tên:") ?? "" } : {}),
                }
                setWalls(prev => [...prev, newWall])
            }
            setDrawing(null)
        }
    }

    const handleSvgMouseDown = (e: React.MouseEvent) => {
        if (!editMode) return
        if (tool === "wall" || tool === "door" || tool === "label") {
            const pt = getSvgPoint(e)
            setDrawing({ x1: snap(pt.x), y1: snap(pt.y), x2: snap(pt.x), y2: snap(pt.y) })
        } else {
            setSelectedTable(null)
        }
    }

    // ---- SAVE ----
    const handleSave = async () => {
        setSaving(true)
        const positions = localTables.map(t => ({
            id: t.id, posX: t.posX, posY: t.posY, width: t.width, height: t.height, rotation: t.rotation,
        }))
        await updateTablePositions(positions)
        await updateZoneLayout(zoneId, { walls })
        setSaving(false)
        onSaved()
    }

    // ---- TABLE SHAPE CHANGE ----
    const changeShape = async (tableId: string, shape: string) => {
        const sizes: Record<string, { w: number; h: number }> = {
            square: { w: 80, h: 80 },
            circle: { w: 80, h: 80 },
            rectangle: { w: 120, h: 80 },
        }
        const s = sizes[shape] ?? sizes.square
        setLocalTables(prev => prev.map(t =>
            t.id === tableId ? { ...t, shape, width: s.w, height: s.h } : t
        ))
        await updateTable(tableId, { shape })
    }

    const rotateTable = (tableId: string) => {
        setLocalTables(prev => prev.map(t =>
            t.id === tableId ? { ...t, rotation: (t.rotation + 45) % 360 } : t
        ))
    }

    const deleteWall = (wallId: string) => {
        setWalls(prev => prev.filter(w => w.id !== wallId))
    }

    const sel = selectedTable ? localTables.find(t => t.id === selectedTable) : null

    return (
        <div className="bg-white rounded-xl border border-green-100 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-100">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-green-900 text-sm">Sơ đồ mặt bằng</h3>
                    <button
                        onClick={() => { setEditMode(!editMode); setTool("select"); setSelectedTable(null) }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${editMode ? "bg-wine-600 text-white" : "bg-green-700 text-white hover:bg-green-800"
                            }`}
                    >
                        {editMode ? <Check className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                        {editMode ? "Đang chỉnh sửa" : "Chỉnh sửa"}
                    </button>
                </div>

                {editMode && (
                    <div className="flex items-center gap-1">
                        {([
                            { t: "select" as const, icon: Move, label: "Chọn" },
                            { t: "wall" as const, icon: PenTool, label: "Tường" },
                            { t: "door" as const, icon: DoorOpen, label: "Cửa" },
                            { t: "label" as const, icon: Type, label: "Nhãn" },
                        ]).map(({ t, icon: Icon, label }) => (
                            <button
                                key={t}
                                onClick={() => setTool(t)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${tool === t ? "bg-green-700 text-white" : "bg-white text-green-700 hover:bg-green-100 border border-green-200"
                                    }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}

                        <div className="w-px h-6 bg-green-200 mx-1" />

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-700 text-white rounded text-xs font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
                        >
                            <Save className="h-3.5 w-3.5" />
                            {saving ? "Đang lưu..." : "Lưu"}
                        </button>
                    </div>
                )}
            </div>

            {/* Selected table properties */}
            {editMode && sel && (
                <div className="flex items-center gap-3 px-4 py-2 bg-cream-50 border-b border-green-100 text-sm">
                    <span className="font-medium text-green-800">Bàn {sel.tableNumber}</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => changeShape(sel.id, "square")} className={`p-1.5 rounded ${sel.shape === "square" ? "bg-green-700 text-white" : "hover:bg-green-100"}`}>
                            <Square className="h-4 w-4" />
                        </button>
                        <button onClick={() => changeShape(sel.id, "circle")} className={`p-1.5 rounded ${sel.shape === "circle" ? "bg-green-700 text-white" : "hover:bg-green-100"}`}>
                            <Circle className="h-4 w-4" />
                        </button>
                        <button onClick={() => changeShape(sel.id, "rectangle")} className={`p-1.5 rounded ${sel.shape === "rectangle" ? "bg-green-700 text-white" : "hover:bg-green-100"}`}>
                            <RectangleHorizontal className="h-4 w-4" />
                        </button>
                    </div>
                    <button onClick={() => rotateTable(sel.id)} className="p-1.5 rounded hover:bg-green-100">
                        <RotateCw className="h-4 w-4" />
                    </button>
                    <span className="text-green-600 text-xs">
                        ({sel.posX}, {sel.posY}) {sel.width}×{sel.height} {sel.rotation}°
                    </span>
                    <button onClick={() => setSelectedTable(null)} className="ml-auto p-1 rounded hover:bg-red-100">
                        <X className="h-4 w-4 text-red-500" />
                    </button>
                </div>
            )}

            {/* SVG Floor Plan */}
            <div className="relative overflow-auto bg-[#FAF9F6]" style={{ height: 600 }}>
                <svg
                    ref={svgRef}
                    width={1200}
                    height={600}
                    className={`${editMode ? "cursor-crosshair" : ""}`}
                    onMouseDown={handleSvgMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Grid */}
                    <defs>
                        <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                            <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e8e8e8" strokeWidth="0.5" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Walls */}
                    {walls.filter(w => w.type === "wall").map(w => (
                        <g key={w.id}>
                            <line
                                x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                                stroke="#555" strokeWidth={8} strokeLinecap="round"
                            />
                            {editMode && (
                                <g onClick={() => deleteWall(w.id)} className="cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                                    <circle cx={(w.x1 + w.x2) / 2} cy={(w.y1 + w.y2) / 2} r={10} fill="red" />
                                    <text x={(w.x1 + w.x2) / 2} y={(w.y1 + w.y2) / 2 + 4} textAnchor="middle" fill="white" fontSize="12">×</text>
                                </g>
                            )}
                        </g>
                    ))}

                    {/* Doors */}
                    {walls.filter(w => w.type === "door").map(w => (
                        <g key={w.id}>
                            <line
                                x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                                stroke="#8B4513" strokeWidth={6} strokeLinecap="round" strokeDasharray="8 4"
                            />
                            <text
                                x={(w.x1 + w.x2) / 2} y={(w.y1 + w.y2) / 2 - 8}
                                textAnchor="middle" fill="#8B4513" fontSize="10" fontWeight="bold"
                            >Cửa</text>
                            {editMode && (
                                <g onClick={() => deleteWall(w.id)} className="cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                                    <circle cx={(w.x1 + w.x2) / 2} cy={(w.y1 + w.y2) / 2 + 15} r={8} fill="red" />
                                    <text x={(w.x1 + w.x2) / 2} y={(w.y1 + w.y2) / 2 + 19} textAnchor="middle" fill="white" fontSize="10">×</text>
                                </g>
                            )}
                        </g>
                    ))}

                    {/* Labels */}
                    {walls.filter(w => w.type === "label").map(w => (
                        <g key={w.id}>
                            <rect x={Math.min(w.x1, w.x2)} y={Math.min(w.y1, w.y2)}
                                width={Math.abs(w.x2 - w.x1)} height={Math.abs(w.y2 - w.y1)}
                                fill="#F5F0E8" stroke="#C4B99E" strokeWidth={1} rx={4} opacity={0.6}
                            />
                            <text
                                x={(w.x1 + w.x2) / 2} y={(w.y1 + w.y2) / 2 + 4}
                                textAnchor="middle" fill="#6B5B3E" fontSize="12" fontWeight="600"
                            >{w.label ?? ""}</text>
                            {editMode && (
                                <g onClick={() => deleteWall(w.id)} className="cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                                    <circle cx={Math.max(w.x1, w.x2)} cy={Math.min(w.y1, w.y2)} r={8} fill="red" />
                                    <text x={Math.max(w.x1, w.x2)} y={Math.min(w.y1, w.y2) + 4} textAnchor="middle" fill="white" fontSize="10">×</text>
                                </g>
                            )}
                        </g>
                    ))}

                    {/* Drawing preview */}
                    {drawing && (
                        <line
                            x1={drawing.x1} y1={drawing.y1} x2={drawing.x2} y2={drawing.y2}
                            stroke={tool === "door" ? "#8B4513" : tool === "label" ? "#C4B99E" : "#333"}
                            strokeWidth={tool === "label" ? 2 : tool === "door" ? 6 : 8}
                            strokeLinecap="round"
                            strokeDasharray={tool === "door" ? "8 4" : tool === "label" ? "4 4" : "none"}
                            opacity={0.5}
                        />
                    )}

                    {/* Tables */}
                    {localTables.map(t => {
                        const colors = STATUS_COLORS[t.status] ?? STATUS_COLORS.AVAILABLE
                        const isSelected = selectedTable === t.id
                        const cx = t.posX + t.width / 2
                        const cy = t.posY + t.height / 2

                        return (
                            <g
                                key={t.id}
                                transform={`rotate(${t.rotation} ${cx} ${cy})`}
                                onMouseDown={(e) => handleTableMouseDown(e, t.id)}
                                className={`${editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} transition-transform`}
                            >
                                {/* Table shape */}
                                {t.shape === "circle" ? (
                                    <ellipse
                                        cx={cx} cy={cy} rx={t.width / 2} ry={t.height / 2}
                                        fill={colors.fill} stroke={isSelected ? "#333" : colors.stroke}
                                        strokeWidth={isSelected ? 3 : 2}
                                    />
                                ) : (
                                    <rect
                                        x={t.posX} y={t.posY} width={t.width} height={t.height}
                                        rx={t.shape === "square" ? 8 : 12}
                                        fill={colors.fill} stroke={isSelected ? "#333" : colors.stroke}
                                        strokeWidth={isSelected ? 3 : 2}
                                    />
                                )}

                                {/* Table number */}
                                <text
                                    x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
                                    fill={colors.text} fontSize="14" fontWeight="700"
                                    transform={`rotate(${-t.rotation} ${cx} ${cy})`}
                                >
                                    {t.tableNumber}
                                </text>
                                {/* Seats */}
                                <text
                                    x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
                                    fill={colors.text} fontSize="10" opacity={0.7}
                                    transform={`rotate(${-t.rotation} ${cx} ${cy})`}
                                >
                                    {t.seats} chỗ
                                </text>
                            </g>
                        )
                    })}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 bg-green-50 border-t border-green-100 text-xs">
                {Object.entries(STATUS_COLORS).map(([status, colors]) => (
                    <div key={status} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.fill, border: `2px solid ${colors.stroke}` }} />
                        <span className="text-green-700">{status === "AVAILABLE" ? "Trống" : status === "OCCUPIED" ? "Có khách" : status === "RESERVED" ? "Đã đặt" : status === "CLEANING" ? "Dọn dẹp" : "Ghép"}</span>
                    </div>
                ))}
                {editMode && (
                    <>
                        <div className="w-px h-4 bg-green-300" />
                        <span className="text-green-600">Snap: {GRID_SIZE}px grid</span>
                    </>
                )}
            </div>
        </div>
    )
}
