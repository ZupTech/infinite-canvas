/**
 * 🎯 Sistema de Branding Dinâmico
 *
 * Configuração central para diferentes marcas baseadas no domínio.
 * Permite customizar UI, comportamentos e funcionalidades por marca.
 */

export type BrandId = "cflab" | "unite";

export interface BrandConfig {
  id: BrandId;
  name: string;
  domains: string[];
  baseDomain: string;
  dominio_alternativo?: string;
  logo: {
    light: string; // Logo para modo claro
    dark: string; // Logo para modo escuro
    alt: string;
    width?: number;
    height?: number;
  };
  icon: {
    light: string; // Ícone para modo claro
    dark: string; // Ícone para modo escuro
    mobileSrc?: string;
    alt: string;
    width?: number;
    height?: number;
  };
  favicon: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  features: {
    showPlans: boolean;
    showLegacyVersions: boolean;
    enableAdvancedFeatures: boolean;
    customSidebar: boolean;
    showPrivacyModal: boolean;
  };
  navigation: {
    homeUrl: string;
    pricingUrl: string;
    pricingCreditsUrl?: string;
    supportUrl: string;
    workflowsUrl: string;
    settingsUrl: string;
    privacyUrl: string;
    cookiesUrl: string;
  };
  branding: {
    companyName: string;
    tagline: string;
    description: string;
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage: string;
    ogImageAlt: string;
    twitterCard: "summary" | "summary_large_image";
    themeColor: string;
    locale?: string;
    canonicalUrl?: string;
  };
}

/**
 * 🔧 Configurações por marca
 */
export const BRAND_CONFIGS: Record<BrandId, BrandConfig> = {
  cflab: {
    id: "cflab",
    name: "cflab.ai",
    domains: ["cflab.ai", "www.cflab.ai", "app.cflab.ai", "canvas.cflab.ai"],
    baseDomain: "cflab.ai",
    dominio_alternativo: "https://www.cflab.ai",
    logo: {
      light: "https://train.cflab.ai/cflab_simbolo.svg", // TODO: Adicionar logo modo claro
      dark: "https://train.cflab.ai/cflab_simbolo.svg",
      alt: "cflab.ai",
      width: 150,
      height: 100,
    },
    icon: {
      light:
        "https://storage.googleapis.com/unite_assets/cfLab/assets/logo-cflabAi.svg",
      dark: "https://storage.googleapis.com/unite_assets/cfLab/assets/logo-cflabAi.svg",
      mobileSrc:
        "https://storage.googleapis.com/unite_assets/cfLab/assets/logo-cflab.svg",
      alt: "cflab.ai",
      width: 100,
      height: 100,
    },
    favicon: "/cflab-favicon.svg",
    colors: {
      primary: "#5700dc",
      secondary: "#F1F1EC",
      accent: "#04070C",
    },
    features: {
      showPlans: true,
      showLegacyVersions: true,
      enableAdvancedFeatures: true,
      customSidebar: false,
      showPrivacyModal: true,
    },
    navigation: {
      homeUrl: "/",
      pricingUrl: "/pricing",
      pricingCreditsUrl: "/pricing?tab=credits",
      supportUrl: "#",
      workflowsUrl: "https://app.cflab.ai/workflows?mode=templates",
      settingsUrl: "/settings",
      privacyUrl: "https://www.iubenda.com/privacy-policy/28932914/legal",
      cookiesUrl:
        "https://www.iubenda.com/privacy-policy/28932914/cookie-policy",
    },
    branding: {
      companyName: "cflab.ai",
      tagline: "Uma nova experiência para criar com IA",
      description: "Create stunning, high-aesthetic images in seconds",
    },
    seo: {
      title: "CFLab.ai - Infinite Canvas",
      description:
        "Conecte-se às melhores IAs do mundo e crie com mais velocidade, menos esforço e muito mais impacto.",
      keywords: [
        "IA",
        "IA para designers",
        "IA para criadores de conteúdo",
        "cflab.ai",
        "criador de imagens com IA",
        "infinite canvas",
      ],
      ogImage:
        "https://storage.googleapis.com/unite_assets/extras/og-image-cflab.png",
      ogImageAlt: "cflab.ai",
      twitterCard: "summary_large_image",
      themeColor: "#5700dc",
      locale: "pt_BR",
      canonicalUrl: "https://www.cflab.ai",
    },
  },
  unite: {
    id: "unite",
    name: "Unite AI",
    domains: [
      "myunite.ai",
      "www.myunite.ai",
      "app.myunite.ai",
      "canvas.myunite.ai",
    ],
    baseDomain: "myunite.ai",
    dominio_alternativo: "https://www.myunite.ai",
    logo: {
      light:
        "https://cdn.prod.website-files.com/686549176db3fc9e575ae4b7/68654b105d4af13cbebc5bf4_Logo%20Positivo%20Unite.png",
      dark: "https://storage.googleapis.com/unite_assets/logos/Unite%20Logo%20Negativo.png",
      alt: "Unite AI",
      width: 100,
      height: 100,
    },
    icon: {
      light:
        "https://cdn.prod.website-files.com/686549176db3fc9e575ae4b7/68654b105d4af13cbebc5bf4_Logo%20Positivo%20Unite.png",
      dark: "https://storage.googleapis.com/unite_assets/logos/Unite%20Logo%20Negativo.png",
      alt: "Unite AI",
      width: 100,
      height: 100,
    },
    favicon: "/unite-favicon.ico",
    colors: {
      primary: "#0066cc",
      secondary: "#f8f9fa",
      accent: "#1a1a1a",
    },
    features: {
      showPlans: false,
      showLegacyVersions: true,
      enableAdvancedFeatures: false,
      customSidebar: true,
      showPrivacyModal: true,
    },
    navigation: {
      homeUrl: "/",
      pricingUrl: "https://app.myunite.ai/pricing",
      supportUrl: "https://app.myunite.ai/support",
      workflowsUrl: "https://app.myunite.ai/workflows",
      settingsUrl: "/settings",
      privacyUrl: "https://www.iubenda.com/privacy-policy/28932914/legal",
      cookiesUrl:
        "https://www.iubenda.com/privacy-policy/28932914/cookie-policy",
    },
    branding: {
      companyName: "UNITE AI",
      tagline: "Unite your creativity with AI",
      description: "Professional AI tools for modern teams",
    },
    seo: {
      title: "Unite AI - Infinite Canvas",
      description:
        "Transform your photos with AI-powered style transfer in seconds. Professional AI tools for modern teams.",
      keywords: [
        "Ferramentas de IA",
        "IA para equipe",
        "MyUnite",
        "IA para criadores de conteúdo",
        "infinite canvas",
        "AI canvas",
      ],
      ogImage: "/og-img-compress.png",
      ogImageAlt: "Unite AI",
      twitterCard: "summary_large_image",
      themeColor: "#0066cc",
      locale: "en_US",
      canonicalUrl: "https://www.myunite.ai",
    },
  },
};

