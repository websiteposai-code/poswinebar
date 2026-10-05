"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { withRbac } from "@/lib/with-rbac"

// ============================================================
// INVENTORY — Stock movements, ingredients, wine bottles
// ============================================================

export async function getInventoryItems() {
    const [products, bottles, ingredients] = await Promise.all([
        prisma.product.findMany({
            where: { isActive: true, trackInventory: true },
            include: { category: true },
        }),
        prisma.wineBottle.findMany({
            include: { product: true, consignment: true },
            orderBy: { receivedAt: "desc" },
        }),
        prisma.ingredient.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        }),
    ])

    return {
        products: products.map((p) => ({
            id: p.id, name: p.name, type: p.type,
            categoryName: p.category.name,
            costPrice: Number(p.costPrice),
            sellPrice: Number(p.sellPrice),
            lowStockAlert: p.lowStockAlert,
            sku: p.sku,
        })),
        bottles: bottles.map((b) => ({
            id: b.id,
            productName: b.product.name,
            batchCode: b.batchCode,
            ownership: b.ownershipType,
            status: b.status,
            glassesRemaining: b.glassesRemaining,
            openedAt: b.openedAt,
            costPrice: Number(b.costPrice ?? 0),
            receivedAt: b.receivedAt,
            consignmentNo: b.consignment?.consignmentNo ?? null,
        })),
        ingredients: ingredients.map((i) => ({
            id: i.id, name: i.name, unit: i.unit,
            currentStock: Number(i.currentStock),
            minStock: Number(i.minStock),
            costPerUnit: Number(i.costPerUnit),
            isLowStock: Number(i.currentStock) <= Number(i.minStock),
        })),
    }
}

export async function getStockMovements(params?: { limit?: number }) {
    const movements = await prisma.stockMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: params?.limit ?? 50,
    })

    // Fetch product names for movements that have productId
    const productIds = movements.map(m => m.productId).filter(Boolean) as string[]
    const products = productIds.length > 0
        ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
        : []
    const productMap = new Map(products.map(p => [p.id, p.name]))

    return movements.map((m) => ({
        id: m.id, type: mapMovementType(m.type),
        productId: m.productId,
        productName: m.productId ? (productMap.get(m.productId) ?? "Không xác định") : "—",
        quantity: Number(m.quantity),
        unitCost: m.unitCost ? Number(m.unitCost) : null,
        reason: m.reason ?? "—",
        staffName: m.createdBy ?? "Hệ thống",
        previousStock: 0,
        newStock: 0,
        createdAt: m.createdAt,
    }))
}

function mapMovementType(type: string): string {
    switch (type) {
        case "PURCHASE": case "CONSIGNMENT_IN": return "IN"
        case "SALE": case "WASTE": case "SPOILAGE": case "BREAKAGE": return "OUT"
        case "ADJUSTMENT": return "ADJUSTMENT"
        case "RETURN": return "IN"
        default: return "ADJUSTMENT"
    }
}

export async function createStockMovement(data: {
    type: "PURCHASE" | "WASTE" | "ADJUSTMENT" | "RETURN"
    productId?: string
    bottleId?: string
    quantity: number
    unitCost?: number
    reason?: string
    createdBy?: string
}) {
    const guard = await withRbac("inventory", "create")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        await prisma.stockMovement.create({
            data: {
                type: data.type,
                productId: data.productId,
                bottleId: data.bottleId,
                quantity: data.quantity,
                unitCost: data.unitCost,
                reason: data.reason,
                createdBy: data.createdBy,
            },
        })
        revalidatePath("/dashboard/inventory")
        return { success: true }
    } catch {
        return { success: false }
    }
}

export async function createIngredient(data: {
    name: string; unit: string; currentStock: number; minStock: number; costPerUnit: number
}) {
    const guard = await withRbac("inventory", "create")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        const ingredient = await prisma.ingredient.create({ data })
        revalidatePath("/dashboard/inventory")
        return { success: true, data: ingredient }
    } catch {
        return { success: false }
    }
}

export async function updateIngredientStock(id: string, newStock: number) {
    const guard = await withRbac("inventory", "edit")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        await prisma.ingredient.update({ where: { id }, data: { currentStock: newStock } })
        revalidatePath("/dashboard/inventory")
        return { success: true }
    } catch {
        return { success: false }
    }
}

