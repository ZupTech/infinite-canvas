"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { Stage, Layer, Rect, Group, Line } from "react-konva";
import Konva from "konva";
import { canvasStorage, type CanvasState } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  X,
  ChevronDown,
  Check,
  ImageIcon,
  Trash2,
  Undo,
  Redo,
  SlidersHorizontal,
  PlayIcon,
  Paperclip,
  MonitorIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SpinnerIcon } from "@/components/icons";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  Tooltip,
} from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMultiImageGeneration } from "@/hooks/useMultiImageGeneration";
import { useCanvasNavigation } from "@/hooks/useCanvasNavigation";

// Import extracted components
import { ShortcutBadge } from "@/components/canvas/ShortcutBadge";
import { StreamingImage } from "@/components/canvas/StreamingImage";
import { StreamingVideo } from "@/components/canvas/StreamingVideo";
import { CropOverlayWrapper } from "@/components/canvas/CropOverlayWrapper";
import { CanvasImage } from "@/components/canvas/CanvasImage";
import { CanvasVideo } from "@/components/canvas/CanvasVideo";
import { VideoControls } from "@/components/canvas/VideoControls";
import { ImageToVideoDialog } from "@/components/canvas/ImageToVideoDialog";
import { VideoToVideoDialog } from "@/components/canvas/VideoToVideoDialog";
import { ExtendVideoDialog } from "@/components/canvas/ExtendVideoDialog";
import { RemoveVideoBackgroundDialog } from "@/components/canvas/VideoModelComponents";

// Import types
import type {
  PlacedImage,
  PlacedVideo,
  HistoryState,
  GenerationSettings,
  VideoGenerationSettings,
  ActiveGeneration,
  ActiveVideoGeneration,
  SelectionBox,
} from "@/types/canvas";

import {
  imageToCanvasElement,
  videoToCanvasElement,
} from "@/utils/canvas-utils";
import { checkOS } from "@/utils/os-utils";
import { convertImageToVideo } from "@/utils/video-utils";

// Import additional extracted components
import { CanvasGrid } from "@/components/canvas/CanvasGrid";
import { SelectionBoxComponent } from "@/components/canvas/SelectionBox";
import { MiniMap } from "@/components/canvas/MiniMap";
import { ZoomControls } from "@/components/canvas/ZoomControls";
import { MobileToolbar } from "@/components/canvas/MobileToolbar";
import { PoweredByUniteBadge } from "@/components/canvas/PoweredByUniteBadge";
import { CanvasContextMenu } from "@/components/canvas/CanvasContextMenu";
import { useTheme } from "next-themes";
import { VideoOverlays } from "@/components/canvas/VideoOverlays";
import { DimensionDisplay } from "@/components/canvas/DimensionDisplay";
import { ModelDetailsDialog } from "@/components/canvas/ModelDetailsDialog";
import { ModelParametersButton } from "@/components/canvas/ModelParametersButton";
import { ModelSelectionDialog } from "@/components/canvas/ModelSelectionDialog";
import { GenerationForm } from "@/components/canvas/GenerationForm";

// Import handlers
import { handleRemoveBackground as handleRemoveBackgroundHandler } from "@/lib/handlers/background-handler";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import { createCanvasImagesFromAssets } from "@/utils/imageGeneration";
import {
  PLACEHOLDER_DATA_URI,
  shouldSkipStorage,
} from "@/utils/placeholder-utils";
import { useImageToImage } from "@/hooks/useImageToImage";
import { ensureRemoteAsset } from "@/utils/upload-media";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GenerationsIndicator } from "@/components/generations-indicator";
import {
  getImageInputParamName,
  resolveModelEndpoint,
  supportsImageInput,
  type MediaModel as UniteMediaModel,
} from "@/utils/model-utils";
import { getVideoModelById } from "@/lib/video-models";
import { MAX_CONCURRENT_GENERATIONS } from "@/utils/constants";

type MediaModelType = "image" | "video" | "upscale" | "audio" | "text";

type MediaModel = UniteMediaModel & {
  type: string;
  visible?: boolean;
};

interface ModelsResponse {
  ui?: Record<string, unknown>;
  models?: MediaModel[];
}

const DISPLAYABLE_MODEL_TYPES = ["image", "video", "audio", "upscale"] as const;

type DisplayableModelType = (typeof DISPLAYABLE_MODEL_TYPES)[number];

const isRenderableMediaUrl = (value?: string | null) =>
  typeof value === "string" &&
  (value.startsWith("http") || value.startsWith("/"));

const isVideoAsset = (value?: string | null) =>
  typeof value === "string" && /\.webm($|\?)/i.test(value);

const isDisplayableType = (type?: string): type is DisplayableModelType => {
  if (!type) {
    return false;
  }

  return DISPLAYABLE_MODEL_TYPES.includes(
    type.toLowerCase() as DisplayableModelType,
  );
};

