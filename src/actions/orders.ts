"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { OrderStatus, PaymentMethod, OrderItemStatus } from "@prisma/client"
import { deductRecipeIngredients } from "@/actions/assets"
import { checkPromotions } from "@/actions/promotions"

export type { OrderStatus, PaymentMethod } from "@prisma/client"

export type Order = {
    id: string
    orderNumber: string
    tableId: string | null
    tableNumber: string | null
    orderType: string
    status: OrderStatus
    items: Array<{
        id: string
        productId: string
        productName: string
        quantity: number
        unitPrice: number
        subtotal: number
        notes: string | null
        status: string
        productType?: string
    }>
    subtotal: number
    discount: number
    tax: number
    total: number
    paymentMethod: string | null
    paidAt: Date | null
    staffId: string | null
    staffName: string
    guestCount: number
    createdAt: Date
    updatedAt: Date
}

// ============================================================
// HELPERS
// ============================================================

async function generateOrderNumber(): Promise<string> {
    const today = new Date()
    const prefix = `ORD-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    const todayCount = await prisma.order.count({
        where: {
            orderNo: { startsWith: prefix },
        },
    })
    return `${prefix}-${String(todayCount + 1).padStart(3, "0")}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { serializeOrder } from "@/lib/order-serializer"

// ============================================================
// ORDERS CRUD
// ============================================================

export async function createOrder(params: {
    tableId: string | null
    tableNumber: string | null
    orderType: "DINE_IN" | "TAKEAWAY"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[]
    staffId: string
    staffName: string
    guestCount?: number
}) {
    try {
        const orderNo = await generateOrderNumber()
        // Normalize items — accept both { productId, price } and { product: { id }, unitPrice }
        const normalizedItems = params.items.map((item: any) => ({
            productId: item.productId ?? item.product?.id,
            name: item.name ?? item.product?.name ?? "",
            quantity: item.quantity,
            price: item.price ?? item.unitPrice,
            notes: item.notes ?? item.note,
        }))
        const subtotal = normalizedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0)

        const order = await prisma.order.create({
            data: {
                orderNo,
                tableId: params.tableId,
                orderType: params.orderType,
                createdBy: params.staffId,
                subtotal,
                totalAmount: subtotal,
                status: "OPEN",
                items: {
                    create: normalizedItems.map((item: any) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        subtotal: item.price * item.quantity,
                        notes: item.notes,
                    })),
                },
            },
            include: {
                items: { include: { product: true } },
                table: true,
                staff: true,
            },
        })

        if (params.tableId) {
            await prisma.floorTable.update({
                where: { id: params.tableId },
                data: { status: "OCCUPIED" },
            })
        }

        // GAP-11: Auto-apply best promotion
        try {
            const promos = await checkPromotions({
                orderTotal: subtotal,
                items: normalizedItems.map((i: any) => ({
                    productId: i.productId, categorySlug: "", quantity: i.quantity, unitPrice: i.price,
                })),
            })
            if (promos.length > 0) {
                // Apply best (highest discount) promo
                const best = promos.sort((a, b) => b.discountAmount - a.discountAmount)[0]
                const discountPct = (best.type === "PERCENT_OFF" || best.type === "HAPPY_HOUR") ? (best.discountAmount / subtotal * 100) : 0
                await prisma.order.update({
                    where: { id: order.id },
                    data: {
                        discountAmount: best.discountAmount,
                        discountPct: Math.round(discountPct * 100) / 100,
                        totalAmount: subtotal - best.discountAmount,
                        notes: `CTKM: ${best.name}`,
                    },
                })
            }
        } catch { /* promo is non-critical */ }

        // revalidatePath("/pos") — removed for perf (POS is client-side)
        revalidatePath("/dashboard/tables")
        return { success: true, order: serializeOrder(order) }
    } catch (e) {
        console.error("createOrder error:", e)
        const msg = e instanceof Error ? e.message : String(e)
        return { success: false, error: `Không thể tạo đơn hàng: ${msg}` }
    }
}

export async function getOrders(params?: { status?: OrderStatus; limit?: number; todayOnly?: boolean }) {
    const todayOnly = params?.todayOnly !== false // default true
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const orders = await prisma.order.findMany({
        where: {
            ...(params?.status ? { status: params.status } : {}),
            ...(todayOnly ? { createdAt: { gte: todayStart } } : {}),
        },
        include: {
            items: { include: { product: { select: { name: true } } } },
            payments: true,
        },
        orderBy: { createdAt: "desc" },
        take: params?.limit ?? 50,
    })
    return orders.map(serializeOrder)
}

