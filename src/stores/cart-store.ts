import { create } from "zustand"
import { Product } from "@/types"

export type FloorTable = {
    id: string
    tableNumber: string
    seats: number
    status: string
    zoneId: string
}

export type OrderItem = {
    id: string
    product: Product
    quantity: number
    unitPrice: number
    note?: string
    unit?: "GLASS" | "BOTTLE" | "PORTION"
    // Computed getters for compatibility
    productId?: string
    name?: string
    price?: number
    notes?: string
}

export type CartState = {
    items: OrderItem[]
    selectedTable: FloorTable | null
    orderType: "DINE_IN" | "TAKEAWAY"
    _hasHydrated: boolean

    // Actions
    addItem: (product: Product, options?: { unit?: "GLASS" | "BOTTLE"; unitPrice?: number; name?: string }) => void
    removeItem: (itemId: string) => void
    updateQuantity: (itemId: string, quantity: number) => void
    updateNote: (itemId: string, note: string) => void
    clearCart: () => void
    selectTable: (table: FloorTable | null) => void
    setOrderType: (type: "DINE_IN" | "TAKEAWAY") => void

    // Computed
    subtotal: () => number
    itemCount: () => number
}

export const useCartStore = create<CartState>()((set, get) => ({
    items: [],
    selectedTable: null,
    orderType: "DINE_IN",
    _hasHydrated: true,

    addItem: (product: Product, options?: { unit?: "GLASS" | "BOTTLE"; unitPrice?: number; name?: string }) => {
        const unit = options?.unit ?? (product.isByGlass && product.glassPrice ? "GLASS" : "BOTTLE")
        const price = options?.unitPrice ?? (unit === "GLASS" && product.glassPrice ? product.glassPrice : product.sellPrice)
        const { items } = get()
        const existing = items.find((item) => {
            const itemUnit = item.unit ?? (item.product.isByGlass && item.product.glassPrice ? "GLASS" : "BOTTLE")
            return item.product.id === product.id && itemUnit === unit
        })

        if (existing) {
            set({
                items: items.map((item) =>
                    item === existing
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                ),
            })
        } else {
            const unitLabel = unit === "GLASS" ? "Ly" : "Chai"
            const displayName = options?.name ?? (product.isByGlass ? `${product.name} (${unitLabel})` : product.name)

            set({
                items: [
                    ...items,
                    {
                        id: `oi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        product,
                        quantity: 1,
                        unitPrice: price,
                        unit,
                        name: displayName,
                        productId: product.id,
                        price,
                    },
                ],
            })
        }
    },

    removeItem: (itemId: string) => {
        set({ items: get().items.filter((item) => item.id !== itemId) })
    },

    updateQuantity: (itemId: string, quantity: number) => {
        if (quantity <= 0) {
            set({ items: get().items.filter((item) => item.id !== itemId) })
        } else {
            set({
                items: get().items.map((item) =>
                    item.id === itemId ? { ...item, quantity } : item
                ),
            })
        }
    },

    updateNote: (itemId: string, note: string) => {
        set({
            items: get().items.map((item) =>
                item.id === itemId ? { ...item, note, notes: note } : item
            ),
        })
    },

    clearCart: () => {
        set({ items: [], selectedTable: null })
    },

    selectTable: (table: FloorTable | null) => {
        set({ selectedTable: table, orderType: table ? "DINE_IN" : "TAKEAWAY" })
    },

    setOrderType: (type: "DINE_IN" | "TAKEAWAY") => {
        set({ orderType: type })
        if (type === "TAKEAWAY") {
            set({ selectedTable: null })
        }
    },

    subtotal: () => {
        return get().items.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0
        )
    },

    itemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
    },
}))
