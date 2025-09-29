import { useCallback } from "react";

export interface GenerationAsset {
  url: string;
  width?: number;
  height?: number;
}

export interface GenerationResult {
  assets: GenerationAsset[];
  success: boolean;
  error?: string;
}

// Heuristics to determine if a URL points to a video file
const isVideoUrl = (url: string | undefined | null): boolean => {
  if (typeof url !== "string") return false;
  const u = url.toLowerCase();
  return (
    u.includes(".mp4") ||
    u.includes(".webm") ||
    u.includes(".mov") ||
    u.includes(".avi")
  );
};

export const extractJobAsset = (job: any): GenerationAsset | null => {
  const result =
    job?.result ||
    job?.output?.result ||
    job?.output?.data?.result ||
    job?.output?.output?.result;
  if (!result) {
    return null;
  }

  // Prefer explicit video fields if present
  const videoField = result.video || result.output_video || result.outputVideo;
  if (videoField?.r2OriginalUrl || videoField?.url) {
    return {
      url: (videoField.r2OriginalUrl || videoField.url) as string,
      width: videoField.metadata?.width ?? result.metadata?.width,
      height: videoField.metadata?.height ?? result.metadata?.height,
    };
  }

  // Some results return flat fields like video_url
  if (typeof result.video_url === "string") {
    return {
      url: result.video_url as string,
      width: result.metadata?.width,
      height: result.metadata?.height,
    };
  }

  if (result.r2OriginalUrl || result.r2_thumbnail_url) {
    return {
      url: (result.r2OriginalUrl || result.r2_thumbnail_url) as string,
      width: result.metadata?.width,
      height: result.metadata?.height,
    };
  }

  if (result.url) {
    return {
      url: result.url as string,
      width: result.metadata?.width,
      height: result.metadata?.height,
    };
  }

  if (Array.isArray(result.images) && result.images.length > 0) {
    const asset =
      result.images.find((img: any) => img.r2OriginalUrl || img.url) ||
      result.images[0];
    return {
      url: (asset.r2OriginalUrl ||
        asset.r2_thumbnail_url ||
        asset.url) as string,
      width: asset.metadata?.width ?? result.metadata?.width,
      height: asset.metadata?.height ?? result.metadata?.height,
    };
  }

  // As a last resort, try to find any URL-like string that looks like an asset
  try {
    const candidates: string[] = [];
    const stack = [result] as any[];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (typeof node === "string") {
        if (node.startsWith("http")) candidates.push(node);
      } else if (Array.isArray(node)) {
        stack.push(...node);
      } else if (typeof node === "object") {
        Object.values(node).forEach((v) => stack.push(v));
      }
    }
    const url =
      candidates.find((u) => isVideoUrl(u)) ?? candidates.find((u) => u);
    if (url) {
      return { url };
    }
  } catch {}

  return null;
};

export const extractJobAssets = (job: any): GenerationAsset[] => {
  const result =
    job?.result ||
    job?.output?.result ||
    job?.output?.data?.result ||
    job?.output?.output?.result;
  if (!result) {
    console.log("No result found in job");
    return [];
  }

  console.log("Result found:", result);
  console.log("Result.images:", result.images);

  // Prefer arrays of videos if present
  if (Array.isArray(result.videos) && result.videos.length > 0) {
    const assets = result.videos
      .map((vid: any) => ({
        url: vid.r2OriginalUrl || vid.url || vid.video_url,
        width: vid.metadata?.width ?? result.metadata?.width,
        height: vid.metadata?.height ?? result.metadata?.height,
      }))
      .filter((asset: any) => asset.url);
    if (assets.length > 0) return assets;
  }

  // Single video field
  if (result.video?.r2OriginalUrl || result.video?.url || result.video_url) {
    const url =
      result.video?.r2OriginalUrl || result.video?.url || result.video_url;
    return [
      {
        url,
        width: result.video?.metadata?.width ?? result.metadata?.width,
        height: result.video?.metadata?.height ?? result.metadata?.height,
      },
    ];
  }

  // Check if we have multiple images
  if (Array.isArray(result.images) && result.images.length > 0) {
    console.log(`Found ${result.images.length} images in result.images`);
    const assets = result.images
      .map((img: any) => ({
        url: img.r2OriginalUrl || img.url,
        width: img.metadata?.width ?? result.metadata?.width,
        height: img.metadata?.height ?? result.metadata?.height,
      }))
      .filter((asset: any) => asset.url);

    console.log("Processed assets:", assets);
    return assets;
  }

  console.log("No images array found, falling back to single asset");
  // Fallback to single image
  const singleAsset = extractJobAsset(job);
  return singleAsset ? [singleAsset] : [];
};

export const useImageGeneration = () => {
  const processGenerationResult = useCallback((job: any): GenerationResult => {
    try {
      const assets = extractJobAssets(job);

      if (!assets || assets.length === 0) {
        return {
          assets: [],
          success: false,
          error: "Generation completed but no output was returned.",
        };
      }

      return {
        assets,
        success: true,
      };
    } catch (error) {
      return {
        assets: [],
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }, []);

  return {
    processGenerationResult,
    extractJobAsset,
    extractJobAssets,
  };
};
