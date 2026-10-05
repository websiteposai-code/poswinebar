"use server"

import { prisma } from "@/lib/prisma"
import { parallelLimit } from "@/lib/parallel-limit"

// ============================================================
// DAILY P&L REPORT — Prisma version (OPTIMIZED)
// ============================================================

export type PnLExpenseGroup = { category: string; amount: number; items: { description: string; amount: number }[] }
export type DailyPnL = {
    date: string; revenue: number; costOfGoods: number; grossProfit: number; grossMargin: number
    expenses: PnLExpenseGroup[]; totalExpenses: number; netProfit: number; netMargin: number
    orderCount: number; avgOrderValue: number
    topProducts: { name: string; qty: number; revenue: number }[]
    paymentBreakdown: { cash: number; card: number; qr: number }; wasteAndSpoilage: number
}
export type PnLTrend = { date: string; revenue: number; profit: number; orders: number }
export type PnLSummary = {
    today: DailyPnL
    weekAvg: { revenue: number; profit: number; orders: number }
    monthAvg: { revenue: number; profit: number; orders: number }
    revenueChangeVsYesterday: number; profitChangeVsYesterday: number; weeklyTrend: PnLTrend[]
}

async function buildPnL(dateStr: string): Promise<DailyPnL> {
    const start = new Date(dateStr)
    const end = new Date(start.getTime() + 86400000)

    // Run orders + expenses + waste in parallel instead of sequential
    const [orders, expenses, waste] = await Promise.all([
        prisma.order.findMany({
            where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
            include: { items: { include: { product: true } }, payments: true },
        }),
        prisma.fundTransaction.findMany({
            where: { date: { gte: start, lt: end }, transactionType: "EXPENSE" },
        }),
        prisma.stockMovement.aggregate({
            where: { type: { in: ["WASTE", "SPOILAGE", "BREAKAGE"] }, createdAt: { gte: start, lt: end } },
            _sum: { totalCost: true },
        }),
    ])

    const revenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0)
    const costOfGoods = orders.reduce((s, o) => s + o.items.reduce((is, i) => is + Number(i.product.costPrice) * i.quantity, 0), 0)
    const grossProfit = revenue - costOfGoods
    const grossMargin = revenue > 0 ? Math.round(grossProfit / revenue * 1000) / 10 : 0

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const expenseGroups: PnLExpenseGroup[] = []
    const catMap = new Map<string, { amount: number; items: { description: string; amount: number }[] }>()
    for (const e of expenses) {
        const g = catMap.get(e.category) ?? { amount: 0, items: [] }
        g.amount += Number(e.amount)
        g.items.push({ description: e.description ?? e.category, amount: Number(e.amount) })
        catMap.set(e.category, g)
    }
    catMap.forEach((v, k) => expenseGroups.push({ category: k, ...v }))

    const netProfit = grossProfit - totalExpenses
    const netMargin = revenue > 0 ? Math.round(netProfit / revenue * 1000) / 10 : 0

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const o of orders) {
        for (const i of o.items) {
            const p = productMap.get(i.productId) ?? { name: i.product.name, qty: 0, revenue: 0 }
            p.qty += i.quantity
            p.revenue += Number(i.subtotal)
            productMap.set(i.productId, p)
        }
    }
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    let cash = 0, card = 0, qr = 0
    for (const o of orders) {
        for (const p of o.payments) {
            const amt = Number(p.amount)
            if (p.method === "CASH") cash += amt
            else if (p.method === "CARD") card += amt
            else qr += amt
        }
    }

    return {
        date: dateStr, revenue, costOfGoods, grossProfit, grossMargin,
        expenses: expenseGroups, totalExpenses, netProfit, netMargin,
        orderCount: orders.length, avgOrderValue: orders.length > 0 ? Math.round(revenue / orders.length) : 0,
        topProducts, paymentBreakdown: { cash, card, qr },
        wasteAndSpoilage: Number(waste._sum.totalCost ?? 0),
    }
}

export async function getTodayPnL(): Promise<DailyPnL> {
    return buildPnL(new Date().toISOString().split("T")[0])
}

export async function getPnLByDate(date: string): Promise<DailyPnL | null> {
    return buildPnL(date)
}

export async function getPnLSummary(): Promise<PnLSummary> {
    // Build all 7 days + today in PARALLEL instead of sequential loop
    const dates: string[] = []
    for (let i = 6; i >= 0; i--) {
        dates.push(new Date(Date.now() - i * 86400000).toISOString().split("T")[0])
    }

    // Build days with LIMITED concurrency (max 2) to not exhaust pool
    const allPnL = await parallelLimit(dates.map(d => () => buildPnL(d)), 2)

    const todayPnL = allPnL[allPnL.length - 1]
    const weeklyTrend: PnLTrend[] = allPnL.map(pnl => ({
        date: pnl.date, revenue: pnl.revenue, profit: pnl.netProfit, orders: pnl.orderCount,
    }))

    let weekRevenue = 0, weekProfit = 0, weekOrders = 0
    for (const pnl of allPnL) {
        weekRevenue += pnl.revenue; weekProfit += pnl.netProfit; weekOrders += pnl.orderCount
    }

    const yesterdayPnL = weeklyTrend.length >= 2 ? weeklyTrend[weeklyTrend.length - 2] : null
    const revenueChangeVsYesterday = yesterdayPnL && yesterdayPnL.revenue > 0
        ? Math.round((todayPnL.revenue - yesterdayPnL.revenue) / yesterdayPnL.revenue * 1000) / 10 : 0
    const profitChangeVsYesterday = yesterdayPnL && yesterdayPnL.profit > 0
        ? Math.round((todayPnL.netProfit - yesterdayPnL.profit) / yesterdayPnL.profit * 1000) / 10 : 0

    return {
        today: todayPnL,
        weekAvg: { revenue: Math.round(weekRevenue / 7), profit: Math.round(weekProfit / 7), orders: Math.round(weekOrders / 7) },
        monthAvg: { revenue: Math.round(weekRevenue / 7), profit: Math.round(weekProfit / 7), orders: Math.round(weekOrders / 7) },
        revenueChangeVsYesterday, profitChangeVsYesterday, weeklyTrend,
    }
}

export async function getWeeklyPnL(): Promise<DailyPnL[]> {
    // Build all 7 days in PARALLEL
    const dates: string[] = []
    for (let i = 6; i >= 0; i--) {
        dates.push(new Date(Date.now() - i * 86400000).toISOString().split("T")[0])
    }
    return parallelLimit(dates.map(d => () => buildPnL(d)), 2)
}
