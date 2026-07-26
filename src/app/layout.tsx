import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nBridge } from "./I18nBridge";
import { NavigationFeedback } from "./NavigationFeedback";

export const viewport: Viewport = {
  themeColor: "#0D0D10"
};

export const metadata: Metadata = {
  metadataBase: new URL("https://baox.ai"),
  title: {
    default: "保罗万相｜保险人的人工智能增长系统",
    template: "%s · 保罗万相"
  },
  description: "保罗万相面向保险从业者提供AI保险大师课、「展页」和AI工具包，帮助保险人用人工智能完成内容、获客、服务和成交。",
  applicationName: "保罗万相",
  authors: [{ name: "保罗万相" }],
  creator: "保罗万相",
  publisher: "保罗万相",
  category: "insurance technology",
  keywords: [
    "保罗万相",
    "BAOX.AI",
    "保险AI",
    "AI保险大师课",
    "展页",
    "保险工具包",
    "保险获客"
  ],
  alternates: {
    canonical: "/"
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/icon.svg",
    apple: "/apple-icon.png"
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://baox.ai",
    siteName: "保罗万相",
    title: "保罗万相｜保险人的人工智能增长系统",
    description: "保险大师课、「展页」、AI工具包与学员作品集，帮助保险人把AI能力变成真实展业成果。",
    images: [
      {
        url: "/insurance/landing/baox-home-masterclass-banner.webp",
        width: 1672,
        height: 941,
        alt: "保罗万相AI保险大师课"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "保罗万相｜保险人的人工智能增长系统",
    description: "保险大师课、「展页」、AI工具包与学员作品集，帮助保险人把AI能力变成真实展业成果。",
    images: ["/insurance/landing/baox-home-masterclass-banner.webp"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <I18nBridge />
        <NavigationFeedback />
        {children}
      </body>
    </html>
  );
}
