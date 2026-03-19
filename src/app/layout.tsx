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
