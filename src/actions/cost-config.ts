"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { withRbac } from "@/lib/with-rbac"

// ============================================================
// COST CONFIGURATION & SMART PRICING ENGINE
// ============================================================

export type CostTargetConfig = {
    targetFoodCostPct: number        // e.g. 28%
    targetWineCostPct: number        // e.g. 32%
    targetDrinkCostPct: number       // e.g. 22%
    targetDefaultCostPct: number     // e.g. 30%
    defaultTargetMarginPct: number   // e.g. 70%
    warningThresholdOffset: number   // e.g. 5%
    priceRoundingUnit: number        // e.g. 10000 VND
}

export const DEFAULT_COST_CONFIG: CostTargetConfig = {
    targetFoodCostPct: 28,
    targetWineCostPct: 32,
    targetDrinkCostPct: 22,
    targetDefaultCostPct: 30,
    defaultTargetMarginPct: 70,
    warningThresholdOffset: 5,
    priceRoundingUnit: 10000,
}

export type CostEvaluationStatus = "OPTIMAL" | "WARNING" | "OVER_BUDGET" | "UNPRICED"

export type CostEvaluation = {
    status: CostEvaluationStatus
    costPct: number
    targetCostPct: number
    diffPct: number
    label: string
    colorClasses: string
    badgeClasses: string
    suggestedPrice: number
}

export type SuggestedPriceResult = {
    rawPrice: number
    roundedPrice: number
    actualMarginPct: number
    actualCostPct: number
    grossProfit: number
}

/**
 * Lấy cấu hình Target Cost % của hệ thống
 */
export async function getCostTargetConfig(): Promise<CostTargetConfig> {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: "cost_targets" },
        })
        if (!setting || !setting.value || typeof setting.value !== "object") {
            return { ...DEFAULT_COST_CONFIG }
        }
        const val = setting.value as Partial<CostTargetConfig>
        return {
            targetFoodCostPct: Number(val.targetFoodCostPct ?? DEFAULT_COST_CONFIG.targetFoodCostPct),
            targetWineCostPct: Number(val.targetWineCostPct ?? DEFAULT_COST_CONFIG.targetWineCostPct),
            targetDrinkCostPct: Number(val.targetDrinkCostPct ?? DEFAULT_COST_CONFIG.targetDrinkCostPct),
            targetDefaultCostPct: Number(val.targetDefaultCostPct ?? DEFAULT_COST_CONFIG.targetDefaultCostPct),
            defaultTargetMarginPct: Number(val.defaultTargetMarginPct ?? DEFAULT_COST_CONFIG.defaultTargetMarginPct),
            warningThresholdOffset: Number(val.warningThresholdOffset ?? DEFAULT_COST_CONFIG.warningThresholdOffset),
            priceRoundingUnit: Number(val.priceRoundingUnit ?? DEFAULT_COST_CONFIG.priceRoundingUnit),
        }
    } catch {
        return { ...DEFAULT_COST_CONFIG }
    }
}

/**
 * Cập nhật cấu hình Target Cost %
 */
export async function updateCostTargetConfig(config: Partial<CostTargetConfig>) {
    const guard = await withRbac("settings", "edit")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        const current = await getCostTargetConfig()
        const merged: CostTargetConfig = { ...current, ...config }

        await prisma.systemSetting.upsert({
            where: { key: "cost_targets" },
            create: { key: "cost_targets", value: merged },
            update: { value: merged },
        })

        revalidatePath("/dashboard/menu/recipes")
        revalidatePath("/dashboard/margins")
        revalidatePath("/dashboard/settings")
        return { success: true, data: merged }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Lỗi lưu cấu hình"
        return { success: false, error: message }
    }
}

/**
 * Tính giá bán đề xuất dựa trên tổng cost và biên lợi nhuận mong muốn
 * Quy tắc làm tròn lên 10.000₫ theo phong cách quầy bar sang trọng
 */
