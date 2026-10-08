"use client"

import { useState, useMemo } from "react"
import { Coins, Plus, Minus, RotateCcw, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DenominationCount } from "@/actions/shifts"

function fmt(n: number): string {
    return new Intl.NumberFormat("vi-VN").format(n)
}

const DENOMS = [
    { key: "d500k" as const, val: 500000, label: "500,000₫", badge: "bg-teal-700 text-white" },
    { key: "d200k" as const, val: 200000, label: "200,000₫", badge: "bg-amber-700 text-white" },
    { key: "d100k" as const, val: 100000, label: "100,000₫", badge: "bg-emerald-700 text-white" },
    { key: "d50k" as const, val: 50000, label: "50,000₫", badge: "bg-rose-700 text-white" },
    { key: "d20k" as const, val: 20000, label: "20,000₫", badge: "bg-blue-700 text-white" },
    { key: "d10k" as const, val: 10000, label: "10,000₫", badge: "bg-yellow-800 text-white" },
    { key: "d5k" as const, val: 5000, label: "5,000₫", badge: "bg-stone-600 text-white" },
    { key: "d2k" as const, val: 2000, label: "2,000₫", badge: "bg-stone-500 text-white" },
    { key: "d1k" as const, val: 1000, label: "1,000₫", badge: "bg-stone-400 text-white" },
]

interface DenominationCounterProps {
    initialCounts?: DenominationCount
    onApply: (totalAmount: number, counts: DenominationCount) => void
    className?: string
}

export function DenominationCounter({
    initialCounts,
    onApply,
    className,
}: DenominationCounterProps) {
    const [counts, setCounts] = useState<DenominationCount>(initialCounts || {})

    const handleCountChange = (key: keyof DenominationCount, delta: number) => {
        setCounts((prev) => {
            const current = prev[key] || 0
            const next = Math.max(0, current + delta)
            return { ...prev, [key]: next }
        })
    }

    const handleSetCount = (key: keyof DenominationCount, val: string) => {
        const num = parseInt(val.replace(/\D/g, ""), 10) || 0
        setCounts((prev) => ({ ...prev, [key]: Math.max(0, num) }))
    }

    const handleReset = () => {
        setCounts({})
    }

    const total = useMemo(() => {
        return DENOMS.reduce((sum, d) => {
            const qty = counts[d.key] || 0
            return sum + qty * d.val
        }, 0)
    }, [counts])

    return (
        <div className={cn("rounded-xl border border-cream-200 bg-white p-3.5 space-y-3", className)}>
            <div className="flex items-center justify-between border-b border-cream-200 pb-2">
                <span className="text-xs font-bold text-green-950 flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-amber-700" />
                    Bảng kiểm đếm mệnh giá tiền mặt
                </span>
                <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] text-cream-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
                >
                    <RotateCcw className="h-3 w-3" />
                    Xoá đếm lại
                </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {DENOMS.map((d) => {
                    const qty = counts[d.key] || 0
                    const subtotal = qty * d.val

                    return (
                        <div
                            key={d.key}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-cream-50/70 border border-cream-200 text-xs"
                        >
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold font-mono min-w-[70px] text-center", d.badge)}>
                                {d.label}
                            </span>

                            {/* Stepper buttons */}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleCountChange(d.key, -1)}
                                    className="h-6 w-6 rounded bg-cream-200 text-cream-700 hover:bg-cream-300 flex items-center justify-center transition-colors"
                                >
                                    <Minus className="h-3 w-3" />
                                </button>
                                <Input
                                    value={qty === 0 ? "" : qty}
                                    placeholder="0"
                                    onChange={(e) => handleSetCount(d.key, e.target.value)}
                                    className="h-6 w-12 text-center text-xs font-mono font-bold p-0 bg-white border-cream-300"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleCountChange(d.key, 1)}
                                    className="h-6 w-6 rounded bg-cream-200 text-cream-700 hover:bg-cream-300 flex items-center justify-center transition-colors"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCountChange(d.key, 5)}
                                    className="h-6 px-1 rounded bg-cream-200 text-cream-700 hover:bg-cream-300 text-[10px] font-bold transition-colors"
                                >
                                    +5
                                </button>
                            </div>

                            <span className="font-mono font-bold text-green-950 min-w-[90px] text-right">
                                ₫{fmt(subtotal)}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Total and Apply button */}
            <div className="pt-2 border-t border-cream-200 flex items-center justify-between">
                <div>
                    <span className="text-[10px] uppercase tracking-wider text-cream-500 font-bold block">
                        Tổng tiền đếm được
                    </span>
                    <span className="font-mono text-base font-bold text-green-900">
                        ₫{fmt(total)}
                    </span>
                </div>
                <Button
                    type="button"
                    size="sm"
                    onClick={() => onApply(total, counts)}
                    className="bg-green-900 hover:bg-green-800 text-cream-50 text-xs h-8 px-3 font-semibold shadow-xs"
                >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Áp dụng vào quỹ
                </Button>
            </div>
        </div>
    )
}
