import { useState, useCallback } from "react";

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface CanvasElement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface UseCanvasNavigationProps {
  canvasSize: {
    width: number;
    height: number;
  };
}

export const useCanvasNavigation = ({
  canvasSize,
}: UseCanvasNavigationProps) => {
  const [isPanMode, setIsPanMode] = useState(false);

  const setPanMode = useCallback((pan: boolean) => {
    setIsPanMode(pan);
  }, []);

  const togglePanMode = useCallback(() => {
    setIsPanMode((prev) => !prev);
  }, []);

  const fitToScreen = useCallback(
    (elements: CanvasElement[], setViewport: (viewport: Viewport) => void) => {
      if (elements.length === 0) {
        // If no elements, just reset to center
        setViewport({ x: 0, y: 0, scale: 1 });
        return;
      }

      // Calculate bounding box of all elements
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      elements.forEach((element) => {
        if (element.rotation) {
          // Calculate rotated bounding box
          const rad = (element.rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          // Get all four corners of the rotated rectangle
          const corners = [
            { x: 0, y: 0 },
            { x: element.width, y: 0 },
            { x: element.width, y: element.height },
            { x: 0, y: element.height },
          ];

          corners.forEach((corner) => {
            const rotatedX = corner.x * cos - corner.y * sin + element.x;
            const rotatedY = corner.x * sin + corner.y * cos + element.y;

            minX = Math.min(minX, rotatedX);
            minY = Math.min(minY, rotatedY);
            maxX = Math.max(maxX, rotatedX);
            maxY = Math.max(maxY, rotatedY);
          });
        } else {
          // Non-rotated bounding box
          const left = element.x;
          const top = element.y;
          const right = element.x + element.width;
          const bottom = element.y + element.height;

          minX = Math.min(minX, left);
          minY = Math.min(minY, top);
          maxX = Math.max(maxX, right);
          maxY = Math.max(maxY, bottom);
        }
      });

      // Add some padding (10% of the content size)
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const padding = Math.max(contentWidth, contentHeight) * 0.1;

      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      // Calculate the scale to fit the content
      const finalContentWidth = maxX - minX;
      const finalContentHeight = maxY - minY;

      // Handle edge case: elements with zero or very small dimensions
      if (finalContentWidth < 1 || finalContentHeight < 1) {
        setViewport({
          x: canvasSize.width / 2 - (minX + maxX) / 2,
          y: canvasSize.height / 2 - (minY + maxY) / 2,
          scale: 1,
        });
        return;
      }

      const scaleX = canvasSize.width / finalContentWidth;
      const scaleY = canvasSize.height / finalContentHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in more than 100%

      // Calculate the center position
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Set viewport to center the content
      setViewport({
        x: canvasSize.width / 2 - centerX * scale,
        y: canvasSize.height / 2 - centerY * scale,
        scale,
      });
    },
    [canvasSize],
  );

  return {
    isPanMode,
    setPanMode,
    togglePanMode,
    fitToScreen,
  };
};
