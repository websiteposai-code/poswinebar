"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ============================================================
// INVOICE TYPES & CONFIGURATION
// ============================================================

export type InvoiceConfig = {
    enableQrInvoice: boolean          // Bật/tắt in mã QR xuất HĐ trên bill nhiệt
    sellerCompanyName: string         // Tên công ty / đơn vị xuất HĐ của quán
    sellerTaxCode: string             // Mã số thuế của quán
    sellerAddress: string             // Địa chỉ trụ sở của quán
    sellerEmail: string               // Email kế toán / phát hành HĐ
    requestExpireHours: number        // Hạn chót quét mã gửi yêu cầu (mặc định 48h)
    vatRate: number                   // Tỷ lệ thuế VAT mặc định (%)
}

export type InvoiceRequestStatus = "PENDING" | "ISSUED" | "REJECTED"

export type InvoiceRequest = {
    id: string
    orderId: string
    orderNumber: string
    tableNumber: string | null
    orderTotal: number
    orderSubtotal: number
    vatAmount: number
    orderDate: string
    customerTaxCode: string           // Mã số thuế khách hàng
    companyName: string               // Tên công ty của khách
    companyAddress: string            // Địa chỉ công ty khách
    recipientEmail: string            // Email nhận hoá đơn điện tử
    recipientName?: string            // Họ tên người nhận
    recipientPhone?: string           // Số điện thoại liên hệ
    notes?: string                    // Ghi chú thêm
    status: InvoiceRequestStatus
    eInvoiceNumber?: string           // Ký hiệu & Số hoá đơn khi kế toán đã xuất
    issuedAt?: string
    rejectedReason?: string
    createdAt: string
    source: "QR_CUSTOMER" | "POS_CASHIER"
}

const DEFAULT_INVOICE_CONFIG: InvoiceConfig = {
    enableQrInvoice: true,
    sellerCompanyName: "CÔNG TY TNHH NOON & NOIR WINE BAR",
    sellerTaxCode: "0318999888",
    sellerAddress: "123 Ngõ Rượu Vang, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    sellerEmail: "accounting@noonnoir.vn",
    requestExpireHours: 48,
    vatRate: 10,
}

const INVOICE_CONFIG_KEY = "invoice_config"
const INVOICE_REQUESTS_KEY = "invoice_requests_list"

// ============================================================
// CONFIG GET / UPDATE
// ============================================================

export async function getInvoiceConfig(): Promise<InvoiceConfig> {
    try {
        const record = await prisma.systemSetting.findUnique({
            where: { key: INVOICE_CONFIG_KEY },
        })
        if (record?.value) {
            return { ...DEFAULT_INVOICE_CONFIG, ...(record.value as object) } as InvoiceConfig
        }
    } catch {
        // fallback
    }
    return { ...DEFAULT_INVOICE_CONFIG }
}

export async function updateInvoiceConfig(data: Partial<InvoiceConfig>): Promise<{ success: boolean; error?: string }> {
    try {
        const current = await getInvoiceConfig()
        const merged = { ...current, ...data }
        await prisma.systemSetting.upsert({
            where: { key: INVOICE_CONFIG_KEY },
            create: { key: INVOICE_CONFIG_KEY, value: merged },
            update: { value: merged },
        })
        revalidatePath("/dashboard/settings")
        revalidatePath("/dashboard/invoices")
        return { success: true }
    } catch (e) {
        return { success: false, error: (e as Error).message }
    }
}

// ============================================================
// TAX LOOKUP HELPER (Tra cứu thông tin doanh nghiệp qua MST)
// ============================================================

