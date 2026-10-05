"use client"

import { useState } from "react"
import { X, Sliders, Save, Loader2, RotateCcw, UtensilsCrossed, Wine, GlassWater, Package, TrendingUp, Coins } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    updateCostTargetConfig,
    DEFAULT_COST_CONFIG,
    type CostTargetConfig,
} from "@/actions/cost-config"

interface CostTargetModalProps {
    config: CostTargetConfig
    onClose: () => void
    onUpdated: (newConfig: CostTargetConfig) => void
}

export function CostTargetModal({ config, onClose, onUpdated }: CostTargetModalProps) {
    const [foodCost, setFoodCost] = useState(config.targetFoodCostPct)
    const [wineCost, setWineCost] = useState(config.targetWineCostPct)
    const [drinkCost, setDrinkCost] = useState(config.targetDrinkCostPct)
    const [defaultCost, setDefaultCost] = useState(config.targetDefaultCostPct)
    const [targetMargin, setTargetMargin] = useState(config.defaultTargetMarginPct)
    const [warningOffset, setWarningOffset] = useState(config.warningThresholdOffset)
    const [roundingUnit, setRoundingUnit] = useState(config.priceRoundingUnit)
    const [saving, setSaving] = useState(false)

    const handleResetDefaults = () => {
        setFoodCost(DEFAULT_COST_CONFIG.targetFoodCostPct)
        setWineCost(DEFAULT_COST_CONFIG.targetWineCostPct)
        setDrinkCost(DEFAULT_COST_CONFIG.targetDrinkCostPct)
        setDefaultCost(DEFAULT_COST_CONFIG.targetDefaultCostPct)
        setTargetMargin(DEFAULT_COST_CONFIG.defaultTargetMarginPct)
        setWarningOffset(DEFAULT_COST_CONFIG.warningThresholdOffset)
        setRoundingUnit(DEFAULT_COST_CONFIG.priceRoundingUnit)
        toast.info("Đã khôi phục các giá trị chuẩn mặc định của Wine Bar")
    }

    const handleSave = async () => {
        setSaving(true)
        const newConfig: CostTargetConfig = {
            targetFoodCostPct: Number(foodCost) || 28,
            targetWineCostPct: Number(wineCost) || 32,
            targetDrinkCostPct: Number(drinkCost) || 22,
            targetDefaultCostPct: Number(defaultCost) || 30,
            defaultTargetMarginPct: Number(targetMargin) || 70,
            warningThresholdOffset: Number(warningOffset) || 5,
            priceRoundingUnit: Number(roundingUnit) || 10000,
        }

        try {
            const res = await updateCostTargetConfig(newConfig)
            if (res.success && res.data) {
                toast.success("Đã lưu cấu hình Target Cost thành công")
                onUpdated(res.data)
                onClose()
            } else {
                toast.error(res.error || "Lỗi lưu cấu hình")
            }
        } catch {
            toast.error("Lỗi lưu cấu hình")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-cream-200 animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 bg-cream-50">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-800">
                            <Sliders className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-display text-base font-bold text-green-900">
                                Cấu Hình Target Cost & Giá Vốn
                            </h3>
                            <p className="text-[11px] text-cream-500">
                                Thiết lập mục tiêu tỷ lệ giá vốn cho từng nhóm món
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-cream-400 hover:text-green-900 hover:bg-cream-200 rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Category Cost % Targets */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-green-900">
                            1. Mục tiêu Tỷ Lệ Giá Vốn Tối Đa (Target Cost %)
                        </h4>
                        <p className="text-[11px] text-cream-500">
                            Nếu công thức món có Cost % vượt mức này, hệ thống sẽ kích hoạt huy hiệu cảnh báo màu vàng hoặc đỏ.
                        </p>

                        <div className="grid grid-cols-2 gap-3.5">
                            <div className="p-3 rounded-xl border border-cream-200 bg-cream-50/50 space-y-1">
                                <label className="text-xs font-semibold text-green-900 flex items-center gap-1.5">
                                    <UtensilsCrossed className="h-3.5 w-3.5 text-stone-600" />
                                    Đồ ăn (Food Cost)
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <Input
                                        type="number"
                                        min={5}
                                        max={90}
                                        value={foodCost}
                                        onChange={(e) => setFoodCost(Number(e.target.value))}
                                        className="h-9 bg-white font-mono font-bold text-center text-sm border-cream-300"
                                    />
                                    <span className="text-xs font-bold text-cream-500">%</span>
                                </div>
                                <span className="text-[10px] text-cream-400 block">Khuyến nghị Bar: 25% - 28%</span>
                            </div>

                            <div className="p-3 rounded-xl border border-cream-200 bg-cream-50/50 space-y-1">
                                <label className="text-xs font-semibold text-green-900 flex items-center gap-1.5">
                                    <Wine className="h-3.5 w-3.5 text-wine-700" />
                                    Rượu vang (Wine Cost)
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <Input
                                        type="number"
                                        min={5}
                                        max={90}
                                        value={wineCost}
                                        onChange={(e) => setWineCost(Number(e.target.value))}
                                        className="h-9 bg-white font-mono font-bold text-center text-sm border-cream-300"
                                    />
                                    <span className="text-xs font-bold text-cream-500">%</span>
                                </div>
                                <span className="text-[10px] text-cream-400 block">Khuyến nghị Bar: 30% - 35%</span>
                            </div>

                            <div className="p-3 rounded-xl border border-cream-200 bg-cream-50/50 space-y-1">
                                <label className="text-xs font-semibold text-green-900 flex items-center gap-1.5">
                                    <GlassWater className="h-3.5 w-3.5 text-amber-600" />
                                    Đồ uống / Cocktail (Drink Cost)
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <Input
                                        type="number"
                                        min={5}
                                        max={90}
                                        value={drinkCost}
                                        onChange={(e) => setDrinkCost(Number(e.target.value))}
                                        className="h-9 bg-white font-mono font-bold text-center text-sm border-cream-300"
                                    />
                                    <span className="text-xs font-bold text-cream-500">%</span>
                                </div>
                                <span className="text-[10px] text-cream-400 block">Khuyến nghị Bar: 18% - 22%</span>
                            </div>

                            <div className="p-3 rounded-xl border border-cream-200 bg-cream-50/50 space-y-1">
                                <label className="text-xs font-semibold text-green-900 flex items-center gap-1.5">
                                    <Package className="h-3.5 w-3.5 text-stone-500" />
                                    Khác / Combo (Default Cost)
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <Input
                                        type="number"
                                        min={5}
                                        max={90}
                                        value={defaultCost}
                                        onChange={(e) => setDefaultCost(Number(e.target.value))}
                                        className="h-9 bg-white font-mono font-bold text-center text-sm border-cream-300"
                                    />
                                    <span className="text-xs font-bold text-cream-500">%</span>
                                </div>
                                <span className="text-[10px] text-cream-400 block">Mặc định: 30%</span>
                            </div>
                        </div>
                    </div>

                    {/* Smart Pricing Target Margin */}
                    <div className="space-y-3 pt-3 border-t border-cream-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-green-900">
                            2. Cấu Hình Gợi Ý Giá Bán Tối Ưu (Smart Pricing)
                        </h4>

                        <div className="grid grid-cols-2 gap-3.5">
                            <div className="p-3 rounded-xl border border-cream-200 bg-cream-50/50 space-y-1">
                                <label className="text-xs font-semibold text-green-900 flex items-center gap-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-green-700" />
                                    Margin Mục Tiêu Mặc Định
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <Input
                                        type="number"
                                        min={10}
                                        max={90}
                                        value={targetMargin}
                                        onChange={(e) => setTargetMargin(Number(e.target.value))}
                                        className="h-9 bg-white font-mono font-bold text-center text-sm border-cream-300"
                                    />
                                    <span className="text-xs font-bold text-cream-500">%</span>
                                </div>
                                <span className="text-[10px] text-cream-400 block">Dùng làm mốc tính giá đề xuất</span>
                            </div>

                            <div className="p-3 rounded-xl border border-cream-200 bg-cream-50/50 space-y-1">
                                <label className="text-xs font-semibold text-green-900 flex items-center gap-1.5">
                                    <Coins className="h-3.5 w-3.5 text-amber-700" />
                                    Đơn Vị Làm Tròn Giá Bán
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={roundingUnit}
                                        onChange={(e) => setRoundingUnit(Number(e.target.value))}
                                        className="h-9 w-full rounded-lg border border-cream-300 bg-white px-2.5 text-xs font-mono font-bold focus:border-green-600 focus:outline-none"
                                    >
                                        <option value={10000}>10.000₫ (Chuẩn Wine Bar)</option>
                                        <option value={5000}>5.000₫</option>
                                        <option value={1000}>1.000₫</option>
                                    </select>
                                </div>
                                <span className="text-[10px] text-cream-400 block">Làm tròn lên giá niêm yết</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-cream-200 bg-cream-50">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetDefaults}
                        className="text-xs text-cream-500 hover:text-green-900"
                    >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Khôi phục mặc định
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            className="text-xs border-cream-300"
                        >
                            Hủy
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={saving}
                            onClick={handleSave}
                            className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs font-medium"
                        >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                            Lưu cấu hình
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
