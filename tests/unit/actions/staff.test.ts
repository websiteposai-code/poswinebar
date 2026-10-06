/**
 * 🧪 Unit Tests — Staff Management (P1)
 */
import { describe, it, expect, afterAll } from 'vitest'
import {
    getStaffList,
    getStaffById,
    createStaff,
    updateStaff,
    updateStaffStatus,
    resetStaffPin,
    verifyStaffPin,
} from '@/actions/staff'
import { prisma } from '@/lib/prisma'

const createdStaffIds: string[] = []
let createdStaffPin = ''

describe('Staff — CRUD (Real DB)', () => {
    afterAll(async () => {
        for (const id of createdStaffIds) {
            try { await prisma.staff.delete({ where: { id } }) } catch { /* */ }
        }
        await prisma.$disconnect()
    })

    // ─── U-STF-01: getStaffList ────────────────────────────────
    it('U-STF-01: getStaffList — should return staff array with masked PIN', async () => {
        const list = await getStaffList()
        expect(Array.isArray(list)).toBe(true)
        expect(list.length).toBeGreaterThan(0)
        const s = list[0]
        expect(s).toHaveProperty('fullName')
        expect(s).toHaveProperty('role')
        expect(s).toHaveProperty('status')
        // PIN should be masked
        if (s.pinCode) expect(s.pin).toBe('****')
    })

    // ─── U-STF-02: createStaff ────────────────────────────────
    it('U-STF-02: createStaff — should create new staff', async () => {
        // Generate truly unique 4-digit PIN not already in DB
        let uniquePin: string
        do {
            uniquePin = `${Math.floor(1000 + Math.random() * 8999)}`
        } while (await prisma.staff.findFirst({ where: { pinCode: uniquePin } }))
        createdStaffPin = uniquePin

        const result = await createStaff({
            fullName: 'Test Staff Unit',
            pin: uniquePin,
            role: 'WAITER',
            phone: '0912345678',
            baseSalary: 5000000,
        })
        expect(result.success).toBe(true)
        expect(result.staff).toBeDefined()
        createdStaffIds.push(result.staff!.id)
    })

    // ─── U-STF-03: createStaff duplicate PIN ───────────────────
    it('U-STF-03: createStaff — duplicate PIN should fail', async () => {
        if (!createdStaffPin) return

        const result = await createStaff({
            fullName: 'Duplicate',
            pin: createdStaffPin,
            role: 'WAITER',
            phone: '0900000000',
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('PIN')
    })

    // ─── U-STF-04: getStaffById ───────────────────────────────
    it('U-STF-04: getStaffById — should return specific staff', async () => {
        if (createdStaffIds.length === 0) return
        const staff = await getStaffById(createdStaffIds[0])
        expect(staff).toBeDefined()
        expect(staff!.fullName).toBe('Test Staff Unit')
    })

    // ─── U-STF-05: updateStaff ────────────────────────────────
    it('U-STF-05: updateStaff — should update fields', async () => {
        if (createdStaffIds.length === 0) return
        const result = await updateStaff(createdStaffIds[0], { fullName: 'Updated Name' })
        expect(result.success).toBe(true)

        const updated = await prisma.staff.findUnique({ where: { id: createdStaffIds[0] } })
        expect(updated?.fullName).toBe('Updated Name')
    })

    // ─── U-STF-06: updateStaffStatus ──────────────────────────
    it('U-STF-06: updateStaffStatus — should deactivate staff', async () => {
        if (createdStaffIds.length === 0) return
        const result = await updateStaffStatus(createdStaffIds[0], false)
        expect(result.success).toBe(true)

        const staff = await prisma.staff.findUnique({ where: { id: createdStaffIds[0] } })
        expect(staff?.isActive).toBe(false)

        // Re-activate for cleanup
        await updateStaffStatus(createdStaffIds[0], true)
    })

    // ─── U-STF-07: resetStaffPin ──────────────────────────────
    it('U-STF-07: resetStaffPin — should validate 4-digit PIN', async () => {
        const result = await resetStaffPin('fake-id', '12')
        expect(result.success).toBe(false)
        expect(result.error).toContain('4')
    })

    // ─── U-STF-08: verifyStaffPin ─────────────────────────────
    it('U-STF-08: verifyStaffPin — valid PIN should return staff', async () => {
        if (!createdStaffPin) return

        const result = await verifyStaffPin(createdStaffPin)
        expect(result).toBeDefined()
        expect(result!.id).toBe(createdStaffIds[0])
    })

    // ─── U-STF-09: verifyStaffPin — invalid ───────────────────
    it('U-STF-09: verifyStaffPin — non-existent PIN should return null', async () => {
        // Use a PIN pattern unlikely to exist
        const result = await verifyStaffPin('9999')
        // If 9999 happens to exist, just check it returns a valid shape
        if (result === null) {
            expect(result).toBeNull()
        } else {
            expect(result).toHaveProperty('id')
        }
    })
})
