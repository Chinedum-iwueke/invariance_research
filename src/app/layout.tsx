import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://invarianceresearch.com"),
  title: {
    default: "Invariance Research",
    template: "%s | Invariance Research",
  },
  description: "Independent quantitative validation studio for execution-aware strategy evaluation.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/icon.svg", color: "#B00020" }],
  },
  openGraph: {
    title: "Invariance Research",
    description: "Execution-aware strategy validation and robustness diagnostics.",
    type: "website",
    url: "https://invarianceresearch.com",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className={montserrat.variable}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