export async function getOrderById(orderId: string) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { product: true } },
                table: true,
                staff: true,
                payments: true,
            },
        })
        return serializeOrder(order)
    } catch {
        return null
    }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
    try {
        await prisma.$transaction([
            // Update order status
            prisma.order.update({
                where: { id: orderId },
                data: {
                    status,
                    ...(status === "PAID" ? { closedAt: new Date() } : {}),
                },
            }),
            // Sync OrderItem statuses to match order flow
            // When order → READY: all PREPARING items become READY
            ...(status === "READY" ? [
                prisma.orderItem.updateMany({
                    where: { orderId, status: "PREPARING" },
                    data: { status: "READY" },
                }),
            ] : []),
            // When order → SERVED: all READY items become SERVED
            ...(status === "SERVED" ? [
                prisma.orderItem.updateMany({
                    where: { orderId, status: { in: ["PREPARING", "READY"] } },
                    data: { status: "SERVED" },
                }),
            ] : []),
        ])
        return { success: true }
    } catch {
        return { success: false }
    }
}

/**
 * GAP-06: Void/Cancel order with mandatory audit trail.
 * Records reason + staff in audit_log table.
 */
export async function voidOrder(
    orderId: string,
    staffId: string,
    reason: string
) {
    try {
        if (!reason || reason.trim().length < 3) {
            return { success: false, error: "Lý do hủy phải có ít nhất 3 ký tự" }
        }

        const order = await prisma.order.findUnique({ where: { id: orderId } })
        if (!order) return { success: false, error: "Không tìm thấy đơn" }
        if (order.status === "PAID") return { success: false, error: "Đơn đã thanh toán, không thể hủy" }

        await prisma.$transaction([
            prisma.order.update({
                where: { id: orderId },
                data: { status: "CANCELLED", closedAt: new Date(), notes: `[VOID] ${reason}` },
            }),
            // Audit log entry
            prisma.auditLog.create({
                data: {
                    action: "VOID_ORDER",
                    tableName: "order",
                    recordId: orderId,
                    staffId,
                    oldData: {
                        orderNo: order.orderNo,
                        status: order.status,
                        totalAmount: Number(order.totalAmount),
                    },
                    newData: {
                        status: "CANCELLED",
                        reason: reason.trim(),
                        voidedAt: new Date().toISOString(),
                    },
                },
            }),
            // Restore table if occupied
            ...(order.tableId
                ? [prisma.floorTable.update({ where: { id: order.tableId }, data: { status: "AVAILABLE" } })]
                : []),
        ])

        // revalidatePath("/pos")
        revalidatePath("/dashboard/tables")
        return { success: true }
    } catch (e) {
        console.error("voidOrder error:", e)
        return { success: false, error: "Lỗi hủy đơn" }
    }
}

// Split Payment type — each entry is one payment method + amount
export type SplitPaymentEntry = {
    method: PaymentMethod
    amount: number
    receivedAmount?: number // for cash — how much customer gave
    transactionRef?: string // for card/transfer
}

/**
 * Pay order — supports both single and split payment.
 * @param orderId - The order to pay
 * @param payments - Single PaymentMethod string OR array of SplitPaymentEntry
 */
