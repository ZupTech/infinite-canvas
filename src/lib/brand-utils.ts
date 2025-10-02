/**
 * 🎨 Brand Utils
 *
 * Utilitários para detecção e manipulação de marca
 */

import {
  type BrandId,
  type BrandConfig,
  BRAND_CONFIGS,
  DEFAULT_BRAND,
  DOMAIN_TO_BRAND_MAP,
  isOverrideAllowedForHostname,
} from "@/config/brand-config";

/**
 * 🔍 Detecta a marca baseada no hostname
 */
export function detectBrandFromHostname(hostname: string): BrandId {
  // Normalizar hostname
  const normalizedHostname = hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0] // Pegar apenas o domínio
    .split(":")[0]; // Remover porta

  // Buscar no mapa de domínios
  const brand = DOMAIN_TO_BRAND_MAP.get(normalizedHostname);

  if (brand) {
    return brand;
  }

  // Fallback: buscar por substring (para subdomínios não mapeados)
  for (const [domain, brandId] of DOMAIN_TO_BRAND_MAP.entries()) {
    if (
      normalizedHostname.includes(domain) ||
      domain.includes(normalizedHostname)
    ) {
      return brandId;
    }
  }

  return DEFAULT_BRAND;
}

/**
 * 🌐 Detecta a marca do lado do cliente (browser)
 */
export function detectBrandClient(): BrandId {
  if (typeof window === "undefined") {
    return DEFAULT_BRAND;
  }

  const hostname = window.location.hostname;

  // Verifica se há override via query param (apenas em ambientes permitidos)
  if (isOverrideAllowedForHostname(hostname)) {
    const params = new URLSearchParams(window.location.search);
    const brandOverride = params.get("brand") as BrandId | null;

    if (brandOverride && BRAND_CONFIGS[brandOverride]) {
      // Salvar no localStorage para persistir
      try {
        localStorage.setItem("brand-override", brandOverride);
      } catch (e) {
        console.warn("Failed to save brand override to localStorage", e);
      }
      return brandOverride;
    }

    // Verificar se há override salvo no localStorage
    try {
      const savedOverride = localStorage.getItem(
        "brand-override",
      ) as BrandId | null;
      if (savedOverride && BRAND_CONFIGS[savedOverride]) {
        return savedOverride;
      }
    } catch (e) {
      console.warn("Failed to read brand override from localStorage", e);
    }
  }

  return detectBrandFromHostname(hostname);
}

/**
 * 🌐 Detecta a marca do lado do servidor
 */
export function detectBrandServer(headers: Headers): BrandId {
  const host = headers.get("host");

  if (!host) {
    return DEFAULT_BRAND;
  }

  return detectBrandFromHostname(host);
}

/**
 * 📦 Retorna a configuração da marca
 */
export function getBrandConfig(brandId?: BrandId): BrandConfig {
  const id = brandId || DEFAULT_BRAND;
  return BRAND_CONFIGS[id];
}

/**
 * 🎨 Retorna o logo apropriado baseado no tema
 */
export function getBrandLogo(
  brandId: BrandId,
  theme: "light" | "dark" = "dark",
): string {
  const config = getBrandConfig(brandId);
  return theme === "light" ? config.logo.light : config.logo.dark;
}

/**
 * 🎨 Retorna o ícone apropriado baseado no tema
 */
export function getBrandIcon(
  brandId: BrandId,
  theme: "light" | "dark" = "dark",
): string {
  const config = getBrandConfig(brandId);
  return theme === "light" ? config.icon.light : config.icon.dark;
}

/**
 * 🔗 Retorna a URL base da marca
 */
export function getBrandBaseUrl(brandId: BrandId): string {
  const config = getBrandConfig(brandId);
  return `https://www.${config.baseDomain}`;
}

/**
 * 🎨 Hook customizado para usar brand no cliente
 * Nota: Isso deve ser usado apenas em componentes client-side
 */
export function useBrand() {
  if (typeof window === "undefined") {
    return {
      brandId: DEFAULT_BRAND,
      config: getBrandConfig(DEFAULT_BRAND),
      logo: (theme: "light" | "dark" = "dark") =>
        getBrandLogo(DEFAULT_BRAND, theme),
      icon: (theme: "light" | "dark" = "dark") =>
        getBrandIcon(DEFAULT_BRAND, theme),
    };
  }

  const brandId = detectBrandClient();
  const config = getBrandConfig(brandId);

  return {
    brandId,
    config,
    logo: (theme: "light" | "dark" = "dark") => getBrandLogo(brandId, theme),
    icon: (theme: "light" | "dark" = "dark") => getBrandIcon(brandId, theme),
  };
}
