"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Wine, Delete, Loader2, KeyRound } from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import { verifyStaffPin } from "@/actions/staff"

export default function LoginPage() {
    const [pin, setPin] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [shake, setShake] = useState(false)
    const router = useRouter()
    const { login } = useAuthStore()

    const handleNumber = useCallback((num: string) => {
        if (pin.length >= 6) return
        const newPin = pin + num

        setPin(newPin)

        if (newPin.length >= 4) {
            verifyAndLogin(newPin)
        }
    }, [pin])

    const handleDelete = useCallback(() => {
        setPin((prev) => prev.slice(0, -1))
    }, [])

    const verifyAndLogin = async (enteredPin: string) => {
        setIsLoading(true)

        try {
            const result = await verifyStaffPin(enteredPin)

            if (result && 'error' in result) {
                // Rate limited
                setShake(true)
                setPin("")
                toast.error(result.error)
                setTimeout(() => setShake(false), 500)
            } else if (result && 'id' in result) {
                login({
                    id: result.id,
                    fullName: result.fullName,
                    role: result.role,
                })
                toast.success(`Xin chào, ${result.fullName}!`)
                router.replace("/pos")
            } else {
                setShake(true)
                setPin("")
                toast.error("PIN không đúng")
                setTimeout(() => setShake(false), 500)
            }
        } catch {
            setShake(true)
            setPin("")
            toast.error("Lỗi kết nối server")
            setTimeout(() => setShake(false), 500)
        }

        setIsLoading(false)
    }

    const numpadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"]

    return (
        <div className="flex min-h-screen items-center justify-center bg-cream-50">
            <div className="w-full max-w-sm px-6">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-900">
                        <Wine className="h-10 w-10 text-cream-50" />
                    </div>
                    <h1 className="font-display text-2xl font-bold text-green-900">
                        Noon & Noir
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
                    {isLoading ? "Đang xác thực..." : "Nhập mã PIN để đăng nhập"}
                </p>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-3">
                    {numpadKeys.map((key, idx) => {
                        if (key === "") return <div key={idx} />
                        if (key === "del") {
                            return (
                                <button
                                    key={idx}
                                    onClick={handleDelete}
                                    disabled={isLoading || pin.length === 0}
                                    className="flex h-16 items-center justify-center rounded-xl bg-cream-100 text-green-900 transition-all hover:bg-cream-200 active:scale-95 disabled:opacity-30"
                                >
                                    <Delete className="h-6 w-6" />
                                </button>
                            )
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleNumber(key)}
                                disabled={isLoading}
                                className="flex h-16 items-center justify-center rounded-xl bg-cream-100 font-sans text-2xl font-semibold text-green-900 transition-all hover:bg-green-100 active:scale-95 active:bg-green-200 disabled:opacity-50"
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
                    <p className="font-semibold mb-1 flex items-center gap-1.5 text-stone-700">
                        <KeyRound className="h-3.5 w-3.5 text-amber-700" />
                        Mã PIN truy cập mẫu:
                    </p>
                    <p className="font-mono text-[11px] text-stone-600">Owner: 1234 · Manager: 5678 · Cashier: 0000</p>
                    <p className="font-mono text-[11px] text-stone-600">Bartender: 1111 · Waiter: 2222</p>
                </div>
            </div>
        </div>
    )
}