export async function payOrder(
    orderId: string,
    payments: PaymentMethod | SplitPaymentEntry[]
) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { product: true } } },
        })
        if (!order) return { success: false, error: "Không tìm thấy đơn hàng" }

        // Normalize payments into array
        const paymentEntries: SplitPaymentEntry[] = typeof payments === "string"
            ? [{ method: payments, amount: Number(order.totalAmount) }]
            : payments

        // Validate total paid >= order total
        const totalPaid = paymentEntries.reduce((s, p) => s + p.amount, 0)
        const orderTotal = Number(order.totalAmount)
        if (totalPaid < orderTotal - 1) {
            return { success: false, error: `Thiếu ${Math.round(orderTotal - totalPaid)}₫. Tổng thanh toán: ${Math.round(totalPaid)}₫` }
        }

        // Calculate change (only applies to last cash payment)
        const changeAmount = Math.max(0, totalPaid - orderTotal)

        await prisma.$transaction([
            // Create payment records
            ...paymentEntries.map((p, idx) =>
                prisma.payment.create({
                    data: {
                        orderId,
                        method: p.method,
                        amount: p.amount,
                        receivedAmount: p.receivedAmount ?? p.amount,
                        changeAmount: idx === paymentEntries.length - 1 ? changeAmount : 0,
                        transactionRef: p.transactionRef,
                    },
                })
            ),
            // Update order status
            prisma.order.update({
                where: { id: orderId },
                data: {
                    status: "PAID",
                    paymentStatus: "PAID",
                    closedAt: new Date(),
                },
            }),
            // Set table to CLEANING (not AVAILABLE — staff must clear first)
            ...(order.tableId
                ? [prisma.floorTable.update({ where: { id: order.tableId }, data: { status: "CLEANING" } })]
                : []),
        ])

        // revalidatePath("/pos")
        revalidatePath("/dashboard/tables")

        // GAP-09: Update customer loyalty if order has a customer
        if (order.customerId) {
            try {
                const loyaltyPts = Math.floor(orderTotal / 10000) // 1 pt per 10K₫
                const updated = await prisma.customer.update({
                    where: { id: order.customerId },
                    data: {
                        totalSpent: { increment: orderTotal },
                        loyaltyPts: { increment: loyaltyPts },
                    },
                })
                // Auto-tier: REGULAR < 5M, SILVER 5-20M, GOLD 20-50M, VIP 50M+
                const spent = Number(updated.totalSpent)
                const newTier = spent >= 50_000_000 ? "VIP" : spent >= 20_000_000 ? "GOLD" : spent >= 5_000_000 ? "SILVER" : "REGULAR"
                if (updated.tier !== newTier) {
                    await prisma.customer.update({ where: { id: order.customerId }, data: { tier: newTier } })
                }
            } catch { /* non-critical */ }
        }

        return {
            success: true,
            paymentCount: paymentEntries.length,
            totalPaid: Math.round(totalPaid),
            changeAmount: Math.round(changeAmount),
        }
    } catch (e) {
        console.error("payOrder error:", e)
        return { success: false, error: "Lỗi thanh toán" }
    }
}

export async function getActiveOrderByTable(tableId: string) {
    const order = await prisma.order.findFirst({
        where: {
            tableId,
            status: { in: ["OPEN", "PENDING", "PREPARING", "READY", "SERVED"] },
        },
        include: {
            items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
    })
    return order ? serializeOrder(order) : null
}

export async function addItemsToOrder(
    orderId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawItems: any[]
) {
    try {
        const newItems = rawItems.map((item: any) => ({
            productId: item.productId ?? item.product?.id,
            quantity: item.quantity,
            price: item.price ?? item.unitPrice,
            notes: item.notes ?? item.note,
        }))
        const addedSubtotal = newItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0)

        await prisma.$transaction([
            ...newItems.map((item: any) =>
                prisma.orderItem.create({
                    data: {
                        orderId,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        subtotal: item.price * item.quantity,
                        notes: item.notes,
                    },
                })
            ),
            prisma.order.update({
                where: { id: orderId },
                data: {
                    subtotal: { increment: addedSubtotal },
                    totalAmount: { increment: addedSubtotal },
                },
            }),
        ])

        const updated = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { product: true } },
                table: true,
                staff: true,
                payments: true,
            },
        })

        // revalidatePath("/pos")
        return { success: true, order: serializeOrder(updated) }
    } catch {
        return { success: false, error: "Không thể thêm món" }
    }
}

export async function getActiveOrders() {
    const orders = await prisma.order.findMany({
        where: { status: { in: ["OPEN", "PENDING", "PREPARING", "READY", "SERVED"] } },
        include: {
            items: { include: { product: { select: { name: true, type: true } } } },
        },
        orderBy: { createdAt: "desc" },
    })
    return orders.map(serializeOrder)
}

export async function getTodayStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const orders = await prisma.order.findMany({
        where: { createdAt: { gte: today } },
        include: { payments: true },
    })

    const paidOrders = orders.filter((o) => o.status === "PAID")

    return {
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        totalRevenue: paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0),
        avgOrderValue:
            paidOrders.length > 0
                ? Math.round(paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0) / paidOrders.length)
                : 0,
        cancelled: orders.filter((o) => o.status === "CANCELLED").length,
        activeOrders: orders.filter((o) => ["OPEN", "PREPARING", "SERVED"].includes(o.status)).length,
    }
}

// ============================================================
// COGS — Pay + deduct recipe ingredients
// ============================================================

