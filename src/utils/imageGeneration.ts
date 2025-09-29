import { GenerationAsset } from "@/hooks/useImageGeneration";

export interface CanvasImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isGenerated?: boolean;
}

export interface ViewportInfo {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export const createCanvasImagesFromAssets = (
  assets: GenerationAsset[],
  placeholderIds: string[],
  viewport: ViewportInfo,
  canvasSize: CanvasSize,
): { updatedPlaceholders: CanvasImage[]; newImages: CanvasImage[] } => {
  console.log("createCanvasImagesFromAssets called with:", {
    assetsCount: assets.length,
    placeholderIdsCount: placeholderIds.length,
    assets: assets.map((a) => a.url),
    placeholderIds,
  });

  if (assets.length === 0) {
    return { updatedPlaceholders: [], newImages: [] };
  }

  const baseSize = 512;
  const viewportCenterX = (canvasSize.width / 2 - viewport.x) / viewport.scale;
  const viewportCenterY = (canvasSize.height / 2 - viewport.y) / viewport.scale;

  const updatedPlaceholders: CanvasImage[] = [];
  const newImages: CanvasImage[] = [];

  assets.forEach((asset, index) => {
    const offset = index * 20; // Offset each image slightly
    const x = viewportCenterX - baseSize / 2 + offset;
    const y = viewportCenterY - baseSize / 2 + offset;

    const width =
      asset.width && asset.width > 0 ? Math.min(asset.width, 1024) : baseSize;
    const height =
      asset.height && asset.height > 0
        ? Math.min(asset.height, 1024)
        : baseSize;

    const imageData: CanvasImage = {
      src: asset.url,
      x,
      y,
      width,
      height,
      rotation: 0,
      isGenerated: true,
      id: "", // Will be set below
    };

    // If we have a corresponding placeholder, update it
    if (index < placeholderIds.length) {
      console.log(
        `Asset ${index} -> Updating placeholder ${placeholderIds[index]}`,
      );
      updatedPlaceholders.push({
        ...imageData,
        id: placeholderIds[index],
      });
    } else {
      console.log(
        `Asset ${index} -> Creating new image (no placeholder available)`,
      );
      // Create new image for extra assets
      newImages.push({
        ...imageData,
        id: `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`,
      });
    }
  });

  console.log("Final result:", {
    updatedPlaceholders: updatedPlaceholders.map((p) => ({
      id: p.id,
      src: p.src,
    })),
    newImages: newImages.map((i) => ({ id: i.id, src: i.src })),
  });

  return { updatedPlaceholders, newImages };
};
