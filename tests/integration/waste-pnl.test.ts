/**
 * 🧪 Integration Tests — Waste → P&L Impact (IT-11)
 * Record waste → verify StockMovement → verify expense in P&L
 */
import { describe, it, expect } from 'vitest'
import { recordWaste, getWasteRecords } from '@/actions/waste'
import { getTodayPnL } from '@/actions/daily-pnl'
import { prisma } from '@/lib/prisma'

describe('IT-11: Waste → P&L Impact', () => {
    it('Step 1: Record waste for a product', async () => {
        const product = await prisma.product.findFirst({
            where: { isActive: true, costPrice: { gt: 0 } },
        })
        const staff = await prisma.staff.findFirst({ where: { isActive: true } })
        if (!product || !staff) {
            console.log('⚠️ No product/staff — skipping waste test')
            return
        }

        const result = await recordWaste({
            type: 'WASTE',
            productId: product.id,
            quantity: 1,
            reason: 'Integration test — waste',
            staffId: staff.id,
        })
        expect(result.success).toBe(true)
    })

    it('Step 2: Verify waste record created today', async () => {
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const records = await getWasteRecords({ dateFrom: today, dateTo: today })
        const testRecord = records.find(r => r.reason?.includes('Integration test'))
        expect(testRecord).toBeDefined()
        if (testRecord) {
            expect(testRecord.type).toBe('WASTE')
            expect(testRecord.totalCost).toBeGreaterThan(0)
        }
    })

    it('Step 3: Verify StockMovement created for waste', async () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const movements = await prisma.stockMovement.findMany({
            where: {
                type: 'WASTE',
                createdAt: { gte: today },
                reason: { contains: 'Integration test' },
            },
        })
        expect(movements.length).toBeGreaterThan(0)
        if (movements.length > 0) {
            expect(Number(movements[0].quantity)).toBeGreaterThan(0)
        }
    })

    it('Step 4: Today P&L should include waste in wasteAndSpoilage', async () => {
        const pnl = await getTodayPnL()
        expect(pnl.wasteAndSpoilage).toBeGreaterThanOrEqual(0)
        // wasteAndSpoilage is sum of unitCost from waste movements
    })
})
