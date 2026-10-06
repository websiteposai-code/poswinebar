"use server"

import { prisma } from "@/lib/prisma"

// ============================================================
// NOTIFICATIONS & ALERTS — Prisma version
// Generated from real DB conditions
// ============================================================

export type AlertPriority = "CRITICAL" | "WARNING" | "INFO"
export type AlertCategory = "INVENTORY" | "FINANCE" | "SHIFT" | "CUSTOMER" | "SYSTEM"

export type Notification = {
    id: string; title: string; message: string; priority: AlertPriority; category: AlertCategory
    isRead: boolean; actionUrl: string | null; actionLabel: string | null; createdAt: Date
}

export type AlertRule = { id: string; name: string; description: string; category: AlertCategory; isEnabled: boolean; threshold: string }
export type NotificationStats = { total: number; unread: number; critical: number; warning: number; info: number }

// Generate live notifications from DB state
async function generateLiveNotifications(): Promise<Notification[]> {
    const notifications: Notification[] = []
    const now = new Date()

    // Low stock wines
    const lowStockProducts = await prisma.product.findMany({
        where: { isActive: true, trackInventory: true },
    })
    for (const p of lowStockProducts) {
        const bottleCount = await prisma.wineBottle.count({ where: { productId: p.id, status: "IN_STOCK" } })
        if (bottleCount <= p.lowStockAlert && bottleCount >= 0 && ["WINE_BOTTLE", "WINE_GLASS", "WINE_TASTING"].includes(p.type)) {
            notifications.push({
                id: `low-${p.id}`, title: `Tồn kho thấp — ${p.name}`,
                message: `Chỉ còn ${bottleCount} chai. Ngưỡng cảnh báo: ${p.lowStockAlert}.`,
                priority: bottleCount === 0 ? "CRITICAL" : "WARNING", category: "INVENTORY",
                isRead: false, actionUrl: "/dashboard/inventory", actionLabel: "Xem kho", createdAt: now,
            })
        }
    }

    // Open shifts > 6 hours
    const openShifts = await prisma.shiftRecord.findMany({ where: { closedAt: null }, include: { staff: true } })
    for (const s of openShifts) {
        const hours = (now.getTime() - s.openedAt.getTime()) / 3600000
        if (hours > 6) {
            notifications.push({
                id: `shift-${s.id}`, title: `Ca mở > ${Math.floor(hours)} giờ`,
                message: `Ca của ${s.staff.fullName} mở từ ${s.openedAt.toLocaleTimeString("vi-VN")}. Nhắc đóng ca.`,
                priority: "WARNING", category: "SHIFT",
                isRead: false, actionUrl: "/pos", actionLabel: "Xem ca", createdAt: now,
            })
        }
    }

    // Pending reservations
    const today = new Date(now.toISOString().split("T")[0])
    const pendingReservations = await prisma.reservation.count({ where: { date: today, status: "PENDING" } })
    if (pendingReservations > 0) {
        notifications.push({
            id: `rsv-pending`, title: `${pendingReservations} đặt bàn chờ xác nhận`,
            message: `Có ${pendingReservations} reservation hôm nay chưa được xác nhận.`,
            priority: "INFO", category: "CUSTOMER",
            isRead: false, actionUrl: "/dashboard/reservations", actionLabel: "Xem", createdAt: now,
        })
    }

    return notifications
}

const readIds = new Set<string>()

export async function getNotifications(): Promise<Notification[]> {
    const notifications = await generateLiveNotifications()
    return notifications.map((n) => ({ ...n, isRead: readIds.has(n.id) }))
}

export async function getUnreadNotifications(): Promise<Notification[]> {
    const all = await getNotifications()
    return all.filter((n) => !n.isRead)
}

export async function markAsRead(id: string): Promise<{ success: boolean }> {
    readIds.add(id)
    return { success: true }
}

export async function markAllAsRead(): Promise<{ success: boolean }> {
    const all = await generateLiveNotifications()
    all.forEach((n) => readIds.add(n.id))
    return { success: true }
}

export async function getNotificationStats(): Promise<NotificationStats> {
    const all = await getNotifications()
    return {
        total: all.length,
        unread: all.filter((n) => !n.isRead).length,
        critical: all.filter((n) => n.priority === "CRITICAL").length,
        warning: all.filter((n) => n.priority === "WARNING").length,
        info: all.filter((n) => n.priority === "INFO").length,
    }
}

export async function getAlertRules(): Promise<AlertRule[]> {
    return [
        { id: "rule-1", name: "Tồn kho thấp", description: "Cảnh báo khi số lượng dưới ngưỡng", category: "INVENTORY", isEnabled: true, threshold: "≤ lowStockAlert" },
        { id: "rule-2", name: "Ca mở quá lâu", description: "Cảnh báo khi ca mở > 6 giờ", category: "SHIFT", isEnabled: true, threshold: "> 6 giờ" },
        { id: "rule-3", name: "Đặt bàn chờ xác nhận", description: "Nhắc xác nhận reservation", category: "CUSTOMER", isEnabled: true, threshold: "status = PENDING" },
    ]
}

export async function toggleAlertRule(id: string): Promise<{ success: boolean }> {
    void id // Alert rules are system-defined, toggle is a no-op for now
    return { success: true }
}
