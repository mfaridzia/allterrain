import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n/context";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#F6F4EE",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://allterrain.muhfaridzia.live"),
  title: {
    default: "ALLTERRAIN - COROS Training Analytics & Trail Planner",
    template: "%s | ALLTERRAIN",
  },
  description:
    "Advanced COROS endurance analytics & trail planning platform. Bannister PMC modeling (Fitness, Fatigue, Form), interactive GPX elevation simulation, and intelligent AI Coaching.",
  applicationName: "ALLTERRAIN",
  authors: [{ name: "Muh Farid Zia", url: "https://allterrain.muhfaridzia.live" }],
  creator: "Muh Farid Zia",
  publisher: "ALLTERRAIN",
  keywords: [
    "COROS",
    "COROS Training",
    "AllTerrain",
    "Trail Running",
    "PMC Chart",
    "Bannister PMC",
    "Fitness Fatigue",
    "Training Load",
    "GPX Planner",
    "Endurance Athlete",
    "Running Analytics",
  ],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "ALLTERRAIN - COROS Training Analytics & Trail Planner",
    description:
      "Advanced COROS endurance analytics & trail planning platform. Bannister PMC modeling (Fitness, Fatigue, Form), interactive GPX elevation simulation, and intelligent AI Coaching.",
    url: "https://allterrain.muhfaridzia.live",
    siteName: "ALLTERRAIN",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ALLTERRAIN - COROS Training Analytics & Trail Elevation Suite",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ALLTERRAIN - COROS Training Analytics & Trail Planner",
    description:
      "Advanced COROS endurance analytics & trail planning platform. Bannister PMC modeling (Fitness, Fatigue, Form), interactive GPX elevation simulation, and intelligent AI Coaching.",
    images: ["/og-image.png"],
    creator: "@mfaridzia",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ALLTERRAIN",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f6f4ee] dark:bg-[#09090b] text-[#09090b] dark:text-[#f4f4f5] transition-colors duration-200">
        <ThemeProvider>
          <LanguageProvider>
            <QueryProvider>
              {children}
              <PwaInstallPrompt />
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
