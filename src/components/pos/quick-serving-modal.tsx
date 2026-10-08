"use client"

import { useState } from "react"
import { Wine, Utensils, Check, X, Thermometer, GlassWater } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { OrderItem } from "@/stores/cart-store"

interface QuickServingModalProps {
    open: boolean
    onClose: () => void
    item: OrderItem | null
    onSaveNote: (itemId: string, note: string) => void
}

const WINE_MODIFIERS = [
    { label: "Ướp xô đá lạnh", icon: "🧊", code: "chilled" },
    { label: "Nhiệt độ phòng (16-18°C)", icon: "🌡️", code: "room_temp" },
    { label: "Decant thở 15 phút", icon: "🏺", code: "decant_15" },
    { label: "Decant thở 30 phút", icon: "🏺", code: "decant_30" },
    { label: "Mang ly Bordeaux", icon: "🍷", code: "glass_bordeaux" },
    { label: "Mang ly Burgundy", icon: "🍷", code: "glass_burgundy" },
    { label: "Kèm xô đá riêng", icon: "🪣", code: "ice_bucket" },
]

const GENERAL_MODIFIERS = [
    { label: "Lên món trước", icon: "⚡", code: "serve_first" },
    { label: "Lên cùng lúc", icon: "⏱️", code: "serve_together" },
    { label: "Không hành lá", icon: "🚫", code: "no_onion" },
    { label: "Không cay", icon: "🌶️", code: "no_spicy" },
    { label: "Ít cay", icon: "🌶️", code: "mild_spicy" },
    { label: "Dị ứng hải sản", icon: "⚠️", code: "allergy_seafood" },
    { label: "Dị ứng đậu phộng", icon: "⚠️", code: "allergy_peanut" },
    { label: "Thêm đĩa chia sẻ", icon: "🍽️", code: "extra_plates" },
]

export function QuickServingModal({
    open,
    onClose,
    item,
    onSaveNote,
}: QuickServingModalProps) {
    if (!open || !item) return null

    const isWine = [
        "WINE_BOTTLE",
        "WINE_GLASS",
        "WINE_TASTING",
    ].includes(item.product.type)

    const [selectedModifiers, setSelectedModifiers] = useState<string[]>(() => {
        if (!item.note) return []
        return item.note.split(" · ").map(s => s.trim()).filter(Boolean)
    })
    const [customText, setCustomText] = useState("")

    const toggleModifier = (label: string) => {
        setSelectedModifiers(prev =>
            prev.includes(label)
                ? prev.filter(m => m !== label)
                : [...prev, label]
        )
    }

    const handleSave = () => {
        const parts = [...selectedModifiers]
        if (customText.trim()) {
            parts.push(customText.trim())
        }
        onSaveNote(item.id, parts.join(" · "))
        onClose()
    }

    const clearAll = () => {
        setSelectedModifiers([])
        setCustomText("")
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-cream-300 bg-cream-50 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cream-300 bg-cream-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                        {isWine ? (
                            <Wine className="h-5 w-5 text-wine-700" />
                        ) : (
                            <Utensils className="h-5 w-5 text-green-900" />
                        )}
                        <div>
                            <h3 className="font-display text-sm font-bold text-green-900 leading-tight">
                                Ghi chú phục vụ
                            </h3>
                            <p className="text-xs text-cream-600 line-clamp-1">
                                {item.product.name} (x{item.quantity})
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-cream-500 hover:bg-cream-200 transition-all"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Wine specific modifiers */}
                    {isWine && (
                        <div>
                            <p className="text-xs font-semibold text-wine-900 mb-2 flex items-center gap-1.5">
                                <Thermometer className="h-3.5 w-3.5 text-wine-700" />
                                Chuẩn bị rượu & Nhiệt độ phục vụ
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {WINE_MODIFIERS.map(mod => {
                                    const active = selectedModifiers.includes(mod.label)
                                    return (
                                        <button
                                            key={mod.code}
                                            type="button"
                                            onClick={() => toggleModifier(mod.label)}
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all active:scale-95 touch-target",
                                                active
                                                    ? "border-wine-700 bg-wine-700 text-white shadow-xs"
                                                    : "border-cream-300 bg-cream-100 text-green-900 hover:border-wine-300 hover:bg-wine-50"
                                            )}
                                        >
                                            <span>{mod.icon}</span>
                                            <span>{mod.label}</span>
                                            {active && <Check className="h-3.5 w-3.5 ml-0.5" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* General / Dining modifiers */}
                    <div>
                        <p className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-1.5">
                            <Utensils className="h-3.5 w-3.5 text-green-700" />
                            Ghi chú bếp & Phục vụ bàn
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {GENERAL_MODIFIERS.map(mod => {
                                const active = selectedModifiers.includes(mod.label)
                                return (
                                    <button
                                        key={mod.code}
                                        type="button"
                                        onClick={() => toggleModifier(mod.label)}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all active:scale-95 touch-target",
                                            active
                                                ? "border-green-800 bg-green-800 text-cream-50 shadow-xs"
                                                : "border-cream-300 bg-cream-100 text-green-900 hover:border-green-400 hover:bg-green-50"
                                        )}
                                    >
                                        <span>{mod.icon}</span>
                                        <span>{mod.label}</span>
                                        {active && <Check className="h-3.5 w-3.5 ml-0.5" />}
                                    </button>
                                )}
                            )}
                        </div>
                    </div>

                    {/* Custom text input */}
                    <div>
                        <label className="text-xs font-semibold text-cream-600 block mb-1">
                            Ghi chú riêng khác (tùy chọn)
                        </label>
                        <input
                            type="text"
                            value={customText}
                            onChange={e => setCustomText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter") handleSave()
                            }}
                            placeholder="Nhập ghi chú thêm..."
                            className="w-full rounded-xl border border-cream-300 bg-cream-100 px-3 py-2 text-xs text-green-900 placeholder:text-cream-400 focus:outline-hidden focus:ring-2 focus:ring-green-700"
                        />
                    </div>

                    {/* Current notes preview */}
                    {(selectedModifiers.length > 0 || customText.trim()) && (
                        <div className="rounded-xl border border-cream-200 bg-cream-100 p-2.5">
                            <p className="text-[10px] font-semibold text-cream-500 uppercase tracking-wider mb-1">
                                Sẽ gửi xuống Bar/Bếp:
                            </p>
                            <p className="text-xs font-medium text-green-900 italic">
                                {[...selectedModifiers, customText.trim()].filter(Boolean).join(" · ")}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="border-t border-cream-300 bg-cream-100 px-4 py-3 flex items-center justify-between gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        className="text-xs text-cream-500 hover:text-red-600"
                    >
                        Xóa ghi chú
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            className="text-xs border-cream-300 text-green-900"
                        >
                            Đóng
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSave}
                            className="text-xs bg-green-900 text-cream-50 hover:bg-green-800"
                        >
                            Lưu ghi chú
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
