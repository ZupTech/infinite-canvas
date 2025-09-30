import React from "react";
import Link from "next/link";
import Image from "next/image";

export const PoweredByUniteBadge: React.FC = () => {
  return (
    <div className="absolute top-4 left-4 z-20 hidden md:block">
      <Link
        href="https://myunite.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 flex flex-row items-center"
      >
        <Image
          src="https://storage.googleapis.com/unite_assets/logos/Unite%20Logo%20Negativo.png"
          alt="Unite logo"
          width={120}
          height={36}
          priority
        />
      </Link>
    </div>
  );
};
