"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Search, Plus, Minus, Trash2, Wine, ShoppingCart, Receipt, CreditCard, Banknote, QrCode, X, MessageSquare, Armchair, Hash, Loader2, CheckCircle2, CreditCard as TabIcon, User, Clock, UserPlus, Star, Timer, CircleMinus, Bell, Pause, Play, ShieldCheck, Percent, Thermometer, GlassWater, Grape, MapPin, Info, ChevronRight, BookOpen, ChevronDown, ChevronUp, Utensils, Menu as MenuIcon, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import { useSidebarStore } from "@/stores/sidebar-store"
import { createOrder, processOrderWithCOGS, getActiveOrderByTable, getActiveOrders, addItemsToOrder, sendToKitchen as sendToKitchenAction, type PaymentMethod, type Order } from "@/actions/orders"
import {
    searchCustomers,
    createQuickCustomer,
    openTab,
    getOpenTabs,
    addMultipleTabItems,
    closeTab,
    removeTabItem,
} from "@/actions/tabs"
import { getProducts, getCategories } from "@/actions/menu"
import { getTables, getZones } from "@/actions/tables"
import { getPOSInitialData } from "@/actions/pos-loader"
import { getAllGlassStatuses, sellWineGlass, sellWineBottle, openBottle, pourFromBottle, getOpenedBottlesForProduct, getInStockBottlesForProduct, type GlassStatus, type OpenedBottleSummary } from "@/actions/wine"
import { getCurrentShift, openShift, closeShift, addShiftExpense, type Shift } from "@/actions/shifts"
import { getUnreadNotifications, markAsRead, markAllAsRead, type Notification } from "@/actions/notifications"
import { generateQRPayment, confirmQRPayment, cancelQRPayment, getBankConfig, type QRPaymentRequest, type QRPaymentConfig } from "@/actions/qr-payment"
import {
    get86ProductIds,
    markProduct86,
    unmark86,
    calculateServiceCharge,
    holdOrder,
    getHeldOrders,
    recallHeldOrder,
    deleteHeldOrder,
    authorizeDiscount,
    getDiscountThreshold,
    transferTable,
    type HeldOrder,
} from "@/actions/operational"
import { getUpcomingReservations, type Reservation } from "@/actions/reservations"
import { getPushSaleItems, type PushSaleItem } from "@/actions/push-sale"
import { getAllServingNotes, searchServingNotes, getPairingsForProduct, type WineServingNote } from "@/actions/serving-notes"
import { getDefaultTaxRate } from "@/actions/tax"
import { getPosConfig, type PaymentMode } from "@/actions/pos-config"
import { checkPromotions, type AppliedPromo } from "@/actions/promotions"
import { getAllowNegativeStock, getWineRecommendations, getAlternativesForOutOfStock, type WineRecommendation } from "@/actions/wine-advisor"
import { POSInlineSkeleton } from "@/components/inline-skeletons"
import { usePOSShortcuts, ShortcutBadge } from "@/hooks/use-pos-shortcuts"
import dynamic from "next/dynamic"

const ReceiptPrintFrame = dynamic(
    () => import("@/components/pos/receipt").then((mod) => mod.ReceiptPrintFrame),
    { ssr: false }
)
import { usePrefetchStore } from "@/stores/prefetch-store"
import { useIsMobile } from "@/hooks/use-mobile"
import { QuickServingModal } from "@/components/pos/quick-serving-modal"
import { MobileWaiterBar } from "@/components/pos/mobile-waiter-bar"
import { CashierCheckoutModal } from "@/components/pos/cashier-checkout-modal"
import type { Product, Category, Customer, CustomerTab } from "@/types"
import type { OrderItem } from "@/stores/cart-store"
type FloorTable = Awaited<ReturnType<typeof getTables>>[number]
type TableZone = Awaited<ReturnType<typeof getZones>>[number]

function formatPrice(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount)
}

