"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ============================================================
// TYPES
// ============================================================

export type CashMovementType = "CASH_IN" | "CASH_OUT"

export type CashMovement = {
    id: string
    shiftId: string
    type: CashMovementType
    amount: number
    reason: string
    staffName: string
    time: string
}

export type DenominationCount = {
    d500k?: number
    d200k?: number
    d100k?: number
    d50k?: number
    d20k?: number
    d10k?: number
    d5k?: number
    d2k?: number
    d1k?: number
}

export type Shift = {
    id: string
    staffId: string
    staffName: string
    shiftNumber: string
    openingCash: number
    closingCash: number | null
    expectedCash: number | null
    variance: number | null
    cashDifference?: number | null
    totalRevenue: number | null
    totalSales: number
    totalCash: number
    totalCard: number
    totalQR: number
    orderCount: number
    itemsSold: number
    transactions: Array<{ id?: string; type: string; amount: number; time: Date; description?: string }>
    movements: CashMovement[]
    status: string
    openedAt: Date
    closedAt: Date | null
    notes?: string
}

export type ShiftZReport = {
    shiftId: string
    shiftNumber: string
    staffName: string
    staffRole?: string
    openedAt: string
    closedAt: string | null
    isClosed: boolean
    // Financials
    grossRevenue: number
    discounts: number
    taxAmount: number
    netRevenue: number
    totalRevenue: number
    // Payment channels
    cashRevenue: number
    cardRevenue: number
    qrRevenue: number
    // Cash drawer reconciliation
    openingCash: number
    cashInTotal: number
    cashOutTotal: number
    expectedCash: number
    closingCash: number | null
    variance: number | null
    cashDifference?: number | null
    // Operations
    orderCount: number
    itemsSold: number
    avgOrderValue: number
    // Breakdowns
    movements: CashMovement[]
    denominations?: DenominationCount
    topItems: Array<{ name: string; quantity: number; revenue: number }>
    notes?: string
}

// Helpers for movements storage in systemSetting
const MOVEMENTS_PREFIX = "shift_movements_"
const DETAILS_PREFIX = "shift_details_"

async function getStoredMovements(shiftId: string): Promise<CashMovement[]> {
    try {
        const record = await prisma.systemSetting.findUnique({
            where: { key: `${MOVEMENTS_PREFIX}${shiftId}` },
        })
        if (record?.value && Array.isArray(record.value)) {
            return record.value as CashMovement[]
        }
    } catch {
        // fallback
    }
    return []
}

async function saveStoredMovements(shiftId: string, list: CashMovement[]): Promise<void> {
    await prisma.systemSetting.upsert({
        where: { key: `${MOVEMENTS_PREFIX}${shiftId}` },
        create: { key: `${MOVEMENTS_PREFIX}${shiftId}`, value: list },
        update: { value: list },
    })
}

async function getStoredDetails(shiftId: string): Promise<{ denominations?: DenominationCount; notes?: string } | null> {
    try {
        const record = await prisma.systemSetting.findUnique({
            where: { key: `${DETAILS_PREFIX}${shiftId}` },
        })
        if (record?.value) {
            return record.value as { denominations?: DenominationCount; notes?: string }
        }
    } catch {
        // fallback
    }
    return null
}

async function saveStoredDetails(shiftId: string, details: { denominations?: DenominationCount; notes?: string }): Promise<void> {
    await prisma.systemSetting.upsert({
        where: { key: `${DETAILS_PREFIX}${shiftId}` },
        create: { key: `${DETAILS_PREFIX}${shiftId}`, value: details },
        update: { value: details },
    })
}

// ============================================================
// CASH MOVEMENTS (IN / OUT / EXPENSE)
// ============================================================

export async function getShiftMovements(shiftId: string): Promise<CashMovement[]> {
    return getStoredMovements(shiftId)
}

