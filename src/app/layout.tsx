import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import GlobalNavigation from "@/components/GlobalNavigation";
import MSWInit from "@/components/MSWInit";
import "./globals.css";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AdLex",
  description: "AI-powered text checking platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='ja'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className='min-h-screen bg-background'>
          <AuthProvider>
            <Suspense
              fallback={
                <div className='flex items-center justify-center min-h-screen'>
                  <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-primary'></div>
                </div>
              }
            >
              <GlobalNavigation />
              <main>{children}</main>
            </Suspense>
          </AuthProvider>
        </div>
        <MSWInit />
      </body>
    </html>
  );
}
