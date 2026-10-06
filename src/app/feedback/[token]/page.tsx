"use client"

import { useState, useEffect, use } from "react"
import { Star, Wine, Send, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getFeedbackSession, submitFeedback, type FeedbackRating, type FeedbackItemInput } from "@/actions/feedback"

function StarRating({
    value,
    onChange,
    size = "md",
}: {
    value: number
    onChange: (v: FeedbackRating) => void
    size?: "sm" | "md" | "lg"
}) {
    const sizeClass = size === "lg" ? "h-8 w-8" : size === "md" ? "h-6 w-6" : "h-5 w-5"
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    onClick={() => onChange(star as FeedbackRating)}
                    className="transition-transform hover:scale-110 active:scale-95"
                >
                    <Star
                        className={cn(
                            sizeClass,
                            "transition-colors",
                            star <= value
                                ? "fill-amber-400 text-amber-400"
                                : "fill-none text-cream-300"
                        )}
                    />
                </button>
            ))}
        </div>
    )
}

export default function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params)
    const [session, setSession] = useState<Awaited<ReturnType<typeof getFeedbackSession>>>(null)
    const [loading, setLoading] = useState(true)
    const [submitted, setSubmitted] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Item ratings
    const [itemRatings, setItemRatings] = useState<Record<string, FeedbackItemInput>>({})
    // Overall
    const [visitRating, setVisitRating] = useState<number>(0)
    const [serviceRating, setServiceRating] = useState<number>(0)
    const [ambienceRating, setAmbienceRating] = useState<number>(0)
    const [overallRating, setOverallRating] = useState<number>(0)
    const [overallComment, setOverallComment] = useState("")

    useEffect(() => {
        getFeedbackSession(token).then((data) => {
            setSession(data)
            if (data) {
                const ratings: Record<string, FeedbackItemInput> = {}
                data.items.forEach((item) => {
                    ratings[item.orderItemId] = {
                        orderItemId: item.orderItemId,
                        productName: item.productName,
                        rating: 0 as FeedbackRating,
                        comment: "",
                    }
                })
                setItemRatings(ratings)
            }
            setLoading(false)
        })
    }, [token])

    const handleSubmit = async () => {
        if (!overallRating) return
        setSubmitting(true)
        await submitFeedback(token, {
            items: Object.values(itemRatings).filter((i) => i.rating > 0),
            visitRating: (visitRating || 4) as FeedbackRating,
            serviceRating: (serviceRating || 4) as FeedbackRating,
            ambienceRating: (ambienceRating || 4) as FeedbackRating,
            overallRating: overallRating as FeedbackRating,
            overallComment,
        })
        setSubmitting(false)
        setSubmitted(true)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-cream-50 flex items-center justify-center">
                <div className="animate-pulse text-center">
                    <p className="text-xs text-cream-500">Đang tải...</p>
                </div>
            </div>
        )
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-cream-50 flex items-center justify-center">
                <div className="text-center px-6">
                    <p className="text-sm text-cream-500">Liên kết đánh giá không hợp lệ hoặc đã hết hạn.</p>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-green-900 flex items-center justify-center px-6">
                <div className="text-center max-w-sm">
                    <h1 className="font-display text-2xl font-bold text-cream-50 mb-2">
                        Cảm ơn bạn!
                    </h1>
                    <p className="text-cream-300 text-sm mb-4">
                        Ý kiến của bạn giúp chúng tôi phục vụ tốt hơn.
                    </p>
                    <p className="font-script text-cream-400 text-lg italic">
                        drink slowly · laugh quietly · stay longer
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Heart
                                key={i}
                                className={cn(
                                    "h-5 w-5",
                                    i <= overallRating ? "fill-wine-600 text-wine-600" : "text-cream-500"
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-cream-50">
            {/* Header */}
            <div className="bg-green-900 px-6 py-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="font-display text-lg font-bold text-cream-50">Noon & Noir</span>
                </div>
                <p className="font-script text-cream-400 text-sm">Wine Alley</p>
                <p className="text-xs text-cream-300 mt-2">
                    Đơn hàng <span className="font-mono font-bold">{session.orderNumber}</span>
                </p>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 space-y-6">
                {/* Per-item feedback */}
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-green-900 mb-3 flex items-center gap-1.5">
                        Đánh giá từng món
                    </h2>
                    <div className="space-y-3">
                        {session.items.map((item) => (
                            <div key={item.orderItemId} className="rounded-xl border border-cream-200 bg-white p-3 shadow-2xs">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-green-900">{item.productName}</span>
                                    <StarRating
                                        value={itemRatings[item.orderItemId]?.rating || 0}
                                        onChange={(v) =>
                                            setItemRatings((prev) => ({
                                                ...prev,
                                                [item.orderItemId]: { ...prev[item.orderItemId], rating: v },
                                            }))
                                        }
                                        size="sm"
                                    />
                                </div>
                                <Input
                                    value={itemRatings[item.orderItemId]?.comment || ""}
                                    onChange={(e) =>
                                        setItemRatings((prev) => ({
                                            ...prev,
                                            [item.orderItemId]: { ...prev[item.orderItemId], comment: e.target.value },
                                        }))
                                    }
                                    placeholder="Góp ý về món ăn / thức uống này..."
                                    className="h-8 text-xs border-cream-200"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Overall Ratings */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-green-900 flex items-center gap-1.5">
                        Cảm nhận tổng thể
                    </h2>
                    <div className="rounded-xl border border-cream-200 bg-white p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-stone-700 flex items-center gap-1.5 font-medium">
                                Không gian & Âm nhạc
                            </span>
                            <StarRating value={ambienceRating} onChange={setAmbienceRating} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-stone-700 flex items-center gap-1.5 font-medium">
                                Tốc độ & Thái độ phục vụ
                            </span>
                            <StarRating value={serviceRating} onChange={setServiceRating} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-stone-700 flex items-center gap-1.5 font-medium">
                                Trải nghiệm Rượu vang & Ẩm thực
                            </span>
                            <StarRating value={visitRating} onChange={setVisitRating} />
                        </div>
                        <div className="border-t border-cream-200 pt-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-green-900 uppercase tracking-wide">Mức độ hài lòng chung</span>
                            <StarRating value={overallRating} onChange={setOverallRating} size="lg" />
                        </div>
                    </div>
                </div>

                {/* Comment */}
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-green-900 mb-1.5 flex items-center gap-1.5">
                        Góp ý thêm cho Noon & Noir
                    </label>
                    <textarea
                        value={overallComment}
                        onChange={(e) => setOverallComment(e.target.value)}
                        placeholder="Chia sẻ trải nghiệm hoặc mong muốn của bạn cho những lần ghé sau..."
                        rows={3}
                        className="w-full rounded-xl border border-cream-200 bg-white px-3 py-2 text-xs text-green-900 placeholder:text-cream-400 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none shadow-2xs"
                    />
                </div>

                {/* Submit */}
                <Button
                    onClick={handleSubmit}
                    disabled={submitting || !overallRating}
                    className="w-full h-12 bg-green-900 text-cream-50 hover:bg-green-800 text-sm font-bold rounded-xl"
                >
                    {submitting ? (
                        "Đang gửi..."
                    ) : (
                        <>
                            <Send className="mr-2 h-4 w-4" />
                            Gửi đánh giá
                        </>
                    )}
                </Button>

                <p className="text-[9px] text-cream-400 text-center italic">
                    Ý kiến của bạn được bảo mật và giúp chúng tôi cải thiện dịch vụ
                </p>
            </div>
        </div>
    )
}
