"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { withRbac } from "@/lib/with-rbac"

// ============================================================
// WASTE / SPOILAGE TRACKING — FR-3.7
// Record, report, and analyze waste for wine & ingredients
// ============================================================

import {
    type WasteType,
    type WasteReasonCategory,
    WASTE_REASON_LABELS,
} from "@/lib/waste-types"

export type { WasteType, WasteReasonCategory } from "@/lib/waste-types"

export type WasteRecord = {
    id: string
    type: WasteType
    productId: string | null
    productName: string | null
    ingredientId: string | null
    ingredientName: string | null
    quantity: number
    unitCost: number
    totalCost: number
    reason: string | null
    staffName: string | null
    createdAt: string
    reasonCategory?: WasteReasonCategory | null
    isPendingSupplierClaim?: boolean
    isClaimSettled?: boolean
}

export type WasteReport = {
    records: WasteRecord[]
    summary: {
        totalRecords: number
        totalCost: number
        netWasteCost: number
        supplierClaimCost: number
        byType: { type: WasteType; count: number; cost: number }[]
        byReason: { category: WasteReasonCategory; label: string; count: number; cost: number }[]
        byMonth: { month: string; cost: number; count: number }[]
        wastePctOfRevenue: number
    }
}

// Record new waste/spoilage/breakage
export async function recordWaste(params: {
    type: WasteType
    productId?: string
    ingredientId?: string
    bottleId?: string
    quantity: number
    reason: string
    reasonCategory?: WasteReasonCategory
    pendingSupplierClaim?: boolean
    staffId: string
}): Promise<{ success: boolean; error?: string }> {
    const guard = await withRbac("inventory", "create")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        let unitCost = 0
        let totalCost = 0
        let productName: string | null = null
        let ingredientName: string | null = null
        let targetProductId = params.productId

        // CASE 1: Specific Wine Bottle (e.g. from opened bottles or single corked bottle)
        if (params.bottleId) {
            const bottle = await prisma.wineBottle.findUnique({
                where: { id: params.bottleId },
                include: { product: true },
            })
            if (!bottle) return { success: false, error: "Chai rượu không tồn tại" }
            targetProductId = bottle.productId
            productName = bottle.product.name

            const bottleCost = Number(bottle.costPrice ?? bottle.product.costPrice ?? 0)
            const glassesTotal = bottle.product.glassesPerBottle || 8

            if (bottle.status === "OPENED") {
                const glassesLeft = bottle.glassesRemaining ?? 0
                const costPerGlass = glassesTotal > 0 ? bottleCost / glassesTotal : 0
                unitCost = Math.round(costPerGlass)
                const qtyToDeduct = params.quantity > 0 ? params.quantity : glassesLeft
                totalCost = Math.round(costPerGlass * qtyToDeduct)
            } else {
                unitCost = bottleCost
                totalCost = bottleCost
            }

            await prisma.wineBottle.update({
                where: { id: bottle.id },
                data: { status: "DAMAGED", glassesRemaining: 0 },
            })
        }
        // CASE 2: Product-level waste (unopened wine bottle, food dish, etc.)
        else if (targetProductId) {
            const product = await prisma.product.findUnique({ where: { id: targetProductId } })
            if (!product) return { success: false, error: "Sản phẩm không tồn tại" }
            unitCost = Number(product.costPrice)
            productName = product.name
            totalCost = Math.round(unitCost * params.quantity)

            // If wine product, mark bottles as DAMAGED
            if (["WINE_BOTTLE", "WINE_GLASS", "WINE_TASTING"].includes(product.type)) {
                const bottles = await prisma.wineBottle.findMany({
                    where: { productId: targetProductId, status: { in: ["IN_STOCK", "OPENED"] } },
                    orderBy: { receivedAt: "asc" },
                    take: Math.ceil(params.quantity),
                })
                for (const bottle of bottles.slice(0, Math.ceil(params.quantity))) {
                    await prisma.wineBottle.update({
                        where: { id: bottle.id },
                        data: { status: "DAMAGED" },
                    })
                    if (bottle.costPrice) {
                        unitCost = Number(bottle.costPrice)
                        totalCost = Math.round(unitCost * params.quantity)
                    }
                }
            }
        }
        // CASE 3: Ingredient-level waste
        else if (params.ingredientId) {
            const ingredient = await prisma.ingredient.findUnique({ where: { id: params.ingredientId } })
            if (!ingredient) return { success: false, error: "Nguyên liệu không tồn tại" }
            unitCost = Number(ingredient.costPerUnit)
            ingredientName = ingredient.name
            totalCost = Math.round(unitCost * params.quantity)

            // Deduct from stock
            await prisma.ingredient.update({
                where: { id: params.ingredientId },
                data: { currentStock: { decrement: params.quantity } },
            })
        }

        // Format tagged reason
        const prefixTags: string[] = []
        if (params.reasonCategory) prefixTags.push(`[${params.reasonCategory}]`)
        if (params.pendingSupplierClaim) prefixTags.push("[NCC ĐỀN BÙ]")
        const formattedReason = prefixTags.length > 0 ? `${prefixTags.join(" ")} ${params.reason}` : params.reason

        // Create stock movement
        await prisma.stockMovement.create({
            data: {
                type: params.type,
                productId: targetProductId ?? null,
                ingredientId: params.ingredientId ?? null,
                bottleId: params.bottleId ?? null,
                quantity: params.quantity,
                unitCost,
                totalCost,
                reason: formattedReason,
                createdBy: params.staffId,
            },
        })

        // Auto-create expense in fund transactions ONLY IF NOT pending supplier claim
        if (!params.pendingSupplierClaim && totalCost > 0) {
            await prisma.fundTransaction.create({
                data: {
                    transactionType: "EXPENSE",
                    category: `${params.type} — ${productName ?? ingredientName ?? "Hao hụt"}`,
                    amount: totalCost,
                    description: `${params.type}: ${productName ?? ingredientName} x${params.quantity} — ${formattedReason}`,
                },
            })
        }

        revalidatePath("/dashboard/waste")
        revalidatePath("/dashboard/margins")
        revalidatePath("/dashboard/reports")
        return { success: true }
    } catch (err) {
        console.error("[Waste] recordWaste failed:", err)
        return { success: false, error: "Lỗi ghi nhận hao hụt" }
    }
}

