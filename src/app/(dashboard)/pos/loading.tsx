import { Wine } from "lucide-react"

export default function POSLoading() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-cream-50">
            <div className="flex flex-col items-center gap-5 animate-fade-in">
                {/* Pulsing Wine icon with ring */}
                <div className="relative">
                    {/* Animated ring */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-green-500/30 animate-pulse-ring" />
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-wine-500 shadow-lg" style={{ animation: "fadeInScale 400ms var(--ease-out-back) forwards" }} />
                </div>

                {/* Text with stagger */}
                <div className="space-y-2 text-center">
                    <p className="font-display text-xl font-bold text-green-900" style={{ animation: "fadeInUp 400ms var(--ease-out-expo) 100ms both" }}>
                        Noon & Noir
                    </p>
                    <p className="font-script text-sm text-green-600" style={{ animation: "fadeInUp 400ms var(--ease-out-expo) 200ms both" }}>
                        Đang chuẩn bị POS...
                    </p>
                </div>

                {/* Shimmer progress bar */}
                <div className="w-48 h-1 rounded-full overflow-hidden bg-cream-200" style={{ animation: "fadeIn 400ms var(--ease-out-expo) 300ms both" }}>
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-green-600 via-green-400 to-green-600"
                        style={{
                            width: "60%",
                            animation: "shimmer 1.2s ease-in-out infinite, progressGrow 2s var(--ease-out-expo) forwards",
                            backgroundSize: "200% 100%",
                        }}
                    />
                </div>
            </div>

            <style>{`
                @keyframes progressGrow {
                    from { width: 20%; }
                    to { width: 85%; }
                }
            `}</style>
        </div>
    )
}