export async function getInventoryStats() {
    const [products, bottleCount, ingredients, bottleValSum, productCostSum] = await Promise.all([
        prisma.product.findMany({
            where: { isActive: true, trackInventory: true },
            select: {
                id: true,
                type: true,
                lowStockAlert: true,
                _count: { select: { wineBottles: { where: { status: "IN_STOCK" } } } },
            },
        }),
        prisma.wineBottle.groupBy({ by: ["status"], _count: true }),
        prisma.ingredient.findMany({
            where: { isActive: true },
            select: { id: true, currentStock: true, minStock: true, expiryDate: true },
        }),
        prisma.wineBottle.aggregate({
            where: { status: "IN_STOCK" },
            _sum: { costPrice: true },
        }),
        prisma.product.aggregate({
            where: { isActive: true, trackInventory: true },
            _sum: { costPrice: true },
        }),
    ])

    const lowStockIngredients = ingredients.filter((i) => Number(i.currentStock) <= Number(i.minStock))
    const totalValue = Number(bottleValSum._sum.costPrice ?? 0) + Number(productCostSum._sum.costPrice ?? 0)

    // Count products with real stock issues
    const wineProducts = products.filter(p => ["WINE_BOTTLE", "WINE_GLASS", "WINE_TASTING"].includes(p.type))
    const lowStockProducts = wineProducts.filter(p => p._count.wineBottles > 0 && p._count.wineBottles <= p.lowStockAlert)
    const outOfStockProducts = wineProducts.filter(p => p._count.wineBottles === 0)

    return {
        totalItems: products.length,
        inStock: products.length - outOfStockProducts.length,
        lowStock: lowStockProducts.length + lowStockIngredients.length,
        outOfStock: outOfStockProducts.length,
        totalValue,
        expiringSoon: ingredients.filter(i => i.expiryDate && ((new Date(i.expiryDate).getTime() - Date.now()) / 86400000) <= 14).length,
        // legacy
        totalBottles: bottleCount.reduce((s, b) => s + b._count, 0),
        inStockBottles: bottleCount.find((b) => b.status === "IN_STOCK")?._count ?? 0,
        openedBottles: bottleCount.find((b) => b.status === "OPENED")?._count ?? 0,
        totalIngredients: ingredients.length,
        lowStockAlerts: lowStockProducts.length + lowStockIngredients.length,
    }
}

// Fixed assets / depreciation stubs
export async function getFixedAssets() { return [] }
export async function calculateDepreciation() { return { success: true, processed: 0 } }

// Types for inventory page
export type InventoryItem = {
    id: string; name: string; productName?: string; type: string; categoryName: string
    sku?: string; category?: string; unit?: string
    costPrice: number; sellPrice: number; currentStock: number
    lowStockAlert: number; minStock?: number; maxStock?: number
    expiryDate?: Date | null; status: InventoryStatus
}

export type InventoryStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"

export type StockMovement = {
    id: string; type: string; productId: string | null; productName?: string
    quantity: number; unitCost: number | null; reason: string | null
    staffName?: string; previousStock?: number; newStock?: number
    createdAt: Date
}

// Full inventory list for the Inventory page
export async function getInventory(): Promise<InventoryItem[]> {
    const products = await prisma.product.findMany({
        where: { isActive: true, trackInventory: true },
        include: {
            category: true,
            _count: { select: { wineBottles: { where: { status: "IN_STOCK" } } } },
        },
        orderBy: { name: "asc" },
    })

    return products.map((p) => {
        const isWine = ["WINE_BOTTLE", "WINE_GLASS", "WINE_TASTING"].includes(p.type)
        const currentStock = isWine ? p._count.wineBottles : 0
        const lowStockThreshold = p.lowStockAlert
        let status: InventoryStatus = "IN_STOCK"
        if (currentStock <= 0) status = "OUT_OF_STOCK"
        else if (currentStock <= lowStockThreshold) status = "LOW_STOCK"

        return {
            id: p.id,
            name: p.name,
            productName: p.name,
            type: p.type,
            categoryName: p.category.name,
            category: p.category.name,
            sku: p.sku ?? "",
            unit: isWine ? "chai" : "cái",
            costPrice: Number(p.costPrice),
            sellPrice: Number(p.sellPrice),
            currentStock,
            lowStockAlert: lowStockThreshold,
            minStock: lowStockThreshold,
            maxStock: lowStockThreshold * 4,
            expiryDate: null,
            status,
        }
    })
}

export async function adjustStock(productId: string, typeOrAdjustment: string | number, quantityOrReason?: number | string, reason?: string, _staffName?: string) {
    let type: string
    let quantity: number
    let reasonStr: string | undefined
    if (typeof typeOrAdjustment === "number") {
        type = typeOrAdjustment >= 0 ? "PURCHASE" : "ADJUSTMENT"
        quantity = Math.abs(typeOrAdjustment)
        reasonStr = quantityOrReason as string | undefined
    } else {
        type = typeOrAdjustment as string
        quantity = quantityOrReason as number
        reasonStr = reason
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createStockMovement({ type: type as any, productId, quantity, reason: reasonStr })
    return { ...result, error: result.success ? undefined : "Lỗi" }
}
