import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/lib/i18n-context";
import { ConnectionStatus } from "@/components/shared/connection-status";
import { SkipToContent } from "@/components/shared/skip-to-content";
import { LearningProfileGate } from "@/components/learning-profile/profile-gate";
import { QuickAssistant } from "@/components/chat/quick-assistant";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export const metadata: Metadata = {
  title: "OpenTutor — 个性化学习助手",
  description: "导入学习资料，通过 AI 引导教学、练习与复习建立自己的学习空间。",
  applicationName: "OpenTutor Zenus",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OpenTutor Zenus",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" suppressHydrationWarning className={spaceGrotesk.variable}>
      <body className="antialiased">
        <SkipToContent />
        <ConnectionStatus />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LocaleProvider>
            <TooltipProvider>
              <main id="main-content">
                <LearningProfileGate>{children}<QuickAssistant /></LearningProfileGate>
              </main>
            </TooltipProvider>
            <Toaster />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
