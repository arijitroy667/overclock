import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Lexend } from "next/font/google";

import { PrefsSync } from "./prefs-sync";
import "./globals.css";

// Lexend: designed to reduce visual stress and improve reading fluency (§17 dyslexia-friendly option).
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" });

export const metadata: Metadata = {
  title: "Overclock",
  description: "Run your ADHD brain at its actual clock speed.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider signInUrl="/sign-in">
      <html lang="en" className={lexend.variable}>
        <body className="antialiased">
          <PrefsSync />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
