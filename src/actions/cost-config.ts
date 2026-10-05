"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { withRbac } from "@/lib/with-rbac"
import {
    DEFAULT_COST_CONFIG,
    type CostTargetConfig,
} from "@/lib/cost-calc"

export type {
    CostTargetConfig,
    CostEvaluationStatus,
    CostEvaluation,
    SuggestedPriceResult,
} from "@/lib/cost-calc"

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
