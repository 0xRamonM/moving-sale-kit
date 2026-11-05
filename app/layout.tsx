import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SiteAnalytics } from "./site-analytics";
import { CITY, AREA, SITE_TITLE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SITE_TITLE.pt} · ${SITE_TITLE.en}`,
  description: `Coisas à venda, recolha em ${AREA.pt}, ${CITY.pt}. · Things for sale, pick up in ${AREA.en}, ${CITY.en}.`,
  // Point agents at the plain-text and JSON versions of the page.
  alternates: {
    types: { "text/markdown": "/llms.txt", "application/json": "/items.json" },
  },
};

// Android: let the on-screen keyboard shrink the page so the chat input stays visible.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
