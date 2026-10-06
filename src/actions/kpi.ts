"use server"

import { prisma } from "@/lib/prisma"
import type { KpiPeriod } from "@prisma/client"
import { withRbac } from "@/lib/with-rbac"

// ============================================================
// KPI SYSTEM — Multi-level targets (Month → Week → Shift)
// ============================================================

// ─── Types ───────────────────────────────────────────────────

export type KpiMetricData = {
    id: string; code: string; name: string; unit: string; icon: string
    isDefault: boolean; isActive: boolean; sortOrder: number
}

export type KpiTargetData = {
    id: string; metricId: string; metricCode: string; metricName: string; metricUnit: string; metricIcon: string
    period: KpiPeriod; year: number; month: number | null; week: number | null
    targetValue: number; actualValue: number | null; achievePct: number | null
    setBy: string; notes: string | null; updatedAt: string
}

export type KpiOverview = {
    metric: KpiMetricData
    monthly: { target: number; actual: number; pct: number } | null
    weekly: { target: number; actual: number; pct: number } | null
    shiftAvg: { target: number; actual: number; pct: number } | null
}

// ─── Metrics CRUD ─────────────────────────────────────────────

const DEFAULT_METRICS = [
    { code: "revenue", name: "Doanh thu", unit: "₫", icon: "" },
    { code: "orders", name: "Số đơn hàng", unit: "đơn", icon: "" },
    { code: "customers", name: "Số khách", unit: "khách", icon: "" },
    { code: "avg_ticket", name: "TB/đơn", unit: "₫", icon: "" },
    { code: "wine_bottles", name: "Chai wine bán", unit: "chai", icon: "" },
    { code: "wine_glasses", name: "Ly wine bán", unit: "ly", icon: "" },
]

export async function ensureDefaultMetrics(): Promise<void> {
    const existing = await prisma.kpiMetric.count()
    if (existing > 0) return

    await prisma.kpiMetric.createMany({
        data: DEFAULT_METRICS.map((m, i) => ({
            ...m, isDefault: true, sortOrder: i,
        })),
        skipDuplicates: true,
    })
}

export async function getKpiMetrics(): Promise<KpiMetricData[]> {
    await ensureDefaultMetrics()
    const metrics = await prisma.kpiMetric.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
    })
    return metrics.map(m => ({
        id: m.id, code: m.code, name: m.name, unit: m.unit, icon: m.icon,
        isDefault: m.isDefault, isActive: m.isActive, sortOrder: m.sortOrder,
    }))
}

export async function createKpiMetric(data: {
    code: string; name: string; unit: string; icon: string
}): Promise<{ success: boolean; error?: string }> {
    const guard = await withRbac("kpi", "create")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        const count = await prisma.kpiMetric.count()
        await prisma.kpiMetric.create({
            data: { ...data, sortOrder: count },
        })
        return { success: true }
    } catch {
        return { success: false, error: "Mã chỉ số đã tồn tại" }
    }
}

export async function toggleKpiMetric(id: string, isActive: boolean): Promise<void> {
    const guard = await withRbac("kpi", "edit")
    if (!guard.ok) return

    await prisma.kpiMetric.update({ where: { id }, data: { isActive } })
}

export async function deleteKpiMetric(id: string): Promise<{ success: boolean; error?: string }> {
    const guard = await withRbac("kpi", "edit")
    if (!guard.ok) return { success: false, error: guard.error }

    const metric = await prisma.kpiMetric.findUnique({ where: { id } })
    if (metric?.isDefault) return { success: false, error: "Không thể xóa chỉ số mặc định" }
    await prisma.kpiTarget.deleteMany({ where: { metricId: id } })
    await prisma.kpiMetric.delete({ where: { id } })
    return { success: true }
}

// ─── Targets CRUD ─────────────────────────────────────────────

export async function getTargets(params: {
    period: KpiPeriod; year: number; month?: number; week?: number
}): Promise<KpiTargetData[]> {
    const where: Record<string, unknown> = { period: params.period, year: params.year }
    if (params.month !== undefined) where.month = params.month
    if (params.week !== undefined) where.week = params.week

    const targets = await prisma.kpiTarget.findMany({
        where,
        include: { metric: true },
        orderBy: { metric: { sortOrder: "asc" } },
    })

    return targets.map(t => ({
        id: t.id, metricId: t.metricId, metricCode: t.metric.code,
        metricName: t.metric.name, metricUnit: t.metric.unit, metricIcon: t.metric.icon,
        period: t.period, year: t.year, month: t.month, week: t.week,
        targetValue: Number(t.targetValue), actualValue: t.actualValue ? Number(t.actualValue) : null,
        achievePct: t.achievePct ? Number(t.achievePct) : null,
        setBy: t.setBy, notes: t.notes, updatedAt: t.updatedAt.toISOString(),
    }))
}

