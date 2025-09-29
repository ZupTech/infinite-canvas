import { GenerationAsset } from "@/hooks/useImageGeneration";
import { PlacedVideo } from "@/types/canvas";

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

// Helper to detect if URL is a video
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi"];
  const urlLower = url.toLowerCase();
  return videoExtensions.some((ext) => urlLower.includes(ext));
};

export const createCanvasImagesFromAssets = (
  assets: GenerationAsset[],
  placeholderIds: string[],
  viewport: ViewportInfo,
  canvasSize: CanvasSize,
): {
  updatedPlaceholders: CanvasImage[];
  newImages: CanvasImage[];
  newVideos: PlacedVideo[];
} => {
  console.log("createCanvasImagesFromAssets called with:", {
    assetsCount: assets.length,
    placeholderIdsCount: placeholderIds.length,
    assets: assets.map((a) => a.url),
    placeholderIds,
  });

  if (assets.length === 0) {
    return { updatedPlaceholders: [], newImages: [], newVideos: [] };
  }

  const baseSize = 512;
  const viewportCenterX = (canvasSize.width / 2 - viewport.x) / viewport.scale;
  const viewportCenterY = (canvasSize.height / 2 - viewport.y) / viewport.scale;

  const updatedPlaceholders: CanvasImage[] = [];
  const newImages: CanvasImage[] = [];
  const newVideos: PlacedVideo[] = [];

  // Calculate total width needed for all assets with spacing
  const spacing = 20; // Space between items
  const numAssets = assets.length;
  const totalWidth = numAssets * baseSize + (numAssets - 1) * spacing;
  const startX = viewportCenterX - totalWidth / 2;

  assets.forEach((asset, index) => {
    // Check if this asset is a video
    const isVideo = isVideoUrl(asset.url);
    console.log(`Asset ${index} (${asset.url}): isVideo=${isVideo}`);

    // Position items horizontally side by side
    const x = startX + index * (baseSize + spacing);
    const y = viewportCenterY - baseSize / 2;

    const width =
      asset.width && asset.width > 0 ? Math.min(asset.width, 1024) : baseSize;
    const height =
      asset.height && asset.height > 0
        ? Math.min(asset.height, 1024)
        : baseSize;

    if (isVideo) {
      // Create video object
      const videoData: PlacedVideo = {
        id: `generated-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`,
        src: asset.url,
        x,
        y,
        width,
        height,
        rotation: 0,
        isVideo: true as const,
        duration: 5, // Default duration, will be updated when video loads
        currentTime: 0,
        isPlaying: false,
        volume: 1,
        muted: false,
        isLoaded: false,
      };

      console.log(`Asset ${index} -> Creating new video`);
      newVideos.push(videoData);
    } else {
      // Create image object
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
    }
  });

  console.log("Final result:", {
    updatedPlaceholders: updatedPlaceholders.map((p) => ({
      id: p.id,
      src: p.src,
    })),
    newImages: newImages.map((i) => ({ id: i.id, src: i.src })),
    newVideos: newVideos.map((v) => ({ id: v.id, src: v.src })),
  });

  return { updatedPlaceholders, newImages, newVideos };
};
