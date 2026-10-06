"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ============================================================
// STORE CONFIG — Persisted store info & general settings
// Uses StoreSettings model for core store data
// Uses SystemSetting key-value for receipt/display/notification/system
// ============================================================

export type StoreInfo = {
    storeName: string
    tagline: string
    phone: string
    address: string
    taxId: string
    currency: string
    openTime: string
    closeTime: string
}

const DEFAULT_STORE: StoreInfo = {
    storeName: "Noon & Noir",
    tagline: "Wine Alley",
    phone: "0901234567",
    address: "123 Đường Rượu Vang, Quận 1, TP.HCM",
    taxId: "0123456789",
    currency: "VND",
    openTime: "10:00",
    closeTime: "00:00",
}

export async function getStoreInfo(): Promise<StoreInfo> {
    try {
        const store = await prisma.storeSettings.findFirst()
        if (!store) return { ...DEFAULT_STORE }

        // Get open/close time from SystemSetting
        const timeSetting = await prisma.systemSetting.findUnique({ where: { key: "store_hours" } })
        const hours = timeSetting?.value as { openTime?: string; closeTime?: string } | null

        return {
            storeName: store.storeName,
            tagline: store.tagline,
            phone: store.phone ?? DEFAULT_STORE.phone,
            address: store.address ?? DEFAULT_STORE.address,
            taxId: store.taxId ?? DEFAULT_STORE.taxId,
            currency: store.currency,
            openTime: hours?.openTime ?? DEFAULT_STORE.openTime,
            closeTime: hours?.closeTime ?? DEFAULT_STORE.closeTime,
        }
    } catch {
        return { ...DEFAULT_STORE }
    }
}

export async function updateStoreInfo(data: Partial<StoreInfo>): Promise<{ success: boolean }> {
    try {
        const existing = await prisma.storeSettings.findFirst()
        const { openTime, closeTime, ...storeData } = data

        // Update StoreSettings
        if (Object.keys(storeData).length > 0) {
            if (existing) {
                await prisma.storeSettings.update({
                    where: { id: existing.id },
                    data: {
                        ...(storeData.storeName !== undefined && { storeName: storeData.storeName }),
                        ...(storeData.tagline !== undefined && { tagline: storeData.tagline }),
                        ...(storeData.phone !== undefined && { phone: storeData.phone }),
                        ...(storeData.address !== undefined && { address: storeData.address }),
                        ...(storeData.taxId !== undefined && { taxId: storeData.taxId }),
                        ...(storeData.currency !== undefined && { currency: storeData.currency }),
                    },
                })
            }
        }

        // Update open/close time in SystemSetting
        if (openTime !== undefined || closeTime !== undefined) {
            const current = await prisma.systemSetting.findUnique({ where: { key: "store_hours" } })
            const currentHours = (current?.value as { openTime?: string; closeTime?: string }) ?? {}
            const merged = {
                openTime: openTime ?? currentHours.openTime ?? DEFAULT_STORE.openTime,
                closeTime: closeTime ?? currentHours.closeTime ?? DEFAULT_STORE.closeTime,
            }
            await prisma.systemSetting.upsert({
                where: { key: "store_hours" },
                create: { key: "store_hours", value: merged },
                update: { value: merged },
            })
        }

        revalidatePath("/dashboard/settings")
        return { success: true }
    } catch (error) {
        console.error("[StoreConfig] update failed:", error)
        return { success: false }
    }
}

// ============================================================
// RECEIPT SETTINGS — Persisted via SystemSetting
// ============================================================

export type ReceiptConfig = {
    autoPrint: boolean
    showLogo: boolean
    showFooter: boolean
    footerText: string
    paperWidth: "58" | "80"
}

const DEFAULT_RECEIPT: ReceiptConfig = {
    autoPrint: true,
    showLogo: true,
    showFooter: true,
    footerText: "Cảm ơn quý khách!",
    paperWidth: "80",
}

const RECEIPT_KEY = "receipt_config"

export async function getReceiptConfig(): Promise<ReceiptConfig> {
    try {
        const record = await prisma.systemSetting.findUnique({ where: { key: RECEIPT_KEY } })
        if (record?.value) return { ...DEFAULT_RECEIPT, ...(record.value as object) } as ReceiptConfig
    } catch { /* fallback */ }
    return { ...DEFAULT_RECEIPT }
}

