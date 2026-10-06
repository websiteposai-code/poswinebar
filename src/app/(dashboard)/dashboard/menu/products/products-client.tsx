"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, Pencil, Trash2, Search, Eye, EyeOff, Wine, UtensilsCrossed, Loader2, Check, X, FolderOpen, LayoutGrid, Package, GlassWater, Grape, Coffee, ChefHat } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    getProducts,
    getCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductActive,
} from "@/actions/menu"
import type { Product, Category, ProductFormData, ProductType } from "@/types"

const TYPE_CONFIG: Record<ProductType, { label: string; icon: typeof Wine; color: string }> = {
    WINE_BOTTLE: { label: "Chai", icon: Wine, color: "bg-wine-100 text-wine-700" },
    WINE_GLASS: { label: "Ly", icon: GlassWater, color: "bg-wine-100 text-wine-700" },
    WINE_TASTING: { label: "Tasting", icon: Grape, color: "bg-wine-100 text-wine-700" },
    FOOD: { label: "Food", icon: UtensilsCrossed, color: "bg-green-100 text-green-700" },
    DRINK: { label: "Drink", icon: Coffee, color: "bg-blue-100 text-blue-700" },
    OTHER: { label: "Khác", icon: Package, color: "bg-cream-200 text-cream-500" },
}

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

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

interface ProductsClientProps {
    initialProducts: Product[]
    initialCategories: Category[]
}

