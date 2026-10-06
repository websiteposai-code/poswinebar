/**
 * GAP-05: Receipt API — generates receipt data for thermal printing or PDF.
 * GET /api/export/receipt?orderId=xxx
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
    const orderId = request.nextUrl.searchParams.get("orderId")
    if (!orderId) {
        return NextResponse.json({ error: "orderId required" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: { include: { product: true } },
            payments: true,
            table: true,
            staff: true,
            customer: true,
        },
    })

    if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Format for thermal printer (58mm/80mm) or viewing
    const receipt = {
        // Header
        storeName: "Noon & Noir — Wine Alley",
        storeAddress: "123 Wine Street, Ho Chi Minh City",
        storePhone: "0901 234 567",

        // Order info
        orderNo: order.orderNo,
        orderType: order.orderType,
        tableNumber: order.table?.tableNumber ?? null,
        staffName: order.staff.fullName,
        customerName: order.customer?.name ?? null,
        date: order.openedAt.toISOString(),
        paidAt: order.closedAt?.toISOString() ?? null,

        // Items
        items: order.items.map((item) => ({
            name: item.product?.name ?? "Unknown",
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
            notes: item.notes,
        })),

        // Totals
        subtotal: Number(order.subtotal),
        discount: Number(order.discountAmount),
        discountPct: Number(order.discountPct),
        tax: Number(order.taxAmount),
        total: Number(order.totalAmount),

        // Payments
        payments: order.payments.map((p) => ({
            method: p.method,
            amount: Number(p.amount),
            received: Number(p.receivedAmount),
            change: Number(p.changeAmount),
            ref: p.transactionRef,
        })),

        // Footer
        status: order.status,
        guestCount: order.items.reduce((s, i) => s + i.quantity, 0),
    }

    // Generate text format for thermal printer
    const textReceipt = generateTextReceipt(receipt)

    const format = request.nextUrl.searchParams.get("format") ?? "json"
    if (format === "text") {
        return new NextResponse(textReceipt, {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
    }

    return NextResponse.json({ receipt, text: textReceipt })
}

function generateTextReceipt(r: ReturnType<typeof formatReceipt>): string {
    const W = 40 // Characters wide (58mm printer)
    const line = "─".repeat(W)
    const dline = "═".repeat(W)

    const center = (s: string) => {
        const pad = Math.max(0, Math.floor((W - s.length) / 2))
        return " ".repeat(pad) + s
    }

    const row = (left: string, right: string) => {
        const space = Math.max(1, W - left.length - right.length)
        return left + " ".repeat(space) + right
    }

    const fmt = (n: number) => n.toLocaleString("vi-VN") + "₫"

    const lines: string[] = [
        center(r.storeName),
        center(r.storeAddress),
        center(`ĐT: ${r.storePhone}`),
        dline,
        center("HÓA ĐƠN BÁN HÀNG"),
        line,
        row("Số HĐ:", r.orderNo),
        row("Ngày:", new Date(r.date).toLocaleString("vi-VN")),
        row("Nhân viên:", r.staffName),
        ...(r.tableNumber ? [row("Bàn:", r.tableNumber)] : []),
        ...(r.customerName ? [row("Khách:", r.customerName)] : []),
        row("Loại:", r.orderType === "DINE_IN" ? "Tại quán" : "Mang đi"),
        line,
    ]

    // Items
    for (const item of r.items) {
        lines.push(item.name)
        lines.push(row(`  ${item.quantity} x ${fmt(item.unitPrice)}`, fmt(item.subtotal)))
        if (item.notes) lines.push(`${item.notes}`)
    }

    lines.push(line)
    lines.push(row("Tạm tính:", fmt(r.subtotal)))
    if (r.discount > 0) {
        lines.push(row(`Giảm giá (${r.discountPct}%):`, `-${fmt(r.discount)}`))
    }
    if (r.tax > 0) {
        lines.push(row("Thuế:", fmt(r.tax)))
    }
    lines.push(dline)
    lines.push(row("TỔNG CỘNG:", fmt(r.total)))
    lines.push(dline)

    // Payments
    for (const p of r.payments) {
        const methodVi = p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method
        lines.push(row(methodVi + ":", fmt(p.amount)))
        if (p.change > 0) lines.push(row("Tiền trả lại:", fmt(p.change)))
    }

    lines.push(line)
    lines.push(center("Cảm ơn quý khách!"))
    lines.push(center("Hẹn gặp lại"))
    lines.push("")

    return lines.join("\n")
}

// Type helper
function formatReceipt(r: {
    storeName: string; storeAddress: string; storePhone: string
    orderNo: string; orderType: string; tableNumber: string | null
    staffName: string; customerName: string | null; date: string; paidAt: string | null
    items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number; notes: string | null }>
    subtotal: number; discount: number; discountPct: number; tax: number; total: number
    payments: Array<{ method: string; amount: number; received: number; change: number; ref: string | null }>
    status: string; guestCount: number
}) { return r }
