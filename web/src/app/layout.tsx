import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intercom Dashboard",
  description: "Live view of agents and messages for your workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
