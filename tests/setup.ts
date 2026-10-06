// Load environment variables FIRST (DATABASE_URL needed for Prisma)
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env from project root
config({ path: resolve(__dirname, '../.env') })

// Test setup — mock Next.js server functions that don't exist in Vitest
import { vi } from 'vitest'

// Mock next/cache — revalidatePath is used in server actions
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}))

// Mock next/headers — used in some actions
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => ({
        get: vi.fn((name: string) => {
            if (name === 'pos_auth') return { name: 'pos_auth', value: 'true' }
            return undefined
        }),
        set: vi.fn(),
        delete: vi.fn(),
    })),
    headers: vi.fn(() => new Map()),
}))