export async function upsertTarget(data: {
    metricId: string; period: KpiPeriod; year: number
    month?: number; week?: number; shiftId?: string
    targetValue: number; setBy: string; notes?: string
}): Promise<{ success: boolean }> {
    const guard = await withRbac("kpi", "edit")
    if (!guard.ok) return { success: false }

    await prisma.kpiTarget.upsert({
        where: {
            metricId_period_year_month_week_shiftId: {
                metricId: data.metricId, period: data.period, year: data.year,
                month: data.month ?? null, week: data.week ?? null, shiftId: data.shiftId ?? null,
            },
        },
        update: { targetValue: data.targetValue, setBy: data.setBy, notes: data.notes },
        create: {
            metricId: data.metricId, period: data.period, year: data.year,
            month: data.month, week: data.week, shiftId: data.shiftId,
            targetValue: data.targetValue, setBy: data.setBy, notes: data.notes,
        },
    })
    return { success: true }
}

export async function bulkUpsertTargets(targets: Array<{
    metricId: string; period: KpiPeriod; year: number
    month?: number; week?: number; targetValue: number; setBy: string
}>): Promise<{ success: boolean; count: number }> {
    let count = 0
    for (const t of targets) {
        await upsertTarget(t)
        count++
    }
    return { success: true, count }
}

// ─── Cascade: Monthly → Weekly auto-split ──────────────────────

