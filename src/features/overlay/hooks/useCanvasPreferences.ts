import { useEffect, useState } from "react";

export function useCanvasPreferences() {
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);

  useEffect(() => {
    const savedShowGrid = localStorage.getItem("showGrid");
    if (savedShowGrid !== null) {
      setShowGrid(savedShowGrid === "true");
    }
  }, []);

  useEffect(() => {
    const savedShowMinimap = localStorage.getItem("showMinimap");
    if (savedShowMinimap !== null) {
      setShowMinimap(savedShowMinimap === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("showGrid", showGrid.toString());
  }, [showGrid]);

  useEffect(() => {
    localStorage.setItem("showMinimap", showMinimap.toString());
  }, [showMinimap]);

  return {
    showGrid,
    setShowGrid,
    showMinimap,
    setShowMinimap,
  };
}
