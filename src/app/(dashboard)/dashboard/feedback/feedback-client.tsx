"use client"

import { useState } from "react"
import { Star, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getAllFeedback } from "@/actions/feedback"
import { toast } from "sonner"

export type FeedbackData = Awaited<ReturnType<typeof getAllFeedback>>

export default function FeedbackClient({ initial }: { initial: FeedbackData }) {
    const [data, setData] = useState<FeedbackData>(initial)
    const [loading, setLoading] = useState(false)

    const loadData = async () => {
        setLoading(true)
        try {
            const result = await getAllFeedback()
            setData(result)
        } catch (err) {
            console.error("[Feedback] load failed:", err)
            toast.error("Không thể tải dữ liệu feedback")
        }
        setLoading(false)
    }

    const { sessions, stats } = data

    return (
        <div className="p-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                <div>
                    <h1 className="font-display text-lg lg:text-2xl font-bold text-green-900 flex items-center gap-2">
                        Feedback Khách hàng
                    </h1>
                    <p className="text-sm text-cream-500 mt-0.5">
                        Đánh giá từ khách hàng qua QR code trên bill
                    </p>
                </div>
                <Button
                    onClick={loadData}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className="border-cream-300 text-cream-600 hover:border-green-600 hover:text-green-700"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                    Làm mới
                </Button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase text-amber-700">Tổng thể</p>
                    <p className="font-mono text-2xl font-bold text-amber-800">{stats.avgOverall}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={cn("h-3 w-3",
                                s <= stats.avgOverall ? "fill-amber-400 text-amber-400" : "text-cream-300"
                            )} />
                        ))}
                    </div>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase text-green-700">Phục vụ</p>
                    <p className="font-mono text-2xl font-bold text-green-800">{stats.avgService}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase text-blue-700">Trải nghiệm</p>
                    <p className="font-mono text-2xl font-bold text-blue-800">{stats.avgVisit}</p>
                </div>
                <div className="rounded-xl border border-wine-200 bg-wine-50 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase text-wine-700">Không gian</p>
                    <p className="font-mono text-2xl font-bold text-wine-800">{stats.avgAmbience}</p>
                </div>
                <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase text-cream-500">Phản hồi</p>
                    <p className="font-mono text-2xl font-bold text-green-900">{stats.total}</p>
                </div>
            </div>

            {/* Rating Distribution */}
            <div className="rounded-xl border border-cream-200 bg-white p-4 mb-6">
                <h3 className="text-xs font-bold text-green-900 mb-3 flex items-center gap-1.5">
                    Phân bố đánh giá
                </h3>
                <div className="space-y-1.5">
                    {[5, 4, 3, 2, 1].map((rating) => {
                        const count = stats.distribution[rating] || 0
                        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                        return (
                            <div key={rating} className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5 w-16 shrink-0">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Star key={s} className={cn("h-3 w-3",
                                            s <= rating ? "fill-amber-400 text-amber-400" : "text-cream-200"
                                        )} />
                                    ))}
                                </div>
                                <div className="flex-1 h-5 bg-cream-100 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-500",
                                            rating >= 4 ? "bg-green-500" : rating >= 3 ? "bg-amber-500" : "bg-red-500"
                                        )}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="w-12 text-right font-mono text-xs font-bold text-cream-600">
                                    {count} ({pct}%)
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Recent Reviews */}
            <div>
                <h3 className="text-sm font-bold text-green-900 mb-3">
                    Phản hồi gần đây
                </h3>
                <div className="space-y-3">
                    {sessions.map((session) => {
                        const isPositive = session.overallRating >= 4
                        return (
                            <div
                                key={session.id}
                                className={cn(
                                    "rounded-xl border bg-white p-4 hover:shadow-sm transition-all",
                                    session.overallRating <= 2 ? "border-red-200" : "border-cream-200"
                                )}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {isPositive ? (
                                            <ThumbsUp className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <ThumbsDown className="h-4 w-4 text-red-500" />
                                        )}
                                        <span className="font-mono text-xs font-bold text-cream-600">
                                            {session.orderNumber}
                                        </span>
                                        <span className="text-[10px] text-cream-400">
                                            {new Date(session.createdAt).toLocaleString("vi-VN", {
                                                day: "2-digit", month: "2-digit",
                                                hour: "2-digit", minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star key={s} className={cn("h-4 w-4",
                                                s <= session.overallRating ? "fill-amber-400 text-amber-400" : "text-cream-200"
                                            )} />
                                        ))}
                                    </div>
                                </div>

                                {session.overallComment && (
                                    <p className="text-xs text-green-900 mb-2 leading-relaxed italic">
                                        &ldquo;{session.overallComment}&rdquo;
                                    </p>
                                )}

                                {/* Sub-ratings */}
                                <div className="flex items-center gap-3 text-[10px] mb-2">
                                    <span className={cn("flex items-center gap-0.5",
                                        session.serviceRating >= 4 ? "text-green-600" : session.serviceRating >= 3 ? "text-amber-600" : "text-red-500"
                                    )}>
                                        {session.serviceRating}
                                    </span>
                                    <span className={cn("flex items-center gap-0.5",
                                        session.visitRating >= 4 ? "text-green-600" : session.visitRating >= 3 ? "text-amber-600" : "text-red-500"
                                    )}>
                                        {session.visitRating}
                                    </span>
                                    <span className={cn("flex items-center gap-0.5",
                                        session.ambienceRating >= 4 ? "text-green-600" : session.ambienceRating >= 3 ? "text-amber-600" : "text-red-500"
                                    )}>
                                        {session.ambienceRating}
                                    </span>
                                </div>

                                {/* Per-item ratings */}
                                {session.items.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {session.items.map((item, idx) => (
                                            <Badge
                                                key={idx}
                                                className={cn(
                                                    "text-[9px] px-1.5 py-0 border",
                                                    item.rating >= 4
                                                        ? "bg-green-50 text-green-700 border-green-200"
                                                        : item.rating >= 3
                                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                                            : "bg-red-50 text-red-700 border-red-200"
                                                )}
                                            >
                                                {item.productName} · {"★".repeat(item.rating)}
                                                {item.comment && ` · ${item.comment}`}
                                            </Badge>
                                        ))}
                                    </div>
                                )}

                                {/* Alert for low ratings */}
                                {session.overallRating <= 2 && (
                                    <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-[10px] text-red-700">
                                        Đánh giá thấp — cần follow-up với khách
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="mt-6 text-center">
                <p className="text-[10px] text-cream-400 italic">
                    QR code tự động in trên bill · Feedback ẩn danh · Thông báo Telegram khi rating ≤ 2
                </p>
            </div>
        </div>
    )
}
