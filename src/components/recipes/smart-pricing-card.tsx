"use client"

import { useState, useMemo } from "react"
import { Sparkles, TrendingUp, AlertTriangle, ShieldCheck, Check, Loader2, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    calculateSuggestedPrice,
    evaluateRecipeCost,
    type CostTargetConfig,
} from "@/lib/cost-calc"
import { updateProductSellPrice } from "@/actions/cost-config"

function fmt(n: number) {
    return new Intl.NumberFormat("vi-VN").format(n)
}

interface SmartPricingCardProps {
    productId: string
    productName: string
    productType?: string
    currentSellPrice: number
    totalCost: number
    costConfig: CostTargetConfig
    onPriceApplied?: (newPrice: number) => void
    className?: string
}

export function SmartPricingCard({
    productId,
    productName,
    productType,
    currentSellPrice,
    totalCost,
    costConfig,
    onPriceApplied,
    className,
}: SmartPricingCardProps) {
    const [targetMargin, setTargetMargin] = useState<number>(costConfig.defaultTargetMarginPct || 70)
    const [applying, setApplying] = useState(false)
    const [justApplied, setJustApplied] = useState(false)

    // Evaluate current cost status
    const currentEval = useMemo(() => {
        return evaluateRecipeCost(totalCost, currentSellPrice, productType, costConfig)
    }, [totalCost, currentSellPrice, productType, costConfig])

    // Calculate smart price suggestion based on target margin
    const suggestion = useMemo(() => {
        return calculateSuggestedPrice(totalCost, targetMargin, costConfig.priceRoundingUnit)
    }, [totalCost, targetMargin, costConfig.priceRoundingUnit])

    const handleApplyPrice = async () => {
        if (!productId || suggestion.roundedPrice <= 0) return
        setApplying(true)
        try {
            const res = await updateProductSellPrice(productId, suggestion.roundedPrice)
            if (res.success) {
                toast.success(`Đã cập nhật giá bán món "${productName}" thành ₫${fmt(suggestion.roundedPrice)}`)
                setJustApplied(true)
                setTimeout(() => setJustApplied(false), 2500)
                onPriceApplied?.(suggestion.roundedPrice)
            } else {
                toast.error(res.error || "Lỗi cập nhật giá bán")
            }
        } catch {
            toast.error("Lỗi cập nhật giá bán")
        } finally {
            setApplying(false)
        }
    }

    const marginPresets = [60, 65, 70, 75, 80]

    return (
        <div className={cn("rounded-xl border border-cream-200 bg-white p-4 shadow-sm space-y-4", className)}>
            {/* Header: Current Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-cream-100">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-800">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-green-900">
                            Định Giá Thông Minh & Kiểm Soát Cost
                        </h4>
                        <p className="text-[11px] text-cream-500">
                            Tự động tối ưu lợi nhuận quầy bar & làm tròn chuẩn 10.000₫
                        </p>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-1.5">
                    {currentEval.status === "OPTIMAL" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-green-50 text-green-800 border border-green-200">
                            <ShieldCheck className="h-3.5 w-3.5 text-green-700" />
                            Cost {currentEval.costPct}% (Mục tiêu ≤{currentEval.targetCostPct}%)
                        </span>
                    )}
                    {currentEval.status === "WARNING" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            Cận biên {currentEval.costPct}% (Mục tiêu ≤{currentEval.targetCostPct}%)
                        </span>
                    )}
                    {currentEval.status === "OVER_BUDGET" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-800 border border-red-200 animate-pulse">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                            Vượt trần {currentEval.costPct}% (+{currentEval.diffPct}%)
                        </span>
                    )}
                    {currentEval.status === "UNPRICED" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-cream-100 text-cream-600 border border-cream-200">
                            Chưa định giá bán
                        </span>
                    )}
                </div>
            </div>

            {/* Current Price vs Cost Grid */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-cream-50 border border-cream-200 text-xs">
                <div>
                    <span className="text-[10px] uppercase font-bold text-cream-400 block">Giá vốn (Cost)</span>
                    <span className="font-mono font-bold text-wine-700 text-sm">₫{fmt(Math.round(totalCost))}</span>
                </div>
                <div>
                    <span className="text-[10px] uppercase font-bold text-cream-400 block">Giá bán hiện tại</span>
                    <span className="font-mono font-bold text-green-900 text-sm">
                        {currentSellPrice > 0 ? `₫${fmt(currentSellPrice)}` : "—"}
                    </span>
                </div>
                <div>
                    <span className="text-[10px] uppercase font-bold text-cream-400 block">Lãi gộp hiện tại</span>
                    <span className="font-mono font-bold text-sm text-green-700">
                        {currentSellPrice > 0 ? `₫${fmt(Math.max(0, currentSellPrice - Math.round(totalCost)))}` : "—"}
                    </span>
                </div>
            </div>

            {/* Target Margin Selector */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-green-900 flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-green-700" />
                        Chọn Biên Lợi Nhuận Mục Tiêu (Target Margin):
                    </span>
                    <span className="font-mono font-bold text-green-800">{targetMargin}% Margin</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {marginPresets.map((pct) => (
                        <button
                            key={pct}
                            type="button"
                            onClick={() => setTargetMargin(pct)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                                targetMargin === pct
                                    ? "bg-green-900 text-cream-50 border-green-900 shadow-sm"
                                    : "bg-cream-50 text-cream-600 border-cream-200 hover:border-green-600 hover:text-green-900"
                            )}
                        >
                            {pct}%
                        </button>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                        <input
                            type="number"
                            min={1}
                            max={95}
                            value={targetMargin}
                            onChange={(e) => setTargetMargin(Math.max(1, Math.min(95, Number(e.target.value) || 70)))}
                            className="w-14 rounded-lg border border-cream-300 px-2 py-1 text-xs font-mono text-center focus:border-green-600 focus:outline-none"
                        />
                        <span className="text-xs text-cream-400">%</span>
                    </div>
                </div>
            </div>

            {/* Smart Pricing Output */}
            {totalCost > 0 ? (
                <div className="p-3.5 rounded-xl bg-green-50/60 border border-green-200 space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-800 block">
                                Giá Bán Đề Xuất (Làm tròn 10k)
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="font-mono text-xl lg:text-2xl font-bold text-green-900">
                                    ₫{fmt(suggestion.roundedPrice)}
                                </span>
                                {suggestion.rawPrice !== suggestion.roundedPrice && (
                                    <span className="text-[11px] text-cream-400 line-through">
                                        ₫{fmt(suggestion.rawPrice)}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="text-right text-xs">
                            <p className="text-green-800 font-medium">
                                Lãi gộp: <strong className="font-mono font-bold text-wine-700">₫{fmt(suggestion.grossProfit)}</strong> / suất
                            </p>
                            <p className="text-[11px] text-cream-500">
                                Cost thực tế: <strong className="font-mono">{suggestion.actualCostPct}%</strong> · Margin: <strong className="font-mono">{suggestion.actualMarginPct}%</strong>
                            </p>
                        </div>
                    </div>

                    {/* Action button */}
                    <div className="flex items-center justify-between pt-2 border-t border-green-200/60">
                        <span className="text-[11px] text-stone-500 font-serif italic">
                            Định giá tối ưu bảo toàn biên lãi mục tiêu, tự động làm tròn chuẩn 10.000₫
                        </span>

                        <Button
                            type="button"
                            size="sm"
                            disabled={applying || suggestion.roundedPrice === currentSellPrice}
                            onClick={handleApplyPrice}
                            className={cn(
                                "h-8 text-xs font-medium gap-1.5 transition-all shadow-sm",
                                justApplied
                                    ? "bg-emerald-700 text-white"
                                    : "bg-green-800 text-cream-50 hover:bg-green-700 disabled:opacity-50"
                            )}
                        >
                            {applying ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : justApplied ? (
                                <Check className="h-3.5 w-3.5 text-white" />
                            ) : (
                                <ArrowRight className="h-3.5 w-3.5" />
                            )}
                            {justApplied
                                ? "Đã áp dụng thành công!"
                                : suggestion.roundedPrice === currentSellPrice
                                ? "Đang áp dụng giá này"
                                : `Áp dụng giá ₫${fmt(suggestion.roundedPrice)}`}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="p-3 text-center rounded-lg bg-cream-50 border border-dashed border-cream-300 text-cream-400 text-xs">
                    Thêm nguyên liệu vào công thức để hệ thống tự động tính toán giá bán đề xuất.
                </div>
            )}
        </div>
    )
}
