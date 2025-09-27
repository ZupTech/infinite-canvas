import React from "react";
import Link from "next/link";
import Image from "next/image";

const UNITE_LOGO_URL =
  "https://storage.googleapis.com/unite_assets/logos/Unite%20Logo%20Negativo.png";

export const UniteBadge: React.FC = () => {
  return (
    <div className="absolute top-4 left-4 z-20 hidden md:block">
      <Link
        href="https://myunite.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="border bg-card p-2 rounded-xl flex items-center justify-center"
      >
        <Image
          src={UNITE_LOGO_URL}
          alt="Unite"
          width={132}
          height={40}
          className="h-10 w-auto"
        />
      </Link>
    </div>
  );
};