export async function processOrderWithCOGS(
    orderId: string,
    payments: PaymentMethod | SplitPaymentEntry[]
) {
    // 1. Process payment first
    const payResult = await payOrder(orderId, payments)
    if (!payResult.success) {
        return { success: false, orderId, deductions: [], stockWarnings: [], totalIngredientCost: 0, errors: [payResult.error ?? "Payment failed"] }
    }

    // 2. Load order with product + recipe + wine bottle data
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: {
                include: {
                    product: { include: { recipes: true } },
                    wineBottle: true,
                },
            },
        },
    })
    if (!order) return { success: true, orderId, deductions: [], stockWarnings: [], totalIngredientCost: 0, errors: [] }

    const allDeductions: Array<{ productName: string; materialName: string; qtyUsed: number; unit: string; warning: string | null }> = []
    const stockWarnings: string[] = []
    const errors: string[] = []
    let totalCOGS = 0

    for (const item of order.items) {
        const product = item.product
        const hasRecipe = product.recipes.length > 0
        const costPrice = Number(product.costPrice)
        const bottleCost = item.wineBottle ? Number(item.wineBottle.costPrice ?? 0) : 0

        // ─── CASE 1: Product has recipe → deduct ingredients (food, cocktails) ───
        if (hasRecipe && ["FOOD", "DRINK", "OTHER"].includes(product.type)) {
            const result = await deductRecipeIngredients(item.productId, item.quantity)
            if (result.deductions.length > 0) {
                totalCOGS += result.totalIngredientCost
                for (const d of result.deductions) {
                    allDeductions.push({
                        productName: result.productName,
                        materialName: d.materialName,
                        qtyUsed: d.qtyUsed,
                        unit: d.unit,
                        warning: d.warning,
                    })
                    if (d.warning) stockWarnings.push(`${result.productName} → ${d.warning}`)

                    // Record stock movement for ingredient deduction
                    try {
                        await prisma.stockMovement.create({
                            data: {
                                type: "SALE",
                                productId: item.productId,
                                ingredientId: d.ingredientId,
                                quantity: -d.qtyUsed,
                                unitCost: d.costPerUnit,
                                totalCost: d.subtotal,
                                balanceQty: d.remainingStock,
                                reason: `Bán ${result.productName} x${item.quantity} → trừ ${d.materialName}`,
                                createdBy: order.createdBy,
                            },
                        })
                    } catch { /* non-critical */ }
                }
            }
            if (result.errors.length > 0) errors.push(...result.errors)
        }

        // ─── CASE 2: Wine bottle with costPrice → COGS from bottle cost ───
        else if (item.wineBottleId && bottleCost > 0) {
            // For glass pours, prorate cost: bottleCost / glassesPerBottle
            let itemCOGS: number
            if (item.isGlassPour && product.glassesPerBottle > 0) {
                itemCOGS = Math.round((bottleCost / product.glassesPerBottle) * item.quantity)
            } else {
                itemCOGS = Math.round(bottleCost * item.quantity)
            }
            totalCOGS += itemCOGS

            allDeductions.push({
                productName: product.name,
                materialName: item.isGlassPour ? `Ly rượu (1/${product.glassesPerBottle} chai)` : "Chai rượu",
                qtyUsed: item.quantity,
                unit: item.isGlassPour ? "ly" : "chai",
                warning: null,
            })
        }

        // ─── CASE 3: No recipe, no bottle, but has costPrice → fallback COGS ───
        else if (costPrice > 0) {
            const itemCOGS = Math.round(costPrice * item.quantity)
            totalCOGS += itemCOGS

            allDeductions.push({
                productName: product.name,
                materialName: `Giá nhập (costPrice)`,
                qtyUsed: item.quantity,
                unit: "phần",
                warning: null,
            })
        }
    }

    // 3. Record COGS as FundTransaction for Finance reporting
    if (totalCOGS > 0) {
        try {
            const productNames = order.items.map(i => i.product.name).join(", ")
            await prisma.fundTransaction.create({
                data: {
                    transactionType: "EXPENSE",
                    category: "Giá vốn hàng bán (COGS)",
                    amount: totalCOGS,
                    description: `COGS đơn ${order.orderNo}: ${productNames}`,
                    orderId: order.id,
                },
            })
        } catch { /* non-critical */ }
    }

    // 4. Record revenue as FundTransaction
    try {
        await prisma.fundTransaction.create({
            data: {
                transactionType: "REVENUE",
                category: "Doanh thu bán hàng",
                amount: Number(order.totalAmount),
                description: `Đơn ${order.orderNo}`,
                orderId: order.id,
            },
        })
    } catch { /* non-critical */ }

    return { success: true, orderId, deductions: allDeductions, stockWarnings, totalIngredientCost: totalCOGS, errors }
}

