"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ============================================================
// QR PAYMENT — VietQR integration
// Bank config persisted in SystemSetting (key: "bank_config")
// QR generation is real (uses VietQR API)
// ============================================================

export type QRPaymentConfig = {
    bankId: string; bankName: string; bankLogo: string
    accountNumber: string; accountName: string; template: "compact" | "print" | "compact2"
}

export type QRPaymentRequest = {
    id: string; orderId: string; amount: number; description: string; qrDataUrl: string
    status: "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED"
    createdAt: Date; expiresAt: Date; confirmedAt: Date | null
}

const DEFAULT_BANK: QRPaymentConfig = {
    bankId: "970422", bankName: "MB Bank", bankLogo: "",
    accountNumber: "0388899999", accountName: "NOON AND NOIR CO LTD", template: "compact2",
}

const BANK_KEY = "bank_config"
const QR_PAYMENTS: QRPaymentRequest[] = []

export async function getBankConfig(): Promise<QRPaymentConfig> {
    try {
        const record = await prisma.systemSetting.findUnique({ where: { key: BANK_KEY } })
        if (record?.value) return { ...DEFAULT_BANK, ...(record.value as object) } as QRPaymentConfig
    } catch { /* fallback */ }
    return { ...DEFAULT_BANK }
}

export async function generateQRPayment(params: {
    orderId: string; amount: number; description: string
}): Promise<{ success: boolean; data?: QRPaymentRequest }> {
    const config = await getBankConfig()
    const addInfo = encodeURIComponent(params.description)
    const qrUrl = `https://img.vietqr.io/image/${config.bankId}-${config.accountNumber}-${config.template}.png?amount=${params.amount}&addInfo=${addInfo}&accountName=${encodeURIComponent(config.accountName)}`

    const payment: QRPaymentRequest = {
        id: `qr-${Date.now()}`, orderId: params.orderId, amount: params.amount,
        description: params.description, qrDataUrl: qrUrl, status: "PENDING",
        createdAt: new Date(), expiresAt: new Date(Date.now() + 10 * 60 * 1000), confirmedAt: null,
    }
    QR_PAYMENTS.push(payment)
    return { success: true, data: payment }
}

export async function checkQRPaymentStatus(paymentId: string): Promise<{
    status: "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED"; confirmedAt: Date | null
}> {
    const payment = QR_PAYMENTS.find((p) => p.id === paymentId)
    if (!payment) return { status: "EXPIRED", confirmedAt: null }
    if (payment.status === "PENDING" && new Date() > payment.expiresAt) payment.status = "EXPIRED"
    return { status: payment.status, confirmedAt: payment.confirmedAt }
}

export async function confirmQRPayment(paymentId: string): Promise<{ success: boolean }> {
    const payment = QR_PAYMENTS.find((p) => p.id === paymentId)
    if (!payment || payment.status !== "PENDING") return { success: false }
    payment.status = "CONFIRMED"
    payment.confirmedAt = new Date()
    return { success: true }
}

export async function cancelQRPayment(paymentId: string): Promise<{ success: boolean }> {
    const payment = QR_PAYMENTS.find((p) => p.id === paymentId)
    if (!payment || payment.status !== "PENDING") return { success: false }
    payment.status = "CANCELLED"
    return { success: true }
}

export async function updateBankConfig(config: Partial<QRPaymentConfig>): Promise<{ success: boolean }> {
    try {
        const current = await getBankConfig()
        const merged = JSON.parse(JSON.stringify({ ...current, ...config }))
        await prisma.systemSetting.upsert({
            where: { key: BANK_KEY },
            create: { key: BANK_KEY, value: merged },
            update: { value: merged },
        })
        revalidatePath("/dashboard/settings")
        return { success: true }
    } catch { return { success: false } }
}
