import { GenerationAsset } from "@/hooks/useImageGeneration";

export interface CanvasImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isGenerated: boolean;
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
  placeholderId: string,
  viewport: ViewportInfo,
  canvasSize: CanvasSize,
): { updatedPlaceholder: CanvasImage | null; newImages: CanvasImage[] } => {
  if (assets.length === 0) {
    return { updatedPlaceholder: null, newImages: [] };
  }

  const baseSize = 512;
  const viewportCenterX = (canvasSize.width / 2 - viewport.x) / viewport.scale;
  const viewportCenterY = (canvasSize.height / 2 - viewport.y) / viewport.scale;

  const [firstAsset, ...remainingAssets] = assets;

  // Create updated placeholder
  const updatedPlaceholder: CanvasImage = {
    id: placeholderId,
    src: firstAsset.url,
    x: viewportCenterX - baseSize / 2,
    y: viewportCenterY - baseSize / 2,
    width:
      firstAsset.width && firstAsset.width > 0
        ? Math.min(firstAsset.width, 1024)
        : baseSize,
    height:
      firstAsset.height && firstAsset.height > 0
        ? Math.min(firstAsset.height, 1024)
        : baseSize,
    rotation: 0,
    isGenerated: true,
  };

  // Create new images for remaining assets
  const newImages: CanvasImage[] = remainingAssets.map((asset, index) => {
    const offset = (index + 1) * 20; // Offset each image slightly

    return {
      id: `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index + 1}`,
      src: asset.url,
      x: viewportCenterX - baseSize / 2 + offset,
      y: viewportCenterY - baseSize / 2 + offset,
      width:
        asset.width && asset.width > 0 ? Math.min(asset.width, 1024) : baseSize,
      height:
        asset.height && asset.height > 0
          ? Math.min(asset.height, 1024)
          : baseSize,
      rotation: 0,
      isGenerated: true,
    };
  });

  return { updatedPlaceholder, newImages };
};
