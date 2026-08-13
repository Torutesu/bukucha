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
        {/* デプロイ切替直後の古いHTML×新チャンクの不一致(全ボタン無反応になる)を検知したら一度だけ自動リロード */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var K='bukucha_chunk_reload';window.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='SCRIPT'&&t.src&&t.src.indexOf('/_next/')>-1){try{if(!sessionStorage.getItem(K)){sessionStorage.setItem(K,'1');location.reload();}}catch(x){}}},true);window.addEventListener('load',function(){setTimeout(function(){try{sessionStorage.removeItem(K);}catch(x){}},5000);});})();`,
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
