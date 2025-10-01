import React from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Hand, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoomControlsProps {
  viewport: {
    x: number;
    y: number;
    scale: number;
  };
  setViewport: (viewport: { x: number; y: number; scale: number }) => void;
  canvasSize: {
    width: number;
    height: number;
  };
  isPanMode?: boolean;
  onTogglePanMode?: () => void;
  onFitToScreen?: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  viewport,
  setViewport,
  canvasSize,
  isPanMode = false,
  onTogglePanMode,
  onFitToScreen,
}) => {
  const handleZoomIn = () => {
    const newScale = Math.min(5, viewport.scale * 1.2);
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    // Zoom towards center
    const mousePointTo = {
      x: (centerX - viewport.x) / viewport.scale,
      y: (centerY - viewport.y) / viewport.scale,
    };

    setViewport({
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
      scale: newScale,
    });
  };

  const handleZoomOut = () => {
    const newScale = Math.max(0.1, viewport.scale / 1.2);
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    // Zoom towards center
    const mousePointTo = {
      x: (centerX - viewport.x) / viewport.scale,
      y: (centerY - viewport.y) / viewport.scale,
    };

    setViewport({
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
      scale: newScale,
    });
  };

  const handleResetZoom = () => {
    // Reset zoom to 100% but keep current pan position
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    const mousePointTo = {
      x: (centerX - viewport.x) / viewport.scale,
      y: (centerY - viewport.y) / viewport.scale,
    };

    setViewport({
      x: centerX - mousePointTo.x,
      y: centerY - mousePointTo.y,
      scale: 1,
    });
  };

  return (
    <div className="absolute bottom-4 left-4 flex-col hidden md:flex items-start gap-4 z-20">
      <div
        className={cn(
          "flex flex-col bg-card rounded-xl overflow-clip",
          "shadow-[0_0_0_1px_rgba(50,50,50,0.16),0_4px_8px_-0.5px_rgba(50,50,50,0.08),0_8px_16px_-2px_rgba(50,50,50,0.04)]",
          "dark:shadow-none dark:border dark:border-border",
        )}
      >
        {/* Hand/Pan Tool */}
        {onTogglePanMode && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePanMode}
              className={cn(
                "w-10 h-10 p-0 rounded-none",
                isPanMode && "bg-primary/10 text-primary hover:bg-primary/20",
              )}
              title="Ferramenta Mão (Space)"
            >
              <Hand className="h-4 w-4" />
            </Button>
            <div className="h-px bg-border/40 mx-2" />
          </>
        )}

        {/* Zoom In */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          className="w-10 h-10 p-0 rounded-none"
          title="Aumentar Zoom"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="h-px bg-border/40 mx-2" />

        {/* Zoom Out */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          className="w-10 h-10 p-0 rounded-none"
          title="Diminuir Zoom"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="h-px bg-border/40 mx-2" />

        {/* Reset Zoom to 100% */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetZoom}
          className="w-10 h-10 p-0 rounded-none"
          title="Resetar Zoom (100%)"
        >
          <Minimize2 className="h-4 w-4" />
        </Button>

        {/* Fit to Screen */}
        {onFitToScreen && (
          <>
            <div className="h-px bg-border/40 mx-2" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onFitToScreen}
              className="w-10 h-10 p-0 rounded-none"
              title="Ajustar à Tela"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Zoom percentage indicator */}
      <div
        className={cn(
          "text-xs text-muted-foreground text-center bg-card px-2 py-2 rounded-lg",
          "shadow-[0_0_0_1px_rgba(50,50,50,0.16),0_4px_8px_-0.5px_rgba(50,50,50,0.08),0_8px_16px_-2px_rgba(50,50,50,0.04)]",
          "dark:shadow-none dark:border dark:border-border",
        )}
      >
        {Math.round(viewport.scale * 100)}%
      </div>
    </div>
  );
};
