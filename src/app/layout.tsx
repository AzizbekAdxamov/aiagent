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
        {/*
          Tema initializatsiyasi — sahifa chizilishidan OLDIN ishlaydi (flash yo'q).
          Saqlangan tanlov yoki tizim afzalligi bo'yicha dark class qo'shadi.
          (App Router'da <head> ni qo'lda yozish o'rniga body boshida ishlatiladi.)
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mentalaba-theme');if(t==='dark'||(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
