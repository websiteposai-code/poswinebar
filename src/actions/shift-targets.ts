"use server"

import { prisma } from "@/lib/prisma"

// ============================================================
// SHIFT TARGETS — V2 Feature 2 — Prisma version
// ============================================================

export type ShiftTargetSuggestion = {
    revenueTarget: number; orderTarget: number; customerTarget: number
    pushProducts: { productId: string; productName: string; reason: string }[]; basedOn: string
}

export type ShiftTargetData = {
    id: string; shiftRecordId: string; revenueTarget: number; orderTarget: number; customerTarget: number
    pushProducts: { productId: string; productName: string; reason: string }[]
    suggestedBy: string; approvedBy: string | null; approvedAt: string | null; isApproved: boolean
    actualRevenue: number | null; actualOrders: number | null; actualCustomers: number | null
    evaluation: string | null; evaluatedAt: string | null
}

export type ShiftEvaluation = {
    revenueAchieved: number; orderAchieved: number; customerAchieved: number
    revenuePct: number; orderPct: number; customerPct: number
    overallGrade: "EXCELLENT" | "GOOD" | "NEEDS_IMPROVEMENT" | "POOR"; gradeLabel: string; gradeColor: string
}

export async function suggestShiftTargets(_shiftId: string): Promise<ShiftTargetSuggestion> {
    const dayOfWeek = new Date().getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6

    // Query historical same-day-of-week orders from last 4 weeks
    const fourWeeksAgo = new Date(Date.now() - 28 * 86400000)
    const historicalOrders = await prisma.order.findMany({
        where: { createdAt: { gte: fourWeeksAgo }, status: { in: ["PAID", "COMPLETED"] } },
    })

    const sameDayOrders = historicalOrders.filter((o) => o.createdAt.getDay() === dayOfWeek)
    const weekCount = Math.max(1, Math.ceil((Date.now() - fourWeeksAgo.getTime()) / (7 * 86400000)))
    const avgRevenue = sameDayOrders.length > 0
        ? Math.round(sameDayOrders.reduce((s, o) => s + Number(o.totalAmount), 0) / weekCount)
        : isWeekend ? 8500000 : 5200000
    const avgOrders = sameDayOrders.length > 0 ? Math.round(sameDayOrders.length / weekCount) : isWeekend ? 18 : 12

    // Get push products from opened bottles
    const openedBottles = await prisma.wineBottle.findMany({
        where: { status: "OPENED" }, include: { product: true }, take: 3,
    })

    return {
        revenueTarget: avgRevenue, orderTarget: avgOrders, customerTarget: Math.round(avgOrders * 1.4),
        pushProducts: openedBottles.map((b) => ({
            productId: b.productId, productName: b.product.name,
            reason: `Chai đã mở – còn ${b.glassesRemaining ?? 0}/${b.product.glassesPerBottle} ly`,
        })),
        basedOn: `Trung bình ${isWeekend ? "cuối tuần" : "ngày thường"} (4 tuần gần nhất)`,
    }
}

export async function approveTargets(
    shiftId: string, managerId: string,
    overrides?: { revenueTarget?: number; orderTarget?: number; customerTarget?: number }
): Promise<{ success: boolean; targetId: string }> {
    const suggestion = await suggestShiftTargets(shiftId)
    const target = await prisma.shiftTarget.create({
        data: {
            shiftRecordId: shiftId,
            revenueTarget: overrides?.revenueTarget ?? suggestion.revenueTarget,
            orderTarget: overrides?.orderTarget ?? suggestion.orderTarget,
            customerTarget: overrides?.customerTarget ?? suggestion.customerTarget,
            pushProducts: suggestion.pushProducts,
            suggestedBy: "SYSTEM", approvedBy: managerId, approvedAt: new Date(), isApproved: true,
        },
    })
    return { success: true, targetId: target.id }
}

export async function evaluateShift(
    shiftId: string,
    actuals: { revenue: number; orders: number; customers: number },
    evaluationNotes?: string
): Promise<ShiftEvaluation> {
    const target = await prisma.shiftTarget.findFirst({ where: { shiftRecordId: shiftId } })
    const revenueTarget = target ? Number(target.revenueTarget) : 5200000
    const orderTarget = target ? target.orderTarget : 12
    const customerTarget = target ? target.customerTarget : 15

    const revenuePct = Math.round((actuals.revenue / revenueTarget) * 100)
    const orderPct = Math.round((actuals.orders / orderTarget) * 100)
    const customerPct = Math.round((actuals.customers / customerTarget) * 100)
    const avgPct = Math.round((revenuePct + orderPct + customerPct) / 3)

    let overallGrade: ShiftEvaluation["overallGrade"], gradeLabel: string, gradeColor: string
    if (avgPct >= 100) { overallGrade = "EXCELLENT"; gradeLabel = "Xuất sắc"; gradeColor = "text-green-700" }
    else if (avgPct >= 80) { overallGrade = "GOOD"; gradeLabel = "Tốt"; gradeColor = "text-blue-700" }
    else if (avgPct >= 60) { overallGrade = "NEEDS_IMPROVEMENT"; gradeLabel = "Cần cải thiện"; gradeColor = "text-amber-700" }
    else { overallGrade = "POOR"; gradeLabel = "Chưa đạt"; gradeColor = "text-red-700" }

    if (target) {
        await prisma.shiftTarget.update({
            where: { id: target.id },
            data: { actualRevenue: actuals.revenue, actualOrders: actuals.orders, actualCustomers: actuals.customers, evaluation: evaluationNotes ?? gradeLabel, evaluatedAt: new Date() },
        })
    }

    return { revenueAchieved: actuals.revenue, orderAchieved: actuals.orders, customerAchieved: actuals.customers, revenuePct, orderPct, customerPct, overallGrade, gradeLabel, gradeColor }
}

export async function getShiftTargetHistory(days: number = 30): Promise<{
    date: string; staffName: string; revenueTarget: number; actualRevenue: number; revenuePct: number; grade: string
}[]> {
    const since = new Date(Date.now() - days * 86400000)
    const targets = await prisma.shiftTarget.findMany({
        where: { createdAt: { gte: since }, evaluatedAt: { not: null } },
        include: { shift: { include: { staff: true } } },
        orderBy: { createdAt: "desc" },
    })
    return targets.map((t) => ({
        date: t.createdAt.toISOString().split("T")[0], staffName: t.shift.staff.fullName,
        revenueTarget: Number(t.revenueTarget), actualRevenue: Number(t.actualRevenue ?? 0),
        revenuePct: Number(t.revenueTarget) > 0 ? Math.round(Number(t.actualRevenue ?? 0) / Number(t.revenueTarget) * 100) : 0,
        grade: t.evaluation ?? "N/A",
    }))
}
