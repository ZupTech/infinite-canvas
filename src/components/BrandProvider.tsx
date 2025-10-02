"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type BrandId,
  type BrandConfig,
  DEFAULT_BRAND,
} from "@/config/brand-config";
import { detectBrandClient, getBrandConfig } from "@/lib/brand-utils";

interface BrandContextValue {
  brandId: BrandId;
  config: BrandConfig;
  isLoading: boolean;
}

const BrandContext = createContext<BrandContextValue>({
  brandId: DEFAULT_BRAND,
  config: getBrandConfig(DEFAULT_BRAND),
  isLoading: true,
});

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brandId, setBrandId] = useState<BrandId>(DEFAULT_BRAND);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Detectar marca apenas no cliente
    const detected = detectBrandClient();
    setBrandId(detected);
    setIsLoading(false);
  }, []);

  const config = getBrandConfig(brandId);

  return (
    <BrandContext.Provider value={{ brandId, config, isLoading }}>
      {children}
    </BrandContext.Provider>
  );
}

/**
 * Hook para acessar informações da marca
 */
export function useBrand() {
  const context = useContext(BrandContext);

  if (!context) {
    throw new Error("useBrand must be used within a BrandProvider");
  }

  return context;
}
