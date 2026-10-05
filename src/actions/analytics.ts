"use server"

import { prisma } from "@/lib/prisma"
import { parallelLimit } from "@/lib/parallel-limit"

// ============================================================
// ANALYTICS — M6 Advanced Reports (Prisma queries)
// ============================================================

export type MonthlyRevenue = {
    month: string
    revenue: number
    profit: number
    orders: number
    avgTicket: number
}

export type CategoryRevenue = {
    name: string
    revenue: number
    quantity: number
    percentage: number
    color: string
}

export type ZoneHeatmap = {
    zoneId: string
    zoneName: string
    tables: {
        tableId: string
        tableNumber: string
        orders: number
        revenue: number
        avgDuration: number
        heatLevel: number // 0-100
    }[]
    totalRevenue: number
    totalOrders: number
}

export type HourlyHeatmap = {
    day: string      // "T2", "T3", ...
    dayIndex: number
    hours: { hour: number; orders: number; revenue: number; intensity: number }[]
}

export type StaffLeaderboard = {
    id: string
    name: string
    role: string
    orders: number
    revenue: number
    avgTicket: number
    topProduct: string
    rank: number
}

export type AnalyticsSummary = {
    totalRevenue: number
    totalOrders: number
    avgTicket: number
    totalCustomers: number
    revenueGrowth: number
    ordersGrowth: number
    bestDay: string
    bestDayRevenue: number
    peakHour: string
    peakHourOrders: number
}

// ============================================================
// 1. Monthly Revenue (last 6 months)
// ============================================================
export async function getMonthlyRevenue(): Promise<MonthlyRevenue[]> {
    const now = new Date()

    // 6 month window: from 5 months ago (1st of month) to end of current month
    const earliestDate = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const allOrders = await prisma.order.findMany({
        where: {
            createdAt: { gte: earliestDate, lt: nextMonthDate },
            status: { not: "CANCELLED" },
        },
        select: {
            createdAt: true,
            totalAmount: true,
            items: {
                select: {
                    quantity: true,
                    product: {
                        select: {
                            costPrice: true,
                        },
                    },
                },
            },
        },
    })

    const months = Array.from({ length: 6 }, (_, idx) => {
        const i = 5 - idx
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        const monthLabel = start.toLocaleDateString("vi-VN", { month: "short", year: "numeric" })
        return { start, end, monthLabel }
    })

    return months.map(({ start, end, monthLabel }) => {
        const monthOrders = allOrders.filter(
            (o) => o.createdAt >= start && o.createdAt < end
        )
        const revenue = monthOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
        const cogs = monthOrders.reduce(
            (s, o) => s + o.items.reduce((is, it) => is + Number(it.product?.costPrice ?? 0) * it.quantity, 0), 0
        )
        const profit = revenue - cogs
        const avgTicket = monthOrders.length > 0 ? Math.round(revenue / monthOrders.length) : 0
        return { month: monthLabel, revenue, profit, orders: monthOrders.length, avgTicket }
    })
}

// ============================================================
// 2. Category Revenue Breakdown (this month)
// ============================================================
const CATEGORY_COLORS = [
    "#7c2d12", "#166534", "#b45309", "#1e40af", "#6d28d9",
    "#be123c", "#0e7490", "#4338ca", "#a16207", "#059669",
]

export async function getCategoryRevenue(): Promise<CategoryRevenue[]> {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const items = await prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: start }, status: { not: "CANCELLED" } } },
        include: { product: { include: { category: true } } },
    })

    const map = new Map<string, { revenue: number; quantity: number }>()
    for (const item of items) {
        const cat = item.product.category?.name ?? "Khác"
        const existing = map.get(cat) ?? { revenue: 0, quantity: 0 }
        existing.revenue += Number(item.subtotal)
        existing.quantity += item.quantity
        map.set(cat, existing)
    }

    const total = Array.from(map.values()).reduce((s, v) => s + v.revenue, 0)
    return Array.from(map.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([name, data], i) => ({
            name,
            revenue: data.revenue,
            quantity: data.quantity,
            percentage: total > 0 ? Math.round(data.revenue / total * 1000) / 10 : 0,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        }))
}

