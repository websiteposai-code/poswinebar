import { describe, it, expect } from "vitest"
import { WASTE_REASON_LABELS, type WasteReasonCategory } from "@/lib/waste-types"

describe("Waste & Corked Wine COGS Allocation Logic", () => {
    describe("Waste Reason Labels & Classifications", () => {
        it("should have proper labels and icons for all wine bar waste categories", () => {
            expect(WASTE_REASON_LABELS.CORKED.label).toContain("Corked")
            expect(WASTE_REASON_LABELS.OXIDATION.label).toContain("Oxy hoá")
            expect(WASTE_REASON_LABELS.BREAKAGE.label).toContain("Rơi vỡ")
            expect(WASTE_REASON_LABELS.TASTING.label).toContain("Nếm thử")
        })
    })

    describe("True COGS & Margin Formulas", () => {
        it("should calculate True COGS by summing sold COGS and net waste COGS", () => {
            const soldCOGS = 45_000_000 // 45M VND recipe/bottle sold costs
            const grossWaste = 4_000_000 // 4M total damaged goods
            const supplierClaim = 2_500_000 // 2.5M corked bottles pending supplier replacement
            const netWasteCOGS = Math.max(0, grossWaste - supplierClaim) // 1.5M actual loss to bar

            const trueCOGS = soldCOGS + netWasteCOGS
            expect(netWasteCOGS).toBe(1_500_000)
            expect(trueCOGS).toBe(46_500_000)

            const totalRevenue = 150_000_000 // 150M VND
            const theoreticalMargin = Math.round(((totalRevenue - soldCOGS) / totalRevenue) * 100)
            const trueMargin = Math.round(((totalRevenue - trueCOGS) / totalRevenue) * 100)
            const wasteRate = Math.round((netWasteCOGS / totalRevenue) * 1000) / 10

            expect(theoreticalMargin).toBe(70) // 70% theoretical margin
            expect(trueMargin).toBe(69) // 69% true margin
            expect(wasteRate).toBe(1.0) // 1.0% waste rate (well within < 2% benchmark)
        })

        it("should alert when waste rate exceeds 4% danger threshold", () => {
            const totalRevenue = 100_000_000 // 100M VND
            const netWasteCOGS = 5_200_000 // 5.2M VND wine spillage & spoilage
            const wasteRate = Math.round((netWasteCOGS / totalRevenue) * 1000) / 10

            expect(wasteRate).toBe(5.2)
            expect(wasteRate > 4.0).toBe(true) // Triggers Báo động đỏ (> 4%)
        })

        it("should prorate open wine bottle remaining value correctly", () => {
            const bottleCost = 800_000 // 800,000 VND
            const glassesTotal = 8
            const glassesRemaining = 3

            const costPerGlass = bottleCost / glassesTotal // 100,000 VND
            const remainingCost = costPerGlass * glassesRemaining // 300,000 VND

            expect(costPerGlass).toBe(100_000)
            expect(remainingCost).toBe(300_000)
        })
    })
})
