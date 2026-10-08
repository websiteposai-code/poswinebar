// Order serialization helper (non-server-action)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeOrder(order: any) {
    if (!order) return null
    return {
        id: order.id,
        orderNumber: order.orderNo,
        tableId: order.tableId,
        tableNumber: order.table?.tableNumber ?? null,
        orderType: order.orderType,
        status: order.status,
        items: (order.items ?? []).map((item: any) => ({
            id: item.id,
            productId: item.productId,
            productName: item.product?.name ?? "",
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
            notes: item.notes ?? null,
            status: item.status ?? "PENDING",
            productType: item.product?.type ?? "OTHER",
        })),
        subtotal: Number(order.subtotal),
        discount: Number(order.discountAmount),
        tax: Number(order.taxAmount),
        total: Number(order.totalAmount),
        paymentMethod: order.payments?.[0]?.method ?? null,
        paidAt: order.closedAt,
        staffId: order.createdBy,
        staffName: order.staff?.fullName ?? "",
        guestCount: 0,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    }
}
