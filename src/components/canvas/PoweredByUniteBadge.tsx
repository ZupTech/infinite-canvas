import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";

export const PoweredByUniteBadge: React.FC = () => {
  const { resolvedTheme } = useTheme();

  // Logo positivo (dark) para modo claro, logo negativo (light) para modo escuro
  const logoUrl =
    resolvedTheme === "dark"
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
        <Image
          src={logoUrl}
          alt="Unite logo"
          width={120}
          height={36}
          priority
        />
      </Link>
    </div>
  );
};
