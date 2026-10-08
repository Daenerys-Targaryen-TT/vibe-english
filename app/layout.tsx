import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeEnglish · 英语备考",
  description:
    "英语备考个人学习网站：六级 + 上外英语语言文学考研（单词打字、外刊精读、写作、翻译）",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
