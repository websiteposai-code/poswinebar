"use server"

import { prisma } from "@/lib/prisma"

// ============================================================
// REPORTS — Prisma version (real data from Orders/Payments)
// ============================================================

export type DailyRevenue = { date: string; revenue: number; orders: number }
export type TopProduct = { name: string; quantity: number; revenue: number; category: string }
export type HourlyData = { hour: string; orders: number; revenue: number }
export type PaymentBreakdown = { method: string; count: number; total: number; percentage: number }
export type StaffPerformance = { name: string; orders: number; revenue: number; avgTime: number }

export async function getDashboardStats() {
    const now = new Date()
    const todayStart = new Date(now.toISOString().split("T")[0])
    const yesterdayStart = new Date(todayStart.getTime() - 86400000)

    const [todayOrders, yesterdayOrders, tables] = await Promise.all([
        prisma.order.findMany({
            where: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
            select: { totalAmount: true },
        }),
        prisma.order.findMany({
            where: { createdAt: { gte: yesterdayStart, lt: todayStart }, status: { not: "CANCELLED" } },
            select: { totalAmount: true },
        }),
        prisma.floorTable.findMany({
            where: { isActive: true },
            select: { status: true },
        }),
    ])

    const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
    const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
    const revenueChange = yesterdayRevenue > 0 ? Math.round((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 1000) / 10 : 0
    const ordersChange = yesterdayOrders.length > 0 ? Math.round((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length * 1000) / 10 : 0
    const avgOrderValue = todayOrders.length > 0 ? Math.round(todayRevenue / todayOrders.length) : 0
    const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length
    const tableOccupancy = tables.length > 0 ? Math.round(occupiedTables / tables.length * 100) : 0

    return {
        todayRevenue, yesterdayRevenue, revenueChange,
        todayOrders: todayOrders.length, yesterdayOrders: yesterdayOrders.length, ordersChange,
        avgOrderValue, avgTimeMinutes: 0, tableOccupancy, topSellingProduct: "",
    }
}

export async function getWeeklyRevenue(): Promise<DailyRevenue[]> {
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

    const result: DailyRevenue[] = []
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000)
        const start = new Date(d.toISOString().split("T")[0])
        const end = new Date(start.getTime() + 86400000)

        const dayOrders = allOrders.filter(
            (o) => o.createdAt >= start && o.createdAt < end
        )

        result.push({
            date: days[start.getDay()],
            revenue: dayOrders.reduce((s, o) => s + Number(o.totalAmount), 0),
            orders: dayOrders.length,
        })
    }
    return result
}

export async function getTopProducts(): Promise<TopProduct[]> {
    const todayStart = new Date(new Date().toISOString().split("T")[0])
    const items = await prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } } },
        include: { product: { include: { category: true } } },
    })

    const map = new Map<string, TopProduct>()
    for (const i of items) {
        const key = i.productId
        const existing = map.get(key) ?? { name: i.product.name, quantity: 0, revenue: 0, category: i.product.category?.name ?? "" }
        existing.quantity += i.quantity
        existing.revenue += Number(i.subtotal)
        map.set(key, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
}

export async function getHourlyData(): Promise<HourlyData[]> {
    const todayStart = new Date(new Date().toISOString().split("T")[0])
    const orders = await prisma.order.findMany({
        where: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
        select: { createdAt: true, totalAmount: true },
    })

    const hourMap = new Map<number, { orders: number; revenue: number }>()
    for (const o of orders) {
        const h = o.createdAt.getHours()
        const existing = hourMap.get(h) ?? { orders: 0, revenue: 0 }
        existing.orders++
        existing.revenue += Number(o.totalAmount)
        hourMap.set(h, existing)
    }

    return Array.from(hourMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([h, d]) => ({ hour: `${h}h`, orders: d.orders, revenue: d.revenue }))
}

export async function getPaymentBreakdown(): Promise<PaymentBreakdown[]> {
    const todayStart = new Date(new Date().toISOString().split("T")[0])
    const payments = await prisma.payment.findMany({
        where: { createdAt: { gte: todayStart }, status: "COMPLETED" },
    })

    const map = new Map<string, { count: number; total: number }>()
    const labels: Record<string, string> = { CASH: "Tiền mặt", CARD: "Thẻ", BANK_TRANSFER: "Chuyển khoản", MOMO: "MoMo", VNPAY: "VNPay", QR: "QR Pay" }
    for (const p of payments) {
        const key = p.method
        const existing = map.get(key) ?? { count: 0, total: 0 }
        existing.count++
        existing.total += Number(p.amount)
        map.set(key, existing)
    }
    const grandTotal = Array.from(map.values()).reduce((s, d) => s + d.total, 0)
    return Array.from(map.entries()).map(([k, d]) => ({
        method: labels[k] ?? k, count: d.count, total: d.total,
        percentage: grandTotal > 0 ? Math.round(d.total / grandTotal * 100) : 0,
    }))
}

export async function getStaffPerformance(): Promise<StaffPerformance[]> {
    const todayStart = new Date(new Date().toISOString().split("T")[0])
    const orders = await prisma.order.findMany({
        where: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
        include: { staff: true },
    })

    const map = new Map<string, { name: string; orders: number; revenue: number }>()
    for (const o of orders) {
        const key = o.createdBy
        const existing = map.get(key) ?? { name: o.staff.fullName, orders: 0, revenue: 0 }
        existing.orders++
        existing.revenue += Number(o.totalAmount)
        map.set(key, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).map((d) => ({ ...d, avgTime: 0 }))
}
