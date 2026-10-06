"use server"

import { prisma } from "@/lib/prisma"

// ============================================================
// INVENTORY ALERTS — V2 Feature 4 — Prisma version
// Dynamically generates alerts from real DB state
// ============================================================

export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO"

export type InventoryAlert = {
    id: string; severity: AlertSeverity; type: string; icon: string; title: string; description: string
    productName?: string; productSku?: string; value?: string; action?: string
}

export async function getInventoryAlerts(): Promise<InventoryAlert[]> {
    const alerts: InventoryAlert[] = []
    const now = new Date()

    // 1. Out of stock wines (CRITICAL)
    const wineProducts = await prisma.product.findMany({
        where: { isActive: true, type: { in: ["WINE_BOTTLE", "WINE_GLASS", "WINE_TASTING"] }, trackInventory: true },
    })
    for (const p of wineProducts) {
        const count = await prisma.wineBottle.count({ where: { productId: p.id, status: { in: ["IN_STOCK", "OPENED"] } } })
        if (count === 0) {
            alerts.push({
                id: `oos-${p.id.slice(0, 8)}`, severity: "CRITICAL", type: "OUT_OF_STOCK", icon: "",
                title: "Hết hàng", description: `${p.name} — 0 chai trong kho`,
                productName: p.name, productSku: p.sku ?? undefined, action: "Đặt hàng NCC ngay",
            })
        } else if (count <= p.lowStockAlert) {
            alerts.push({
                id: `low-${p.id.slice(0, 8)}`, severity: "WARNING", type: "LOW_STOCK", icon: "",
                title: "Tồn kho thấp", description: `${p.name} — còn ${count} chai (ngưỡng: ${p.lowStockAlert})`,
                productName: p.name, productSku: p.sku ?? undefined, value: `${count} / min ${p.lowStockAlert}`, action: "Lên PO bổ sung",
            })
        }
    }

    // 2. Oxidation risk — opened bottles past threshold (CRITICAL)
    const openedBottles = await prisma.wineBottle.findMany({
        where: { status: "OPENED" }, include: { product: true },
    })
    for (const b of openedBottles) {
        if (!b.openedAt) continue
        const hoursOpened = Math.floor((now.getTime() - b.openedAt.getTime()) / 3600000)
        const threshold = b.product.oxidationHours ?? 48
        if (hoursOpened >= threshold) {
            alerts.push({
                id: `oxi-${b.id.slice(0, 8)}`, severity: "CRITICAL", type: "OXIDATION_RISK", icon: "",
                title: "Nguy cơ oxy hóa",
                description: `${b.product.name} — mở ${hoursOpened} giờ trước (ngưỡng: ${threshold}h)`,
                productName: b.product.name, productSku: b.product.sku ?? undefined,
                value: `${hoursOpened}h / ${threshold}h max`, action: "Push sale hoặc ghi nhận waste",
            })
        } else if ((b.glassesRemaining ?? 0) <= 2 && (b.glassesRemaining ?? 0) > 0) {
            alerts.push({
                id: `glass-${b.id.slice(0, 8)}`, severity: "WARNING", type: "LOW_GLASSES", icon: "",
                title: "Còn ít ly",
                description: `${b.product.name} — còn ${b.glassesRemaining}/${b.product.glassesPerBottle} ly`,
                productName: b.product.name, value: `${b.glassesRemaining}/${b.product.glassesPerBottle} ly`, action: "Chuẩn bị chai mới",
            })
        }
    }

    // 3. Ingredient expiry approaching (WARNING)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000)
    const expiringIngredients = await prisma.ingredient.findMany({
        where: { isActive: true, expiryDate: { lte: threeDaysFromNow, gte: now } },
    })
    for (const ing of expiringIngredients) {
        const daysLeft = Math.ceil((ing.expiryDate!.getTime() - now.getTime()) / 86400000)
        alerts.push({
            id: `exp-${ing.id.slice(0, 8)}`, severity: "WARNING", type: "EXPIRY_APPROACHING", icon: "",
            title: "Sắp hết hạn", description: `${ing.name} — hết hạn trong ${daysLeft} ngày`,
            productName: ing.name, value: `${daysLeft} ngày còn lại`, action: "Sử dụng trước / Ghi waste",
        })
    }

    // 4. Low stock ingredients (WARNING)
    const allIngredients = await prisma.ingredient.findMany({ where: { isActive: true } })
    const lowIngredients = allIngredients.filter((ing) => Number(ing.currentStock) <= Number(ing.minStock))
    for (const ing of lowIngredients) {
        if (Number(ing.currentStock) <= Number(ing.minStock)) {
            alerts.push({
                id: `low-ing-${ing.id.slice(0, 8)}`, severity: "WARNING", type: "LOW_STOCK", icon: "",
                title: "Nguyên liệu thấp",
                description: `${ing.name} — còn ${ing.currentStock} ${ing.unit} (tối thiểu: ${ing.minStock})`,
                productName: ing.name, value: `${ing.currentStock} / min ${ing.minStock}`, action: "Nhập thêm nguyên liệu",
            })
        }
    }

    return alerts.sort((a, b) => {
        const order = { CRITICAL: 0, WARNING: 1, INFO: 2 }
        return order[a.severity] - order[b.severity]
    })
}

export async function getAlertSummary(): Promise<{ critical: number; warning: number; info: number; total: number }> {
    const alerts = await getInventoryAlerts()
    return {
        critical: alerts.filter((a) => a.severity === "CRITICAL").length,
        warning: alerts.filter((a) => a.severity === "WARNING").length,
        info: alerts.filter((a) => a.severity === "INFO").length,
        total: alerts.length,
    }
}
