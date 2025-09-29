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

export const extractJobAsset = (job: any): GenerationAsset | null => {
  const result =
    job?.result ||
    job?.output?.result ||
    job?.output?.data?.result ||
    job?.output?.output?.result;
  if (!result) {
    return null;
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