// ============================================================
// 3. Zone Heatmap (this month)
// ============================================================
export async function getZoneHeatmap(): Promise<ZoneHeatmap[]> {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    const zones = await prisma.tableZone.findMany({
        where: { isActive: true },
        include: {
            tables: {
                where: { isActive: true },
                include: {
                    orders: {
                        where: { createdAt: { gte: start }, status: { not: "CANCELLED" } },
                        select: { totalAmount: true },
                    },
                },
            },
        },
    })

    const result: ZoneHeatmap[] = []
    const allTableRevenues: number[] = []

    for (const zone of zones) {
        const tables = zone.tables.map((table) => {
            const orders = table.orders.length
            const revenue = table.orders.reduce((s, o) => s + Number(o.totalAmount), 0)
            allTableRevenues.push(revenue)
            return {
                tableId: table.id,
                tableNumber: table.tableNumber,
                orders,
                revenue,
                avgDuration: 0,
                heatLevel: 0,
            }
        })

        result.push({
            zoneId: zone.id,
            zoneName: zone.name,
            tables,
            totalRevenue: tables.reduce((s, t) => s + t.revenue, 0),
            totalOrders: tables.reduce((s, t) => s + t.orders, 0),
        })
    }

    // Calculate heat levels
    const maxRevenue = Math.max(...allTableRevenues, 1)
    for (const zone of result) {
        for (const table of zone.tables) {
            table.heatLevel = Math.round((table.revenue / maxRevenue) * 100)
        }
    }

    return result
}

// ============================================================
// 4. Hourly Heatmap (last 7 days — day × hour matrix)
// ============================================================
export async function getHourlyHeatmap(): Promise<HourlyHeatmap[]> {
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
    const now = new Date()

    const earliestDay = new Date(now.getTime() - 6 * 86400000)
    const overallStart = new Date(earliestDay.toISOString().split("T")[0])
    const latestDay = new Date(now.toISOString().split("T")[0])
    const overallEnd = new Date(latestDay.getTime() + 86400000)

    const allOrders = await prisma.order.findMany({
        where: {
            createdAt: { gte: overallStart, lt: overallEnd },
            status: { not: "CANCELLED" },
        },
        select: {
            createdAt: true,
            totalAmount: true,
        },
    })

    const dayConfigs = Array.from({ length: 7 }, (_, idx) => {
        const i = 6 - idx
        const d = new Date(now.getTime() - i * 86400000)
        const start = new Date(d.toISOString().split("T")[0])
        const end = new Date(start.getTime() + 86400000)
        const dayLabel = days[start.getDay()]
        return { start, end, dayLabel, dayIndex: start.getDay() }
    })

    const result = dayConfigs.map(({ start, end, dayLabel, dayIndex }) => {
        const dayOrders = allOrders.filter(
            (o) => o.createdAt >= start && o.createdAt < end
        )

        const hourMap = new Map<number, { orders: number; revenue: number }>()
        for (const o of dayOrders) {
            const h = o.createdAt.getHours()
            const existing = hourMap.get(h) ?? { orders: 0, revenue: 0 }
            existing.orders++
            existing.revenue += Number(o.totalAmount)
            hourMap.set(h, existing)
        }

        const hours = []
        for (let h = 10; h <= 23; h++) {
            const data = hourMap.get(h) ?? { orders: 0, revenue: 0 }
            hours.push({ hour: h, ...data, intensity: 0 })
        }

        return { day: dayLabel, dayIndex, hours } as HourlyHeatmap
    })

    // Normalize intensity
    const maxOrders = Math.max(...result.flatMap((d) => d.hours.map((h) => h.orders)), 1)
    for (const day of result) {
        for (const h of day.hours) {
            h.intensity = Math.round((h.orders / maxOrders) * 100)
        }
    }

    return result
}

