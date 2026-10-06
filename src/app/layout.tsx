import type { Metadata, Viewport } from "next"
import { DM_Sans, Playfair_Display } from "next/font/google"
import { Toaster } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme-switcher"
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration"
import "./globals.css"

// Critical body font — preload + swap
const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
})

// Display font (upright for headings, italic for brand accents)
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Noon & Noir — Wine Alley POS",
  description: "drink slowly · laugh quietly · stay longer",
  icons: { icon: "/favicon.ico", apple: "/icons/icon-192.png" },
  manifest: "/manifest.json",
  themeColor: "#14532d",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noon & Noir",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${playfair.variable} font-sans antialiased bg-cream-50 text-green-900`}
      >
        <TooltipProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </TooltipProvider>
        <ServiceWorkerRegistration />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--color-cream-100)",
              border: "1px solid var(--color-cream-300)",
              color: "var(--color-green-900)",
            },
          }}
        />
      </body>
    </html>
  )
}
