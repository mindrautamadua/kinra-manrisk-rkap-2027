import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { ModeProvider } from "@/lib/mode";
import { KonfirmasiHost } from "@/components/Konfirmasi";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Manajemen Risiko RKAP 2027 · PT KINRA",
  description: "Kertas kerja perencanaan manajemen risiko RKAP 2027 PT KINRA",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} ${plexMono.variable} font-sans antialiased`}>
        <ModeProvider><Shell>{children}</Shell></ModeProvider>
        <KonfirmasiHost />
      </body>
    </html>
  );
}
