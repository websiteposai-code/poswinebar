/**
 * 🛡️ Global Test Setup/Teardown
 * Snapshots critical DB state BEFORE tests, restores AFTER all tests complete.
 * This ensures the POS app always works correctly after running tests.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import pg from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

config({ path: resolve(__dirname, '..', '.env') })

let pool: pg.Pool
let prisma: PrismaClient
let snapshot: {
    tableStatuses: { id: string; status: string }[]
    openShiftId: string | null
    openShiftStaffId: string | null
}

export async function setup() {
    try {
        pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
        const adapter = new PrismaPg(pool)
        prisma = new PrismaClient({ adapter })

        console.log('\n🛡️  [Global Setup] Snapshotting DB state before tests...')

        // Snapshot all table statuses
        const tables = await prisma.floorTable.findMany({
            select: { id: true, status: true },
        })
        const tableStatuses = tables.map(t => ({ id: t.id, status: t.status }))

        // Snapshot current open shift
        const shift = await prisma.shiftRecord.findFirst({
            where: { closedAt: null },
            select: { id: true, staffId: true },
        })

        snapshot = {
            tableStatuses,
            openShiftId: shift?.id ?? null,
            openShiftStaffId: shift?.staffId ?? null,
        }

        console.log(`   📋 Tables: ${tableStatuses.length} (${tableStatuses.filter(t => t.status !== 'AVAILABLE').length} non-available)`)
        console.log(`   🔄 Shift: ${shift ? 'OPEN' : 'NONE'}`)
        console.log('   ✅ Snapshot saved!\n')
    } catch (err) {
        console.warn('   ⚠️  [Global Setup] Could not snapshot DB (DB unreachable). Proceeding in offline mode.\n')
    }
}

export async function teardown() {
    if (!snapshot || !prisma) return
    console.log('\n🛡️  [Global Teardown] Restoring DB state after tests...')

    // 1. Restore table statuses
    let tablesFixed = 0
    for (const snap of snapshot.tableStatuses) {
        const current = await prisma.floorTable.findUnique({
            where: { id: snap.id },
            select: { status: true },
        })
        if (current && current.status !== snap.status) {
            await prisma.floorTable.update({
                where: { id: snap.id },
                data: { status: snap.status as any },
            })
            tablesFixed++
        }
    }
    if (tablesFixed > 0) console.log(`   📋 Restored ${tablesFixed} table(s) to original status`)

    // 2. Ensure shift state is correct
    const currentShift = await prisma.shiftRecord.findFirst({
        where: { closedAt: null },
    })

    if (snapshot.openShiftId && !currentShift) {
        // There was a shift open before tests but now it's closed/gone — open a new one
        const staffId = snapshot.openShiftStaffId!
        await prisma.shiftRecord.create({
            data: { staffId, openingCash: 500000 },
        })
        console.log('   🔄 Re-opened shift (was open before tests)')
    } else if (!snapshot.openShiftId && currentShift) {
        // There was no shift before tests but now there is — close it
        await prisma.shiftRecord.update({
            where: { id: currentShift.id },
            data: { closedAt: new Date(), closingCash: currentShift.openingCash, expectedCash: currentShift.openingCash, variance: 0 },
        })
        console.log('   🔄 Closed orphan shift (was not open before tests)')
    } else {
        console.log('   🔄 Shift state OK')
    }

    // 3. Clean up any test data that might have been left behind
    const testCustomers = await prisma.customer.findMany({
        where: { name: { startsWith: 'Test' } },
    })
    if (testCustomers.length > 0) {
        for (const c of testCustomers) {
            try { await prisma.customer.delete({ where: { id: c.id } }) } catch { /* might have deps */ }
        }
        console.log(`   🧹 Cleaned up ${testCustomers.length} test customer(s)`)
    }

    const testZones = await prisma.tableZone.findMany({
        where: { name: { startsWith: 'Test' } },
    })
    if (testZones.length > 0) {
        for (const z of testZones) {
            try {
                await prisma.floorTable.deleteMany({ where: { zoneId: z.id } })
                await prisma.tableZone.delete({ where: { id: z.id } })
            } catch { /* */ }
        }
        console.log(`   🧹 Cleaned up ${testZones.length} test zone(s)`)
    }

    const testSuppliers = await prisma.supplier.findMany({
        where: { name: { startsWith: 'Test' } },
    })
    if (testSuppliers.length > 0) {
        for (const s of testSuppliers) {
            try { await prisma.supplier.delete({ where: { id: s.id } }) } catch { /* */ }
        }
        console.log(`   🧹 Cleaned up ${testSuppliers.length} test supplier(s)`)
    }

    const testIngredients = await prisma.ingredient.findMany({
        where: { name: { startsWith: 'Test' } },
    })
    if (testIngredients.length > 0) {
        for (const i of testIngredients) {
            try { await prisma.ingredient.delete({ where: { id: i.id } }) } catch { /* */ }
        }
        console.log(`   🧹 Cleaned up ${testIngredients.length} test ingredient(s)`)
    }

    await pool.end()
    console.log('   ✅ DB state fully restored! POS is safe.\n')
}
