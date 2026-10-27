import type { Metadata } from "next";
import "./globals.css";
import AuthRedirect from "@/components/AuthRedirect";
export const metadata: Metadata = {
  metadataBase: new URL("https://cade-a-obra.vercel.app"),
  title: "Cadê a Obra? | Obras públicas do Piauí",
  description:
    "Encontre obras públicas no Piauí. Consulte investimentos previstos, situação oficial e agentes com fontes verificáveis.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Cadê a Obra?",
    title: "Cadê a Obra? | Explore as obras públicas do Piauí",
    description:
      "Encontre sua cidade, consulte obras e investimentos previstos e confira as fontes oficiais.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cadê a Obra?",
    description:
      "Obras públicas do Piauí com dados oficiais e fontes verificáveis.",
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthRedirect />
        {children}
      </body>
    </html>
  );
}
