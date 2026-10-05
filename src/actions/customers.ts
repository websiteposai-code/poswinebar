"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { calculateTier, type CustomerTier } from "@/lib/customer-tiers"
import { withRbac } from "@/lib/with-rbac"

// ============================================================
// CRM & CUSTOMER MANAGEMENT — Enhanced
// ============================================================

export async function getAllCustomers(): Promise<CustomerProfile[]> {
    const customers = await prisma.customer.findMany({
        where: { isActive: true },
        orderBy: { totalSpent: "desc" },
        include: {
            orders: {
                where: { status: "PAID" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true },
            },
            _count: { select: { orders: { where: { status: "PAID" } } } },
        },
    })
    return customers.map((c) => ({
        id: c.id,
        name: c.name,
        fullName: c.name,
        phone: c.phone,
        email: c.email,
        birthday: c.birthday,
        tier: (c.tier || "REGULAR") as CustomerTier,
        totalSpent: Number(c.totalSpent),
        loyaltyPts: c.loyaltyPts,
        loyaltyPoints: c.loyaltyPts,
        visitCount: c._count.orders,
        orderCount: c._count.orders,
        lastVisit: c.orders[0]?.createdAt ?? null,
        notes: c.notes,
        winePreferences: [],
        allergies: [],
        orderHistory: [],
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    }))
}

export async function getCustomerProfile(id: string): Promise<CustomerDetailProfile | null> {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id },
            include: {
                orders: {
                    where: { status: "PAID" },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                    include: {
                        items: { include: { product: true } },
                        payments: true,
                    },
                },
                _count: { select: { orders: { where: { status: "PAID" } } } },
            },
        })
        if (!customer) return null

        // Calculate favorite products
        const productFrequency: Record<string, { name: string; count: number; total: number }> = {}
        for (const order of customer.orders) {
            for (const item of order.items) {
                const key = item.productId
                if (!productFrequency[key]) productFrequency[key] = { name: item.product.name, count: 0, total: 0 }
                productFrequency[key].count += item.quantity
                productFrequency[key].total += Number(item.subtotal)
            }
        }
        const favoriteProducts = Object.values(productFrequency)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)

        // Calculate average order value
        const totalSpent = Number(customer.totalSpent)
        const orderCount = customer._count.orders
        const avgOrderValue = orderCount > 0 ? Math.round(totalSpent / orderCount) : 0

        // RFM analysis
        const lastOrderDate = customer.orders[0]?.createdAt ?? customer.createdAt
        const daysSinceLastVisit = Math.floor((Date.now() - lastOrderDate.getTime()) / 86400000)

        let recencyScore: "HIGH" | "MEDIUM" | "LOW"
        if (daysSinceLastVisit <= 14) recencyScore = "HIGH"
        else if (daysSinceLastVisit <= 45) recencyScore = "MEDIUM"
        else recencyScore = "LOW"

        let frequencyScore: "HIGH" | "MEDIUM" | "LOW"
        if (orderCount >= 10) frequencyScore = "HIGH"
        else if (orderCount >= 3) frequencyScore = "MEDIUM"
        else frequencyScore = "LOW"

        let monetaryScore: "HIGH" | "MEDIUM" | "LOW"
        if (totalSpent >= 5000000) monetaryScore = "HIGH"
        else if (totalSpent >= 1000000) monetaryScore = "MEDIUM"
        else monetaryScore = "LOW"

        return {
            id: customer.id,
            name: customer.name,
            fullName: customer.name,
            phone: customer.phone,
            email: customer.email,
            birthday: customer.birthday,
            tier: (customer.tier || "REGULAR") as CustomerTier,
            totalSpent,
            loyaltyPts: customer.loyaltyPts,
            loyaltyPoints: customer.loyaltyPts,
            visitCount: orderCount,
            orderCount,
            lastVisit: customer.orders[0]?.createdAt ?? null,
            notes: customer.notes,
            winePreferences: [],
            allergies: [],
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
            // Enhanced fields
            avgOrderValue,
            daysSinceLastVisit,
            favoriteProducts,
            rfm: { recency: recencyScore, frequency: frequencyScore, monetary: monetaryScore },
            orderHistory: customer.orders.map((o) => ({
                id: o.id,
                orderNumber: o.orderNo,
                date: o.createdAt,
                items: o.items.map((i) => `${i.product.name} x${i.quantity}`),
                total: Number(o.totalAmount),
                paymentMethod: o.payments[0]?.method ?? "CASH",
                staffName: "",
            })),
        }
    } catch {
        return null
    }
}

