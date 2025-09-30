import { useCallback, useEffect, useState } from "react";

import { PLACEHOLDER_DATA_URI } from "@/utils/placeholder-utils";
import type {
  ActiveGeneration,
  GenerationSettings,
  PlacedImage,
  PlacedVideo,
} from "@/types/canvas";
import type { MediaModel } from "../types";
import type { useImageToImage } from "@/hooks/useImageToImage";
import type { useToast as useToastType } from "@/hooks/use-toast";
import type { useImageGeneration } from "@/hooks/useImageGeneration";
import { createCanvasImagesFromAssets } from "@/utils/imageGeneration";

interface UseOverlayGenerationOptions {
  canvasSize: { width: number; height: number };
  viewport: { x: number; y: number; scale: number };
  mediaModels: MediaModel[];
  displayMediaModel: MediaModel | null;
  resolveModelId: () => string | null | undefined;
  images: PlacedImage[];
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setVideos: React.Dispatch<React.SetStateAction<PlacedVideo[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toast: ReturnType<typeof useToastType>["toast"];
  imageToImage: ReturnType<typeof useImageToImage>;
  processGenerationResult: ReturnType<
    typeof useImageGeneration
  >["processGenerationResult"];
  saveToStorage: () => Promise<void>;
  activeVideoGenerationsCount: number;
  isRemovingVideoBackground: boolean;
  isIsolating: boolean;
  isExtendingVideo: boolean;
  isTransformingVideo: boolean;
  generationSettings: GenerationSettings;
}

interface UseOverlayGenerationResult {
  modelParameters: Record<string, any>;
  setModelParameters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  activeGenerations: Map<string, ActiveGeneration>;
  setActiveGenerations: React.Dispatch<
    React.SetStateAction<Map<string, ActiveGeneration>>
  >;
  showSuccess: boolean;
  handleRun: () => Promise<void>;
}

export function useOverlayGeneration({
  canvasSize,
  viewport,
  mediaModels,
  displayMediaModel,
  resolveModelId,
  images,
  setImages,
  setVideos,
  setSelectedIds,
  toast,
  imageToImage,
  processGenerationResult,
  saveToStorage,
  activeVideoGenerationsCount,
  isRemovingVideoBackground,
  isIsolating,
  isExtendingVideo,
  isTransformingVideo,
  generationSettings,
}: UseOverlayGenerationOptions): UseOverlayGenerationResult {
  const [modelParameters, setModelParameters] = useState<Record<string, any>>(
    {},
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeGenerations, setActiveGenerations] = useState<
    Map<string, ActiveGeneration>
  >(new Map());
  const [showSuccess, setShowSuccess] = useState(false);
  const [previousGenerationCount, setPreviousGenerationCount] = useState(0);

  useEffect(() => {
    const currentCount =
      (isGenerating ? 1 : 0) +
      activeGenerations.size +
      activeVideoGenerationsCount +
      (isRemovingVideoBackground ? 1 : 0) +
      (isIsolating ? 1 : 0) +
      (isExtendingVideo ? 1 : 0) +
      (isTransformingVideo ? 1 : 0);

    if (previousGenerationCount > 0 && currentCount === 0) {
      setShowSuccess(true);
      const timeout = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timeout);
    }

    setPreviousGenerationCount(currentCount);
  }, [
    activeGenerations.size,
    activeVideoGenerationsCount,
    isExtendingVideo,
    isGenerating,
    isIsolating,
    isRemovingVideoBackground,
    isTransformingVideo,
    previousGenerationCount,
  ]);

