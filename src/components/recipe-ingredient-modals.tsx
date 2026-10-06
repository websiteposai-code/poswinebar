"use client"

import { useState } from "react"
import { X, Plus, Trash2, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
    createIngredient,
    getRawMaterials,
    getRecipes,
    createRecipe,
    updateRecipeIngredient,
    deleteRecipeIngredient,
    deleteRecipe,
    type RawMaterial,
    type Recipe,
} from "@/actions/assets"

// ============================================================
// ADD INGREDIENT MODAL (GAP-15)
// ============================================================

export function AddIngredientModal({
    onClose,
    onCreated,
}: {
    onClose: () => void
    onCreated: () => void
}) {
    const [name, setName] = useState("")
    const [unit, setUnit] = useState("kg")
    const [baseUnit, setBaseUnit] = useState("")
    const [baseQuantity, setBaseQuantity] = useState(1)
    const [currentStock, setCurrentStock] = useState(0)
    const [minStock, setMinStock] = useState(0)
    const [costPerUnit, setCostPerUnit] = useState(0)
    const [saving, setSaving] = useState(false)

    const handleSubmit = async () => {
        if (!name.trim()) { toast.error("Tên nguyên liệu không được trống"); return }
        if (costPerUnit <= 0) { toast.error("Giá phải > 0"); return }

        setSaving(true)
        const res = await createIngredient({
            name: name.trim(),
            unit,
            baseUnit: baseUnit || unit,
            baseQuantity: baseQuantity || 1,
            currentStock,
            minStock,
            costPerUnit,
        })
        setSaving(false)

        if (res.success) {
            toast.success(`Đã thêm "${name}"`)
            onCreated()
            onClose()
        } else {
            toast.error("Lỗi tạo nguyên liệu")
        }
    }

    const costPerBase = baseQuantity > 0 ? Math.round(costPerUnit / baseQuantity) : 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                    <h3 className="font-display text-lg font-bold text-green-900">Thêm nguyên liệu</h3>
                    <button onClick={onClose} className="p-1 hover:bg-cream-100 rounded"><X className="h-5 w-5" /></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="text-xs font-medium text-cream-500 mb-1 block">Tên nguyên liệu *</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Rượu vang đỏ"
                            className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none" />
                    </div>

                    {/* Unit + Base Unit */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-medium text-cream-500 mb-1 block">Đơn vị mua</label>
                            <select value={unit} onChange={e => setUnit(e.target.value)}
                                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm">
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="chai">chai</option>
                                <option value="lon">lon</option>
                                <option value="hộp">hộp</option>
                                <option value="lít">lít</option>
                                <option value="cái">cái</option>
                                <option value="bó">bó</option>
                                <option value="gói">gói</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-cream-500 mb-1 block">Đơn vị cơ sở</label>
                            <select value={baseUnit || unit} onChange={e => setBaseUnit(e.target.value)}
                                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm">
                                <option value="g">g</option>
                                <option value="ml">ml</option>
                                <option value="pcs">pcs</option>
                                <option value="kg">kg</option>
                                <option value="lít">lít</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-cream-500 mb-1 block">Quy đổi</label>
                            <input type="number" value={baseQuantity} onChange={e => setBaseQuantity(Number(e.target.value))}
                                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm" placeholder="750" />
                        </div>
                    </div>

                    {baseUnit && baseUnit !== unit && (
                        <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-green-200">
                            1 {unit} = {baseQuantity} {baseUnit} → Giá/{baseUnit}: {costPerBase.toLocaleString("vi-VN")}₫
                        </p>
                    )}

                    {/* Stock + Cost */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-medium text-cream-500 mb-1 block">Tồn kho</label>
                            <input type="number" value={currentStock} onChange={e => setCurrentStock(Number(e.target.value))}
                                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-cream-500 mb-1 block">Tối thiểu</label>
                            <input type="number" value={minStock} onChange={e => setMinStock(Number(e.target.value))}
                                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-cream-500 mb-1 block">Giá/{unit} *</label>
                            <input type="number" value={costPerUnit} onChange={e => setCostPerUnit(Number(e.target.value))}
                                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-cream-200">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-cream-500 hover:bg-cream-100 rounded-lg">Hủy</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {saving ? "Đang tạo..." : "Thêm"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// RECIPE MANAGER MODAL (GAP-14)
// ============================================================

export function RecipeManagerModal({
    productId,
    productName,
    recipe: existingRecipe,
    onClose,
    onSaved,
}: {
    productId: string
    productName: string
    recipe: Recipe | null
    onClose: () => void
    onSaved: () => void
}) {
    const [ingredients, setIngredients] = useState(existingRecipe?.ingredients ?? [])
    const [materials, setMaterials] = useState<RawMaterial[]>([])
    const [addMode, setAddMode] = useState(false)
    const [selectedMaterialId, setSelectedMaterialId] = useState("")
    const [qty, setQty] = useState(0)
    const [qtyUnit, setQtyUnit] = useState("")
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    // Load materials for dropdown
    useState(() => {
        getRawMaterials().then(m => { setMaterials(m); setLoading(false) })
    })

    const handleAddIngredient = async () => {
        if (!selectedMaterialId || qty <= 0) return
        const mat = materials.find(m => m.id === selectedMaterialId)
        if (!mat) return

        setSaving(true)
        const res = await createRecipe({
            productId,
            productName,
            ingredients: [{
                materialId: mat.id,
                materialName: mat.name,
                quantity: qty,
                unit: qtyUnit || mat.baseUnit || mat.unit,
                costPerUnit: mat.costPrice,
                costPerBaseUnit: mat.costPerBaseUnit,
                baseUnit: mat.baseUnit || mat.unit,
            }],
            notes: "",
        })
        setSaving(false)

        if (res.id) {
            toast.success(`Đã thêm "${mat.name}" vào recipe`)
            // Reload recipe
            const recipes = await getRecipes()
            const updated = recipes.find(r => r.productId === productId)
            if (updated) setIngredients(updated.ingredients)
            setAddMode(false)
            setSelectedMaterialId("")
            setQty(0)
            onSaved()
        }
    }

    const handleRemoveIngredient = async (materialId: string) => {
        setSaving(true)
        const res = await deleteRecipeIngredient(productId, materialId)
        if (res.success) {
            setIngredients(prev => prev.filter(i => i.materialId !== materialId))
            toast.success("Đã xóa nguyên liệu")
            onSaved()
        }
        setSaving(false)
    }

    const handleDeleteAll = async () => {
        if (!confirm("Xóa toàn bộ recipe?")) return
        setSaving(true)
        const res = await deleteRecipe(productId)
        if (res.success) {
            setIngredients([])
            toast.success("Đã xóa recipe")
            onSaved()
        }
        setSaving(false)
    }

    const totalCost = ingredients.reduce((s, i) => s + i.costPerUnit * i.quantity, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                    <div>
                        <h3 className="font-display text-lg font-bold text-green-900">
                            Recipe: {productName}
                        </h3>
                        <p className="text-xs text-cream-400 mt-0.5">
                            Tổng giá vốn: <span className="font-mono font-bold text-green-700">{Math.round(totalCost).toLocaleString("vi-VN")}₫</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-cream-100 rounded"><X className="h-5 w-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {/* Ingredient list */}
                    {ingredients.length === 0 && !addMode && (
                        <div className="text-center py-8 text-cream-400">
                            <p>Chưa có nguyên liệu nào</p>
                        </div>
                    )}

                    {ingredients.map(ing => (
                        <div key={ing.materialId} className="flex items-center justify-between p-3 bg-cream-50 rounded-lg border border-cream-200">
                            <div>
                                <p className="text-sm font-medium text-green-900">{ing.materialName}</p>
                                <p className="text-xs text-cream-400">
                                    {ing.quantity} {ing.unit} × {Math.round(ing.costPerUnit).toLocaleString("vi-VN")}₫
                                    = <span className="font-mono font-bold">{Math.round(ing.costPerUnit * ing.quantity).toLocaleString("vi-VN")}₫</span>
                                </p>
                            </div>
                            <button onClick={() => handleRemoveIngredient(ing.materialId)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded" disabled={saving}>
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}

                    {/* Add ingredient form */}
                    {addMode && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
                            <select value={selectedMaterialId} onChange={e => {
                                setSelectedMaterialId(e.target.value)
                                const m = materials.find(m => m.id === e.target.value)
                                if (m) setQtyUnit(m.baseUnit || m.unit)
                            }} className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm">
                                <option value="">-- Chọn nguyên liệu --</option>
                                {materials.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.unit}{m.baseUnit ? ` → ${m.baseUnit}` : ""}) — {Math.round(m.costPerBaseUnit).toLocaleString("vi-VN")}₫/{m.baseUnit || m.unit}
                                    </option>
                                ))}
                            </select>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-cream-500 mb-1 block">Số lượng</label>
                                    <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))}
                                        className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm" placeholder="200" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-cream-500 mb-1 block">Đơn vị</label>
                                    <input value={qtyUnit} onChange={e => setQtyUnit(e.target.value)}
                                        className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm" placeholder="ml" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleAddIngredient} disabled={saving || !selectedMaterialId || qty <= 0}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg disabled:opacity-50">
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                    Thêm
                                </button>
                                <button onClick={() => setAddMode(false)} className="px-3 py-1.5 text-xs text-cream-500 hover:bg-cream-100 rounded-lg">Hủy</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-5 py-4 border-t border-cream-200">
                    <div className="flex gap-2">
                        {!addMode && (
                            <button onClick={() => setAddMode(true)}
                                className="flex items-center gap-1 px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800">
                                <Plus className="h-4 w-4" /> Thêm NL
                            </button>
                        )}
                        {ingredients.length > 0 && (
                            <button onClick={handleDeleteAll} disabled={saving}
                                className="flex items-center gap-1 px-3 py-2 text-red-500 text-sm rounded-lg hover:bg-red-50">
                                <Trash2 className="h-4 w-4" /> Xóa recipe
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="px-4 py-2 text-sm text-cream-500 hover:bg-cream-100 rounded-lg">Đóng</button>
                </div>
            </div>
        </div>
    )
}