export async function updateReceiptConfig(data: Partial<ReceiptConfig>): Promise<{ success: boolean }> {
    try {
        const current = await getReceiptConfig()
        const merged = JSON.parse(JSON.stringify({ ...current, ...data }))
        await prisma.systemSetting.upsert({
            where: { key: RECEIPT_KEY },
            create: { key: RECEIPT_KEY, value: merged },
            update: { value: merged },
        })
        revalidatePath("/dashboard/settings")
        return { success: true }
    } catch { return { success: false } }
}

// ============================================================
// DISPLAY SETTINGS — Persisted via SystemSetting
// ============================================================

export type DisplayConfig = {
    darkMode: boolean
    compactMode: boolean
    showImages: boolean
    language: "vi" | "en"
    gridCols: "3" | "4" | "5"
}

const DEFAULT_DISPLAY: DisplayConfig = {
    darkMode: false,
    compactMode: false,
    showImages: true,
    language: "vi",
    gridCols: "4",
}

const DISPLAY_KEY = "display_config"

export async function getDisplayConfig(): Promise<DisplayConfig> {
    try {
        const record = await prisma.systemSetting.findUnique({ where: { key: DISPLAY_KEY } })
        if (record?.value) return { ...DEFAULT_DISPLAY, ...(record.value as object) } as DisplayConfig
    } catch { /* fallback */ }
    return { ...DEFAULT_DISPLAY }
}

export async function updateDisplayConfig(data: Partial<DisplayConfig>): Promise<{ success: boolean }> {
    try {
        const current = await getDisplayConfig()
        const merged = JSON.parse(JSON.stringify({ ...current, ...data }))
        await prisma.systemSetting.upsert({
            where: { key: DISPLAY_KEY },
            create: { key: DISPLAY_KEY, value: merged },
            update: { value: merged },
        })
        revalidatePath("/dashboard/settings")
        return { success: true }
    } catch { return { success: false } }
}

// ============================================================
// NOTIFICATION SETTINGS — Persisted via SystemSetting
// ============================================================

export type NotificationConfig = {
    newOrder: boolean
    lowStock: boolean
    kitchenReady: boolean
    dailyReport: boolean
    sound: boolean
}

const DEFAULT_NOTIF: NotificationConfig = {
    newOrder: true,
    lowStock: true,
    kitchenReady: true,
    dailyReport: false,
    sound: true,
}

const NOTIF_KEY = "notification_config"

export async function getNotificationConfig(): Promise<NotificationConfig> {
    try {
        const record = await prisma.systemSetting.findUnique({ where: { key: NOTIF_KEY } })
        if (record?.value) return { ...DEFAULT_NOTIF, ...(record.value as object) } as NotificationConfig
    } catch { /* fallback */ }
    return { ...DEFAULT_NOTIF }
}

export async function updateNotificationConfig(data: Partial<NotificationConfig>): Promise<{ success: boolean }> {
    try {
        const current = await getNotificationConfig()
        const merged = JSON.parse(JSON.stringify({ ...current, ...data }))
        await prisma.systemSetting.upsert({
            where: { key: NOTIF_KEY },
            create: { key: NOTIF_KEY, value: merged },
            update: { value: merged },
        })
        revalidatePath("/dashboard/settings")
        return { success: true }
    } catch { return { success: false } }
}

// ============================================================
// SYSTEM SETTINGS — Persisted via SystemSetting
// ============================================================

export type SystemConfig = {
    autoBackup: boolean
    sessionTimeout: "15" | "30" | "60" | "0"
}

const DEFAULT_SYSTEM: SystemConfig = {
    autoBackup: true,
    sessionTimeout: "30",
}

const SYSTEM_KEY = "system_config"

export async function getSystemConfig(): Promise<SystemConfig> {
    try {
        const record = await prisma.systemSetting.findUnique({ where: { key: SYSTEM_KEY } })
        if (record?.value) return { ...DEFAULT_SYSTEM, ...(record.value as object) } as SystemConfig
    } catch { /* fallback */ }
    return { ...DEFAULT_SYSTEM }
}

export async function updateSystemConfig(data: Partial<SystemConfig>): Promise<{ success: boolean }> {
    try {
        const current = await getSystemConfig()
        const merged = JSON.parse(JSON.stringify({ ...current, ...data }))
        await prisma.systemSetting.upsert({
            where: { key: SYSTEM_KEY },
            create: { key: SYSTEM_KEY, value: merged },
            update: { value: merged },
        })
        revalidatePath("/dashboard/settings")
        return { success: true }
    } catch { return { success: false } }
}