// ============================================================
// TABLE SELECTOR MODAL — supports viewing occupied tables & adding items
// Pre-fetches ALL active orders in 1 query for instant table selection
// ============================================================
function TableSelector({
    open,
    onClose,
    onSelect,
    onSelectOccupied,
    onPayOrder,
    zones,
    tables,
}: {
    open: boolean
    onClose: () => void
    onSelect: (table: FloorTable) => void
    onSelectOccupied?: (table: FloorTable, order: Order) => void
    onPayOrder?: (order: Order) => void
    zones: TableZone[]
    tables: FloorTable[]
}) {
    const [selectedZone, setSelectedZone] = useState(zones[0]?.id ?? "")
    const [viewingOrder, setViewingOrder] = useState<{ table: FloorTable; order: Order } | null>(null)
    const [loadingOrder, setLoadingOrder] = useState(false)
    // Pre-fetched map: tableId → Order (loaded once when modal opens)
    const [orderMap, setOrderMap] = useState<Map<string, Order>>(new Map())

    // Sync selectedZone when zones load (fixes empty table list on first open)
    useEffect(() => {
        if (zones.length > 0 && !selectedZone) {
            setSelectedZone(zones[0].id)
        }
    }, [zones, selectedZone])

    // ★ Pre-fetch ALL active orders when modal opens — 1 query instead of N
    useEffect(() => {
        if (!open) return
        setLoadingOrder(true)
        getActiveOrders().then((orders) => {
            const map = new Map<string, Order>()
            for (const order of orders) {
                if (order.tableId) map.set(order.tableId, order as Order)
            }
            setOrderMap(map)
            setLoadingOrder(false)
        }).catch(() => setLoadingOrder(false))
    }, [open])

    if (!open) return null

    const filteredTables = tables.filter(
        (t) => t.zoneId === selectedZone && t.isActive
    )

    const statusColors: Record<string, string> = {
        AVAILABLE: "border-green-400 bg-green-50 hover:bg-green-100 hover:border-green-600 cursor-pointer",
        OCCUPIED: "border-wine-300 bg-wine-50 hover:bg-wine-100 hover:border-wine-500 cursor-pointer ring-1 ring-wine-200",
        RESERVED: "border-amber-300 bg-amber-50 opacity-60 cursor-not-allowed",
        CLEANING: "border-cream-400 bg-cream-200 opacity-60 cursor-not-allowed",
        MERGED: "border-cream-400 bg-cream-200 opacity-40 cursor-not-allowed",
    }

    const statusLabels: Record<string, string> = {
        AVAILABLE: "Trống",
        OCCUPIED: "Đang dùng",
        RESERVED: "Đặt trước",
        CLEANING: "Dọn dẹp",
        MERGED: "Ghép",
    }

    const handleTableClick = (table: FloorTable) => {
        if (table.status === "AVAILABLE") {
            onSelect(table)
            onClose()
        } else if (table.status === "OCCUPIED") {
            // ★ Instant lookup from pre-fetched map — open order detail panel
            const order = orderMap.get(table.id)
            if (order) {
                setViewingOrder({ table, order })
            } else {
                // No active order found — allow creating new
                onSelect(table)
                onClose()
            }
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <div className={cn(
                "w-full sm:max-w-[600px] max-h-[88vh] rounded-t-2xl sm:rounded-2xl border border-cream-300 bg-cream-50 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 transition-all",
                viewingOrder && "sm:max-w-[840px] lg:grid lg:grid-cols-[1fr_320px]"
            )}>
                <div className="flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-cream-300 px-4 sm:px-5 py-3 sm:py-4">
                        <div>
                            <h2 className="font-display text-base sm:text-lg font-bold text-green-900">Chọn bàn</h2>
                            <p className="text-[11px] sm:text-xs text-cream-500">Trống → tạo mới · Đang dùng → thêm món</p>
                        </div>
                        <button onClick={() => { setViewingOrder(null); onClose() }} className="rounded-lg p-2 hover:bg-cream-200 transition-all">
                            <X className="h-4 w-4 text-cream-500" />
                        </button>
                    </div>

                    {/* Zone tabs */}
                    <div className="flex gap-1 border-b border-cream-300 px-3 sm:px-4 py-2 overflow-x-auto scroll-hide-bar">
                        {zones.map((zone) => (
                            <button
                                key={zone.id}
                                onClick={() => { setSelectedZone(zone.id); setViewingOrder(null) }}
                                className={cn(
                                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all touch-target",
                                    selectedZone === zone.id
                                        ? "bg-green-900 text-cream-50 shadow-xs"
                                        : "text-cream-500 hover:bg-cream-200"
                                )}
                            >
                                {zone.name}
                            </button>
                        ))}
                    </div>

                    {/* Table grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-5 max-h-[55vh] overflow-y-auto">
                        {filteredTables.map((table) => {
                            const isViewing = viewingOrder?.table.id === table.id
                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleTableClick(table)}
                                    disabled={!["AVAILABLE", "OCCUPIED"].includes(table.status) || loadingOrder}
                                    className={cn(
                                        "flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all",
                                        statusColors[table.status],
                                        isViewing && "ring-2 ring-wine-500 scale-[1.03] shadow-lg"
                                    )}
                                >
                                    <span className="font-display text-lg font-bold text-green-900">
                                        {table.tableNumber}
                                    </span>
                                    <span className="text-[10px] text-cream-500">
                                        {table.seats} chỗ
                                    </span>
                                    <span
                                        className={cn(
                                            "mt-1 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                                            table.status === "AVAILABLE" ? "bg-green-100 text-green-800" :
                                                table.status === "OCCUPIED" ? "bg-wine-100 text-wine-800" :
                                                    "bg-cream-200 text-cream-600"
                                        )}
                                    >
                                        {statusLabels[table.status]}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex justify-center gap-4 border-t border-cream-300 px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-[10px] text-cream-500 font-medium">
                            <span className="h-2 w-2 rounded-full bg-green-500" /> Trống — tạo đơn
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] text-cream-500 font-medium">
                            <span className="h-2 w-2 rounded-full bg-wine-500" /> Đang dùng — xem / thêm món
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] text-cream-500 font-medium">
                            <span className="h-2 w-2 rounded-full bg-amber-400" /> Đặt trước
                        </span>
                    </div>
                </div>

                {/* ========== ORDER DETAIL PANEL ========== */}
                {viewingOrder && (
                    <div className="border-l border-cream-300 bg-white flex flex-col">
                        <div className="px-4 py-3 border-b border-cream-200 bg-wine-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-display text-sm font-bold text-wine-800">
                                        {viewingOrder.table.tableNumber}
                                    </h3>
                                    <p className="text-[10px] text-wine-500">
                                        {viewingOrder.order.orderNumber} · {viewingOrder.order.items.length} món
                                    </p>
                                </div>
                                <button onClick={() => setViewingOrder(null)} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-wine-500 hover:bg-wine-100 hover:text-wine-700 transition-all">
                                    ← Quay lại
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                            <p className="text-[9px] font-bold uppercase text-cream-400 tracking-wider mb-1">Đang order</p>
                            {viewingOrder.order.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between rounded-lg bg-cream-50 border border-cream-200 px-2.5 py-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-green-900 truncate">{item.productName}</p>
                                        {item.notes && <p className="text-[9px] text-amber-600 italic">{item.notes}</p>}
                                    </div>
                                    <div className="text-right ml-2 shrink-0">
                                        <span className="text-[10px] text-cream-500">×{item.quantity}</span>
                                        <p className="font-mono text-[10px] font-bold text-green-800">₫{formatPrice(item.unitPrice * item.quantity)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-cream-200 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-cream-500">Tổng hiện tại</span>
                                <span className="font-mono text-sm font-bold text-wine-700">₫{formatPrice(viewingOrder.order.total)}</span>
                            </div>
                            <button
                                onClick={() => {
                                    if (onSelectOccupied) {
                                        onSelectOccupied(viewingOrder.table, viewingOrder.order)
                                    }
                                    onClose()
                                }}
                                className="w-full rounded-lg bg-wine-700 py-2.5 text-xs font-bold text-white hover:bg-wine-800 transition-all text-center shadow-xs"
                            >
                                Thêm món cho bàn này
                            </button>
                            <button
                                onClick={() => {
                                    onPayOrder?.(viewingOrder.order)
                                    onClose()
                                }}
                                className="w-full rounded-lg bg-green-800 py-2.5 text-xs font-bold text-white hover:bg-green-700 transition-all text-center shadow-xs"
                            >
                                Thanh toán đơn · ₫{formatPrice(viewingOrder.order.total)}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================
// POS PAGE
// ============================================================
export default function POSPage() {
    const [activeCategory, setActiveCategory] = useState<string>("all")
    const [searchTerm, setSearchTerm] = useState("")
    const [tableModalOpen, setTableModalOpen] = useState(false)
    const pendingProductRef = useRef<Product | null>(null)
    const [noteItemId, setNoteItemId] = useState<string | null>(null)
    const [noteText, setNoteText] = useState("")
    const [servingNoteItem, setServingNoteItem] = useState<OrderItem | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [lastOrder, setLastOrder] = useState<{ orderNumber: string; total: number } | null>(null)
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
    const [payingOrder, setPayingOrder] = useState<Order | null>(null)
    const [existingOrderData, setExistingOrderData] = useState<Order | null>(null)
    const [receiptOrder, setReceiptOrder] = useState<Order | null>(null)

    // Tab state
    const [openTabModal, setOpenTabModal] = useState(false)
    const [tabDetailModal, setTabDetailModal] = useState<string | null>(null)
    const [activeTabs, setActiveTabs] = useState<CustomerTab[]>([])
    const [tabsLoading, setTabsLoading] = useState(false)

    // Wine glass tracking state
    const [glassStatuses, setGlassStatuses] = useState<Record<string, GlassStatus>>({})

    // Shift state
    const [currentShift, setCurrentShift] = useState<Shift | null>(null)
    const [shiftModalOpen, setShiftModalOpen] = useState(false)
    const [shiftElapsed, setShiftElapsed] = useState("")

    // Notification state
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [notifOpen, setNotifOpen] = useState(false)

    // QR Payment state
    const [qrModalOpen, setQrModalOpen] = useState(false)
    const [qrPayment, setQrPayment] = useState<QRPaymentRequest | null>(null)
    const [qrBankConfig, setQrBankConfig] = useState<QRPaymentConfig | null>(null)

    // Phase 8A: Operational
    const [product86Ids, setProduct86Ids] = useState<string[]>([])
    const [serviceCharge, setServiceCharge] = useState(0)
    const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([])
    const [holdModalOpen, setHoldModalOpen] = useState(false)
    const [discountModalOpen, setDiscountModalOpen] = useState(false)
    const [discountPct, setDiscountPct] = useState(0)
    const [upcomingReservations, setUpcomingReservations] = useState<Reservation[]>([])
    const [qrLoading, setQrLoading] = useState(false)

    // Tax & Promotions
    const [taxRate, setTaxRate] = useState<{ id: string; name: string; rate: number } | null>(null)
    const [taxAmount, setTaxAmount] = useState(0)
    const [appliedPromos, setAppliedPromos] = useState<AppliedPromo[]>([])
    const [promoDiscount, setPromoDiscount] = useState(0)

    // Cash Payment Modal
    const [cashModalOpen, setCashModalOpen] = useState(false)
    const [cashReceived, setCashReceived] = useState(0)

    // Wine Advisor — stock + recommendations
    const [stockMap, setStockMap] = useState<Map<string, number>>(new Map())
    const [allowNegativeStock, setAllowNegativeStock] = useState(false)
    const [showRecommendations, setShowRecommendations] = useState(false)
    const [recommendations, setRecommendations] = useState<WineRecommendation[]>([])
    const [recoSourceName, setRecoSourceName] = useState("")

    // Bottle Selector for glass sales
    const [showBottleSelector, setShowBottleSelector] = useState(false)
    const [bottleSelectorProduct, setBottleSelectorProduct] = useState<Product | null>(null)
    const [openedBottles, setOpenedBottles] = useState<OpenedBottleSummary[]>([])
    const [inStockBottles, setInStockBottles] = useState<Array<{ id: string; batchCode: string; costPrice: number; receivedAt: Date }>>([])

    // V2: Wine Guide popup
    const [wineGuideProduct, setWineGuideProduct] = useState<Product | null>(null)
    const [showWineGuidePopup, setShowWineGuidePopup] = useState(false)
    const [foodPairingProduct, setFoodPairingProduct] = useState<Product | null>(null)

    // V2: Push Sale sidebar
    const [pushSidebarOpen, setPushSidebarOpen] = useState(false)
    const [pushSaleItems, setPushSaleItems] = useState<PushSaleItem[]>([])

    // Products & Categories from DB
    const [dbProducts, setDbProducts] = useState<Product[]>([])
    const [dbCategories, setDbCategories] = useState<Category[]>([])

    // Floor tables from DB
    const [dbZones, setDbZones] = useState<TableZone[]>([])
    const [dbTables, setDbTables] = useState<FloorTable[]>([])

    const { staff } = useAuthStore()
    const cart = useCartStore()
    const isMobile = useIsMobile()
    const [mobileCartOpen, setMobileCartOpen] = useState(false)
    const [posLoading, setPosLoading] = useState(true)
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("PAY_AFTER")

    // Load active tabs
    const refreshTabs = useCallback(async () => {
        setTabsLoading(true)
        const tabs = await getOpenTabs()
        setActiveTabs(tabs)
        setTabsLoading(false)
    }, [])

    // Load wine glass statuses
    const refreshGlassStatuses = useCallback(async () => {
        const statuses = await getAllGlassStatuses()
        setGlassStatuses(statuses)
    }, [])

    // Load current shift
    const refreshShift = useCallback(async () => {
        const shift = await getCurrentShift()
        setCurrentShift(shift)
    }, [])

    // Load notifications
    const refreshNotifications = useCallback(async () => {
        const list = await getUnreadNotifications()
        setNotifications(list)
    }, [])

    // Shift timer — update elapsed time every 30s
    useEffect(() => {
        if (!currentShift) { setShiftElapsed(""); return }
        const update = () => {
            const diff = Date.now() - new Date(currentShift.openedAt).getTime()
            const h = Math.floor(diff / 3600000)
            const m = Math.floor((diff % 3600000) / 60000)
            setShiftElapsed(`${h}h${String(m).padStart(2, "0")}m`)
        }
        update()
        const interval = setInterval(update, 30000)
        return () => clearInterval(interval)
    }, [currentShift])

    // Phase 8A: Load 86 products (for refresh after toggle)
    const refresh86 = useCallback(async () => {
        const ids = await get86ProductIds()
        setProduct86Ids(ids)
    }, [])

    // Phase 8A: Load held orders
    const refreshHeld = useCallback(async () => {
        const list = await getHeldOrders()
        setHeldOrders(list)
    }, [])

    // Load floor tables & zones from DB (for refresh after changes)
    const refreshFloorData = useCallback(async () => {
        const [zonesData, tablesData] = await Promise.all([getZones(), getTables()])
        setDbZones(zonesData)
        setDbTables(tablesData)
    }, [])

    // V2: Load push sale items
    const refreshPushSale = useCallback(async () => {
        const items = await getPushSaleItems()
        setPushSaleItems(items)
    }, [])

    // ★ CONSOLIDATED INITIAL LOAD — ALL data in 1 server action (3 batches)
    useEffect(() => {
        const prefetchStore = usePrefetchStore.getState()
        prefetchStore.registerPrefetch('pos', getPOSInitialData)

        const applyData = (data: any, skipIfEmpty = false) => {
            // Guard: never overwrite good data with empty response
            if (skipIfEmpty && (!data.products || data.products.length === 0)) {
                return
            }
            setDbProducts(data.products as Product[])
            setDbCategories(data.categories as Category[])
            setDbZones(data.zones as TableZone[])
            setDbTables(data.tables as FloorTable[])
            setCurrentShift(data.currentShift as unknown as Shift | null)
            setProduct86Ids(data.out86Ids)
            setTaxRate(data.taxRate)
            setAllowNegativeStock(data.allowNegativeStock)

            // Apply batch 3 data — eliminates 8+ separate API calls
            if (data.wineStock) {
                const map = new Map<string, number>()
                for (const [k, v] of Object.entries(data.wineStock)) {
                    map.set(k, v as number)
                }
                setStockMap(map)
            }
            if (data.glassStatusMap) {
                setGlassStatuses(data.glassStatusMap)
            }
            if (data.openTabs) {
                setActiveTabs(data.openTabs as CustomerTab[])
            }
            if (data.heldOrders) {
                setHeldOrders(data.heldOrders as HeldOrder[])
            }
            if (data.notifications) {
                setNotifications(data.notifications as Notification[])
            }
            if (data.pushSaleItems) {
                setPushSaleItems(data.pushSaleItems as PushSaleItem[])
            }
            if (data.upcomingReservations) {
                setUpcomingReservations(data.upcomingReservations as Reservation[])
            }
            if (data.paymentMode) {
                setPaymentMode(data.paymentMode as PaymentMode)
            }

            setPosLoading(false)
        }

        // Try cache first (even expired — use 10min window for stale-while-revalidate)
        const cached = prefetchStore.get('pos', 600_000)
        if (cached) {
            // Apply cached data IMMEDIATELY — no skeleton flash
            applyData(cached)
            // Background refresh — but NEVER overwrite with empty data
            getPOSInitialData().then((data) => {
                if (data.products && data.products.length > 0) {
                    prefetchStore.set('pos', data)
                    applyData(data, true)
                }
            }).catch(() => { })
        } else {
            getPOSInitialData()
                .then((data) => {
                    if (data.products && data.products.length > 0) {
                        prefetchStore.set('pos', data)
                    }
                    applyData(data)
                })
                .catch((err) => {
                    console.error("[POS] Consolidated loader failed, falling back:", err)
                    setPosLoading(false)
                    Promise.all([getProducts(), getCategories()]).then(([prods, cats]) => {
                        setDbProducts(prods)
                        setDbCategories(cats)
                    })
                    Promise.all([getZones(), getTables()]).then(([z, t]) => {
                        setDbZones(z)
                        setDbTables(t)
                    })
                    refreshShift()
                    refresh86()
                })
        }

        // Notifications poll (starts after initial)
        const notifInterval = setInterval(refreshNotifications, 60000)
        const pushInterval = setInterval(refreshPushSale, 300000)
        return () => { clearInterval(notifInterval); clearInterval(pushInterval) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // URL param sync: auto-select table and active order when routed from Table map (/dashboard/tables)
    useEffect(() => {
        if (typeof window === "undefined" || dbTables.length === 0) return
        const params = new URLSearchParams(window.location.search)
        const tableId = params.get("tableId")
        if (tableId) {
            const table = dbTables.find((t) => t.id === tableId)
            if (table) {
                cart.selectTable(table)
                getActiveOrderByTable(table.id).then((ord) => {
                    if (ord) {
                        setActiveOrderId(ord.id)
                        setExistingOrderData(ord)
                        toast.info(`Bàn ${table.tableNumber} — sẵn sàng thêm món vào ${ord.orderNumber}`)
                    } else {
                        setActiveOrderId(null)
                        setExistingOrderData(null)
                        toast.success(`Đã chọn bàn ${table.tableNumber}`)
                    }
                }).catch(() => {
                    toast.success(`Đã chọn bàn ${table.tableNumber}`)
                })
            }
        }
    }, [dbTables])

    // Load stock for all wine products — batch version (1 query instead of N)
    const refreshStockMap = useCallback(async () => {
        const { getAllWineStock } = await import("@/actions/wine-advisor")
        const stock = await getAllWineStock()
        const map = new Map<string, number>()
        for (const [k, v] of Object.entries(stock)) {
            map.set(k, v)
        }
        setStockMap(map)
    }, [])

    // Phase 8A: Calculate service charge, tax & promotions when cart changes
    useEffect(() => {
        if (cart.items.length > 0) {
            calculateServiceCharge(cart.subtotal(), cart.orderType).then((sc) => setServiceCharge(sc.amount))
            // Tax calculation
            if (taxRate) {
                const afterDiscount = cart.subtotal() * (1 - discountPct / 100)
                setTaxAmount(Math.round(afterDiscount * taxRate.rate / 100))
            }
            // Auto-check promotions
            checkPromotions({
                orderTotal: cart.subtotal(),
                items: cart.items.map(i => ({
                    productId: i.product.id,
                    categorySlug: i.product.categoryId,
                    quantity: i.quantity,
                    unitPrice: i.product.isByGlass && i.product.glassPrice ? i.product.glassPrice : i.product.sellPrice,
                })),
            }).then((promos) => {
                setAppliedPromos(promos)
                setPromoDiscount(promos.reduce((sum, p) => sum + p.discountAmount, 0))
            })
        } else {
            setServiceCharge(0)
            setTaxAmount(0)
            setAppliedPromos([])
            setPromoDiscount(0)
        }
    }, [cart.items, cart.orderType, cart.subtotal, taxRate, discountPct])

    // Compute final total
    const manualDiscount = Math.round(cart.subtotal() * discountPct / 100)
    const finalTotal = Math.round(cart.subtotal() - manualDiscount - promoDiscount + serviceCharge + taxAmount)

    // Keyboard Shortcuts
    const searchInputRef = useRef<HTMLInputElement>(null)
    const allCategoryIds = useMemo(() => [
        "all",
        ...dbCategories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id),
    ], [dbCategories])


    // Filter products
    const filteredProducts = useMemo(() => {
        let products = dbProducts.filter((p) => p.isActive)

        if (activeCategory !== "all") {
            products = products.filter((p) => p.categoryId === activeCategory)
        }
        if (searchTerm) {
            const q = searchTerm.toLowerCase()
            products = products.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.nameVi?.toLowerCase().includes(q) ||
                    p.sku?.toLowerCase().includes(q)
            )
        }
        return products
    }, [activeCategory, searchTerm, dbProducts])

    const handleAddToCart = (product: Product, overrideTable?: FloorTable) => {
        const activeTable = overrideTable ?? cart.selectedTable
        // Require table selection for dine-in before adding products
        if (cart.orderType === "DINE_IN" && !activeTable) {
            pendingProductRef.current = product
            toast.error("Vui lòng chọn bàn cho đơn hàng", {
                description: `Chọn bàn để phục vụ món: ${product.name}`,
                duration: 3500,
                action: { label: "Chọn bàn", onClick: () => setTableModalOpen(true) },
            })
            setTableModalOpen(true)
            return
        }
        if (product86Ids.includes(product.id)) {
            toast.error(`Món "${product.name}" hiện đang tạm hết`, { description: "Sản phẩm tạm ngưng phục vụ", duration: 3000 })
            return
        }
        // Stock check for wine products
        const isWineType = ["WINE_BOTTLE", "WINE_GLASS", "WINE_TASTING"].includes(product.type)
        if (isWineType && !allowNegativeStock) {
            const stock = stockMap.get(product.id) ?? 0
            const inCart = cart.items.find(i => i.product.id === product.id)?.quantity ?? 0
            if (stock <= inCart && product.type === "WINE_BOTTLE") {
                toast.error(`Hết tồn kho: ${product.name}`, {
                    description: `Chỉ còn ${stock} chai. Xem gợi ý thay thế ↓`,
                    duration: 5000,
                })
                getAlternativesForOutOfStock(product.id).then((recs) => {
                    if (recs.length > 0) {
                        setRecommendations(recs)
                        setRecoSourceName(product.name)
                        setShowRecommendations(true)
                    }
                })
                return
            }
        }
        // By-glass: Open bottle selector
        if (product.isByGlass && isWineType) {
            setBottleSelectorProduct(product)
            Promise.all([
                getOpenedBottlesForProduct(product.id),
                getInStockBottlesForProduct(product.id),
            ]).then(([opened, inStock]) => {
                setOpenedBottles(opened)
                setInStockBottles(inStock)
                setShowBottleSelector(true)
            })
            return
        }
        cart.addItem(product)
        const tableSuffix = cart.orderType === "DINE_IN" && activeTable
            ? ` (Bàn ${activeTable.tableNumber})`
            : cart.orderType === "TAKEAWAY" ? " (Mang đi)" : ""
        toast.success(`+1 ${product.name}${tableSuffix}`, { duration: 1500 })
    }

    // 86 toggle via right-click
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; product: Product } | null>(null)

    const handleProductContextMenu = (e: React.MouseEvent, product: Product) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, product })
    }

    const handle86Toggle = async (product: Product) => {
        setContextMenu(null)
        const is86 = product86Ids.includes(product.id)
        if (is86) {
            await unmark86(product.id)
            setProduct86Ids((prev) => prev.filter((id) => id !== product.id))
            toast.success(`Đã mở bán lại: ${product.name}`, { duration: 2000 })
        } else {
            await markProduct86({
                productId: product.id,
                productName: product.name,
                reason: "Hết nguyên liệu",
                staffId: staff?.id ?? "unknown",
                staffName: staff?.fullName ?? "Staff",
            })
            setProduct86Ids((prev) => [...prev, product.id])
            toast.warning(`Đã báo tạm hết món: ${product.name}`, { duration: 2000 })
        }
    }

    // Phase 8A: Hold order
    const handleHoldOrder = async () => {
        if (cart.items.length === 0) { toast.error("Giỏ hàng trống"); return }
        const result = await holdOrder({
            tableId: cart.selectedTable?.id ?? null,
            tableNumber: cart.selectedTable?.tableNumber ?? null,
            orderType: cart.orderType,
            items: cart.items.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                note: item.note,
            })),
            subtotal: cart.subtotal(),
            staffId: staff?.id ?? "unknown",
            staffName: staff?.fullName ?? "Staff",
            label: cart.selectedTable?.tableNumber ?? `Hold #${heldOrders.length + 1}`,
        })
        if (result.success) {
            toast.success(`Đã giữ đơn: ${result.heldOrder?.label}`, { duration: 3000 })
            cart.clearCart()
            refreshHeld()
        } else {
            toast.error(result.error ?? "Lỗi")
        }
    }

    // Phase 8A: Recall held order
    const handleRecallHeld = async (id: string) => {
        const result = await recallHeldOrder(id)
        if (result.success && result.order) {
            // Restore cart items
            cart.clearCart()
            for (const item of result.order.items) {
                const product = dbProducts.find((p) => p.id === item.productId)
                if (product) {
                    for (let i = 0; i < item.quantity; i++) cart.addItem(product)
                    if (item.note) {
                        const cartItem = cart.items.find((ci) => ci.product.id === item.productId)
                        if (cartItem) cart.updateNote(cartItem.id, item.note)
                    }
                }
            }
            if (result.order.tableId) {
                const table = dbTables.find((t) => t.id === result.order!.tableId)
                if (table) cart.selectTable(table)
            }
            toast.success(`▶️ Đã khôi phục: ${result.order.label}`)
            refreshHeld()
        }
    }

    const handleNoteSubmit = (itemId: string) => {
        cart.updateNote(itemId, noteText)
        setNoteItemId(null)
        setNoteText("")
        toast.success("Đã lưu ghi chú")
    }

    const sendToKitchen = async () => {
        if (cart.items.length === 0) {
            toast.error("Giỏ hàng trống")
            return
        }
        if (cart.orderType === "DINE_IN" && !cart.selectedTable) {
            toast.error("Chọn bàn trước khi gửi bếp", {
                description: "Đơn tại bàn cần chọn số bàn để phục vụ",
                action: { label: "Chọn bàn", onClick: () => setTableModalOpen(true) }
            })
            setTableModalOpen(true)
            return
        }

        setIsSubmitting(true)
        try {
            // Case 1: Adding items to existing order (occupied table)
            if (activeOrderId) {
                const result = await addItemsToOrder(activeOrderId, cart.items)
                if (result.success && result.order) {
                    // Send newly added items to kitchen
                    await sendToKitchenAction(activeOrderId)
                    setLastOrder({
                        orderNumber: result.order.orderNumber,
                        total: result.order.total,
                    })
                    toast.success(
                        `Đã thêm ${cart.items.length} món vào ${result.order.orderNumber}`,
                        {
                            description: `${cart.selectedTable?.tableNumber} · Tổng mới: ₫${formatPrice(result.order.total)}`,
                            duration: 4000,
                        }
                    )
                    cart.clearCart()
                    setActiveOrderId(null)
                    setExistingOrderData(null)
                    setTimeout(() => setLastOrder(null), 5000)
                } else {
                    toast.error(result.error ?? "Không thể thêm món")
                }
            } else {
                // Case 2: Create new order
                const result = await createOrder({
                    tableId: cart.selectedTable?.id ?? null,
                    tableNumber: cart.selectedTable?.tableNumber ?? null,
                    orderType: cart.orderType,
                    items: cart.items,
                    staffId: staff?.id ?? "unknown",
                    staffName: staff?.fullName ?? "Staff",
                })

                if (result.success && result.order) {
                    // Send all items to kitchen
                    await sendToKitchenAction(result.order.id)
                    setLastOrder({
                        orderNumber: result.order.orderNumber,
                        total: result.order.total,
                    })
                    toast.success(
                        `Gửi bếp: ${result.order.orderNumber}`,
                        {
                            description: `${cart.selectedTable?.tableNumber ?? "Takeaway"} · ₫${formatPrice(result.order.total)} · ${cart.items.length} món`,
                            duration: 4000,
                        }
                    )
                    cart.clearCart()
                    setTimeout(() => setLastOrder(null), 5000)
                } else {
                    toast.error(result.error ?? "Không thể tạo đơn")
                }
            }
        } catch {
            toast.error("Lỗi hệ thống")
        }
        setIsSubmitting(false)
    }

    const handleCheckout = async (paymentMethod: PaymentMethod = "CASH") => {
        if (cart.items.length === 0) {
            toast.error("Giỏ hàng trống")
            return
        }
        if (cart.orderType === "DINE_IN" && !cart.selectedTable) {
            toast.error("Vui lòng chọn bàn", {
                description: "Đơn tại bàn cần chọn số bàn để thanh toán",
                action: { label: "Chọn bàn", onClick: () => setTableModalOpen(true) }
            })
            setTableModalOpen(true)
            return
        }

        setIsSubmitting(true)
        try {
            const result = await createOrder({
                tableId: cart.selectedTable?.id ?? null,
                tableNumber: cart.selectedTable?.tableNumber ?? null,
                orderType: cart.orderType,
                items: cart.items,
                staffId: staff?.id ?? "unknown",
                staffName: staff?.fullName ?? "Staff",
            })

            if (result.success && result.order) {
                // Pay + auto deduct NPL + COGS tracking
                const cogsResult = await processOrderWithCOGS(result.order.id, paymentMethod)

                setLastOrder({
                    orderNumber: result.order.orderNumber,
                    total: result.order.total,
                })

                // Main success toast
                const deductionInfo = cogsResult.deductions.length > 0
                    ? ` · Trừ NPL: ${cogsResult.deductions.length} SP`
                    : ""
                const paidOrder = result.order
                toast.success(
                    `${result.order.orderNumber}`,
                    {
                        description: `${cart.selectedTable?.tableNumber ?? "Takeaway"} · ₫${formatPrice(result.order.total)} · ${paymentMethod}${deductionInfo}`,
                        duration: 8000,
                        action: {
                            label: "In bill",
                            onClick: () => setReceiptOrder(paidOrder),
                        },
                    }
                )

                // Stock warnings
                if (cogsResult.stockWarnings.length > 0) {
                    for (const warning of cogsResult.stockWarnings) {
                        toast.warning(`${warning}`, {
                            duration: 6000,
                        })
                    }
                }

                // Deduction errors (not enough stock)
                if (cogsResult.errors.length > 0) {
                    for (const err of cogsResult.errors) {
                        toast.error(`NPL: ${err}`, { duration: 6000 })
                    }
                }

                // Wine bottle/glass tracking
                for (const item of cart.items) {
                    if (item.product.type === "WINE_GLASS" || item.product.isByGlass) {
                        const wineResult = await sellWineGlass({
                            productId: item.product.id,
                            quantity: item.quantity,
                            staffName: staff?.fullName ?? "Staff",
                        })
                        if (wineResult.success) {
                            if (wineResult.bottlesConsumed.length > 0) {
                                toast.info(`Chai hết: ${wineResult.bottlesConsumed.join(", ")}`, {
                                    duration: 5000,
                                })
                            }
                            if (wineResult.newBottleOpened) {
                                toast.info(`Mở chai mới: ${wineResult.newBottleOpened.batchCode}`, {
                                    description: `${wineResult.currentStatus?.glassesRemaining ?? 0} ly còn lại`,
                                    duration: 5000,
                                })
                            }
                        } else if (wineResult.error) {
                            toast.error(`${wineResult.error}`, { duration: 6000 })
                        }
                    } else if (item.product.type === "WINE_BOTTLE") {
                        const bottleResult = await sellWineBottle({
                            productId: item.product.id,
                            quantity: item.quantity,
                        })
                        if (bottleResult.success) {
                            toast.info(`Bán chai: ${bottleResult.bottlesSold.join(", ")}`, {
                                duration: 4000,
                            })
                        } else if (bottleResult.error) {
                            toast.warning(`${bottleResult.error}`, { duration: 6000 })
                        }
                    }
                }

                // Refresh glass statuses after wine operations
                refreshGlassStatuses()

                // PAY_FIRST: auto-send to kitchen after payment
                if (paymentMode === "PAY_FIRST") {
                    await sendToKitchenAction(result.order.id)
                    toast.info("Đã gửi bếp tự động (thanh toán trước)", { duration: 3000 })
                }

                cart.clearCart()
                setTimeout(() => setLastOrder(null), 5000)
            } else {
                toast.error(result.error ?? "Không thể tạo đơn")
            }
        } catch {
            toast.error("Lỗi hệ thống")
        }
        setIsSubmitting(false)
    }

    // Keyboard Shortcuts (after handleHoldOrder + sendToKitchen defs)
    usePOSShortcuts({
        onCategorySelect: (index) => {
            if (index < allCategoryIds.length) {
                setActiveCategory(allCategoryIds[index])
                const catName = index === 0 ? "Tất cả" : dbCategories.find((c) => c.id === allCategoryIds[index])?.name
                toast.success(`${catName ?? "Category"}`, { duration: 1000 })
            }
        },
        onFocusSearch: () => searchInputRef.current?.focus(),
        onSelectTable: () => setTableModalOpen(true),
        onPayOrder: () => {
            if (cart.items.length > 0) setCashModalOpen(true)
        },
        onHoldOrder: handleHoldOrder,
        onSendToKitchen: sendToKitchen,
        onApplyDiscount: () => setDiscountModalOpen(true),
        onEscape: () => {
            if (searchTerm) setSearchTerm("")
            else if (tableModalOpen) setTableModalOpen(false)
            else if (cashModalOpen) setCashModalOpen(false)
            else if (discountModalOpen) setDiscountModalOpen(false)
            else if (holdModalOpen) setHoldModalOpen(false)
            else if (showBottleSelector) setShowBottleSelector(false)
        },
        onClearCart: () => {
            if (cart.items.length > 0) {
                cart.clearCart()
                toast.success("Đã xóa giỏ hàng", { duration: 1500 })
            }
        },
    })

    const handleAddToTab = async (tabId: string) => {
        if (cart.items.length === 0) {
            toast.error("Giỏ hàng trống")
            return
        }

        setIsSubmitting(true)
        const result = await addMultipleTabItems({
            tabId,
            items: cart.items.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            })),
            tableId: cart.selectedTable?.id,
            tableNumber: cart.selectedTable?.tableNumber,
            staffId: staff?.id ?? "unknown",
            staffName: staff?.fullName ?? "Staff",
        })

        if (result.success && result.data) {
            toast.success(`Đã thêm ${cart.items.length} món vào tab`, {
                description: `${result.data.customer.fullName} · ₫${formatPrice(result.data.currentTotal)} / ₫${formatPrice(result.data.tabLimit)}`,
            })
            cart.clearCart()
            refreshTabs()

            // Warn at 80%
            if (result.data.currentTotal > result.data.tabLimit * 0.8) {
                toast.warning(`Tab gần đạt giới hạn`, {
                    description: `${result.data.customer.fullName}: ${Math.round((result.data.currentTotal / result.data.tabLimit) * 100)}%`,
                    duration: 6000,
                })
            }
        } else {
            toast.error(result.error?.message ?? "Không thể thêm vào tab")
        }
        setIsSubmitting(false)
    }

    // Show inline skeleton while data loads
    if (posLoading) {
        return <POSInlineSkeleton />
    }

    return (
        <div className="flex h-[100dvh] w-full max-w-[100vw] flex-col md:flex-row overflow-hidden bg-cream-50">
            {/* ============ LEFT: Product Grid ============ */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
                {/* Top Bar */}
                <div className="flex items-center gap-1.5 lg:gap-3 border-b border-cream-300 bg-cream-100 px-2 lg:px-4 py-2 lg:py-3 min-w-0 w-full overflow-x-auto scroll-hide-bar">
                    {/* Mobile: Open Navigation Drawer */}
                    {isMobile && (
                        <button
                            onClick={() => useSidebarStore.getState().setMobileOpen(true)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-cream-300 bg-cream-50 text-green-900 hover:bg-green-900 hover:text-cream-50 transition-all shrink-0"
                            title="Menu"
                        >
                            <MenuIcon className="h-4 w-4" />
                        </button>
                    )}
                    {/* Table / Takeaway toggle */}
                    <div className="flex items-center gap-1 rounded-lg border border-cream-300 bg-cream-50 p-0.5">
                        <button
                            onClick={() => {
                                cart.setOrderType("DINE_IN")
                                if (!cart.selectedTable) setTableModalOpen(true)
                            }}
                            className={cn(
                                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                                cart.orderType === "DINE_IN"
                                    ? "bg-green-900 text-cream-50 shadow-sm"
                                    : "text-cream-500 hover:text-green-900"
                            )}
                        >
                            <Armchair className="h-3.5 w-3.5" />
                            Tại bàn
                        </button>
                        <button
                            onClick={() => cart.setOrderType("TAKEAWAY")}
                            className={cn(
                                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                                cart.orderType === "TAKEAWAY"
                                    ? "bg-green-900 text-cream-50 shadow-sm"
                                    : "text-cream-500 hover:text-green-900"
                            )}
                        >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Mang đi
                        </button>
                    </div>

                    {/* Payment mode indicator */}
                    <div className={cn(
                        "hidden sm:block rounded-md px-2 py-1 text-[9px] font-bold",
                        paymentMode === "PAY_FIRST"
                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                            : "bg-green-50 text-green-600 border border-green-200"
                    )}>
                        {paymentMode === "PAY_FIRST" ? "TT Trước" : "TT Sau"}
                    </div>

                    {/* Table indicator */}
                    {cart.orderType === "DINE_IN" && (
                        <button
                            onClick={() => setTableModalOpen(true)}
                            className={cn(
                                "flex items-center gap-1.5 lg:gap-2 rounded-lg border px-2 lg:px-3 py-1.5 text-xs font-medium transition-all",
                                cart.selectedTable
                                    ? "border-green-600 bg-green-50 text-green-900"
                                    : "border-cream-400 bg-cream-200 text-cream-500 animate-pulse"
                            )}
                        >
                            <Armchair className="h-3.5 w-3.5" />
                            {cart.selectedTable ? (
                                <>
                                    {cart.selectedTable.tableNumber}
                                    <span className="hidden lg:inline text-cream-500">· {cart.selectedTable.seats} chỗ</span>
                                </>
                            ) : (
                                "Chọn bàn..."
                            )}
                        </button>
                    )}

                    {/* Open Tabs indicator — only show from xl (≥1280px with narrow sidebar) */}
                    <button
                        onClick={() => setOpenTabModal(true)}
                        className={cn(
                            "hidden xl:flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                            activeTabs.length > 0
                                ? "border-amber-500 bg-amber-50 text-amber-800"
                                : "border-cream-300 bg-cream-50 text-cream-500 hover:border-green-600 hover:text-green-700"
                        )}
                    >
                        <TabIcon className="h-3.5 w-3.5" />
                        {activeTabs.length > 0 ? (
                            <>
                                Tab
                                <Badge className="bg-amber-600 text-white text-[9px] px-1 py-0 ml-0.5">
                                    {activeTabs.length}
                                </Badge>
                            </>
                        ) : (
                            "Mở tab"
                        )}
                    </button>

                    {/* Search */}
                    <div className="relative flex-1 max-w-[200px] lg:max-w-xs ml-auto">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                        <Input
                            ref={searchInputRef}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm sản phẩm..."
                            className="h-8 pl-8 text-xs border-cream-300 bg-cream-50"
                        />
                    </div>

                    {/* Shift indicator — show from lg, but hide label text on lg to save space */}
                    <button
                        onClick={() => setShiftModalOpen(true)}
                        className={cn(
                            "hidden lg:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                            currentShift
                                ? "border-green-600 bg-green-50 text-green-800"
                                : "border-red-300 bg-red-50 text-red-700 animate-pulse"
                        )}
                    >
                        <Timer className="h-3.5 w-3.5" />
                        {currentShift ? (
                            <>
                                <span className="font-mono">{shiftElapsed}</span>
                                <span className="hidden 2xl:inline text-[10px] text-green-600">· ₫{formatPrice(currentShift.totalSales)}</span>
                            </>
                        ) : (
                            "Mở ca"
                        )}
                    </button>

                    {/* Notification bell */}
                    <div className="relative hidden sm:block">
                        <button
                            onClick={() => setNotifOpen(!notifOpen)}
                            className="relative rounded-lg border border-cream-300 bg-cream-50 p-1.5 text-cream-500 hover:text-green-700 hover:border-green-600 transition-all"
                        >
                            <Bell className="h-4 w-4" />
                            {notifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                                    {notifications.length}
                                </span>
                            )}
                        </button>

                        {/* Notification dropdown */}
                        {notifOpen && (
                            <div className="absolute right-0 top-10 z-50 w-72 lg:w-80 rounded-xl border border-cream-200 bg-white shadow-xl">
                                <div className="flex items-center justify-between px-4 py-2.5 border-b border-cream-200">
                                    <span className="text-xs font-bold text-green-900">Thông báo</span>
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={async () => { await markAllAsRead(); refreshNotifications(); toast.success("Đã đọc tất cả") }}
                                            className="text-[9px] text-blue-600 hover:underline"
                                        >
                                            Đánh dấu đã đọc
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-72 overflow-y-auto divide-y divide-cream-100">
                                    {notifications.length === 0 ? (
                                        <p className="text-center text-xs text-cream-400 py-6">Không có thông báo mới</p>
                                    ) : notifications.slice(0, 8).map((n) => (
                                        <div
                                            key={n.id}
                                            className={cn(
                                                "px-4 py-2.5 cursor-pointer hover:bg-cream-50 transition-all",
                                                !n.isRead && "bg-green-50/50"
                                            )}
                                            onClick={async () => { await markAsRead(n.id); refreshNotifications() }}
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className={cn(
                                                    "mt-0.5 flex h-2 w-2 rounded-full shrink-0",
                                                    n.priority === "CRITICAL" ? "bg-red-500" :
                                                        n.priority === "WARNING" ? "bg-amber-500" : "bg-blue-400"
                                                )} />
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold text-green-900 leading-tight">{n.title}</p>
                                                    <p className="text-[10px] text-cream-500 mt-0.5 leading-snug">{n.message}</p>
                                                    <p className="text-[9px] text-cream-400 mt-1">
                                                        {new Date(n.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto scroll-hide-bar border-b border-cream-300 bg-cream-100 px-4 py-2">
                    <button
                        onClick={() => setActiveCategory("all")}
                        className={cn(
                            "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                            activeCategory === "all"
                                ? "bg-green-900 text-cream-50 shadow-sm"
                                : "bg-cream-200 text-cream-500 hover:bg-cream-300 hover:text-green-900"
                        )}
                    >
                        Tất cả
                    </button>
                    {dbCategories.filter((c) => c.isActive).map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                                activeCategory === cat.id
                                    ? "bg-green-900 text-cream-50 shadow-sm"
                                    : "bg-cream-200 text-cream-500 hover:bg-cream-300 hover:text-green-900"
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <p className="text-sm text-cream-400">Không có sản phẩm</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 lg:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                            {filteredProducts.map((product) => {
                                const displayPrice =
                                    product.isByGlass && product.glassPrice
                                        ? product.glassPrice
                                        : product.sellPrice
                                const inCart = cart.items.find(
                                    (item) => item.product.id === product.id
                                )
                                const gs = glassStatuses[product.id]
                                const is86 = product86Ids.includes(product.id)

                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => handleAddToCart(product)}
                                        onContextMenu={(e) => handleProductContextMenu(e, product)}
                                        className={cn(
                                            "group relative flex flex-col rounded-xl border p-3 text-left transition-all",
                                            "touch-target card-hover",
                                            is86
                                                ? "border-cream-300 bg-cream-100/50 opacity-60"
                                                : inCart
                                                    ? "border-green-800/40 bg-white ring-1 ring-green-800/20 shadow-xs"
                                                    : "border-cream-300 bg-white hover:border-cream-400"
                                        )}
                                    >
                                        {/* Out of stock overlay */}
                                        {is86 && (
                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream-100/80 backdrop-blur-[1px] rounded-xl pointer-events-none">
                                                <span className="rounded-md border border-wine-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-wine-800 shadow-2xs">
                                                    Tạm hết hàng
                                                </span>
                                            </div>
                                        )}
                                        {/* Cart count pill */}
                                        {inCart && (
                                            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-800 text-[10px] font-bold text-cream-50 shadow-xs">
                                                {inCart.quantity}
                                            </span>
                                        )}

                                        {/* Header metadata row — unified, single-line, no broken badges */}
                                        <div className="mb-1.5 flex items-center justify-between text-[10px] text-cream-500 font-medium">
                                            <span className="uppercase tracking-wider">
                                                {product.type === "WINE_BOTTLE" ? "Rượu chai" :
                                                    product.type === "WINE_GLASS" ? "Rượu ly" :
                                                        product.type === "WINE_TASTING" ? "Tasting" :
                                                            product.type === "FOOD" ? "Món ăn" :
                                                                product.type === "DRINK" ? "Đồ uống" : "Khác"}
                                            </span>
                                            {/* Single cohesive stock/serving indicator */}
                                            {["WINE_BOTTLE", "WINE_GLASS", "WINE_TASTING"].includes(product.type) && (() => {
                                                const stock = stockMap.get(product.id) ?? 0
                                                if (stock <= 0) {
                                                    return <span className="text-wine-700 font-semibold">Hết kho</span>
                                                }
                                                if (product.isByGlass && gs && gs.glassesRemaining > 0) {
                                                    return <span className="text-green-800 font-medium">Mở {gs.glassesRemaining}/{gs.glassesTotal} ly</span>
                                                }
                                                return <span className="font-mono text-cream-400">Kho: {stock}</span>
                                            })()}
                                        </div>

                                        {/* Name */}
                                        <h3 className="text-sm font-semibold text-green-950 leading-snug line-clamp-2">
                                            {product.name}
                                        </h3>
                                        {product.nameVi && (
                                            <p className="mt-0.5 text-[10px] text-cream-400 line-clamp-1">
                                                {product.nameVi}
                                            </p>
                                        )}

                                        {/* Wine info subtitle */}
                                        {(product.type === "WINE_BOTTLE" || product.type === "WINE_GLASS" || product.type === "WINE_TASTING") && (
                                            <p className="hidden sm:block mt-1 text-[10px] text-cream-500 line-clamp-1">
                                                {product.alcoholPct && <span>{product.alcoholPct}%</span>}
                                                {product.alcoholPct && (product.region || product.country) && <span> · </span>}
                                                {product.region && <span>{product.region}</span>}
                                                {product.region && product.country && <span>, </span>}
                                                {!product.region && product.country && <span>{product.country}</span>}
                                            </p>
                                        )}

                                        {/* Price block */}
                                        <div className="mt-auto pt-2 flex items-baseline justify-between">
                                            <div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="font-mono text-sm font-bold text-green-950">
                                                        ₫{formatPrice(displayPrice)}
                                                    </span>
                                                    {product.isByGlass && product.glassPrice && (
                                                        <span className="text-[10px] text-cream-500">/ly</span>
                                                    )}
                                                </div>
                                                {product.isByGlass && product.sellPrice && (
                                                    <div className="text-[10px] text-wine-800 font-mono font-medium">
                                                        Chai: ₫{formatPrice(product.sellPrice)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* ============ MOBILE: Ergonomic Bottom Waiter Bar (Thumb Zone) ============ */}
                <MobileWaiterBar
                    orderType={cart.orderType}
                    selectedTable={cart.selectedTable}
                    itemCount={cart.itemCount()}
                    totalAmount={Math.round(cart.subtotal() * (1 + (taxRate.rate / 100)))}
                    activeOrderId={activeOrderId}
                    existingOrderTotal={existingOrderData?.total}
                    isSubmitting={isSubmitting}
                    onOpenTableSelector={() => setTableModalOpen(true)}
                    onOpenCart={() => setMobileCartOpen(true)}
                    onSendToKitchen={sendToKitchen}
                    onPayExistingOrder={() => {
                        if (existingOrderData) setPayingOrder(existingOrderData)
                    }}
                />
            </div>

            {/* ============ RIGHT: Cart (Side-by-side on iPad/Desktop >= md, Slide Drawer on Phone < md) ============ */}
            <div className={cn(
                "flex flex-col border-l border-cream-300 bg-cream-100",
                "fixed inset-0 z-50 md:relative md:inset-auto md:z-auto",
                "w-full md:w-[310px] lg:w-[340px] xl:w-[380px]",
                "transition-transform duration-300 ease-out",
                mobileCartOpen ? "translate-y-0" : "translate-y-full md:translate-y-0"
            )}>
                {/* Cart Header */}
                <div className="flex items-center justify-between border-b border-cream-300 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setMobileCartOpen(false)}
                            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-cream-500 hover:bg-cream-200 transition-all mr-1"
                        >
                            <ChevronDown className="h-5 w-5" />
                        </button>
                        <h2 className="font-display text-sm font-bold text-green-900">
                            Đơn hàng
                        </h2>
                        {cart.itemCount() > 0 && (
                            <Badge className="bg-green-700 text-cream-50 text-[10px] px-1.5 py-0">
                                {cart.itemCount()}
                            </Badge>
                        )}
                    </div>
                    {cart.items.length > 0 && (
                        <button
                            onClick={() => {
                                cart.clearCart()
                                toast("Đã xóa đơn hàng")
                            }}
                            className="rounded-md p-1 text-cream-400 hover:text-red-500 hover:bg-red-50 transition-all"
                            title="Xóa toàn bộ đơn"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Table / Serving Info Banner */}
                <div className="flex items-center justify-between border-b border-cream-200 bg-cream-50/90 px-4 py-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        {cart.orderType === "DINE_IN" ? (
                            cart.selectedTable ? (
                                <button
                                    onClick={() => setTableModalOpen(true)}
                                    className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-900 hover:bg-green-100 transition-all"
                                    title="Nhấn để đổi bàn khác"
                                >
                                    <Armchair className="h-3.5 w-3.5 text-green-700" />
                                    <span>Bàn {cart.selectedTable.tableNumber}</span>
                                    <span className="text-[10px] font-normal text-green-700">· {cart.selectedTable.seats} chỗ</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setTableModalOpen(true)}
                                    className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-all animate-pulse"
                                    title="Nhấn để chọn bàn phục vụ"
                                >
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                                    <span>Chưa chọn bàn — Chọn ngay</span>
                                </button>
                            )
                        ) : (
                            <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-700">
                                <ShoppingCart className="h-3.5 w-3.5 text-stone-500" />
                                <span>Mang đi (Takeaway)</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            if (cart.orderType === "DINE_IN") {
                                setTableModalOpen(true)
                            } else {
                                cart.setOrderType("DINE_IN")
                                if (!cart.selectedTable) setTableModalOpen(true)
                            }
                        }}
                        className="text-[11px] font-semibold text-green-800 hover:underline hover:text-green-900"
                    >
                        {cart.orderType === "DINE_IN"
                            ? (cart.selectedTable ? "Đổi bàn" : "Chọn bàn")
                            : "Đổi sang tại bàn"}
                    </button>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto">
                    {/* Existing order items (read-only) when editing occupied table */}
                    {existingOrderData && activeOrderId && (
                        <div className="bg-cream-50 border-b-2 border-wine-200">
                            <div className="px-4 py-2 bg-wine-50 border-b border-wine-100 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-wine-700">Đã order · {existingOrderData.orderNumber}</span>
                                </div>
                                <span className="font-mono text-[10px] font-bold text-wine-700">₫{formatPrice(existingOrderData.total)}</span>
                            </div>
                            <div className="divide-y divide-cream-200">
                                {existingOrderData.items.map((item) => (
                                    <div key={item.id} className="px-4 py-1.5 flex items-center justify-between opacity-70">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-cream-600 truncate">{item.productName}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-cream-400">×{item.quantity}</span>
                                            <span className="font-mono text-[10px] text-cream-500">₫{formatPrice(item.unitPrice * item.quantity)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Quick Pay button for existing order */}
                            <div className="px-4 py-2 border-t border-wine-100 flex gap-1.5">
                                <button
                                    onClick={() => setReceiptOrder(existingOrderData)}
                                    className="rounded-lg border border-wine-200 bg-wine-50 py-1.5 px-3 text-[10px] font-bold text-wine-700 hover:bg-wine-100 transition-all flex items-center gap-1"
                                    aria-label="In hoá đơn"
                                >
                                    In bill
                                </button>
                                <button
                                    onClick={() => setPayingOrder(existingOrderData)}
                                    className="flex-1 rounded-lg bg-green-700 py-1.5 text-[10px] font-bold text-white hover:bg-green-600 transition-all flex items-center justify-center gap-1"
                                >
                                    <Banknote className="h-3 w-3" />
                                    Thanh toán · ₫{formatPrice(existingOrderData.total)}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* New items label when adding to existing order */}
                    {existingOrderData && activeOrderId && cart.items.length > 0 && (
                        <div className="px-4 py-1.5 bg-green-50 border-b border-green-100 flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-green-700">Món mới ({cart.itemCount()})</span>
                        </div>
                    )}

                    {cart.items.length === 0 && !existingOrderData ? (
                        <div className="flex flex-col items-center justify-center h-full text-cream-400">
                            <p className="text-xs">Chưa có sản phẩm</p>
                            <p className="text-[10px] mt-1">Chọn sản phẩm bên trái</p>
                        </div>
                    ) : cart.items.length === 0 && existingOrderData ? (
                        <div className="flex flex-col items-center justify-center py-8 text-cream-400">
                            <p className="text-[10px]">Chọn món mới để thêm vào đơn</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-cream-300">
                            {cart.items.map((item) => (
                                <div key={item.id} className="px-4 py-2.5 group">
                                    <div className="flex items-start gap-2">
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <p className="text-xs font-semibold text-green-900 truncate flex-1">
                                                    {item.product.name}
                                                </p>
                                                {(item.product.type === "WINE_BOTTLE" || item.product.type === "WINE_GLASS" || item.product.type === "WINE_TASTING") && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setWineGuideProduct(item.product)
                                                        }}
                                                        className="shrink-0 rounded p-0.5 text-cream-400 hover:text-wine-700 hover:bg-wine-50 transition-all"
                                                        title="Wine Guide"
                                                    >
                                                        <Info className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="font-mono text-[10px] text-cream-400">
                                                ₫{formatPrice(item.unitPrice)} × {item.quantity}
                                            </p>
                                            {(item.note || item.notes) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setServingNoteItem(item)}
                                                    className="mt-1 flex items-center gap-1 rounded bg-cream-200/80 px-2 py-0.5 text-[10px] text-wine-800 font-medium italic hover:bg-cream-300 transition-colors w-fit text-left"
                                                    title="Bấm để sửa yêu cầu phục vụ"
                                                >
                                                    <span>📝 {item.note || item.notes}</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Line total */}
                                        <span className="font-mono text-xs font-bold text-green-900 whitespace-nowrap">
                                            ₫{formatPrice(item.unitPrice * item.quantity)}
                                        </span>
                                    </div>

                                    {/* Qty controls */}
                                    <div className="mt-1.5 flex items-center gap-1">
                                        <button
                                            onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                                            className="rounded-md border border-cream-300 p-1 hover:bg-cream-200 transition-all touch-target"
                                        >
                                            <Minus className="h-3 w-3 text-cream-500" />
                                        </button>
                                        <span className="w-6 text-center font-mono text-xs font-bold text-green-900">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                                            className="rounded-md border border-cream-300 p-1 hover:bg-cream-200 transition-all touch-target"
                                        >
                                            <Plus className="h-3 w-3 text-cream-500" />
                                        </button>

                                        {/* Quick Serving / Note button */}
                                        <button
                                            type="button"
                                            onClick={() => setServingNoteItem(item)}
                                            className={cn(
                                                "ml-auto rounded-md p-1.5 transition-all touch-target",
                                                (item.note || item.notes)
                                                    ? "text-wine-700 bg-wine-50 hover:bg-wine-100 ring-1 ring-wine-300"
                                                    : "text-cream-400 hover:text-green-700 hover:bg-cream-200"
                                            )}
                                            title="Yêu cầu phục vụ & ghi chú rượu"
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={() => cart.removeItem(item.id)}
                                            className="rounded-md p-1 text-cream-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>

                                    {/* Inline note input */}
                                    {noteItemId === item.id && (
                                        <div className="mt-2 flex gap-1">
                                            <Input
                                                value={noteText}
                                                onChange={(e) => setNoteText(e.target.value)}
                                                placeholder="Ghi chú..."
                                                className="h-7 text-xs border-cream-300"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleNoteSubmit(item.id)
                                                    if (e.key === "Escape") setNoteItemId(null)
                                                }}
                                                autoFocus
                                            />
                                            <Button
                                                onClick={() => handleNoteSubmit(item.id)}
                                                size="sm"
                                                className="h-7 px-2 bg-green-700 text-cream-50 text-xs"
                                            >
                                                OK
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Cart Footer — Totals + Actions */}
                {cart.items.length > 0 && (
                    <div className="border-t border-cream-300 bg-cream-50">
                        {/* Summary */}
                        <div className="px-4 py-3 space-y-1">
                            <div className="flex justify-between text-xs text-cream-500">
                                <span>Tạm tính ({cart.itemCount()} items)</span>
                                <span className="font-mono">₫{formatPrice(cart.subtotal())}</span>
                            </div>
                            {serviceCharge > 0 && (
                                <div className="flex justify-between text-xs text-cream-500">
                                    <span>Phí dịch vụ (5%)</span>
                                    <span className="font-mono">₫{formatPrice(serviceCharge)}</span>
                                </div>
                            )}
                            {discountPct > 0 && (
                                <div className="flex justify-between text-xs text-green-600">
                                    <span>Giảm giá ({discountPct}%)</span>
                                    <span className="font-mono">-₫{formatPrice(manualDiscount)}</span>
                                </div>
                            )}
                            {/* Applied Promotions */}
                            {appliedPromos.map((promo) => (
                                <div key={promo.id} className="flex justify-between text-xs text-wine-600">
                                    <span className="flex items-center gap-1">{promo.name}</span>
                                    <span className="font-mono">-₫{formatPrice(promo.discountAmount)}</span>
                                </div>
                            ))}
                            {/* Tax / VAT */}
                            {taxRate && taxAmount > 0 && (
                                <div className="flex justify-between text-xs text-cream-500">
                                    <span>{taxRate.name} ({taxRate.rate}%)</span>
                                    <span className="font-mono">₫{formatPrice(taxAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold text-green-900 pt-1 border-t border-cream-200">
                                <span>Tổng cộng</span>
                                <span className="font-mono text-lg">₫{formatPrice(finalTotal)}</span>
                            </div>
                        </div>

                        {/* Quick Cash + Hold + Discount */}
                        <div className="flex items-center gap-1 px-4 pb-1.5">
                            <span className="text-[9px] font-bold uppercase text-cream-400 mr-1">Nhanh:</span>
                            {[100000, 200000, 500000].map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => {
                                        if (cart.items.length === 0) { toast.error("Giỏ hàng trống"); return }
                                        setCashReceived(amt)
                                        setCashModalOpen(true)
                                    }}
                                    className="rounded-md bg-cream-200 px-2 py-1 text-[9px] font-mono font-bold text-cream-600 hover:bg-green-100 hover:text-green-800 transition-all"
                                >
                                    {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}K`}
                                </button>
                            ))}
                            <button
                                onClick={handleHoldOrder}
                                className="ml-auto rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700 hover:bg-amber-100 transition-all flex items-center gap-0.5"
                            >
                                <Pause className="h-2.5 w-2.5" /> Giữ
                            </button>
                            <button
                                onClick={() => setDiscountModalOpen(true)}
                                className="rounded-md border border-cream-300 bg-cream-100 px-2 py-1 text-[9px] font-bold text-cream-600 hover:border-green-600 hover:text-green-700 transition-all flex items-center gap-0.5"
                            >
                                <Percent className="h-2.5 w-2.5" /> Giảm
                            </button>
                        </div>

                        {/* Held Orders Quick List */}
                        {heldOrders.length > 0 && (
                            <div className="px-4 pb-1.5">
                                <div className="flex flex-wrap gap-1">
                                    {heldOrders.map((h) => (
                                        <button
                                            key={h.id}
                                            onClick={() => handleRecallHeld(h.id)}
                                            className="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-700 hover:bg-blue-100 transition-all"
                                        >
                                            <Play className="h-2 w-2" />
                                            {h.label} · ₫{formatPrice(h.subtotal)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Payment Buttons */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 px-4 pb-2">
                            <button
                                onClick={() => {
                                    if (cart.items.length === 0) {
                                        if (existingOrderData && activeOrderId) {
                                            setPayingOrder(existingOrderData)
                                            return
                                        }
                                        toast.error("Giỏ hàng trống")
                                        return
                                    }
                                    setCashReceived(0)
                                    setCashModalOpen(true)
                                }}
                                disabled={isSubmitting}
                                className="flex flex-col items-center gap-1 rounded-xl border border-cream-300 bg-cream-100 py-2.5 text-[10px] font-medium text-cream-500 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                            >
                                <Banknote className="h-4 w-4" />
                                Tiền mặt
                            </button>
                            <button
                                onClick={() => {
                                    if (cart.items.length === 0 && existingOrderData && activeOrderId) {
                                        setPayingOrder(existingOrderData)
                                        return
                                    }
                                    handleCheckout("CARD")
                                }}
                                disabled={isSubmitting}
                                className="flex flex-col items-center gap-1 rounded-xl border border-cream-300 bg-cream-100 py-2.5 text-[10px] font-medium text-cream-500 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                            >
                                <CreditCard className="h-4 w-4" />
                                Thẻ
                            </button>
                            <button
                                onClick={async () => {
                                    if (cart.items.length === 0) {
                                        if (existingOrderData && activeOrderId) {
                                            setPayingOrder(existingOrderData)
                                            return
                                        }
                                        toast.error("Giỏ hàng trống")
                                        return
                                    }
                                    setQrLoading(true)
                                    try {
                                        const config = await getBankConfig()
                                        setQrBankConfig(config)
                                        const orderNum = `ORD-${Date.now().toString().slice(-6)}`
                                        const result = await generateQRPayment({
                                            orderId: orderNum,
                                            amount: cart.subtotal(),
                                            description: `${orderNum} NoonNoir`,
                                        })
                                        if (result.success && result.data) {
                                            setQrPayment(result.data)
                                            setQrModalOpen(true)
                                        }
                                    } catch { toast.error("Lỗi tạo QR") }
                                    setQrLoading(false)
                                }}
                                disabled={isSubmitting || qrLoading}
                                className="flex flex-col items-center gap-1 rounded-xl border border-cream-300 bg-cream-100 py-2.5 text-[10px] font-medium text-cream-500 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                            >
                                <QrCode className="h-4 w-4" />
                                {qrLoading ? "Đang tạo..." : "QR Pay"}
                            </button>
                        </div>

                        {/* Add to Tab */}
                        {activeTabs.length > 0 && (
                            <div className="px-4 pb-1">
                                <div className="grid grid-cols-1 gap-1">
                                    {activeTabs.slice(0, 2).map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleAddToTab(tab.id)}
                                            disabled={isSubmitting}
                                            className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-all disabled:opacity-50"
                                        >
                                            <TabIcon className="h-3 w-3" />
                                            <span className="truncate">→ Tab {tab.customer.fullName.split(' ').pop()}</span>
                                            <span className="ml-auto font-mono text-[10px] text-amber-600">
                                                ₫{formatPrice(tab.currentTotal)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active order indicator */}
                        {activeOrderId && cart.selectedTable && (
                            <div className="mx-4 mb-2 rounded-lg bg-wine-50 border border-wine-200 px-3 py-2 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-wine-700">Thêm món vào bàn {cart.selectedTable.tableNumber}</p>
                                    <p className="text-[9px] text-wine-500">Các món mới sẽ được thêm vào đơn hiện tại</p>
                                </div>
                                <button onClick={() => { setActiveOrderId(null); setExistingOrderData(null); cart.clearCart() }} className="text-[10px] text-wine-400 hover:text-wine-700 font-medium">Hủy</button>
                            </div>
                        )}

                        {/* Main Action Button */}
                        <div className="px-4 pb-3">
                            {paymentMode === "PAY_FIRST" && !activeOrderId ? (
                                /* PAY_FIRST: Button = Thanh toán ngay (auto-sends to kitchen after) */
                                <Button
                                    onClick={() => handleCheckout("CASH")}
                                    disabled={isSubmitting || cart.items.length === 0}
                                    className="w-full font-semibold bg-green-700 text-white hover:bg-green-600 disabled:opacity-70"
                                    size="lg"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Banknote className="mr-2 h-4 w-4" />
                                    )}
                                    {isSubmitting
                                        ? "Đang xử lý..."
                                        : `Thanh toán · ₫${formatPrice(cart.subtotal())}`}
                                </Button>
                            ) : (
                                /* PAY_AFTER: Button = Gửi bếp (pay later) */
                                <Button
                                    onClick={sendToKitchen}
                                    disabled={isSubmitting}
                                    className={cn(
                                        "w-full font-semibold disabled:opacity-70",
                                        activeOrderId
                                            ? "bg-wine-700 text-white hover:bg-wine-600"
                                            : "bg-green-900 text-cream-50 hover:bg-green-800"
                                    )}
                                    size="lg"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Receipt className="mr-2 h-4 w-4" />
                                    )}
                                    {isSubmitting
                                        ? "Đang gửi..."
                                        : activeOrderId
                                            ? `Thêm ${cart.itemCount()} món · ₫${formatPrice(cart.subtotal())}`
                                            : `Gửi bếp · ₫${formatPrice(cart.subtotal())}`}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ============ PUSH SALE SIDEBAR (V2 Feature 6) ============ */}
            <div className={cn(
                "hidden lg:flex flex-col border-l border-cream-300 bg-cream-50 transition-all duration-300",
                pushSidebarOpen ? "w-[260px]" : "w-10"
            )}>
                {/* Toggle */}
                <button
                    onClick={() => setPushSidebarOpen(!pushSidebarOpen)}
                    className="flex items-center justify-center border-b border-cream-300 bg-wine-50 py-2.5 text-wine-700 hover:bg-wine-100 transition-all"
                >
                    {pushSidebarOpen ? (
                        <div className="flex items-center gap-1.5 px-2">
                            <span className="text-xs font-bold">Push Sale</span>
                            {pushSaleItems.length > 0 && (
                                <Badge className="bg-wine-700 text-white text-[9px] px-1.5 py-0">
                                    {pushSaleItems.length}
                                </Badge>
                            )}
                            {cart.orderType === "DINE_IN" && (
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded ml-1 truncate max-w-[90px]",
                                    cart.selectedTable ? "text-green-800 bg-green-100" : "text-amber-800 bg-amber-100"
                                )}>
                                    {cart.selectedTable ? `Bàn ${cart.selectedTable.tableNumber}` : "Chưa bàn"}
                                </span>
                            )}
                            <ChevronRight className="h-3 w-3 ml-auto" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] [writing-mode:vertical-rl]">Push</span>
                            {pushSaleItems.length > 0 && (
                                <Badge className="bg-wine-700 text-white text-[8px] px-1 py-0">
                                    {pushSaleItems.length}
                                </Badge>
                            )}
                        </div>
                    )}
                </button>

                {/* Sidebar Content */}
                {pushSidebarOpen && (
                    <div className="flex-1 overflow-y-auto">
                        {pushSaleItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-cream-400 px-4">
                                <p className="text-xs text-center">Không có hàng cần push sale</p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-2">
                                {pushSaleItems.map((item) => {
                                    const product = dbProducts.find(p => p.id === item.productId)
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                if (product) {
                                                    handleAddToCart(product)
                                                } else {
                                                    toast.error("Không tìm thấy sản phẩm")
                                                }
                                            }}
                                            className={cn(
                                                "rounded-lg border p-2.5 transition-all hover:shadow-md cursor-pointer active:scale-[0.98]",
                                                item.urgency === "HIGH"
                                                    ? "border-red-200 bg-red-50 hover:border-red-300"
                                                    : item.urgency === "MEDIUM"
                                                        ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                                                        : "border-cream-200 bg-cream-100 hover:border-cream-300"
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-green-900 truncate">
                                                        {item.productName}
                                                    </p>
                                                    <p className={cn(
                                                        "text-[9px] font-medium",
                                                        item.urgency === "HIGH" ? "text-red-600" :
                                                            item.urgency === "MEDIUM" ? "text-amber-600" : "text-cream-500"
                                                    )}>
                                                        {item.reason}
                                                    </p>
                                                    <p className="text-[9px] text-cream-400 mt-0.5">
                                                        {item.detail}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-2">
                                                <Badge className={cn(
                                                    "text-[9px] px-1.5 py-0",
                                                    item.urgency === "HIGH" ? "bg-red-100 text-red-700 border-red-200" :
                                                        item.urgency === "MEDIUM" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                            "bg-cream-200 text-cream-600 border-cream-300"
                                                )}>
                                                    Giảm {item.suggestedDiscount}%
                                                </Badge>
                                                <span className="text-[9px] font-mono text-cream-400">
                                                    ₫{formatPrice(Math.round(item.currentPrice * (1 - item.suggestedDiscount / 100)))}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (product) {
                                                            handleAddToCart(product)
                                                        } else {
                                                            toast.error("Không tìm thấy sản phẩm")
                                                        }
                                                    }}
                                                    className="ml-auto rounded-md bg-green-700 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-green-600 transition-all"
                                                >
                                                    + Giỏ
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toast.info(`Áp dụng giảm ${item.suggestedDiscount}% cho ${item.productName} — cần PIN Manager`, {
                                                            action: {
                                                                label: "Duyệt",
                                                                onClick: () => setDiscountModalOpen(true),
                                                            },
                                                        })
                                                    }}
                                                    className="rounded-md bg-wine-700 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-wine-600 transition-all"
                                                >
                                                    Giảm giá
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Context Menu (86 + Wine Guide) */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-50 min-w-[200px] rounded-xl border border-cream-300 bg-cream-50 shadow-2xl overflow-hidden"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <div className="px-3 py-2 border-b border-cream-200 bg-cream-100">
                            <p className="text-[10px] font-bold text-green-900 truncate">{contextMenu.product.name}</p>
                        </div>
                        {/* Wine Guide option for wine products */}
                        {(contextMenu.product.type === "WINE_BOTTLE" || contextMenu.product.type === "WINE_GLASS" || contextMenu.product.type === "WINE_TASTING") && (
                            <button
                                onClick={() => {
                                    setWineGuideProduct(contextMenu.product)
                                    setContextMenu(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-wine-700 hover:bg-wine-50 transition-all border-b border-cream-100"
                            >
                                <BookOpen className="h-3.5 w-3.5" />
                                Sổ tay rượu vang
                            </button>
                        )}
                        <button
                            onClick={() => handle86Toggle(contextMenu.product)}
                            className={cn(
                                "w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-all",
                                product86Ids.includes(contextMenu.product.id)
                                    ? "text-green-700 hover:bg-green-50"
                                    : "text-red-700 hover:bg-red-50"
                            )}
                        >
                            {product86Ids.includes(contextMenu.product.id) ? (
                                <>Mở bán lại món</>
                            ) : (
                                <>Báo tạm hết món</>
                            )}
                        </button>
                    </div>
                </>
            )}

            {/* Table Selector Modal */}
            <TableSelector
                open={tableModalOpen}
                onClose={() => {
                    setTableModalOpen(false)
                    pendingProductRef.current = null
                }}
                zones={dbZones}
                tables={dbTables}
                onSelect={(table) => {
                    cart.selectTable(table)
                    setActiveOrderId(null)
                    refreshFloorData()
                    const pendingProd = pendingProductRef.current
                    pendingProductRef.current = null
                    if (pendingProd) {
                        handleAddToCart(pendingProd, table)
                    }
                }}
                onSelectOccupied={(table, order) => {
                    cart.selectTable(table)
                    setActiveOrderId(order.id)
                    setExistingOrderData(order)
                    toast.info(`Bàn ${table.tableNumber} — thêm món vào đơn ${order.orderNumber}`)
                    const pendingProd = pendingProductRef.current
                    pendingProductRef.current = null
                    if (pendingProd) {
                        handleAddToCart(pendingProd, table)
                    }
                }}
                onPayOrder={(order) => setPayingOrder(order)}
            />

            {/* Cashier Counter Checkout Modal (Numpad + VietQR + Split Bill) */}
            {payingOrder && (
                <CashierCheckoutModal
                    open={!!payingOrder}
                    order={payingOrder}
                    staffName={staff?.fullName ?? "Staff"}
                    onClose={() => setPayingOrder(null)}
                    onPaidSuccess={(paidOrd) => {
                        setPayingOrder(null)
                        setExistingOrderData(null)
                        setActiveOrderId(null)
                        refreshFloorData()
                        setReceiptOrder(paidOrd)
                    }}
                    onSplitSuccess={() => {
                        refreshFloorData()
                    }}
                />
            )}

            {/* Receipt Print Modal */}
            {receiptOrder && (
                <ReceiptPrintFrame
                    order={receiptOrder}
                    onClose={() => setReceiptOrder(null)}
                />
            )}

            {/* Quick Serving & Modifiers Modal (Waiter Handheld) */}
            <QuickServingModal
                open={!!servingNoteItem}
                onClose={() => setServingNoteItem(null)}
                item={servingNoteItem}
                onSaveNote={(itemId, note) => {
                    cart.updateNote(itemId, note)
                    toast.success("Đã lưu yêu cầu phục vụ")
                }}
            />

            {/* Open Tab Modal */}
            {openTabModal && (
                <OpenTabModal
                    activeTabs={activeTabs}
                    onClose={() => setOpenTabModal(false)}
                    onTabOpened={() => { setOpenTabModal(false); refreshTabs() }}
                    onViewTab={(id) => { setOpenTabModal(false); setTabDetailModal(id) }}
                    staffId={staff?.id ?? "unknown"}
                    staffName={staff?.fullName ?? "Staff"}
                />
            )}

            {/* Tab Detail Modal */}
            {tabDetailModal && (
                <TabDetailModal
                    tabId={tabDetailModal}
                    onClose={() => { setTabDetailModal(null); refreshTabs() }}
                />
            )}

            {/* Shift Modal */}
            {shiftModalOpen && (
                <ShiftModal
                    currentShift={currentShift}
                    staffId={staff?.id ?? "unknown"}
                    staffName={staff?.fullName ?? "Staff"}
                    staffRole={staff?.role ?? "OWNER"}
                    onClose={() => setShiftModalOpen(false)}
                    onShiftChange={() => { setShiftModalOpen(false); refreshShift() }}
                />
            )}

            {/* Success Flash */}
            {lastOrder && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right fade-in duration-300">
                    <div className="flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-4 py-3 shadow-lg">
                        <div>
                            <p className="text-sm font-bold text-green-900">{lastOrder.orderNumber}</p>
                            <p className="font-mono text-xs text-green-600">₫{formatPrice(lastOrder.total)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ QR Payment Modal ============ */}
            {qrModalOpen && qrPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-[380px] rounded-2xl border border-cream-300 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-green-900 text-cream-50 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-display text-sm font-bold">Thanh toán QR</span>
                            </div>
                            <button
                                onClick={async () => {
                                    if (qrPayment) await cancelQRPayment(qrPayment.id)
                                    setQrModalOpen(false)
                                    setQrPayment(null)
                                }}
                                className="text-cream-300 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Bank Info */}
                        {qrBankConfig && (
                            <div className="px-5 py-3 border-b border-cream-200 bg-cream-50">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-green-900">{qrBankConfig.bankName}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1 text-[10px] text-cream-500">
                                    <span>STK: <span className="font-mono font-bold text-green-800">{qrBankConfig.accountNumber}</span></span>
                                    <span>Chủ TK: <span className="font-bold text-green-800">{qrBankConfig.accountName}</span></span>
                                </div>
                            </div>
                        )}

                        {/* QR Code */}
                        <div className="px-5 py-4 flex flex-col items-center">
                            <div className="rounded-xl border-2 border-green-200 bg-white p-2 shadow-inner">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={qrPayment.qrDataUrl}
                                    alt="VietQR Code"
                                    className="w-52 h-52 object-contain"
                                />
                            </div>
                            <div className="mt-3 text-center">
                                <p className="text-[10px] text-cream-400">Số tiền thanh toán</p>
                                <p className="font-mono text-2xl font-bold text-green-800">₫{new Intl.NumberFormat("vi-VN").format(qrPayment.amount)}</p>
                                <p className="text-[10px] text-cream-400 mt-1">Nội dung: <span className="font-mono font-bold">{qrPayment.description}</span></p>
                            </div>
                            <div className="mt-2 text-[9px] text-cream-400 flex items-center gap-1">
                                Hết hạn: {new Date(qrPayment.expiresAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-5 pb-4 flex gap-2">
                            <button
                                onClick={async () => {
                                    if (qrPayment) await cancelQRPayment(qrPayment.id)
                                    setQrModalOpen(false)
                                    setQrPayment(null)
                                }}
                                className="flex-1 rounded-xl border border-cream-300 py-2.5 text-xs font-medium text-cream-500 hover:bg-cream-100 transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={async () => {
                                    if (qrPayment) {
                                        await confirmQRPayment(qrPayment.id)
                                        setQrModalOpen(false)
                                        setQrPayment(null)
                                        await handleCheckout("QR")
                                    }
                                }}
                                disabled={isSubmitting}
                                className="flex-1 rounded-xl bg-green-700 py-2.5 text-xs font-bold text-white hover:bg-green-800 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Xác nhận đã nhận tiền
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Discount Authorization Modal ============ */}
            {discountModalOpen && (
                <DiscountAuthModal
                    subtotal={cart.subtotal()}
                    staffId={staff?.id ?? "unknown"}
                    staffName={staff?.fullName ?? "Staff"}
                    onClose={() => setDiscountModalOpen(false)}
                    onAuthorized={(pct: number) => {
                        setDiscountPct(pct)
                        setDiscountModalOpen(false)
                        toast.success(`Giảm giá ${pct}% đã được duyệt`)
                    }}
                />
            )}

            {/* ============ Upcoming Reservations Indicator ============ */}
            {upcomingReservations.length > 0 && (
                <div className="fixed bottom-4 left-4 z-40">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 shadow-lg px-4 py-2.5 max-w-xs">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold uppercase text-blue-700">Đặt bàn sắp tới</span>
                            <Badge className="bg-blue-600 text-white text-[8px] px-1 py-0">{upcomingReservations.length}</Badge>
                        </div>
                        <div className="space-y-1">
                            {upcomingReservations.slice(0, 3).map((r) => (
                                <div key={r.id} className="flex items-center gap-2 text-[10px]">
                                    <span className="font-mono font-bold text-blue-800">{r.time}</span>
                                    <span className="text-blue-600 truncate">{r.customerName}</span>
                                    <span className="text-blue-400">{r.guestCount} khách</span>
                                    {r.tableNumber && <span className="font-bold text-blue-700">{r.tableNumber}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* ============ CASH PAYMENT MODAL ============ */}
            {cashModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setCashModalOpen(false)}>
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-cream-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-green-900 px-6 py-4 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Banknote className="h-5 w-5" />
                                    <h3 className="font-display text-lg font-bold">Thanh toán tiền mặt</h3>
                                </div>
                                <button onClick={() => setCashModalOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition-all">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5">
                            {/* Order Total */}
                            <div className="text-center">
                                <p className="text-xs text-cream-500 uppercase font-bold mb-1">Tổng cộng</p>
                                <p className="font-mono text-3xl font-bold text-green-900">₫{formatPrice(finalTotal)}</p>
                                {(manualDiscount > 0 || promoDiscount > 0) && (
                                    <p className="mt-1 text-xs text-green-600">
                                        Đã giảm: ₫{formatPrice(manualDiscount + promoDiscount)}
                                    </p>
                                )}
                                {taxAmount > 0 && (
                                    <p className="text-[10px] text-cream-400">Đã bao gồm {taxRate?.name}: ₫{formatPrice(taxAmount)}</p>
                                )}
                            </div>

                            {/* Quick Denomination Buttons */}
                            <div>
                                <p className="text-[10px] font-bold uppercase text-cream-400 mb-2">Chọn nhanh</p>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                                    {[100000, 200000, 500000, 1000000, 2000000].map((amt) => (
                                        <button
                                            key={amt}
                                            onClick={() => setCashReceived(amt)}
                                            className={cn(
                                                "rounded-lg border-2 py-2.5 font-mono text-xs font-bold transition-all",
                                                cashReceived === amt
                                                    ? "border-green-600 bg-green-50 text-green-800"
                                                    : "border-cream-200 bg-cream-50 text-cream-600 hover:border-green-400 hover:bg-green-50"
                                            )}
                                        >
                                            {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}K`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Input & Numpad */}
                            <div>
                                <div className="relative mb-2">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-400 font-bold">₫</span>
                                    <input
                                        type="number"
                                        value={cashReceived || ""}
                                        onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                                        placeholder="Nhập số tiền khách đưa..."
                                        className="w-full rounded-xl border-2 border-cream-200 bg-cream-50 py-2.5 pl-8 pr-4 font-mono text-lg font-bold text-green-900 placeholder:text-cream-300 focus:border-green-500 focus:outline-hidden"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "DEL"].map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => {
                                                if (key === "DEL") {
                                                    const str = cashReceived.toString()
                                                    setCashReceived(str.length > 1 ? Number(str.slice(0, -1)) : 0)
                                                } else if (key === "000") {
                                                    setCashReceived(prev => prev * 1000)
                                                } else {
                                                    const str = cashReceived === 0 ? key : `${cashReceived}${key}`
                                                    setCashReceived(Number(str))
                                                }
                                            }}
                                            className={cn(
                                                "h-10 rounded-xl border font-mono text-sm font-bold transition-all active:scale-95 shadow-2xs touch-target",
                                                key === "DEL"
                                                    ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                                    : key === "000"
                                                        ? "border-cream-300 bg-cream-200 text-green-900"
                                                        : "border-cream-300 bg-white text-green-950 hover:bg-cream-100"
                                            )}
                                        >
                                            {key === "DEL" ? "⌫" : key}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Change Calculation */}
                            {cashReceived > 0 && (
                                <div className={cn(
                                    "rounded-xl border-2 p-4 text-center transition-all",
                                    cashReceived >= finalTotal
                                        ? "border-green-300 bg-green-50"
                                        : "border-red-200 bg-red-50"
                                )}>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-cream-500">Khách đưa:</span>
                                        <span className="font-mono font-bold text-green-900">₫{formatPrice(cashReceived)}</span>
                                    </div>
                                    <div className="h-px bg-cream-200 my-2" />
                                    <div className="flex items-center justify-between">
                                        <span className={cn("text-sm font-bold", cashReceived >= finalTotal ? "text-green-700" : "text-red-600")}>
                                            {cashReceived >= finalTotal ? "Tiền trả lại:" : "Còn thiếu:"}
                                        </span>
                                        <span className={cn(
                                            "font-mono text-xl font-bold",
                                            cashReceived >= finalTotal ? "text-green-700" : "text-red-600"
                                        )}>
                                            ₫{formatPrice(Math.abs(cashReceived - finalTotal))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-cream-200 bg-cream-50 px-6 py-4 flex items-center gap-3">
                            <button
                                onClick={() => setCashModalOpen(false)}
                                className="flex-1 rounded-xl border border-cream-300 bg-white py-2.5 text-xs font-bold text-cream-500 hover:bg-cream-100 transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => {
                                    setCashModalOpen(false)
                                    handleCheckout("CASH")
                                }}
                                disabled={cashReceived < finalTotal || cashReceived === 0}
                                className={cn(
                                    "flex-1 rounded-xl py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2",
                                    cashReceived >= finalTotal && cashReceived > 0
                                        ? "bg-green-700 text-white hover:bg-green-800 shadow-md"
                                        : "bg-cream-200 text-cream-400 cursor-not-allowed"
                                )}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Xác nhận thanh toán
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Bottle Selector for Glass Sales ============ */}
            {showBottleSelector && bottleSelectorProduct && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowBottleSelector(false)}>
                    <div
                        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-green-900 flex items-center gap-2">
                                    <Wine className="h-5 w-5 text-wine-600" /> Chọn chai rót ly
                                </h3>
                                <p className="text-xs text-cream-500 mt-0.5">
                                    {bottleSelectorProduct.name} · ₫{formatPrice(Number(bottleSelectorProduct.glassPrice ?? 0))}/ly
                                </p>
                            </div>
                            <button onClick={() => setShowBottleSelector(false)} className="rounded-lg p-2 hover:bg-cream-200 transition-all">
                                <X className="h-4 w-4 text-cream-500" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                            {/* Whole bottle sale option */}
                            {bottleSelectorProduct.sellPrice > 0 && (
                                <div className="rounded-xl border border-wine-200 bg-wine-50/70 p-3.5 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-wine-950">Bán nguyên chai</span>
                                            <Badge className="bg-wine-700 text-white text-[9px] px-1.5 py-0 font-medium">Nguyên chai</Badge>
                                        </div>
                                        <p className="text-xs font-mono font-bold text-wine-800 mt-0.5">
                                            ₫{formatPrice(bottleSelectorProduct.sellPrice)} / chai
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            cart.addItem(bottleSelectorProduct, { unit: "BOTTLE", unitPrice: bottleSelectorProduct.sellPrice })
                                            toast.success(`+1 ${bottleSelectorProduct.name} (Nguyên chai)`, { duration: 2000 })
                                            setShowBottleSelector(false)
                                        }}
                                        className="bg-wine-700 text-white hover:bg-wine-800 text-xs font-bold rounded-lg h-9 px-3.5 shadow-xs flex items-center gap-1.5"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>Bán cả chai</span>
                                    </Button>
                                </div>
                            )}

                            {/* Opened Bottles */}
                            {openedBottles.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-green-800 uppercase mb-2 flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Chai đang mở ({openedBottles.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {openedBottles.map((bottle) => {
                                            const oxPct = bottle.maxOxidationHours > 0 ? Math.min(100, (bottle.oxidationHours / bottle.maxOxidationHours) * 100) : 0
                                            const glassRatio = bottle.glassesTotal > 0 ? ((bottle.glassesTotal - bottle.glassesRemaining) / bottle.glassesTotal) * 100 : 0
                                            return (
                                                <button
                                                    key={bottle.id}
                                                    onClick={async () => {
                                                        const result = await pourFromBottle({
                                                            bottleId: bottle.id,
                                                            glasses: 1,
                                                            staffId: staff?.id ?? "",
                                                        })
                                                        if (result.success) {
                                                            cart.addItem(bottleSelectorProduct!)
                                                            toast.success(`Rót 1 ly từ ${bottle.batchCode}`, {
                                                                description: result.bottleFinished ? "Chai đã hết!" : `Còn ${bottle.glassesRemaining - 1} ly`,
                                                                duration: 2000,
                                                            })
                                                            setShowBottleSelector(false)
                                                            refreshStockMap()
                                                        } else {
                                                            toast.error(result.error ?? "Lỗi")
                                                        }
                                                    }}
                                                    disabled={bottle.glassesRemaining <= 0}
                                                    className={cn(
                                                        "w-full rounded-xl border p-3 text-left transition-all hover:shadow-md",
                                                        bottle.isExpired ? "border-red-300 bg-red-50 hover:border-red-400" :
                                                            oxPct > 70 ? "border-amber-300 bg-amber-50 hover:border-amber-400" :
                                                                "border-green-200 bg-green-50 hover:border-green-400",
                                                        bottle.glassesRemaining <= 0 && "opacity-40 cursor-not-allowed"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-green-900">{bottle.batchCode}</span>
                                                                {bottle.isExpired && <Badge className="bg-red-600 text-white text-[8px] px-1.5 py-0">Oxy hóa</Badge>}
                                                            </div>
                                                            <p className="text-[10px] text-cream-500 mt-0.5">
                                                                Mở bởi {bottle.openedByName ?? "—"} · {bottle.oxidationHours}h trước
                                                            </p>

                                                            {/* Glass progress */}
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <div className="flex-1 h-2 rounded-full bg-cream-200 overflow-hidden">
                                                                    <div className="h-full rounded-full bg-wine-600 transition-all" style={{ width: `${glassRatio}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-green-800 whitespace-nowrap">
                                                                    {bottle.glassesPoured}/{bottle.glassesTotal} ly
                                                                </span>
                                                            </div>

                                                            {/* Oxidation progress */}
                                                            <div className="mt-1.5 flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 rounded-full bg-cream-200 overflow-hidden">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full rounded-full transition-all",
                                                                            oxPct > 90 ? "bg-red-500" : oxPct > 70 ? "bg-amber-500" : "bg-green-500"
                                                                        )}
                                                                        style={{ width: `${Math.min(oxPct, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[9px] text-cream-500 whitespace-nowrap">
                                                                    {bottle.oxidationHours}h / {bottle.maxOxidationHours}h
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0">
                                                            <p className="font-mono text-lg font-bold text-green-900">
                                                                {bottle.glassesRemaining}
                                                            </p>
                                                            <p className="text-[9px] text-cream-500">ly còn lại</p>
                                                            <p className="text-[9px] text-wine-600 font-medium mt-1">
                                                                {bottle.sellSpeedPerHour} ly/giờ
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* In-Stock Bottles to open */}
                            {inStockBottles.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-cream-600 uppercase mb-2 flex items-center gap-1.5">
                                        Chai chưa mở ({inStockBottles.length} chai)
                                    </h4>
                                    <div className="space-y-2">
                                        {inStockBottles.map((bottle) => (
                                            <button
                                                key={bottle.id}
                                                onClick={async () => {
                                                    const result = await openBottle({ bottleId: bottle.id, staffId: staff?.id ?? "" })
                                                    if (result.success) {
                                                        // Pour 1 glass from the newly opened bottle
                                                        const pourResult = await pourFromBottle({
                                                            bottleId: bottle.id,
                                                            glasses: 1,
                                                            staffId: staff?.id ?? "",
                                                        })
                                                        if (pourResult.success) {
                                                            cart.addItem(bottleSelectorProduct!)
                                                            toast.success(`Mở chai mới & rót 1 ly`, {
                                                                description: `${bottle.batchCode} — ${(bottleSelectorProduct?.glassesPerBottle ?? 8) - 1} ly còn lại`,
                                                                duration: 3000,
                                                            })
                                                        }
                                                        setShowBottleSelector(false)
                                                        refreshStockMap()
                                                    } else {
                                                        toast.error(result.error ?? "Lỗi mở chai")
                                                    }
                                                }}
                                                className="w-full rounded-xl border border-cream-200 bg-cream-50 p-3 text-left transition-all hover:shadow-md hover:border-green-400"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-sm font-bold text-green-900">{bottle.batchCode}</span>
                                                        <p className="text-[10px] text-cream-500 mt-0.5">
                                                            Giá vốn: ₫{formatPrice(bottle.costPrice)} · Nhập {new Date(bottle.receivedAt).toLocaleDateString("vi-VN")}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="rounded-full bg-green-700 px-3 py-1 text-[10px] font-bold text-cream-50">
                                                            Mở chai & rót
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {openedBottles.length === 0 && inStockBottles.length === 0 && (
                                <div className="text-center py-10">
                                    <Wine className="h-10 w-10 text-cream-300 mx-auto mb-2" />
                                    <p className="text-sm text-cream-500">Không có chai nào để rót</p>
                                    <p className="text-xs text-cream-400 mt-1">Cần nhập thêm sản phẩm này vào kho</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-cream-200 bg-cream-50 rounded-b-2xl flex items-center justify-between shrink-0">
                            <div className="text-[9px] text-cream-400">
                                <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1" />Oxy hóa tốt
                                <span className="inline-block h-2 w-2 rounded-full bg-amber-500 ml-3 mr-1" /> Cảnh báo
                                <span className="inline-block h-2 w-2 rounded-full bg-red-500 ml-3 mr-1" /> Quá hạn
                            </div>
                            <button
                                onClick={() => setShowBottleSelector(false)}
                                className="rounded-lg bg-green-900 px-3 py-1.5 text-xs font-bold text-cream-50 hover:bg-green-800 transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Wine Recommendations Panel ============ */}
            {showRecommendations && recommendations.length > 0 && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRecommendations(false)}>
                    <div
                        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
                            <div>
                                <h3 className="text-base font-bold text-green-900 flex items-center gap-2">
                                    Gợi ý thay thế
                                </h3>
                                <p className="text-xs text-cream-500 mt-0.5">
                                    Rượu tương tự <span className="font-semibold text-wine-600">{recoSourceName}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowRecommendations(false)}
                                className="rounded-lg p-2 hover:bg-cream-200 transition-all"
                            >
                                <X className="h-4 w-4 text-cream-500" />
                            </button>
                        </div>

                        {/* Recommendations list */}
                        <div className="max-h-[60vh] overflow-y-auto divide-y divide-cream-100">
                            {recommendations.map((rec, idx) => (
                                <button
                                    key={rec.id}
                                    onClick={() => {
                                        const product = dbProducts.find(p => p.id === rec.id)
                                        if (product) {
                                            handleAddToCart(product)
                                            setShowRecommendations(false)
                                        }
                                    }}
                                    disabled={rec.inStock <= 0}
                                    className={cn(
                                        "w-full flex items-center gap-4 px-6 py-3.5 text-left transition-all hover:bg-green-50",
                                        rec.inStock <= 0 && "opacity-40 cursor-not-allowed"
                                    )}
                                >
                                    {/* Rank */}
                                    <div className={cn(
                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm",
                                        idx === 0 ? "bg-green-700 text-cream-50" :
                                            idx === 1 ? "bg-green-600 text-cream-50" :
                                                "bg-cream-200 text-cream-600"
                                    )}>
                                        {idx + 1}
                                    </div>

                                    {/* Wine info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-green-900 truncate">
                                            {rec.name}
                                        </p>
                                        <p className="text-[10px] text-cream-500 mt-0.5">
                                            {rec.grapeVariety} · {rec.country}{rec.region ? `, ${rec.region}` : ""} · {rec.alcoholPct}%
                                        </p>
                                        <p className="text-[10px] text-wine-600 mt-0.5 font-medium">
                                            {rec.matchReason}
                                        </p>
                                    </div>

                                    {/* Match score */}
                                    <div className="text-right shrink-0">
                                        <div className={cn(
                                            "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold",
                                            rec.matchScore >= 80 ? "bg-green-100 text-green-700" :
                                                rec.matchScore >= 50 ? "bg-amber-100 text-amber-700" :
                                                    "bg-cream-200 text-cream-600"
                                        )}>
                                            {rec.matchScore}% match
                                        </div>
                                        <p className="font-mono text-sm font-bold text-green-900 mt-1">
                                            ₫{formatPrice(rec.sellPrice)}
                                        </p>
                                        <p className={cn(
                                            "text-[9px] font-bold",
                                            rec.inStock > 0 ? "text-green-600" : "text-red-600"
                                        )}>
                                            {rec.inStock > 0 ? `${rec.inStock} chai` : "Hết hàng"}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-cream-200 bg-cream-50 rounded-b-2xl flex items-center justify-between">
                            <p className="text-[9px] text-cream-400 italic">
                                Gợi ý dựa trên hương vị, giống nho, vùng và nồng độ
                            </p>
                            <button
                                onClick={() => setShowRecommendations(false)}
                                className="rounded-lg bg-green-900 px-3 py-1.5 text-xs font-bold text-cream-50 hover:bg-green-800 transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ V2: Wine Guide Modal (per product) ============ */}
            {wineGuideProduct && (
                <WineGuideModal
                    product={wineGuideProduct}
                    onClose={() => setWineGuideProduct(null)}
                />
            )}

            {/* ============ Food Pairing Popup (food → wines) ============ */}
            {foodPairingProduct && (
                <FoodPairingPopup
                    product={foodPairingProduct}
                    onClose={() => setFoodPairingProduct(null)}
                />
            )}

            {/* ============ Wine Guide Popup (full list) ============ */}
            {showWineGuidePopup && (
                <WineGuidePopup onClose={() => setShowWineGuidePopup(false)} />
            )}

            {/* ============ Floating Wine Guide Button ============ */}
            <button
                id="wine-guide-fab"
                onClick={() => setShowWineGuidePopup(true)}
                className={cn(
                    "hidden lg:fixed lg:flex bottom-5 right-5 z-40 items-center gap-2 rounded-full shadow-lg transition-all duration-300",
                    "bg-wine-700 text-cream-50 hover:bg-wine-800 hover:shadow-xl hover:scale-105 active:scale-95",
                    "px-4 py-2.5 border border-wine-600",
                    upcomingReservations.length > 0 && "bottom-20"
                )}
                title="Wine Guide — Tư vấn rượu vang"
            >
                <BookOpen className="h-4 w-4" />
                <span className="text-xs font-bold">Wine Guide</span>
            </button>
        </div>
    )
}

// ============================================================
// OPEN TAB MODAL — List tabs + Create new tab
// ============================================================

function OpenTabModal({
    activeTabs,
    onClose,
    onTabOpened,
    onViewTab,
    staffId,
    staffName,
}: {
    activeTabs: CustomerTab[]
    onClose: () => void
    onTabOpened: () => void
    onViewTab: (id: string) => void
    staffId: string
    staffName: string
}) {
    const [mode, setMode] = useState<"list" | "create">("list")
    const [search, setSearch] = useState("")
    const [customers, setCustomers] = useState<Customer[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [tabLimit, setTabLimit] = useState("")
    const [notes, setNotes] = useState("")
    const [newName, setNewName] = useState("")
    const [newPhone, setNewPhone] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSearch = useCallback(async (q: string) => {
        setSearch(q)
        const results = await searchCustomers(q)
        setCustomers(results)
    }, [])

    useEffect(() => {
        handleSearch("")
    }, [handleSearch])

    const handleOpenTab = async () => {
        if (!selectedCustomer) return
        setLoading(true)
        const result = await openTab({
            customerId: selectedCustomer.id,
            staffId,
            staffName,
            tabLimit: tabLimit ? parseInt(tabLimit) : undefined,
            notes: notes || undefined,
        })
        if (result.success) {
            toast.success(`Mở tab: ${selectedCustomer.fullName}`, {
                description: `Limit: ₫${formatPrice(result.data!.tabLimit)}`,
            })
            onTabOpened()
        } else {
            toast.error(result.error?.message)
        }
        setLoading(false)
    }

    const handleCreateCustomer = async () => {
        if (!newName) return
        setLoading(true)
        const result = await createQuickCustomer({ fullName: newName, phone: newPhone || undefined })
        if (result.success && result.data) {
            const cust = result.data as Customer
            setSelectedCustomer(cust)
            setMode("list")
            toast.success(`Đã tạo khách: ${cust.fullName}`)
            handleSearch("")
        }
        setLoading(false)
    }

    const tierColors: Record<string, string> = {
        REGULAR: "bg-cream-200 text-cream-600",
        SILVER: "bg-stone-200 text-stone-700",
        GOLD: "bg-amber-100 text-amber-800",
        PLATINUM: "bg-stone-800 text-cream-100 border border-stone-700",
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[560px] max-h-[85vh] rounded-2xl border border-cream-300 bg-cream-50 shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
                    <div>
                        <h2 className="font-display text-lg font-bold text-green-900">Customer Tab</h2>
                        <p className="text-xs text-cream-500">
                            {activeTabs.length > 0 ? `${activeTabs.length} tab đang mở` : "Mở tab uống trước trả sau"}
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-200 transition-all">
                        <X className="h-4 w-4 text-cream-500" />
                    </button>
                </div>

                {/* Active Tabs List */}
                {activeTabs.length > 0 && (
                    <div className="border-b border-cream-200 px-5 py-3 space-y-2">
                        <p className="text-[10px] font-semibold text-green-900 uppercase">Tab đang mở</p>
                        {activeTabs.map((tab) => {
                            const pct = Math.round((tab.currentTotal / tab.tabLimit) * 100)
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onViewTab(tab.id)}
                                    className="flex items-center gap-3 w-full rounded-lg border border-cream-200 bg-cream-100 px-3 py-2.5 hover:border-green-600 transition-all text-left"
                                >
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                                        <User className="h-4 w-4 text-amber-700" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-green-900 truncate">
                                            {tab.customer.fullName}
                                        </p>
                                        <p className="text-[10px] text-cream-500">
                                            {tab.items.length} món · mở lúc {tab.openedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-xs font-bold text-green-900">₫{formatPrice(tab.currentTotal)}</p>
                                        <div className="mt-0.5 h-1.5 w-16 rounded-full bg-cream-200 overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all",
                                                    pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"
                                                )}
                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                            />
                                        </div>
                                        <p className={cn("text-[9px] font-medium mt-0.5", pct > 80 ? "text-red-600" : "text-cream-400")}>
                                            {pct}% limit
                                        </p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Create Tab Section */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {mode === "list" ? (
                        <>
                            <p className="text-[10px] font-semibold text-green-900 uppercase mb-2">Mở tab mới — Chọn khách</p>

                            {/* Customer Search */}
                            <div className="relative mb-3">
                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-400" />
                                <Input
                                    value={search}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    placeholder="Tìm tên, SĐT, email..."
                                    className="h-8 pl-8 text-xs border-cream-300"
                                />
                            </div>

                            {/* Customer List */}
                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                {customers.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCustomer(c)}
                                        className={cn(
                                            "flex items-center gap-3 w-full rounded-lg border px-3 py-2 text-left transition-all",
                                            selectedCustomer?.id === c.id
                                                ? "border-green-600 bg-green-50 ring-1 ring-green-600/30"
                                                : "border-cream-200 bg-cream-100 hover:border-green-400"
                                        )}
                                    >
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cream-200">
                                            <User className="h-3.5 w-3.5 text-cream-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-semibold text-green-900">{c.fullName}</span>
                                                <span className={cn("rounded px-1 py-0 text-[8px] font-bold", tierColors[c.tier])}>
                                                    {c.tier}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-cream-400">
                                                {c.phone ?? "Chưa có SĐT"} · {c.visitCount} lần ghé
                                            </p>
                                        </div>
                                        {selectedCustomer?.id === c.id && (
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Quick Create Customer */}
                            <button
                                onClick={() => setMode("create")}
                                className="flex items-center gap-2 w-full mt-2 rounded-lg border border-dashed border-cream-300 px-3 py-2 text-xs text-cream-500 hover:border-green-600 hover:text-green-700 transition-all"
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                Tạo khách mới nhanh
                            </button>

                            {/* Selected Customer → Set Limit */}
                            {selectedCustomer && (
                                <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3 space-y-2">
                                    <p className="text-xs font-semibold text-green-900">
                                        Mở tab cho: {selectedCustomer.fullName}
                                        {selectedCustomer.tier !== "REGULAR" && (
                                            <Star className="inline h-3 w-3 ml-1 text-amber-500" />
                                        )}
                                    </p>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-green-700 mb-0.5 block">Tab limit (₫)</label>
                                            <Input
                                                type="number"
                                                value={tabLimit}
                                                onChange={(e) => setTabLimit(e.target.value)}
                                                placeholder="Mặc định theo tier"
                                                className="h-7 text-xs border-green-200"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-green-700 mb-0.5 block">Ghi chú</label>
                                            <Input
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="VD: tiệc sinh nhật"
                                                className="h-7 text-xs border-green-200"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Quick Create Customer */
                        <div className="space-y-3">
                            <p className="text-[10px] font-semibold text-green-900 uppercase">Tạo khách mới nhanh</p>
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Tên khách hàng *"
                                className="h-8 text-xs border-cream-300"
                                autoFocus
                            />
                            <Input
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                placeholder="Số điện thoại"
                                className="h-8 text-xs border-cream-300"
                            />
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setMode("list")}
                                    className="flex-1 text-xs h-8 border-cream-300"
                                >
                                    Quay lại
                                </Button>
                                <Button
                                    onClick={handleCreateCustomer}
                                    disabled={!newName || loading}
                                    className="flex-1 bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-8"
                                >
                                    {loading ? "Đang tạo..." : "Tạo & chọn"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {mode === "list" && (
                    <div className="border-t border-cream-300 px-5 py-3 flex gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1 text-xs h-9 border-cream-300">
                            Đóng
                        </Button>
                        <Button
                            onClick={handleOpenTab}
                            disabled={!selectedCustomer || loading}
                            className="flex-1 bg-green-900 text-cream-50 hover:bg-green-800 text-xs h-9"
                        >
                            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TabIcon className="mr-1.5 h-3.5 w-3.5" />}
                            {loading ? "Đang mở..." : "Mở Tab"}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================
// TAB DETAIL MODAL — View items, close tab
// ============================================================

function TabDetailModal({
    tabId,
    onClose,
}: {
    tabId: string
    onClose: () => void
}) {
    const [tab, setTab] = useState<CustomerTab | null>(null)
    const [loading, setLoading] = useState(true)
    const [closing, setClosing] = useState(false)

    useEffect(() => {
        (async () => {
            const { getTabById } = await import("@/actions/tabs")
            const data = await getTabById(tabId)
            setTab(data)
            setLoading(false)
        })()
    }, [tabId])

    const handleRemoveItem = async (itemId: string) => {
        const result = await removeTabItem({ tabId, itemId })
        if (result.success && result.data) {
            setTab(result.data)
            toast.success("Đã xoá item")
        }
    }

    const handleCloseTab = async (method: string) => {
        setClosing(true)
        const result = await closeTab({ tabId, paymentMethod: method })
        if (result.success) {
            toast.success(`Đã đóng tab: ₫${formatPrice(result.data!.currentTotal)}`, {
                description: `${result.data!.customer.fullName} · ${method}`,
            })
            onClose()
        } else {
            toast.error(result.error?.message)
        }
        setClosing(false)
    }

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            </div>
        )
    }

    if (!tab) return null

    const pct = Math.round((tab.currentTotal / tab.tabLimit) * 100)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[520px] max-h-[85vh] rounded-2xl border border-cream-300 bg-cream-50 shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
                    <div>
                        <h2 className="font-display text-lg font-bold text-green-900">
                            Tab: {tab.customer.fullName}
                        </h2>
                        <p className="text-xs text-cream-500">
                            Mở lúc {tab.openedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}bởi {tab.openedByName}
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-200 transition-all">
                        <X className="h-4 w-4 text-cream-500" />
                    </button>
                </div>

                {/* Summary Bar */}
                <div className="px-5 py-3 border-b border-cream-200 flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-[10px] text-cream-500">Tổng tab</p>
                        <p className="font-mono text-lg font-bold text-green-900">₫{formatPrice(tab.currentTotal)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-cream-500">Limit</p>
                        <p className="font-mono text-xs text-cream-500">₫{formatPrice(tab.tabLimit)}</p>
                    </div>
                    <div className="w-20">
                        <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full",
                                    pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"
                                )}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                        </div>
                        <p className={cn("text-[10px] text-center mt-0.5 font-medium", pct > 80 ? "text-red-600" : "text-cream-400")}>
                            {pct}%
                        </p>
                    </div>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto">
                    {tab.items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-cream-400">
                            <p className="text-xs">Tab chưa có item nào</p>
                            <p className="text-[10px] mt-1">Thêm từ giỏ hàng POS</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-cream-200">
                            {tab.items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-green-900 truncate">{item.productName}</p>
                                        <p className="text-[10px] text-cream-400">
                                            ₫{formatPrice(item.unitPrice)} × {item.quantity}
                                            {item.tableNumber && ` · ${item.tableNumber}`}
                                            {" · "}{item.addedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                    <span className="font-mono text-xs font-bold text-green-900">
                                        ₫{formatPrice(item.subtotal)}
                                    </span>
                                    <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="rounded-md p-1 text-cream-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Close Tab Footer */}
                {tab.items.length > 0 && tab.status !== "CLOSED" && (
                    <div className="border-t border-cream-300 px-5 py-3">
                        <p className="text-[10px] font-semibold text-green-900 mb-2">Đóng tab & thanh toán</p>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            <button
                                onClick={() => handleCloseTab("CASH")}
                                disabled={closing}
                                className="flex flex-col items-center gap-1 rounded-xl border border-cream-300 bg-cream-100 py-2.5 text-[10px] font-medium text-cream-500 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                            >
                                <Banknote className="h-4 w-4" />
                                Tiền mặt
                            </button>
                            <button
                                onClick={() => handleCloseTab("CARD")}
                                disabled={closing}
                                className="flex flex-col items-center gap-1 rounded-xl border border-cream-300 bg-cream-100 py-2.5 text-[10px] font-medium text-cream-500 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                            >
                                <CreditCard className="h-4 w-4" />
                                Thẻ
                            </button>
                            <button
                                onClick={() => handleCloseTab("QR")}
                                disabled={closing}
                                className="flex flex-col items-center gap-1 rounded-xl border border-cream-300 bg-cream-100 py-2.5 text-[10px] font-medium text-cream-500 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                            >
                                <QrCode className="h-4 w-4" />
                                QR Pay
                            </button>
                        </div>
                    </div>
                )}

                {tab.status === "CLOSED" && (
                    <div className="border-t border-green-200 bg-green-50 px-5 py-3 text-center">
                        <p className="text-xs font-semibold text-green-700">Tab đã đóng</p>
                        <p className="text-[10px] text-green-600">
                            {tab.closedAt?.toLocaleString("vi-VN")}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================
// SHIFT MODAL — Open/Close shift + Cash reconciliation
// ============================================================

function ShiftModal({
    currentShift,
    staffId,
    staffName,
    staffRole,
    onClose,
    onShiftChange,
}: {
    currentShift: Shift | null
    staffId: string
    staffName: string
    staffRole: string
    onClose: () => void
    onShiftChange: () => void
}) {
    const [openingCash, setOpeningCash] = useState("")
    const [closingCash, setClosingCash] = useState("")
    const [closeNotes, setCloseNotes] = useState("")
    const [expenseDesc, setExpenseDesc] = useState("")
    const [expenseAmount, setExpenseAmount] = useState("")
    const [loading, setLoading] = useState(false)
    const [showClose, setShowClose] = useState(false)

    // V2: Shift Target state
    const [targetSuggestion, setTargetSuggestion] = useState<{
        revenueTarget: number; orderTarget: number; customerTarget: number
        pushProducts: { productId: string; productName: string; reason: string }[]
        basedOn: string
    } | null>(null)
    const [editRevTarget, setEditRevTarget] = useState("")
    const [editOrdTarget, setEditOrdTarget] = useState("")
    const [editCustTarget, setEditCustTarget] = useState("")
    const [targetApproved, setTargetApproved] = useState(false)
    const [evaluationNotes, setEvaluationNotes] = useState("")

    // Load target suggestion when shift exists
    useEffect(() => {
        if (currentShift) {
            import("@/actions/shift-targets").then(({ suggestShiftTargets }) => {
                suggestShiftTargets(currentShift.id).then((s) => {
                    setTargetSuggestion(s)
                    setEditRevTarget(String(s.revenueTarget))
                    setEditOrdTarget(String(s.orderTarget))
                    setEditCustTarget(String(s.customerTarget))
                })
            })
        }
    }, [currentShift])

    const handleOpenShift = async () => {
        if (!openingCash) { toast.error("Nhập quỹ mở ca"); return }
        setLoading(true)
        const result = await openShift({
            staffId,
            staffName,
            staffRole,
            openingCash: parseInt(openingCash),
        })
        setLoading(false)
        if (result.success) {
            toast.success(`Mở ca thành công — Quỹ: ₫${formatPrice(parseInt(openingCash))}`)
            onShiftChange()
        } else {
            toast.error(result.error ?? "Không thể mở ca")
        }
    }

    const handleCloseShift = async () => {
        if (!currentShift) return
        if (!closingCash) { toast.error("Nhập tiền mặt thực tế cuối ca"); return }
        setLoading(true)
        const result = await closeShift({
            shiftId: currentShift.id,
            closingCash: parseInt(closingCash),
            notes: closeNotes || undefined,
        })
        setLoading(false)
        if (result.success && result.data) {
            const diff = result.data.cashDifference ?? 0
            if (Math.abs(diff) <= 10000) {
                toast.success("Đóng ca thành công — Không chênh lệch!")
            } else if (diff > 0) {
                toast.warning(`Đóng ca — Thừa ₫${formatPrice(diff)}`)
            } else {
                toast.error(`Đóng ca — Thiếu ₫${formatPrice(Math.abs(diff))}`)
            }
            onShiftChange()
        }
    }

    const handleAddExpense = async () => {
        if (!currentShift || !expenseDesc || !expenseAmount) return
        await addShiftExpense({
            shiftId: currentShift.id,
            description: expenseDesc,
            amount: parseInt(expenseAmount),
            staffName,
        })
        toast.success(`Ghi nhận chi phí: ₫${formatPrice(parseInt(expenseAmount))}`)
        setExpenseDesc("")
        setExpenseAmount("")
        onShiftChange()
    }

    const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-cream-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
                    <div>
                        <h2 className="text-lg font-bold text-green-900">
                            {currentShift ? `Ca ${currentShift.shiftNumber}` : "Mở ca mới"}
                        </h2>
                        <p className="text-xs text-cream-500">
                            {currentShift
                                ? `Mở lúc ${new Date(currentShift.openedAt).toLocaleTimeString("vi-VN")} · ${staffName}`
                                : "Nhập quỹ mở ca để bắt đầu bán hàng"
                            }
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100 transition-all">
                        <X className="h-4 w-4 text-cream-400" />
                    </button>
                </div>

                {/* ── NO SHIFT: Open shift form ── */}
                {!currentShift && (
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1.5 block">Quỹ mở ca (Opening Cash) *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-cream-400 font-mono">₫</span>
                                <Input
                                    value={openingCash}
                                    onChange={(e) => setOpeningCash(e.target.value.replace(/\D/g, ""))}
                                    placeholder="2,000,000"
                                    className="h-11 pl-7 text-lg font-mono font-bold border-cream-300 text-green-900"
                                    autoFocus
                                />
                            </div>
                            {openingCash && (
                                <p className="text-[10px] text-cream-500 mt-1">= ₫{fmt(parseInt(openingCash) || 0)}</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {[1000000, 2000000, 3000000, 5000000].map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setOpeningCash(String(v))}
                                    className="flex-1 rounded-lg border border-cream-300 bg-cream-50 py-2 text-xs font-medium text-cream-600 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all"
                                >
                                    ₫{fmt(v)}
                                </button>
                            ))}
                        </div>
                        <Button
                            onClick={handleOpenShift}
                            disabled={loading || !openingCash}
                            className="w-full h-11 bg-green-900 text-white hover:bg-green-800 text-sm font-bold"
                        >
                            <Timer className="mr-2 h-4 w-4" />
                            {loading ? "Đang mở..." : "Mở ca"}
                        </Button>
                    </div>
                )}

                {/* ── SHIFT OPEN: Dashboard ── */}
                {currentShift && !showClose && (
                    <div className="p-5 space-y-4">
                        {/* Stats grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                            <div className="rounded-lg border border-cream-200 bg-cream-50 p-3 text-center">
                                <p className="text-[9px] font-bold uppercase text-cream-400 mb-0.5">Doanh thu</p>
                                <p className="font-mono text-lg font-bold text-green-900">₫{fmt(currentShift.totalSales)}</p>
                            </div>
                            <div className="rounded-lg border border-cream-200 bg-cream-50 p-3 text-center">
                                <p className="text-[9px] font-bold uppercase text-cream-400 mb-0.5">Đơn hàng</p>
                                <p className="font-mono text-lg font-bold text-blue-700">{currentShift.orderCount}</p>
                            </div>
                            <div className="rounded-lg border border-cream-200 bg-cream-50 p-3 text-center">
                                <p className="text-[9px] font-bold uppercase text-cream-400 mb-0.5">SP bán</p>
                                <p className="font-mono text-lg font-bold text-wine-700">{currentShift.itemsSold}</p>
                            </div>
                        </div>

                        {/* V2: Shift Targets */}
                        {targetSuggestion && (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-bold uppercase text-green-700">CHỈ TIÊU CA</p>
                                    {targetApproved ? (
                                        <Badge className="bg-green-700 text-white text-[8px] px-1.5 py-0">✓ Đã duyệt</Badge>
                                    ) : (
                                        <span className="text-[8px] text-green-600 italic">{targetSuggestion.basedOn}</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    <div>
                                        <p className="text-[8px] text-green-600 mb-0.5">Doanh thu</p>
                                        <Input
                                            value={editRevTarget}
                                            onChange={(e) => setEditRevTarget(e.target.value.replace(/\D/g, ""))}
                                            className="h-7 text-[11px] font-mono font-bold text-center border-green-300 bg-white"
                                            disabled={targetApproved}
                                        />
                                        {currentShift && (
                                            <p className={cn("text-[8px] mt-0.5 text-center font-mono",
                                                currentShift.totalSales >= parseInt(editRevTarget || "0") ? "text-green-700" : "text-amber-600"
                                            )}>
                                                {Math.round((currentShift.totalSales / parseInt(editRevTarget || "1")) * 100)}%
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[8px] text-green-600 mb-0.5">Đơn hàng</p>
                                        <Input
                                            value={editOrdTarget}
                                            onChange={(e) => setEditOrdTarget(e.target.value.replace(/\D/g, ""))}
                                            className="h-7 text-[11px] font-mono font-bold text-center border-green-300 bg-white"
                                            disabled={targetApproved}
                                        />
                                        {currentShift && (
                                            <p className={cn("text-[8px] mt-0.5 text-center font-mono",
                                                currentShift.orderCount >= parseInt(editOrdTarget || "0") ? "text-green-700" : "text-amber-600"
                                            )}>
                                                {Math.round((currentShift.orderCount / parseInt(editOrdTarget || "1")) * 100)}%
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[8px] text-green-600 mb-0.5">Khách</p>
                                        <Input
                                            value={editCustTarget}
                                            onChange={(e) => setEditCustTarget(e.target.value.replace(/\D/g, ""))}
                                            className="h-7 text-[11px] font-mono font-bold text-center border-green-300 bg-white"
                                            disabled={targetApproved}
                                        />
                                    </div>
                                </div>
                                {/* Push products */}
                                {targetSuggestion.pushProducts.length > 0 && (
                                    <div className="border-t border-green-200 pt-2">
                                        <p className="text-[8px] font-bold text-green-600 mb-1">SẢN PHẨM CẦN PUSH</p>
                                        {targetSuggestion.pushProducts.map((pp) => (
                                            <div key={pp.productId} className="flex items-center gap-1.5 text-[10px] text-green-800">
                                                <span>•</span>
                                                <span className="font-semibold">{pp.productName}</span>
                                                <span className="text-green-500">— {pp.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!targetApproved && (staffRole === "MANAGER" || staffRole === "OWNER") && (
                                    <Button
                                        onClick={() => {
                                            setTargetApproved(true)
                                            toast.success("Chỉ tiêu ca đã được duyệt!")
                                        }}
                                        size="sm"
                                        className="w-full h-7 bg-green-700 text-white hover:bg-green-800 text-[11px] font-bold"
                                    >
                                        <ShieldCheck className="mr-1 h-3 w-3" />
                                        Duyệt chỉ tiêu
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Payment breakdown */}
                        <div className="rounded-lg border border-cream-200 bg-white p-3 space-y-1.5">
                            <p className="text-[9px] font-bold uppercase text-cream-400">PHƯƠNG THỨC THANH TOÁN</p>
                            <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5">Tiền mặt</span><span className="font-mono font-bold text-green-700">₫{fmt(currentShift.totalCash)}</span></div>
                            <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5">Thẻ</span><span className="font-mono font-bold text-blue-700">₫{fmt(currentShift.totalCard)}</span></div>
                            <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5">QR Pay</span><span className="font-mono font-bold text-wine-700">₫{fmt(currentShift.totalQR)}</span></div>
                            <div className="border-t border-cream-200 pt-1.5 flex justify-between text-xs font-bold">
                                <span>Quỹ hiện tại (expected)</span>
                                <span className="font-mono text-green-900">₫{fmt(currentShift.expectedCash)}</span>
                            </div>
                        </div>

                        {/* Quick expense */}
                        <div className="rounded-lg border border-cream-200 bg-white p-3">
                            <p className="text-[9px] font-bold uppercase text-cream-400 mb-2">GHI NHẬN CHI PHÍ</p>
                            <div className="flex gap-2">
                                <Input
                                    value={expenseDesc}
                                    onChange={(e) => setExpenseDesc(e.target.value)}
                                    placeholder="Mô tả chi phí..."
                                    className="flex-1 h-8 text-xs border-cream-300"
                                />
                                <Input
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value.replace(/\D/g, ""))}
                                    placeholder="Số tiền"
                                    className="w-24 h-8 text-xs text-right font-mono border-cream-300"
                                />
                                <Button
                                    onClick={handleAddExpense}
                                    disabled={!expenseDesc || !expenseAmount}
                                    size="sm"
                                    className="h-8 bg-wine-600 hover:bg-wine-700 text-white px-3"
                                >
                                    <CircleMinus className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        {/* Recent transactions */}
                        {currentShift.transactions.length > 0 && (
                            <div className="rounded-lg border border-cream-200 bg-white">
                                <p className="text-[9px] font-bold uppercase text-cream-400 px-3 pt-3 pb-1">GIAO DỊCH GẦN ĐÂY</p>
                                <div className="max-h-32 overflow-y-auto divide-y divide-cream-100">
                                    {[...currentShift.transactions].reverse().slice(0, 5).map((tx) => (
                                        <div key={tx.id} className="flex items-center justify-between px-3 py-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={cn(
                                                    "rounded-full px-1.5 py-0.5 text-[8px] font-bold",
                                                    tx.type === "SALE" ? "bg-green-100 text-green-700" :
                                                        tx.type === "EXPENSE" ? "bg-red-100 text-red-700" :
                                                            "bg-blue-100 text-blue-700"
                                                )}>
                                                    {tx.type === "SALE" ? "BÁN" : tx.type === "EXPENSE" ? "CHI" : "TIP"}
                                                </span>
                                                <span className="text-[11px] text-cream-600 truncate">{tx.description}</span>
                                            </div>
                                            <span className={cn(
                                                "font-mono text-[11px] font-bold whitespace-nowrap ml-2",
                                                tx.amount >= 0 ? "text-green-700" : "text-red-600"
                                            )}>
                                                {tx.amount >= 0 ? "+" : ""}₫{fmt(Math.abs(tx.amount))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Close shift button */}
                        <Button
                            onClick={() => setShowClose(true)}
                            variant="outline"
                            className="w-full h-10 border-red-300 text-red-600 hover:bg-red-50 font-bold"
                        >
                            <Clock className="mr-2 h-4 w-4" />
                            Đóng ca
                        </Button>
                    </div>
                )}

                {/* ── CLOSE SHIFT: Cash reconciliation ── */}
                {currentShift && showClose && (
                    <div className="p-5 space-y-4">
                        {/* V2: Shift Target Evaluation */}
                        {targetSuggestion && (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                                <p className="text-[9px] font-bold uppercase text-green-700">TỔNG KẾT CHỈ TIÊU CA</p>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {[
                                        { label: "Doanh thu", actual: currentShift.totalSales, target: parseInt(editRevTarget || "1") },
                                        { label: "Đơn hàng", actual: currentShift.orderCount, target: parseInt(editOrdTarget || "1") },
                                        { label: "Khách", actual: currentShift.itemsSold, target: parseInt(editCustTarget || "1") },
                                    ].map((item) => {
                                        const pct = Math.round((item.actual / item.target) * 100)
                                        const color = pct >= 100 ? "text-green-700" : pct >= 80 ? "text-amber-700" : "text-red-700"
                                        const bg = pct >= 100 ? "bg-green-100" : pct >= 80 ? "bg-amber-100" : "bg-red-100"
                                        return (
                                            <div key={item.label} className={cn("rounded-lg p-2 text-center", bg)}>
                                                <p className="text-[8px] text-cream-500 mb-0.5">{item.label}</p>
                                                <p className={cn("font-mono text-sm font-bold", color)}>
                                                    {pct}%
                                                </p>
                                                <p className="text-[8px] text-cream-400">
                                                    {item.label === "Doanh thu" ? `₫${fmt(item.actual)}` : item.actual} / {item.label === "Doanh thu" ? `₫${fmt(item.target)}` : item.target}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div>
                                    <label className="text-[8px] font-bold uppercase text-green-600 mb-0.5 block">Đánh giá của quản lý</label>
                                    <Input
                                        value={evaluationNotes}
                                        onChange={(e) => setEvaluationNotes(e.target.value)}
                                        placeholder="Nhận xét cuối ca..."
                                        className="h-7 text-[11px] border-green-300 bg-white"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                            <p className="text-sm font-bold text-amber-800 mb-1">Đối soát tiền mặt cuối ca</p>
                            <p className="text-[11px] text-amber-700">
                                Quỹ kỳ vọng: <span className="font-mono font-bold">₫{fmt(currentShift.expectedCash)}</span>
                            </p>
                            <p className="text-[10px] text-amber-600 mt-0.5">
                                (Quỹ mở ₫{fmt(currentShift.openingCash)} + Tiền mặt thu ₫{fmt(currentShift.totalCash - currentShift.openingCash)})
                            </p>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1.5 block">Tiền mặt thực tế đếm được *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-cream-400 font-mono">₫</span>
                                <Input
                                    value={closingCash}
                                    onChange={(e) => setClosingCash(e.target.value.replace(/\D/g, ""))}
                                    placeholder="Nhập số tiền mặt..."
                                    className="h-11 pl-7 text-lg font-mono font-bold border-cream-300 text-green-900"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Live difference calculation */}
                        {closingCash && (
                            <div className={cn(
                                "rounded-lg border p-3",
                                (() => {
                                    const diff = parseInt(closingCash) - currentShift.expectedCash
                                    if (Math.abs(diff) <= 10000) return "border-green-300 bg-green-50"
                                    return diff > 0 ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"
                                })()
                            )}>
                                {(() => {
                                    const diff = parseInt(closingCash) - currentShift.expectedCash
                                    const isOk = Math.abs(diff) <= 10000
                                    return (
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold">
                                                {isOk ? "Khớp" : diff > 0 ? "Thừa" : "Thiếu"}
                                            </span>
                                            <span className={cn(
                                                "font-mono text-lg font-bold",
                                                isOk ? "text-green-700" : diff > 0 ? "text-amber-700" : "text-red-700"
                                            )}>
                                                {diff >= 0 ? "+" : ""}₫{fmt(diff)}
                                            </span>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1.5 block">Ghi chú đóng ca</label>
                            <Input
                                value={closeNotes}
                                onChange={(e) => setCloseNotes(e.target.value)}
                                placeholder="VD: Thiếu do trả tiền thừa cho khách..."
                                className="h-9 text-xs border-cream-300"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={() => setShowClose(false)} variant="outline" className="flex-1 border-cream-300 text-cream-500">
                                ← Quay lại
                            </Button>
                            <Button
                                onClick={handleCloseShift}
                                disabled={loading || !closingCash}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                            >
                                {loading ? "Đang đóng..." : "Xác nhận đóng ca"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================
// DISCOUNT AUTHORIZATION MODAL
// ============================================================

function DiscountAuthModal({
    subtotal,
    staffId,
    staffName,
    onClose,
    onAuthorized,
}: {
    subtotal: number
    staffId: string
    staffName: string
    onClose: () => void
    onAuthorized: (pct: number) => void
}) {
    const [selectedPct, setSelectedPct] = useState(5)
    const [customPct, setCustomPct] = useState("")
    const [needsPin, setNeedsPin] = useState(false)
    const [pin, setPin] = useState("")
    const [reason, setReason] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")

    const activePct = customPct ? Number(customPct) : selectedPct
    const discountAmount = Math.round(subtotal * activePct / 100)
    const finalTotal = subtotal - discountAmount

    const handleApply = async () => {
        setError("")

        // Under threshold — auto approve
        if (activePct <= 10) {
            onAuthorized(activePct)
            return
        }

        // Above threshold — need manager PIN
        setNeedsPin(true)
    }

    const handlePinSubmit = async () => {
        if (!pin || pin.length < 4) { setError("Nhập mã PIN 4 số"); return }
        if (!reason.trim()) { setError("Nhập lý do giảm giá"); return }

        setSubmitting(true)
        const result = await authorizeDiscount({
            managerPin: pin,
            orderId: null,
            discountType: "PERCENTAGE",
            discountValue: activePct,
            originalTotal: subtotal,
            reason: reason.trim(),
            requestedBy: staffId,
            requestedByName: staffName,
        })
        setSubmitting(false)

        if (result.success && result.authorized) {
            onAuthorized(activePct)
        } else {
            setError(result.error ?? "Không thể xác nhận")
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[360px] rounded-2xl border border-cream-200 bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                    <div>
                        <h2 className="text-lg font-bold text-green-900">Giảm giá</h2>
                        <p className="text-xs text-cream-500">
                            {needsPin ? "Cần xác nhận Manager/Owner" : "Chọn mức giảm giá"}
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-cream-100">
                        <X className="h-4 w-4 text-cream-400" />
                    </button>
                </div>

                {!needsPin ? (
                    <div className="p-5 space-y-4">
                        {/* Preset percentages */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {[5, 10, 15, 20].map((pct) => (
                                <button
                                    key={pct}
                                    onClick={() => { setSelectedPct(pct); setCustomPct("") }}
                                    className={cn(
                                        "rounded-xl border-2 py-3 text-center font-mono text-lg font-bold transition-all",
                                        !customPct && selectedPct === pct
                                            ? "border-green-600 bg-green-50 text-green-800"
                                            : "border-cream-300 text-cream-500 hover:border-green-400"
                                    )}
                                >
                                    {pct}%
                                </button>
                            ))}
                        </div>

                        {/* Custom */}
                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Hoặc nhập tùy chỉnh</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={customPct}
                                    onChange={(e) => setCustomPct(e.target.value)}
                                    placeholder="VD: 25"
                                    className="h-9 text-xs border-cream-300 flex-1"
                                    min={1}
                                    max={100}
                                />
                                <span className="text-sm font-bold text-cream-500">%</span>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="rounded-lg bg-cream-50 border border-cream-200 p-3 space-y-1">
                            <div className="flex justify-between text-xs text-cream-500">
                                <span>Tạm tính</span>
                                <span className="font-mono">₫{formatPrice(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-green-600">
                                <span>Giảm {activePct}%</span>
                                <span className="font-mono">-₫{formatPrice(discountAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-green-900 pt-1 border-t border-cream-200">
                                <span>Sau giảm</span>
                                <span className="font-mono">₫{formatPrice(finalTotal)}</span>
                            </div>
                        </div>

                        {activePct > 10 && (
                            <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                                Giảm giá &gt; 10% cần xác nhận Manager PIN
                            </p>
                        )}

                        <div className="flex gap-2">
                            <Button onClick={onClose} variant="outline" size="sm" className="flex-1 border-cream-300 text-cream-500">Hủy</Button>
                            <Button onClick={handleApply} size="sm" className="flex-1 bg-green-900 text-white hover:bg-green-800">
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                {activePct > 10 ? "Nhập PIN" : "Áp dụng"}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 space-y-4">
                        <div className="text-center">
                            <p className="text-sm font-bold text-green-900">Giảm {activePct}%</p>
                            <p className="font-mono text-2xl font-bold text-green-800 mt-1">-₫{formatPrice(discountAmount)}</p>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Manager PIN *</label>
                            <Input
                                type="password"
                                value={pin}
                                onChange={(e) => { setPin(e.target.value); setError("") }}
                                placeholder="Nhập mã PIN 4 số"
                                className="h-10 text-center text-lg font-mono border-cream-300 tracking-widest"
                                maxLength={4}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit() }}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase text-cream-400 mb-1 block">Lý do giảm giá *</label>
                            <Input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="VD: Khách VIP, sinh nhật, khiếu nại..."
                                className="h-9 text-xs border-cream-300"
                            />
                        </div>

                        {error && (
                            <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                                {error}
                            </p>
                        )}

                        <p className="text-[9px] text-cream-400 text-center">
                            Test PINs: 1234 (Manager), 0000 (Owner), 9999 (Manager)
                        </p>

                        <div className="flex gap-2">
                            <Button onClick={() => setNeedsPin(false)} variant="outline" size="sm" className="flex-1 border-cream-300 text-cream-500">Quay lại</Button>
                            <Button onClick={handlePinSubmit} disabled={submitting} size="sm" className="flex-1 bg-green-900 text-white hover:bg-green-800">
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                {submitting ? "Đang xác nhận..." : "Xác nhận"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================
// WINE GUIDE MODAL — Full wine details popup (V2 Feature 1)
// ============================================================
function WineGuideModal({
    product,
    onClose,
}: {
    product: Product
    onClose: () => void
}) {
    const isWine = product.type === "WINE_BOTTLE" || product.type === "WINE_GLASS" || product.type === "WINE_TASTING"
    if (!isWine) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative w-full max-w-md mx-4 rounded-2xl border border-cream-300 bg-cream-50 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-green-900 px-6 py-4">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-cream-400">
                                {product.type === "WINE_BOTTLE" ? "Wine by Bottle" : product.type === "WINE_GLASS" ? "Wine by Glass" : "Wine Tasting"}
                            </p>
                            <h3 className="font-display text-xl font-bold text-cream-50 mt-1">
                                {product.name}
                            </h3>
                            {product.nameVi && (
                                <p className="text-xs text-cream-400 mt-0.5 font-script">{product.nameVi}</p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 text-cream-400 hover:text-cream-50 hover:bg-green-800 transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    {/* Quick stats */}
                    <div className="flex items-center gap-3 mt-3">
                        {product.vintage && (
                            <span className="rounded-lg bg-green-800 px-2.5 py-1 text-xs font-bold text-cream-200">
                                {product.vintage}
                            </span>
                        )}
                        {product.alcoholPct && (
                            <span className="rounded-lg bg-green-800 px-2.5 py-1 text-xs font-mono text-cream-200">
                                {product.alcoholPct}% vol
                            </span>
                        )}
                        {product.sellPrice && (
                            <span className="ml-auto rounded-lg bg-wine-700 px-3 py-1 text-xs font-mono font-bold text-white">
                                ₫{formatPrice(product.isByGlass && product.glassPrice ? product.glassPrice : product.sellPrice)}
                                {product.isByGlass && <span className="text-[10px] font-normal"> /ly</span>}
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4 max-h-[50vh] overflow-y-auto">
                    {/* Origin info */}
                    {(product.country || product.region || product.appellation || product.grapeVariety) && (
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-cream-400 flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" /> Xuất xứ
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {product.country && (
                                    <div className="rounded-lg bg-cream-100 px-3 py-2">
                                        <p className="text-[9px] uppercase text-cream-400">Quốc gia</p>
                                        <p className="text-xs font-semibold text-green-900">{product.country}</p>
                                    </div>
                                )}
                                {product.region && (
                                    <div className="rounded-lg bg-cream-100 px-3 py-2">
                                        <p className="text-[9px] uppercase text-cream-400">Vùng</p>
                                        <p className="text-xs font-semibold text-green-900">{product.region}</p>
                                    </div>
                                )}
                                {product.appellation && (
                                    <div className="rounded-lg bg-cream-100 px-3 py-2">
                                        <p className="text-[9px] uppercase text-cream-400">Appellation</p>
                                        <p className="text-xs font-semibold text-green-900">{product.appellation}</p>
                                    </div>
                                )}
                                {product.grapeVariety && (
                                    <div className="rounded-lg bg-cream-100 px-3 py-2">
                                        <p className="text-[9px] uppercase text-cream-400 flex items-center gap-1"><Grape className="h-2.5 w-2.5" /> Giống nho</p>
                                        <p className="text-xs font-semibold text-green-900">{product.grapeVariety}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tasting Notes */}
                    {product.tastingNotes && (
                        <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-cream-400 flex items-center gap-1.5 mb-1.5">
                                <Wine className="h-3 w-3" /> Ghi chú thưởng thức
                            </h4>
                            <p className="text-xs text-green-900 leading-relaxed bg-cream-100 rounded-lg px-3 py-2.5 border-l-2 border-wine-600 italic">
                                &ldquo;{product.tastingNotes}&rdquo;
                            </p>
                        </div>
                    )}

                    {/* Serving Guide */}
                    {(product.servingTemp || product.decantingTime || product.glassType) && (
                        <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-cream-400 flex items-center gap-1.5 mb-1.5">
                                <Thermometer className="h-3 w-3" /> Hướng dẫn phục vụ
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {product.servingTemp && (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5">
                                        <Thermometer className="h-3.5 w-3.5 text-blue-600" />
                                        <span className="text-xs font-semibold text-blue-800">{product.servingTemp}</span>
                                    </div>
                                )}
                                {product.decantingTime && (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
                                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                                        <span className="text-xs font-semibold text-amber-800">Decant {product.decantingTime}</span>
                                    </div>
                                )}
                                {product.glassType && (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5">
                                        <GlassWater className="h-3.5 w-3.5 text-green-600" />
                                        <span className="text-xs font-semibold text-green-800">Ly {product.glassType}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Food Pairing */}
                    <PairingSection productId={product.id} isWine={true} />

                    {/* Description */}
                    {product.description && (
                        <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-cream-400 flex items-center gap-1.5 mb-1.5">
                                <Info className="h-3 w-3" /> Mô tả
                            </h4>
                            <p className="text-xs text-green-900 leading-relaxed">
                                {product.description}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-cream-300 bg-cream-100 px-6 py-3 flex items-center justify-between">
                    <p className="text-[9px] text-cream-400 italic font-script">drink slowly · laugh quietly · stay longer</p>
                    <Button
                        onClick={onClose}
                        size="sm"
                        className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs"
                    >
                        Đóng
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// PAIRING SECTION — Shows paired items for any product
// ============================================================
function PairingSection({ productId, isWine }: { productId: string; isWine: boolean }) {
    const [pairings, setPairings] = useState<{ id: string; name: string; type: string; sellPrice: number }[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        getPairingsForProduct(productId).then(setPairings).finally(() => setLoading(false))
    }, [productId])

    if (loading) return (
        <div className="py-2">
            <p className="text-[10px] text-cream-400 animate-pulse">Đang tải pairing...</p>
        </div>
    )
    if (pairings.length === 0) return null

    return (
        <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-cream-400 flex items-center gap-1.5 mb-1.5">
                {isWine ? <Utensils className="h-3 w-3" /> : <Wine className="h-3 w-3" />}
                {isWine ? "Đồ ăn kèm gợi ý" : "Rượu hợp uống cùng"}
            </h4>
            <div className="space-y-1">
                {pairings.map(p => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg bg-cream-100 border border-cream-200 px-3 py-2">
                        <span className="text-xs font-semibold text-green-900 flex-1">{p.name}</span>
                        <span className="text-[10px] font-mono text-cream-500">₫{new Intl.NumberFormat("vi-VN").format(p.sellPrice)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ============================================================
// FOOD PAIRING POPUP — Shows wine suggestions for food items
// ============================================================
function FoodPairingPopup({
    product,
    onClose,
}: {
    product: Product
    onClose: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative w-full max-w-sm mx-4 rounded-2xl border border-cream-300 bg-cream-50 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-green-900 px-5 py-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-cream-400">
                                {product.type === "FOOD" ? "Món ăn" : product.type === "DRINK" ? "Đồ uống" : "Sản phẩm"}
                            </p>
                            <h3 className="font-display text-lg font-bold text-cream-50 mt-0.5">
                                {product.name}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 text-cream-400 hover:text-cream-50 hover:bg-green-800 transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Pairing Content */}
                <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
                    <PairingSection productId={product.id} isWine={false} />
                </div>

                {/* Footer */}
                <div className="border-t border-cream-300 bg-cream-100 px-5 py-3 flex justify-end">
                    <Button onClick={onClose} size="sm" className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs">
                        Đóng
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// PAY EXISTING ORDER MODAL — For PAY_AFTER mode checkout
// ============================================================
function PayExistingOrderModal({
    order,
    onClose,
    onPaid,
    staffName,
}: {
    order: Order
    onClose: () => void
    onPaid: () => void
    staffName: string
}) {
    const [paying, setPaying] = useState(false)

    const handlePay = async (method: PaymentMethod) => {
        setPaying(true)
        try {
            const result = await processOrderWithCOGS(order.id, method)
            if (result.success) {
                if (result.stockWarnings.length > 0) {
                    for (const w of result.stockWarnings) {
                        toast.warning(`${w}`, { duration: 5000 })
                    }
                }
                onPaid()
            } else {
                toast.error(result.errors?.[0] ?? "Lỗi thanh toán")
            }
        } catch {
            toast.error("Lỗi hệ thống")
        }
        setPaying(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-cream-300 bg-cream-100 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cream-300 bg-green-900 px-5 py-3">
                    <div>
                        <h3 className="font-display text-sm font-bold text-cream-50">Thanh toán đơn {order.orderNumber}</h3>
                        <p className="text-[10px] text-cream-300 mt-0.5">
                            {order.tableNumber ? `Bàn ${order.tableNumber}` : "Takeaway"} · {staffName}
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1 text-cream-300 hover:text-white hover:bg-white/10 transition-all">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Order Items */}
                <div className="max-h-64 overflow-y-auto p-4 space-y-1.5">
                    {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg bg-cream-50 border border-cream-200 px-3 py-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-green-900 truncate">{item.productName}</p>
                                {item.notes && <p className="text-[9px] text-amber-600 italic">{item.notes}</p>}
                            </div>
                            <div className="text-right ml-2 shrink-0">
                                <span className="text-[10px] text-cream-500">×{item.quantity}</span>
                                <p className="font-mono text-[11px] font-bold text-green-800">₫{formatPrice(item.unitPrice * item.quantity)}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total */}
                <div className="border-t border-cream-300 px-5 py-3 bg-cream-50">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-cream-500">Tổng cộng</span>
                        <span className="font-mono text-lg font-bold text-green-900">₫{formatPrice(order.total)}</span>
                    </div>
                </div>

                {/* Payment Buttons */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-4 bg-cream-100 border-t border-cream-200">
                    <button
                        onClick={() => handlePay("CASH")}
                        disabled={paying}
                        className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-cream-300 bg-cream-50 py-3 text-xs font-medium text-cream-600 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                    >
                        <Banknote className="h-5 w-5" />
                        <span className="font-bold">Tiền mặt</span>
                    </button>
                    <button
                        onClick={() => handlePay("CARD")}
                        disabled={paying}
                        className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-cream-300 bg-cream-50 py-3 text-xs font-medium text-cream-600 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                    >
                        <CreditCard className="h-5 w-5" />
                        <span className="font-bold">Thẻ</span>
                    </button>
                    <button
                        onClick={() => handlePay("BANK_TRANSFER")}
                        disabled={paying}
                        className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-cream-300 bg-cream-50 py-3 text-xs font-medium text-cream-600 hover:border-green-600 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50"
                    >
                        <QrCode className="h-5 w-5" />
                        <span className="font-bold">Chuyển khoản</span>
                    </button>
                </div>

                {paying && (
                    <div className="flex items-center justify-center gap-2 py-3 bg-cream-50 border-t border-cream-200">
                        <span className="text-xs text-cream-500">Đang xử lý thanh toán...</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================
// WINE GUIDE POPUP — Full wine list for POS consultation
// ============================================================
function WineGuidePopup({ onClose }: { onClose: () => void }) {
    const [notes, setNotes] = useState<WineServingNote[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        const list = search ? await searchServingNotes(search) : await getAllServingNotes()
        setNotes(list)
        setLoading(false)
    }, [search])

    useEffect(() => { loadData() }, [loadData])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative w-full max-w-2xl mx-4 max-h-[85vh] rounded-2xl border border-cream-300 bg-cream-50 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-green-900 px-6 py-4 shrink-0">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-800 border border-green-700">
                                <BookOpen className="h-4 w-4 text-cream-200" />
                            </div>
                            <div>
                                <h2 className="font-display text-lg font-bold text-cream-50">Wine Guide</h2>
                                <p className="text-[10px] text-cream-400">Tư vấn rượu vang · Phục vụ · Food pairing</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 text-cream-400 hover:text-cream-50 hover:bg-green-800 transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cream-500" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm rượu, vùng, nho, pairing..."
                            className="h-9 pl-9 text-xs border-green-700 bg-green-800 text-cream-100 placeholder:text-cream-500 focus:border-cream-400"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Wine List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 text-wine-600 animate-spin" />
                            <span className="ml-2 text-xs text-cream-400">Đang tải...</span>
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="py-16 text-center">
                            <Wine className="h-10 w-10 text-cream-300 mx-auto mb-2" />
                            <p className="text-sm text-cream-400">Không tìm thấy wine serving notes</p>
                        </div>
                    ) : (
                        notes.map((note) => {
                            const isExpanded = expandedId === note.id
                            return (
                                <div
                                    key={note.id}
                                    className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-all"
                                >
                                    {/* Collapsed row */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : note.id)}
                                        className={cn(
                                            "w-full flex items-center px-4 py-3 text-left transition-colors",
                                            isExpanded && "bg-wine-50"
                                        )}
                                    >
                                        {/* Wine icon */}
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-wine-100 border border-wine-200 mr-3 shrink-0">
                                            <Wine className="h-4 w-4 text-wine-700" />
                                        </div>

                                        {/* Name + Region */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-green-900 truncate">{note.productName}</span>
                                                {note.vintage && (
                                                    <Badge className="text-[8px] bg-wine-100 border-wine-300 text-wine-700 shrink-0">
                                                        {note.vintage}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="flex items-center gap-1 text-[10px] text-cream-500">
                                                    <MapPin className="h-2.5 w-2.5" />{note.region}
                                                </span>
                                                {note.grape && (
                                                    <span className="flex items-center gap-1 text-[10px] text-cream-500">
                                                        <Grape className="h-2.5 w-2.5" />{note.grape}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Quick info pills */}
                                        <div className="hidden md:flex items-center gap-2 mr-3 shrink-0">
                                            <div className="flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5">
                                                <Thermometer className="h-2.5 w-2.5 text-blue-600" />
                                                <span className="text-[9px] font-bold text-blue-700">{note.servingTemp}</span>
                                            </div>
                                            <div className="flex items-center gap-1 rounded-lg bg-cream-100 border border-cream-200 px-2 py-0.5">
                                                <GlassWater className="h-2.5 w-2.5 text-cream-500" />
                                                <span className="text-[9px] font-medium text-cream-600">{note.glassType.split(" ")[0]}</span>
                                            </div>
                                            {note.decantTime && (
                                                <div className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5">
                                                    <Clock className="h-2.5 w-2.5 text-amber-600" />
                                                    <span className="text-[9px] font-medium text-amber-700">Decant</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pairing count */}
                                        {note.pairings.length > 0 && (
                                            <div className="flex items-center gap-1 mr-2 shrink-0">
                                                <Utensils className="h-2.5 w-2.5 text-cream-400" />
                                                <span className="text-[9px] text-cream-400">{note.pairings.length}</span>
                                            </div>
                                        )}

                                        <div className="w-4 shrink-0">
                                            {isExpanded
                                                ? <ChevronUp className="h-3.5 w-3.5 text-cream-400" />
                                                : <ChevronDown className="h-3.5 w-3.5 text-cream-400" />
                                            }
                                        </div>
                                    </button>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div className="border-t border-cream-200 bg-cream-50 px-4 py-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Left: Serving Info */}
                                                <div className="space-y-2.5">
                                                    <h4 className="text-[9px] font-bold uppercase text-cream-400">HƯỚNG DẪN PHỤC VỤ</h4>
                                                    <div className="rounded-lg bg-white border border-cream-200 p-2.5 space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-cream-500 flex items-center gap-1.5">
                                                                Nhiệt độ
                                                            </span>
                                                            <span className="font-bold text-blue-700">{note.servingTemp}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-cream-500 flex items-center gap-1.5">
                                                                Ly
                                                            </span>
                                                            <span className="font-medium">{note.glassType}</span>
                                                        </div>
                                                        {note.decantTime && (
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-cream-500 flex items-center gap-1.5">
                                                                    Decant
                                                                </span>
                                                                <span className="font-bold text-amber-700">{note.decantTime}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-cream-500 flex items-center gap-1.5">
                                                                Vùng
                                                            </span>
                                                            <span className="font-medium text-right max-w-[140px]">{note.region}</span>
                                                        </div>
                                                        {note.grape && (
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-cream-500 flex items-center gap-1.5">
                                                                    Nho
                                                                </span>
                                                                <span className="font-medium text-right max-w-[140px]">{note.grape}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Staff notes */}
                                                    {note.staffNotes && (
                                                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                                                            <p className="text-[8px] font-bold uppercase text-amber-500 mb-1 flex items-center gap-1">
                                                                GHI CHÚ
                                                            </p>
                                                            <p className="text-[10px] text-amber-800 leading-relaxed">{note.staffNotes}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Middle: Tasting Notes */}
                                                <div className="space-y-2.5">
                                                    <h4 className="text-[9px] font-bold uppercase text-cream-400">TASTING NOTES</h4>
                                                    <div className="rounded-lg bg-white border border-cream-200 p-2.5 space-y-2.5">
                                                        {note.tastingNotes.nose.length > 0 && (
                                                            <div>
                                                                <p className="text-[8px] font-bold uppercase text-wine-400 mb-1">Nose (Hương)</p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {note.tastingNotes.nose.map((n) => (
                                                                        <span key={n} className="rounded-full bg-wine-50 border border-wine-200 px-2 py-0.5 text-[8px] font-medium text-wine-700">
                                                                            {n}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {note.tastingNotes.palate.length > 0 && (
                                                            <div>
                                                                <p className="text-[8px] font-bold uppercase text-green-500 mb-1">Palate (Vị)</p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {note.tastingNotes.palate.map((p) => (
                                                                        <span key={p} className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[8px] font-medium text-green-700">
                                                                            {p}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {note.tastingNotes.finish && (
                                                            <div>
                                                                <p className="text-[8px] font-bold uppercase text-amber-500 mb-1">Finish (Kết thúc)</p>
                                                                <p className="text-[10px] text-cream-600 italic">{note.tastingNotes.finish}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Food Pairings */}
                                                <div className="space-y-2.5">
                                                    <h4 className="text-[9px] font-bold uppercase text-cream-400 flex items-center gap-1">
                                                        FOOD PAIRING
                                                    </h4>
                                                    {note.pairings.length > 0 ? (
                                                        <div className="rounded-lg bg-white border border-cream-200 p-2.5">
                                                            <div className="space-y-1">
                                                                {note.pairings.map((p, i) => (
                                                                    <div key={i} className="flex items-center gap-2 py-0.5">
                                                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[8px] font-bold text-green-700 shrink-0">
                                                                            {i + 1}
                                                                        </span>
                                                                        <span className="text-[11px] text-green-900 font-medium">{p}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg bg-cream-100 border border-cream-200 p-2.5">
                                                            <p className="text-[10px] text-cream-400 italic">Chưa có food pairing</p>
                                                        </div>
                                                    )}

                                                    {/* Upsell suggestion */}
                                                    {note.pairings.length > 0 && (
                                                        <div className="rounded-lg bg-green-50 border border-green-200 p-2.5">
                                                            <p className="text-[8px] font-bold uppercase text-green-500 mb-0.5">GỢI Ý UPSELL</p>
                                                            <p className="text-[9px] text-green-700 leading-relaxed">
                                                                {note.pairings.length > 2
                                                                    ? `Đề xuất kèm "${note.pairings[0]}" hoặc "${note.pairings[1]}" để tăng ticket size.`
                                                                    : `Đề xuất kèm "${note.pairings[0]}" cho trải nghiệm tốt nhất.`
                                                                }
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-cream-300 bg-cream-100 px-6 py-2.5 flex items-center justify-between shrink-0">
                    <p className="text-[9px] text-cream-400 italic font-script">
                        drink slowly · laugh quietly · stay longer
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-cream-400">{notes.length} loại rượu</span>
                        <Button
                            onClick={onClose}
                            size="sm"
                            className="bg-green-900 text-cream-50 hover:bg-green-800 text-xs"
                        >
                            Đóng
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
