import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function resetForLaunch() {
    console.log("🚀 Reset for customer launch...")
    console.log("⚠️  Giữ lại: Staff accounts, Store Settings")
    console.log("🗑️  Xóa: Menu, Orders, Customers, Inventory, Finance...\n")

    // ── Giao dịch & tài chính ──
    await prisma.payment.deleteMany()
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    console.log("✅ Orders & Payments")

    await prisma.tabItem.deleteMany()
    await prisma.customerTab.deleteMany()
    console.log("✅ Customer Tabs")

    await prisma.fundTransaction.deleteMany()
    await prisma.shiftTarget.deleteMany()
    await prisma.shiftRecord.deleteMany()
    console.log("✅ Shifts & Fund Transactions")

    await prisma.debtRecord.deleteMany()
    console.log("✅ Debt Records")

    // ── Khách hàng ──
    await prisma.customer.deleteMany()
    console.log("✅ Customers")

    // ── Feedback & Reservation ──
    await prisma.feedbackItem.deleteMany()
    await prisma.feedbackSession.deleteMany()
    await prisma.reservation.deleteMany()
    console.log("✅ Feedback & Reservations")

    // ── Consignment & Kho ──
    await prisma.consignmentSettlement.deleteMany()
    try { await (prisma as any).consignmentItem.deleteMany() } catch {}
    await prisma.wineBottle.deleteMany()
    await prisma.consignment.deleteMany()
    await prisma.stockMovement.deleteMany()
    console.log("✅ Consignments & Stock Movements")

    // ── Forecast ──
    await prisma.forecastSuggestion.deleteMany()
    await prisma.forecastConfig.deleteMany()
    console.log("✅ Forecast Data")

    // ── Menu: sản phẩm, công thức, nguyên liệu ──
    await prisma.out86.deleteMany()
    await prisma.wineGlassConfig.deleteMany()
    await prisma.productRecipe.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    await prisma.ingredient.deleteMany()
    console.log("✅ Menu (Products, Categories, Ingredients, Recipes)")

    // ── Bàn & Khu vực ──
    await prisma.floorTable.deleteMany()
    await prisma.tableZone.deleteMany()
    console.log("✅ Tables & Zones")

    // ── Nhà cung cấp ──
    await prisma.supplier.deleteMany()
    console.log("✅ Suppliers")

    // ── Assets / Equipment nếu có ──
    try { await (prisma as any).depreciationEntry.deleteMany() } catch {}
    try { await (prisma as any).equipment.deleteMany() } catch {}

    // ── Promotion ──
    try { await (prisma as any).promotion.deleteMany() } catch {}

    // ── Audit log ──
    await prisma.auditLog.deleteMany()
    console.log("✅ Audit Logs")

    // ── Attendance (chấm công cũ) ──
    await prisma.attendance.deleteMany()
    try { await (prisma as any).payroll.deleteMany() } catch {}
    console.log("✅ Attendance & Payroll")

    // ── Tax Rate reset (optional - xóa thuế cũ) ──
    await prisma.taxRate.deleteMany()
    console.log("✅ Tax Rates")

    console.log("\n🎉 Done! Đã xóa sạch dữ liệu test.")
    console.log("👤 Tài khoản staff & cài đặt cửa hàng được giữ nguyên.")
    console.log("📋 Tiếp theo: Vào dashboard để tạo Menu, Bàn, Nhà cung cấp mới.\n")
}

resetForLaunch()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => { console.error("❌ Error:", e); await prisma.$disconnect(); process.exit(1) })
