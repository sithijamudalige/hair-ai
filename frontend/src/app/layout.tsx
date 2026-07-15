import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Aura | AI Face & Skin Analysis",
  description: "Advanced AI analysis for face type, skin color, and hair type.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="navbar-container">
            <Link href="/" className="logo">
              <Sparkles className="text-gradient" size={24} />
              Aura <span style={{fontWeight: 300, color: 'var(--text-secondary)'}}>AI</span>
            </Link>
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
