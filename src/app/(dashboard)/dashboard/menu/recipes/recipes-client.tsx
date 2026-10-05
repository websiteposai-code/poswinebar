"use client"

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    ChefHat,
    Plus,
    Search,
    Trash2,
    Pencil,
    Save,
    Loader2,
    X,
    FolderOpen,
    LayoutGrid,
    CookingPot,
    AlertCircle,
    CheckCircle2,
    DollarSign,
    Package,
    Sliders,
    Sparkles,
    AlertTriangle,
    ShieldCheck,
    ArrowRight,
    FileText,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    getRecipes,
    getRawMaterials,
    createRecipe,
    deleteRecipe,
    deleteRecipeIngredient,
    type Recipe,
    type RawMaterial,
} from "@/actions/assets"
import { getProducts } from "@/actions/menu"
import {
    getCostTargetConfig,
    evaluateRecipeCost,
    updateProductSellPrice,
    DEFAULT_COST_CONFIG,
    type CostTargetConfig,
} from "@/actions/cost-config"
import { SmartPricingCard } from "@/components/recipes/smart-pricing-card"
import { CostTargetModal } from "@/components/recipes/cost-target-modal"
import type { Product } from "@/types"

function fmt(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}


// ─── Shared Menu Tab Nav ───
function MenuTabNav() {
    const pathname = usePathname()
    const tabs = [
        { href: "/dashboard/menu/categories", label: "Danh mục", icon: FolderOpen },
        { href: "/dashboard/menu/products", label: "Sản phẩm", icon: LayoutGrid },
        { href: "/dashboard/menu/recipes", label: "Công thức", icon: ChefHat },
    ]
    return (
        <div className="flex gap-1 border-b border-cream-300 bg-cream-50">
            {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = pathname.includes(tab.href.split("/").pop()!)
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                            "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all",
                            isActive
                                ? "border-green-700 text-green-900"
                                : "border-transparent text-cream-500 hover:text-green-900 hover:border-cream-400"
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                    </Link>
                )
            })}
        </div>
    )
}

// ─── Table styles ───
const TH = "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-cream-400 bg-cream-50 border-b border-cream-200 whitespace-nowrap"
const THR = cn(TH, "text-right")
const TD = "px-3 py-3 text-xs text-green-900 border-b border-cream-100 whitespace-nowrap"
const TDR = cn(TD, "text-right font-mono")

interface RecipesClientProps {
    initialRecipes: Recipe[]
    initialProducts: Product[]
    initialMaterials: RawMaterial[]
    initialCostConfig?: CostTargetConfig
}

