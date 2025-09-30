import React, { useEffect, useRef } from "react";
import type { ActiveVideoGeneration } from "@/types/canvas";

interface StreamingVideoProps {
  videoId: string;
  generation: ActiveVideoGeneration;
  onComplete: (videoId: string, videoUrl: string, duration: number) => void;
  onError: (videoId: string, error: string) => void;
  onProgress: (videoId: string, progress: number, status: string) => void;
}

const PROGRESS_STATUSES = new Set([
  "running",
  "processing",
  "queued",
  "in_progress",
  "started",
]);

const FAILURE_STATUSES = new Set([
  "failed",
  "error",
  "errored",
  "cancelled",
  "canceled",
  "system_failure",
]);

const isCompleteStatus = (status: string) => {
  const normalized = status.toLowerCase();
  return (
    normalized === "completed" ||
    normalized === "succeeded" ||
    normalized === "success" ||
    normalized === "completed_successfully"
  );
};

const extractVideoInfo = (
  job: any,
): {
  videoUrl?: string;
  duration?: number;
  progress?: number;
  status: string;
} => {
  const statusRaw =
    job?.output?.status || job?.status || job?.result?.status || "unknown";
  const status = String(statusRaw);

  const progressValue =
    job?.output?.progress ??
    job?.progress ??
    job?.result?.progress ??
    job?.metadata?.progress;

  const result =
    job?.output?.result ||
    job?.result ||
    job?.output?.data?.result ||
    job?.output?.output?.result;

  const videoUrl =
    result?.videoUrl ||
    result?.video_url ||
    result?.url ||
    job?.videoUrl ||
    job?.video_url;

  const duration =
    result?.duration ||
    job?.output?.duration ||
    job?.duration ||
    job?.metadata?.duration;

  return {
    videoUrl,
    duration,
    progress: typeof progressValue === "number" ? progressValue : undefined,
    status,
  };
};

export const StreamingVideo: React.FC<StreamingVideoProps> = React.memo(
  ({ videoId, generation, onComplete, onError, onProgress }) => {
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

      const scheduleNextPoll = (delay: number) => {
        clearPolling();
        pollingRef.current = window.setTimeout(() => {
          pollStatus();
        }, delay);
      };

      const pollStatus = async () => {
        if (isCancelled) {
          return;
        }

        try {
          const response = await fetch(`/api/jobs/status/${generation.runId}`, {
            credentials: "include",
          });

          if (response.status === 404) {
            scheduleNextPoll(3000);
            return;
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(
              errorText ||
                `Failed to fetch video generation status (${response.status})`,
            );
          }

          const payload = await response.json();
          const job = payload.job ?? payload;
          const { videoUrl, duration, progress, status } =
            extractVideoInfo(job);
          const normalizedStatus = status.toLowerCase();

          if (
            progress !== undefined &&
            PROGRESS_STATUSES.has(normalizedStatus)
          ) {
            onProgress(videoId, progress, status);
          }

          if (isCompleteStatus(status)) {
            if (!videoUrl) {
              onError(
                videoId,
                "Video generation completed but no video URL was returned.",
              );
              return;
            }

            onComplete(videoId, videoUrl, duration || generation.duration || 5);
            return;
          }

          if (FAILURE_STATUSES.has(normalizedStatus)) {
            const errorMessage =
              job?.error ||
              job?.errorMessage ||
              job?.output?.error ||
              "Video generation failed";
            onError(videoId, errorMessage);
            return;
          }

          scheduleNextPoll(3000);
        } catch (error) {
          if (isCancelled) {
            return;
          }

          scheduleNextPoll(3000);

          if (error instanceof Error) {
            onProgress(videoId, 0, `Retrying: ${error.message}`);
          }
        }
      };

      pollStatus();

      return () => {
        isCancelled = true;
        clearPolling();
      };
    }, [
      generation.duration,
      generation.runId,
      onComplete,
      onError,
      onProgress,
      videoId,
    ]);

    return null;
  },
);

StreamingVideo.displayName = "StreamingVideo";
