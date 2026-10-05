// ============================================================
// WASTE / SPOILAGE TYPES & CONSTANTS
// Separated from "use server" actions to comply with Next.js Turbopack
// ============================================================

export type WasteType = "WASTE" | "SPOILAGE" | "BREAKAGE"

export type WasteReasonCategory =
    | "CORKED"        // Vang lỗi nút bần (TCA)
    | "OXIDATION"     // Vang mở ly oxy hoá / quá hạn
    | "BREAKAGE"      // Rơi vỡ chai / ly
    | "SPILLAGE"      // Đổ / tràn khi rót
    | "TASTING"       // Nếm thử chất lượng / training
    | "SPOILAGE"      // Hư hỏng nguyên liệu bếp
    | "OTHER"         // Lý do khác

export const WASTE_REASON_LABELS: Record<WasteReasonCategory, { label: string; badge: string; icon: string }> = {
    CORKED: { label: "Lỗi nút bần (Corked / TCA)", badge: "bg-red-50 text-red-800 border-red-200", icon: "corked" },
    OXIDATION: { label: "Oxy hoá vang mở ly (Oxidized)", badge: "bg-amber-50 text-amber-800 border-amber-200", icon: "oxidation" },
    BREAKAGE: { label: "Rơi vỡ chai / ly", badge: "bg-orange-50 text-orange-800 border-orange-200", icon: "breakage" },
    SPILLAGE: { label: "Đổ / tràn khi phục vụ", badge: "bg-amber-50 text-amber-800 border-amber-200", icon: "spillage" },
    TASTING: { label: "Nếm thử / Training / Sample", badge: "bg-stone-100 text-stone-800 border-stone-200", icon: "tasting" },
    SPOILAGE: { label: "Hư hỏng nguyên liệu bếp", badge: "bg-stone-100 text-stone-800 border-stone-200", icon: "spoilage" },
    OTHER: { label: "Lý do khác", badge: "bg-cream-100 text-cream-800 border-cream-200", icon: "other" },
}