export async function lookupCompanyByTaxCode(taxCode: string): Promise<{
    success: boolean
    data?: {
        name: string
        address: string
        taxCode: string
    }
    error?: string
}> {
    const cleanTax = taxCode.trim().replace(/[^0-9-]/g, "")
    if (!cleanTax || cleanTax.length < 10) {
        return { success: false, error: "Mã số thuế không hợp lệ (tối thiểu 10 ký tự)" }
    }

    try {
        // Query VietQR Open Business API
        const res = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(cleanTax)}`, {
            headers: { "Content-Type": "application/json" },
            next: { revalidate: 86400 }, // cache 24h
        })

        if (!res.ok) {
            return { success: false, error: "Không tìm thấy thông tin cho mã số thuế này" }
        }

        const json = await res.json()
        if (json.code === "00" && json.data?.name) {
            return {
                success: true,
                data: {
                    name: json.data.name,
                    address: json.data.address ?? "",
                    taxCode: cleanTax,
                },
            }
        }

        return { success: false, error: json.desc ?? "Không tìm thấy doanh nghiệp tương ứng" }
    } catch {
        return { success: false, error: "Lỗi kết nối tới cơ sở dữ liệu tra cứu thuế" }
    }
}

// ============================================================
// INVOICE REQUESTS STORE & RETRIEVAL
// ============================================================

async function getStoredRequests(): Promise<InvoiceRequest[]> {
    try {
        const record = await prisma.systemSetting.findUnique({
            where: { key: INVOICE_REQUESTS_KEY },
        })
        if (record?.value && Array.isArray(record.value)) {
            return record.value as InvoiceRequest[]
        }
    } catch {
        // fallback
    }
    return []
}

async function saveStoredRequests(list: InvoiceRequest[]): Promise<void> {
    await prisma.systemSetting.upsert({
        where: { key: INVOICE_REQUESTS_KEY },
        create: { key: INVOICE_REQUESTS_KEY, value: list },
        update: { value: list },
    })
}

// Public: Get Order Details for Customer QR Portal
export async function getOrderForInvoicePortal(orderNoOrId: string): Promise<{
    success: boolean
    order?: {
        id: string
        orderNo: string
        orderNumber: string
        orderType: string
        tableNumber: string | null
        subtotal: number
        discount: number
        tax: number
        total: number
        openedAt: string
        createdAt: string
        closedAt: string | null
        items: Array<{ id: string; name: string; productName: string; quantity: number; unitPrice: number; total: number; totalPrice: number }>
        isExpired: boolean
        hoursLeft: number
        existingRequest?: InvoiceRequest | null
    }
    existingRequest?: InvoiceRequest | null
    error?: string
}> {
    try {
        const order = await prisma.order.findFirst({
            where: {
                OR: [{ id: orderNoOrId }, { orderNo: orderNoOrId }],
            },
            include: {
                items: { include: { product: true } },
                table: true,
            },
        })

        if (!order) {
            return { success: false, error: "Không tìm thấy hoá đơn này trên hệ thống" }
        }

        const config = await getInvoiceConfig()
        const orderTime = (order.closedAt ?? order.openedAt).getTime()
        const maxTime = orderTime + config.requestExpireHours * 3600 * 1000
        const isExpired = Date.now() > maxTime
        const hoursLeft = Math.max(0, Math.round((maxTime - Date.now()) / (3600 * 1000)))

        // Check if already requested
        const requests = await getStoredRequests()
        const existing = requests.find(r => r.orderId === order.id || r.orderNumber === order.orderNo) ?? null

        return {
            success: true,
            existingRequest: existing,
            order: {
                id: order.id,
                orderNo: order.orderNo,
                orderNumber: order.orderNo,
                orderType: order.orderType,
                tableNumber: order.table?.tableNumber ?? null,
                subtotal: Number(order.subtotal),
                discount: Number(order.discountAmount),
                tax: Number(order.taxAmount),
                total: Number(order.totalAmount),
                openedAt: order.openedAt.toISOString(),
                createdAt: order.openedAt.toISOString(),
                closedAt: order.closedAt?.toISOString() ?? null,
                items: order.items.map(i => ({
                    id: i.id,
                    name: i.product?.name ?? "Sản phẩm",
                    productName: i.product?.name ?? "Sản phẩm",
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    total: Number(i.subtotal || Number(i.unitPrice) * i.quantity),
                    totalPrice: Number(i.subtotal || Number(i.unitPrice) * i.quantity),
                })),
                isExpired,
                hoursLeft,
                existingRequest: existing,
            },
        }
    } catch (e) {
        return { success: false, error: (e as Error).message }
    }
}

// Submit a new Invoice Request (From QR Portal or Cashier)
export async function submitInvoiceRequest(params: {
    orderId: string
    orderNumber: string
    tableNumber?: string | null
    orderTotal: number
    orderSubtotal: number
    vatAmount: number
    orderDate: string
    customerTaxCode: string
    companyName: string
    companyAddress: string
    recipientEmail: string
    recipientName?: string
    recipientPhone?: string
    notes?: string
    source?: "QR_CUSTOMER" | "POS_CASHIER"
}): Promise<{ success: boolean; data?: InvoiceRequest; error?: string }> {
    if (!params.customerTaxCode.trim()) {
        return { success: false, error: "Vui lòng nhập Mã số thuế doanh nghiệp" }
    }
    if (!params.companyName.trim()) {
        return { success: false, error: "Vui lòng nhập Tên công ty / đơn vị" }
    }
    if (!params.recipientEmail.trim() || !params.recipientEmail.includes("@")) {
        return { success: false, error: "Vui lòng nhập Email hợp lệ để nhận hoá đơn" }
    }

    try {
        const requests = await getStoredRequests()
        // Check if already submitted
        const existingIndex = requests.findIndex(
            r => r.orderId === params.orderId || r.orderNumber === params.orderNumber
        )

        const newRequest: InvoiceRequest = {
            id: `inv-req-${Date.now()}`,
            orderId: params.orderId,
            orderNumber: params.orderNumber,
            tableNumber: params.tableNumber ?? null,
            orderTotal: params.orderTotal,
            orderSubtotal: params.orderSubtotal,
            vatAmount: params.vatAmount,
            orderDate: params.orderDate,
            customerTaxCode: params.customerTaxCode.trim(),
            companyName: params.companyName.trim(),
            companyAddress: params.companyAddress.trim(),
            recipientEmail: params.recipientEmail.trim(),
            recipientName: params.recipientName?.trim(),
            recipientPhone: params.recipientPhone?.trim(),
            notes: params.notes?.trim(),
            status: "PENDING",
            createdAt: new Date().toISOString(),
            source: params.source ?? "QR_CUSTOMER",
        }

        if (existingIndex >= 0) {
            // Update existing request
            requests[existingIndex] = { ...requests[existingIndex], ...newRequest, id: requests[existingIndex].id }
        } else {
            requests.unshift(newRequest)
        }

        await saveStoredRequests(requests)

        // Log audit
        try {
            await prisma.auditLog.create({
                data: {
                    action: "INVOICE_REQUEST",
                    tableName: "order",
                    recordId: params.orderId,
                    newData: {
                        orderNo: params.orderNumber,
                        taxCode: params.customerTaxCode,
                        company: params.companyName,
                        email: params.recipientEmail,
                        source: params.source ?? "QR_CUSTOMER",
                    },
                },
            })
        } catch {
            // ignore audit log failure
        }

        revalidatePath("/dashboard/invoices")
        return { success: true, data: newRequest }
    } catch (e) {
        return { success: false, error: (e as Error).message }
    }
}

// Get all invoice requests for Accountant / Dashboard
export async function getInvoiceRequests(status?: InvoiceRequestStatus): Promise<InvoiceRequest[]> {
    const list = await getStoredRequests()
    if (status) {
        return list.filter(r => r.status === status)
    }
    return list
}

// Update request status (Accountant action)
export async function updateInvoiceRequestStatus(params: {
    requestId: string
    status: InvoiceRequestStatus
    eInvoiceNumber?: string
    rejectedReason?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const list = await getStoredRequests()
        const index = list.findIndex(r => r.id === params.requestId)
        if (index === -1) {
            return { success: false, error: "Không tìm thấy yêu cầu xuất hoá đơn" }
        }

        list[index] = {
            ...list[index],
            status: params.status,
            eInvoiceNumber: params.eInvoiceNumber ?? list[index].eInvoiceNumber,
            rejectedReason: params.rejectedReason ?? list[index].rejectedReason,
            issuedAt: params.status === "ISSUED" ? new Date().toISOString() : list[index].issuedAt,
        }

        await saveStoredRequests(list)
        revalidatePath("/dashboard/invoices")
        return { success: true }
    } catch (e) {
        return { success: false, error: (e as Error).message }
    }
}
