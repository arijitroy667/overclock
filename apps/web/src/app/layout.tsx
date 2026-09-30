import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Lexend, Space_Grotesk } from "next/font/google";

import { Backdrop } from "./backdrop";
import { PrefsSync } from "./prefs-sync";
import "./globals.css";

// Space Grotesk: a grotesque with enough character for the headlines and enough
// neutrality for body text. Lexend stays for the easier-to-read option (§17).
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" });

export const metadata: Metadata = {
  title: "Overclock — run your ADHD brain at its actual clock speed",
  description:
    "Capture anything in a second, get it rewritten into something you can actually start, and let the app hold the clock you can't feel.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider signInUrl="/sign-in">
      <html lang="en" className={`${grotesk.variable} ${lexend.variable}`}>
        <body className="antialiased">
          <Backdrop />
          <PrefsSync />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
