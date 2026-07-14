import type { Metadata } from "next";
import { STORAGE_KEYS, STORAGE_MIGRATIONS } from "@/lib/appConfig";
import { AuthProvider } from "@/components/AuthProvider";
import { SubscriptionSync } from "@/components/SubscriptionSync";
import { ProfileSync } from "@/components/ProfileSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "Capil AI — your AI hair coach",
  description:
    "AI-powered hair diagnosis: film your hair, get a complete profile and a personalized routine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var migrations=${JSON.stringify(STORAGE_MIGRATIONS)};for(var i=0;i<migrations.length;i++){var m=migrations[i];if(localStorage.getItem(m.from)&&!localStorage.getItem(m.to)){localStorage.setItem(m.to,localStorage.getItem(m.from));}}var raw=localStorage.getItem('${STORAGE_KEYS.theme}');var theme=raw?JSON.parse(raw).state.theme:'dark';document.documentElement.setAttribute('data-theme', theme==='light'?'light':'dark');var lraw=localStorage.getItem('${STORAGE_KEYS.locale}');var parsed=lraw?JSON.parse(lraw).state:null;var locale=parsed&&parsed.locale==='fr'?'fr':'en';document.documentElement.lang=locale;}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.lang='en';}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-ink text-cream antialiased">
        <AuthProvider>
          <SubscriptionSync />
          <ProfileSync />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