export default function ProductsClient({ initialProducts, initialCategories }: ProductsClientProps) {
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [categories, setCategories] = useState<Category[]>(initialCategories)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterCategory, setFilterCategory] = useState<string>("")
    const [filterType, setFilterType] = useState<string>("")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [form, setForm] = useState<ProductFormData>({
        name: "",
        categoryId: "",
        type: "FOOD",
        costPrice: 0,
        sellPrice: 0,
    })

    const loadData = useCallback(async () => {
        const [productsData, categoriesData] = await Promise.all([
            getProducts(),
            getCategories(),
        ])
        setProducts(productsData)
        setCategories(categoriesData)
    }, [])

    // Client-side filtering (instant, no server roundtrip)
    const filteredProducts = products.filter((p) => {
        if (filterCategory && p.categoryId !== filterCategory) return false
        if (filterType && p.type !== filterType) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (
                !p.name.toLowerCase().includes(q) &&
                !(p.nameVi?.toLowerCase().includes(q)) &&
                !(p.sku?.toLowerCase().includes(q))
            ) return false
        }
        return true
    })

    const openCreateDialog = () => {
        setEditingProduct(null)
        setForm({
            name: "",
            categoryId: categories[0]?.id ?? "",
            type: "FOOD",
            costPrice: 0,
            sellPrice: 0,
        })
        setDialogOpen(true)
    }

    const openEditDialog = (product: Product) => {
        setEditingProduct(product)
        setForm({
            name: product.name,
            nameVi: product.nameVi ?? undefined,
            sku: product.sku ?? undefined,
            categoryId: product.categoryId,
            type: product.type,
            vintage: product.vintage ?? undefined,
            appellation: product.appellation ?? undefined,
            grapeVariety: product.grapeVariety ?? undefined,
            country: product.country ?? undefined,
            region: product.region ?? undefined,
            alcoholPct: product.alcoholPct ?? undefined,
            tastingNotes: product.tastingNotes ?? undefined,
            costPrice: product.costPrice,
            sellPrice: product.sellPrice,
            glassPrice: product.glassPrice ?? undefined,
            isByGlass: product.isByGlass,
            glassesPerBottle: product.glassesPerBottle,
            oxidationHours: product.oxidationHours ?? undefined,
            servingTemp: product.servingTemp ?? undefined,
            decantingTime: product.decantingTime ?? undefined,
            description: product.description ?? undefined,
        })
        setDialogOpen(true)
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error("Tên sản phẩm không được để trống")
            return
        }
        if (!form.categoryId) {
            toast.error("Chọn danh mục")
            return
        }
        if (form.sellPrice <= 0) {
            toast.error("Giá bán phải lớn hơn 0")
            return
        }

        setSaving(true)

        if (editingProduct) {
            const result = await updateProduct(editingProduct.id, form)
            if (result.success) {
                toast.success(`Đã cập nhật "${form.name}"`)
            } else {
                toast.error(result.error?.message ?? "Lỗi cập nhật")
            }
        } else {
            const result = await createProduct(form)
            if (result.success) {
                toast.success(`Đã tạo sản phẩm "${form.name}"`)
            } else {
                toast.error(result.error?.message ?? "Lỗi tạo sản phẩm")
            }
        }

        setSaving(false)
        setDialogOpen(false)
        loadData()
    }

    const handleDelete = async (id: string) => {
        setSaving(true)
        const result = await deleteProduct(id)
        if (result.success) {
            toast.success("Đã xóa sản phẩm")
        } else {
            toast.error(result.error?.message ?? "Lỗi xóa")
        }
        setSaving(false)
        setDeleteConfirm(null)
        loadData()
    }

    const handleToggleActive = async (id: string) => {
        const result = await toggleProductActive(id)
        if (result.success) {
            toast.success(result.data?.isActive ? "Đã bật sản phẩm" : "Đã ẩn sản phẩm")
            loadData()
        }
    }

    const isWineType = form.type === "WINE_BOTTLE" || form.type === "WINE_GLASS" || form.type === "WINE_TASTING"

    return (
        <div className="min-h-screen">
            {/* Page Header */}
            <div className="border-b border-cream-300 bg-cream-50 px-6 py-5">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900">
                            Menu & Sản phẩm
                        </h1>
                        <p className="text-sm text-cream-500">
                            Quản lý danh mục và sản phẩm cho POS
                        </p>
                    </div>
                </div>
            </div>

            {/* Tab Nav */}
            <MenuTabNav />

            {/* Content */}
            <div className="p-6">
                {/* Top Actions */}
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-green-900">Danh sách sản phẩm</h2>
                        <p className="text-sm text-cream-500">{filteredProducts.length} sản phẩm</p>
                    </div>
                    <Button
                        onClick={openCreateDialog}
                        className="bg-green-900 text-cream-50 hover:bg-green-800"
                    >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Thêm sản phẩm
                    </Button>
                </div>

                {/* Filters */}
                <div className="mb-5 flex flex-wrap gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-400" />
                        <Input
                            placeholder="Tìm sản phẩm..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 border-cream-300 bg-cream-100 focus:border-green-700"
                        />
                    </div>

                    {/* Category filter */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="rounded-lg border border-cream-300 bg-cream-100 px-3 py-2 text-sm text-green-900 focus:border-green-700 focus:outline-none"
                    >
                        <option value="">Tất cả danh mục</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>

                    {/* Type filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="rounded-lg border border-cream-300 bg-cream-100 px-3 py-2 text-sm text-green-900 focus:border-green-700 focus:outline-none"
                    >
                        <option value="">Tất cả loại</option>
                        {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>
                                {config.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Product Table */}
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-cream-300 bg-cream-100 py-20">
                        <p className="text-cream-500">Không tìm thấy sản phẩm</p>
                        <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                            <Plus className="mr-1 h-4 w-4" />
                            Tạo sản phẩm đầu tiên
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-cream-300 bg-cream-100">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-cream-300 bg-cream-200/50">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cream-500">
                                        Sản phẩm
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cream-500">
                                        Loại
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cream-500">
                                        Danh mục
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cream-500">
                                        Giá bán
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cream-500">
                                        Giá vốn
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cream-500">
                                        Margin
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-cream-500">
                                        Trạng thái
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-cream-500">
                                        Thao tác
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-300">
                                {filteredProducts.map((product) => {
                                    const margin =
                                        product.costPrice > 0
                                            ? (((product.sellPrice - product.costPrice) / product.sellPrice) * 100).toFixed(0)
                                            : "—"
                                    const typeConfig = TYPE_CONFIG[product.type]

                                    return (
                                        <tr
                                            key={product.id}
                                            className={cn(
                                                "transition-colors hover:bg-cream-50",
                                                !product.isActive && "opacity-50"
                                            )}
                                        >
                                            {/* Product info */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cream-200 font-display text-base italic text-green-800">
                                                        {product.name.trim().charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-green-900">
                                                            {product.name}
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            {product.nameVi && (
                                                                <span className="text-xs text-cream-500">
                                                                    {product.nameVi}
                                                                </span>
                                                            )}
                                                            {product.sku && (
                                                                <span className="font-mono text-xs text-cream-400">
                                                                    {product.sku}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {product.vintage && (
                                                            <span className="text-xs text-cream-500">
                                                                {product.vintage} · {product.country}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Type badge */}
                                            <td className="px-4 py-3">
                                                <Badge className={cn("text-xs font-medium", typeConfig.color)}>
                                                    {typeConfig.label}
                                                </Badge>
                                                {product.isByGlass && (
                                                    <div className="mt-1">
                                                        <span className="glass-indicator rounded-full bg-green-100 px-1.5 py-0.5 text-green-700">
                                                            {product.glassesPerBottle} ly/chai
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Category */}
                                            <td className="px-4 py-3 text-sm text-cream-500">
                                                {product.category?.name}
                                            </td>

                                            {/* Sell price */}
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-mono text-sm font-bold text-green-900">
                                                    ₫{formatPrice(product.sellPrice)}
                                                </span>
                                                {product.glassPrice && (
                                                    <p className="font-mono text-xs text-cream-500">
                                                        /ly: ₫{formatPrice(product.glassPrice)}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Cost price */}
                                            <td className="px-4 py-3 text-right font-mono text-sm text-cream-500">
                                                ₫{formatPrice(product.costPrice)}
                                            </td>

                                            {/* Margin */}
                                            <td className="px-4 py-3 text-right">
                                                <span
                                                    className={cn(
                                                        "font-mono text-sm font-semibold",
                                                        Number(margin) >= 60
                                                            ? "text-green-700"
                                                            : Number(margin) >= 40
                                                                ? "text-yellow-600"
                                                                : "text-red-600"
                                                    )}
                                                >
                                                    {margin}%
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggleActive(product.id)}
                                                    className={cn(
                                                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                                                        product.isActive
                                                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                            : "bg-cream-200 text-cream-500 hover:bg-cream-300"
                                                    )}
                                                >
                                                    {product.isActive ? (
                                                        <>
                                                            <Eye className="h-3 w-3" /> Hiện
                                                        </>
                                                    ) : (
                                                        <>
                                                            <EyeOff className="h-3 w-3" /> Ẩn
                                                        </>
                                                    )}
                                                </button>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-center">
                                                {deleteConfirm === product.id ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(product.id)}
                                                            disabled={saving}
                                                            className="rounded-lg p-1.5 text-red-600 hover:bg-red-100"
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="rounded-lg p-1.5 text-cream-500 hover:bg-cream-200"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => openEditDialog(product)}
                                                            className="rounded-lg p-1.5 text-cream-400 hover:bg-cream-200 hover:text-green-700 transition-all"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(product.id)}
                                                            className="rounded-lg p-1.5 text-cream-400 hover:bg-red-50 hover:text-red-600 transition-all"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Product Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-cream-50 border-cream-300 max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-display text-xl text-green-900">
                            {editingProduct ? `Sửa: ${editingProduct.name}` : "Thêm sản phẩm mới"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Tên sản phẩm (EN) <span className="text-red-500">*</span></Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Château Margaux 2018"
                                    className="border-cream-300 bg-cream-100"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Tên tiếng Việt</Label>
                                <Input
                                    value={form.nameVi ?? ""}
                                    onChange={(e) => setForm({ ...form, nameVi: e.target.value })}
                                    placeholder="Rượu vang Pháp"
                                    className="border-cream-300 bg-cream-100"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                            <div className="space-y-1.5">
                                <Label>Loại <span className="text-red-500">*</span></Label>
                                <select
                                    value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value as ProductType })}
                                    className="w-full rounded-lg border border-cream-300 bg-cream-100 px-3 py-2 text-sm"
                                >
                                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>
                                            {config.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Danh mục <span className="text-red-500">*</span></Label>
                                <select
                                    value={form.categoryId}
                                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                                    className="w-full rounded-lg border border-cream-300 bg-cream-100 px-3 py-2 text-sm"
                                >
                                    <option value="">Chọn danh mục</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>SKU</Label>
                                <Input
                                    value={form.sku ?? ""}
                                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                                    placeholder="WB-001"
                                    className="border-cream-300 bg-cream-100 font-mono"
                                />
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="rounded-lg border border-cream-300 bg-cream-100/50 p-4">
                            <h3 className="mb-3 text-sm font-semibold text-green-900">Giá</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                                <div className="space-y-1.5">
                                    <Label>Giá vốn</Label>
                                    <Input
                                        type="number"
                                        value={form.costPrice}
                                        onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                                        className="border-cream-300 bg-cream-100 font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Giá bán <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        value={form.sellPrice}
                                        onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) })}
                                        className="border-cream-300 bg-cream-100 font-mono"
                                    />
                                </div>
                            </div>
                            {form.costPrice > 0 && form.sellPrice > 0 && (
                                <p className="mt-2 text-xs text-cream-500">
                                    Margin:{" "}
                                    <span className="font-mono font-semibold text-green-700">
                                        {(((form.sellPrice - form.costPrice) / form.sellPrice) * 100).toFixed(1)}%
                                    </span>
                                </p>
                            )}
                        </div>

                        {/* Wine Details — conditional */}
                        {isWineType && (
                            <div className="rounded-lg border border-wine-100 bg-wine-50 p-4">
                                <h3 className="mb-3 text-sm font-semibold text-wine-700">Thông tin rượu</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Vintage</Label>
                                        <Input
                                            type="number"
                                            value={form.vintage ?? ""}
                                            onChange={(e) => setForm({ ...form, vintage: Number(e.target.value) || undefined })}
                                            placeholder="2020"
                                            className="border-cream-300 bg-cream-100 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Nho (Grape)</Label>
                                        <Input
                                            value={form.grapeVariety ?? ""}
                                            onChange={(e) => setForm({ ...form, grapeVariety: e.target.value })}
                                            placeholder="Cabernet Sauvignon"
                                            className="border-cream-300 bg-cream-100"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Quốc gia</Label>
                                        <Input
                                            value={form.country ?? ""}
                                            onChange={(e) => setForm({ ...form, country: e.target.value })}
                                            placeholder="France"
                                            className="border-cream-300 bg-cream-100"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Vùng</Label>
                                        <Input
                                            value={form.region ?? ""}
                                            onChange={(e) => setForm({ ...form, region: e.target.value })}
                                            placeholder="Bordeaux"
                                            className="border-cream-300 bg-cream-100"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Appellation</Label>
                                        <Input
                                            value={form.appellation ?? ""}
                                            onChange={(e) => setForm({ ...form, appellation: e.target.value })}
                                            placeholder="Margaux AOC"
                                            className="border-cream-300 bg-cream-100"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Nồng độ (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={form.alcoholPct ?? ""}
                                            onChange={(e) => setForm({ ...form, alcoholPct: Number(e.target.value) || undefined })}
                                            placeholder="13.5"
                                            className="border-cream-300 bg-cream-100 font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Nhiệt độ phục vụ</Label>
                                        <Input
                                            value={form.servingTemp ?? ""}
                                            onChange={(e) => setForm({ ...form, servingTemp: e.target.value })}
                                            placeholder="16-18°C"
                                            className="border-cream-300 bg-cream-100"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Decanting</Label>
                                        <Input
                                            value={form.decantingTime ?? ""}
                                            onChange={(e) => setForm({ ...form, decantingTime: e.target.value })}
                                            placeholder="2h"
                                            className="border-cream-300 bg-cream-100"
                                        />
                                    </div>
                                </div>

                                {/* By-Glass Setup Section */}
                                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                                    <h4 className="text-xs font-bold text-green-800 uppercase mb-3 flex items-center gap-1.5">
                                        Setup bán theo ly
                                    </h4>

                                    {/* isByGlass toggle */}
                                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                        <div>
                                            <Label className="text-sm font-semibold text-green-900">Cho phép bán theo ly</Label>
                                            <p className="text-[10px] text-cream-500 mt-0.5">Bật để nhân viên rót ly từ chai tại POS</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, isByGlass: !form.isByGlass })}
                                            className={cn(
                                                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer",
                                                form.isByGlass ? "bg-green-600" : "bg-cream-300"
                                            )}
                                        >
                                            <span className={cn(
                                                "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                                                form.isByGlass ? "translate-x-5" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>

                                    {form.isByGlass && (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 pt-2 border-t border-green-200">
                                            <div className="space-y-1.5">
                                                <Label className="flex items-center gap-1">
                                                    Số ly / chai
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={20}
                                                    value={form.glassesPerBottle ?? 8}
                                                    onChange={(e) => setForm({ ...form, glassesPerBottle: Number(e.target.value) })}
                                                    className="border-cream-300 bg-cream-100 font-mono"
                                                />
                                                <p className="text-[9px] text-cream-400">Thường 6-8 ly cho rượu vang</p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="flex items-center gap-1">
                                                    Giờ oxy hóa tối đa
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={168}
                                                    value={form.oxidationHours ?? ""}
                                                    onChange={(e) => setForm({ ...form, oxidationHours: Number(e.target.value) || undefined })}
                                                    placeholder="48"
                                                    className="border-cream-300 bg-cream-100 font-mono"
                                                />
                                                <p className="text-[9px] text-cream-400">Sau thời gian này, hệ thống cảnh báo</p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Giá bán ly (₫)</Label>
                                                <Input
                                                    type="number"
                                                    value={form.glassPrice ?? ""}
                                                    onChange={(e) => setForm({ ...form, glassPrice: Number(e.target.value) || undefined })}
                                                    placeholder="110000"
                                                    className="border-cream-300 bg-cream-100 font-mono"
                                                />
                                                {form.glassPrice && form.costPrice > 0 && (form.glassesPerBottle ?? 0) > 0 && (
                                                    <p className="text-[9px] text-green-600 font-bold">
                                                        Margin ly: {(((form.glassPrice * (form.glassesPerBottle ?? 8) - form.costPrice) / (form.glassPrice * (form.glassesPerBottle ?? 8))) * 100).toFixed(0)}%
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {form.isByGlass && form.oxidationHours && (
                                        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                                            <p className="text-[10px] text-amber-700">
                                                Chai mở quá <strong>{form.oxidationHours}h</strong> sẽ hiện cảnh báo đỏ tại POS và Dashboard.
                                                {form.oxidationHours <= 24 ? " Sparkling/Rosé nên dưới 24h." :
                                                    form.oxidationHours <= 48 ? " Rượu trắng nên dưới 48h." :
                                                        " Rượu đỏ có thể mở lâu hơn."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label>Mô tả</Label>
                            <textarea
                                value={form.description ?? ""}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                placeholder="Mô tả sản phẩm..."
                                className="w-full rounded-lg border border-cream-300 bg-cream-100 px-3 py-2 text-sm focus:border-green-700 focus:outline-none resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            className="border-cream-300"
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !form.name.trim() || !form.categoryId || form.sellPrice <= 0}
                            className="bg-green-900 text-cream-50 hover:bg-green-800"
                        >
                            {saving ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="mr-1.5 h-4 w-4" />
                            )}
                            {editingProduct ? "Lưu" : "Tạo sản phẩm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
