import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import UnverifiedBanner from "@/components/UnverifiedBanner";
import GlobalVoiceCommander from "@/components/GlobalVoiceCommander";
import PwaRegister from "@/components/PwaRegister";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import MobileBottomNav from "@/components/MobileBottomNav";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "TechForm Buddy — Smart Multilingual Form Assistant",
  description: "Multilingual AI-powered form filling assistant. Fill forms using voice commands in your native language, auto-fill from verified documents, and track forms online.",
  keywords: "form assistant, multilingual, AI, voice input, auto-fill, document upload, pwa",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TechForm Buddy",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  applicationName: "TechForm Buddy",
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p="system";try{var s=localStorage.getItem("tfb_theme");if(s==="light"||s==="dark"||s==="system")p=s}catch(e){console.warn("Unable to read saved theme preference.",e)}var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"})()`,
          }}
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>
          <UnverifiedBanner />
          {children}
          <GlobalVoiceCommander />
          <MobileBottomNav />
          <PwaInstallPrompt />
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
