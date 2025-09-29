import { useCallback, type Dispatch, type SetStateAction } from "react";
import { createCanvasImagesFromAssets } from "@/utils/imageGeneration";
import type { ActiveGeneration, PlacedImage } from "@/types/canvas";

interface ViewportInfo {
  x: number;
  y: number;
  scale: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

interface MultiImageGenerationHandlers {
  onStatus: (id: string, status: string, job?: any) => void;
  onComplete: (id: string, finalUrl: string, payload?: any) => void;
  onError: (id: string, error: string) => void;
}

interface UseMultiImageGenerationProps {
  activeGenerations: Map<string, ActiveGeneration>;
  setActiveGenerations: (
    updater: (
      prev: Map<string, ActiveGeneration>,
    ) => Map<string, ActiveGeneration>,
  ) => void;
  setImages: Dispatch<SetStateAction<PlacedImage[]>>;
  setSelectedIds: (ids: string[]) => void;
  setIsGenerating: (generating: boolean) => void;
  saveToStorage: () => void;
  viewport: ViewportInfo;
  canvasSize: CanvasSize;
}

export const useMultiImageGeneration = ({
  activeGenerations,
  setActiveGenerations,
  setImages,
  setSelectedIds,
  setIsGenerating,
  saveToStorage,
  viewport,
  canvasSize,
}: UseMultiImageGenerationProps): MultiImageGenerationHandlers => {
  const handleStatus = useCallback(
    (id: string, status: string, job?: any) => {
      setActiveGenerations((prev) => {
        const existing = prev.get(id);
        if (!existing) {
          return prev;
        }

        const next = new Map(prev);
        next.set(id, {
          ...existing,
          status,
          jobId: job?.id,
          runId: job?.runId ?? existing.runId,
        });
        return next;
      });
    },
    [setActiveGenerations],
  );

  const handleComplete = useCallback(
    (id: string, finalUrl: string, payload?: any) => {
      console.log("Multi-image onComplete called:", {
        id,
        finalUrl,
        isCoordinator: payload?.isCoordinator,
      });

      // If this is a coordinator with multiple assets, distribute them
      if (
        payload?.isCoordinator &&
        payload?.assets &&
        payload?.placeholderIds
      ) {
        console.log("Processing coordinator completion with multiple assets");

        const { updatedPlaceholders, newImages } = createCanvasImagesFromAssets(
          payload.assets,
          payload.placeholderIds,
          viewport,
          canvasSize,
        );

        // Update all placeholders at once
        setImages((prev) => {
          const placeholderMap = new Map<string, PlacedImage>(
            updatedPlaceholders.map((p) => [p.id, p as PlacedImage]),
          );

          const newPlacedImages: PlacedImage[] = newImages.map((img) => ({
            ...img,
          }));

          return [
            ...prev.map((img) => placeholderMap.get(img.id) || img),
            ...newPlacedImages,
          ];
        });

        // Clean up all placeholders from active generations
        setActiveGenerations((prev) => {
          const newMap = new Map(prev);
          payload.placeholderIds.forEach((placeholderId: string) => {
            newMap.delete(placeholderId);
          });
          if (newMap.size === 0) {
            setIsGenerating(false);
          }
          return newMap;
        });

        // Select all generated images
        const allGeneratedIds = [
          ...updatedPlaceholders.map((p) => p.id),
          ...newImages.map((img) => img.id),
        ];
        if (allGeneratedIds.length > 0) {
          setSelectedIds(allGeneratedIds);
        }
      } else {
        // Single image processing (fallback or non-coordinator)
        setImages((prev) =>
          prev.map((img) =>
            img.id === id
              ? {
                  ...img,
                  src: finalUrl,
                  width:
                    payload?.asset?.width && payload.asset.width > 0
                      ? Math.min(payload.asset.width, 1024)
                      : img.width,
                  height:
                    payload?.asset?.height && payload.asset.height > 0
                      ? Math.min(payload.asset.height, 1024)
                      : img.height,
                }
              : img,
          ),
        );

        setActiveGenerations((prev) => {
          const newMap = new Map(prev);
          newMap.delete(id);
          if (newMap.size === 0) {
            setIsGenerating(false);
          }
          return newMap;
        });
      }

      // Immediately save after generation completes
      setTimeout(() => {
        saveToStorage();
      }, 100);
    },
    [
      setImages,
      setActiveGenerations,
      setSelectedIds,
      setIsGenerating,
      saveToStorage,
      viewport,
      canvasSize,
    ],
  );

  const handleError = useCallback(
    (id: string, error: string) => {
      console.error(`StreamingImage ${id} error:`, error);

      // Remove from active generations
      setActiveGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(id);
        if (newMap.size === 0) {
          setIsGenerating(false);
        }
        return newMap;
      });

      // Could also show toast error here if needed
    },
    [setActiveGenerations, setIsGenerating],
  );

  return {
    onStatus: handleStatus,
    onComplete: handleComplete,
    onError: handleError,
  };
};
