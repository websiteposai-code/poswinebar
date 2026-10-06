import { Wine } from "lucide-react"

export default function DashboardLayoutLoading() {
    return (
        <div className="flex min-h-screen">
            {/* Sidebar skeleton */}
            <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[220px] flex-col bg-green-900 animate-fade-in">
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 py-5 border-b border-green-800">
                    <div>
                        <p className="font-display text-sm font-bold text-cream-50">Noon & Noir</p>
                        <p className="font-script text-xs text-green-300">Wine Alley</p>
                    </div>
                </div>

                {/* Nav skeleton with stagger */}
                <div className="flex-1 px-3 py-3 space-y-4">
                    {[1, 2, 3].map((section) => (
                        <div key={section} style={{ animation: `fadeInUp 300ms var(--ease-out-expo) ${section * 100}ms both` }}>
                            <div className="h-3 w-16 rounded bg-green-700/50 mb-2 ml-2" />
                            <div className="space-y-1">
                                {[1, 2, 3].slice(0, section === 2 ? 3 : 2).map((item) => (
                                    <div key={item} className="h-8 rounded-lg bg-green-800/40" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Content skeleton */}
            <main className="lg:ml-[220px] flex-1 min-h-screen bg-cream-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <span className="text-xs text-cream-400 animate-pulse">Đang tải...</span>
                </div>
            </main>
        </div>
    )
}
