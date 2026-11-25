import type { Metadata } from "next";
import {
  Instrument_Serif,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { DisableBrokenHmrScript } from "@/components/merchant/DisableBrokenHmrScript";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const DEFAULT_CLIENT_ID = "a48902c859417cfa3b5aba419b49eb15";

const apiKey =
  process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
  process.env.SHOPIFY_API_KEY ||
  DEFAULT_CLIENT_ID;

export const metadata: Metadata = {
  title: "Products & Inventory",
  description: "Products and inventory manager",
  other: {
    "shopify-api-key": apiKey,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="shopify-api-key" content={apiKey} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={apiKey}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <DisableBrokenHmrScript />
        {children}
      </body>
    </html>
  );
}
