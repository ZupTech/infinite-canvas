import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";

export const PoweredByUniteBadge: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Evita erro de hidratação esperando o cliente montar
  useEffect(() => {
    setMounted(true);
  }, []);

  // Logo positivo (dark) para modo claro, logo negativo (light) para modo escuro
  const logoUrl =
    mounted && resolvedTheme === "dark"
      ? "https://storage.googleapis.com/unite_assets/logos/Unite%20Logo%20Negativo.png"
      : "https://cdn.prod.website-files.com/686549176db3fc9e575ae4b7/68654b105d4af13cbebc5bf4_Logo%20Positivo%20Unite.png";

  return (
    <div className="absolute top-4 left-4 z-20 hidden md:block">
      <Link
        href="https://myunite.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 flex flex-row items-center"
      >
        <img src={logoUrl} alt="Unite logo" className="h-9 w-auto" />
      </Link>
    </div>
  );
};
