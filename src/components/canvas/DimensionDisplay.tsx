"use client";

import React from "react";
import type { PlacedImage } from "@/types/canvas";
import {
  canvasToScreen,
  calculateBoundingBox,
  type Viewport,
} from "@/utils/canvas-utils";

interface DimensionDisplayProps {
  selectedImages: PlacedImage[];
  viewport: Viewport;
}

export const DimensionDisplay: React.FC<DimensionDisplayProps> = ({
  selectedImages,
  viewport,
}) => {
  const image = selectedImages.length === 1 ? selectedImages[0]! : null;

  const [apiDimensions, setApiDimensions] = React.useState<{
    width: number;
    height: number;
    isCropped: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (!image) {
      setApiDimensions(null);
      return;
    }

    let isMounted = true;

    // Load natural (generation) dimensions so users see the true output resolution.
    const getApiDimensions = async (img: PlacedImage) => {
      try {
        const imgElement = new window.Image();
        imgElement.crossOrigin = "anonymous";
        imgElement.src = img.src;

        await new Promise((resolve) => {
          imgElement.onload = resolve;
        });

        const cropWidth = img.cropWidth || 1;
        const cropHeight = img.cropHeight || 1;

        const effectiveWidth = cropWidth * imgElement.naturalWidth;
        const effectiveHeight = cropHeight * imgElement.naturalHeight;

        return {
          width: Math.round(effectiveWidth),
          height: Math.round(effectiveHeight),
          isCropped: cropWidth !== 1 || cropHeight !== 1,
        };
      } catch (error) {
        return {
          width: Math.round(img.width),
          height: Math.round(img.height),
          isCropped: false,
        };
      }
    };

    getApiDimensions(image).then((dimensions) => {
      if (isMounted) {
        setApiDimensions(dimensions);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    image?.src,
    image?.cropWidth,
    image?.cropHeight,
    image?.width,
    image?.height,
  ]);

  if (!image || !apiDimensions) return null;

  // Get rotation-aware bottom center position using bounding box
  const boundingBox = calculateBoundingBox(image);
  const { x: screenX, y: screenY } = canvasToScreen(
    boundingBox.x + boundingBox.width / 2,
    boundingBox.y + boundingBox.height,
    viewport,
  );

  return (
    <div
      className="fixed pointer-events-none z-10 bg-background/90 backdrop-blur-sm border rounded-xl px-2 py-1 text-xs text-foreground/80 shadow-sm hidden md:block"
      style={{
        left: screenX,
        top: screenY + 8, // 8px below the image
        transform: "translateX(-50%)", // Center horizontally under the image
      }}
    >
      <div className="flex flex-col gap-0.5">
        <div className="font-medium">
          {apiDimensions.width} × {apiDimensions.height} px
        </div>
      </div>
    </div>
  );
};