export default function RecipesClient({
    initialRecipes,
    initialProducts,
    initialMaterials,
    initialCostConfig,
}: RecipesClientProps) {
    const [recipes, setRecipes] = useState(initialRecipes)
    const [products, setProducts] = useState(initialProducts)
    const [materials, setMaterials] = useState(initialMaterials)
    const [costConfig, setCostConfig] = useState<CostTargetConfig>(initialCostConfig ?? DEFAULT_COST_CONFIG)
    const [showCostConfigModal, setShowCostConfigModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [showCreateFlow, setShowCreateFlow] = useState(false)
    const [editRecipe, setEditRecipe] = useState<{ productId: string; productName: string; recipe: Recipe } | null>(null)

    const loadRecipes = useCallback(async () => {
        const [recs, mats, prods, cfg] = await Promise.all([
            getRecipes(),
            getRawMaterials(),
            getProducts(),
            getCostTargetConfig(),
        ])
        setRecipes(recs)
        setMaterials(mats)
        setProducts(prods)
        setCostConfig(cfg)
    }, [])

    const handlePriceUpdated = (productId: string, newPrice: number) => {
        setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, sellPrice: newPrice } : p))
    }

    // Products that don't have a recipe yet
    const productsWithoutRecipe = products.filter(
        (p) => !recipes.some((r) => r.productId === p.id)
    )

    const filtered = recipes.filter(
        (r) => !searchTerm || r.productName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalRecipes = recipes.length
    const totalIngredients = recipes.reduce((s, r) => s + r.ingredients.length, 0)
    const avgCost = totalRecipes > 0 ? Math.round(recipes.reduce((s, r) => s + r.totalCost, 0) / totalRecipes) : 0
    const noRecipeCount = productsWithoutRecipe.length

    // Evaluate all recipes against cost targets
    const evaluatedStats = useMemo(() => {
        let overBudget = 0
        let warning = 0
        let optimal = 0
        let unpriced = 0

        for (const r of recipes) {
            const prod = products.find((p) => p.id === r.productId)
            const ev = evaluateRecipeCost(r.totalCost, prod?.sellPrice ?? 0, prod?.type, costConfig)
            if (ev.status === "OVER_BUDGET") overBudget++
            else if (ev.status === "WARNING") warning++
            else if (ev.status === "OPTIMAL") optimal++
            else unpriced++
        }
        return { overBudget, warning, optimal, unpriced }
    }, [recipes, products, costConfig])

    return (
        <div className="min-h-screen">
            {/* Page Header */}
            <div className="border-b border-cream-300 bg-cream-50 px-6 py-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                        <CookingPot className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">
                            Menu & Sản phẩm
                        </h1>
                        <p className="text-sm text-cream-500">
                            Quản lý danh mục, sản phẩm, công thức món & kiểm soát giá vốn
                        </p>
                    </div>
                </div>
            </div>

            {/* Tab Nav */}
            <MenuTabNav />

            {/* Content */}
            <div className="p-6 space-y-5">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <ChefHat className="h-3.5 w-3.5 text-cream-400" />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Công thức</span>
                        </div>
                        <p className="font-mono text-xl font-bold leading-none text-green-900">{totalRecipes}</p>
                    </div>

                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Package className="h-3.5 w-3.5 text-cream-400" />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Nguyên liệu dùng</span>
                        </div>
                        <p className="font-mono text-xl font-bold leading-none text-blue-700">{totalIngredients}</p>
                    </div>

                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <DollarSign className="h-3.5 w-3.5 text-cream-400" />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Giá vốn TB</span>
                        </div>
                        <p className="font-mono text-xl font-bold leading-none text-wine-700">₫{fmt(avgCost)}</p>
                    </div>

                    <div className="rounded-xl border border-cream-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-cream-400" />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-cream-400">Chưa có CT</span>
                        </div>
                        <p className={cn("font-mono text-xl font-bold leading-none", noRecipeCount > 0 ? "text-amber-600" : "text-green-600")}>
                            {noRecipeCount}
                        </p>
                    </div>

                    <div className={cn(
                        "rounded-xl border p-3.5 shadow-sm transition-all",
                        evaluatedStats.overBudget > 0
                            ? "border-red-200 bg-red-50/40"
                            : evaluatedStats.warning > 0
                            ? "border-amber-200 bg-amber-50/40"
                            : "border-green-200 bg-green-50/30"
                    )}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <ShieldCheck className={cn(
                                "h-3.5 w-3.5",
                                evaluatedStats.overBudget > 0 ? "text-red-600" : evaluatedStats.warning > 0 ? "text-amber-600" : "text-green-600"
                            )} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-900">Kiểm soát Cost</span>
                        </div>
                        <p className={cn(
                            "font-mono text-xl font-bold leading-none",
                            evaluatedStats.overBudget > 0 ? "text-red-700" : evaluatedStats.warning > 0 ? "text-amber-700" : "text-green-700"
                        )}>
                            {evaluatedStats.overBudget > 0
                                ? `${evaluatedStats.overBudget} vượt trần`
                                : evaluatedStats.warning > 0
                                ? `${evaluatedStats.warning} cận biên`
                                : "100% Đạt chuẩn"}
                        </p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="relative max-w-[260px]">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm công thức..."
                                className="h-8 pl-8 text-xs border-cream-300 bg-white"
                            />
                        </div>
                        <span className="text-xs text-cream-400">{filtered.length} công thức</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowCostConfigModal(true)}
                            className="h-8 text-xs font-medium border-cream-300 bg-white hover:bg-cream-100 text-green-900 gap-1.5 shadow-2xs"
                        >
                            <Sliders className="h-3.5 w-3.5 text-green-800" />
                            Cài đặt Target Cost ({costConfig.defaultTargetMarginPct}% Margin)
                        </Button>

                        <Button
                            onClick={() => setShowCreateFlow(true)}
                            className="h-8 text-xs font-medium bg-green-900 text-cream-50 hover:bg-green-800"
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Tạo công thức
                        </Button>
                    </div>
                </div>

                {/* Recipe Cards */}
                {filtered.length === 0 && !showCreateFlow ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-cream-300 bg-cream-100 py-20">
                        <ChefHat className="h-12 w-12 text-cream-400 mb-3" />
                        <p className="text-cream-500">
                            {searchTerm ? "Không tìm thấy công thức" : "Chưa có công thức nào"}
                        </p>
                        {!searchTerm && (
                            <Button
                                onClick={() => setShowCreateFlow(true)}
                                variant="outline"
                                className="mt-4"
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                Tạo công thức đầu tiên
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map((recipe) => (
                            <RecipeCard
                                key={recipe.id}
                                recipe={recipe}
                                product={products.find((p) => p.id === recipe.productId)}
                                costConfig={costConfig}
                                onEdit={() => setEditRecipe({ productId: recipe.productId, productName: recipe.productName, recipe })}
                                onDeleted={loadRecipes}
                                onPriceUpdated={(newPrice) => handlePriceUpdated(recipe.productId, newPrice)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Create Flow Modal */}
            {showCreateFlow && (
                <CreateRecipeFlow
                    products={productsWithoutRecipe}
                    materials={materials}
                    costConfig={costConfig}
                    onClose={() => setShowCreateFlow(false)}
                    onCreated={loadRecipes}
                />
            )}

            {/* Edit Recipe Modal */}
            {editRecipe && (
                <EditRecipeModal
                    productId={editRecipe.productId}
                    productName={editRecipe.productName}
                    product={products.find((p) => p.id === editRecipe.productId)}
                    recipe={editRecipe.recipe}
                    materials={materials}
                    costConfig={costConfig}
                    onClose={() => setEditRecipe(null)}
                    onSaved={loadRecipes}
                    onPriceUpdated={(newPrice) => handlePriceUpdated(editRecipe.productId, newPrice)}
                />
            )}

            {/* Cost Target Configuration Modal */}
            {showCostConfigModal && (
                <CostTargetModal
                    config={costConfig}
                    onClose={() => setShowCostConfigModal(false)}
                    onUpdated={(newCfg) => setCostConfig(newCfg)}
                />
            )}
        </div>
    )
}

// ─── Recipe Card ───
function RecipeCard({
    recipe,
    product,
    costConfig,
    onEdit,
    onDeleted,
    onPriceUpdated,
}: {
    recipe: Recipe
    product?: Product
    costConfig: CostTargetConfig
    onEdit: () => void
    onDeleted: () => void
    onPriceUpdated: (newPrice: number) => void
}) {
    const [deleting, setDeleting] = useState(false)
    const [applyingPrice, setApplyingPrice] = useState(false)

    const ev = evaluateRecipeCost(recipe.totalCost, product?.sellPrice ?? 0, product?.type, costConfig)

    const handleDelete = async () => {
        if (!confirm(`Xóa công thức "${recipe.productName}"?`)) return
        setDeleting(true)
        const res = await deleteRecipe(recipe.productId)
        if (res.success) {
            toast.success(`Đã xóa công thức "${recipe.productName}"`)
            onDeleted()
        } else {
            toast.error("Lỗi xóa công thức")
        }
        setDeleting(false)
    }

    const handleQuickApply = async () => {
        if (!product || ev.suggestedPrice <= 0) return
        setApplyingPrice(true)
        try {
            const res = await updateProductSellPrice(product.id, ev.suggestedPrice)
            if (res.success) {
                toast.success(`Đã cập nhật giá bán món "${product.name}" thành ₫${fmt(ev.suggestedPrice)}`)
                onPriceUpdated(ev.suggestedPrice)
            } else {
                toast.error(res.error || "Lỗi cập nhật giá")
            }
        } catch {
            toast.error("Lỗi cập nhật giá")
        } finally {
            setApplyingPrice(false)
        }
    }

    return (
        <div className="group rounded-xl border border-cream-200 bg-white shadow-sm hover:border-green-300 hover:shadow-md transition-all overflow-hidden">
            <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-cream-100 gap-2">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-800">
                        <CookingPot className="h-4.5 w-4.5" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-green-900">{recipe.productName}</h3>

                            {/* Cost % Alert Badge */}
                            {ev.status === "OPTIMAL" && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-800 border border-green-200">
                                    <ShieldCheck className="h-3 w-3 text-green-700" />
                                    Cost {ev.costPct}% (≤{ev.targetCostPct}%)
                                </span>
                            )}
                            {ev.status === "WARNING" && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                    Cận biên {ev.costPct}%
                                </span>
                            )}
                            {ev.status === "OVER_BUDGET" && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-800 border border-red-200 animate-pulse">
                                    <AlertTriangle className="h-3 w-3 text-red-600" />
                                    Vượt trần {ev.costPct}% (+{ev.diffPct}%)
                                </span>
                            )}
                            {ev.status === "UNPRICED" && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-cream-100 text-cream-600 border border-cream-200">
                                    Chưa có giá bán
                                </span>
                            )}
                        </div>

                        <p className="text-[11px] text-cream-500 mt-0.5">
                            {recipe.ingredients.length} nguyên liệu · Giá bán: <strong className="font-mono text-green-900">{product?.sellPrice ? `₫${fmt(product.sellPrice)}` : "—"}</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] text-cream-400 uppercase tracking-wider">Giá vốn (Cost)</p>
                        <p className="font-mono text-sm font-bold text-wine-700">₫{fmt(recipe.totalCost)}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={onEdit}
                            className="rounded-lg p-2 text-cream-500 hover:bg-cream-200 hover:text-green-700 transition-all"
                            title="Chỉnh sửa công thức & định giá"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="rounded-lg p-2 text-cream-500 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
                            title="Xóa công thức"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className={TH}>Nguyên liệu</th>
                            <th className={cn(THR)} style={{ width: 90 }}>Số lượng</th>
                            <th className={cn(THR)} style={{ width: 110 }}>Đơn giá</th>
                            <th className={cn(THR)} style={{ width: 110 }}>Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recipe.ingredients.map((ing, i) => (
                            <tr key={i} className="hover:bg-green-50/30 transition-colors">
                                <td className={TD}>
                                    <span className="font-medium">{ing.materialName}</span>
                                </td>
                                <td className={TDR}>{ing.quantity} {ing.unit}</td>
                                <td className={TDR}>₫{fmt(Math.round(ing.costPerBaseUnit || ing.costPerUnit))}/{ing.baseUnit || ing.unit}</td>
                                <td className={cn(TDR, "font-bold text-wine-700")}>₫{fmt(Math.round(ing.quantity * (ing.costPerBaseUnit || ing.costPerUnit)))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Smart Pricing Alert / Suggestion Banner */}
            {(ev.status === "OVER_BUDGET" || ev.status === "UNPRICED") && product && (
                <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-amber-50/70 border-t border-amber-200/60 text-xs gap-2">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                        <span className="text-[11px] text-amber-900">
                            Gợi ý giá bán tối ưu (Margin {costConfig.defaultTargetMarginPct}%): <strong className="font-mono font-bold text-green-900">₫{fmt(ev.suggestedPrice)}</strong>
                        </span>
                    </div>
                    <button
                        onClick={handleQuickApply}
                        disabled={applyingPrice}
                        className="text-[11px] font-medium text-green-900 bg-white hover:bg-green-100 border border-green-300 rounded px-2.5 py-1 transition-all flex items-center gap-1 shadow-2xs"
                    >
                        {applyingPrice ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                        Áp dụng giá ₫{fmt(ev.suggestedPrice)}
                    </button>
                </div>
            )}

            {recipe.notes && (
                <p className="px-4 py-2 text-[10px] text-cream-500 italic border-t border-cream-100 flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-cream-400 shrink-0" />
                    {recipe.notes}
                </p>
            )}
        </div>
    )
}


// ─── Create Recipe Flow (Step 1: Pick Product → Step 2: Add Ingredients) ───

function CreateRecipeFlow({
    products,
    materials,
    costConfig,
    onClose,
    onCreated,
}: {
    products: Product[]
    materials: RawMaterial[]
    costConfig: CostTargetConfig
    onClose: () => void
    onCreated: () => void
}) {

    const [step, setStep] = useState<1 | 2>(1)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [searchProduct, setSearchProduct] = useState("")
    const [ingredients, setIngredients] = useState<{ materialId: string; materialName: string; quantity: number; unit: string; costPerUnit: number; costPerBaseUnit: number; baseUnit: string }[]>([])
    const [selectedMaterialId, setSelectedMaterialId] = useState("")
    const [qty, setQty] = useState(0)
    const [qtyUnit, setQtyUnit] = useState("")
    const [saving, setSaving] = useState(false)
    const [notes, setNotes] = useState("")

    const filteredProducts = products.filter(
        (p) => !searchProduct || p.name.toLowerCase().includes(searchProduct.toLowerCase())
    )

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product)
        setStep(2)
    }

    const handleAddIngredient = () => {
        if (!selectedMaterialId || qty <= 0) return
        const mat = materials.find((m) => m.id === selectedMaterialId)
        if (!mat) return

        // Prevent duplicate
        if (ingredients.some((i) => i.materialId === mat.id)) {
            toast.error(`"${mat.name}" đã có trong công thức`)
            return
        }

        setIngredients((prev) => [
            ...prev,
            {
                materialId: mat.id,
                materialName: mat.name,
                quantity: qty,
                unit: qtyUnit || mat.baseUnit || mat.unit,
                costPerUnit: mat.costPrice,
                costPerBaseUnit: mat.costPerBaseUnit,
                baseUnit: mat.baseUnit || mat.unit,
            },
        ])
        setSelectedMaterialId("")
        setQty(0)
        setQtyUnit("")
    }

    const handleRemoveIngredient = (materialId: string) => {
        setIngredients((prev) => prev.filter((i) => i.materialId !== materialId))
    }

    const handleSave = async () => {
        if (!selectedProduct || ingredients.length === 0) return
        setSaving(true)
        const res = await createRecipe({
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            ingredients,
            notes,
        })
        setSaving(false)

        if (res.id) {
            toast.success(`Đã tạo công thức cho "${selectedProduct.name}"`)
            onCreated()
            onClose()
        } else {
            toast.error("Lỗi tạo công thức")
        }
    }

    const totalCost = ingredients.reduce((s, i) => s + i.quantity * (i.costPerBaseUnit || i.costPerUnit), 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl max-h-[85vh] flex flex-col animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                    <div>
                        <h3 className="font-display text-lg font-bold text-green-900">
                            <ChefHat className="inline h-5 w-5 mr-2" />
                            {step === 1 ? "Chọn sản phẩm" : `Công thức: ${selectedProduct?.name}`}
                        </h3>
                        <p className="text-xs text-cream-400 mt-0.5">
                            {step === 1 ? "Bước 1/2 — Chọn món cần setup công thức" : "Bước 2/2 — Thêm nguyên liệu"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-cream-100 rounded-lg transition-colors">
                        <X className="h-5 w-5 text-cream-400" />
                    </button>
                </div>

                {/* Step Indicator */}
                <div className="px-5 py-3 flex items-center gap-2 bg-cream-50 border-b border-cream-200">
                    <div className={cn("flex items-center gap-1.5 text-xs font-semibold", step >= 1 ? "text-green-700" : "text-cream-400")}>
                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold", step >= 1 ? "bg-green-700 text-white" : "bg-cream-300 text-cream-500")}>1</div>
                        Chọn món
                    </div>
                    <div className="flex-1 h-px bg-cream-300" />
                    <div className={cn("flex items-center gap-1.5 text-xs font-semibold", step >= 2 ? "text-green-700" : "text-cream-400")}>
                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold", step >= 2 ? "bg-green-700 text-white" : "bg-cream-300 text-cream-500")}>2</div>
                        Nguyên liệu
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {step === 1 ? (
                        <div className="space-y-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                                <input
                                    value={searchProduct}
                                    onChange={(e) => setSearchProduct(e.target.value)}
                                    placeholder="Tìm sản phẩm..."
                                    className="w-full rounded-lg border border-cream-300 pl-8 pr-4 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                                    autoFocus
                                />
                            </div>

                            {filteredProducts.length === 0 ? (
                                <div className="text-center py-8 text-cream-400">
                                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">{searchProduct ? "Không tìm thấy sản phẩm" : "Tất cả sản phẩm đã được thiết lập định lượng"}</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                                    {filteredProducts.map((product) => (
                                        <button
                                            key={product.id}
                                            onClick={() => handleSelectProduct(product)}
                                            className="w-full flex items-center gap-3 rounded-lg border border-cream-200 bg-white px-4 py-3 text-left hover:border-green-400 hover:bg-green-50/50 transition-all group"
                                        >
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream-200 group-hover:bg-green-100 transition-colors">
                                                <CookingPot className="h-4 w-4 text-cream-500 group-hover:text-green-700 transition-colors" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-green-900 truncate">{product.name}</p>
                                                <p className="text-[10px] text-cream-400">{product.category?.name ?? ""} · {product.type}</p>
                                            </div>
                                            <span className="font-mono text-xs text-cream-500">₫{fmt(product.sellPrice)}</span>
                                            <Plus className="h-4 w-4 text-cream-400 group-hover:text-green-700 transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Selected product info */}
                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-200">
                                    <CookingPot className="h-4 w-4 text-green-700" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-green-900">{selectedProduct?.name}</p>
                                    <p className="text-[10px] text-green-600">Giá bán: ₫{fmt(selectedProduct?.sellPrice ?? 0)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-cream-400">Giá vốn CT</p>
                                    <p className="font-mono text-sm font-bold text-wine-700">₫{fmt(Math.round(totalCost))}</p>
                                </div>
                            </div>

                            {/* Ingredient list */}
                            {ingredients.length > 0 && (
                                <div className="space-y-1.5">
                                    {ingredients.map((ing) => (
                                        <div key={ing.materialId} className="flex items-center justify-between p-3 bg-cream-50 rounded-lg border border-cream-200">
                                            <div>
                                                <p className="text-sm font-medium text-green-900">{ing.materialName}</p>
                                                <p className="text-xs text-cream-400">
                                                    {ing.quantity} {ing.unit} × ₫{fmt(Math.round(ing.costPerBaseUnit || ing.costPerUnit))}
                                                    {" = "}
                                                    <span className="font-mono font-bold text-wine-700">
                                                        ₫{fmt(Math.round(ing.quantity * (ing.costPerBaseUnit || ing.costPerUnit)))}
                                                    </span>
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveIngredient(ing.materialId)}
                                                className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add ingredient form */}
                            <div className="p-4 bg-cream-50 rounded-lg border border-cream-200 space-y-3">
                                <p className="text-xs font-semibold text-green-900 uppercase tracking-wider">Thêm nguyên liệu</p>
                                <select
                                    value={selectedMaterialId}
                                    onChange={(e) => {
                                        setSelectedMaterialId(e.target.value)
                                        const m = materials.find((m) => m.id === e.target.value)
                                        if (m) setQtyUnit(m.baseUnit || m.unit)
                                    }}
                                    className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm bg-white focus:border-green-500 focus:outline-none"
                                >
                                    <option value="">-- Chọn nguyên liệu --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.unit}{m.baseUnit && m.baseUnit !== m.unit ? ` → ${m.baseUnit}` : ""}) — ₫{fmt(Math.round(m.costPerBaseUnit))}/{m.baseUnit || m.unit}
                                        </option>
                                    ))}
                                </select>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-medium text-cream-400 mb-1 block">Số lượng</label>
                                        <input
                                            type="number"
                                            value={qty || ""}
                                            onChange={(e) => setQty(Number(e.target.value))}
                                            placeholder="200"
                                            className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-medium text-cream-400 mb-1 block">Đơn vị</label>
                                        <input
                                            value={qtyUnit}
                                            onChange={(e) => setQtyUnit(e.target.value)}
                                            placeholder="ml"
                                            className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-end">
                                        <button
                                            onClick={handleAddIngredient}
                                            disabled={!selectedMaterialId || qty <= 0}
                                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Thêm
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[10px] font-medium text-cream-400 mb-1 block">Ghi chú (tuỳ chọn)</label>
                                <input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="VD: Khuấy đều, đun sôi nhỏ lửa..."
                                    className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                                />
                            </div>

                            {/* Smart Pricing & Cost Control */}
                            {ingredients.length > 0 && selectedProduct && (
                                <SmartPricingCard
                                    productId={selectedProduct.id}
                                    productName={selectedProduct.name}
                                    productType={selectedProduct.type}
                                    currentSellPrice={selectedProduct.sellPrice}
                                    totalCost={totalCost}
                                    costConfig={costConfig}
                                    onPriceApplied={(newPrice) => {
                                        setSelectedProduct((prev) => (prev ? { ...prev, sellPrice: newPrice } : null))
                                    }}
                                />
                            )}

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-cream-200">
                    {step === 2 && (
                        <button
                            onClick={() => { setStep(1); setSelectedProduct(null); setIngredients([]) }}
                            className="text-xs text-cream-500 hover:text-green-700 transition-colors"
                        >
                            ← Chọn món khác
                        </button>
                    )}
                    {step === 1 && <div />}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-cream-500 hover:bg-cream-100 rounded-lg transition-colors">
                            Hủy
                        </button>
                        {step === 2 && (
                            <button
                                onClick={handleSave}
                                disabled={saving || ingredients.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 transition-all"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {saving ? "Đang lưu..." : "Lưu công thức"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Edit Recipe Modal ───
function EditRecipeModal({
    productId,
    productName,
    product,
    recipe,
    materials,
    costConfig,
    onClose,
    onSaved,
    onPriceUpdated,
}: {
    productId: string
    productName: string
    product?: Product
    recipe: Recipe
    materials: RawMaterial[]
    costConfig: CostTargetConfig
    onClose: () => void
    onSaved: () => void
    onPriceUpdated?: (newPrice: number) => void
}) {
    const [currentProduct, setCurrentProduct] = useState<Product | undefined>(product)
    const [ingredients, setIngredients] = useState(recipe.ingredients)
    const [addMode, setAddMode] = useState(false)
    const [selectedMaterialId, setSelectedMaterialId] = useState("")
    const [qty, setQty] = useState(0)
    const [qtyUnit, setQtyUnit] = useState("")
    const [saving, setSaving] = useState(false)

    const handleAddIngredient = async () => {
        if (!selectedMaterialId || qty <= 0) return
        const mat = materials.find((m) => m.id === selectedMaterialId)
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
            toast.success(`Đã thêm "${mat.name}"`)
            const recipes = await getRecipes()
            const updated = recipes.find((r) => r.productId === productId)
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
            setIngredients((prev) => prev.filter((i) => i.materialId !== materialId))
            toast.success("Đã xóa nguyên liệu")
            onSaved()
        }
        setSaving(false)
    }

    const handleDeleteAll = async () => {
        if (!confirm("Xóa toàn bộ công thức?")) return
        setSaving(true)
        const res = await deleteRecipe(productId)
        if (res.success) {
            toast.success("Đã xóa công thức")
            onSaved()
            onClose()
        }
        setSaving(false)
    }

    const totalCost = ingredients.reduce((s, i) => s + (i.costPerBaseUnit || i.costPerUnit) * i.quantity, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl max-h-[85vh] flex flex-col animate-fade-in-up">
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                    <div>
                        <h3 className="font-display text-lg font-bold text-green-900">
                            <ChefHat className="inline h-5 w-5 mr-2" />
                            Sửa: {productName}
                        </h3>
                        <p className="text-xs text-cream-400 mt-0.5">
                            Giá vốn: <span className="font-mono font-bold text-wine-700">₫{fmt(Math.round(totalCost))}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-cream-100 rounded-lg transition-colors">
                        <X className="h-5 w-5 text-cream-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Smart Pricing & Cost Control for Existing Recipe */}
                    {currentProduct && (
                        <SmartPricingCard
                            productId={productId}
                            productName={productName}
                            productType={currentProduct.type}
                            currentSellPrice={currentProduct.sellPrice}
                            totalCost={totalCost}
                            costConfig={costConfig}
                            onPriceApplied={(newPrice) => {
                                setCurrentProduct((prev) => (prev ? { ...prev, sellPrice: newPrice } : prev))
                                onPriceUpdated?.(newPrice)
                            }}
                        />
                    )}

                    {ingredients.length === 0 && !addMode && (
                        <div className="text-center py-8 text-cream-400">
                            <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-30" />
                            <p>Chưa có nguyên liệu nào</p>
                        </div>
                    )}

                    {ingredients.map((ing) => (
                        <div key={ing.materialId} className="flex items-center justify-between p-3 bg-cream-50 rounded-lg border border-cream-200">
                            <div>
                                <p className="text-sm font-medium text-green-900">{ing.materialName}</p>
                                <p className="text-xs text-cream-400">
                                    {ing.quantity} {ing.unit} × ₫{fmt(Math.round(ing.costPerBaseUnit || ing.costPerUnit))}
                                    {" = "}
                                    <span className="font-mono font-bold">
                                        ₫{fmt(Math.round((ing.costPerBaseUnit || ing.costPerUnit) * ing.quantity))}
                                    </span>
                                </p>
                            </div>
                            <button
                                onClick={() => handleRemoveIngredient(ing.materialId)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded"
                                disabled={saving}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}

                    {addMode && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
                            <select
                                value={selectedMaterialId}
                                onChange={(e) => {
                                    setSelectedMaterialId(e.target.value)
                                    const m = materials.find((m) => m.id === e.target.value)
                                    if (m) setQtyUnit(m.baseUnit || m.unit)
                                }}
                                className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm bg-white"
                            >
                                <option value="">-- Chọn nguyên liệu --</option>
                                {materials.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.unit}{m.baseUnit && m.baseUnit !== m.unit ? ` → ${m.baseUnit}` : ""}) — ₫{fmt(Math.round(m.costPerBaseUnit))}/{m.baseUnit || m.unit}
                                    </option>
                                ))}
                            </select>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-cream-500 mb-1 block">Số lượng</label>
                                    <input type="number" value={qty || ""} onChange={(e) => setQty(Number(e.target.value))}
                                        className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm" placeholder="200" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-cream-500 mb-1 block">Đơn vị</label>
                                    <input value={qtyUnit} onChange={(e) => setQtyUnit(e.target.value)}
                                        className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm" placeholder="ml" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleAddIngredient}
                                    disabled={saving || !selectedMaterialId || qty <= 0}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                    Thêm
                                </button>
                                <button onClick={() => setAddMode(false)} className="px-3 py-1.5 text-xs text-cream-500 hover:bg-cream-100 rounded-lg">
                                    Hủy
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-5 py-4 border-t border-cream-200">
                    <div className="flex gap-2">
                        {!addMode && (
                            <button
                                onClick={() => setAddMode(true)}
                                className="flex items-center gap-1 px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800"
                            >
                                <Plus className="h-4 w-4" /> Thêm NL
                            </button>
                        )}
                        {ingredients.length > 0 && (
                            <button
                                onClick={handleDeleteAll}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-2 text-red-500 text-sm rounded-lg hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" /> Xóa tất cả
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="px-4 py-2 text-sm text-cream-500 hover:bg-cream-100 rounded-lg">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