// Get waste records with filters
export async function getWasteRecords(params?: {
    dateFrom?: string
    dateTo?: string
    type?: WasteType
}): Promise<WasteRecord[]> {
    const where: Record<string, unknown> = {
        type: { in: ["WASTE", "SPOILAGE", "BREAKAGE"] as const },
    }

    if (params?.type) {
        where.type = params.type
    }

    if (params?.dateFrom || params?.dateTo) {
        const dateFilter: Record<string, Date> = {}
        if (params.dateFrom) dateFilter.gte = new Date(params.dateFrom + (params.dateFrom.includes("T") ? "" : "T00:00:00"))
        if (params.dateTo) dateFilter.lte = new Date(params.dateTo + (params.dateTo.includes("T") ? "" : "T23:59:59.999"))
        where.createdAt = dateFilter
    }

    const movements = await prisma.stockMovement.findMany({
        where,
        include: { ingredient: true },
        orderBy: { createdAt: "desc" },
        take: 200,
    })

    // Batch load product names
    const productIds = movements.filter((m) => m.productId).map((m) => m.productId!)
    const products = productIds.length > 0
        ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
        : []
    const productMap = new Map(products.map((p) => [p.id, p.name]))

    // Batch load staff names
    const staffIds = movements.filter((m) => m.createdBy).map((m) => m.createdBy!)
    const staffList = staffIds.length > 0
        ? await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, fullName: true } })
        : []
    const staffMap = new Map(staffList.map((s) => [s.id, s.fullName]))

    return movements.map((m) => {
        const reason = m.reason ?? ""
        const isPendingSupplierClaim = reason.includes("[NCC ĐỀN BÙ]")
        const isClaimSettled = reason.includes("[NCC ĐÃ ĐỔI BÙ]")

        let reasonCategory: WasteReasonCategory = "OTHER"
        if (reason.includes("[CORKED]")) reasonCategory = "CORKED"
        else if (reason.includes("[OXIDATION]")) reasonCategory = "OXIDATION"
        else if (reason.includes("[BREAKAGE]") || m.type === "BREAKAGE") reasonCategory = "BREAKAGE"
        else if (reason.includes("[SPILLAGE]")) reasonCategory = "SPILLAGE"
        else if (reason.includes("[TASTING]")) reasonCategory = "TASTING"
        else if (reason.includes("[SPOILAGE]") || m.type === "SPOILAGE") reasonCategory = "SPOILAGE"

        return {
            id: m.id,
            type: m.type as WasteType,
            productId: m.productId,
            productName: m.productId ? (productMap.get(m.productId) ?? null) : null,
            ingredientId: m.ingredientId,
            ingredientName: m.ingredient?.name ?? null,
            quantity: Number(m.quantity),
            unitCost: Number(m.unitCost ?? 0),
            totalCost: Number(m.totalCost ?? 0),
            reason: m.reason,
            staffName: m.createdBy ? (staffMap.get(m.createdBy) ?? null) : null,
            createdAt: m.createdAt.toISOString(),
            reasonCategory,
            isPendingSupplierClaim,
            isClaimSettled,
        }
    })
}

