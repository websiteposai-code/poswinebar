import { describe, it, expect } from "vitest"
import {
    calculateSuggestedPrice,
    evaluateRecipeCost,
    DEFAULT_COST_CONFIG,
    type CostTargetConfig,
} from "@/actions/cost-config"

describe("Cost Configuration & Smart Pricing Engine", () => {
    describe("calculateSuggestedPrice", () => {
        it("should calculate raw price and ceiling round to 10,000 VND", () => {
            // Cost: 43,000 VND, Target Margin: 70% (Cost is 30%)
            // Raw price: 43,000 / 0.3 = 143,333.33 VND
            // Rounded to 10k ceiling: 150,000 VND
            const result = calculateSuggestedPrice(43000, 70, 10000)

            expect(result.rawPrice).toBe(143333)
            expect(result.roundedPrice).toBe(150000)
            expect(result.grossProfit).toBe(150000 - 43000) // 107,000 VND
            expect(result.actualMarginPct).toBe(71.3)
            expect(result.actualCostPct).toBe(28.7)
        })

        it("should handle exact multiples of rounding unit without adding extra 10k", () => {
            // Cost: 30,000 VND, Margin: 70% -> 30,000 / 0.3 = 100,000 VND (exact)
            const result = calculateSuggestedPrice(30000, 70, 10000)

            expect(result.roundedPrice).toBe(100000)
            expect(result.actualMarginPct).toBe(70)
            expect(result.actualCostPct).toBe(30)
            expect(result.grossProfit).toBe(70000)
        })

        it("should return zero when total cost is zero or negative", () => {
            const result = calculateSuggestedPrice(0, 70, 10000)
            expect(result.roundedPrice).toBe(0)
            expect(result.grossProfit).toBe(0)
        })

        it("should support 60% and 80% margins correctly", () => {
            // Cost: 50,000 VND, Margin: 60% (Cost 40%) -> 50,000 / 0.4 = 125,000 -> 130,000
            const res60 = calculateSuggestedPrice(50000, 60, 10000)
            expect(res60.roundedPrice).toBe(130000)

            // Cost: 50,000 VND, Margin: 80% (Cost 20%) -> 50,000 / 0.2 = 250,000 (exact)
            const res80 = calculateSuggestedPrice(50000, 80, 10000)
            expect(res80.roundedPrice).toBe(250000)
        })
    })

    describe("evaluateRecipeCost", () => {
        const customConfig: CostTargetConfig = {
            targetFoodCostPct: 28,
            targetWineCostPct: 32,
            targetDrinkCostPct: 22,
            targetDefaultCostPct: 30,
            defaultTargetMarginPct: 70,
            warningThresholdOffset: 5,
            priceRoundingUnit: 10000,
        }

        it("should return UNPRICED when sellPrice is zero or not set", () => {
            const ev = evaluateRecipeCost(40000, 0, "FOOD", customConfig)
            expect(ev.status).toBe("UNPRICED")
            expect(ev.label).toBe("Chưa định giá")
            expect(ev.targetCostPct).toBe(28)
            expect(ev.suggestedPrice).toBe(140000) // 40,000 / 0.3 = 133,333 -> 140,000
        })

        it("should classify OPTIMAL when cost is below target", () => {
            // Food item: sellPrice = 200,000 VND, cost = 50,000 VND -> Cost % = 25% (Target <= 28%)
            const ev = evaluateRecipeCost(50000, 200000, "FOOD", customConfig)
            expect(ev.status).toBe("OPTIMAL")
            expect(ev.costPct).toBe(25)
            expect(ev.diffPct).toBe(-3)
            expect(ev.label).toBe("Đạt chuẩn")
        })

        it("should classify WARNING when cost is between target and target + offset", () => {
            // Food item: Target = 28%, Offset = 5% (Range 28.1% -> 33.0%)
            // sellPrice = 200,000 VND, cost = 62,000 VND -> Cost % = 31%
            const ev = evaluateRecipeCost(62000, 200000, "FOOD", customConfig)
            expect(ev.status).toBe("WARNING")
            expect(ev.costPct).toBe(31)
            expect(ev.diffPct).toBe(3)
            expect(ev.label).toBe("Cận biên")
        })

        it("should classify OVER_BUDGET when cost exceeds target + offset", () => {
            // Food item: sellPrice = 200,000 VND, cost = 80,000 VND -> Cost % = 40% (Target 28% + 5% = 33%)
            const ev = evaluateRecipeCost(80000, 200000, "FOOD", customConfig)
            expect(ev.status).toBe("OVER_BUDGET")
            expect(ev.costPct).toBe(40)
            expect(ev.diffPct).toBe(12)
            expect(ev.label).toBe("Vượt trần")
        })

        it("should use category-specific targets for Drink and Wine", () => {
            // Drink: Target is 22%
            const evDrink = evaluateRecipeCost(25000, 100000, "DRINK", customConfig)
            expect(evDrink.targetCostPct).toBe(22)
            expect(evDrink.costPct).toBe(25) // 25% is in warning range (22% + 5% = 27%)
            expect(evDrink.status).toBe("WARNING")

            // Wine: Target is 32%
            const evWine = evaluateRecipeCost(30000, 100000, "WINE_GLASS", customConfig)
            expect(evWine.targetCostPct).toBe(32)
            expect(evWine.costPct).toBe(30) // 30% <= 32% -> OPTIMAL
            expect(evWine.status).toBe("OPTIMAL")
        })
    })
})
