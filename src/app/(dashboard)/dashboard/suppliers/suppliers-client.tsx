"use client"

import { useState } from "react"
import { Search, Plus, Edit2, Trash2, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { createSupplier, updateSupplier, deleteSupplier } from "@/actions/procurement"

interface Supplier {
    id: string
    name: string
    contactPerson: string | null
    phone: string | null
    email: string | null
    address: string | null
    taxCode: string | null
    bankAccount: string | null
    bankName: string | null
    notes: string | null
    isActive: boolean
}

interface Props {
    initial: { suppliers: Supplier[] }
}

export default function SuppliersClient({ initial }: Props) {
    const [suppliers, setSuppliers] = useState<Supplier[]>(initial.suppliers)
    const [search, setSearch] = useState("")
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: "", contactPerson: "", phone: "", email: "",
        address: "", taxCode: "", bankAccount: "", bankName: "", notes: "",
    })

    const filtered = suppliers.filter((s) =>
        s.isActive && (
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.contactPerson?.toLowerCase().includes(search.toLowerCase()) ||
            s.phone?.includes(search)
        )
    )

    const resetForm = () => {
        setForm({ name: "", contactPerson: "", phone: "", email: "", address: "", taxCode: "", bankAccount: "", bankName: "", notes: "" })
        setEditingId(null)
        setShowForm(false)
    }

    const handleEdit = (s: Supplier) => {
        setForm({
            name: s.name,
            contactPerson: s.contactPerson ?? "",
            phone: s.phone ?? "",
            email: s.email ?? "",
            address: s.address ?? "",
            taxCode: s.taxCode ?? "",
            bankAccount: s.bankAccount ?? "",
            bankName: s.bankName ?? "",
            notes: s.notes ?? "",
        })
        setEditingId(s.id)
        setShowForm(true)
    }

    const handleSubmit = async () => {
        if (!form.name.trim()) { toast.error("Tên NCC không được để trống"); return }
        try {
            if (editingId) {
                await updateSupplier(editingId, form)
                setSuppliers((prev) => prev.map((s) => s.id === editingId ? { ...s, ...form } : s))
                toast.success("Đã cập nhật NCC")
            } else {
                const result = await createSupplier(form)
                if (result.success && result.data) {
                    const d = result.data as Record<string, unknown>
                    const newSupplier: Supplier = {
                        id: d.id as string,
                        name: d.name as string,
                        contactPerson: (d.contactName as string) ?? (d.contactPerson as string) ?? null,
                        phone: (d.phone as string) ?? null,
                        email: (d.email as string) ?? null,
                        address: (d.address as string) ?? null,
                        taxCode: (d.taxCode as string) ?? null,
                        bankAccount: (d.bankAccount as string) ?? null,
                        bankName: (d.bankName as string) ?? null,
                        notes: (d.notes as string) ?? null,
                        isActive: (d.isActive as boolean) ?? true,
                    }
                    setSuppliers((prev) => [...prev, newSupplier])
                    toast.success("Đã thêm NCC mới")
                }
            }
            resetForm()
        } catch {
            toast.error("Lỗi khi lưu")
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Ẩn nhà cung cấp "${name}"?`)) return
        try {
            await deleteSupplier(id)
            setSuppliers((prev) => prev.map((s) => s.id === id ? { ...s, isActive: false } : s))
            toast.success(`Đã ẩn: ${name}`)
        } catch {
            toast.error("Lỗi khi xóa")
        }
    }

    return (
        <div className="p-4 lg:p-6 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-xl font-bold text-green-900 flex items-center gap-2">
                        Nhà cung cấp
                    </h1>
                    <p className="text-xs text-cream-500 mt-0.5">{filtered.length} nhà cung cấp hoạt động</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm NCC..."
                            className="h-8 pl-8 text-xs border-cream-300"
                        />
                    </div>
                    <Button
                        size="sm"
                        onClick={() => { resetForm(); setShowForm(true) }}
                        className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs gap-1.5 shrink-0"
                    >
                        <Plus className="h-3.5 w-3.5" /> Thêm NCC
                    </Button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="rounded-xl border border-cream-300 bg-white p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-green-900">
                            {editingId ? "Chỉnh sửa NCC" : "Thêm NCC mới"}
                        </h3>
                        <button onClick={resetForm} className="p-1 rounded hover:bg-cream-200">
                            <X className="h-4 w-4 text-cream-500" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-cream-500 uppercase">Tên NCC *</label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-500 uppercase">Người liên hệ</label>
                            <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="h-8 text-xs mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-500 uppercase">Số điện thoại</label>
                            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-500 uppercase">Email</label>
                            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 text-xs mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-500 uppercase">Mã số thuế</label>
                            <Input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} className="h-8 text-xs mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-500 uppercase">Ngân hàng</label>
                            <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="h-8 text-xs mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-cream-500 uppercase">Số tài khoản</label>
                            <Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} className="h-8 text-xs mt-1" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-cream-500 uppercase">Địa chỉ</label>
                            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-8 text-xs mt-1" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={resetForm} className="text-xs">Hủy</Button>
                        <Button size="sm" onClick={handleSubmit} className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs gap-1">
                            <Check className="h-3 w-3" /> {editingId ? "Cập nhật" : "Tạo mới"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Supplier List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((s) => (
                    <div
                        key={s.id}
                        className="rounded-xl border border-cream-300 bg-white p-4 hover:shadow-md hover:border-green-400 transition-all"
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div>
                                    <h3 className="text-sm font-bold text-green-900">{s.name}</h3>
                                    {s.contactPerson && (
                                        <p className="text-[10px] text-cream-500">{s.contactPerson}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleEdit(s)}
                                    className="p-1.5 rounded-lg hover:bg-cream-200 text-cream-400 hover:text-green-700 transition-all"
                                >
                                    <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(s.id, s.name)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-cream-400 hover:text-red-600 transition-all"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1 text-[11px] text-cream-500">
                            {s.phone && (
                                <p className="flex items-center gap-1.5">
                                    {s.phone}
                                </p>
                            )}
                            {s.email && (
                                <p className="flex items-center gap-1.5">
                                    {s.email}
                                </p>
                            )}
                            {s.address && (
                                <p className="flex items-center gap-1.5">
                                    {s.address}
                                </p>
                            )}
                        </div>
                        {(s.taxCode || s.bankName) && (
                            <div className="mt-2 pt-2 border-t border-cream-200 flex flex-wrap gap-1.5">
                                {s.taxCode && <Badge className="bg-cream-100 text-cream-600 text-[9px]">MST: {s.taxCode}</Badge>}
                                {s.bankName && <Badge className="bg-cream-100 text-cream-600 text-[9px]">{s.bankName}</Badge>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                    <p className="text-sm text-cream-400">Chưa có nhà cung cấp nào</p>
                    <p className="text-xs text-cream-400 mt-1">Nhấn "Thêm NCC" để bắt đầu</p>
                </div>
            )}
        </div>
    )
}
