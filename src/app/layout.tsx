import type { Metadata } from "next";
import "./globals.css";
import { CoreProviders } from "./core-providers";
import { focal, hal, halMono, commitMono, inconsolata } from "@/lib/fonts";
import { BotIdClient } from "botid/client";
import { Analytics } from "@vercel/analytics/next";
import { headers } from "next/headers";
import { generateBrandMetadataFromHeaders } from "@/lib/metadata";

/**
 * Gera metadata dinâmica baseada no domínio da requisição
 */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  return generateBrandMetadataFromHeaders(headersList);
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[
        hal.variable,
        halMono.variable,
        focal.variable,
        inconsolata.variable,
        commitMono.variable,
      ].join(" ")}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark" />
        <BotIdClient
          protect={[
            {
              path: "/api/trpc/*",
              method: "POST",
            },
            {
              path: "/api/fal",
              method: "POST",
            },
          ]}
        />
      </head>
      <body className={`font-sans bg-background text-foreground min-h-screen`}>
        <CoreProviders>{children}</CoreProviders>
      </body>
      <Analytics />
    </html>
  );
}