/**
 * 🔍 Configuração padrão (fallback)
 */
export const DEFAULT_BRAND: BrandId = "unite";

/**
 * 🌐 Mapeamento de domínios para brands
 */
export const DOMAIN_TO_BRAND_MAP = new Map<string, BrandId>();

// Popular o mapa automaticamente
Object.entries(BRAND_CONFIGS).forEach(([brandId, config]) => {
  config.domains.forEach((domain) => {
    DOMAIN_TO_BRAND_MAP.set(domain, brandId as BrandId);
  });
});

/**
 * 📋 Lista de todos os domínios suportados
 */
export const ALL_SUPPORTED_DOMAINS = Array.from(DOMAIN_TO_BRAND_MAP.keys());

/**
 * 🔧 Domínios que permitem simulação de marca (override)
 * Usado para desenvolvimento e testing
 */
export const BRAND_OVERRIDE_ALLOWED_DOMAINS = [
  "localhost",
  "dev.cflab.ai",
  "dev.myunite.ai",
  "staging.cflab.ai",
  "staging.myunite.ai",
];

/**
 * 🔧 Helper para verificar se um hostname permite brand override
 */
export function isOverrideAllowedForHostname(hostname: string): boolean {
  const normalizedHostname = hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0] // Pegar apenas o domínio, não o path
    .split(":")[0]; // Remover porta se houver

  return BRAND_OVERRIDE_ALLOWED_DOMAINS.some(
    (allowedDomain) =>
      normalizedHostname.includes(allowedDomain) ||
      allowedDomain.includes(normalizedHostname),
  );
}