export async function addShiftCashMovement(params: {
    shiftId: string
    type: CashMovementType
    amount: number
    reason: string
    staffName: string
}): Promise<{ success: boolean; data?: CashMovement; error?: string }> {
    try {
        if (!params.amount || params.amount <= 0) {
            return { success: false, error: "Số tiền phải lớn hơn 0" }
        }
        if (!params.reason.trim()) {
            return { success: false, error: "Vui lòng nhập lý do thu/chi" }
        }

        const movements = await getStoredMovements(params.shiftId)
        const newMovement: CashMovement = {
            id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            shiftId: params.shiftId,
            type: params.type,
            amount: params.amount,
            reason: params.reason.trim(),
            staffName: params.staffName,
            time: new Date().toISOString(),
        }

        movements.push(newMovement)
        await saveStoredMovements(params.shiftId, movements)

        // Log to FundTransaction for P&L tracking
        try {
            await prisma.fundTransaction.create({
                data: {
                    transactionType: params.type === "CASH_OUT" ? "EXPENSE" : "REVENUE",
                    category: params.type === "CASH_OUT" ? "Chi két ca POS" : "Nạp quỹ ca POS",
                    amount: params.amount,
                    description: `[${params.staffName}] ${params.reason.trim()}`,
                    date: new Date(),
                },
            })
        } catch {
            // ignore fund transaction error
        }

        revalidatePath("/pos")
        revalidatePath("/dashboard/finance")
        return { success: true, data: newMovement }
    } catch (e) {
        return { success: false, error: (e as Error).message }
    }
}

// Backwards compatibility for pos/page.tsx
export async function addShiftExpense(params: {
    shiftId: string
    amount: number
    description: string
    staffName?: string
}) {
    return addShiftCashMovement({
        shiftId: params.shiftId,
        type: "CASH_OUT",
        amount: params.amount,
        reason: params.description,
        staffName: params.staffName || "Thu ngân",
    })
}

// ============================================================
// GET CURRENT SHIFT (WITH REAL-TIME METRICS)
// ============================================================

export async function getCurrentShift(): Promise<Shift | null> {
    try {
        const shift = await prisma.shiftRecord.findFirst({
            where: { closedAt: null },
            include: { staff: true },
            orderBy: { openedAt: "desc" },
        })
        if (!shift) return null

        // Fetch paid orders during this shift
        const paidOrders = await prisma.order.findMany({
            where: {
                createdAt: { gte: shift.openedAt },
                status: "PAID",
            },
            include: {
                payments: true,
                items: true,
            },
            orderBy: { createdAt: "desc" },
        })

        let totalCash = 0
        let totalCard = 0
        let totalQR = 0
        let itemsSold = 0

        paidOrders.forEach((o) => {
            o.payments.forEach((p) => {
                const amt = Number(p.amount)
                if (p.method === "CASH") totalCash += amt
                else if (p.method === "CARD") totalCard += amt
                else totalQR += amt
            })
            o.items.forEach((it) => {
                itemsSold += it.quantity
            })
        })

        const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)

        // Movements
        const movements = await getStoredMovements(shift.id)
        const cashInTotal = movements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + m.amount, 0)
        const cashOutTotal = movements.filter((m) => m.type === "CASH_OUT").reduce((s, m) => s + m.amount, 0)

        const expectedCash = Number(shift.openingCash) + totalCash + cashInTotal - cashOutTotal

        // Build recent transactions timeline
        const salesTransactions = paidOrders.slice(0, 10).map((o) => ({
            id: o.id,
            type: "SALE",
            amount: Number(o.totalAmount),
            time: o.createdAt,
            description: `Đơn ${o.orderNo} · ${o.payments.map((p) => p.method).join("+")}`,
        }))

        const movementTransactions = movements.map((m) => ({
            id: m.id,
            type: m.type === "CASH_OUT" ? "EXPENSE" : "CASH_IN",
            amount: m.type === "CASH_OUT" ? -m.amount : m.amount,
            time: new Date(m.time),
            description: m.reason,
        }))

        const allTransactions = [...salesTransactions, ...movementTransactions].sort(
            (a, b) => b.time.getTime() - a.time.getTime()
        )

        const shiftNum = shift.openedAt.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
        }).replace("/", "") + "-" + shift.id.slice(-4).toUpperCase()

        return {
            id: shift.id,
            staffId: shift.staffId,
            staffName: shift.staff.fullName,
            shiftNumber: shiftNum,
            openingCash: Number(shift.openingCash),
            closingCash: null,
            expectedCash,
            variance: null,
            cashDifference: null,
            totalRevenue: totalSales,
            totalSales,
            totalCash,
            totalCard,
            totalQR,
            orderCount: paidOrders.length,
            itemsSold,
            transactions: allTransactions,
            movements,
            status: "OPEN",
            openedAt: shift.openedAt,
            closedAt: null,
        }
    } catch (e) {
        console.error("Lỗi getCurrentShift:", e)
        return null
    }
}

