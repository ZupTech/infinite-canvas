import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useBrand } from "@/components/BrandProvider";
import { BrandSelector } from "./BrandSelector";

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  mobile?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = "",
  imgClassName = "h-8 w-auto",
  mobile = false,
}) => {
  const { resolvedTheme } = useTheme();
  const { config, isLoading: isBrandLoading } = useBrand();
  const [mounted, setMounted] = useState(false);

  // Evita erro de hidratação esperando o cliente montar
  useEffect(() => {
    setMounted(true);
  }, []);

  // Logo apropriado baseado no tema (light ou dark)
  const logoUrl =
    mounted && !isBrandLoading
      ? resolvedTheme === "dark"
        ? config.icon.dark
        : config.icon.light
      : config.icon.dark; // Fallback para dark

  const brandUrl = `https://www.${config.baseDomain}`;

  return (
    <div className={className}>
      <Link
        href={brandUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block transition-opacity"
      >
        <img src={logoUrl} alt={config.icon.alt} className={imgClassName} />
      </Link>
      {mobile && <BrandSelector />}
    </div>
  );
};
