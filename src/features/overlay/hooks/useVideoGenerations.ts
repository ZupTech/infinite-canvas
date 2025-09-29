import { useCallback, useState } from "react";

import type {
  ActiveVideoGeneration,
  GenerationSettings,
  PlacedImage,
  PlacedVideo,
  VideoGenerationSettings,
} from "@/types/canvas";
import type { useToast as useToastType } from "@/hooks/use-toast";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import {
  getImageInputParamName,
  resolveModelEndpoint,
} from "@/utils/model-utils";
import { convertImageToVideo } from "@/utils/video-utils";

import type { MediaModel } from "../types";

interface UseVideoGenerationsParams {
  images: PlacedImage[];
  videos: PlacedVideo[];
  setVideos: React.Dispatch<React.SetStateAction<PlacedVideo[]>>;
  mediaModels: MediaModel[];
  toast: ReturnType<typeof useToastType>["toast"];
  generationSettings: GenerationSettings;
  saveToHistory: () => void;
}

interface UseVideoGenerationsResult {
  activeVideoGenerations: Map<string, ActiveVideoGeneration>;
  isImageToVideoDialogOpen: boolean;
  openImageToVideoDialog: (imageId: string) => void;
  closeImageToVideoDialog: () => void;
  isVideoToVideoDialogOpen: boolean;
  openVideoToVideoDialog: (videoId: string) => void;
  closeVideoToVideoDialog: () => void;
  isExtendVideoDialogOpen: boolean;
  openExtendVideoDialog: (videoId: string) => void;
  closeExtendVideoDialog: () => void;
  isRemoveVideoBackgroundDialogOpen: boolean;
  openRemoveVideoBackgroundDialog: (videoId: string) => void;
  closeRemoveVideoBackgroundDialog: () => void;
  isConvertingToVideo: boolean;
  isTransformingVideo: boolean;
  isExtendingVideo: boolean;
  isRemovingVideoBackground: boolean;
  selectedImageForVideo: string | null;
  selectedVideoForVideo: string | null;
  selectedVideoForExtend: string | null;
  selectedVideoForBackgroundRemoval: string | null;
  handleImageToVideoConversion: (
    settings: VideoGenerationSettings,
  ) => Promise<void>;
  handleVideoToVideoTransformation: (
    settings: VideoGenerationSettings,
  ) => Promise<void>;
  handleVideoExtension: (settings: VideoGenerationSettings) => Promise<void>;
  handleVideoBackgroundRemoval: (backgroundColor: string) => Promise<void>;
  handleVideoGenerationComplete: (
    videoId: string,
    videoUrl: string,
    duration: number,
  ) => Promise<void>;
  handleVideoGenerationError: (videoId: string, error: string) => void;
  handleVideoGenerationProgress: (
    videoId: string,
    progress: number,
    status: string,
  ) => void;
  setActiveVideoGenerations: React.Dispatch<
    React.SetStateAction<Map<string, ActiveVideoGeneration>>
  >;
}