export function calculateSuggestedPrice(
    totalCost: number,
    targetMarginPct: number = 70,
    roundingUnit: number = 10000
): SuggestedPriceResult {
    if (totalCost <= 0) {
        return { rawPrice: 0, roundedPrice: 0, actualMarginPct: 0, actualCostPct: 0, grossProfit: 0 }
    }

    const clampedMargin = Math.max(1, Math.min(95, targetMarginPct))
    const costPctBasis = 100 - clampedMargin
    const rawPrice = (totalCost * 100) / costPctBasis
    const unit = roundingUnit > 0 ? roundingUnit : 10000
    // Prevent floating point micro-overflows on exact multiples
    const roundedPrice = Math.ceil(Math.round(rawPrice) / unit) * unit

    const actualMarginPct = roundedPrice > 0
        ? Math.round(((roundedPrice - totalCost) / roundedPrice) * 1000) / 10
        : 0
    const actualCostPct = roundedPrice > 0
        ? Math.round((totalCost / roundedPrice) * 1000) / 10
        : 0

    return {
        rawPrice: Math.round(rawPrice),
        roundedPrice,
        actualMarginPct,
        actualCostPct,
        grossProfit: roundedPrice - totalCost,
    }
}

/**
 * Đánh giá tỷ lệ Cost % và phân loại mức cảnh báo
 */
export function evaluateRecipeCost(
    totalCost: number,
    sellPrice: number,
    productType?: string,
    config: CostTargetConfig = DEFAULT_COST_CONFIG
): CostEvaluation {
    let targetCostPct = config.targetDefaultCostPct
    if (productType === "FOOD") {
        targetCostPct = config.targetFoodCostPct
    } else if (productType?.startsWith("WINE_")) {
        targetCostPct = config.targetWineCostPct
    } else if (productType === "DRINK") {
        targetCostPct = config.targetDrinkCostPct
    }

    const suggested = calculateSuggestedPrice(totalCost, config.defaultTargetMarginPct, config.priceRoundingUnit)

    if (!sellPrice || sellPrice <= 0) {
        return {
            status: "UNPRICED",
            costPct: 0,
            targetCostPct,
            diffPct: 0,
            label: "Chưa định giá",
            colorClasses: "text-cream-500",
            badgeClasses: "bg-cream-100 text-cream-600 border-cream-200",
            suggestedPrice: suggested.roundedPrice,
        }
    }

    const costPct = Math.round((totalCost / sellPrice) * 1000) / 10
    const diffPct = Math.round((costPct - targetCostPct) * 10) / 10

    if (costPct <= targetCostPct) {
        return {
            status: "OPTIMAL",
            costPct,
            targetCostPct,
            diffPct,
            label: "Đạt chuẩn",
            colorClasses: "text-green-800",
            badgeClasses: "bg-green-50 text-green-800 border-green-200",
            suggestedPrice: suggested.roundedPrice,
        }
    }

    if (costPct <= targetCostPct + config.warningThresholdOffset) {
        return {
            status: "WARNING",
            costPct,
            targetCostPct,
            diffPct,
            label: "Cận biên",
            colorClasses: "text-amber-800",
            badgeClasses: "bg-amber-50 text-amber-800 border-amber-200",
            suggestedPrice: suggested.roundedPrice,
        }
    }

    return {
        status: "OVER_BUDGET",
        costPct,
        targetCostPct,
        diffPct,
        label: "Vượt trần",
        colorClasses: "text-red-800",
        badgeClasses: "bg-red-50 text-red-800 border-red-200",
        suggestedPrice: suggested.roundedPrice,
    }
}

/**
 * Cập nhật trực tiếp giá bán (sellPrice) của món từ bộ tính giá đề xuất
 */
export async function updateProductSellPrice(productId: string, newSellPrice: number) {
    const guard = await withRbac("menu", "edit")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        const updated = await prisma.product.update({
            where: { id: productId },
            data: { sellPrice: newSellPrice },
        })

        revalidatePath("/dashboard/menu/recipes")
        revalidatePath("/dashboard/menu/products")
        revalidatePath("/dashboard/margins")
        revalidatePath("/pos")

        return { success: true, data: updated }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Lỗi cập nhật giá bán"
        return { success: false, error: message }
    }
}
