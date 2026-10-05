import "dotenv/config"
import { prisma } from "../src/lib/prisma"

prisma.$connect()
    .then(() => { console.log("✅ Connected to DB!"); return prisma.$disconnect() })
    .catch((e: Error) => { console.error("❌ Error:", e.message); return prisma.$disconnect() })
