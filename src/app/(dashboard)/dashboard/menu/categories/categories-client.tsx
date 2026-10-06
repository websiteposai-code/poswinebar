"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, Loader2, FolderOpen, LayoutGrid, ChefHat } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
} from "@/actions/menu"
import type { Category, CategoryFormData } from "@/types"

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

interface CategoriesClientProps {
    initialCategories: Category[]
}

export default function CategoriesClient({ initialCategories }: CategoriesClientProps) {
    const [categories, setCategories] = useState<Category[]>(initialCategories)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingCat, setEditingCat] = useState<Category | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [formName, setFormName] = useState("")
    const [formNameVi, setFormNameVi] = useState("")

    const loadCategories = useCallback(async () => {
        const data = await getCategories()
        setCategories(data)
    }, [])

    const openCreateDialog = () => {
        setEditingCat(null)
        setFormName("")
        setFormNameVi("")
        setDialogOpen(true)
    }

    const openEditDialog = (cat: Category) => {
        setEditingCat(cat)
        setFormName(cat.name)
        setFormNameVi(cat.nameVi ?? "")
        setDialogOpen(true)
    }

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error("Tên danh mục không được để trống")
            return
        }

        setSaving(true)
        const data: CategoryFormData = {
            name: formName.trim(),
            nameVi: formNameVi.trim() || undefined,
            icon: editingCat?.icon ?? undefined,
        }

        if (editingCat) {
            const result = await updateCategory(editingCat.id, data)
            if (result.success) {
                toast.success(`Đã cập nhật "${formName}"`)
            } else {
                toast.error(result.error?.message ?? "Lỗi cập nhật")
            }
        } else {
            const result = await createCategory(data)
            if (result.success) {
                toast.success(`Đã tạo danh mục "${formName}"`)
            } else {
                toast.error(result.error?.message ?? "Lỗi tạo danh mục")
            }
        }

        setSaving(false)
        setDialogOpen(false)
        loadCategories()
    }

    const handleDelete = async (id: string) => {
        setSaving(true)
        const result = await deleteCategory(id)
        if (result.success) {
            toast.success("Đã xóa danh mục")
        } else {
            toast.error(result.error?.message ?? "Lỗi xóa")
        }
        setSaving(false)
        setDeleteConfirm(null)
        loadCategories()
    }

    const moveCategory = async (idx: number, direction: "up" | "down") => {
        const newList = [...categories]
        const swapIdx = direction === "up" ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= newList.length) return

            ;[newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]]
        setCategories(newList)

        await reorderCategories(newList.map((c) => c.id))
        toast.success("Đã sắp xếp lại")
    }

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
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-green-900">Danh mục sản phẩm</h2>
                        <p className="text-sm text-cream-500">
                            {categories.length} danh mục · Kéo thả để sắp xếp
                        </p>
                    </div>
                    <Button
                        onClick={openCreateDialog}
                        className="bg-green-900 text-cream-50 hover:bg-green-800"
                    >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Thêm danh mục
                    </Button>
                </div>

                {/* Categories Grid */}
                {categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-cream-300 bg-cream-100 py-20">
                        <p className="text-cream-500">Chưa có danh mục nào</p>
                        <Button
                            onClick={openCreateDialog}
                            variant="outline"
                            className="mt-4"
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            Tạo danh mục đầu tiên
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {categories.map((cat, idx) => (
                            <div
                                key={cat.id}
                                className={cn(
                                    "group flex items-center gap-4 rounded-xl border bg-cream-100 px-4 py-3 transition-all hover:border-green-600 hover:shadow-sm",
                                    deleteConfirm === cat.id ? "border-red-300 bg-red-50" : "border-cream-300"
                                )}
                            >
                                {/* Drag Handle + Order Buttons */}
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={() => moveCategory(idx, "up")}
                                        disabled={idx === 0}
                                        className="rounded p-0.5 text-cream-400 hover:text-green-700 disabled:opacity-20"
                                    >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => moveCategory(idx, "down")}
                                        disabled={idx === categories.length - 1}
                                        className="rounded p-0.5 text-cream-400 hover:text-green-700 disabled:opacity-20"
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {/* Monogram */}
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cream-200 font-display text-xl italic text-green-800">
                                    {cat.name.trim().charAt(0).toUpperCase()}
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-green-900">{cat.name}</h3>
                                        {!cat.isActive && (
                                            <Badge variant="secondary" className="text-xs">
                                                Ẩn
                                            </Badge>
                                        )}
                                    </div>
                                    {cat.nameVi && (
                                        <p className="text-sm text-cream-500">{cat.nameVi}</p>
                                    )}
                                </div>

                                {/* Product count */}
                                <div className="text-right">
                                    <p className="font-mono text-sm font-semibold text-green-900">
                                        {cat._count?.products ?? 0}
                                    </p>
                                    <p className="text-xs text-cream-500">sản phẩm</p>
                                </div>

                                {/* Actions */}
                                {deleteConfirm === cat.id ? (
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-red-600 mr-1">Xóa?</span>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            disabled={saving}
                                            className="rounded-lg p-2 text-red-600 hover:bg-red-100 transition-all"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(null)}
                                            className="rounded-lg p-2 text-cream-500 hover:bg-cream-200 transition-all"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEditDialog(cat)}
                                            className="rounded-lg p-2 text-cream-500 hover:bg-cream-200 hover:text-green-700 transition-all"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(cat.id)}
                                            className="rounded-lg p-2 text-cream-500 hover:bg-red-50 hover:text-red-600 transition-all"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-cream-50 border-cream-300 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-display text-xl text-green-900">
                            {editingCat ? "Sửa danh mục" : "Thêm danh mục mới"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-green-900">
                                Tên danh mục (EN) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g. Wine by Glass"
                                className="border-cream-300 bg-cream-100 focus:border-green-700"
                            />
                        </div>

                        {/* Name Vietnamese */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-green-900">
                                Tên tiếng Việt
                            </Label>
                            <Input
                                value={formNameVi}
                                onChange={(e) => setFormNameVi(e.target.value)}
                                placeholder="e.g. Rượu ly"
                                className="border-cream-300 bg-cream-100 focus:border-green-700"
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
                            disabled={saving || !formName.trim()}
                            className="bg-green-900 text-cream-50 hover:bg-green-800"
                        >
                            {saving ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="mr-1.5 h-4 w-4" />
                            )}
                            {editingCat ? "Lưu" : "Tạo"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
