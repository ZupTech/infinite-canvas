import { useCallback, useState } from "react";
import type { DragEvent } from "react";
import type Konva from "konva";

import { canvasStorage, type CanvasState } from "@/lib/storage";
import type { PlacedImage, PlacedVideo } from "@/types/canvas";
import {
  imageToCanvasElement,
  videoToCanvasElement,
} from "@/utils/canvas-utils";
import { shouldSkipStorage } from "@/utils/placeholder-utils";
import type { useToast as useToastType } from "@/hooks/use-toast";

interface UseCanvasPersistenceParams {
  images: PlacedImage[];
  videos: PlacedVideo[];
  viewport: { x: number; y: number; scale: number };
  canvasSize: { width: number; height: number };
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setVideos: React.Dispatch<React.SetStateAction<PlacedVideo[]>>;
  setViewport: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; scale: number }>
  >;
  toast: ReturnType<typeof useToastType>["toast"];
}

interface UseCanvasPersistenceResult {
  isStorageLoaded: boolean;
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  handleFileUpload: (
    files: FileList | null,
    position?: { x: number; y: number },
  ) => void;
  handleDrop: (event: DragEvent, stage: Konva.Stage | null) => void;
  loadDefaultImages: () => Promise<void>;
  clearStorage: () => Promise<void>;
}

const DEFAULT_IMAGES = [
  "/hat.png",
  "/man.png",
  "/og-img-compress.png",
  "/chad.png",
  "/anime.png",
  "/cat.jpg",
  "/overlay.png",
];

export function useCanvasPersistence({
  images,
  videos,
  viewport,
  canvasSize,
  setImages,
  setVideos,
  setViewport,
  toast,
}: UseCanvasPersistenceParams): UseCanvasPersistenceResult {
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  const saveToStorage = useCallback(async () => {
    try {
      const canvasState: CanvasState = {
        elements: [
          ...images.map(imageToCanvasElement),
          ...videos.map(videoToCanvasElement),
        ],
        backgroundColor: "#ffffff",
        lastModified: Date.now(),
        viewport,
      };

      canvasStorage.saveCanvasState(canvasState);

      for (const image of images) {
        if (shouldSkipStorage(image.src)) continue;

        const existingImage = await canvasStorage.getImage(image.id);
        if (!existingImage) {
          await canvasStorage.saveImage(image.src, image.id);
        }
      }

      for (const video of videos) {
        if (shouldSkipStorage(video.src)) continue;

        const existingVideo = await canvasStorage.getVideo(video.id);
        if (!existingVideo) {
          await canvasStorage.saveVideo(video.src, video.duration, video.id);
        }
      }

      await canvasStorage.cleanupOldData();
    } catch (error) {
      console.error("Failed to save to storage:", error);
    }
  }, [images, videos, viewport]);

  const loadFromStorage = useCallback(async () => {
    try {
      const storedCanvas = canvasStorage.getCanvasState();
      if (!storedCanvas) {
        setIsStorageLoaded(true);
        return;
      }

      const loadedImages: PlacedImage[] = [];
      const loadedVideos: PlacedVideo[] = [];

      for (const element of storedCanvas.elements) {
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
              isLoaded: false,
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

      if (loadedImages.length > 0) {
        setImages(loadedImages);
      }

      if (loadedVideos.length > 0) {
        setVideos(loadedVideos);
      }

      if (storedCanvas.viewport) {
        setViewport(storedCanvas.viewport);
      }
    } catch (error) {
      console.error("Failed to load from storage:", error);
      toast({
        title: "Failed to restore canvas",
        description: "Starting with a fresh canvas",
        variant: "destructive",
      });
    } finally {
      setIsStorageLoaded(true);
    }
  }, [setImages, setVideos, setViewport, toast]);

  const loadDefaultImages = useCallback(async () => {
    for (let i = 0; i < DEFAULT_IMAGES.length; i++) {
      const path = DEFAULT_IMAGES[i];
      try {
        const response = await fetch(path);
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onload = (event) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
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

            const spacing = 250;
            const totalWidth = spacing * (DEFAULT_IMAGES.length - 1);
            const viewportCenterX = canvasSize.width / 2;
            const viewportCenterY = canvasSize.height / 2;
            const startX = viewportCenterX - totalWidth / 2;
            const x = startX + i * spacing - width / 2;
            const y = viewportCenterY - height / 2;

            setImages((prev) => [
              ...prev,
              {
                id,
                src: event.target?.result as string,
                x,
                y,
                width,
                height,
                rotation: 0,
              },
            ]);
          };
          img.src = event.target?.result as string;
        };

        reader.readAsDataURL(blob);
      } catch (error) {
        console.error(`Failed to load default image ${path}:`, error);
      }
    }
  }, [canvasSize.height, canvasSize.width, setImages]);

  const handleFileUpload = useCallback(
    (files: FileList | null, position?: { x: number; y: number }) => {
      if (!files) return;

      Array.from(files).forEach((file, index) => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const id = `img-${Date.now()}-${Math.random()}`;
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const aspectRatio = img.width / img.height;
              const maxSize = 300;
              let width = maxSize;
              let height = maxSize / aspectRatio;

              if (height > maxSize) {
                height = maxSize;
                width = maxSize * aspectRatio;
              }

              let x: number;
              let y: number;

              if (position) {
                x = (position.x - viewport.x) / viewport.scale - width / 2;
                y = (position.y - viewport.y) / viewport.scale - height / 2;
              } else {
                const viewportCenterX =
                  (canvasSize.width / 2 - viewport.x) / viewport.scale;
                const viewportCenterY =
                  (canvasSize.height / 2 - viewport.y) / viewport.scale;
                x = viewportCenterX - width / 2;
                y = viewportCenterY - height / 2;
              }

              if (index > 0) {
                x += index * 20;
                y += index * 20;
              }

              setImages((prev) => [
                ...prev,
                {
                  id,
                  src: event.target?.result as string,
                  x,
                  y,
                  width,
                  height,
                  rotation: 0,
                },
              ]);
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
        }
      });
    },
    [
      canvasSize.height,
      canvasSize.width,
      setImages,
      viewport.x,
      viewport.y,
      viewport.scale,
    ],
  );

  const handleDrop = useCallback(
    (event: DragEvent, stage: Konva.Stage | null) => {
      event.preventDefault();

      if (stage) {
        const container = stage.container();
        const rect = container.getBoundingClientRect();
        const dropPosition = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        handleFileUpload(event.dataTransfer.files, dropPosition);
      } else {
        handleFileUpload(event.dataTransfer.files);
      }
    },
    [handleFileUpload],
  );

  const clearStorage = useCallback(async () => {
    try {
      await canvasStorage.clearAll();
    } catch (error) {
      console.error("Failed to clear storage:", error);
      throw error;
    }
  }, []);

  return {
    isStorageLoaded,
    saveToStorage,
    loadFromStorage,
    handleFileUpload,
    handleDrop,
    loadDefaultImages,
    clearStorage,
  };
}
