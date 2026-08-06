import type { Metadata, Viewport } from "next";
import "./globals.css";
import { buildThemeCss, brand } from "@/lib/theme";

export const metadata: Metadata = {
  title: `${brand.name} - ${brand.tagline}`,
  description:
    "妄想がそのまま物語になる、女性向けノベルAIチャット。シチュエーションを選んで、あなただけのラノベを読もう。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss() }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('bukucha_theme');if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="app-shell" data-testid="app-shell">
          {children}
        </div>
      </body>
    </html>
  );
}
