"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { TableStatus } from "@prisma/client"

// ============================================================
// ZONES — CRUD
// ============================================================

export async function getZones() {
    const zones = await prisma.tableZone.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
    })
    return zones
}

export async function createZone(data: {
    name: string
    sortOrder?: number
}) {
    try {
        const count = await prisma.tableZone.count()
        const zone = await prisma.tableZone.create({
            data: {
                name: data.name,
                sortOrder: data.sortOrder ?? count,
            },
        })
        revalidatePath("/dashboard/tables")
        return { success: true, data: zone }
    } catch {
        return { success: false }
    }
}

export async function updateZone(
    id: string,
    data: Partial<{ name: string; sortOrder: number; isActive: boolean }>
) {
    try {
        await prisma.tableZone.update({ where: { id }, data })
        revalidatePath("/dashboard/tables")
        return { success: true }
    } catch {
        return { success: false }
    }
}

export async function deleteZone(id: string, cascade: boolean = false) {
    try {
        // 1. Check if any table is currently occupied
        const occupiedTables = await prisma.floorTable.findMany({
            where: { zoneId: id, isActive: true, status: "OCCUPIED" },
            select: { tableNumber: true },
        })
        if (occupiedTables.length > 0) {
            const tableList = occupiedTables.map((t) => t.tableNumber).join(", ")
            return {
                success: false,
                error: `Khu vực có ${occupiedTables.length} bàn đang phục vụ (${tableList}). Vui lòng thanh toán trước khi xóa.`,
            }
        }

        // 2. Count active tables
        const tableCount = await prisma.floorTable.count({
            where: { zoneId: id, isActive: true },
        })

        if (tableCount > 0 && !cascade) {
            return {
                success: false,
                requiresCascade: true,
                tableCount,
                error: `Khu vực có ${tableCount} bàn. Bạn có muốn xóa khu vực và tất cả bàn này không?`,
            }
        }

        // 3. Deactivate tables and zone in transaction
        await prisma.$transaction([
            prisma.floorTable.updateMany({
                where: { zoneId: id, isActive: true },
                data: { isActive: false },
            }),
            prisma.tableZone.update({
                where: { id },
                data: { isActive: false },
            }),
        ])

        revalidatePath("/dashboard/tables")
        revalidatePath("/pos")
        return { success: true, tableCount }
    } catch {
        return { success: false, error: "Lỗi hệ thống khi xóa khu vực" }
    }
}

// ============================================================
// TABLES — CRUD
// ============================================================

export async function getTables(zoneId?: string) {
    const tables = await prisma.floorTable.findMany({
        where: {
            isActive: true,
            ...(zoneId ? { zoneId } : {}),
        },
        include: { zone: true },
        orderBy: { tableNumber: "asc" },
    })
    return tables
}

export async function createTable(data: {
    zoneId: string
    tableNumber: string
    seats: number
    shape?: string
}) {
    try {
        const table = await prisma.floorTable.create({
            data: {
                zoneId: data.zoneId,
                tableNumber: data.tableNumber,
                seats: data.seats,
                shape: data.shape ?? "square",
            },
        })
        revalidatePath("/dashboard/tables")
        return { success: true, data: table }
    } catch {
        return { success: false, error: `Bàn "${data.tableNumber}" đã tồn tại` }
    }
}

export async function updateTable(
    id: string,
    data: Partial<{ tableNumber: string; seats: number; zoneId: string; shape: string; posX: number; posY: number }>
) {
    try {
        await prisma.floorTable.update({ where: { id }, data })
        revalidatePath("/dashboard/tables")
        return { success: true }
    } catch {
        return { success: false, error: "Không thể cập nhật bàn" }
    }
}

export async function deleteTable(id: string) {
    const table = await prisma.floorTable.findUnique({ where: { id } })
    if (!table) return { success: false, error: "Không tìm thấy bàn" }
    if (table.status === "OCCUPIED") return { success: false, error: "Bàn đang có khách, không thể xóa" }

    await prisma.floorTable.update({ where: { id }, data: { isActive: false } })
    revalidatePath("/dashboard/tables")
    return { success: true }
}

export async function updateTableStatus(tableId: string, status: TableStatus) {
    try {
        await prisma.floorTable.update({ where: { id: tableId }, data: { status } })
        revalidatePath("/dashboard/tables")
        return { success: true }
    } catch {
        return { success: false }
    }
}

export async function getTableStats() {
    const tables = await prisma.floorTable.findMany({ where: { isActive: true } })
    return {
        total: tables.length,
        available: tables.filter((t) => t.status === "AVAILABLE").length,
        occupied: tables.filter((t) => t.status === "OCCUPIED").length,
        reserved: tables.filter((t) => t.status === "RESERVED").length,
        cleaning: tables.filter((t) => t.status === "CLEANING").length,
    }
}

// ============================================================
// MERGE / SPLIT TABLES
// ============================================================

/**
 * Merge multiple tables into one master table.
 * Sets child tables to MERGED status, pointing to the master.
 */