// ============================================================
// GET ALL SHIFTS
// ============================================================

export async function getShifts(limit: number = 50) {
    const shifts = await prisma.shiftRecord.findMany({
        include: { staff: true },
        orderBy: { openedAt: "desc" },
        take: limit,
    })

    return shifts.map((s) => ({
        id: s.id,
        staffId: s.staffId,
        staffName: s.staff.fullName,
        shiftNumber: s.openedAt.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
        }).replace("/", "") + "-" + s.id.slice(-4).toUpperCase(),
        openingCash: Number(s.openingCash),
        closingCash: s.closingCash ? Number(s.closingCash) : null,
        expectedCash: s.expectedCash ? Number(s.expectedCash) : null,
        variance: s.variance ? Number(s.variance) : null,
        totalRevenue: s.totalRevenue ? Number(s.totalRevenue) : null,
        status: s.closedAt ? "CLOSED" : "OPEN",
        openedAt: s.openedAt,
        closedAt: s.closedAt,
    }))
}

// ============================================================
// OPEN SHIFT
// ============================================================

export async function openShift(params: {
    staffId: string
    openingCash: number
    staffName?: string
    staffRole?: string
}) {
    const existing = await prisma.shiftRecord.findFirst({ where: { closedAt: null } })
    if (existing) {
        return { success: false, error: "Đã có ca đang mở, vui lòng đóng ca trước đó" }
    }

    try {
        const shift = await prisma.shiftRecord.create({
            data: {
                staffId: params.staffId,
                openingCash: params.openingCash,
            },
            include: { staff: true },
        })

        // Log to AuditLog
        try {
            await prisma.auditLog.create({
                data: {
                    action: "OPEN_SHIFT",
                    tableName: "shift_record",
                    recordId: shift.id,
                    staffId: params.staffId,
                    newData: {
                        openingCash: params.openingCash,
                        staffName: params.staffName,
                    },
                },
            })
        } catch {
            // ignore audit log error
        }

        revalidatePath("/pos")
        revalidatePath("/dashboard/finance")
        return { success: true, data: shift }
    } catch (e) {
        return { success: false, error: "Không thể mở ca: " + (e as Error).message }
    }
}

// ============================================================
// CLOSE SHIFT & COMPUTE Z-REPORT
// ============================================================