export async function searchCRMCustomers(query: string) {
    if (!query || query.length < 2) return []

    const customers = await prisma.customer.findMany({
        where: {
            isActive: true,
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { phone: { contains: query } },
                { email: { contains: query, mode: "insensitive" } },
            ],
        },
        take: 20,
        include: { _count: { select: { orders: { where: { status: "PAID" } } } } },
    })

    return customers.map((c) => ({
        id: c.id,
        name: c.name,
        fullName: c.name,
        phone: c.phone,
        email: c.email,
        birthday: c.birthday,
        tier: (c.tier || "REGULAR") as CustomerTier,
        totalSpent: Number(c.totalSpent),
        loyaltyPts: c.loyaltyPts,
        loyaltyPoints: c.loyaltyPts,
        visitCount: c._count.orders,
        orderCount: c._count.orders,
        lastVisit: null as Date | null,
        notes: c.notes,
        winePreferences: [] as string[],
        allergies: [] as string[],
        orderHistory: [],
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    }))
}

export async function createCustomer(params: {
    fullName: string
    phone: string
    email?: string
    birthday?: string
    notes?: string
    winePreferences?: string[]
}) {
    const guard = await withRbac("customers", "create")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        const customer = await prisma.customer.create({
            data: {
                name: params.fullName,
                phone: params.phone,
                email: params.email,
                birthday: params.birthday ? new Date(params.birthday) : undefined,
                notes: params.notes,
                tier: "REGULAR",
            },
        })
        revalidatePath("/dashboard/customers")
        return {
            success: true,
            data: { ...customer, totalSpent: Number(customer.totalSpent), fullName: customer.name },
        }
    } catch {
        return { success: false }
    }
}

export async function updateCustomerNotes(id: string, notes: string) {
    const guard = await withRbac("customers", "edit")
    if (!guard.ok) return { success: false, error: guard.error }

    try {
        await prisma.customer.update({ where: { id }, data: { notes } })
        revalidatePath("/dashboard/customers")
        return { success: true }
    } catch {
        return { success: false }
    }
}

/**
 * Auto-upgrade customer tier based on totalSpent
 */
export async function syncCustomerTier(customerId: string) {
    try {
        const customer = await prisma.customer.findUnique({ where: { id: customerId } })
        if (!customer) return
        const newTier = calculateTier(Number(customer.totalSpent))
        if (newTier !== customer.tier) {
            await prisma.customer.update({ where: { id: customerId }, data: { tier: newTier } })
        }
    } catch { /* invalid UUID or DB error */ }
}

