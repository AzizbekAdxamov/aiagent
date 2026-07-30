import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mentalaba AI Agent — O'zbekiston ta'lim platformasi",
  description:
    "Universitetlar, yo'nalishlar, grantlar va ta'lim yangiliklari haqida aqlli AI yordamchi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