export async function closeShift(params: {
    shiftId: string
    closingCash: number
    denominations?: DenominationCount
    notes?: string
}): Promise<{ success: boolean; data?: ShiftZReport; error?: string }> {
    try {
        const shift = await prisma.shiftRecord.findUnique({
            where: { id: params.shiftId },
            include: { staff: true },
        })
        if (!shift) return { success: false, error: "Không tìm thấy ca" }
        if (shift.closedAt) return { success: false, error: "Ca này đã được đóng trước đó" }

        const closedAt = new Date()

        // Fetch paid orders during this shift window
        const paidOrders = await prisma.order.findMany({
            where: {
                createdAt: { gte: shift.openedAt, lte: closedAt },
                status: "PAID",
            },
            include: {
                payments: true,
                items: { include: { product: true } },
            },
        })

        let cashRevenue = 0
        let cardRevenue = 0
        let qrRevenue = 0
        let grossRevenue = 0
        let discounts = 0
        let taxAmount = 0
        let itemsSold = 0
        const itemAgg: Record<string, { name: string; quantity: number; revenue: number }> = {}

        paidOrders.forEach((o) => {
            grossRevenue += Number(o.subtotal || o.totalAmount)
            discounts += Number(o.discountAmount || 0)
            taxAmount += Number(o.taxAmount || 0)

            o.payments.forEach((p) => {
                const amt = Number(p.amount)
                if (p.method === "CASH") cashRevenue += amt
                else if (p.method === "CARD") cardRevenue += amt
                else qrRevenue += amt
            })

            o.items.forEach((it) => {
                itemsSold += it.quantity
                const pName = it.product?.name ?? "Sản phẩm"
                if (!itemAgg[pName]) {
                    itemAgg[pName] = { name: pName, quantity: 0, revenue: 0 }
                }
                itemAgg[pName].quantity += it.quantity
                itemAgg[pName].revenue += Number(it.subtotal || Number(it.unitPrice) * it.quantity)
            })
        })

        const netRevenue = paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
        const orderCount = paidOrders.length
        const avgOrderValue = orderCount > 0 ? Math.round(netRevenue / orderCount) : 0

        // Movements
        const movements = await getStoredMovements(shift.id)
        const cashInTotal = movements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + m.amount, 0)
        const cashOutTotal = movements.filter((m) => m.type === "CASH_OUT").reduce((s, m) => s + m.amount, 0)

        // Mathematical Expected Cash in Drawer
        const expectedCash = Number(shift.openingCash) + cashRevenue + cashInTotal - cashOutTotal
        const variance = params.closingCash - expectedCash

        // Update database record
        await prisma.shiftRecord.update({
            where: { id: params.shiftId },
            data: {
                closingCash: params.closingCash,
                expectedCash,
                variance,
                totalRevenue: netRevenue,
                closedAt,
            },
        })

        // Store extra details (denominations & notes)
        await saveStoredDetails(params.shiftId, {
            denominations: params.denominations,
            notes: params.notes,
        })

        // Top 5 items
        const topItems = Object.values(itemAgg)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)

        const shiftNum = shift.openedAt.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
        }).replace("/", "") + "-" + shift.id.slice(-4).toUpperCase()

        const zReport: ShiftZReport = {
            shiftId: shift.id,
            shiftNumber: shiftNum,
            staffName: shift.staff.fullName,
            staffRole: shift.staff.role,
            openedAt: shift.openedAt.toISOString(),
            closedAt: closedAt.toISOString(),
            isClosed: true,
            grossRevenue,
            discounts,
            taxAmount,
            netRevenue,
            totalRevenue: netRevenue,
            cashRevenue,
            cardRevenue,
            qrRevenue,
            openingCash: Number(shift.openingCash),
            cashInTotal,
            cashOutTotal,
            expectedCash,
            closingCash: params.closingCash,
            variance,
            cashDifference: variance,
            orderCount,
            itemsSold,
            avgOrderValue,
            movements,
            denominations: params.denominations,
            topItems,
            notes: params.notes,
        }

        // Log audit
        try {
            await prisma.auditLog.create({
                data: {
                    action: "CLOSE_SHIFT_Z_REPORT",
                    tableName: "shift_record",
                    recordId: shift.id,
                    staffId: shift.staffId,
                    newData: {
                        expectedCash,
                        closingCash: params.closingCash,
                        variance,
                        netRevenue,
                        notes: params.notes,
                    },
                },
            })
        } catch {
            // ignore audit log error
        }

        revalidatePath("/pos")
        revalidatePath("/dashboard/finance")
        return { success: true, data: zReport }
    } catch (e) {
        return { success: false, error: "Lỗi đóng ca: " + (e as Error).message }
    }
}

// ============================================================
// GET Z-REPORT (FOR CLOSED OR MID-SHIFT X-REPORT)
// ============================================================

