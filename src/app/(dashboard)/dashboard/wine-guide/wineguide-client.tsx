"use client"

import { useState, useCallback } from "react"
import { Wine, Search, Thermometer, Clock, GlassWater, Utensils, ChevronDown, ChevronUp, Grape, MapPin, Save, X, Plus, Trash2, Edit3 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    getAllServingNotes,
    searchServingNotes,
    updateWineGuideInfo,
    getFoodProducts,
    updateWinePairings,
    type WineServingNote,
    type FoodMenuItem,
} from "@/actions/serving-notes"

export interface WineGuideInitialData {
    notes: WineServingNote[]
    foodProducts: FoodMenuItem[]
}

export default function WineGuideClient({ initial }: { initial: WineGuideInitialData }) {
    const [notes, setNotes] = useState<WineServingNote[]>(initial.notes)
    const [search, setSearch] = useState("")
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)

    // Edit form state
    const [editServingTemp, setEditServingTemp] = useState("")
    const [editDecantTime, setEditDecantTime] = useState("")
    const [editGlassType, setEditGlassType] = useState("")
    const [editStaffNotes, setEditStaffNotes] = useState("")
    const [editNose, setEditNose] = useState<string[]>([])
    const [editPalate, setEditPalate] = useState<string[]>([])
    const [editFinish, setEditFinish] = useState("")
    const [editPairings, setEditPairings] = useState<string[]>([])
    const [editPairedIds, setEditPairedIds] = useState<string[]>([])
    const [foodProducts, setFoodProducts] = useState<FoodMenuItem[]>(initial.foodProducts)
    const [newNoseItem, setNewNoseItem] = useState("")
    const [newPalateItem, setNewPalateItem] = useState("")
    const [newPairingItem, setNewPairingItem] = useState("")
    const [pairingSearch, setPairingSearch] = useState("")
    const [saving, setSaving] = useState(false)

    const loadData = useCallback(async () => {
        try {
            const list = search ? await searchServingNotes(search) : await getAllServingNotes()
            setNotes(list)
        } catch (err) {
            console.error("[WineGuide] load failed:", err)
            toast.error("Không thể tải dữ liệu Wine Guide")
        }
    }, [search])

    const startEditing = (note: WineServingNote) => {
        setEditingId(note.id)
        setExpandedId(note.id)
        setEditServingTemp(note.servingTemp)
        setEditDecantTime(note.decantTime ?? "")
        setEditGlassType(note.glassType)
        setEditStaffNotes(note.staffNotes ?? "")
        setEditNose([...note.tastingNotes.nose])
        setEditPalate([...note.tastingNotes.palate])
        setEditFinish(note.tastingNotes.finish)
        setEditPairings([...note.pairings])
        // Parse paired product IDs from "id::name" format
        setEditPairedIds(note.pairings.map(p => p.split("::")[0]).filter(id => id.length > 10))
        setNewNoseItem("")
        setNewPalateItem("")
        setNewPairingItem("")
        setPairingSearch("")
    }

    const cancelEditing = () => {
        setEditingId(null)
        setNewNoseItem("")
        setNewPalateItem("")
        setNewPairingItem("")
        setPairingSearch("")
    }

    const handleSave = async (noteId: string) => {
        setSaving(true)
        // Save wine guide info (tasting notes, serving, etc.)
        const result = await updateWineGuideInfo(noteId, {
            servingTemp: editServingTemp || undefined,
            decantTime: editDecantTime || null,
            glassType: editGlassType || undefined,
            staffNotes: editStaffNotes || null,
            tastingNotes: { nose: editNose, palate: editPalate, finish: editFinish },
            pairings: editPairings,
        })
        // Save food pairings by product ID
        if (editPairedIds.length > 0) {
            await updateWinePairings(noteId, editPairedIds)
        }
        setSaving(false)
        if (result.success) {
            toast.success("Đã lưu Wine Guide thành công!")
            setEditingId(null)
            loadData()
        } else {
            toast.error(result.error ?? "Lỗi khi lưu")
        }
    }

    const addTag = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, inputSetter: React.Dispatch<React.SetStateAction<string>>) => {
        const trimmed = value.trim()
        if (!trimmed) return
        setter(prev => [...prev, trimmed])
        inputSetter("")
    }

    const removeTag = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
        setter(prev => prev.filter((_, i) => i !== index))
    }



    return (
        <div className="min-h-screen bg-cream-50 p-4 lg:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">Wine Guide Setup</h1>
                        <p className="text-sm text-cream-500">Quản lý hướng dẫn phục vụ, tasting notes, food pairing cho nhân viên</p>
                    </div>
                </div>
                <div className="relative max-w-xs w-64">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm rượu, vùng, nho, pairing..."
                        className="h-8 pl-8 text-xs border-cream-300 bg-white"
                    />
                </div>
            </div>

            {/* Info banner */}
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
                <p className="text-xs text-green-800">
                    <strong>Manager/Owner:</strong> Ấn nút <strong>Chỉnh sửa</strong> trên mỗi rượu để setup tasting notes, food pairing,
                    nhiệt độ phục vụ, và ghi chú cho nhân viên. Thông tin này sẽ hiển thị trên POS khi nhân viên bán hàng.
                </p>
            </div>

            {/* Wine Cards */}
            <div className="space-y-3">
                {notes.map((note) => {
                    const isExpanded = expandedId === note.id
                    const isEditing = editingId === note.id
                    return (
                        <div key={note.id} className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-all">
                            {/* Collapsed row */}
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : note.id)}
                                className={cn("w-full flex items-center px-5 py-4 text-left transition-colors", isExpanded && "bg-wine-50")}
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-wine-100 border border-wine-200 mr-4 shrink-0">
                                    <Wine className="h-5 w-5 text-wine-700" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-green-900">{note.productName}</span>
                                        {note.vintage && <Badge className="text-[8px] bg-wine-100 border-wine-300 text-wine-700">{note.vintage}</Badge>}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="flex items-center gap-1 text-[11px] text-cream-500"><MapPin className="h-3 w-3" />{note.region}</span>
                                        {note.grape && <span className="flex items-center gap-1 text-[11px] text-cream-500"><Grape className="h-3 w-3" />{note.grape}</span>}
                                    </div>
                                </div>

                                {/* Quick info */}
                                <div className="hidden lg:flex items-center gap-3 mr-4">
                                    <div className="flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-1">
                                        <Thermometer className="h-3 w-3 text-blue-600" />
                                        <span className="text-[10px] font-bold text-blue-700">{note.servingTemp}</span>
                                    </div>
                                    <div className="flex items-center gap-1 rounded-lg bg-cream-100 border border-cream-200 px-2 py-1">
                                        <GlassWater className="h-3 w-3 text-cream-500" />
                                        <span className="text-[10px] font-medium text-cream-600">{note.glassType.split(" ")[0]}</span>
                                    </div>
                                    {note.decantTime && (
                                        <div className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1">
                                            <Clock className="h-3 w-3 text-amber-600" />
                                            <span className="text-[10px] font-medium text-amber-700">Decant</span>
                                        </div>
                                    )}
                                </div>

                                {/* Pairing + status badges */}
                                <div className="flex items-center gap-2 mr-3">
                                    <div className="flex items-center gap-1">
                                        <Utensils className="h-3 w-3 text-cream-400" />
                                        <span className="text-[10px] text-cream-400">{note.pairings.length} pairings</span>
                                    </div>
                                    {note.pairings.length === 0 && note.tastingNotes.nose.length === 0 && (
                                        <Badge className="bg-amber-100 border-amber-300 text-amber-700 text-[8px]">Chưa setup</Badge>
                                    )}
                                </div>

                                <div className="w-5">{isExpanded ? <ChevronUp className="h-4 w-4 text-cream-400" /> : <ChevronDown className="h-4 w-4 text-cream-400" />}</div>
                            </button>

                            {/* Expanded detail */}
                            {isExpanded && (
                                <div className="border-t border-cream-200 bg-cream-50 px-5 py-5">
                                    {/* Edit toggle button */}
                                    <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                                        <h3 className="text-xs font-bold text-green-900">
                                            {isEditing ? "Đang chỉnh sửa Wine Guide" : "Thông tin Wine Guide"}
                                        </h3>
                                        {!isEditing ? (
                                            <Button
                                                onClick={() => startEditing(note)}
                                                size="sm"
                                                className="bg-green-900 text-cream-50 hover:bg-green-800 text-[11px] h-7"
                                            >
                                                <Edit3 className="mr-1 h-3 w-3" />
                                                Chỉnh sửa
                                            </Button>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={cancelEditing}
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-cream-300 text-cream-500 text-[11px] h-7"
                                                >
                                                    <X className="mr-1 h-3 w-3" />
                                                    Hủy
                                                </Button>
                                                <Button
                                                    onClick={() => handleSave(note.id)}
                                                    disabled={saving}
                                                    size="sm"
                                                    className="bg-green-700 text-white hover:bg-green-800 text-[11px] h-7"
                                                >
                                                    <Save className="mr-1 h-3 w-3" />
                                                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5">
                                        {/* Left: Serving Info */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-bold uppercase text-cream-400">HƯỚNG DẪN PHỤC VỤ</h4>
                                            <div className="rounded-lg bg-white border border-cream-200 p-3 space-y-2.5">
                                                {/* Serving Temp */}
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-cream-500 flex items-center gap-1.5">Nhiệt độ</span>
                                                    {isEditing ? (
                                                        <Input
                                                            value={editServingTemp}
                                                            onChange={(e) => setEditServingTemp(e.target.value)}
                                                            placeholder="VD: 16-18°C"
                                                            className="h-6 w-28 text-[10px] text-right border-cream-300"
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-blue-700">{note.servingTemp}</span>
                                                    )}
                                                </div>
                                                {/* Glass Type */}
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-cream-500 flex items-center gap-1.5">Ly</span>
                                                    {isEditing ? (
                                                        <Input
                                                            value={editGlassType}
                                                            onChange={(e) => setEditGlassType(e.target.value)}
                                                            placeholder="VD: Bordeaux"
                                                            className="h-6 w-28 text-[10px] text-right border-cream-300"
                                                        />
                                                    ) : (
                                                        <span className="font-medium">{note.glassType}</span>
                                                    )}
                                                </div>
                                                {/* Decant Time */}
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-cream-500 flex items-center gap-1.5">Decant</span>
                                                    {isEditing ? (
                                                        <Input
                                                            value={editDecantTime}
                                                            onChange={(e) => setEditDecantTime(e.target.value)}
                                                            placeholder="VD: 30 phút"
                                                            className="h-6 w-28 text-[10px] text-right border-cream-300"
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-amber-700">{note.decantTime || "—"}</span>
                                                    )}
                                                </div>
                                                {/* Region (read-only) */}
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-cream-500 flex items-center gap-1.5">Vùng</span>
                                                    <span className="font-medium">{note.region}</span>
                                                </div>
                                                {/* Grape (read-only) */}
                                                {note.grape && (
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-cream-500 flex items-center gap-1.5">Nho</span>
                                                        <span className="font-medium text-right max-w-[140px]">{note.grape}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Staff notes */}
                                            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                                                <p className="text-[9px] font-bold uppercase text-amber-500 mb-1.5 flex items-center gap-1">GHI CHÚ NHÂN VIÊN</p>
                                                {isEditing ? (
                                                    <textarea
                                                        value={editStaffNotes}
                                                        onChange={(e) => setEditStaffNotes(e.target.value)}
                                                        placeholder="Ghi chú về loại rượu này cho nhân viên..."
                                                        className="w-full text-[11px] text-amber-800 bg-white border border-amber-300 rounded-md p-2 resize-none h-16 focus:outline-none focus:border-amber-500"
                                                    />
                                                ) : (
                                                    note.staffNotes ? (
                                                        <p className="text-[11px] text-amber-800 leading-relaxed">{note.staffNotes}</p>
                                                    ) : (
                                                        <p className="text-[11px] text-amber-400 italic">Chưa có ghi chú</p>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* Middle: Tasting Notes */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-bold uppercase text-cream-400">TASTING NOTES</h4>
                                            <div className="rounded-lg bg-white border border-cream-200 p-3 space-y-3">
                                                {/* Nose */}
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase text-wine-400 mb-1.5">Nose (Hương)</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(isEditing ? editNose : note.tastingNotes.nose).map((n, i) => (
                                                            <span key={`${n}-${i}`} className="rounded-full bg-wine-50 border border-wine-200 px-2 py-0.5 text-[9px] font-medium text-wine-700 flex items-center gap-1">
                                                                {n}
                                                                {isEditing && (
                                                                    <button onClick={() => removeTag(setEditNose, i)} className="text-wine-400 hover:text-wine-700">
                                                                        <X className="h-2.5 w-2.5" />
                                                                    </button>
                                                                )}
                                                            </span>
                                                        ))}
                                                        {(isEditing ? editNose : note.tastingNotes.nose).length === 0 && !isEditing && (
                                                            <span className="text-[9px] text-cream-400 italic">Chưa có</span>
                                                        )}
                                                    </div>
                                                    {isEditing && (
                                                        <div className="flex gap-1 mt-1.5">
                                                            <Input
                                                                value={newNoseItem}
                                                                onChange={(e) => setNewNoseItem(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(setEditNose, newNoseItem, setNewNoseItem) } }}
                                                                placeholder="VD: Cherry, Tobacco..."
                                                                className="h-6 text-[10px] border-cream-300 flex-1"
                                                            />
                                                            <Button
                                                                onClick={() => addTag(setEditNose, newNoseItem, setNewNoseItem)}
                                                                size="sm" className="h-6 w-6 p-0 bg-wine-600 hover:bg-wine-700"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Palate */}
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase text-green-500 mb-1.5">Palate (Vị)</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(isEditing ? editPalate : note.tastingNotes.palate).map((p, i) => (
                                                            <span key={`${p}-${i}`} className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[9px] font-medium text-green-700 flex items-center gap-1">
                                                                {p}
                                                                {isEditing && (
                                                                    <button onClick={() => removeTag(setEditPalate, i)} className="text-green-400 hover:text-green-700">
                                                                        <X className="h-2.5 w-2.5" />
                                                                    </button>
                                                                )}
                                                            </span>
                                                        ))}
                                                        {(isEditing ? editPalate : note.tastingNotes.palate).length === 0 && !isEditing && (
                                                            <span className="text-[9px] text-cream-400 italic">Chưa có</span>
                                                        )}
                                                    </div>
                                                    {isEditing && (
                                                        <div className="flex gap-1 mt-1.5">
                                                            <Input
                                                                value={newPalateItem}
                                                                onChange={(e) => setNewPalateItem(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(setEditPalate, newPalateItem, setNewPalateItem) } }}
                                                                placeholder="VD: Tannic, Smooth..."
                                                                className="h-6 text-[10px] border-cream-300 flex-1"
                                                            />
                                                            <Button
                                                                onClick={() => addTag(setEditPalate, newPalateItem, setNewPalateItem)}
                                                                size="sm" className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Finish */}
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase text-amber-500 mb-1.5">Finish (Kết thúc)</p>
                                                    {isEditing ? (
                                                        <Input
                                                            value={editFinish}
                                                            onChange={(e) => setEditFinish(e.target.value)}
                                                            placeholder="VD: Long, dry with notes of dark chocolate"
                                                            className="h-6 text-[10px] border-cream-300"
                                                        />
                                                    ) : (
                                                        note.tastingNotes.finish
                                                            ? <p className="text-[11px] text-cream-600 italic">{note.tastingNotes.finish}</p>
                                                            : <p className="text-[9px] text-cream-400 italic">Chưa có</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Food Pairings */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-bold uppercase text-cream-400 flex items-center gap-1">FOOD PAIRING</h4>
                                            <div className="rounded-lg bg-white border border-cream-200 p-3">
                                                <div className="space-y-1.5">
                                                    {(() => {
                                                        const pairings = isEditing ? editPairedIds : note.pairings
                                                        if (pairings.length === 0) return (
                                                            <p className="text-[10px] text-cream-400 italic py-2">
                                                                Chưa có food pairing. {isEditing ? "Chọn từ menu bên dưới ↓" : "Ấn Chỉnh sửa để thêm."}
                                                            </p>
                                                        )

                                                        if (isEditing) {
                                                            // Show selected food items by ID
                                                            return editPairedIds.map((pid, i) => {
                                                                const fp = foodProducts.find(f => f.id === pid)
                                                                return (
                                                                    <div key={pid} className="flex items-center gap-2 py-1">
                                                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[9px] font-bold text-green-700 shrink-0">{i + 1}</span>
                                                                        <span className="text-xs text-green-900 font-medium flex-1">
                                                                            {fp?.name ?? pid.split("::")[1] ?? pid}
                                                                            {fp?.categoryName && <span className="text-[9px] text-cream-400 ml-1">({fp.categoryName})</span>}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => setEditPairedIds(prev => prev.filter(x => x !== pid))}
                                                                            className="text-red-400 hover:text-red-600 p-0.5"
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            })
                                                        }

                                                        // View mode: show pairing names
                                                        return note.pairings.map((p, i) => {
                                                            const displayName = p.includes("::") ? p.split("::")[1] : p
                                                            return (
                                                                <div key={i} className="flex items-center gap-2 py-1">
                                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[9px] font-bold text-green-700 shrink-0">{i + 1}</span>
                                                                    <span className="text-xs text-green-900 font-medium flex-1">{displayName}</span>
                                                                </div>
                                                            )
                                                        })
                                                    })()}
                                                </div>
                                                {isEditing && (
                                                    <div className="mt-2 pt-2 border-t border-cream-200">
                                                        <Input
                                                            value={pairingSearch}
                                                            onChange={(e) => setPairingSearch(e.target.value)}
                                                            placeholder="Tìm món ăn trong menu..."
                                                            className="h-7 text-[10px] border-cream-300 mb-2"
                                                        />
                                                        <div className="max-h-[160px] overflow-y-auto space-y-0.5 rounded-lg border border-cream-200 bg-cream-50 p-1">
                                                            {(() => {
                                                                const filtered = foodProducts.filter(f =>
                                                                    !editPairedIds.includes(f.id) &&
                                                                    (pairingSearch === "" || f.name.toLowerCase().includes(pairingSearch.toLowerCase()) || (f.categoryName ?? "").toLowerCase().includes(pairingSearch.toLowerCase()))
                                                                )
                                                                if (filtered.length === 0) return <p className="text-[9px] text-cream-400 py-2 text-center">Không tìm thấy món ăn</p>
                                                                let lastCat = ""
                                                                return filtered.map(f => {
                                                                    const showCat = f.categoryName !== lastCat
                                                                    lastCat = f.categoryName ?? ""
                                                                    return (
                                                                        <div key={f.id}>
                                                                            {showCat && f.categoryName && (
                                                                                <p className="text-[8px] font-bold text-cream-400 uppercase px-2 pt-1.5 pb-0.5">{f.categoryName}</p>
                                                                            )}
                                                                            <button
                                                                                onClick={() => setEditPairedIds(prev => [...prev, f.id])}
                                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-green-50 transition-colors"
                                                                            >
                                                                                <Plus className="h-3 w-3 text-green-600 shrink-0" />
                                                                                <span className="text-[11px] text-green-900 font-medium flex-1 truncate">{f.name}</span>
                                                                                <span className="text-[9px] text-cream-400 font-mono">₫{new Intl.NumberFormat("vi-VN").format(f.sellPrice)}</span>
                                                                            </button>
                                                                        </div>
                                                                    )
                                                                })
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Upsell suggestion */}
                                            {(isEditing ? editPairedIds : note.pairings).length > 0 && (
                                                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                                                    <p className="text-[9px] font-bold uppercase text-green-500 mb-1">GỢI Ý UPSELL (tự động)</p>
                                                    <p className="text-[10px] text-green-700 leading-relaxed">
                                                        {(() => {
                                                            const pairings = isEditing ? editPairings : note.pairings
                                                            return pairings.length > 2
                                                                ? `Đề xuất kèm "${pairings[0]}" hoặc "${pairings[1]}" để tăng ticket size.`
                                                                : `Đề xuất kèm "${pairings[0]}" cho trải nghiệm tốt nhất.`
                                                        })()}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}

                {notes.length === 0 && (
                    <div className="py-12 text-center text-sm text-cream-400">Không tìm thấy wine serving notes</div>
                )}
            </div>
        </div>
    )
}
