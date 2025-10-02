import { Metadata } from "next";
import { type BrandId, BRAND_CONFIGS } from "@/config/brand-config";
import { detectBrandFromHostname } from "./brand-utils";

/**
 * Gera metadata dinâmica baseada na marca
 */
export function generateBrandMetadata(brandId?: BrandId): Metadata {
  // Se não for fornecido brandId, tentar detectar do headers
  let brand = brandId;

  if (!brand && typeof window !== "undefined") {
    brand = detectBrandFromHostname(window.location.hostname);
  }

  // Fallback para configuração padrão
  const config = brand ? BRAND_CONFIGS[brand] : BRAND_CONFIGS.unite;

  return {
    title: {
      default: config.seo.title,
      template: `%s | ${config.branding.companyName}`,
    },
    description: config.seo.description,
    keywords: config.seo.keywords,
    authors: [{ name: config.branding.companyName }],
    creator: config.branding.companyName,
    publisher: config.branding.companyName,
    viewport: {
      width: "device-width",
      initialScale: 1,
      maximumScale: 1,
      viewportFit: "cover",
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: config.seo.canonicalUrl
      ? new URL(config.seo.canonicalUrl)
      : undefined,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: config.seo.locale || "en_US",
      url: "/",
      title: config.seo.title,
      description: config.seo.description,
      siteName: config.branding.companyName,
      images: [
        {
          url: config.seo.ogImage,
          width: 1200,
          height: 630,
          alt: config.seo.ogImageAlt,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: config.seo.twitterCard,
      title: config.seo.title,
      description: config.seo.description,
      images: [
        {
          url: config.seo.ogImage,
          width: 1200,
          height: 630,
          alt: config.seo.ogImageAlt,
          type: "image/png",
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: config.favicon,
      shortcut: config.favicon,
      apple: config.favicon,
    },
  };
}

/**
 * Gera metadata a partir dos headers da requisição
 */
export function generateBrandMetadataFromHeaders(headers: Headers): Metadata {
  const host = headers.get("host");

  if (!host) {
    return generateBrandMetadata();
  }

  const brandId = detectBrandFromHostname(host);
  return generateBrandMetadata(brandId);
}
