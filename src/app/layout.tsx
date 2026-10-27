import type { Metadata } from "next";
import "./globals.css";
import AuthRedirect from "@/components/AuthRedirect";
export const metadata: Metadata = {
  title: "Cadê a Obra? | Obras públicas do Piauí",
  description:
    "Encontre obras públicas no Piauí. Consulte investimentos previstos, situação oficial e agentes com fontes verificáveis.",
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
