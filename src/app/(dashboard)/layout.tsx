"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
    Wine,
    LayoutDashboard,
    UtensilsCrossed,
    Armchair,
    Package,
    Users,
    BarChart3,
    Settings,
    LogOut,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Truck,
    CalendarDays,
    Tag,
    Heart,
    BookOpen,
    ChefHat,
    ClipboardList,
    Handshake,
    AlertTriangle,
    TrendingUp,
    MessageCircle,
    GlassWater,
    PieChart,
    Trash2,
    DollarSign,
    Target,
    Menu,
    X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import { usePrefetchStore } from "@/stores/prefetch-store"
import { useSidebarStore } from "@/stores/sidebar-store"
import { PageTransition } from "@/components/page-transition"
import { GlobalPrefetcher } from "@/components/global-prefetcher"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { useRbac } from "@/hooks/use-rbac"
import { logoutStaff } from "@/actions/staff"

// Map routes to prefetch cache keys
const PREFETCH_KEYS: Record<string, string> = {
    "/pos": "pos",
    "/dashboard": "dashboard",
    "/dashboard/tables": "tables",
}

const navSections = [
    {
        label: "Tổng quan",
        items: [
            { label: "Bảng điều khiển", href: "/dashboard", icon: LayoutDashboard, rbac: "dashboard" },
            { label: "Báo cáo phân tích", href: "/dashboard/analytics", icon: PieChart, rbac: "analytics" },
            { label: "Tài chính & Doanh thu", href: "/dashboard/finance", icon: DollarSign, rbac: "finance" },
            { label: "Mục tiêu & KPI", href: "/dashboard/kpi", icon: Target, rbac: "kpi" },
        ],
    },
    {
        label: "Bán hàng",
        items: [
            { label: "POS Bán hàng", href: "/pos", icon: Wine, rbac: "pos" },
            { label: "Sơ đồ bàn", href: "/dashboard/tables", icon: Armchair, rbac: "pos" },
            { label: "Đặt bàn", href: "/dashboard/reservations", icon: CalendarDays, rbac: "pos" },
            { label: "Phản hồi khách", href: "/dashboard/feedback", icon: MessageCircle, rbac: "customers" },
        ],
    },
    {
        label: "Hàng hoá & Kho",
        items: [
            { label: "Thực đơn món", href: "/dashboard/menu/products", icon: UtensilsCrossed, rbac: "menu" },
            { label: "Công thức pha chế", href: "/dashboard/menu/recipes", icon: ChefHat, rbac: "menu" },
            { label: "Sổ tay rượu vang", href: "/dashboard/wine-guide", icon: BookOpen, rbac: "menu" },
            { label: "Quản lý tồn kho", href: "/dashboard/inventory", icon: Package, rbac: "inventory" },
            { label: "Theo dõi mở chai", href: "/dashboard/bottle-tracking", icon: GlassWater, rbac: "inventory" },
            { label: "Nhập hàng & Ký gửi", href: "/dashboard/procurement", icon: Truck, rbac: "procurement" },
            { label: "Biên lợi nhuận", href: "/dashboard/margins", icon: Tag, rbac: "inventory" },
            { label: "Hao hụt & Hủy món", href: "/dashboard/waste", icon: Trash2, rbac: "inventory" },
            { label: "Cảnh báo hạn dùng", href: "/dashboard/alerts", icon: AlertTriangle, rbac: "inventory" },
        ],
    },
    {
        label: "Hệ thống",
        items: [
            { label: "Đội ngũ nhân sự", href: "/dashboard/staff", icon: Users, rbac: "staff" },
            { label: "Khách hàng", href: "/dashboard/customers", icon: Heart, rbac: "customers" },
            { label: "Nhà cung cấp", href: "/dashboard/suppliers", icon: Handshake, rbac: "suppliers" },
            { label: "Cài đặt hệ thống", href: "/dashboard/settings", icon: Settings, rbac: "settings" },
        ],
    },
]

