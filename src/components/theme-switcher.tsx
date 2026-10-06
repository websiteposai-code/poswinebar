"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { useThemeStore, THEMES, type ThemeId } from "@/stores/theme-store"
import { Check, Palette } from "lucide-react"

/**
 * Theme Provider — apply persisted theme on mount.
 * Put this in the root layout.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { applyTheme } = useThemeStore()

    useEffect(() => {
        applyTheme()
    }, [applyTheme])

    return <>{children}</>
}

/**
 * Compact theme indicator button (for header/sidebar).
 */
export function ThemeButton({ onClick }: { onClick: () => void }) {
    const { themeId } = useThemeStore()
    const theme = THEMES.find((t) => t.id === themeId)

    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:bg-cream-200"
            title="Đổi giao diện"
        >
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{theme?.nameVi ?? "Theme"}</span>
        </button>
    )
}

/**
 * Full theme picker panel — shows all themes with live preview.
 */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
    const { themeId, setTheme } = useThemeStore()

    return (
        <div className={cn("space-y-3", compact ? "p-3" : "p-0")}>
            {!compact && (
                <div className="mb-4">
                    <h3 className="font-display text-lg font-bold text-green-900 flex items-center gap-2">
                        Giao diện
                    </h3>
                    <p className="text-xs text-cream-500 mt-1">Chọn bộ màu phù hợp với không gian của bạn</p>
                </div>
            )}

            <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3")}>
                {THEMES.map((theme) => {
                    const isActive = themeId === theme.id
                    return (
                        <button
                            key={theme.id}
                            onClick={() => setTheme(theme.id)}
                            className={cn(
                                "group relative rounded-xl border-2 p-3 text-left transition-all duration-200",
                                isActive
                                    ? "border-green-700 shadow-lg scale-[1.02]"
                                    : "border-cream-300 hover:border-cream-400 hover:shadow-md"
                            )}
                        >
                            {/* Active badge */}
                            {isActive && (
                                <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-700 text-white shadow-md">
                                    <Check className="h-3 w-3" />
                                </div>
                            )}

                            {/* Color preview row */}
                            <div className="flex gap-1 mb-2">
                                <div
                                    className="h-8 flex-1 rounded-l-lg"
                                    style={{ backgroundColor: theme.preview.sidebar }}
                                />
                                <div
                                    className="h-8 flex-1"
                                    style={{ backgroundColor: theme.preview.primary }}
                                />
                                <div
                                    className="h-8 flex-1"
                                    style={{ backgroundColor: theme.preview.accent }}
                                />
                                <div
                                    className="h-8 flex-1 rounded-r-lg border border-gray-200"
                                    style={{ backgroundColor: theme.preview.bg }}
                                />
                            </div>

                            {/* Mini UI preview */}
                            <div
                                className="rounded-lg overflow-hidden mb-2 flex"
                                style={{ backgroundColor: theme.preview.bg, height: 48 }}
                            >
                                {/* Sidebar mini */}
                                <div
                                    className="w-8 flex flex-col items-center justify-center gap-1"
                                    style={{ backgroundColor: theme.preview.sidebar }}
                                >
                                    <div className="w-3 h-3 rounded-sm opacity-60" style={{ backgroundColor: theme.preview.bg }} />
                                    <div className="w-3 h-0.5 rounded opacity-40" style={{ backgroundColor: theme.preview.bg }} />
                                    <div className="w-3 h-0.5 rounded opacity-30" style={{ backgroundColor: theme.preview.bg }} />
                                </div>
                                {/* Content mini */}
                                <div className="flex-1 p-1.5 flex flex-col justify-between">
                                    <div className="flex gap-1">
                                        <div className="h-2 w-8 rounded" style={{ backgroundColor: theme.preview.primary, opacity: 0.7 }} />
                                        <div className="h-2 w-4 rounded" style={{ backgroundColor: theme.preview.accent, opacity: 0.5 }} />
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="h-4 w-6 rounded-sm" style={{ backgroundColor: theme.preview.primary, opacity: 0.1 }} />
                                        <div className="h-4 w-6 rounded-sm" style={{ backgroundColor: theme.preview.primary, opacity: 0.1 }} />
                                        <div className="h-4 w-6 rounded-sm" style={{ backgroundColor: theme.preview.accent, opacity: 0.15 }} />
                                    </div>
                                </div>
                            </div>

                            {/* Label */}
                            <div>
                                <p className="font-display text-sm font-bold" style={{ color: theme.preview.primary }}>
                                    {theme.nameVi}
                                </p>
                                <p className="text-[10px] text-cream-500 leading-tight mt-0.5">{theme.description}</p>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