// Full waste report with analytics
export async function getWasteReport(params?: {
    dateFrom?: string
    dateTo?: string
}): Promise<WasteReport> {
    const records = await getWasteRecords(params)

    const totalCost = records.reduce((s, r) => s + r.totalCost, 0)
    const supplierClaimCost = records
        .filter((r) => r.isPendingSupplierClaim && !r.isClaimSettled)
        .reduce((s, r) => s + r.totalCost, 0)
    const netWasteCost = Math.max(0, totalCost - supplierClaimCost)

    // By type
    const typeMap = new Map<WasteType, { count: number; cost: number }>()
    for (const r of records) {
        const entry = typeMap.get(r.type) ?? { count: 0, cost: 0 }
        entry.count++
        entry.cost += r.totalCost
        typeMap.set(r.type, entry)
    }
    const byType = Array.from(typeMap.entries()).map(([type, data]) => ({ type, ...data }))

    // By reason category
    const reasonMap = new Map<WasteReasonCategory, { count: number; cost: number }>()
    for (const r of records) {
        const cat = r.reasonCategory ?? "OTHER"
        const entry = reasonMap.get(cat) ?? { count: 0, cost: 0 }
        entry.count++
        entry.cost += r.totalCost
        reasonMap.set(cat, entry)
    }
    const byReason = Array.from(reasonMap.entries()).map(([category, data]) => ({
        category,
        label: WASTE_REASON_LABELS[category]?.label ?? category,
        ...data,
    }))

    // By month
    const monthMap = new Map<string, { cost: number; count: number }>()
    for (const r of records) {
        const month = r.createdAt.slice(0, 7) // YYYY-MM
        const entry = monthMap.get(month) ?? { cost: 0, count: 0 }
        entry.count++
        entry.cost += r.totalCost
        monthMap.set(month, entry)
    }
    const byMonth = Array.from(monthMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month))

    // Waste vs revenue
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
    const revenueAgg = await prisma.order.aggregate({
        where: { status: { in: ["PAID", "COMPLETED"] }, createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalAmount: true },
    })
    const monthRevenue = Number(revenueAgg._sum.totalAmount ?? 0)
    const recentWasteCost = records
        .filter((r) => new Date(r.createdAt) >= thirtyDaysAgo)
        .reduce((s, r) => s + r.totalCost, 0)
    const wastePctOfRevenue = monthRevenue > 0 ? Math.round((recentWasteCost / monthRevenue) * 1000) / 10 : 0

    return {
        records,
        summary: {
            totalRecords: records.length,
            totalCost,
            netWasteCost,
            supplierClaimCost,
            byType,
            byReason,
            byMonth,
            wastePctOfRevenue,
        },
    }
}