export async function getCustomerStats(preloaded?: CustomerProfile[]): Promise<CustomerStats> {
    if (preloaded) {
        const totalRevenue = preloaded.reduce((s, c) => s + Number(c.totalSpent), 0)
        const totalOrders = preloaded.reduce((s, c) => s + (c.visitCount ?? c.orderCount ?? 0), 0)

        const byTier: Record<string, number> = { REGULAR: 0, SILVER: 0, GOLD: 0, PLATINUM: 0, VIP: 0 }
        preloaded.forEach((c) => { byTier[c.tier] = (byTier[c.tier] || 0) + 1 })

        const topSpenders = [...preloaded]
            .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
            .slice(0, 5)
            .map((c) => ({ name: c.name, spent: Number(c.totalSpent), tier: c.tier, orders: c.visitCount ?? c.orderCount ?? 0 }))

        // RFM segmentation
        const now = Date.now()
        let activeCount = 0, atRiskCount = 0, lostCount = 0
        for (const c of preloaded) {
            const lastVisit = c.lastVisit ? new Date(c.lastVisit) : null
            if (!lastVisit) { lostCount++; continue }
            const days = Math.floor((now - lastVisit.getTime()) / 86400000)
            if (days <= 30) activeCount++
            else if (days <= 90) atRiskCount++
            else lostCount++
        }

        return {
            totalCustomers: preloaded.length,
            byTier,
            totalRevenue,
            totalOrders,
            avgSpendPerVisit: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
            avgOrdersPerCustomer: preloaded.length > 0 ? Math.round((totalOrders / preloaded.length) * 10) / 10 : 0,
            monthlyNew: preloaded.filter((c) => {
                const d = new Date()
                const cd = new Date(c.createdAt)
                return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear()
            }).length,
            topSpenders,
            segments: { active: activeCount, atRisk: atRiskCount, lost: lostCount },
        }
    }

    const customers = await prisma.customer.findMany({
        where: { isActive: true },
        include: {
            orders: {
                where: { status: "PAID" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true },
            },
            _count: { select: { orders: { where: { status: "PAID" } } } },
        },
    })

    const totalRevenue = customers.reduce((s, c) => s + Number(c.totalSpent), 0)
    const totalOrders = customers.reduce((s, c) => s + c._count.orders, 0)

    const byTier: Record<string, number> = { REGULAR: 0, SILVER: 0, GOLD: 0, PLATINUM: 0, VIP: 0 }
    customers.forEach((c) => { byTier[c.tier] = (byTier[c.tier] || 0) + 1 })

    const topSpenders = customers
        .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
        .slice(0, 5)
        .map((c) => ({ name: c.name, spent: Number(c.totalSpent), tier: c.tier, orders: c._count.orders }))

    // RFM segmentation
    const now = Date.now()
    let activeCount = 0, atRiskCount = 0, lostCount = 0
    for (const c of customers) {
        const lastVisit = c.orders[0]?.createdAt
        if (!lastVisit) { lostCount++; continue }
        const days = Math.floor((now - lastVisit.getTime()) / 86400000)
        if (days <= 30) activeCount++
        else if (days <= 90) atRiskCount++
        else lostCount++
    }

    return {
        totalCustomers: customers.length,
        byTier,
        totalRevenue,
        totalOrders,
        avgSpendPerVisit: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        avgOrdersPerCustomer: customers.length > 0 ? Math.round((totalOrders / customers.length) * 10) / 10 : 0,
        monthlyNew: customers.filter((c) => {
            const d = new Date()
            return c.createdAt.getMonth() === d.getMonth() && c.createdAt.getFullYear() === d.getFullYear()
        }).length,
        topSpenders,
        segments: { active: activeCount, atRisk: atRiskCount, lost: lostCount },
    }
}

// NOTE: calculateTier, TIER_THRESHOLDS, CustomerTier are exported from @/lib/customer-tiers directly
// "use server" files can only export async functions — do not re-export constants here

export type CustomerProfile = {
    id: string; name: string; fullName?: string; phone: string | null; email: string | null
    tier: "REGULAR" | "SILVER" | "GOLD" | "PLATINUM" | "VIP"; totalSpent: number; loyaltyPts: number; loyaltyPoints?: number
    visitCount?: number; orderCount?: number; lastVisit?: Date | null
    notes: string | null; birthday?: Date | null
    winePreferences?: string[]; allergies?: string[]
    orderHistory?: Array<{ id: string; orderNumber: string; date: Date; items: string[]; total: number; paymentMethod: string; staffName: string }>
    createdAt: Date; updatedAt: Date
}

export type CustomerDetailProfile = CustomerProfile & {
    avgOrderValue: number
    daysSinceLastVisit: number
    favoriteProducts: Array<{ name: string; count: number; total: number }>
    rfm: { recency: "HIGH" | "MEDIUM" | "LOW"; frequency: "HIGH" | "MEDIUM" | "LOW"; monetary: "HIGH" | "MEDIUM" | "LOW" }
}

export type CustomerStats = {
    totalCustomers: number
    byTier: Record<string, number>
    totalRevenue: number
    totalOrders: number
    avgSpendPerVisit: number
    avgOrdersPerCustomer: number
    monthlyNew: number
    topSpenders: Array<{ name: string; spent: number; tier: string; orders: number }>
    segments: { active: number; atRisk: number; lost: number }
}
