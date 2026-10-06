"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Delete, Loader2 } from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import { verifyStaffPin } from "@/actions/staff"

export default function LoginPage() {
    const [pin, setPin] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [shake, setShake] = useState(false)
    const [activeKey, setActiveKey] = useState<string | null>(null)
    const router = useRouter()
    const { login } = useAuthStore()

    const pinRef = useRef("")
    const isLoadingRef = useRef(false)
    const activeKeyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const triggerKeyFeedback = useCallback((key: string) => {
        setActiveKey(key)
        if (activeKeyTimeoutRef.current) {
            clearTimeout(activeKeyTimeoutRef.current)
        }
        activeKeyTimeoutRef.current = setTimeout(() => {
            setActiveKey(null)
        }, 130)
    }, [])

    const verifyAndLogin = useCallback(async (enteredPin: string) => {
        setIsLoading(true)
        isLoadingRef.current = true

        try {
            const result = await verifyStaffPin(enteredPin)

            if (result && "error" in result) {
                // Rate limited or error
                setShake(true)
                pinRef.current = ""
                setPin("")
                toast.error(result.error)
                setTimeout(() => setShake(false), 500)
            } else if (result && "id" in result) {
                login({
                    id: result.id,
                    fullName: result.fullName,
                    role: result.role,
                })
                toast.success(`Xin chào, ${result.fullName}!`)
                router.replace("/pos")
            } else {
                setShake(true)
                pinRef.current = ""
                setPin("")
                toast.error("PIN không đúng")
                setTimeout(() => setShake(false), 500)
            }
        } catch {
            setShake(true)
            pinRef.current = ""
            setPin("")
            toast.error("Lỗi kết nối server")
            setTimeout(() => setShake(false), 500)
        } finally {
            setIsLoading(false)
            isLoadingRef.current = false
        }
    }, [login, router])

    const handleNumber = useCallback((num: string) => {
        if (isLoadingRef.current) return
        if (pinRef.current.length >= 4) return

        triggerKeyFeedback(num)

        const newPin = pinRef.current + num
        pinRef.current = newPin
        setPin(newPin)

        if (newPin.length >= 4) {
            verifyAndLogin(newPin)
        }
    }, [triggerKeyFeedback, verifyAndLogin])

    const handleDelete = useCallback(() => {
        if (isLoadingRef.current || pinRef.current.length === 0) return
        triggerKeyFeedback("del")
        const newPin = pinRef.current.slice(0, -1)
        pinRef.current = newPin
        setPin(newPin)
    }, [triggerKeyFeedback])

    const handleClear = useCallback(() => {
        if (isLoadingRef.current) return
        pinRef.current = ""
        setPin("")
    }, [])

    // Lắng nghe sự kiện bàn phím vật lý
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Không can thiệp nếu người dùng đang dùng phím tắt hệ thống (Ctrl, Alt, Meta)
            if (e.ctrlKey || e.altKey || e.metaKey) return

            if (e.key >= "0" && e.key <= "9") {
                e.preventDefault()
                handleNumber(e.key)
            } else if (e.key === "Backspace") {
                e.preventDefault()
                handleDelete()
            } else if (e.key === "Escape" || e.key === "Delete") {
                e.preventDefault()
                handleClear()
            } else if (e.key === "Enter") {
                if (pinRef.current.length >= 4 && !isLoadingRef.current) {
                    e.preventDefault()
                    verifyAndLogin(pinRef.current)
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            if (activeKeyTimeoutRef.current) {
                clearTimeout(activeKeyTimeoutRef.current)
            }
        }
    }, [handleNumber, handleDelete, handleClear, verifyAndLogin])

    const numpadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"]

    return (
        <div className="flex min-h-screen items-center justify-center bg-cream-50">
            <div className="w-full max-w-sm px-6">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center">
                    <h1 className="font-display text-2xl font-bold text-green-900 tracking-tight">
                        Noon &amp; Noir
                    </h1>
                    <p className="font-script text-lg text-green-700">Wine Alley</p>
                </div>

                {/* PIN Dots */}
                <div className={`mb-8 flex justify-center gap-3 ${shake ? "animate-shake" : ""}`}>
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${i < pin.length
                                ? "border-green-900 bg-green-900 scale-110"
                                : "border-cream-400 bg-cream-100"
                                }`}
                        />
                    ))}
                </div>

                {/* Status text */}
                <p className="mb-6 text-center text-sm text-cream-500">
                    {isLoading ? "Đang xác thực..." : "Nhập mã PIN hoặc dùng bàn phím số"}
                </p>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-3">
                    {numpadKeys.map((key, idx) => {
                        if (key === "") return <div key={idx} />
                        if (key === "del") {
                            const isDelActive = activeKey === "del"
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isLoading || pin.length === 0}
                                    title="Xóa một số (Backspace)"
                                    className={`flex h-16 items-center justify-center rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-30 ${isDelActive
                                        ? "bg-cream-300 scale-95"
                                        : "bg-cream-100 text-green-900 hover:bg-cream-200"
                                        }`}
                                >
                                    <Delete className="h-6 w-6" />
                                </button>
                            )
                        }
                        const isNumActive = activeKey === key
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleNumber(key)}
                                disabled={isLoading}
                                className={`flex h-16 items-center justify-center rounded-xl font-sans text-2xl font-semibold text-green-900 transition-all duration-150 active:scale-95 disabled:opacity-50 ${isNumActive
                                    ? "bg-green-200 scale-95"
                                    : "bg-cream-100 hover:bg-green-100 active:bg-green-200"
                                    }`}
                            >
                                {isLoading && pin.length >= 4 ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    key
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Tagline */}
                <p className="mt-8 text-center font-script text-base text-cream-400">
                    drink slowly · laugh quietly · stay longer
                </p>

                {/* Dev hint */}
                <div className="mt-6 rounded-xl border border-cream-200/80 bg-cream-100/70 p-3 text-xs text-cream-600">
                    <p className="font-semibold mb-1 text-stone-700">
                        Mã PIN truy cập mẫu:
                    </p>
                    <p className="font-sans text-[12px] text-stone-600">Owner: 1234 · Manager: 5678 · Cashier: 0000</p>
                    <p className="font-sans text-[12px] text-stone-600">Bartender: 1111 · Waiter: 2222</p>
                </div>
            </div>
        </div>
    )
}
