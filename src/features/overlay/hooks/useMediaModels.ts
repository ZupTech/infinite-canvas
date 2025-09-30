import { useCallback, useEffect, useMemo, useState } from "react";

import type { GenerationSettings } from "@/types/canvas";

import {
  type MediaModel,
  type ModelsResponse,
  isDisplayableType,
} from "../types";

interface UseMediaModelsParams {
  generationSettings: GenerationSettings;
  setGenerationSettings: React.Dispatch<
    React.SetStateAction<GenerationSettings>
  >;
}

interface UseMediaModelsResult {
  mediaModels: MediaModel[];
  isModelsLoading: boolean;
  modelsError: string | null;
  selectedMediaModel: MediaModel | null;
  displayMediaModel: MediaModel | null;
  previousModelId: string | null;
  resolveModelId: (options?: { styleId?: string | null }) => string | null;
  reloadModels: () => void;
}

export function useMediaModels({
  generationSettings,
  setGenerationSettings,
}: UseMediaModelsParams): UseMediaModelsResult {
  const [mediaModels, setMediaModels] = useState<MediaModel[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [previousModelId, setPreviousModelId] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchModels = async () => {
      try {
        setIsModelsLoading(true);
        setModelsError(null);

        const response = await fetch("/api/models", {
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
        });

        const contentType = response.headers.get("content-type") ?? "";
        let data: ModelsResponse | null = null;

        if (contentType.includes("application/json")) {
          data = (await response.json()) as ModelsResponse;
        } else {
          const body = await response.text().catch(() => "");
          throw new Error(
            body
              ? `Unexpected response when loading models: ${body.slice(0, 120)}`
              : "Unexpected response when loading models.",
          );
        }

        if (!response.ok) {
          const message =
            (data as any)?.message ||
            (data as any)?.error ||
            `Failed to fetch models (${response.status})`;
          throw new Error(message);
        }

        if (!data) {
          throw new Error("Failed to parse models response.");
        }

        const candidates = Array.isArray(data.models) ? data.models : [];

        const visibleModels = candidates
          .filter((model): model is MediaModel => Boolean(model?.id))
          .map((model) => ({
            ...model,
            type: (model.type ?? "").toString().toLowerCase(),
          }))
          .filter((model) => model.visible && isDisplayableType(model.type));

        if (!isMounted) {
          return;
        }

        setMediaModels(visibleModels);

        if (visibleModels.length > 0) {
          const preferredModel =
            visibleModels.find((model) => model.featured) || visibleModels[0];

          setGenerationSettings((prev) => {
            if (prev.styleId && prev.styleId !== "custom") {
              return prev;
            }

            return {
              ...prev,
              styleId: preferredModel.id,
            };
          });

          setPreviousModelId((prev) => prev ?? preferredModel.id);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error("Failed to load models", error);
        setModelsError(
          error instanceof Error ? error.message : "Failed to load models",
        );
      } finally {
        if (isMounted) {
          setIsModelsLoading(false);
        }
      }
    };

    void fetchModels();

    return () => {
      isMounted = false;
    };
  }, [setGenerationSettings, reloadCounter]);

  const selectedMediaModel = useMemo(() => {
    if (
      !generationSettings.styleId ||
      generationSettings.styleId === "custom"
    ) {
      return null;
    }

    return (
      mediaModels.find((model) => model.id === generationSettings.styleId) ??
      null
    );
  }, [generationSettings.styleId, mediaModels]);

  const displayMediaModel = useMemo(() => {
    if (selectedMediaModel) {
      return selectedMediaModel;
    }

    return mediaModels[0] ?? null;
  }, [selectedMediaModel, mediaModels]);

  useEffect(() => {
    const currentModelId = generationSettings.styleId;
    if (
      currentModelId &&
      currentModelId !== "custom" &&
      currentModelId !== previousModelId
    ) {
      setPreviousModelId(currentModelId);
    }
  }, [generationSettings.styleId, previousModelId]);

  const resolveModelId = useCallback(
    (options?: { styleId?: string | null }) => {
      const styleId = options?.styleId ?? generationSettings.styleId;

      if (styleId && styleId !== "custom") {
        return styleId;
      }

      if (styleId === "custom" && previousModelId) {
        return previousModelId;
      }

      return displayMediaModel?.id ?? null;
    },
    [displayMediaModel?.id, generationSettings.styleId, previousModelId],
  );

  const reloadModels = useCallback(() => {
    setReloadCounter((counter) => counter + 1);
  }, []);

  return {
    mediaModels,
    isModelsLoading,
    modelsError,
    selectedMediaModel,
    displayMediaModel,
    previousModelId,
    resolveModelId,
    reloadModels,
  };
}