// ============================================================
// KDS — Kitchen Display System Flow
// ============================================================

/** Send specific items (or all pending) to kitchen */
export async function sendToKitchen(orderId: string, itemIds?: string[]) {
    try {
        const where = itemIds && itemIds.length > 0
            ? { id: { in: itemIds }, orderId, sentToKitchen: false }
            : { orderId, sentToKitchen: false }

        const result = await prisma.orderItem.updateMany({
            where,
            data: {
                sentToKitchen: true,
                sentAt: new Date(),
                status: "PREPARING",
            },
        })

        // Also update order status if still OPEN
        await prisma.order.updateMany({
            where: { id: orderId, status: "OPEN" },
            data: { status: "PREPARING" },
        })

        // revalidatePath("/pos")
        // revalidatePath("/dashboard/kitchen") — removed for perf (kitchen is client-side with polling)
        return { success: true, itemsSent: result.count }
    } catch {
        return { success: false, itemsSent: 0, error: "Lỗi gửi bếp" }
    }
}

/** Update item status (kitchen/bar staff marks items) */
export async function updateItemStatus(
    itemId: string,
    status: OrderItemStatus
) {
    try {
        await prisma.orderItem.update({
            where: { id: itemId },
            data: { status },
        })

        // Check if all items in order are READY → set order to READY
        const item = await prisma.orderItem.findUnique({ where: { id: itemId } })
        if (item && status === "READY") {
            const allItems = await prisma.orderItem.findMany({ where: { orderId: item.orderId } })
            const allReady = allItems.every(i => i.status === "READY" || i.status === "SERVED" || i.status === "CANCELLED")
            if (allReady) {
                await prisma.order.update({ where: { id: item.orderId }, data: { status: "READY" } })
            }
        }

        // If marking as SERVED, check if all served → set order to SERVED
        if (item && status === "SERVED") {
            const allItems = await prisma.orderItem.findMany({ where: { orderId: item.orderId } })
            const allServed = allItems.every(i => i.status === "SERVED" || i.status === "CANCELLED")
            if (allServed) {
                await prisma.order.update({ where: { id: item.orderId }, data: { status: "SERVED" } })
            }
        }

        // revalidatePath("/pos")
        // revalidatePath("/dashboard/kitchen") — removed for perf (kitchen is client-side with polling)
        return { success: true }
    } catch {
        return { success: false, error: "Lỗi cập nhật trạng thái" }
    }
}

/** Get kitchen orders — items sent but not yet served */
export async function getKitchenOrders() {
    const items = await prisma.orderItem.findMany({
        where: {
            sentToKitchen: true,
            status: { in: ["PREPARING", "READY"] },
        },
        include: {
            product: true,
            order: { include: { table: true } },
        },
        orderBy: { sentAt: "asc" },
    })

    // Group by order
    const orderMap = new Map<string, {
        orderId: string
        orderNo: string
        tableNumber: string | null
        items: Array<{
            id: string
            productName: string
            quantity: number
            status: string
            notes: string | null
            sentAt: Date | null
            productType: string
        }>
    }>()

    for (const item of items) {
        if (!orderMap.has(item.orderId)) {
            orderMap.set(item.orderId, {
                orderId: item.orderId,
                orderNo: item.order.orderNo,
                tableNumber: item.order.table?.tableNumber ?? null,
                items: [],
            })
        }
        orderMap.get(item.orderId)!.items.push({
            id: item.id,
            productName: item.product.name,
            quantity: item.quantity,
            status: item.status,
            notes: item.notes,
            sentAt: item.sentAt,
            productType: item.product.type,
        })
    }

    return Array.from(orderMap.values())
}

// ============================================================
// REMOVE ITEM
// ============================================================

export async function removeItemFromOrder(orderId: string, itemId: string) {
    try {
        const item = await prisma.orderItem.findUnique({ where: { id: itemId } })
        if (!item || item.orderId !== orderId) return { success: false, error: "Không tìm thấy" }
        if (item.sentToKitchen) return { success: false, error: "Món đã gửi bếp, không thể xóa" }

        await prisma.$transaction([
            prisma.orderItem.delete({ where: { id: itemId } }),
            prisma.order.update({
                where: { id: orderId },
                data: {
                    subtotal: { decrement: item.subtotal },
                    totalAmount: { decrement: item.subtotal },
                },
            }),
        ])

        // revalidatePath("/pos")
        return { success: true }
    } catch {
        return { success: false, error: "Lỗi xóa món" }
    }
}