export function useVideoGenerations({
  images,
  videos,
  setVideos,
  mediaModels,
  toast,
  generationSettings,
  saveToHistory,
}: UseVideoGenerationsParams): UseVideoGenerationsResult {
  const [activeVideoGenerations, setActiveVideoGenerations] = useState<
    Map<string, ActiveVideoGeneration>
  >(new Map());
  const [isImageToVideoDialogOpen, setIsImageToVideoDialogOpen] =
    useState(false);
  const [selectedImageForVideo, setSelectedImageForVideo] = useState<
    string | null
  >(null);
  const [isConvertingToVideo, setIsConvertingToVideo] = useState(false);
  const [isVideoToVideoDialogOpen, setIsVideoToVideoDialogOpen] =
    useState(false);
  const [selectedVideoForVideo, setSelectedVideoForVideo] = useState<
    string | null
  >(null);
  const [isTransformingVideo, setIsTransformingVideo] = useState(false);
  const [isExtendVideoDialogOpen, setIsExtendVideoDialogOpen] = useState(false);
  const [selectedVideoForExtend, setSelectedVideoForExtend] = useState<
    string | null
  >(null);
  const [isExtendingVideo, setIsExtendingVideo] = useState(false);
  const [
    isRemoveVideoBackgroundDialogOpen,
    setIsRemoveVideoBackgroundDialogOpen,
  ] = useState(false);
  const [
    selectedVideoForBackgroundRemoval,
    setSelectedVideoForBackgroundRemoval,
  ] = useState<string | null>(null);
  const [isRemovingVideoBackground, setIsRemovingVideoBackground] =
    useState(false);

  const { processGenerationResult } = useImageGeneration();

  const openImageToVideoDialog = useCallback((imageId: string) => {
    setSelectedImageForVideo(imageId);
    setIsImageToVideoDialogOpen(true);
  }, []);

  const closeImageToVideoDialog = useCallback(() => {
    setIsImageToVideoDialogOpen(false);
  }, []);

  const openVideoToVideoDialog = useCallback((videoId: string) => {
    setSelectedVideoForVideo(videoId);
    setIsVideoToVideoDialogOpen(true);
  }, []);

  const closeVideoToVideoDialog = useCallback(() => {
    setIsVideoToVideoDialogOpen(false);
  }, []);

  const openExtendVideoDialog = useCallback((videoId: string) => {
    setSelectedVideoForExtend(videoId);
    setIsExtendVideoDialogOpen(true);
  }, []);

  const closeExtendVideoDialog = useCallback(() => {
    setIsExtendVideoDialogOpen(false);
  }, []);

  const openRemoveVideoBackgroundDialog = useCallback((videoId: string) => {
    setSelectedVideoForBackgroundRemoval(videoId);
    setIsRemoveVideoBackgroundDialogOpen(true);
  }, []);

  const closeRemoveVideoBackgroundDialog = useCallback(() => {
    setIsRemoveVideoBackgroundDialogOpen(false);
  }, []);

  const handleImageToVideoConversion = useCallback(
    async (settings: VideoGenerationSettings) => {
      if (!selectedImageForVideo) return;

      const image = images.find((img) => img.id === selectedImageForVideo);
      if (!image) return;

      try {
        setIsConvertingToVideo(true);

        const modelId =
          settings.modelId || generationSettings.styleId || undefined;
        const model = modelId
          ? mediaModels.find((m) => m.id === modelId)
          : mediaModels.find((m) => m.type === "video");

        if (!model) {
          throw new Error("No video model selected.");
        }

        const imageParamName = getImageInputParamName(model) || "image_url";
        const baseParams: Record<string, any> = { ...settings };
        delete baseParams.modelId;
        delete baseParams.sourceUrl;

        const parameters = {
          ...baseParams,
          [imageParamName]: image.src,
        };

        const endpoint = resolveModelEndpoint(model, true);

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
            parameters,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            errorText || `Image-to-video failed with status ${response.status}`,
          );
        }

        const payload = await response.json();
        const job = payload.job ?? payload;
        const status = (job?.status || job?.output?.status || "unknown")
          .toString()
          .toLowerCase();

        if (status !== "completed") {
          throw new Error(`Generation returned status: ${status}`);
        }

        const result = processGenerationResult(job);
        if (!result.success || result.assets.length === 0) {
          throw new Error(
            result.error || "Generation completed with no asset.",
          );
        }

        const assetUrl = result.assets[0].url;
        const duration =
          job?.result?.metadata?.duration ||
          job?.output?.result?.metadata?.duration ||
          5;

        const newVideo = convertImageToVideo(image, assetUrl, duration, false);
        newVideo.x = image.x + image.width + 20;
        newVideo.y = image.y;

        setVideos((prev) => [...prev, { ...newVideo, isVideo: true as const }]);
        saveToHistory();

        toast({
          title: "Video created",
          description: "Added next to the source image.",
        });

        closeImageToVideoDialog();
      } catch (error) {
        console.error("Error in image-to-video conversion:", error);
        toast({
          title: "Conversion failed",
          description:
            error instanceof Error
              ? error.message
              : "Failed to convert image to video",
          variant: "destructive",
        });
      } finally {
        setIsConvertingToVideo(false);
      }
    },
    [
      closeImageToVideoDialog,
      generationSettings.styleId,
      images,
      mediaModels,
      processGenerationResult,
      saveToHistory,
      selectedImageForVideo,
      setVideos,
      toast,
    ],
  );

  const handleVideoToVideoTransformation = useCallback(
    async (settings: VideoGenerationSettings) => {
      if (!selectedVideoForVideo) return;

      const video = videos.find((vid) => vid.id === selectedVideoForVideo);
      if (!video) return;

      try {
        setIsTransformingVideo(true);

        let videoUrl = video.src;
        if (videoUrl.startsWith("data:") || videoUrl.startsWith("blob:")) {
          videoUrl = videoUrl;
        }

        const generationId = `vid2vid_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          newMap.set(generationId, {
            ...settings,
            imageUrl: videoUrl,
            duration: video.duration || settings.duration || 5,
            modelId: settings.modelId || "seedance-pro",
            resolution: settings.resolution || "720p",
            isVideoToVideo: true,
            sourceVideoId: selectedVideoForVideo,
          });
          return newMap;
        });

        setIsVideoToVideoDialogOpen(false);

        let modelName = "Video Model";
        const modelId = settings.modelId;
        if (modelId) {
          const model = mediaModels.find((m) => m.id === modelId);
          if (model) {
            modelName = model.name;
          }
        }

        const toastId = toast({
          title: `Transforming video (${modelName} - ${
            settings.resolution || "Default"
          })`,
          description: "This may take a minute...",
          duration: Infinity,
        }).id;

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          const generation = newMap.get(generationId);
          if (generation) {
            newMap.set(generationId, {
              ...generation,
              toastId,
            });
          }
          return newMap;
        });
      } catch (error) {
        console.error("Error starting video-to-video transformation:", error);
        toast({
          title: "Transformation failed",
          description:
            error instanceof Error
              ? error.message
              : "Failed to start transformation",
          variant: "destructive",
        });
        setIsTransformingVideo(false);
      }
    },
    [
      mediaModels,
      selectedVideoForVideo,
      setActiveVideoGenerations,
      setIsVideoToVideoDialogOpen,
      toast,
      videos,
    ],
  );

  const handleVideoExtension = useCallback(
    async (settings: VideoGenerationSettings) => {
      if (!selectedVideoForExtend) return;

      const video = videos.find((vid) => vid.id === selectedVideoForExtend);
      if (!video) return;

      try {
        setIsExtendingVideo(true);

        let videoUrl = video.src;
        if (videoUrl.startsWith("data:") || videoUrl.startsWith("blob:")) {
          videoUrl = videoUrl;
        }

        const generationId = `vid_ext_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          newMap.set(generationId, {
            ...settings,
            imageUrl: videoUrl,
            duration: video.duration || settings.duration || 5,
            modelId: settings.modelId || "seedance-pro",
            resolution: settings.resolution || "720p",
            isVideoToVideo: true,
            isVideoExtension: true,
            sourceVideoId: selectedVideoForExtend,
          });
          return newMap;
        });

        setIsExtendVideoDialogOpen(false);

        let modelName = "Video Model";
        const modelId = settings.modelId;
        if (modelId) {
          const model = mediaModels.find((m) => m.id === modelId);
          if (model) {
            modelName = model.name;
          }
        }

        const toastId = toast({
          title: `Extending video (${modelName} - ${
            settings.resolution || "Default"
          })`,
          description: "This may take a minute...",
          duration: Infinity,
        }).id;

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          const generation = newMap.get(generationId);
          if (generation) {
            newMap.set(generationId, {
              ...generation,
              toastId,
            });
          }
          return newMap;
        });
      } catch (error) {
        console.error("Error starting video extension:", error);
        toast({
          title: "Extension failed",
          description:
            error instanceof Error
              ? error.message
              : "Failed to start video extension",
          variant: "destructive",
        });
        setIsExtendingVideo(false);
      }
    },
    [
      mediaModels,
      selectedVideoForExtend,
      setActiveVideoGenerations,
      setIsExtendVideoDialogOpen,
      toast,
      videos,
    ],
  );

  const handleVideoBackgroundRemoval = useCallback(
    async (backgroundColor: string) => {
      if (!selectedVideoForBackgroundRemoval) return;

      const video = videos.find(
        (vid) => vid.id === selectedVideoForBackgroundRemoval,
      );
      if (!video) return;

      try {
        setIsRemovingVideoBackground(true);
        setIsRemoveVideoBackgroundDialogOpen(false);

        let videoUrl = video.src;
        if (videoUrl.startsWith("data:") || videoUrl.startsWith("blob:")) {
          videoUrl = videoUrl;
        }

        const generationId = `bg_removal_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;

        const colorMap: Record<string, string> = {
          transparent: "Transparent",
          black: "Black",
          white: "White",
          gray: "Gray",
          red: "Red",
          green: "Green",
          blue: "Blue",
          yellow: "Yellow",
          cyan: "Cyan",
          magenta: "Magenta",
          orange: "Orange",
        };

        const apiBackgroundColor = colorMap[backgroundColor] || "Black";

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          newMap.set(generationId, {
            imageUrl: videoUrl,
            prompt: `Removing background from video`,
            duration: video.duration || 5,
            modelId: "bria-video-background-removal",
            modelConfig: mediaModels.find(
              (m) => m.id === "bria-video-background-removal",
            ),
            sourceVideoId: video.id,
            backgroundColor: apiBackgroundColor,
          });
          return newMap;
        });

        const toastId = toast({
          title: "Removing background from video",
          description: "This may take several minutes...",
          duration: Infinity,
        }).id;

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          const generation = newMap.get(generationId);
          if (generation) {
            newMap.set(generationId, {
              ...generation,
              toastId,
            });
          }
          return newMap;
        });
      } catch (error) {
        console.error("Error removing video background:", error);
        toast({
          title: "Error processing video",
          description:
            error instanceof Error ? error.message : "An error occurred",
          variant: "destructive",
        });

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          const generationId = Array.from(prev.keys()).find(
            (key) =>
              prev.get(key)?.sourceVideoId ===
              selectedVideoForBackgroundRemoval,
          );
          if (generationId) {
            newMap.delete(generationId);
          }
          return newMap;
        });
      }
    },
    [
      mediaModels,
      selectedVideoForBackgroundRemoval,
      setActiveVideoGenerations,
      setIsRemoveVideoBackgroundDialogOpen,
      toast,
      videos,
    ],
  );

  const handleVideoGenerationComplete = useCallback(
    async (videoId: string, videoUrl: string, duration: number) => {
      try {
        const generation = activeVideoGenerations.get(videoId);
        const sourceImageId =
          generation?.sourceImageId || selectedImageForVideo;
        const isBackgroundRemoval =
          generation?.modelId === "bria-video-background-removal";

        if (generation?.toastId) {
          const toastElement = document.querySelector(
            `[data-toast-id="${generation.toastId}"]`,
          );
          if (toastElement) {
            const closeButton = toastElement.querySelector(
              "[data-radix-toast-close]",
            );
            if (closeButton instanceof HTMLElement) {
              closeButton.click();
            }
          }
        }

        if (sourceImageId) {
          const image = images.find((img) => img.id === sourceImageId);
          if (image) {
            const video = convertImageToVideo(image, videoUrl, duration, false);

            video.x = image.x + image.width + 20;
            video.y = image.y;

            setVideos((prev) => [
              ...prev,
              { ...video, isVideo: true as const },
            ]);
            saveToHistory();

            toast({
              title: "Video created successfully",
              description:
                "The video has been added to the right of the source image.",
            });
          } else {
            console.error("Source image not found:", sourceImageId);
            toast({
              title: "Error creating video",
              description: "The source image could not be found.",
              variant: "destructive",
            });
          }
        } else if (generation?.sourceVideoId || generation?.isVideoToVideo) {
          const sourceVideoId =
            generation?.sourceVideoId ||
            selectedVideoForVideo ||
            selectedVideoForExtend;
          const isExtension = generation?.isVideoExtension;

          if (sourceVideoId) {
            const sourceVideo = videos.find((vid) => vid.id === sourceVideoId);
            if (sourceVideo) {
              const newVideo: PlacedVideo = {
                id: `video_${Date.now()}_${Math.random()
                  .toString(36)
                  .substring(7)}`,
                src: videoUrl,
                x: sourceVideo.x + sourceVideo.width + 20,
                y: sourceVideo.y,
                width: sourceVideo.width,
                height: sourceVideo.height,
                rotation: 0,
                isPlaying: false,
                currentTime: 0,
                duration: duration,
                volume: 1,
                muted: false,
                isLooping: false,
                isVideo: true as const,
              };

              setVideos((prev) => [...prev, newVideo]);
              saveToHistory();

              if (isExtension) {
                toast({
                  title: "Video extended successfully",
                  description:
                    "The extended video has been added to the right of the source video.",
                });
              } else if (
                generation?.modelId === "bria-video-background-removal"
              ) {
                toast({
                  title: "Background removed successfully",
                  description:
                    "The video with removed background has been added to the right of the source video.",
                });
              } else {
                toast({
                  title: "Video transformed successfully",
                  description:
                    "The transformed video has been added to the right of the source video.",
                });
              }
            } else {
              console.error("Source video not found:", sourceVideoId);
              toast({
                title: "Error creating video",
                description: "The source video could not be found.",
                variant: "destructive",
              });
            }
          }

          setIsTransformingVideo(false);
          setSelectedVideoForVideo(null);
          setIsExtendingVideo(false);
          setSelectedVideoForExtend(null);
        } else {
          console.log("Generated video URL:", videoUrl);
          toast({
            title: "Video generated",
            description: "Video is ready but cannot be placed on canvas yet.",
          });
        }

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          newMap.delete(videoId);
          return newMap;
        });

        if (isBackgroundRemoval) {
          setIsRemovingVideoBackground(false);
        } else {
          setIsConvertingToVideo(false);
          setSelectedImageForVideo(null);
        }
      } catch (error) {
        console.error("Error completing video generation:", error);

        toast({
          title: "Error creating video",
          description:
            error instanceof Error ? error.message : "Failed to create video",
          variant: "destructive",
        });

        setActiveVideoGenerations((prev) => {
          const newMap = new Map(prev);
          newMap.delete(videoId);
          return newMap;
        });

        setIsConvertingToVideo(false);
        setSelectedImageForVideo(null);
      }
    },
    [
      activeVideoGenerations,
      images,
      saveToHistory,
      selectedImageForVideo,
      selectedVideoForExtend,
      selectedVideoForVideo,
      setActiveVideoGenerations,
      setVideos,
      toast,
      videos,
    ],
  );

  const handleVideoGenerationError = useCallback(
    (videoId: string, error: string) => {
      console.error("Video generation error:", error);

      const generation = activeVideoGenerations.get(videoId);
      const isBackgroundRemoval =
        generation?.modelId === "bria-video-background-removal";

      toast({
        title: isBackgroundRemoval
          ? "Background removal failed"
          : "Video generation failed",
        description: error,
        variant: "destructive",
      });

      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(videoId);
        return newMap;
      });

      if (isBackgroundRemoval) {
        setIsRemovingVideoBackground(false);
      } else {
        setIsConvertingToVideo(false);
        setIsTransformingVideo(false);
        setIsExtendingVideo(false);
      }
    },
    [activeVideoGenerations, toast],
  );

  const handleVideoGenerationProgress = useCallback(
    (videoId: string, progress: number, status: string) => {
      console.log(`Video generation progress: ${progress}% - ${status}`);
    },
    [],
  );

  return {
    activeVideoGenerations,
    isImageToVideoDialogOpen,
    openImageToVideoDialog,
    closeImageToVideoDialog,
    isVideoToVideoDialogOpen,
    openVideoToVideoDialog,
    closeVideoToVideoDialog,
    isExtendVideoDialogOpen,
    openExtendVideoDialog,
    closeExtendVideoDialog,
    isRemoveVideoBackgroundDialogOpen,
    openRemoveVideoBackgroundDialog,
    closeRemoveVideoBackgroundDialog,
    isConvertingToVideo,
    isTransformingVideo,
    isExtendingVideo,
    isRemovingVideoBackground,
    selectedImageForVideo,
    selectedVideoForVideo,
    selectedVideoForExtend,
    selectedVideoForBackgroundRemoval,
    handleImageToVideoConversion,
    handleVideoToVideoTransformation,
    handleVideoExtension,
    handleVideoBackgroundRemoval,
    handleVideoGenerationComplete,
    handleVideoGenerationError,
    handleVideoGenerationProgress,
    setActiveVideoGenerations,
  };
}
