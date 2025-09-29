import { useCallback, useEffect, useState } from "react";

import type { HistoryState, PlacedImage, PlacedVideo } from "@/types/canvas";

interface UseCanvasHistoryParams {
  images: PlacedImage[];
  videos: PlacedVideo[];
  selectedIds: string[];
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setVideos: React.Dispatch<React.SetStateAction<PlacedVideo[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
}

interface UseCanvasHistoryResult {
  history: HistoryState[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
}

export function useCanvasHistory({
  images,
  videos,
  selectedIds,
  setImages,
  setVideos,
  setSelectedIds,
}: UseCanvasHistoryParams): UseCanvasHistoryResult {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const saveToHistory = useCallback(() => {
    const newState: HistoryState = {
      images: [...images],
      videos: [...videos],
      selectedIds: [...selectedIds],
    };

    setHistory((prev) => {
      const nextIndex = Math.min(historyIndex + 1, prev.length);
      const next = prev.slice(0, nextIndex);
      next.push(newState);
      setHistoryIndex(nextIndex);
      return next;
    });
  }, [historyIndex, images, selectedIds, videos]);

  const undo = useCallback(() => {
    setHistoryIndex((prev) => {
      if (prev <= 0) {
        return prev;
      }

      const previousState = history[prev - 1];
      if (previousState) {
        setImages(previousState.images);
        setVideos(previousState.videos || []);
        setSelectedIds(previousState.selectedIds);
      }

      return prev - 1;
    });
  }, [history, setImages, setSelectedIds, setVideos]);

  const redo = useCallback(() => {
    setHistoryIndex((prev) => {
      if (prev >= history.length - 1) {
        return prev;
      }

      const nextState = history[prev + 1];
      if (nextState) {
        setImages(nextState.images);
        setVideos(nextState.videos || []);
        setSelectedIds(nextState.selectedIds);
      }

      return prev + 1;
    });
  }, [history, setImages, setSelectedIds, setVideos]);

  useEffect(() => {
    if (history.length === 0) {
      saveToHistory();
    }
  }, [history.length, saveToHistory]);

  return {
    history,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    saveToHistory,
    undo,
    redo,
  };
}