export async function cascadeMonthlyToWeekly(params: {
    year: number; month: number; setBy: string
}): Promise<{ created: number }> {
    const monthlyTargets = await prisma.kpiTarget.findMany({
        where: { period: "MONTHLY", year: params.year, month: params.month },
    })

    // Calculate weeks in month (approximate: 4-5 weeks)
    const firstDay = new Date(params.year, params.month - 1, 1)
    const lastDay = new Date(params.year, params.month, 0)
    const weeksInMonth = Math.ceil(lastDay.getDate() / 7)

    let created = 0
    for (const mt of monthlyTargets) {
        const weeklyValue = Math.round(Number(mt.targetValue) / weeksInMonth)
        // Create targets for each week
        for (let w = 1; w <= weeksInMonth; w++) {
            const weekStart = new Date(firstDay)
            weekStart.setDate(firstDay.getDate() + (w - 1) * 7)
            // Get ISO week number
            const oneJan = new Date(params.year, 0, 1)
            const weekNum = Math.ceil(((weekStart.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)

            await prisma.kpiTarget.upsert({
                where: {
                    metricId_period_year_month_week_shiftId: {
                        metricId: mt.metricId, period: "WEEKLY",
                        year: params.year, month: params.month, week: weekNum, shiftId: null,
                    },
                },
                update: { targetValue: weeklyValue, setBy: params.setBy },
                create: {
                    metricId: mt.metricId, period: "WEEKLY",
                    year: params.year, month: params.month, week: weekNum,
                    targetValue: weeklyValue, setBy: params.setBy,
                },
            })
            created++
        }
    }
    return { created }
}

// ─── Actuals: Calculate from real data ──────────────────────────

export async function updateActuals(params: {
    period: KpiPeriod; year: number; month?: number; week?: number
}): Promise<void> {
    const targets = await prisma.kpiTarget.findMany({
        where: { period: params.period, year: params.year, month: params.month ?? undefined, week: params.week ?? undefined },
        include: { metric: true },
    })

    // Determine date range
    let startDate: Date, endDate: Date
    if (params.period === "MONTHLY" && params.month) {
        startDate = new Date(params.year, params.month - 1, 1)
        endDate = new Date(params.year, params.month, 0, 23, 59, 59)
    } else if (params.period === "WEEKLY" && params.week) {
        const oneJan = new Date(params.year, 0, 1)
        startDate = new Date(oneJan.getTime() + (params.week - 1) * 7 * 86400000)
        startDate.setDate(startDate.getDate() - startDate.getDay() + 1) // Monday
        endDate = new Date(startDate.getTime() + 6 * 86400000 + 86399000) // Sunday
    } else {
        return
    }

    // Fetch aggregated data
    const orders = await prisma.order.findMany({
        where: {
            createdAt: { gte: startDate, lte: endDate },
            status: { in: ["PAID", "COMPLETED"] },
        },
        include: { items: true },
    })

    const totalRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0)
    const totalOrders = orders.length
    const uniqueCustomers = new Set(orders.filter(o => o.customerId).map(o => o.customerId)).size || Math.round(totalOrders * 1.2)
    const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
    const wineBottles = orders.reduce((s, o) => s + o.items.filter(i => !i.isGlassPour).length, 0)
    const wineGlasses = orders.reduce((s, o) => s + o.items.filter(i => i.isGlassPour).length, 0)

    const actuals: Record<string, number> = {
        revenue: totalRevenue, orders: totalOrders, customers: uniqueCustomers,
        avg_ticket: avgTicket, wine_bottles: wineBottles, wine_glasses: wineGlasses,
    }

    for (const t of targets) {
        const actual = actuals[t.metric.code] ?? 0
        const targetVal = Number(t.targetValue)
        const pct = targetVal > 0 ? Math.round((actual / targetVal) * 1000) / 10 : 0

        await prisma.kpiTarget.update({
            where: { id: t.id },
            data: { actualValue: actual, achievePct: pct },
        })
    }
}

// ─── Overview: Current month + week summary ──────────────────

export async function getKpiOverview(year: number, month: number): Promise<KpiOverview[]> {
    const metrics = await getKpiMetrics()

    // Get current week number
    const now = new Date()
    const oneJan = new Date(year, 0, 1)
    const currentWeek = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)

    const [monthlyTargets, weeklyTargets] = await Promise.all([
        getTargets({ period: "MONTHLY", year, month }),
        getTargets({ period: "WEEKLY", year, month, week: currentWeek }),
    ])

    // Update actuals
    await Promise.all([
        updateActuals({ period: "MONTHLY", year, month }),
        updateActuals({ period: "WEEKLY", year, month, week: currentWeek }),
    ])

    // Re-fetch after update
    const [updatedMonthly, updatedWeekly] = await Promise.all([
        getTargets({ period: "MONTHLY", year, month }),
        getTargets({ period: "WEEKLY", year, month, week: currentWeek }),
    ])

    return metrics.map(m => {
        const mt = updatedMonthly.find(t => t.metricId === m.id)
        const wt = updatedWeekly.find(t => t.metricId === m.id)
        return {
            metric: m,
            monthly: mt ? { target: mt.targetValue, actual: mt.actualValue ?? 0, pct: mt.achievePct ?? 0 } : null,
            weekly: wt ? { target: wt.targetValue, actual: wt.actualValue ?? 0, pct: wt.achievePct ?? 0 } : null,
            shiftAvg: null, // TODO: aggregate shift targets
        }
    })
}

// ─── KPI History for chart ──────────────────────────────────

export async function getKpiHistory(metricCode: string, months: number = 6): Promise<{
    label: string; target: number; actual: number; pct: number
}[]> {
    const metric = await prisma.kpiMetric.findUnique({ where: { code: metricCode } })
    if (!metric) return []

    const now = new Date()
    const results = []

    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const year = d.getFullYear()
        const month = d.getMonth() + 1

        const target = await prisma.kpiTarget.findFirst({
            where: { metricId: metric.id, period: "MONTHLY", year, month },
        })

        results.push({
            label: `T${month}/${year}`,
            target: target ? Number(target.targetValue) : 0,
            actual: target?.actualValue ? Number(target.actualValue) : 0,
            pct: target?.achievePct ? Number(target.achievePct) : 0,
        })
    }

    return results
}

// ─── Settings: KPI enabled toggle ────────────────────────────

export async function isKpiEnabled(): Promise<boolean> {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "kpi_enabled" } })
    return setting ? (setting.value as { enabled: boolean }).enabled : false
}

export async function setKpiEnabled(enabled: boolean): Promise<void> {
    await prisma.systemSetting.upsert({
        where: { key: "kpi_enabled" },
        update: { value: { enabled } },
        create: { key: "kpi_enabled", value: { enabled } },
    })
}
