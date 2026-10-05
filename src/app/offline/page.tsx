"use client"

import { WifiOff, Wine, RefreshCw, CheckCircle2 } from "lucide-react"

export default function OfflinePage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-cream-50 p-8">
            <div className="text-center max-w-md">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
                    <WifiOff className="h-10 w-10 text-amber-700" />
                </div>
                <h1 className="font-display text-2xl font-bold text-green-950 mb-3">
                    Tạm gián đoạn kết nối
                </h1>
                <p className="text-sm text-stone-600 leading-relaxed mb-6 font-sans">
                    Noon & Noir POS đang tự động chuyển sang chế độ phục vụ ngoại tuyến (Offline Mode).
                    <br />
                    Mọi đơn order tại bàn và in phiếu thanh toán vẫn hoạt động bình thường.
                </p>

                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-cream-200 rounded-full text-xs font-semibold text-amber-800 shadow-xs">
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                    Đang lưu cục bộ & đợi đồng bộ...
                </div>

                <div className="mt-6 p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                    Đơn hàng offline sẽ tự động đồng bộ lên máy chủ ngay khi có Internet
                </div>

                <button
                    onClick={() => typeof window !== "undefined" && window.location.reload()}
                    className="mt-6 inline-flex items-center gap-2 px-8 py-3 bg-green-900 text-cream-50 rounded-xl text-sm font-bold hover:bg-green-800 transition-all shadow-md active:scale-98"
                >
                    <RefreshCw className="h-4 w-4" />
                    Thử kết nối lại
                </button>
            </div>
        </div>
    )
}