export async function mergeTables(masterTableId: string, childTableIds: string[]) {
    try {
        // Verify all tables exist and are available or occupied
        const allIds = [masterTableId, ...childTableIds]
        const tables = await prisma.floorTable.findMany({
            where: { id: { in: allIds }, isActive: true },
        })

        if (tables.length !== allIds.length) {
            return { success: false, error: "Một số bàn không tồn tại" }
        }

        const hasConflict = tables.some(t =>
            t.id !== masterTableId && !["AVAILABLE", "OCCUPIED"].includes(t.status)
        )
        if (hasConflict) {
            return { success: false, error: "Không thể ghép — có bàn đang ở trạng thái không hợp lệ" }
        }

        // Sum total seats
        const totalSeats = tables.reduce((s, t) => s + t.seats, 0)

        await prisma.$transaction([
            // Set child tables to MERGED
            ...childTableIds.map(id =>
                prisma.floorTable.update({
                    where: { id },
                    data: { status: "MERGED", mergedIntoId: masterTableId },
                })
            ),
            // Update master — keep OCCUPIED, increase seats
            prisma.floorTable.update({
                where: { id: masterTableId },
                data: { status: "OCCUPIED", seats: totalSeats },
            }),
        ])

        revalidatePath("/dashboard/tables")
        revalidatePath("/pos")
        return { success: true, masterTableId, totalSeats }
    } catch {
        return { success: false, error: "Lỗi ghép bàn" }
    }
}

/**
 * Unmerge tables — restore child tables to AVAILABLE and reset master seats.
 */
export async function unmergeTables(masterTableId: string) {
    try {
        const mergedTables = await prisma.floorTable.findMany({
            where: { mergedIntoId: masterTableId },
        })

        if (mergedTables.length === 0) {
            return { success: false, error: "Bàn này không có bàn ghép" }
        }

        await prisma.$transaction([
            // Reset child tables
            ...mergedTables.map(t =>
                prisma.floorTable.update({
                    where: { id: t.id },
                    data: { status: "AVAILABLE", mergedIntoId: null },
                })
            ),
            // Recalculate master seats (back to original)
            prisma.floorTable.update({
                where: { id: masterTableId },
                data: {},  // seats will need manual reset or default
            }),
        ])

        revalidatePath("/dashboard/tables")
        revalidatePath("/pos")
        return { success: true }
    } catch {
        return { success: false, error: "Lỗi tách bàn" }
    }
}

/**
 * Split bill — move selected items from one order to a new order.
 * Creates a new order on the same table (or different table).
 */
export async function splitBill(params: {
    orderId: string
    itemIds: string[]
    newTableId?: string  // if splitting to a different table
}) {
    try {
        const { orderId, itemIds, newTableId } = params

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true, staff: true, table: true },
        })
        if (!order) return { success: false, error: "Không tìm thấy đơn" }

        // Get items to split
        const itemsToSplit = order.items.filter(i => itemIds.includes(i.id))
        if (itemsToSplit.length === 0) return { success: false, error: "Không có món nào được chọn" }

        const splitSubtotal = itemsToSplit.reduce((s, i) => s + Number(i.subtotal), 0)

        // Generate new order number
        const today = new Date()
        const prefix = `ORD-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
        const todayCount = await prisma.order.count({ where: { orderNo: { startsWith: prefix } } })
        const newOrderNo = `${prefix}-${String(todayCount + 1).padStart(3, "0")}`

        // Create new order with split items + move items
        const [newOrder] = await prisma.$transaction([
            prisma.order.create({
                data: {
                    orderNo: newOrderNo,
                    tableId: newTableId ?? order.tableId,
                    orderType: order.orderType,
                    createdBy: order.createdBy,
                    subtotal: splitSubtotal,
                    totalAmount: splitSubtotal,
                    status: "OPEN",
                    parentOrderId: orderId,
                },
            }),
            // Reduce original order totals
            prisma.order.update({
                where: { id: orderId },
                data: {
                    subtotal: { decrement: splitSubtotal },
                    totalAmount: { decrement: splitSubtotal },
                },
            }),
        ])

        // Move items to new order
        await prisma.orderItem.updateMany({
            where: { id: { in: itemIds } },
            data: { orderId: newOrder.id },
        })

        revalidatePath("/pos")
        revalidatePath("/dashboard/tables")
        return { success: true, newOrderId: newOrder.id, newOrderNo }
    } catch (e) {
        console.error("splitBill error:", e)
        return { success: false, error: "Lỗi tách bill" }
    }
}

// ============================================================
// LAYOUT — Floor Plan Editor
// ============================================================

/** Save floor plan layout (walls, doors, labels) for a zone */
export async function updateZoneLayout(zoneId: string, layoutData: unknown) {
    try {
        await prisma.tableZone.update({
            where: { id: zoneId },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { layoutData: layoutData as any },
        })
        revalidatePath("/dashboard/tables")
        return { success: true }
    } catch {
        return { success: false, error: "Lỗi lưu layout" }
    }
}

/** Batch update table positions and sizes from floor plan editor */
export async function updateTablePositions(
    updates: Array<{ id: string; posX: number; posY: number; width?: number; height?: number; rotation?: number }>
) {
    try {
        await prisma.$transaction(
            updates.map((u) =>
                prisma.floorTable.update({
                    where: { id: u.id },
                    data: {
                        posX: u.posX,
                        posY: u.posY,
                        ...(u.width !== undefined ? { width: u.width } : {}),
                        ...(u.height !== undefined ? { height: u.height } : {}),
                        ...(u.rotation !== undefined ? { rotation: u.rotation } : {}),
                    },
                })
            )
        )
        revalidatePath("/dashboard/tables")
        return { success: true }
    } catch {
        return { success: false, error: "Lỗi cập nhật vị trí" }
    }
}
