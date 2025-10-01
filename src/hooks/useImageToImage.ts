import { useCallback } from "react";
import type { PlacedImage } from "@/types/canvas";
import {
  resolveModelEndpoint,
  getImageInputParamName,
  filterModelParameters,
  type MediaModel,
} from "@/utils/model-utils";
import { isPlaceholder } from "@/utils/placeholder-utils";

interface UseImageToImageParams {
  images: PlacedImage[];
  selectedIds: string[];
}

interface ImageToImageConfig {
  hasSelectedImages: boolean;
  selectedImage: PlacedImage | null;
  prepareParameters: (
    model: MediaModel,
    baseParameters: Record<string, any>,
  ) => {
    parameters: Record<string, any>;
    endpoint: string;
  };
}

/**
 * Hook for handling image-to-image generation logic
 * Provides utilities to detect selected images and prepare parameters
 */
export function useImageToImage({
  images,
  selectedIds,
}: UseImageToImageParams): ImageToImageConfig {
  // Get the first selected image (for now, we support single image input)
  // Ignore placeholders - they don't count as valid images for image-to-image
  const selectedImage =
    selectedIds.length > 0
      ? images.find(
          (img) => selectedIds.includes(img.id) && !isPlaceholder(img.src),
        ) || null
      : null;

  // Only consider it as having selected images if we found a valid (non-placeholder) image
  const hasSelectedImages = selectedImage !== null;

  /**
   * Prepare parameters for image-to-image generation
   * Adds the selected image URL and resolves the correct endpoint
   */
  const prepareParameters = useCallback(
    (model: MediaModel, baseParameters: Record<string, any>) => {
      const hasImageInput = hasSelectedImages && selectedImage !== null;

      // Resolve the correct endpoint based on whether we have an image
      const endpoint = resolveModelEndpoint(model, hasImageInput);

      // If no image, return base parameters with resolved endpoint
      if (!hasImageInput) {
        return {
          parameters: baseParameters,
          endpoint,
        };
      }

      // Get the parameter name for image input (varies by model)
      const imageParamName = getImageInputParamName(model);

      if (!imageParamName) {
        // Model doesn't support image input, return base parameters
        return {
          parameters: baseParameters,
          endpoint,
        };
      }

      // Find the parameter definition to check if it expects array or string
      const imageParam = model.parameters?.find(
        (p) => p.name === imageParamName,
      );
      const isMultifile = imageParam?.type === "multifile";

      // Add the image URL to parameters (array for multifile, string for file)
      const parametersWithImage = {
        ...baseParameters,
        [imageParamName]: isMultifile ? [selectedImage.src] : selectedImage.src,
      };

      // Filter to only include parameters defined by the model
      const filteredParameters = filterModelParameters(
        model,
        parametersWithImage,
        endpoint,
      );

      return {
        parameters: filteredParameters,
        endpoint,
      };
    },
    [hasSelectedImages, selectedImage],
  );

  return {
    hasSelectedImages,
    selectedImage,
    prepareParameters,
  };
}