// Get products + ingredients for waste form dropdown
export async function getWasteFormOptions(): Promise<{
    products: { id: string; name: string; type: string; costPrice: number }[]
    ingredients: { id: string; name: string; unit: string; costPerUnit: number }[]
}> {
    const [products, ingredients] = await Promise.all([
        prisma.product.findMany({
            where: { isActive: true },
            select: { id: true, name: true, type: true, costPrice: true },
            orderBy: { name: "asc" },
        }),
        prisma.ingredient.findMany({
            where: { isActive: true },
            select: { id: true, name: true, unit: true, costPerUnit: true },
            orderBy: { name: "asc" },
        }),
    ])

    return {
        products: products.map((p) => ({ id: p.id, name: p.name, type: p.type, costPrice: Number(p.costPrice) })),
        ingredients: ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, costPerUnit: Number(i.costPerUnit) })),
    }
}

export type OpenedWineBottle = {
    id: string
    productId: string
    productName: string
    batchCode: string | null
    openedAt: string
    hoursOpened: number
    glassesLeft: number
    glassesTotal: number
    bottleCost: number
    costPerGlass: number
    remainingCost: number
    isOxidizedWarning: boolean
}

// Get all bottles currently OPENED for By-the-glass monitoring
export async function getOpenedWineBottles(): Promise<OpenedWineBottle[]> {
    const bottles = await prisma.wineBottle.findMany({
        where: { status: "OPENED" },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    costPrice: true,
                    glassesPerBottle: true,
                },
            },
        },
        orderBy: { openedAt: "asc" },
    })

    return bottles.map((b) => {
        const openedDate = b.openedAt ? new Date(b.openedAt) : new Date(b.createdAt)
        const hoursOpened = Math.round((Date.now() - openedDate.getTime()) / (1000 * 60 * 60))
        const glassesTotal = b.product.glassesPerBottle || 8
        const glassesLeft = b.glassesRemaining ?? 0
        const bottleCost = Number(b.costPrice ?? b.product.costPrice ?? 0)
        const costPerGlass = glassesTotal > 0 ? Math.round(bottleCost / glassesTotal) : 0
        const remainingCost = costPerGlass * glassesLeft

        return {
            id: b.id,
            productId: b.productId,
            productName: b.product.name,
            batchCode: b.batchCode,
            openedAt: openedDate.toISOString(),
            hoursOpened,
            glassesLeft,
            glassesTotal,
            bottleCost,
            costPerGlass,
            remainingCost,
            isOxidizedWarning: hoursOpened >= 72, // > 3 days open
        }
    })
}

// Settle supplier claim (NCC đổi chai mới hoặc hoàn tiền)
export async function settleSupplierClaim(params: {
    movementId: string
    action: "REPLACED_BOTTLE" | "REFUNDED" | "REJECTED"
    staffId: string
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    const guard = await withRbac("inventory", "edit")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        const movement = await prisma.stockMovement.findUnique({
            where: { id: params.movementId },
            include: { supplier: true },
        })
        if (!movement) return { success: false, error: "Không tìm thấy giao dịch hao hụt" }

        const actionText =
            params.action === "REPLACED_BOTTLE"
                ? "NCC đã đổi chai mới"
                : params.action === "REFUNDED"
                    ? "NCC đã hoàn tiền"
                    : "NCC từ chối đổi trả"

        const todayStr = new Date().toLocaleDateString("vi-VN")
        const updatedReason = `${movement.reason ?? ""} [NCC ĐÃ ĐỔI BÙ - ${actionText} - ${todayStr}${params.notes ? `: ${params.notes}` : ""}]`

        await prisma.stockMovement.update({
            where: { id: params.movementId },
            data: { reason: updatedReason },
        })

        // If replaced bottle, create an IN_STOCK WineBottle
        if (params.action === "REPLACED_BOTTLE" && movement.productId) {
            await prisma.wineBottle.create({
                data: {
                    productId: movement.productId,
                    status: "IN_STOCK",
                    costPrice: movement.unitCost ?? 0,
                    ownershipType: "PURCHASED",
                },
            })
        }

        revalidatePath("/dashboard/waste")
        revalidatePath("/dashboard/margins")
        return { success: true }
    } catch (err) {
        console.error("[Waste] settleSupplierClaim failed:", err)
        return { success: false, error: "Lỗi xử lý đổi bù nhà cung cấp" }
    }
}