// Bottom nav items for mobile — most-used features
const bottomNavItems = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "POS", href: "/pos", icon: Wine },
    { label: "Đơn hàng", href: "/pos/orders", icon: ClipboardList },
    { label: "Bếp", href: "/pos/kitchen", icon: ChefHat },
    { label: "Thêm", href: "__menu__", icon: Menu },
]

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const { collapsed, toggle: toggleSidebar, mobileOpen, setMobileOpen } = useSidebarStore()
    const { isAuthenticated, _hasHydrated, staff, logout } = useAuthStore()
    const isMobile = useIsMobile()
    const { canAccess } = useRbac()

    useEffect(() => {
        if (_hasHydrated && !isAuthenticated) {
            router.replace("/login")
        }
    }, [isAuthenticated, _hasHydrated, router])

    // Close mobile drawer on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname, setMobileOpen])

    if (!_hasHydrated) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-cream-50">
                <Loader2 className="h-8 w-8 animate-spin text-green-700" />
            </div>
        )
    }

    if (!isAuthenticated) return null

    const handleLogout = async () => {
        logout()
        await logoutStaff()
        router.replace("/login")
    }

    const sidebarWidth = collapsed ? 60 : 220

    // Check if current page is a full-screen POS page (shouldn't show bottom nav)
    const isFullScreenPOS = pathname === "/pos"

    // ===================== SIDEBAR NAV CONTENT (shared) =====================
    const renderNavContent = (forMobile: boolean) => (
        <nav className={cn("flex-1 overflow-y-auto px-2 py-3 space-y-4", forMobile && "scroll-hide-bar")}>
            {navSections.map((section) => {
                // Filter items by RBAC permissions
                const visibleItems = section.items.filter(item => canAccess(item.rbac))
                if (visibleItems.length === 0) return null

                return (
                    <div key={section.label}>
                        {(forMobile || !collapsed) && (
                            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-green-400/60">
                                {section.label}
                            </p>
                        )}
                        {!forMobile && collapsed && <div className="mx-auto mb-1 w-6 border-t border-green-700/60" />}
                        <div className="space-y-0.5">
                            {visibleItems.map((item) => {
                                const isActive =
                                    pathname === item.href ||
                                    (item.href !== "/dashboard" && pathname.startsWith(item.href))
                                const Icon = item.icon

                                // Mobile drawer: always show full labels
                                if (forMobile) {
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            prefetch={true}
                                            className={cn(
                                                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-all nav-link-smooth touch-target",
                                                isActive
                                                    ? "bg-green-700 text-cream-50 shadow-sm"
                                                    : "text-green-300 hover:bg-green-800 hover:text-cream-50"
                                            )}
                                        >
                                            {isActive && (
                                                <span
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cream-50"
                                                    style={{ animation: "navIndicator 200ms var(--ease-out-expo) forwards" }}
                                                />
                                            )}
                                            <Icon className={cn("h-4 w-4 shrink-0", isActive && "scale-110")} />
                                            <span className="truncate">{item.label}</span>
                                            {isActive && (
                                                <ChevronRight className="ml-auto h-3.5 w-3.5 text-green-400 animate-fade-in" />
                                            )}
                                        </Link>
                                    )
                                }

                                // Desktop collapsed: tooltip
                                if (collapsed) {
                                    return (
                                        <Tooltip key={item.href}>
                                            <TooltipTrigger
                                                className={cn(
                                                    "relative flex h-10 w-10 mx-auto items-center justify-center rounded-lg transition-all nav-link-smooth",
                                                    isActive
                                                        ? "bg-green-700 text-cream-50 shadow-sm"
                                                        : "text-green-300 hover:bg-green-800 hover:text-cream-50"
                                                )}
                                                render={<Link href={item.href} prefetch={true} />}
                                                onMouseEnter={() => {
                                                    const key = PREFETCH_KEYS[item.href]
                                                    if (key) usePrefetchStore.getState().prefetch(key)
                                                }}
                                            >
                                                <Icon className={cn("h-4 w-4 shrink-0", isActive && "scale-110")} />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="bg-green-800 text-cream-50 border-green-700 text-xs">
                                                {item.label}
                                            </TooltipContent>
                                        </Tooltip>
                                    )
                                }

                                // Desktop expanded: full link
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        prefetch={true}
                                        onMouseEnter={() => {
                                            const key = PREFETCH_KEYS[item.href]
                                            if (key) usePrefetchStore.getState().prefetch(key)
                                        }}
                                        className={cn(
                                            "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all nav-link-smooth",
                                            isActive
                                                ? "bg-green-700 text-cream-50 shadow-sm"
                                                : "text-green-300 hover:bg-green-800 hover:text-cream-50"
                                        )}
                                    >
                                        {isActive && (
                                            <span
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cream-50"
                                                style={{ animation: "navIndicator 200ms var(--ease-out-expo) forwards" }}
                                            />
                                        )}
                                        <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isActive && "scale-110")} />
                                        <span className="truncate">{item.label}</span>
                                        {isActive && (
                                            <ChevronRight className="ml-auto h-3.5 w-3.5 text-green-400 animate-fade-in" />
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </nav>
    )

    // ===================== BOTTOM FOOTER (shared for sidebar) =====================
    const renderSidebarFooter = (forMobile: boolean) => (
        <div className="border-t border-green-800 px-2 py-2 space-y-0.5">
            {!forMobile && collapsed ? (
                <>
                    <Tooltip>
                        <TooltipTrigger
                            className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg text-green-300 nav-link-smooth hover:bg-green-800 hover:text-cream-50"
                            render={<Link href="/dashboard/settings" prefetch={true} />}
                        >
                            <Settings className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-green-800 text-cream-50 border-green-700 text-xs">
                            Cài đặt
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger
                            onClick={handleLogout}
                            className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg text-green-300 btn-press hover:bg-wine-700 hover:text-white"
                        >
                            <LogOut className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-green-800 text-cream-50 border-green-700 text-xs">
                            {staff?.fullName ?? "Đăng xuất"}
                        </TooltipContent>
                    </Tooltip>
                </>
            ) : (
                <>
                    <Link
                        href="/dashboard/settings"
                        prefetch={true}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium text-green-300 nav-link-smooth hover:bg-green-800 hover:text-cream-50 touch-target"
                    >
                        <Settings className="h-4 w-4 icon-hover" />
                        <span>Cài đặt</span>
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium text-green-300 btn-press hover:bg-wine-700 hover:text-white touch-target"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>{staff?.fullName ?? "Đăng xuất"}</span>
                    </button>
                </>
            )}
        </div>
    )

    return (
        <div className="flex min-h-screen max-w-[100vw] overflow-x-hidden">
            {/* ============ MOBILE: Top Header Bar ============ */}
            {isMobile && !isFullScreenPOS && (
                <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-cream-300 bg-cream-100/95 px-4 py-2.5 backdrop-blur-sm safe-area-top">
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-green-900 hover:bg-cream-200 transition-all touch-target"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-900">
                            <Wine className="h-4 w-4 text-cream-50" />
                        </div>
                        <span className="font-display text-sm font-bold text-green-900">Noon & Noir</span>
                    </Link>
                    <Link
                        href="/pos"
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-900 text-cream-50 hover:bg-green-800 transition-all touch-target"
                    >
                        <Wine className="h-4 w-4" />
                    </Link>
                </header>
            )}

            {/* ============ MOBILE: Drawer Overlay Sidebar ============ */}
            {isMobile && mobileOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in"
                        onClick={() => setMobileOpen(false)}
                    />
                    {/* Drawer */}
                    <aside className="fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col bg-green-900 shadow-2xl animate-slide-in-left safe-area-top">
                        {/* Logo + Close */}
                        <div className="flex items-center justify-between border-b border-green-800 px-4 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-800">
                                    <Wine className="h-5 w-5 text-cream-50" />
                                </div>
                                <div>
                                    <p className="font-display text-sm font-bold text-cream-50">Noon & Noir</p>
                                    <p className="font-script text-xs text-green-300">Wine Alley</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-green-300 hover:bg-green-800 hover:text-cream-50 transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Staff info */}
                        {staff && (
                            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-green-800/30">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-700 text-[10px] font-bold text-cream-50">
                                    {staff.fullName?.charAt(0) ?? "?"}
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-cream-50">{staff.fullName}</p>
                                    <p className="text-[10px] text-green-400">{staff.role}</p>
                                </div>
                            </div>
                        )}

                        {/* Nav */}
                        {renderNavContent(true)}

                        {/* Footer */}
                        {renderSidebarFooter(true)}

                        {/* Checkered */}
                        <div className="h-2 pattern-checkered-sm mx-2 mb-1 rounded-sm" />
                    </aside>
                </>
            )}

            {/* ============ DESKTOP: Sidebar — Collapsible ============ */}
            {!isMobile && (
                <aside
                    className="fixed left-0 top-0 z-40 flex h-screen flex-col bg-green-900 transition-all duration-300 ease-out"
                    style={{ width: sidebarWidth }}
                >
                    {/* Logo */}
                    <Link
                        href="/dashboard"
                        className="group flex items-center gap-3 px-4 py-5 border-b border-green-800 transition-all hover:bg-green-800/50 overflow-hidden"
                        style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "20px 0" : undefined }}
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-800 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                            <Wine className="h-5 w-5 text-cream-50" />
                        </div>
                        {!collapsed && (
                            <div className="min-w-0">
                                <p className="font-display text-sm font-bold text-cream-50">Noon & Noir</p>
                                <p className="font-script text-xs text-green-300">Wine Alley</p>
                            </div>
                        )}
                    </Link>

                    {/* Collapse toggle button */}
                    <button
                        onClick={toggleSidebar}
                        className="fixed z-50 flex h-6 w-6 items-center justify-center rounded-full bg-green-700 border-2 border-cream-50 text-cream-50 shadow-md hover:bg-green-600 transition-all duration-300 hover:scale-110"
                        style={{ left: sidebarWidth - 12, top: 72 }}
                    >
                        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                    </button>

                    {/* Nav */}
                    {renderNavContent(false)}

                    {/* Footer */}
                    {renderSidebarFooter(false)}

                    {/* Checkered footer */}
                    <div className="h-2 pattern-checkered-sm mx-2 mb-1 rounded-sm" />
                </aside>
            )}

            {/* ============ Main Content ============ */}
            <main
                className={cn(
                    "flex-1 min-h-screen bg-cream-50 transition-all duration-300 ease-out max-w-[100vw] overflow-x-hidden",
                    isMobile && !isFullScreenPOS && "pt-[52px] pb-mobile-nav",
                )}
                style={!isMobile ? { marginLeft: sidebarWidth } : undefined}
            >
                <GlobalPrefetcher />
                <PageTransition>
                    {children}
                </PageTransition>
            </main>

            {/* ============ MOBILE: Bottom Navigation Bar ============ */}
            {isMobile && !isFullScreenPOS && (
                <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-cream-300 bg-cream-100/95 backdrop-blur-sm safe-area-bottom">
                    {bottomNavItems.map((item) => {
                        const Icon = item.icon
                        const isMenu = item.href === "__menu__"
                        const isActive = !isMenu && (
                            pathname === item.href ||
                            (item.href !== "/dashboard" && pathname.startsWith(item.href))
                        )

                        return (
                            <button
                                key={item.href}
                                onClick={() => {
                                    if (isMenu) {
                                        setMobileOpen(true)
                                    } else {
                                        router.push(item.href)
                                    }
                                }}
                                className={cn(
                                    "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all touch-target",
                                    isActive
                                        ? "text-green-900"
                                        : "text-cream-500"
                                )}
                            >
                                <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                                <span className={cn("text-[9px] font-medium", isActive && "font-bold")}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-green-900 nav-dot-enter" />
                                )}
                            </button>
                        )
                    })}
                </nav>
            )}
        </div>
    )
}