export default function OverlayPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [images, setImages] = useState<PlacedImage[]>([]);
  const [videos, setVideos] = useState<PlacedVideo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [visibleIndicators, setVisibleIndicators] = useState<Set<string>>(
    new Set(),
  );
  const { toast, dismiss } = useToast();

  // Evita erro de hidratação com tema
  useEffect(() => {
    setMounted(true);
  }, []);

  const [generationSettings, setGenerationSettings] =
    useState<GenerationSettings>({
      prompt: "",
      loraUrl: "",
    });
  const [previousModelId, setPreviousModelId] = useState<string | null>(null);
  const [mediaModels, setMediaModels] = useState<MediaModel[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeGenerations, setActiveGenerations] = useState<
    Map<string, ActiveGeneration>
  >(new Map());
  const [activeVideoGenerations, setActiveVideoGenerations] = useState<
    Map<string, ActiveVideoGeneration>
  >(new Map());
  const [selectionBox, setSelectionBox] = useState<SelectionBox>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    visible: false,
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dragStartPositions, setDragStartPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [hiddenVideoControlsIds, setHiddenVideoControlsIds] = useState<
    Set<string>
  >(new Set());
  // Use a consistent initial value for server and client to avoid hydration errors
  const [canvasSize, setCanvasSize] = useState({
    width: 1200,
    height: 800,
  });
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const [croppingImageId, setCroppingImageId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });
  const stageRef = useRef<Konva.Stage>(null);
  const [isolateTarget, setIsolateTarget] = useState<string | null>(null);
  const [isolateInputValue, setIsolateInputValue] = useState("");
  const [isIsolating, setIsIsolating] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [isModelDetailsDialogOpen, setIsModelDetailsDialogOpen] =
    useState(false);
  const [selectedModelForDetails, setSelectedModelForDetails] =
    useState<MediaModel | null>(null);
  const [modelParameters, setModelParameters] = useState<Record<string, any>>(
    {},
  );

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
  const [_, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Touch event states for mobile
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(
    null,
  );
  const [lastTouchCenter, setLastTouchCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isTouchingImage, setIsTouchingImage] = useState(false);

  // Canvas navigation hook
  const { isPanMode, setPanMode, togglePanMode, fitToScreen } =
    useCanvasNavigation({
      canvasSize,
    });

  // Track when generation completes
  const [previousGenerationCount, setPreviousGenerationCount] = useState(0);

  useEffect(() => {
    const currentCount =
      activeGenerations.size +
      activeVideoGenerations.size +
      (isRemovingVideoBackground ? 1 : 0) +
      (isIsolating ? 1 : 0) +
      (isExtendingVideo ? 1 : 0) +
      (isTransformingVideo ? 1 : 0);

    // If we went from having generations to having none, show success
    if (previousGenerationCount > 0 && currentCount === 0) {
      setShowSuccess(true);
      // Hide success after 2 seconds
      const timeout = setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }

    setPreviousGenerationCount(currentCount);
  }, [
    activeGenerations.size,
    activeVideoGenerations.size,
    isGenerating,
    isRemovingVideoBackground,
    isIsolating,
    isExtendingVideo,
    isTransformingVideo,
    previousGenerationCount,
  ]);

  const trpc = useTRPC();

  // Direct FAL upload function using proxy

  const { mutateAsync: removeBackground } = useMutation(
    trpc.removeBackground.mutationOptions(),
  );

  // Function to handle the "Convert to Video" option in the context menu
  const handleConvertToVideo = (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;

    setSelectedImageForVideo(imageId);
    setIsImageToVideoDialogOpen(true);
  };

  // Function to handle the image-to-video conversion
  const handleImageToVideoConversion = async (
    settings: VideoGenerationSettings,
  ) => {
    if (!selectedImageForVideo) return;

    const image = images.find((img) => img.id === selectedImageForVideo);
    if (!image) return;

    let toastId: string | undefined;
    // Create a unique ID for this generation
    const generationId = `img2vid_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      setIsConvertingToVideo(true);

      // Ensure the image is available via a remote URL
      let imageUrl = image.uploadedUrl || image.src;
      if (!/^https?:\/\//i.test(imageUrl)) {
        const { url } = await ensureRemoteAsset(imageUrl, {
          filename: `${image.id}.png`,
          existingUrl: image.uploadedUrl ?? null,
        });

        imageUrl = url;

        if (image.uploadedUrl !== url) {
          setImages((prev) =>
            prev.map((img) =>
              img.id === image.id ? { ...img, uploadedUrl: url } : img,
            ),
          );
        }
      }

      const modelId = settings.modelId || settings.styleId;
      const model = modelId
        ? mediaModels.find(
            (candidate) =>
              candidate.id === modelId || candidate.modelId === modelId,
          )
        : mediaModels.find(
            (candidate) =>
              candidate.type === "video" && supportsImageInput(candidate),
          );

      if (!model) {
        throw new Error("Selected video model is no longer available.");
      }

      const hasImageInput = supportsImageInput(model);
      const resolvedEndpoint = model.endpoint
        ? model.endpoint
        : resolveModelEndpoint(model, hasImageInput);

      const parameters: Record<string, any> = {
        ...settings,
        sourceImageId: selectedImageForVideo,
      };

      delete parameters.modelId;
      delete parameters.styleId;
      delete parameters.sourceUrl;

      const imageParamName = getImageInputParamName(model);
      if (imageParamName) {
        const paramDefinition = model.parameters?.find(
          (param) => param.name === imageParamName,
        );
        const expectsArray = paramDefinition?.type === "multifile";
        parameters[imageParamName] = expectsArray ? [imageUrl] : imageUrl;
      } else {
        parameters.imageUrl = imageUrl;
        parameters.image_urls = Array.isArray(parameters.image_urls)
          ? parameters.image_urls
          : [imageUrl];
      }

      if (typeof parameters.duration === "string") {
        const parsed = Number(parameters.duration);
        if (!Number.isNaN(parsed)) {
          parameters.duration = parsed;
        }
      }

      if (typeof parameters.seed === "string") {
        const parsedSeed = Number(parameters.seed);
        if (!Number.isNaN(parsedSeed)) {
          parameters.seed = parsedSeed;
        }
      }

      // Add to active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.set(generationId, {
          imageUrl,
          prompt: settings.prompt || "",
          duration:
            typeof parameters.duration === "number"
              ? parameters.duration
              : settings.duration || 5,
          modelId: model.id,
          modelConfig: model,
          resolution:
            (typeof parameters.resolution === "string"
              ? (parameters.resolution as "480p" | "720p" | "1080p")
              : settings.resolution) || "720p",
          cameraFixed:
            typeof parameters.cameraFixed === "boolean"
              ? parameters.cameraFixed
              : settings.cameraFixed,
          seed:
            typeof parameters.seed === "number"
              ? parameters.seed
              : typeof settings.seed === "number"
                ? settings.seed
                : undefined,
          sourceImageId: selectedImageForVideo,
          status: "queued",
        });
        return newMap;
      });

      toastId = toast({
        title: `Convertendo imagem para vídeo (${model.name || "Modelo de Vídeo"})`,
        description: "Isso pode levar um minuto...",
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

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          modelId: model.id,
          endpoint: resolvedEndpoint,
          parameters,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          errorText ||
            `Video generation request failed with status ${response.status}`,
        );
      }

      const payload = await response.json();
      const job = payload.job ?? payload;
      const realtime = payload.realtime ?? {};
      const runId = job?.runId || realtime.runId || job?.id;
      const status =
        job?.status || job?.output?.status || job?.output?.state || "queued";

      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generation = newMap.get(generationId);
        if (generation) {
          newMap.set(generationId, {
            ...generation,
            jobId: job?.id,
            runId,
            status,
            realtimeToken: realtime.token ?? null,
            resultUrl:
              job?.result?.videoUrl ||
              job?.output?.result?.videoUrl ||
              generation.resultUrl,
          });
        }
        return newMap;
      });

      // Clear the converting flag since it's now tracked in activeVideoGenerations
      setIsConvertingToVideo(false);

      // Close the dialog
      setIsImageToVideoDialogOpen(false);
    } catch (error) {
      console.error("Error starting image-to-video conversion:", error);
      if (toastId) {
        dismiss(toastId);
      }
      toast({
        title: "Falha na conversão",
        description:
          error instanceof Error
            ? error.message
            : "Falha ao iniciar a conversão",
        variant: "destructive",
      });
      setActiveVideoGenerations((prev) => {
        const next = new Map(prev);
        next.delete(generationId);
        return next;
      });
      setIsConvertingToVideo(false);
    }
  };

  // Function to handle the "Video to Video" option in the context menu
  const handleVideoToVideo = (videoId: string) => {
    const video = videos.find((vid) => vid.id === videoId);
    if (!video) return;

    setSelectedVideoForVideo(videoId);
    setIsVideoToVideoDialogOpen(true);
  };

  // Function to handle the video-to-video transformation
  const handleVideoToVideoTransformation = async (
    settings: VideoGenerationSettings,
  ) => {
    if (!selectedVideoForVideo) return;

    const video = videos.find((vid) => vid.id === selectedVideoForVideo);
    if (!video) return;

    let toastId: string | undefined;
    // Create a unique ID for this generation
    const generationId = `vid2vid_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      setIsTransformingVideo(true);

      // Upload video if it's not already accessible via HTTP
      let videoUrl = video.uploadedUrl || video.src;
      if (!/^https?:\/\//i.test(videoUrl)) {
        const { url } = await ensureRemoteAsset(videoUrl, {
          filename: `${video.id}.mp4`,
          existingUrl: video.uploadedUrl ?? null,
        });

        videoUrl = url;

        if (video.uploadedUrl !== url) {
          setVideos((prev) =>
            prev.map((vid) =>
              vid.id === video.id ? { ...vid, uploadedUrl: url } : vid,
            ),
          );
        }
      }

      // Add to active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.set(generationId, {
          ...settings, // Include all settings first
          imageUrl: videoUrl, // Using imageUrl field for video URL
          duration: video.duration || settings.duration || 5,
          modelId: settings.modelId || "seedance-pro",
          resolution: settings.resolution || "720p",
          isVideoToVideo: true,
          sourceVideoId: selectedVideoForVideo,
          status: "queued",
        });
        return newMap;
      });

      // Close the dialog
      setIsVideoToVideoDialogOpen(false);

      // Get video model name for toast display
      let modelName = "Video Model";
      const modelId = settings.modelId || "seedance-pro";
      const { getVideoModelById } = await import("@/lib/video-models");
      const model = getVideoModelById(modelId);
      if (model) {
        modelName = model.name;
      }

      // Create a persistent toast
      toastId = toast({
        title: `Transformando vídeo (${modelName} - ${settings.resolution || "Padrão"})`,
        description: "Isso pode levar um minuto...",
        duration: Infinity,
      }).id;

      // Store the toast ID with the generation
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

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          modelId: modelId,
          endpoint: model?.endpoint,
          parameters: {
            ...settings,
            imageUrl: videoUrl,
            sourceVideoId: selectedVideoForVideo,
            isVideoToVideo: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          errorText ||
            `Video transformation request failed with status ${response.status}`,
        );
      }

      const payload = await response.json();
      const job = payload.job ?? payload;
      const realtime = payload.realtime ?? {};
      const runId = job?.runId || realtime.runId || job?.id;
      const status =
        job?.status || job?.output?.status || job?.output?.state || "queued";

      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generation = newMap.get(generationId);
        if (generation) {
          newMap.set(generationId, {
            ...generation,
            jobId: job?.id,
            runId,
            status,
            realtimeToken: realtime.token ?? null,
            resultUrl:
              job?.result?.videoUrl ||
              job?.output?.result?.videoUrl ||
              generation.resultUrl,
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error("Error starting video-to-video transformation:", error);
      if (toastId) {
        dismiss(toastId);
      }
      toast({
        title: "Falha na transformação",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start transformation",
        variant: "destructive",
      });
      setActiveVideoGenerations((prev) => {
        const next = new Map(prev);
        next.delete(generationId);
        return next;
      });
      setIsTransformingVideo(false);
    }
  };

  // Function to handle the "Extend Video" option in the context menu
  const handleExtendVideo = (videoId: string) => {
    const video = videos.find((vid) => vid.id === videoId);
    if (!video) return;

    setSelectedVideoForExtend(videoId);
    setIsExtendVideoDialogOpen(true);
  };

  // Function to handle the video extension
  const handleVideoExtension = async (settings: VideoGenerationSettings) => {
    if (!selectedVideoForExtend) return;

    const video = videos.find((vid) => vid.id === selectedVideoForExtend);
    if (!video) return;

    let toastId: string | undefined;
    // Create a unique ID for this generation
    const generationId = `vid_ext_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      setIsExtendingVideo(true);

      // Upload video if it's not already accessible via HTTP
      let videoUrl = video.uploadedUrl || video.src;
      if (!/^https?:\/\//i.test(videoUrl)) {
        const { url } = await ensureRemoteAsset(videoUrl, {
          filename: `${video.id}.mp4`,
          existingUrl: video.uploadedUrl ?? null,
        });

        videoUrl = url;

        if (video.uploadedUrl !== url) {
          setVideos((prev) =>
            prev.map((vid) =>
              vid.id === video.id ? { ...vid, uploadedUrl: url } : vid,
            ),
          );
        }
      }

      // Add to active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.set(generationId, {
          ...settings, // Include all settings first
          imageUrl: videoUrl, // Using imageUrl field for video URL
          duration: video.duration || settings.duration || 5,
          modelId: settings.modelId || "seedance-pro",
          resolution: settings.resolution || "720p",
          isVideoToVideo: true,
          isVideoExtension: true,
          sourceVideoId: selectedVideoForExtend,
          status: "queued",
        });
        return newMap;
      });

      // Close the dialog
      setIsExtendVideoDialogOpen(false);

      // Get video model name for toast display
      let modelName = "Video Model";
      const modelId = settings.modelId || "seedance-pro";
      const { getVideoModelById } = await import("@/lib/video-models");
      const model = getVideoModelById(modelId);
      if (model) {
        modelName = model.name;
      }

      // Create a persistent toast
      toastId = toast({
        title: `Estendendo vídeo (${modelName} - ${settings.resolution || "Padrão"})`,
        description: "Isso pode levar um minuto...",
        duration: Infinity,
      }).id;

      // Store the toast ID with the generation
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

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          modelId: modelId,
          endpoint: model?.endpoint,
          parameters: {
            ...settings,
            imageUrl: videoUrl,
            sourceVideoId: selectedVideoForExtend,
            isVideoToVideo: true,
            isVideoExtension: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          errorText ||
            `Video extension request failed with status ${response.status}`,
        );
      }

      const payload = await response.json();
      const job = payload.job ?? payload;
      const realtime = payload.realtime ?? {};
      const runId = job?.runId || realtime.runId || job?.id;
      const status =
        job?.status || job?.output?.status || job?.output?.state || "queued";

      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generation = newMap.get(generationId);
        if (generation) {
          newMap.set(generationId, {
            ...generation,
            jobId: job?.id,
            runId,
            status,
            realtimeToken: realtime.token ?? null,
            resultUrl:
              job?.result?.videoUrl ||
              job?.output?.result?.videoUrl ||
              generation.resultUrl,
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error("Error starting video extension:", error);
      if (toastId) {
        dismiss(toastId);
      }
      toast({
        title: "Falha ao estender",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start video extension",
        variant: "destructive",
      });
      setActiveVideoGenerations((prev) => {
        const next = new Map(prev);
        next.delete(generationId);
        return next;
      });
      setIsExtendingVideo(false);
    }
  };

  // Function to handle video generation completion
  const handleVideoGenerationComplete = async (
    videoId: string,
    videoUrl: string,
    duration: number,
  ) => {
    try {
      console.log("Video generation complete:", {
        videoId,
        videoUrl,
        duration,
      });

      // Get the generation data to check for source image ID
      const generation = activeVideoGenerations.get(videoId);
      const sourceImageId = generation?.sourceImageId || selectedImageForVideo;
      const isBackgroundRemoval =
        generation?.modelId === "bria-video-background-removal";

      // Dismiss progress toast if it exists
      if (generation?.toastId) {
        const toastElement = document.querySelector(
          `[data-toast-id="${generation.toastId}"]`,
        );
        if (toastElement) {
          // Trigger dismiss by clicking the close button
          const closeButton = toastElement.querySelector(
            "[data-radix-toast-close]",
          );
          if (closeButton instanceof HTMLElement) {
            closeButton.click();
          }
        }
      }

      // Find the original image if this was an image-to-video conversion
      if (sourceImageId) {
        const image = images.find((img) => img.id === sourceImageId);
        if (image) {
          // Create a video element based on the original image
          const video = convertImageToVideo(
            image,
            videoUrl,
            duration,
            false, // Don't replace the original image
          );

          // Position the video to the right of the source image
          // Add a small gap between the image and video (20px)
          video.x = image.x + image.width + 20;
          video.y = image.y; // Keep the same vertical position

          // Add the video to the videos state
          setVideos((prev) => [
            ...prev,
            { ...video, isVideo: true as const, uploadedUrl: videoUrl },
          ]);

          // Save to history
          saveToHistory();

          // Show success toast
          toast({
            title: "Vídeo criado com sucesso",
            description:
              "O vídeo foi adicionado à direita da imagem de origem.",
          });
        } else {
          console.error("Source image not found:", sourceImageId);
          toast({
            title: "Erro ao criar vídeo",
            description: "A imagem de origem não foi encontrada.",
            variant: "destructive",
          });
        }
      } else if (generation?.sourceVideoId || generation?.isVideoToVideo) {
        // This was a video-to-video transformation or extension
        const sourceVideoId =
          generation?.sourceVideoId ||
          selectedVideoForVideo ||
          selectedVideoForExtend;
        const isExtension = generation?.isVideoExtension;

        if (sourceVideoId) {
          const sourceVideo = videos.find((vid) => vid.id === sourceVideoId);
          if (sourceVideo) {
            // Create a new video based on the source video
            const newVideo: PlacedVideo = {
              id: `video_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              src: videoUrl,
              x: sourceVideo.x + sourceVideo.width + 20, // Position to the right
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
              uploadedUrl: videoUrl,
            };

            // Add the transformed video to the canvas
            setVideos((prev) => [...prev, newVideo]);

            // Save to history
            saveToHistory();

            if (isExtension) {
              toast({
                title: "Vídeo estendido com sucesso",
                description:
                  "O vídeo estendido foi adicionado à direita do vídeo de origem.",
              });
            } else if (
              generation?.modelId === "bria-video-background-removal"
            ) {
              toast({
                title: "Fundo removido com sucesso",
                description:
                  "O vídeo com fundo removido foi adicionado à direita do vídeo de origem.",
              });
            } else {
              toast({
                title: "Vídeo transformado com sucesso",
                description:
                  "O vídeo transformado foi adicionado à direita do vídeo de origem.",
              });
            }
          } else {
            console.error("Source video not found:", sourceVideoId);
            toast({
              title: "Erro ao criar vídeo",
              description: "O vídeo de origem não foi encontrado.",
              variant: "destructive",
            });
          }
        }

        // Reset the transformation/extension state
        setIsTransformingVideo(false);
        setSelectedVideoForVideo(null);
        setIsExtendingVideo(false);
        setSelectedVideoForExtend(null);
      } else {
        // This was a text-to-video generation
        // For now, just log it as the placement function is missing
        console.log("Generated video URL:", videoUrl);
        toast({
          title: "Vídeo gerado",
          description:
            "Vídeo está pronto mas ainda não pode ser colocado no canvas.",
        });
      }

      // Remove from active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(videoId);
        return newMap;
      });

      // Reset appropriate flags based on generation type
      if (isBackgroundRemoval) {
        setIsRemovingVideoBackground(false);
      } else {
        setIsConvertingToVideo(false);
        setSelectedImageForVideo(null);
      }
    } catch (error) {
      console.error("Error completing video generation:", error);

      toast({
        title: "Erro ao criar vídeo",
        description:
          error instanceof Error ? error.message : "Falha ao criar vídeo",
        variant: "destructive",
      });

      // Remove from active generations even on error
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(videoId);
        return newMap;
      });

      setIsConvertingToVideo(false);
      setSelectedImageForVideo(null);
    }
  };

  // Function to handle video generation errors
  const handleVideoGenerationError = (videoId: string, error: string) => {
    console.error("Video generation error:", error);

    // Check if this was a background removal
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

    // Remove from active generations
    setActiveVideoGenerations((prev) => {
      const newMap = new Map(prev);
      newMap.delete(videoId);
      return newMap;
    });

    // Reset appropriate flags
    if (isBackgroundRemoval) {
      setIsRemovingVideoBackground(false);
    } else {
      setIsConvertingToVideo(false);
      setIsTransformingVideo(false);
      setIsExtendingVideo(false);
    }
  };

  // Function to handle video generation progress
  const handleVideoGenerationProgress = (
    videoId: string,
    progress: number,
    status: string,
  ) => {
    // You could update a progress indicator here if needed
    console.log(`Video generation progress: ${progress}% - ${status}`);
  };

  const { mutateAsync: isolateObject } = useMutation(
    trpc.isolateObject.mutationOptions(),
  );

  // Save current state to storage
  const saveToStorage = useCallback(async () => {
    try {
      setIsSaving(true);

      // Save canvas state (positions, transforms, etc.)
      const canvasState: CanvasState = {
        elements: [
          ...images.map(imageToCanvasElement),
          ...videos.map(videoToCanvasElement),
        ],
        backgroundColor: "#ffffff",
        lastModified: Date.now(),
        viewport: viewport,
      };
      canvasStorage.saveCanvasState(canvasState);

      // Save actual image data to IndexedDB
      for (const image of images) {
        // Skip if it's a placeholder for generation
        if (shouldSkipStorage(image.src)) continue;

        // Check if we already have this image stored
        const existingImage = await canvasStorage.getImage(image.id);
        if (!existingImage) {
          await canvasStorage.saveImage(image.src, image.id);
        }
      }

      // Save video data to IndexedDB
      for (const video of videos) {
        // Skip if it's a placeholder for generation
        if (shouldSkipStorage(video.src)) continue;

        // Check if we already have this video stored
        const existingVideo = await canvasStorage.getVideo(video.id);
        if (!existingVideo) {
          await canvasStorage.saveVideo(video.src, video.duration, video.id);
        }
      }

      // Clean up unused images and videos
      await canvasStorage.cleanupOldData();

      // Brief delay to show the indicator
      setTimeout(() => setIsSaving(false), 300);
    } catch (error) {
      console.error("Failed to save to storage:", error);
      setIsSaving(false);
    }
  }, [images, videos, viewport]);

  const multiImageHandlers = useMultiImageGeneration({
    activeGenerations,
    setActiveGenerations,
    setImages,
    setSelectedIds,
    setIsGenerating,
    saveToStorage,
    viewport,
    canvasSize,
  });

  // Load state from storage
  const loadFromStorage = useCallback(async () => {
    try {
      const canvasState = canvasStorage.getCanvasState();
      if (!canvasState) {
        setIsStorageLoaded(true);
        return;
      }

      const loadedImages: PlacedImage[] = [];
      const loadedVideos: PlacedVideo[] = [];

      for (const element of canvasState.elements) {
        if (element.type === "image" && element.imageId) {
          const imageData = await canvasStorage.getImage(element.imageId);
          if (imageData) {
            loadedImages.push({
              id: element.id,
              src: imageData.originalDataUrl,
              x: element.transform.x,
              y: element.transform.y,
              width: element.width || 300,
              height: element.height || 300,
              rotation: element.transform.rotation,
              ...(element.transform.cropBox && {
                cropX: element.transform.cropBox.x,
                cropY: element.transform.cropBox.y,
                cropWidth: element.transform.cropBox.width,
                cropHeight: element.transform.cropBox.height,
              }),
            });
          }
        } else if (element.type === "video" && element.videoId) {
          const videoData = await canvasStorage.getVideo(element.videoId);
          if (videoData) {
            loadedVideos.push({
              id: element.id,
              src: videoData.originalDataUrl,
              x: element.transform.x,
              y: element.transform.y,
              width: element.width || 300,
              height: element.height || 300,
              rotation: element.transform.rotation,
              isVideo: true,
              duration: element.duration || videoData.duration,
              currentTime: element.currentTime || 0,
              isPlaying: element.isPlaying || false,
              volume: element.volume || 1,
              muted: element.muted || false,
              isLoaded: false, // Initialize as not loaded
              ...(element.transform.cropBox && {
                cropX: element.transform.cropBox.x,
                cropY: element.transform.cropBox.y,
                cropWidth: element.transform.cropBox.width,
                cropHeight: element.transform.cropBox.height,
              }),
            });
          }
        }
      }

      // Set loaded images and videos
      if (loadedImages.length > 0) {
        setImages(loadedImages);
      }

      if (loadedVideos.length > 0) {
        setVideos(loadedVideos);
      }

      // Restore viewport if available
      if (canvasState.viewport) {
        setViewport(canvasState.viewport);
      }
    } catch (error) {
      console.error("Failed to load from storage:", error);
      toast({
        title: "Falha ao restaurar canvas",
        description: "Começando com um canvas novo",
        variant: "destructive",
      });
    } finally {
      setIsStorageLoaded(true);
    }
  }, [toast]);

  // Load grid setting from localStorage on mount
  useEffect(() => {
    const savedShowGrid = localStorage.getItem("showGrid");
    if (savedShowGrid !== null) {
      setShowGrid(savedShowGrid === "true");
    }
  }, []);

  // Load minimap setting from localStorage on mount
  useEffect(() => {
    const savedShowMinimap = localStorage.getItem("showMinimap");
    if (savedShowMinimap !== null) {
      setShowMinimap(savedShowMinimap === "true");
    }
  }, []);

  // Save grid setting to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("showGrid", showGrid.toString());
  }, [showGrid]);

  // Save minimap setting to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("showMinimap", showMinimap.toString());
  }, [showMinimap]);

  // Fetch available media models from the current domain
  useEffect(() => {
    let isMounted = true;

    const fetchModels = async () => {
      try {
        setIsModelsLoading(true);
        setModelsError(null);

        const endpoint = "/api/models";

        const response = await fetch(endpoint, {
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
          .filter((model) => model.visible && isDisplayableType(model.type))
          .filter((model) => !["cacilds", "black-princess"].includes(model.id));

        if (!isMounted) {
          return;
        }

        setMediaModels(visibleModels);

        if (visibleModels.length > 0) {
          const preferredModel =
            visibleModels.find((model) => model.featured) || visibleModels[0];

          setGenerationSettings((prev) => {
            if (prev.styleId) {
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
  }, [setGenerationSettings]);

  const selectedMediaModel = useMemo(() => {
    if (!generationSettings.styleId) {
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

  // Track previous model when changing models
  useEffect(() => {
    const currentModelId = generationSettings.styleId;
    if (currentModelId && currentModelId !== previousModelId) {
      setPreviousModelId(currentModelId);
    }
  }, [generationSettings.styleId, previousModelId]);

  // Save state to history
  const saveToHistory = useCallback(() => {
    const newState = {
      images: [...images],
      videos: [...videos],
      selectedIds: [...selectedIds],
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [images, videos, selectedIds, history, historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setImages(prevState.images);
      setVideos(prevState.videos || []);
      setSelectedIds(prevState.selectedIds);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setImages(nextState.images);
      setVideos(nextState.videos || []);
      setSelectedIds(nextState.selectedIds);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Save initial state
  useEffect(() => {
    if (history.length === 0) {
      saveToHistory();
    }
  }, []);

  // Set canvas ready state after mount
  useEffect(() => {
    // Only set canvas ready after we have valid dimensions
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      setIsCanvasReady(true);
    }
  }, [canvasSize]);

  // Update canvas size on window resize
  useEffect(() => {
    const updateCanvasSize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    updateCanvasSize();

    // Update on resize
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  // Prevent body scrolling on mobile
  useEffect(() => {
    // Prevent scrolling on mobile
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    };
  }, []);

  // Load from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Auto-save to storage when images change (with debounce)
  useEffect(() => {
    if (!isStorageLoaded) return; // Don't save until we've loaded
    if (activeGenerations.size > 0) return;

    const timeoutId = setTimeout(() => {
      saveToStorage();
    }, 1000); // Save after 1 second of no changes

    return () => clearTimeout(timeoutId);
  }, [
    images,
    viewport,
    isStorageLoaded,
    saveToStorage,
    activeGenerations.size,
  ]);

  // Load default images only if no saved state
  useEffect(() => {
    if (!isStorageLoaded) return;
    if (images.length > 0) return; // Already have images from storage

    const loadDefaultImages = async () => {
      const defaultImagePaths = [
        "/hat.png",
        "/man.png",
        "/og-img-compress.png",
        "/chad.png",
        "/anime.png",
        "/cat.jpg",
        "/overlay.png",
      ];
      const loadedImages: PlacedImage[] = [];

      for (let i = 0; i < defaultImagePaths.length; i++) {
        const path = defaultImagePaths[i];
        try {
          const response = await fetch(path);
          const blob = await response.blob();
          const reader = new FileReader();

          reader.onload = (e) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous"; // Enable CORS
            img.onload = () => {
              const id = `default-${path.replace("/", "").replace(".png", "")}-${Date.now()}`;
              const aspectRatio = img.width / img.height;
              const maxSize = 200;
              let width = maxSize;
              let height = maxSize / aspectRatio;

              if (height > maxSize) {
                height = maxSize;
                width = maxSize * aspectRatio;
              }

              // Position images in a row at center of viewport
              const spacing = 250;
              const totalWidth = spacing * (defaultImagePaths.length - 1);
              const viewportCenterX = canvasSize.width / 2;
              const viewportCenterY = canvasSize.height / 2;
              const startX = viewportCenterX - totalWidth / 2;
              const x = startX + i * spacing - width / 2;
              const y = viewportCenterY - height / 2;

              setImages((prev) => [
                ...prev,
                {
                  id,
                  src: e.target?.result as string,
                  x,
                  y,
                  width,
                  height,
                  rotation: 0,
                },
              ]);
            };
            img.src = e.target?.result as string;
          };

          reader.readAsDataURL(blob);
        } catch (error) {
          console.error(`Failed to load default image ${path}:`, error);
        }
      }
    };

    loadDefaultImages();
  }, [isStorageLoaded, images.length]);

  // Helper function to resize image if too large
  const resizeImageIfNeeded = async (
    dataUrl: string,
    maxWidth: number = 2048,
    maxHeight: number = 2048,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Check if resize is needed
        if (img.width <= maxWidth && img.height <= maxHeight) {
          resolve(dataUrl);
          return;
        }

        // Calculate new dimensions
        let newWidth = img.width;
        let newHeight = img.height;
        const aspectRatio = img.width / img.height;

        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = newWidth / aspectRatio;
        }
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = newHeight * aspectRatio;
        }

        // Create canvas and resize
        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Convert to data URL with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.9, // 90% quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
  };

  // Helper function to create a cropped image
  const createCroppedImage = async (
    imageSrc: string,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous"; // Enable CORS
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Set canvas size to the natural cropped dimensions
        canvas.width = cropWidth * img.naturalWidth;
        canvas.height = cropHeight * img.naturalHeight;

        // Draw the cropped portion at full resolution
        ctx.drawImage(
          img,
          cropX * img.naturalWidth,
          cropY * img.naturalHeight,
          cropWidth * img.naturalWidth,
          cropHeight * img.naturalHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        // Convert to data URL
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to create blob"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageSrc;
    });
  };

  // Handle file upload
  const handleFileUpload = (
    files: FileList | null,
    position?: { x: number; y: number },
  ) => {
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const id = `img-${Date.now()}-${Math.random()}`;
          const img = new window.Image();
          img.crossOrigin = "anonymous"; // Enable CORS
          img.onload = () => {
            const aspectRatio = img.width / img.height;
            const maxSize = 300;
            let width = maxSize;
            let height = maxSize / aspectRatio;

            if (height > maxSize) {
              height = maxSize;
              width = maxSize * aspectRatio;
            }

            // Place image at position or center of current viewport
            let x, y;
            if (position) {
              // Convert screen position to canvas coordinates
              x = (position.x - viewport.x) / viewport.scale - width / 2;
              y = (position.y - viewport.y) / viewport.scale - height / 2;
            } else {
              // Center of viewport
              const viewportCenterX =
                (canvasSize.width / 2 - viewport.x) / viewport.scale;
              const viewportCenterY =
                (canvasSize.height / 2 - viewport.y) / viewport.scale;
              x = viewportCenterX - width / 2;
              y = viewportCenterY - height / 2;
            }

            // Add offset for multiple files
            if (index > 0) {
              x += index * 20;
              y += index * 20;
            }

            setImages((prev) => [
              ...prev,
              {
                id,
                src: e.target?.result as string,
                x,
                y,
                width,
                height,
                rotation: 0,
              },
            ]);
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    // Get drop position relative to the stage
    const stage = stageRef.current;
    if (stage) {
      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const dropPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      handleFileUpload(e.dataTransfer.files, dropPosition);
    } else {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Handle wheel for zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    // Check if this is a pinch gesture (ctrl key is pressed on trackpad pinch)
    if (e.evt.ctrlKey) {
      // This is a pinch-to-zoom gesture
      const oldScale = viewport.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldScale,
        y: (pointer.y - viewport.y) / oldScale,
      };

      // Zoom based on deltaY (negative = zoom in, positive = zoom out)
      const scaleBy = 1.01;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const steps = Math.min(Math.abs(e.evt.deltaY), 10);
      let newScale = oldScale;

      for (let i = 0; i < steps; i++) {
        newScale = direction > 0 ? newScale * scaleBy : newScale / scaleBy;
      }

      // Limit zoom (10% to 500%)
      const scale = Math.max(0.1, Math.min(5, newScale));

      const newPos = {
        x: pointer.x - mousePointTo.x * scale,
        y: pointer.y - mousePointTo.y * scale,
      };

      setViewport({ x: newPos.x, y: newPos.y, scale });
    } else {
      // This is a pan gesture (two-finger swipe on trackpad or mouse wheel)
      const deltaX = e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX;
      const deltaY = e.evt.shiftKey ? 0 : e.evt.deltaY;

      // Invert the direction to match natural scrolling
      setViewport((prev) => ({
        ...prev,
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));
    }
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    const stage = stageRef.current;

    if (touches.length === 2) {
      // Two fingers - prepare for pinch-to-zoom
      const touch1 = { x: touches[0].clientX, y: touches[0].clientY };
      const touch2 = { x: touches[1].clientX, y: touches[1].clientY };

      const distance = Math.sqrt(
        Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2),
      );

      const center = {
        x: (touch1.x + touch2.x) / 2,
        y: (touch1.y + touch2.y) / 2,
      };

      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    } else if (touches.length === 1) {
      // Single finger - check if touching an image
      const touch = { x: touches[0].clientX, y: touches[0].clientY };

      // Check if we're touching an image
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) {
          const canvasPos = {
            x: (pos.x - viewport.x) / viewport.scale,
            y: (pos.y - viewport.y) / viewport.scale,
          };

          // Check if touch is on any image
          const touchedImage = images.some((img) => {
            return (
              canvasPos.x >= img.x &&
              canvasPos.x <= img.x + img.width &&
              canvasPos.y >= img.y &&
              canvasPos.y <= img.y + img.height
            );
          });

          setIsTouchingImage(touchedImage);
        }
      }

      setLastTouchCenter(touch);
    }
  };

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;

    if (touches.length === 2 && lastTouchDistance && lastTouchCenter) {
      // Two fingers - handle pinch-to-zoom
      e.evt.preventDefault();

      const touch1 = { x: touches[0].clientX, y: touches[0].clientY };
      const touch2 = { x: touches[1].clientX, y: touches[1].clientY };

      const distance = Math.sqrt(
        Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2),
      );

      const center = {
        x: (touch1.x + touch2.x) / 2,
        y: (touch1.y + touch2.y) / 2,
      };

      // Calculate scale change
      const scaleFactor = distance / lastTouchDistance;
      const newScale = Math.max(0.1, Math.min(5, viewport.scale * scaleFactor));

      // Calculate new position to zoom towards pinch center
      const stage = stageRef.current;
      if (stage) {
        const stageBox = stage.container().getBoundingClientRect();
        const stageCenter = {
          x: center.x - stageBox.left,
          y: center.y - stageBox.top,
        };

        const mousePointTo = {
          x: (stageCenter.x - viewport.x) / viewport.scale,
          y: (stageCenter.y - viewport.y) / viewport.scale,
        };

        const newPos = {
          x: stageCenter.x - mousePointTo.x * newScale,
          y: stageCenter.y - mousePointTo.y * newScale,
        };

        setViewport({ x: newPos.x, y: newPos.y, scale: newScale });
      }

      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    } else if (
      touches.length === 1 &&
      lastTouchCenter &&
      !isSelecting &&
      !isDraggingImage &&
      !isTouchingImage
    ) {
      // Single finger - handle pan (only if not selecting, dragging, or touching an image)
      // Don't prevent default if there might be system dialogs open
      const hasActiveFileInput = document.querySelector('input[type="file"]');
      if (!hasActiveFileInput) {
        e.evt.preventDefault();
      }

      const touch = { x: touches[0].clientX, y: touches[0].clientY };
      const deltaX = touch.x - lastTouchCenter.x;
      const deltaY = touch.y - lastTouchCenter.y;

      setViewport((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      setLastTouchCenter(touch);
    }
  };

  const handleTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
    setLastTouchDistance(null);
    setLastTouchCenter(null);
    setIsTouchingImage(false);
  };

  // Memoized fit to screen callback to prevent unnecessary re-renders
  const handleFitToScreen = useCallback(() => {
    fitToScreen([...images, ...videos], setViewport);
  }, [images, videos, fitToScreen, setViewport]);

  // Handle selection
  const handleSelect = (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
      );
    } else {
      setSelectedIds([id]);
    }
  };

  // Handle drag selection and panning
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    const stage = e.target.getStage();
    const mouseButton = e.evt.button; // 0 = left, 1 = middle, 2 = right

    // If middle mouse button OR pan mode with left click, start panning
    if (mouseButton === 1 || (isPanMode && mouseButton === 0)) {
      e.evt.preventDefault();
      setIsPanningCanvas(true);
      setLastPanPosition({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    // If in crop mode and clicked outside, exit crop mode
    if (croppingImageId) {
      const clickedNode = e.target;
      const cropGroup = clickedNode.findAncestor((node: any) => {
        return node.attrs && node.attrs.name === "crop-overlay";
      });

      if (!cropGroup) {
        setCroppingImageId(null);
        return;
      }
    }

    // Start selection box when left-clicking on empty space (but not in pan mode)
    if (clickedOnEmpty && !croppingImageId && mouseButton === 0 && !isPanMode) {
      const pos = stage?.getPointerPosition();
      if (pos) {
        // Convert screen coordinates to canvas coordinates
        const canvasPos = {
          x: (pos.x - viewport.x) / viewport.scale,
          y: (pos.y - viewport.y) / viewport.scale,
        };

        setIsSelecting(true);
        setSelectionBox({
          startX: canvasPos.x,
          startY: canvasPos.y,
          endX: canvasPos.x,
          endY: canvasPos.y,
          visible: true,
        });
        setSelectedIds([]);
      }
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();

    // Handle canvas panning with middle mouse
    if (isPanningCanvas) {
      const deltaX = e.evt.clientX - lastPanPosition.x;
      const deltaY = e.evt.clientY - lastPanPosition.y;

      setViewport((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      setLastPanPosition({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    // Handle selection
    if (!isSelecting) return;

    const pos = stage?.getPointerPosition();
    if (pos) {
      // Convert screen coordinates to canvas coordinates
      const canvasPos = {
        x: (pos.x - viewport.x) / viewport.scale,
        y: (pos.y - viewport.y) / viewport.scale,
      };

      setSelectionBox((prev) => ({
        ...prev,
        endX: canvasPos.x,
        endY: canvasPos.y,
      }));
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Stop canvas panning
    if (isPanningCanvas) {
      setIsPanningCanvas(false);
      return;
    }

    if (!isSelecting) return;

    // Calculate which images and videos are in the selection box
    const box = {
      x: Math.min(selectionBox.startX, selectionBox.endX),
      y: Math.min(selectionBox.startY, selectionBox.endY),
      width: Math.abs(selectionBox.endX - selectionBox.startX),
      height: Math.abs(selectionBox.endY - selectionBox.startY),
    };

    // Only select if the box has some size
    if (box.width > 5 || box.height > 5) {
      // Check for images in the selection box
      const selectedImages = images.filter((img) => {
        // Check if image intersects with selection box
        return !(
          img.x + img.width < box.x ||
          img.x > box.x + box.width ||
          img.y + img.height < box.y ||
          img.y > box.y + box.height
        );
      });

      // Check for videos in the selection box
      const selectedVideos = videos.filter((vid) => {
        // Check if video intersects with selection box
        return !(
          vid.x + vid.width < box.x ||
          vid.x > box.x + box.width ||
          vid.y + vid.height < box.y ||
          vid.y > box.y + box.height
        );
      });

      // Combine selected images and videos
      const selectedIds = [
        ...selectedImages.map((img) => img.id),
        ...selectedVideos.map((vid) => vid.id),
      ];

      if (selectedIds.length > 0) {
        setSelectedIds(selectedIds);
      }
    }

    setIsSelecting(false);
    setSelectionBox({ ...selectionBox, visible: false });
  };

  // Note: Overlapping detection has been removed in favor of explicit "Combine Images" action
  // Users can now manually combine images via the context menu before running generation

  // Handle context menu actions
  const { processGenerationResult, extractJobAsset } = useImageGeneration();

  // Image-to-image logic
  const imageToImage = useImageToImage({
    images,
    selectedIds,
  });

  const handleRun = useCallback(async () => {
    const prompt = generationSettings.prompt.trim();

    if (!prompt) {
      toast({
        title: "Prompt necessário",
        description: "Por favor, insira um prompt antes de gerar",
        variant: "destructive",
      });
      return;
    }

    // Prefer explicitly selected model, otherwise fall back to display model
    const resolvedModelId = (() => {
      if (generationSettings.styleId) {
        return generationSettings.styleId;
      }
      return displayMediaModel?.id;
    })();

    const targetModel =
      mediaModels.find((model) => model.id === resolvedModelId) ||
      displayMediaModel;

    if (!targetModel) {
      toast({
        title: "Selecione um modelo",
        description: "Escolha um modelo do catálogo antes de gerar",
        variant: "destructive",
      });
      return;
    }

    // Allow image, upscale, and video models
    const allowedTypes = ["image", "upscale", "video"];
    if (!allowedTypes.includes(targetModel.type)) {
      toast({
        title: "Modelo não suportado",
        description: `Tipo de modelo "${targetModel.type}" não é suportado no canvas.`,
        variant: "destructive",
      });
      return;
    }

    // Get number of images to generate from model parameters, default to 1
    const numImages = Math.max(
      1,
      Math.min(4, Number(modelParameters.num_images) || 1),
    );

    // Create multiple placeholders for multiple images
    const placeholderIds: string[] = [];
    const newPlaceholders: any[] = [];
    const baseSize = 512;
    const viewportCenterX =
      (canvasSize.width / 2 - viewport.x) / viewport.scale;
    const viewportCenterY =
      (canvasSize.height / 2 - viewport.y) / viewport.scale;

    // Calculate total width needed for all images with spacing
    const spacing = 20; // Space between images
    const totalWidth = numImages * baseSize + (numImages - 1) * spacing;
    const startX = viewportCenterX - totalWidth / 2;

    for (let i = 0; i < numImages; i++) {
      const placeholderId = `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`;
      placeholderIds.push(placeholderId);

      // Position images horizontally side by side
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
      });
    }

    setImages((prev) => [...prev, ...newPlaceholders]);
    setSelectedIds(placeholderIds);

    const parameters: Record<string, any> = {
      prompt,
    };

    if (generationSettings.loraUrl) {
      parameters.loraUrl = generationSettings.loraUrl;
    }

    if (generationSettings.styleId) {
      parameters.styleId = generationSettings.styleId;
    }
    // Include model parameters
    Object.keys(modelParameters).forEach((key) => {
      if (
        modelParameters[key] !== undefined &&
        modelParameters[key] !== null &&
        modelParameters[key] !== ""
      ) {
        parameters[key] = modelParameters[key];
      }
    });

    // Pre-upload selected image if using image-to-image to avoid concurrent upload conflicts
    if (imageToImage.hasSelectedImages && imageToImage.selectedImage) {
      const imageUrl =
        imageToImage.selectedImage.uploadedUrl ||
        imageToImage.selectedImage.src;
      // Only upload if it's not already an HTTP URL
      if (!/^https?:\/\//i.test(imageUrl)) {
        try {
          const { url: uploadedUrl } = await ensureRemoteAsset(imageUrl, {
            filename: `${imageToImage.selectedImage.id}.png`,
            existingUrl: imageToImage.selectedImage.uploadedUrl ?? null,
          });
          // Update the image with the uploaded URL to prevent future uploads
          setImages((prev) =>
            prev.map((img) =>
              img.id === imageToImage.selectedImage!.id
                ? { ...img, uploadedUrl: uploadedUrl }
                : img,
            ),
          );
          // Use the uploaded URL for this generation
          imageToImage.selectedImage.src = uploadedUrl;
        } catch (error) {
          console.error("Failed to upload image:", error);
          // Clean up placeholders
          setImages((prev) =>
            prev.filter((img) => !placeholderIds.includes(img.id)),
          );
          toast({
            title: "Falha no upload",
            description: "Não foi possível fazer upload da imagem selecionada",
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Prepare parameters for image-to-image if applicable
    const { parameters: finalParameters, endpoint } =
      imageToImage.prepareParameters(targetModel, parameters);

    // Set up active generations for all placeholders with a shared runId
    // This will be updated with the actual runId after the API call
    setActiveGenerations((prev) => {
      const next = new Map(prev);
      placeholderIds.forEach((placeholderId, index) => {
        next.set(placeholderId, {
          prompt,
          loraUrl: generationSettings.loraUrl,
          modelId: targetModel.id,
          parameters: finalParameters,
          status: "queued",
          createdAt: Date.now(),
          placeholderIds, // Track all related placeholders
          isCoordinator: index === 0, // First placeholder is the coordinator
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
          modelId: targetModel.id,
          endpoint, // Use resolved endpoint
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
      console.log("Job received:", {
        runId,
        status,
        jobType: job.type || "unknown",
      });

      setActiveGenerations((prev) => {
        const next = new Map(prev);

        // Update all placeholders with the same runId
        placeholderIds.forEach((placeholderId) => {
          const existing = prev.get(placeholderId);
          if (existing) {
            next.set(placeholderId, {
              ...existing,
              jobId: job.id,
              runId,
              status,
              realtimeToken: realtime.token ?? null,
              resultUrl: extractJobAsset(job)?.url ?? existing.resultUrl,
              // Preserve coordinator status
              isCoordinator: existing.isCoordinator,
            });
          }
        });

        return next;
      });

      console.log("Job status:", status);

      if (status === "completed" || status === "COMPLETED") {
        console.log("Processing completed job:", job);
        const result = processGenerationResult(job);
        console.log("Generation result:", result);

        if (!result.success) {
          throw new Error(result.error || "Generation failed");
        }

        console.log("Assets found:", result.assets.length);
        console.log("Placeholder IDs:", placeholderIds);
        result.assets.forEach((asset, i) =>
          console.log(`Asset ${i}:`, asset.url),
        );

        const { updatedPlaceholders, newImages } = createCanvasImagesFromAssets(
          result.assets,
          placeholderIds,
          viewport,
          canvasSize,
        );

        console.log("Canvas images created:", {
          updatedPlaceholdersCount: updatedPlaceholders.length,
          newImagesCount: newImages.length,
        });

        if (updatedPlaceholders.length > 0) {
          // Update placeholders and add new images in a single atomic operation
          console.log("Updating canvas with all images:", {
            placeholdersCount: updatedPlaceholders.length,
            newImagesCount: newImages.length,
            totalImages: updatedPlaceholders.length + newImages.length,
          });

          setImages((prev) => {
            // Create a map for quick placeholder lookup
            const placeholderMap = new Map(
              updatedPlaceholders.map((p) => [p.id, p]),
            );

            console.log("Applying images update:", {
              prevCount: prev.length,
              placeholderMapSize: placeholderMap.size,
              newImagesCount: newImages.length,
              placeholderMap: Array.from(placeholderMap.entries()).map(
                ([id, img]) => ({ id, src: img.src }),
              ),
            });

            const updatedPrev = prev.map((img) => {
              const replacement = placeholderMap.get(img.id);
              if (replacement) {
                console.log(
                  `Replacing placeholder ${img.id} with ${replacement.src}`,
                );
              }
              return replacement || img;
            });

            const finalImages = [...updatedPrev, ...newImages];

            console.log("Final images count:", finalImages.length);
            return finalImages;
          });

          // Select all generated images
          const allGeneratedIds = [
            ...updatedPlaceholders.map((p) => p.id),
            ...newImages.map((img) => img.id),
          ];
          if (allGeneratedIds.length > 0) {
            setSelectedIds(allGeneratedIds);
          }
        }

        setActiveGenerations((prev) => {
          const next = new Map(prev);
          // Clean up all placeholders
          placeholderIds.forEach((id) => next.delete(id));
          return next;
        });
        setTimeout(() => saveToStorage(), 100);
      } else if (!runId) {
        throw new Error(
          "Generation response did not include a run identifier.",
        );
      } else {
        toast({
          title: "Geração iniciada",
          description:
            "Aguarde, adicionaremos o resultado ao canvas automaticamente.",
        });
      }
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

      toast({
        title: "Falha na geração",
        description: message,
        variant: "destructive",
      });
    }
  }, [
    canvasSize.height,
    canvasSize.width,
    displayMediaModel,
    extractJobAsset,
    processGenerationResult,
    createCanvasImagesFromAssets,
    generationSettings.loraUrl,
    generationSettings.prompt,
    generationSettings.styleId,
    mediaModels,
    modelParameters,
    previousModelId,
    saveToStorage,
    selectedIds,
    setActiveGenerations,
    setImages,
    setSelectedIds,
    toast,
    viewport.x,
    viewport.y,
    viewport.scale,
    imageToImage,
  ]);

  const handleDelete = () => {
    // Save to history before deleting
    saveToHistory();
    setImages((prev) => prev.filter((img) => !selectedIds.includes(img.id)));
    setVideos((prev) => prev.filter((vid) => !selectedIds.includes(vid.id)));
    setSelectedIds([]);
  };

  const handleDuplicate = () => {
    // Save to history before duplicating
    saveToHistory();

    // Duplicate selected images
    const selectedImages = images.filter((img) => selectedIds.includes(img.id));
    const newImages = selectedImages.map((img) => ({
      ...img,
      id: `img-${Date.now()}-${Math.random()}`,
      x: img.x + 20,
      y: img.y + 20,
    }));

    // Duplicate selected videos
    const selectedVideos = videos.filter((vid) => selectedIds.includes(vid.id));
    const newVideos = selectedVideos.map((vid) => ({
      ...vid,
      id: `vid-${Date.now()}-${Math.random()}`,
      x: vid.x + 20,
      y: vid.y + 20,
      // Reset playback state for duplicated videos
      currentTime: 0,
      isPlaying: false,
    }));

    // Update both arrays
    setImages((prev) => [...prev, ...newImages]);
    setVideos((prev) => [...prev, ...newVideos]);

    // Select all duplicated items
    const newIds = [
      ...newImages.map((img) => img.id),
      ...newVideos.map((vid) => vid.id),
    ];
    setSelectedIds(newIds);
  };

  const handleRemoveBackground = async () => {
    await handleRemoveBackgroundHandler({
      images,
      selectedIds,
      setImages,
      toast,
      saveToHistory,
      removeBackground,
    });
  };

  // Function to handle the "Remove Background from Video" option in the context menu
  const handleRemoveVideoBackground = (videoId: string) => {
    const video = videos.find((vid) => vid.id === videoId);
    if (!video) return;

    setSelectedVideoForBackgroundRemoval(videoId);
    setIsRemoveVideoBackgroundDialogOpen(true);
  };

  // Function to handle the video background removal
  const handleVideoBackgroundRemoval = async (backgroundColor: string) => {
    if (!selectedVideoForBackgroundRemoval) return;

    const video = videos.find(
      (vid) => vid.id === selectedVideoForBackgroundRemoval,
    );
    if (!video) return;

    let toastId: string | undefined;
    // Create a unique ID for this generation
    const generationId = `bg_removal_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      setIsRemovingVideoBackground(true);

      // Close the dialog
      setIsRemoveVideoBackgroundDialogOpen(false);

      // Don't show a toast here - the StreamingVideo component will handle progress

      // Upload video if it's not already accessible via HTTP
      let videoUrl = video.uploadedUrl || video.src;
      if (!/^https?:\/\//i.test(videoUrl)) {
        const { url } = await ensureRemoteAsset(videoUrl, {
          filename: `${video.id}.mp4`,
          existingUrl: video.uploadedUrl ?? null,
        });

        videoUrl = url;

        if (video.uploadedUrl !== url) {
          setVideos((prev) =>
            prev.map((vid) =>
              vid.id === video.id ? { ...vid, uploadedUrl: url } : vid,
            ),
          );
        }
      }

      // Map the background color to the API's expected format
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

      // Map to API format
      const apiBackgroundColor = colorMap[backgroundColor] || "Black";

      // Add to active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.set(generationId, {
          imageUrl: videoUrl,
          prompt: `Removing background from video`,
          duration: video.duration || 5,
          modelId: "bria-video-background-removal",
          modelConfig: getVideoModelById("bria-video-background-removal"),
          sourceVideoId: video.id,
          backgroundColor: apiBackgroundColor,
          status: "queued",
        });
        return newMap;
      });

      // Create a persistent toast that will stay visible until the conversion completes
      toastId = toast({
        title: "Removendo fundo do vídeo",
        description: "Isso pode levar vários minutos...",
        duration: Infinity, // Make the toast stay until manually dismissed
      }).id;

      // Store the toast ID with the generation for later reference
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

      const model = getVideoModelById("bria-video-background-removal");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          modelId: "bria-video-background-removal",
          endpoint: model?.endpoint,
          parameters: {
            imageUrl: videoUrl,
            backgroundColor: apiBackgroundColor,
            sourceVideoId: video.id,
            isVideoToVideo: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          errorText ||
            `Video background removal request failed with status ${response.status}`,
        );
      }

      const payload = await response.json();
      const job = payload.job ?? payload;
      const realtime = payload.realtime ?? {};
      const runId = job?.runId || realtime.runId || job?.id;
      const status =
        job?.status || job?.output?.status || job?.output?.state || "queued";

      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generation = newMap.get(generationId);
        if (generation) {
          newMap.set(generationId, {
            ...generation,
            jobId: job?.id,
            runId,
            status,
            realtimeToken: realtime.token ?? null,
            resultUrl:
              job?.result?.videoUrl ||
              job?.output?.result?.videoUrl ||
              generation.resultUrl,
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error("Error removing video background:", error);
      if (toastId) {
        dismiss(toastId);
      }
      toast({
        title: "Erro ao processar vídeo",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });

      // Remove from active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(generationId);
        return newMap;
      });
    } finally {
      // Don't set isRemovingVideoBackground to false here - let the completion/error handlers do it
      setSelectedVideoForBackgroundRemoval(null);
    }
  };

  const sendToFront = useCallback(() => {
    if (selectedIds.length === 0) return;

    saveToHistory();
    setImages((prev) => {
      // Get selected images in their current order
      const selectedImages = selectedIds
        .map((id) => prev.find((img) => img.id === id))
        .filter(Boolean) as PlacedImage[];

      // Get remaining images
      const remainingImages = prev.filter(
        (img) => !selectedIds.includes(img.id),
      );

      // Place selected images at the end (top layer)
      return [...remainingImages, ...selectedImages];
    });
  }, [selectedIds, saveToHistory]);

  const sendToBack = useCallback(() => {
    if (selectedIds.length === 0) return;

    saveToHistory();
    setImages((prev) => {
      // Get selected images in their current order
      const selectedImages = selectedIds
        .map((id) => prev.find((img) => img.id === id))
        .filter(Boolean) as PlacedImage[];

      // Get remaining images
      const remainingImages = prev.filter(
        (img) => !selectedIds.includes(img.id),
      );

      // Place selected images at the beginning (bottom layer)
      return [...selectedImages, ...remainingImages];
    });
  }, [selectedIds, saveToHistory]);

  const bringForward = useCallback(() => {
    if (selectedIds.length === 0) return;

    saveToHistory();
    setImages((prev) => {
      const result = [...prev];

      // Process selected images from back to front to maintain relative order
      for (let i = result.length - 2; i >= 0; i--) {
        if (
          selectedIds.includes(result[i].id) &&
          !selectedIds.includes(result[i + 1].id)
        ) {
          // Swap with the next image if it's not also selected
          [result[i], result[i + 1]] = [result[i + 1], result[i]];
        }
      }

      return result;
    });
  }, [selectedIds, saveToHistory]);

  const sendBackward = useCallback(() => {
    if (selectedIds.length === 0) return;

    saveToHistory();
    setImages((prev) => {
      const result = [...prev];

      // Process selected images from front to back to maintain relative order
      for (let i = 1; i < result.length; i++) {
        if (
          selectedIds.includes(result[i].id) &&
          !selectedIds.includes(result[i - 1].id)
        ) {
          // Swap with the previous image if it's not also selected
          [result[i], result[i - 1]] = [result[i - 1], result[i]];
        }
      }

      return result;
    });
  }, [selectedIds, saveToHistory]);

  const handleIsolate = async () => {
    if (!isolateTarget || !isolateInputValue.trim() || isIsolating) {
      return;
    }

    setIsIsolating(true);

    try {
      const image = images.find((img) => img.id === isolateTarget);
      if (!image) {
        setIsIsolating(false);
        return;
      }

      // Show loading state
      toast({
        title: "Processando...",
        description: `Isolando "${isolateInputValue}" da imagem`,
      });

      // Process the image to get the cropped/processed version
      const imgElement = new window.Image();
      imgElement.crossOrigin = "anonymous"; // Enable CORS
      imgElement.src = image.src;
      await new Promise((resolve) => {
        imgElement.onload = resolve;
      });

      // Create canvas for processing
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");

      // Get crop values
      const cropX = image.cropX || 0;
      const cropY = image.cropY || 0;
      const cropWidth = image.cropWidth || 1;
      const cropHeight = image.cropHeight || 1;

      // Set canvas size based on crop
      canvas.width = cropWidth * imgElement.naturalWidth;
      canvas.height = cropHeight * imgElement.naturalHeight;

      // Draw cropped image
      ctx.drawImage(
        imgElement,
        cropX * imgElement.naturalWidth,
        cropY * imgElement.naturalHeight,
        cropWidth * imgElement.naturalWidth,
        cropHeight * imgElement.naturalHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // Convert to blob and upload
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/png");
      });

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(blob);
      });

      const { url: uploadedImageUrl } = await ensureRemoteAsset(dataUrl, {
        filename: `${image.id}-processed.png`,
      });

      // Isolate object using EVF-SAM2
      console.log("Calling isolateObject with:", {
        imageUrl: uploadedImageUrl || "",
        textInput: isolateInputValue,
      });

      const result = await isolateObject({
        imageUrl: uploadedImageUrl || "",
        textInput: isolateInputValue,
      });

      console.log("IsolateObject result:", result);

      // Use the segmented image URL directly (backend already applied the mask)
      if (result.url) {
        console.log("Original image URL:", image.src);
        console.log("New isolated image URL:", result.url);
        console.log("Result object:", JSON.stringify(result, null, 2));

        // AUTO DOWNLOAD FOR DEBUGGING
        try {
          const link = document.createElement("a");
          link.href = result.url;
          link.download = `isolated-${isolateInputValue}-${Date.now()}.png`;
          link.target = "_blank"; // Open in new tab to see the image
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log("Auto-downloaded isolated image for debugging");
        } catch (e) {
          console.error("Failed to auto-download:", e);
        }

        // Force load the new image before updating state
        const testImg = new window.Image();
        testImg.crossOrigin = "anonymous";
        testImg.onload = () => {
          console.log(
            "New image loaded successfully:",
            testImg.width,
            "x",
            testImg.height,
          );

          // Create a test canvas to verify the image has transparency
          const testCanvas = document.createElement("canvas");
          testCanvas.width = testImg.width;
          testCanvas.height = testImg.height;
          const testCtx = testCanvas.getContext("2d");
          if (testCtx) {
            // Fill with red background
            testCtx.fillStyle = "red";
            testCtx.fillRect(0, 0, testCanvas.width, testCanvas.height);
            // Draw the image on top
            testCtx.drawImage(testImg, 0, 0);

            // Get a pixel from what should be transparent area (corner)
            const pixelData = testCtx.getImageData(0, 0, 1, 1).data;
            console.log("Corner pixel (should show red if transparent):", {
              r: pixelData[0],
              g: pixelData[1],
              b: pixelData[2],
              a: pixelData[3],
            });
          }

          // Update the image in place with the segmented image
          saveToHistory();

          // Create a completely new image URL with timestamp
          const newImageUrl = `${result.url}${result.url.includes("?") ? "&" : "?"}t=${Date.now()}&cache=no`;

          // Get the current image to preserve position
          const currentImage = images.find((img) => img.id === isolateTarget);
          if (!currentImage) {
            console.error("Could not find current image!");
            return;
          }

          // Create new image with isolated- prefix ID
          const newImage: PlacedImage = {
            ...currentImage,
            id: `isolated-${Date.now()}-${Math.random()}`,
            src: newImageUrl,
            // Remove crop values since we've applied them
            cropX: undefined,
            cropY: undefined,
            cropWidth: undefined,
            cropHeight: undefined,
          };

          setImages((prev) => {
            // Replace old image with new one at same index
            const newImages = [...prev];
            const index = newImages.findIndex(
              (img) => img.id === isolateTarget,
            );
            if (index !== -1) {
              newImages[index] = newImage;
            }
            return newImages;
          });

          // Update selection
          setSelectedIds([newImage.id]);

          toast({
            title: "Sucesso",
            description: `"${isolateInputValue}" isolado com sucesso`,
          });
        };

        testImg.onerror = (e) => {
          console.error("Failed to load new image:", e);
          toast({
            title: "Falha ao carregar imagem isolada",
            description: "A imagem isolada não pôde ser carregada",
            variant: "destructive",
          });
        };

        testImg.src = result.url;
      } else {
        toast({
          title: "Nenhum objeto encontrado",
          description: `Não foi possível encontrar "${isolateInputValue}" na imagem`,
          variant: "destructive",
        });
      }

      // Reset the isolate input
      setIsolateTarget(null);
      setIsolateInputValue("");
      setIsIsolating(false);
    } catch (error) {
      console.error("Error isolating object:", error);
      toast({
        title: "Falha ao isolar objeto",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setIsolateTarget(null);
      setIsolateInputValue("");
      setIsIsolating(false);
    }
  };

  const handleCombineImages = async () => {
    if (selectedIds.length < 2) return;

    // Save to history before combining
    saveToHistory();

    // Get selected images and sort by layer order
    const selectedImages = selectedIds
      .map((id) => images.find((img) => img.id === id))
      .filter((img) => img !== undefined) as PlacedImage[];

    const sortedImages = [...selectedImages].sort((a, b) => {
      const indexA = images.findIndex((img) => img.id === a.id);
      const indexB = images.findIndex((img) => img.id === b.id);
      return indexA - indexB;
    });

    // Load all images to calculate scale factors
    const imageElements: {
      img: PlacedImage;
      element: HTMLImageElement;
      scale: number;
    }[] = [];
    let maxScale = 1;

    for (const img of sortedImages) {
      const imgElement = new window.Image();
      imgElement.crossOrigin = "anonymous"; // Enable CORS
      imgElement.src = img.src;
      await new Promise((resolve) => {
        imgElement.onload = resolve;
      });

      // Calculate scale factor (original size / display size)
      // Account for crops if they exist
      const effectiveWidth = img.cropWidth
        ? imgElement.naturalWidth * img.cropWidth
        : imgElement.naturalWidth;
      const effectiveHeight = img.cropHeight
        ? imgElement.naturalHeight * img.cropHeight
        : imgElement.naturalHeight;

      const scaleX = effectiveWidth / img.width;
      const scaleY = effectiveHeight / img.height;
      const scale = Math.min(scaleX, scaleY); // Use min to maintain aspect ratio

      maxScale = Math.max(maxScale, scale);
      imageElements.push({ img, element: imgElement, scale });
    }

    // Use a reasonable scale - not too large to avoid memory issues
    const optimalScale = Math.min(maxScale, 4); // Cap at 4x to prevent huge images

    // Calculate bounding box of all selected images
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    sortedImages.forEach((img) => {
      minX = Math.min(minX, img.x);
      minY = Math.min(minY, img.y);
      maxX = Math.max(maxX, img.x + img.width);
      maxY = Math.max(maxY, img.y + img.height);
    });

    const combinedWidth = maxX - minX;
    const combinedHeight = maxY - minY;

    // Create canvas at higher resolution
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to get canvas context");
      return;
    }

    canvas.width = Math.round(combinedWidth * optimalScale);
    canvas.height = Math.round(combinedHeight * optimalScale);

    console.log(
      `Creating combined image at ${canvas.width}x${canvas.height} (scale: ${optimalScale.toFixed(2)}x)`,
    );

    // Draw each image in order using the pre-loaded elements
    for (const { img, element: imgElement } of imageElements) {
      // Calculate position relative to the combined canvas, scaled up
      const relX = (img.x - minX) * optimalScale;
      const relY = (img.y - minY) * optimalScale;
      const scaledWidth = img.width * optimalScale;
      const scaledHeight = img.height * optimalScale;

      ctx.save();

      // Handle rotation if needed
      if (img.rotation) {
        ctx.translate(relX + scaledWidth / 2, relY + scaledHeight / 2);
        ctx.rotate((img.rotation * Math.PI) / 180);
        ctx.drawImage(
          imgElement,
          -scaledWidth / 2,
          -scaledHeight / 2,
          scaledWidth,
          scaledHeight,
        );
      } else {
        // Handle cropping if exists
        if (
          img.cropX !== undefined &&
          img.cropY !== undefined &&
          img.cropWidth !== undefined &&
          img.cropHeight !== undefined
        ) {
          ctx.drawImage(
            imgElement,
            img.cropX * imgElement.naturalWidth,
            img.cropY * imgElement.naturalHeight,
            img.cropWidth * imgElement.naturalWidth,
            img.cropHeight * imgElement.naturalHeight,
            relX,
            relY,
            scaledWidth,
            scaledHeight,
          );
        } else {
          ctx.drawImage(
            imgElement,
            0,
            0,
            imgElement.naturalWidth,
            imgElement.naturalHeight,
            relX,
            relY,
            scaledWidth,
            scaledHeight,
          );
        }
      }

      ctx.restore();
    }

    // Convert to blob and create data URL
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), "image/png");
    });

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(blob);
    });

    // Create new combined image
    const combinedImage: PlacedImage = {
      id: `combined-${Date.now()}-${Math.random()}`,
      src: dataUrl,
      x: minX,
      y: minY,
      width: combinedWidth,
      height: combinedHeight,
      rotation: 0,
    };

    // Remove the original images and add the combined one
    setImages((prev) => [
      ...prev.filter((img) => !selectedIds.includes(img.id)),
      combinedImage,
    ]);

    // Select the new combined image
    setSelectedIds([combinedImage.id]);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if target is an input element
      const isInputElement =
        e.target && (e.target as HTMLElement).matches("input, textarea");

      // Enable pan mode with Space key (hold-to-pan)
      if (e.key === " " && !isInputElement) {
        e.preventDefault();
        setPanMode(true);
      }
      // Undo/Redo
      else if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        ((e.key === "z" && e.shiftKey) || e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }
      // Select all
      else if ((e.metaKey || e.ctrlKey) && e.key === "a" && !isInputElement) {
        e.preventDefault();
        setSelectedIds(images.map((img) => img.id));
      }
      // Delete
      else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isInputElement
      ) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDelete();
        }
      }
      // Duplicate
      else if ((e.metaKey || e.ctrlKey) && e.key === "d" && !isInputElement) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          handleDuplicate();
        }
      }
      // Run generation
      else if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Enter" &&
        !isInputElement
      ) {
        e.preventDefault();
        if (
          activeGenerations.size < MAX_CONCURRENT_GENERATIONS &&
          generationSettings.prompt.trim()
        ) {
          handleRun();
        }
      }
      // Layer ordering shortcuts
      else if (e.key === "]" && !isInputElement) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          if (e.metaKey || e.ctrlKey) {
            sendToFront();
          } else {
            bringForward();
          }
        }
      } else if (e.key === "[" && !isInputElement) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          if (e.metaKey || e.ctrlKey) {
            sendToBack();
          } else {
            sendBackward();
          }
        }
      }
      // Escape to exit crop mode
      else if (e.key === "Escape" && croppingImageId) {
        e.preventDefault();
        setCroppingImageId(null);
      }
      // Zoom in
      else if ((e.key === "+" || e.key === "=") && !isInputElement) {
        e.preventDefault();
        const newScale = Math.min(5, viewport.scale * 1.2);
        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;

        const mousePointTo = {
          x: (centerX - viewport.x) / viewport.scale,
          y: (centerY - viewport.y) / viewport.scale,
        };

        setViewport({
          x: centerX - mousePointTo.x * newScale,
          y: centerY - mousePointTo.y * newScale,
          scale: newScale,
        });
      }
      // Zoom out
      else if (e.key === "-" && !isInputElement) {
        e.preventDefault();
        const newScale = Math.max(0.1, viewport.scale / 1.2);
        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;

        const mousePointTo = {
          x: (centerX - viewport.x) / viewport.scale,
          y: (centerY - viewport.y) / viewport.scale,
        };

        setViewport({
          x: centerX - mousePointTo.x * newScale,
          y: centerY - mousePointTo.y * newScale,
          scale: newScale,
        });
      }
      // Reset zoom
      else if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setViewport({ x: 0, y: 0, scale: 1 });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Disable pan mode when Space key is released
      if (e.key === " ") {
        setPanMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    selectedIds,
    images,
    generationSettings,
    undo,
    redo,
    handleDelete,
    handleDuplicate,
    handleRun,
    croppingImageId,
    setPanMode,
    viewport,
    canvasSize,
    sendToFront,
    sendToBack,
    bringForward,
    sendBackward,
  ]);

  return (
    <div
      className="bg-background text-foreground font-focal relative flex flex-col w-full overflow-hidden h-screen"
      style={{ height: "100dvh" }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => e.preventDefault()}
      onDragLeave={(e) => e.preventDefault()}
    >
      {/* Render streaming components for active generations */}
      {Array.from(activeGenerations.entries()).map(([imageId, generation]) => (
        <StreamingImage
          key={imageId}
          imageId={imageId}
          generation={generation}
          onStatus={multiImageHandlers.onStatus}
          onComplete={multiImageHandlers.onComplete}
          onError={(id, error) => {
            console.error(`Generation error for ${id}:`, error);
            multiImageHandlers.onError(id, error);
            setImages((prev) => prev.filter((img) => img.id !== id));
            toast({
              title: "Falha na geração",
              description: error.toString(),
              variant: "destructive",
            });
          }}
        />
      ))}

      {/* Main content */}
      <main className="flex-1 relative flex items-center justify-center w-full">
        <div className="relative w-full h-full">
          {/* Gradient Overlays */}
          <div
            className="pointer-events-none absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10"
            aria-hidden="true"
          />
          <ContextMenu
            onOpenChange={(open) => {
              if (!open) {
                // Reset isolate state when context menu closes
                setIsolateTarget(null);
                setIsolateInputValue("");
              }
            }}
          >
            <ContextMenuTrigger asChild>
              <div
                className="relative bg-background overflow-hidden w-full h-full"
                style={{
                  // Use consistent style property names to avoid hydration errors
                  height: `${canvasSize.height}px`,
                  width: `${canvasSize.width}px`,
                  minHeight: `${canvasSize.height}px`,
                  minWidth: `${canvasSize.width}px`,
                  cursor: isPanningCanvas
                    ? "grabbing"
                    : isPanMode
                      ? "grab"
                      : "default",
                  WebkitTouchCallout: "none", // Add this for iOS
                  touchAction: "none", // For touch devices
                }}
              >
                {isCanvasReady && (
                  <Stage
                    ref={stageRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    x={viewport.x}
                    y={viewport.y}
                    scaleX={viewport.scale}
                    scaleY={viewport.scale}
                    draggable={false}
                    onDragStart={(e) => {
                      e.evt?.preventDefault();
                    }}
                    onDragEnd={(e) => {
                      e.evt?.preventDefault();
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => {
                      // Stop panning if mouse leaves the stage
                      if (isPanningCanvas) {
                        setIsPanningCanvas(false);
                      }
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={(e) => {
                      // Check if this is a forwarded event from a video overlay
                      const videoId =
                        (e.evt as any)?.videoId || (e as any)?.videoId;
                      if (videoId) {
                        // This is a right-click on a video
                        if (!selectedIds.includes(videoId)) {
                          setSelectedIds([videoId]);
                        }
                        return;
                      }

                      // Get clicked position
                      const stage = e.target.getStage();
                      if (!stage) return;

                      const point = stage.getPointerPosition();
                      if (!point) return;

                      // Convert to canvas coordinates
                      const canvasPoint = {
                        x: (point.x - viewport.x) / viewport.scale,
                        y: (point.y - viewport.y) / viewport.scale,
                      };

                      // Check if we clicked on a video first (check in reverse order for top-most)
                      const clickedVideo = [...videos].reverse().find((vid) => {
                        return (
                          canvasPoint.x >= vid.x &&
                          canvasPoint.x <= vid.x + vid.width &&
                          canvasPoint.y >= vid.y &&
                          canvasPoint.y <= vid.y + vid.height
                        );
                      });

                      if (clickedVideo) {
                        if (!selectedIds.includes(clickedVideo.id)) {
                          setSelectedIds([clickedVideo.id]);
                        }
                        return;
                      }

                      // Check if we clicked on an image (check in reverse order for top-most image)
                      const clickedImage = [...images].reverse().find((img) => {
                        // Simple bounding box check
                        // TODO: Could be improved to handle rotation
                        return (
                          canvasPoint.x >= img.x &&
                          canvasPoint.x <= img.x + img.width &&
                          canvasPoint.y >= img.y &&
                          canvasPoint.y <= img.y + img.height
                        );
                      });

                      if (clickedImage) {
                        if (!selectedIds.includes(clickedImage.id)) {
                          // If clicking on unselected image, select only that image
                          setSelectedIds([clickedImage.id]);
                        }
                        // If already selected, keep current selection for multi-select context menu
                      }
                    }}
                    onWheel={handleWheel}
                  >
                    <Layer>
                      {/* Grid background */}
                      {showGrid && (
                        <CanvasGrid
                          viewport={viewport}
                          canvasSize={canvasSize}
                        />
                      )}

                      {/* Selection box */}
                      <SelectionBoxComponent selectionBox={selectionBox} />

                      {/* Render images */}
                      {images
                        .filter((image) => {
                          // Performance optimization: only render visible images
                          const buffer = 100; // pixels buffer
                          const viewBounds = {
                            left: -viewport.x / viewport.scale - buffer,
                            top: -viewport.y / viewport.scale - buffer,
                            right:
                              (canvasSize.width - viewport.x) / viewport.scale +
                              buffer,
                            bottom:
                              (canvasSize.height - viewport.y) /
                                viewport.scale +
                              buffer,
                          };

                          return !(
                            image.x + image.width < viewBounds.left ||
                            image.x > viewBounds.right ||
                            image.y + image.height < viewBounds.top ||
                            image.y > viewBounds.bottom
                          );
                        })
                        .map((image) => (
                          <CanvasImage
                            key={image.id}
                            image={image}
                            isSelected={selectedIds.includes(image.id)}
                            onSelect={(e) => handleSelect(image.id, e)}
                            onChange={(newAttrs) => {
                              setImages((prev) =>
                                prev.map((img) =>
                                  img.id === image.id
                                    ? { ...img, ...newAttrs }
                                    : img,
                                ),
                              );
                            }}
                            onDoubleClick={() => {
                              setCroppingImageId(image.id);
                            }}
                            onDragStart={(e) => {
                              // Check if Alt/Option key is pressed for duplicate-on-drag
                              const isAltPressed = e.evt?.altKey || false;

                              // If dragging a selected item in a multi-selection, keep the selection
                              // If dragging an unselected item, select only that item
                              let currentSelectedIds = selectedIds;
                              if (!selectedIds.includes(image.id)) {
                                currentSelectedIds = [image.id];
                                setSelectedIds(currentSelectedIds);
                              }

                              // If Alt is pressed, duplicate the selected items
                              if (isAltPressed) {
                                // Duplicate selected images
                                const selectedImages = images.filter((img) =>
                                  currentSelectedIds.includes(img.id),
                                );
                                const newImages = selectedImages.map((img) => ({
                                  ...img,
                                  id: `img-${Date.now()}-${Math.random()}`,
                                  // Keep same position initially, drag will move them
                                  x: img.x,
                                  y: img.y,
                                }));

                                // Duplicate selected videos
                                const selectedVideos = videos.filter((vid) =>
                                  currentSelectedIds.includes(vid.id),
                                );
                                const newVideos = selectedVideos.map((vid) => ({
                                  ...vid,
                                  id: `vid-${Date.now()}-${Math.random()}`,
                                  // Keep same position initially, drag will move them
                                  x: vid.x,
                                  y: vid.y,
                                  currentTime: 0,
                                  isPlaying: false,
                                }));

                                // Update arrays with duplicated items
                                setImages((prev) => [...prev, ...newImages]);
                                setVideos((prev) => [...prev, ...newVideos]);

                                // Select the new duplicated items
                                const newIds = [
                                  ...newImages.map((img) => img.id),
                                  ...newVideos.map((vid) => vid.id),
                                ];
                                currentSelectedIds = newIds;
                                setSelectedIds(newIds);
                              }

                              setIsDraggingImage(true);
                              // Save positions of all selected items
                              const positions = new Map<
                                string,
                                { x: number; y: number }
                              >();
                              currentSelectedIds.forEach((id) => {
                                const img = images.find((i) => i.id === id);
                                const vid = videos.find((v) => v.id === id);
                                const element = img || vid;
                                if (element) {
                                  positions.set(id, {
                                    x: element.x,
                                    y: element.y,
                                  });
                                }
                              });
                              setDragStartPositions(positions);
                            }}
                            onDragEnd={() => {
                              setIsDraggingImage(false);
                              saveToHistory();
                              setDragStartPositions(new Map());
                            }}
                            selectedIds={selectedIds}
                            images={images}
                            setImages={setImages}
                            isDraggingImage={isDraggingImage}
                            isCroppingImage={croppingImageId === image.id}
                            dragStartPositions={dragStartPositions}
                          />
                        ))}

                      {/* Render videos */}
                      {videos
                        .filter((video) => {
                          // Performance optimization: only render visible videos
                          const buffer = 100; // pixels buffer
                          const viewBounds = {
                            left: -viewport.x / viewport.scale - buffer,
                            top: -viewport.y / viewport.scale - buffer,
                            right:
                              (canvasSize.width - viewport.x) / viewport.scale +
                              buffer,
                            bottom:
                              (canvasSize.height - viewport.y) /
                                viewport.scale +
                              buffer,
                          };

                          return !(
                            video.x + video.width < viewBounds.left ||
                            video.x > viewBounds.right ||
                            video.y + video.height < viewBounds.top ||
                            video.y > viewBounds.bottom
                          );
                        })
                        .map((video) => (
                          <CanvasVideo
                            key={video.id}
                            video={video}
                            isSelected={selectedIds.includes(video.id)}
                            onSelect={(e) => handleSelect(video.id, e)}
                            onChange={(newAttrs) => {
                              setVideos((prev) =>
                                prev.map((vid) =>
                                  vid.id === video.id
                                    ? { ...vid, ...newAttrs }
                                    : vid,
                                ),
                              );
                            }}
                            onDragStart={(e) => {
                              // Check if Alt/Option key is pressed for duplicate-on-drag
                              const isAltPressed = e.evt?.altKey || false;

                              // If dragging a selected item in a multi-selection, keep the selection
                              // If dragging an unselected item, select only that item
                              let currentSelectedIds = selectedIds;
                              if (!selectedIds.includes(video.id)) {
                                currentSelectedIds = [video.id];
                                setSelectedIds(currentSelectedIds);
                              }

                              // If Alt is pressed, duplicate the selected items
                              if (isAltPressed) {
                                // Duplicate selected images
                                const selectedImages = images.filter((img) =>
                                  currentSelectedIds.includes(img.id),
                                );
                                const newImages = selectedImages.map((img) => ({
                                  ...img,
                                  id: `img-${Date.now()}-${Math.random()}`,
                                  // Keep same position initially, drag will move them
                                  x: img.x,
                                  y: img.y,
                                }));

                                // Duplicate selected videos
                                const selectedVideos = videos.filter((vid) =>
                                  currentSelectedIds.includes(vid.id),
                                );
                                const newVideos = selectedVideos.map((vid) => ({
                                  ...vid,
                                  id: `vid-${Date.now()}-${Math.random()}`,
                                  // Keep same position initially, drag will move them
                                  x: vid.x,
                                  y: vid.y,
                                  currentTime: 0,
                                  isPlaying: false,
                                }));

                                // Update arrays with duplicated items
                                setImages((prev) => [...prev, ...newImages]);
                                setVideos((prev) => [...prev, ...newVideos]);

                                // Select the new duplicated items
                                const newIds = [
                                  ...newImages.map((img) => img.id),
                                  ...newVideos.map((vid) => vid.id),
                                ];
                                currentSelectedIds = newIds;
                                setSelectedIds(newIds);
                              }

                              setIsDraggingImage(true);
                              // Hide video controls during drag
                              setHiddenVideoControlsIds(
                                (prev) =>
                                  new Set([
                                    ...prev,
                                    ...currentSelectedIds.filter((id) =>
                                      videos.some((v) => v.id === id),
                                    ),
                                  ]),
                              );
                              // Save positions of all selected items
                              const positions = new Map<
                                string,
                                { x: number; y: number }
                              >();
                              currentSelectedIds.forEach((id) => {
                                const img = images.find((i) => i.id === id);
                                const vid = videos.find((v) => v.id === id);
                                const element = img || vid;
                                if (element) {
                                  positions.set(id, {
                                    x: element.x,
                                    y: element.y,
                                  });
                                }
                              });
                              setDragStartPositions(positions);
                            }}
                            onDragEnd={() => {
                              setIsDraggingImage(false);
                              // Show video controls after drag ends
                              setHiddenVideoControlsIds((prev) => {
                                const newSet = new Set(prev);
                                newSet.delete(video.id);
                                return newSet;
                              });
                              saveToHistory();
                              setDragStartPositions(new Map());
                            }}
                            selectedIds={selectedIds}
                            videos={videos}
                            setVideos={setVideos}
                            isDraggingVideo={isDraggingImage}
                            isCroppingVideo={false}
                            dragStartPositions={dragStartPositions}
                            onResizeStart={() =>
                              setHiddenVideoControlsIds(
                                (prev) => new Set([...prev, video.id]),
                              )
                            }
                            onResizeEnd={() =>
                              setHiddenVideoControlsIds((prev) => {
                                const newSet = new Set(prev);
                                newSet.delete(video.id);
                                return newSet;
                              })
                            }
                          />
                        ))}

                      {/* Crop overlay */}
                      {croppingImageId &&
                        (() => {
                          const croppingImage = images.find(
                            (img) => img.id === croppingImageId,
                          );
                          if (!croppingImage) return null;

                          return (
                            <CropOverlayWrapper
                              image={croppingImage}
                              viewportScale={viewport.scale}
                              onCropChange={(crop) => {
                                setImages((prev) =>
                                  prev.map((img) =>
                                    img.id === croppingImageId
                                      ? { ...img, ...crop }
                                      : img,
                                  ),
                                );
                              }}
                              onCropEnd={async () => {
                                // Apply crop to image dimensions
                                if (croppingImage) {
                                  const cropWidth =
                                    croppingImage.cropWidth || 1;
                                  const cropHeight =
                                    croppingImage.cropHeight || 1;
                                  const cropX = croppingImage.cropX || 0;
                                  const cropY = croppingImage.cropY || 0;

                                  try {
                                    // Create the cropped image at full resolution
                                    const croppedImageSrc =
                                      await createCroppedImage(
                                        croppingImage.src,
                                        cropX,
                                        cropY,
                                        cropWidth,
                                        cropHeight,
                                      );

                                    setImages((prev) =>
                                      prev.map((img) =>
                                        img.id === croppingImageId
                                          ? {
                                              ...img,
                                              // Replace with cropped image
                                              src: croppedImageSrc,
                                              // Update position to the crop area's top-left
                                              x: img.x + cropX * img.width,
                                              y: img.y + cropY * img.height,
                                              // Update dimensions to match crop size
                                              width: cropWidth * img.width,
                                              height: cropHeight * img.height,
                                              // Remove crop values completely
                                              cropX: undefined,
                                              cropY: undefined,
                                              cropWidth: undefined,
                                              cropHeight: undefined,
                                            }
                                          : img,
                                      ),
                                    );
                                  } catch (error) {
                                    console.error(
                                      "Failed to create cropped image:",
                                      error,
                                    );
                                  }
                                }

                                setCroppingImageId(null);
                                saveToHistory();
                              }}
                            />
                          );
                        })()}
                    </Layer>
                  </Stage>
                )}
              </div>
            </ContextMenuTrigger>
            <CanvasContextMenu
              selectedIds={selectedIds}
              images={images}
              videos={videos}
              activeGenerationsSize={activeGenerations.size}
              generationSettings={generationSettings}
              isolateInputValue={isolateInputValue}
              isIsolating={isIsolating}
              handleRun={handleRun}
              handleDuplicate={handleDuplicate}
              handleRemoveBackground={handleRemoveBackground}
              handleCombineImages={handleCombineImages}
              handleDelete={handleDelete}
              handleIsolate={handleIsolate}
              handleConvertToVideo={handleConvertToVideo}
              handleVideoToVideo={handleVideoToVideo}
              handleExtendVideo={handleExtendVideo}
              handleRemoveVideoBackground={handleRemoveVideoBackground}
              setCroppingImageId={setCroppingImageId}
              setIsolateInputValue={setIsolateInputValue}
              setIsolateTarget={setIsolateTarget}
              sendToFront={sendToFront}
              sendToBack={sendToBack}
              bringForward={bringForward}
              sendBackward={sendBackward}
            />
          </ContextMenu>

          <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
            {/* Unite logo */}
            <div className="md:hidden py-2 px-3 flex flex-row gap-2 items-center">
              <Link
                href="https://unite.ai"
                target="_blank"
                className="block transition-opacity"
              >
                <img
                  src={
                    mounted && theme === "dark"
                      ? "https://storage.googleapis.com/unite_assets/logos/Unite%20Logo%20Negativo.png"
                      : "https://cdn.prod.website-files.com/686549176db3fc9e575ae4b7/68654b105d4af13cbebc5bf4_Logo%20Positivo%20Unite.png"
                  }
                  alt="Unite logo"
                  className="h-8 w-auto"
                />
              </Link>
            </div>

            {/* Mobile tool icons - animated based on selection */}
            <MobileToolbar
              selectedIds={selectedIds}
              images={images}
              activeGenerationsSize={activeGenerations.size}
              generationSettings={generationSettings}
              handleRun={handleRun}
              handleDuplicate={handleDuplicate}
              handleRemoveBackground={handleRemoveBackground}
              handleCombineImages={handleCombineImages}
              handleDelete={handleDelete}
              setCroppingImageId={setCroppingImageId}
              sendToFront={sendToFront}
              sendToBack={sendToBack}
              bringForward={bringForward}
              sendBackward={sendBackward}
            />
          </div>

          <div className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-4 md:left-1/2 md:transform md:-translate-x-1/2 z-20 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:p-0 md:pb-0 md:max-w-[648px]">
            <div
              className={cn(
                "bg-card/95 backdrop-blur-lg rounded-3xl",
                "shadow-[0_0_0_1px_rgba(50,50,50,0.16),0_4px_8px_-0.5px_rgba(50,50,50,0.08),0_8px_16px_-2px_rgba(50,50,50,0.04)]",
                "dark:shadow-none dark:outline dark:outline-1 dark:outline-border",
              )}
            >
              <div className="flex flex-col gap-3 px-3 md:px-3 py-2 md:py-3 relative">
                {/* Active generations indicator */}
                <AnimatePresence mode="wait">
                  {(activeGenerations.size > 0 ||
                    activeVideoGenerations.size > 0 ||
                    isGenerating ||
                    isRemovingVideoBackground ||
                    isIsolating ||
                    isExtendingVideo ||
                    isTransformingVideo ||
                    showSuccess) && (
                    <motion.div
                      key={showSuccess ? "success" : "generating"}
                      initial={{ opacity: 0, y: -10, scale: 0.9, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                      exit={{ opacity: 0, y: -10, scale: 0.9, x: "-50%" }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className={cn(
                        "absolute z-50 -top-16 left-1/2",
                        "rounded-xl",
                        showSuccess
                          ? "shadow-[0_0_0_1px_rgba(34,197,94,0.2),0_4px_8px_-0.5px_rgba(34,197,94,0.08),0_8px_16px_-2px_rgba(34,197,94,0.04)] dark:shadow-none dark:border dark:border-green-500/30"
                          : activeVideoGenerations.size > 0 ||
                              isRemovingVideoBackground ||
                              isExtendingVideo ||
                              isTransformingVideo
                            ? "shadow-[0_0_0_1px_rgba(168,85,247,0.2),0_4px_8px_-0.5px_rgba(168,85,247,0.08),0_8px_16px_-2px_rgba(168,85,247,0.04)] dark:shadow-none dark:border dark:border-purple-500/30"
                            : "shadow-[0_0_0_1px_rgba(87,1,218,0.2),0_4px_8px_-0.5px_rgba(87,1,218,0.08),0_8px_16px_-2px_rgba(87,1,218,0.04)] dark:shadow-none dark:border dark:border-[#5701da]/30",
                      )}
                    >
                      <GenerationsIndicator
                        isAnimating={!showSuccess}
                        isSuccess={showSuccess}
                        className="w-5 h-5"
                        activeGenerationsSize={
                          activeGenerations.size +
                          activeVideoGenerations.size +
                          (isRemovingVideoBackground ? 1 : 0) +
                          (isIsolating ? 1 : 0) +
                          (isExtendingVideo ? 1 : 0) +
                          (isTransformingVideo ? 1 : 0)
                        }
                        outputType={
                          activeVideoGenerations.size > 0 ||
                          isRemovingVideoBackground ||
                          isExtendingVideo ||
                          isTransformingVideo
                            ? "video"
                            : "image"
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <GenerationForm
                  generationSettings={generationSettings}
                  onPromptChange={(prompt) =>
                    setGenerationSettings({ ...generationSettings, prompt })
                  }
                  hasImageToImage={imageToImage.hasSelectedImages}
                  selectedImageSrc={imageToImage.selectedImage?.src}
                  displayModelName={displayMediaModel?.name}
                  displayModelIcon={displayMediaModel?.ui?.icon ?? undefined}
                  displayModelImage={(() => {
                    const artwork =
                      displayMediaModel?.ui?.image ||
                      displayMediaModel?.ui?.icon;
                    return isRenderableMediaUrl(artwork)
                      ? (artwork as string)
                      : undefined;
                  })()}
                  selectedModel={selectedMediaModel as any}
                  isModelsLoading={isModelsLoading}
                  modelsError={modelsError}
                  onOpenModelDialog={() => setIsModelDialogOpen(true)}
                  onOpenModelParameters={(model) => {
                    setSelectedModelForDetails(model as any);
                    setIsModelDetailsDialogOpen(true);
                  }}
                  onRun={handleRun}
                  onUndo={undo}
                  onRedo={redo}
                  onClear={async () => {
                    if (
                      confirm(
                        "Limpar todos os dados salvos? Esta ação não pode ser desfeita.",
                      )
                    ) {
                      await canvasStorage.clearAll();
                      setImages([]);
                      setViewport({ x: 0, y: 0, scale: 1 });
                      toast({
                        title: "Armazenamento limpo",
                        description: "Todos os dados salvos foram removidos",
                      });
                    }
                  }}
                  onOpenSettings={() => setIsSettingsDialogOpen(true)}
                  onFilesSelected={handleFileUpload}
                  onFileUploadError={(error) => {
                    toast({
                      title: "Falha no envio",
                      description:
                        error.message ||
                        "Falha ao processar arquivos selecionados",
                      variant: "destructive",
                    });
                  }}
                  activeGenerationsSize={activeGenerations.size}
                  canUndo={historyIndex > 0}
                  canRedo={historyIndex < history.length - 1}
                />
              </div>
            </div>
          </div>

          {/* Mini-map */}
          {showMinimap && (
            <MiniMap
              images={images}
              videos={videos}
              viewport={viewport}
              canvasSize={canvasSize}
            />
          )}

          {/* {isSaving && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-background/95 border rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
              <SpinnerIcon className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Saving...</span>
            </div>
          )} */}

          {/* Zoom controls */}
          <ZoomControls
            viewport={viewport}
            setViewport={setViewport}
            canvasSize={canvasSize}
            isPanMode={isPanMode}
            onTogglePanMode={togglePanMode}
            onFitToScreen={handleFitToScreen}
          />

          <PoweredByUniteBadge />

          {images.length > 0 && (
            <DimensionDisplay
              selectedImages={images.filter((img) =>
                selectedIds.includes(img.id),
              )}
              viewport={viewport}
            />
          )}
        </div>
      </main>

      {/* Model Selection Dialog */}
      <ModelSelectionDialog
        open={isModelDialogOpen}
        onOpenChange={setIsModelDialogOpen}
        models={mediaModels}
        selectedModelId={generationSettings.styleId}
        hasSelectedImages={imageToImage.hasSelectedImages}
        isLoading={isModelsLoading}
        error={modelsError}
        onModelSelect={(modelId) => {
          setGenerationSettings((prev) => ({
            ...prev,
            loraUrl: "",
            styleId: modelId,
          }));
          setIsModelDialogOpen(false);
        }}
      />

      {/* Settings dialog */}
      <Dialog
        open={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
      >
        <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Appearance */}
            <div className="flex justify-between">
              <div className="flex flex-col gap-2">
                <Label htmlFor="appearance">Aparência</Label>
                <p className="text-sm text-muted-foreground">
                  Personalize como o infinite-kanvas aparece no seu dispositivo.
                </p>
              </div>
              <Select
                value={theme || "system"}
                onValueChange={(value: "system" | "light" | "dark") =>
                  setTheme(value)
                }
              >
                <SelectTrigger className="max-w-[140px] rounded-xl">
                  <div className="flex items-center gap-2">
                    {theme === "light" ? (
                      <SunIcon className="size-4" />
                    ) : theme === "dark" ? (
                      <MoonIcon className="size-4" />
                    ) : (
                      <MonitorIcon className="size-4" />
                    )}
                    <span className="capitalize">
                      {theme === "system"
                        ? "sistema"
                        : theme === "light"
                          ? "claro"
                          : "escuro"}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="system" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <MonitorIcon className="size-4" />
                      <span>Sistema</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="light" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <SunIcon className="size-4" />
                      <span>Claro</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <MoonIcon className="size-4" />
                      <span>Escuro</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid */}
            <div className="flex justify-between">
              <div className="flex flex-col gap-2">
                <Label htmlFor="grid">Mostrar Grade</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe uma grade no canvas para ajudar a alinhar suas imagens.
                </p>
              </div>
              <Switch
                id="grid"
                checked={showGrid}
                onCheckedChange={setShowGrid}
              />
            </div>

            {/* Minimap */}
            <div className="flex justify-between">
              <div className="flex flex-col gap-2">
                <Label htmlFor="minimap">Mostrar Minimapa</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe um minimapa no canto para navegar pelo canvas.
                </p>
              </div>
              <Switch
                id="minimap"
                checked={showMinimap}
                onCheckedChange={setShowMinimap}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image to Video Dialog */}
      <ImageToVideoDialog
        isOpen={isImageToVideoDialogOpen}
        onClose={() => {
          setIsImageToVideoDialogOpen(false);
          setSelectedImageForVideo(null);
        }}
        onConvert={handleImageToVideoConversion}
        imageUrl={
          selectedImageForVideo
            ? images.find((img) => img.id === selectedImageForVideo)?.src || ""
            : ""
        }
        isConverting={isConvertingToVideo}
        models={mediaModels}
        isLoading={isModelsLoading}
        error={modelsError}
      />

      <VideoToVideoDialog
        isOpen={isVideoToVideoDialogOpen}
        onClose={() => {
          setIsVideoToVideoDialogOpen(false);
          setSelectedVideoForVideo(null);
        }}
        onConvert={handleVideoToVideoTransformation}
        videoUrl={
          selectedVideoForVideo
            ? videos.find((vid) => vid.id === selectedVideoForVideo)?.src || ""
            : ""
        }
        isConverting={isTransformingVideo}
      />

      <ExtendVideoDialog
        isOpen={isExtendVideoDialogOpen}
        onClose={() => {
          setIsExtendVideoDialogOpen(false);
          setSelectedVideoForExtend(null);
        }}
        onExtend={handleVideoExtension}
        videoUrl={
          selectedVideoForExtend
            ? videos.find((vid) => vid.id === selectedVideoForExtend)?.src || ""
            : ""
        }
        isExtending={isExtendingVideo}
      />

      <RemoveVideoBackgroundDialog
        isOpen={isRemoveVideoBackgroundDialogOpen}
        onClose={() => {
          setIsRemoveVideoBackgroundDialogOpen(false);
          setSelectedVideoForBackgroundRemoval(null);
        }}
        onProcess={handleVideoBackgroundRemoval}
        videoUrl={
          selectedVideoForBackgroundRemoval
            ? videos.find((vid) => vid.id === selectedVideoForBackgroundRemoval)
                ?.src || ""
            : ""
        }
        videoDuration={
          selectedVideoForBackgroundRemoval
            ? videos.find((vid) => vid.id === selectedVideoForBackgroundRemoval)
                ?.duration || 0
            : 0
        }
        isProcessing={isRemovingVideoBackground}
      />

      {/* Video Generation Streaming Components */}
      {Array.from(activeVideoGenerations.entries()).map(([id, generation]) => (
        <StreamingVideo
          key={id}
          videoId={id}
          generation={generation}
          onComplete={handleVideoGenerationComplete}
          onError={handleVideoGenerationError}
          onProgress={handleVideoGenerationProgress}
        />
      ))}

      {/* Video Controls Overlays */}
      <VideoOverlays
        videos={videos}
        selectedIds={selectedIds}
        viewport={viewport}
        hiddenVideoControlsIds={hiddenVideoControlsIds}
        setVideos={setVideos}
      />
      {/* Model Details Dialog */}
      <ModelDetailsDialog
        open={isModelDetailsDialogOpen}
        onOpenChange={setIsModelDetailsDialogOpen}
        model={selectedModelForDetails as any}
        onSave={(parameters) => {
          setModelParameters(parameters);
          console.log("Parâmetros salvos:", parameters);
        }}
      />
    </div>
  );
}
