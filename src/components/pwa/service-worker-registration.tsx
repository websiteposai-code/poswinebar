"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { toast } from "sonner"

// ============================================================
// SERVICE WORKER REGISTRATION — registers sw.js from /public
// ============================================================

export function ServiceWorkerRegistration() {
    const [isOnline, setIsOnline] = useState(true)
    const [swRegistered, setSwRegistered] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined") return
        if (!("serviceWorker" in navigator)) return

        // Register SW
        navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((reg) => {
                console.log("[PWA] Service Worker registered:", reg.scope)
                setSwRegistered(true)

                // Handle updates
                reg.onupdatefound = () => {
                    const newWorker = reg.installing
                    if (!newWorker) return
                    newWorker.onstatechange = () => {
                        if (newWorker.state === "activated") {
                            toast.info("Noon & Noir đã có phiên bản cập nhật mới", {
                                action: { label: "Tải lại", onClick: () => window.location.reload() },
                                duration: 10000,
                            })
                        }
                    }
                }
            })
            .catch((err) => {
                console.warn("[PWA] SW registration failed:", err)
            })

        // Online/Offline detection
        const handleOnline = () => {
            setIsOnline(true)
            toast.success("Đã kết nối lại mạng", {
                description: "Đang đồng bộ các đơn đã lưu offline...",
                duration: 4000,
            })
            // Tell SW to replay queued requests
            navigator.serviceWorker.controller?.postMessage({ type: "ONLINE_RESTORED" })
        }

        const handleOffline = () => {
            setIsOnline(false)
            toast.warning("Mất kết nối mạng", {
                description: "POS sẽ hoạt động offline. Đơn hàng sẽ được lưu tạm.",
                duration: 8000,
            })
        }

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)
        setIsOnline(navigator.onLine)

        // Listen for SW messages
        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data?.type === "OFFLINE_QUEUE_ADD") {
                const queue = getOfflineQueue()
                queue.push(event.data.payload)
                saveOfflineQueue(queue)
                toast.info("Đã lưu đơn ngoại tuyến", {
                    description: `${queue.length} đơn đang chờ gửi`,
                    duration: 3000,
                })
            }

            if (event.data?.type === "OFFLINE_QUEUE_REPLAY") {
                replayQueue()
            }
        })

        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [])

    return null // This is an invisible component
}

// ============================================================
// OFFLINE QUEUE — localStorage-based persistence
// ============================================================

type QueueItem = {
    id: string
    url: string
    method: string
    headers: Record<string, string>
    body: string
    timestamp: number
}

function getOfflineQueue(): QueueItem[] {
    try {
        const raw = localStorage.getItem("nn-offline-queue")
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function saveOfflineQueue(queue: QueueItem[]) {
    try {
        localStorage.setItem("nn-offline-queue", JSON.stringify(queue))
    } catch {
        console.warn("[OfflineQueue] localStorage full")
    }
}

async function replayQueue() {
    const queue = getOfflineQueue()
    if (queue.length === 0) return

    console.log(`[OfflineQueue] Replaying ${queue.length} queued requests...`)
    const failed: QueueItem[] = []
    let success = 0

    for (const item of queue) {
        try {
            const response = await fetch(item.url, {
                method: item.method,
                headers: item.headers,
                body: item.body,
            })
            if (response.ok) {
                success++
            } else {
                failed.push(item)
            }
        } catch {
            failed.push(item)
        }
    }

    saveOfflineQueue(failed)

    if (success > 0) {
        toast.success(`Đã đồng bộ ${success} đơn offline thành công`, {
            description: failed.length > 0 ? `${failed.length} đơn chưa gửi được` : undefined,
            duration: 5000,
        })
    }

    if (failed.length > 0) {
        console.warn(`[OfflineQueue] ${failed.length} requests still queued`)
    }
}

// ============================================================
// HOOK: useOnlineStatus — reactive online/offline state
// ============================================================
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true)
    const [queueCount, setQueueCount] = useState(0)

    useEffect(() => {
        if (typeof window === "undefined") return

        setIsOnline(navigator.onLine)
        setQueueCount(getOfflineQueue().length)

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        // Poll queue count
        const interval = setInterval(() => {
            setQueueCount(getOfflineQueue().length)
        }, 5000)

        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
            clearInterval(interval)
        }
    }, [])

    return { isOnline, queueCount }
}
