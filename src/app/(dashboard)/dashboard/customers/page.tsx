import { getAllCustomers, getCustomerStats } from "@/actions/customers"
import { CustomersClient } from "./customers-client"

export const dynamic = "force-dynamic"

export default async function CustomersPage() {
    let list: Awaited<ReturnType<typeof getAllCustomers>> = []
    let stats: Awaited<ReturnType<typeof getCustomerStats>> = {
        totalCustomers: 0, byTier: {}, totalRevenue: 0, totalOrders: 0,
        avgSpendPerVisit: 0, avgOrdersPerCustomer: 0, monthlyNew: 0,
        topSpenders: [], segments: { active: 0, atRisk: 0, lost: 0 },
    }

    try {
        list = await getAllCustomers()
        stats = await getCustomerStats(list)
    } catch (err) {
        console.error("[Customers SSR] Failed:", err)
    }

    return <CustomersClient initialData={{ list, stats }} />
}