  const handleRun = useCallback(async () => {
    const prompt = generationSettings.prompt.trim();
    if (!prompt) {
      toast({
        title: "Prompt required",
        description: "Please enter a prompt before generating",
        variant: "destructive",
      });
      return;
    }

    const resolvedModelId = resolveModelId();
    const targetModel = mediaModels.find(
      (model) => model.id === resolvedModelId,
    );
    const model = targetModel || displayMediaModel;

    if (!model) {
      toast({
        title: "Select a model",
        description: "Choose a model from the catalog before generating",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ["image", "upscale", "video"] as const;
    if (!allowedTypes.includes(model.type as (typeof allowedTypes)[number])) {
      toast({
        title: "Unsupported model",
        description: `Model type "${model.type}" is not supported in the canvas.`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    const numImages = Math.max(
      1,
      Math.min(4, Number(modelParameters.num_images) || 1),
    );

    const placeholderIds: string[] = [];
    const newPlaceholders: PlacedImage[] = [];
    const baseSize = 512;
    const viewportCenterX =
      (canvasSize.width / 2 - viewport.x) / viewport.scale;
    const viewportCenterY =
      (canvasSize.height / 2 - viewport.y) / viewport.scale;
    const spacing = 20;
    const totalWidth = numImages * baseSize + (numImages - 1) * spacing;
    const startX = viewportCenterX - totalWidth / 2;

    for (let i = 0; i < numImages; i++) {
      const placeholderId = `generated-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}-${i}`;
      placeholderIds.push(placeholderId);

      const xPos = startX + i * (baseSize + spacing);
      newPlaceholders.push({
        id: placeholderId,
        src: PLACEHOLDER_DATA_URI,
        x: xPos,
        y: viewportCenterY - baseSize / 2,
        width: baseSize,
        height: baseSize,
        rotation: 0,
        isGenerated: true,
      } as PlacedImage);
    }

    setImages((prev) => [...prev, ...newPlaceholders]);
    setSelectedIds(placeholderIds);

    const parameters: Record<string, any> = { prompt };
    if (generationSettings.loraUrl) {
      parameters.loraUrl = generationSettings.loraUrl;
    }
    if (generationSettings.styleId && generationSettings.styleId !== "custom") {
      parameters.styleId = generationSettings.styleId;
    }
    Object.keys(modelParameters).forEach((key) => {
      const value = modelParameters[key];
      if (value !== undefined && value !== null && value !== "") {
        parameters[key] = value;
      }
    });

    const { parameters: finalParameters, endpoint } =
      imageToImage.prepareParameters(model, parameters);

    setActiveGenerations((prev) => {
      const next = new Map(prev);
      placeholderIds.forEach((placeholderId, index) => {
        next.set(placeholderId, {
          prompt,
          loraUrl: generationSettings.loraUrl,
          modelId: model.id,
          parameters: finalParameters,
          status: "queued",
          createdAt: Date.now(),
          placeholderIds,
          isCoordinator: index === 0,
        });
      });
      return next;
    });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          modelId: model.id,
          endpoint,
          parameters: finalParameters,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          errorText ||
            `Generation request failed with status ${response.status}`,
        );
      }

      const payload = await response.json();
      const job = payload.job;
      const realtime = payload.realtime ?? {};

      if (!job) {
        throw new Error("Generation response did not include job details.");
      }

      const runId = job.runId || realtime.runId || job.id;
      const status = job.status ?? "queued";

      setActiveGenerations((prev) => {
        const next = new Map(prev);
        placeholderIds.forEach((placeholderId) => {
          const existing = next.get(placeholderId);
          if (existing) {
            next.set(placeholderId, { ...existing, runId, status });
          }
        });
        return next;
      });

      const eventSource = new EventSource(
        `/api/events?runId=${encodeURIComponent(runId)}`,
      );

      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "completed" || data.type === "failed") {
            eventSource.close();
          }

          if (data.type === "completed" && data.job?.assets) {
            const jobResult = processGenerationResult(data.job);
            if (!jobResult.success || jobResult.assets.length === 0) {
              throw new Error(
                jobResult.error ||
                  "Generation completed but no assets were returned.",
              );
            }

            const { updatedPlaceholders, newImages, newVideos } =
              createCanvasImagesFromAssets(
                jobResult.assets,
                placeholderIds,
                viewport,
                canvasSize,
              );

            if (updatedPlaceholders.length > 0 || newImages.length > 0) {
              setImages((prevImages) => {
                const replacements = new Map(
                  updatedPlaceholders.map((img) => [img.id, img]),
                );

                const mergedImages = prevImages.map((img) => {
                  const replacement = replacements.get(img.id);
                  return replacement ? { ...img, ...replacement } : img;
                });

                return [...mergedImages, ...newImages];
              });

              const generatedIds = [
                ...updatedPlaceholders.map((img) => img.id),
                ...newImages.map((img) => img.id),
              ];
              if (generatedIds.length > 0) {
                setSelectedIds(generatedIds);
              }
            }

            if (newVideos.length > 0) {
              const placeholderMap = new Map(
                images
                  .filter((img) => placeholderIds.includes(img.id))
                  .map((img) => [img.id, img]),
              );

              const mappedVideos = newVideos.map((vid, index) => {
                const placeholderId = placeholderIds[index];
                const placeholder = placeholderId
                  ? placeholderMap.get(placeholderId)
                  : undefined;
                if (placeholder) {
                  return {
                    ...vid,
                    x: placeholder.x,
                    y: placeholder.y,
                    width: placeholder.width,
                    height: placeholder.height,
                  };
                }
                return vid;
              });

              setVideos((prevVideos) => [...prevVideos, ...mappedVideos]);
              setImages((prevImages) =>
                prevImages.filter((img) => !placeholderIds.includes(img.id)),
              );

              const videoIds = mappedVideos.map((video) => video.id);
              if (videoIds.length > 0) {
                setSelectedIds(videoIds);
              }
            }

            setActiveGenerations((prev) => {
              const next = new Map(prev);
              placeholderIds.forEach((id) => next.delete(id));
              return next;
            });
            setIsGenerating(false);
            setTimeout(() => {
              void saveToStorage();
            }, 100);
          } else if (data.type === "failed") {
            throw new Error(data.error || "Generation failed");
          }
        } catch (error) {
          console.error("Error handling generation event:", error);
          eventSource.close();
          setImages((prev) =>
            prev.filter((img) => !placeholderIds.includes(img.id)),
          );
          setActiveGenerations((prev) => {
            const next = new Map(prev);
            placeholderIds.forEach((id) => next.delete(id));
            return next;
          });
          setIsGenerating(false);
          toast({
            title: "Generation failed",
            description:
              error instanceof Error
                ? error.message
                : "Failed to process generation results",
            variant: "destructive",
          });
        }
      };

      eventSource.onerror = (error) => {
        console.error("Event source error:", error);
        eventSource.close();
        setImages((prev) =>
          prev.filter((img) => !placeholderIds.includes(img.id)),
        );
        setActiveGenerations((prev) => {
          const next = new Map(prev);
          placeholderIds.forEach((id) => next.delete(id));
          return next;
        });
        setIsGenerating(false);
        toast({
          title: "Generation failed",
          description: "Connection lost while waiting for results",
          variant: "destructive",
        });
      };

      toast({
        title: "Generation started",
        description:
          "Hang tight, we will add the result to the canvas automatically.",
      });
    } catch (error) {
      console.error("Failed to start generation:", error);
      const message =
        error instanceof Error
          ? error.message || "Failed to start generation"
          : "Failed to start generation";

      setImages((prev) =>
        prev.filter((img) => !placeholderIds.includes(img.id)),
      );
      setActiveGenerations((prev) => {
        const next = new Map(prev);
        placeholderIds.forEach((id) => next.delete(id));
        return next;
      });
      setIsGenerating(false);

      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive",
      });
    }
  }, [
    canvasSize.height,
    canvasSize.width,
    displayMediaModel,
    generationSettings.loraUrl,
    generationSettings.prompt,
    generationSettings.styleId,
    imageToImage,
    images,
    mediaModels,
    modelParameters,
    processGenerationResult,
    resolveModelId,
    saveToStorage,
    setImages,
    setSelectedIds,
    setVideos,
    toast,
    viewport.scale,
    viewport.x,
    viewport.y,
  ]);

  return {
    modelParameters,
    setModelParameters,
    isGenerating,
    setIsGenerating,
    activeGenerations,
    setActiveGenerations,
    showSuccess,
    handleRun,
  };
}