export async function getShiftZReport(shiftId: string): Promise<{ success: boolean; data?: ShiftZReport; error?: string }> {
    try {
        const shift = await prisma.shiftRecord.findUnique({
            where: { id: shiftId },
            include: { staff: true },
        })
        if (!shift) return { success: false, error: "Không tìm thấy ca" }

        const endTime = shift.closedAt ?? new Date()

        const paidOrders = await prisma.order.findMany({
            where: {
                createdAt: { gte: shift.openedAt, lte: endTime },
                status: "PAID",
            },
            include: {
                payments: true,
                items: { include: { product: true } },
            },
        })

        let cashRevenue = 0
        let cardRevenue = 0
        let qrRevenue = 0
        let grossRevenue = 0
        let discounts = 0
        let taxAmount = 0
        let itemsSold = 0
        const itemAgg: Record<string, { name: string; quantity: number; revenue: number }> = {}

        paidOrders.forEach((o) => {
            grossRevenue += Number(o.subtotal || o.totalAmount)
            discounts += Number(o.discountAmount || 0)
            taxAmount += Number(o.taxAmount || 0)

            o.payments.forEach((p) => {
                const amt = Number(p.amount)
                if (p.method === "CASH") cashRevenue += amt
                else if (p.method === "CARD") cardRevenue += amt
                else qrRevenue += amt
            })

            o.items.forEach((it) => {
                itemsSold += it.quantity
                const pName = it.product?.name ?? "Sản phẩm"
                if (!itemAgg[pName]) {
                    itemAgg[pName] = { name: pName, quantity: 0, revenue: 0 }
                }
                itemAgg[pName].quantity += it.quantity
                itemAgg[pName].revenue += Number(it.subtotal || Number(it.unitPrice) * it.quantity)
            })
        })

        const netRevenue = paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
        const orderCount = paidOrders.length
        const avgOrderValue = orderCount > 0 ? Math.round(netRevenue / orderCount) : 0

        const movements = await getStoredMovements(shift.id)
        const cashInTotal = movements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + m.amount, 0)
        const cashOutTotal = movements.filter((m) => m.type === "CASH_OUT").reduce((s, m) => s + m.amount, 0)

        const expectedCash = Number(shift.openingCash) + cashRevenue + cashInTotal - cashOutTotal
        const details = await getStoredDetails(shift.id)

        const shiftNum = shift.openedAt.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
        }).replace("/", "") + "-" + shift.id.slice(-4).toUpperCase()

        const topItems = Object.values(itemAgg)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)

        return {
            success: true,
            data: {
                shiftId: shift.id,
                shiftNumber: shiftNum,
                staffName: shift.staff.fullName,
                staffRole: shift.staff.role,
                openedAt: shift.openedAt.toISOString(),
                closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
                isClosed: !!shift.closedAt,
                grossRevenue,
                discounts,
                taxAmount,
                netRevenue,
                totalRevenue: netRevenue,
                cashRevenue,
                cardRevenue,
                qrRevenue,
                openingCash: Number(shift.openingCash),
                cashInTotal,
                cashOutTotal,
                expectedCash,
                closingCash: shift.closingCash ? Number(shift.closingCash) : null,
                variance: shift.variance ? Number(shift.variance) : null,
                cashDifference: shift.variance ? Number(shift.variance) : null,
                orderCount,
                itemsSold,
                avgOrderValue,
                movements,
                denominations: details?.denominations,
                topItems,
                notes: details?.notes,
            },
        }
    } catch (e) {
        return { success: false, error: (e as Error).message }
    }
}

// ============================================================
// STATS
// ============================================================

export async function getShiftStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayShifts = await prisma.shiftRecord.findMany({
        where: { openedAt: { gte: today } },
    })

    return {
        todayShifts: todayShifts.length,
        currentOpen: todayShifts.filter((s) => !s.closedAt).length > 0,
        totalCashVariance: todayShifts.reduce((s, sh) => s + Number(sh.variance ?? 0), 0),
    }
}
