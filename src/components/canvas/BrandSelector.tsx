"use client";

import React, { useState, useEffect } from "react";
import { useBrand } from "@/components/BrandProvider";
import {
  type BrandId,
  BRAND_CONFIGS,
  isOverrideAllowedForHostname,
} from "@/config/brand-config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Seletor compacto de marca para desenvolvimento
 * Aparece ao lado do logo apenas em localhost
 */
export function BrandSelector() {
  const { brandId } = useBrand();
  const [isAllowed, setIsAllowed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Verificar se o ambiente permite override
    if (typeof window !== "undefined") {
      setIsAllowed(isOverrideAllowedForHostname(window.location.hostname));
    }
  }, []);

  const handleBrandChange = (newBrandId: string) => {
    if (!isAllowed) return;

    try {
      localStorage.setItem("brand-override", newBrandId);
      window.location.reload();
    } catch (e) {
      console.error("Failed to switch brand", e);
    }
  };

  // Não renderizar até montar ou se não for permitido
  if (!mounted || !isAllowed) {
    return null;
  }

  return (
    <Select value={brandId} onValueChange={handleBrandChange}>
      <SelectTrigger className="w-[130px] h-8 text-xs border-dashed border-muted-foreground/50 bg-background/50 backdrop-blur-sm">
        <SelectValue placeholder="Brand" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(BRAND_CONFIGS).map(([id, config]) => (
          <SelectItem key={id} value={id} className="text-xs">
            {config.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
