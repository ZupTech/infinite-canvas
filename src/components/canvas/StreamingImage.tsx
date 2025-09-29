import React, { useEffect, useRef } from "react";
import type { ActiveGeneration } from "@/types/canvas";

interface StreamingImageProps {
  imageId: string;
  generation: ActiveGeneration;
  onComplete: (imageId: string, finalUrl: string, job?: any) => void;
  onError: (imageId: string, error: string) => void;
  onStatus?: (imageId: string, status: string, job?: any) => void;
}

export const StreamingImage: React.FC<StreamingImageProps> = ({
  imageId,
  generation,
  onComplete,
  onError,
  onStatus,
}) => {
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!generation.runId) {
      return;
    }

    let isCancelled = false;

    const clearPolling = () => {
      if (pollingRef.current !== null) {
        window.clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };

    const scheduleNextPoll = (delay: number, attempt: number) => {
      clearPolling();
      pollingRef.current = window.setTimeout(() => pollStatus(attempt), delay);
    };

    const extractAssetUrl = (
      job: any,
    ): { url: string; width?: number; height?: number } | null => {
      const result =
        job?.result || job?.output?.result || job?.output?.data?.result;
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
          url: result.url,
          width: result.metadata?.width,
          height: result.metadata?.height,
        };
      }

      if (Array.isArray(result.images) && result.images.length > 0) {
        const image =
          result.images.find((img: any) => img.r2OriginalUrl || img.url) ||
          result.images[0];
        return {
          url: (image.r2OriginalUrl ||
            image.r2_thumbnail_url ||
            image.url) as string,
          width: image.metadata?.width ?? result.metadata?.width,
          height: image.metadata?.height ?? result.metadata?.height,
        };
      }

      return null;
    };

    const pollStatus = async (attempt = 0) => {
      if (isCancelled) {
        return;
      }

      try {
        const endpoint = `/api/jobs/status/${generation.runId}`;
        const response = await fetch(endpoint, {
          credentials: "include",
        });

        if (response.status === 404) {
          if (attempt < 3) {
            scheduleNextPoll(1500 * (attempt + 1), attempt + 1);
            return;
          }
          onError(imageId, "Generation not found.");
          return;
        }

        if (!response.ok) {
          const errorBody = await response
            .text()
            .catch(() => "Failed to fetch generation status.");
          throw new Error(errorBody || "Failed to fetch generation status.");
        }

        const payload = await response.json();
        const job = payload.job ?? payload;

        const rawStatus = (
          job?.output?.status ||
          job?.status ||
          "unknown"
        ).toString();
        const normalizedStatus = rawStatus.toLowerCase();

        onStatus?.(imageId, rawStatus, job);

        if (normalizedStatus === "completed") {
          const asset = extractAssetUrl(job);
          if (!asset?.url) {
            onError(imageId, "Generation completed but no media was returned.");
            return;
          }

          onComplete(imageId, asset.url, { job, asset });
          return;
        }

        if (
          ["failed", "cancelled", "system_failure"].includes(normalizedStatus)
        ) {
          onError(
            imageId,
            job.error || job.errorMessage || "Generation failed to complete.",
          );
          return;
        }

        scheduleNextPoll(2000, 0);
      } catch (error: any) {
        if (attempt < 5) {
          scheduleNextPoll(1500 * (attempt + 1), attempt + 1);
          return;
        }

        const message =
          error instanceof Error
            ? error.message || "Generation failed"
            : "Generation failed";
        onError(imageId, message);
      }
    };

    pollStatus();

    return () => {
      isCancelled = true;
      clearPolling();
    };
  }, [generation.runId, imageId, onComplete, onError, onStatus]);

  return null;
};