// ============================================================
// 5. Staff Leaderboard (this month)
// ============================================================
export async function getStaffLeaderboard(): Promise<StaffLeaderboard[]> {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    const orders = await prisma.order.findMany({
        where: { createdAt: { gte: start }, status: { not: "CANCELLED" } },
        include: { staff: true, items: { include: { product: true } } },
    })

    const map = new Map<string, {
        name: string; role: string; orders: number; revenue: number
        productSales: Map<string, { name: string; qty: number }>
    }>()

    for (const o of orders) {
        const key = o.createdBy
        const existing = map.get(key) ?? {
            name: o.staff.fullName, role: o.staff.role,
            orders: 0, revenue: 0, productSales: new Map(),
        }
        existing.orders++
        existing.revenue += Number(o.totalAmount)

        for (const item of o.items) {
            const ps = existing.productSales.get(item.productId) ?? { name: item.product.name, qty: 0 }
            ps.qty += item.quantity
            existing.productSales.set(item.productId, ps)
        }

        map.set(key, existing)
    }

    return Array.from(map.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([id, data], i) => {
            const topProduct = Array.from(data.productSales.values())
                .sort((a, b) => b.qty - a.qty)[0]?.name ?? "—"
            return {
                id,
                name: data.name,
                role: data.role,
                orders: data.orders,
                revenue: data.revenue,
                avgTicket: data.orders > 0 ? Math.round(data.revenue / data.orders) : 0,
                topProduct,
                rank: i + 1,
            }
        })
}

// ============================================================
// 6. Analytics Summary (this month vs last month)
// ============================================================
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [thisMonthOrders, lastMonthOrders, customers] = await Promise.all([
        prisma.order.findMany({
            where: { createdAt: { gte: thisMonthStart }, status: { not: "CANCELLED" } },
            select: { createdAt: true, totalAmount: true },
        }),
        prisma.order.findMany({
            where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart }, status: { not: "CANCELLED" } },
            select: { createdAt: true, totalAmount: true },
        }),
        prisma.customer.count(),
    ])

    const totalRevenue = thisMonthOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
    const lastRevenue = lastMonthOrders.reduce((s, o) => s + Number(o.totalAmount), 0)

    // Best day analysis
    const dayMap = new Map<string, { revenue: number; orders: number }>()
    for (const o of thisMonthOrders) {
        const d = o.createdAt.toISOString().split("T")[0]
        const existing = dayMap.get(d) ?? { revenue: 0, orders: 0 }
        existing.revenue += Number(o.totalAmount)
        existing.orders++
        dayMap.set(d, existing)
    }
    const bestDayEntry = Array.from(dayMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue)[0]
    const bestDay = bestDayEntry
        ? new Date(bestDayEntry[0]).toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "short" })
        : "—"

    // Peak hour
    const hourMap = new Map<number, number>()
    for (const o of thisMonthOrders) {
        const h = o.createdAt.getHours()
        hourMap.set(h, (hourMap.get(h) ?? 0) + 1)
    }
    const peakHourEntry = Array.from(hourMap.entries()).sort((a, b) => b[1] - a[1])[0]

    return {
        totalRevenue,
        totalOrders: thisMonthOrders.length,
        avgTicket: thisMonthOrders.length > 0 ? Math.round(totalRevenue / thisMonthOrders.length) : 0,
        totalCustomers: customers,
        revenueGrowth: lastRevenue > 0 ? Math.round((totalRevenue - lastRevenue) / lastRevenue * 1000) / 10 : 0,
        ordersGrowth: lastMonthOrders.length > 0
            ? Math.round((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length * 1000) / 10 : 0,
        bestDay,
        bestDayRevenue: bestDayEntry?.[1].revenue ?? 0,
        peakHour: peakHourEntry ? `${peakHourEntry[0]}:00` : "—",
        peakHourOrders: peakHourEntry?.[1] ?? 0,
    }
}

// ============================================================
// 7. Export Data Helper (returns JSON for Excel export)
// ============================================================
export async function getExportData(type: "revenue" | "products" | "staff" | "orders") {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    if (type === "revenue") {
        return getMonthlyRevenue()
    }

    if (type === "products") {
        return getCategoryRevenue()
    }

    if (type === "staff") {
        return getStaffLeaderboard()
    }

    // orders
    const orders = await prisma.order.findMany({
        where: { createdAt: { gte: start }, status: { not: "CANCELLED" } },
        include: { staff: true, items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
    })

    return orders.map((o) => ({
        orderNo: o.orderNo,
        date: o.createdAt.toISOString(),
        type: o.orderType,
        items: o.items.length,
        total: Number(o.totalAmount),
        staff: o.staff.fullName,
        status: o.status,
    }))
}
