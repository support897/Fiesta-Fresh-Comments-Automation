import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Fiesta Fresh Cleaning | CEO Automation Dashboard",
  description: "24/7 Facebook Comments Automation & Lead Intelligence Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex bg-slate-50 font-sans text-slate-900 overflow-hidden">
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </body>
    </html>
  );
}
