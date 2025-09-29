import React from "react";
import { Rect } from "react-konva";
import { useTheme } from "next-themes";
import Konva from "konva";

interface PlaceholderRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isSelected: boolean;
  isDraggable: boolean;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseUp: () => void;
  onDoubleClick?: () => void;
}

export const PlaceholderRect: React.FC<PlaceholderRectProps> = ({
  x,
  y,
  width,
  height,
  rotation,
  isSelected,
  isDraggable,
  cropX,
  cropY,
  cropWidth,
  cropHeight,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  onDoubleClick,
}) => {
  const { theme } = useTheme();
  const [opacity, setOpacity] = React.useState(0.3);

  // Pulsating animation
  React.useEffect(() => {
    let animationFrame: number;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const cycle = (Math.sin(elapsed / 800) + 1) / 2; // 0 to 1
      setOpacity(0.2 + cycle * 0.3); // Oscillate between 0.2 and 0.5
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  const fillColor = theme === "dark" ? "#404040" : "#E5E5E5";
  const strokeColor = isSelected ? "#3b82f6" : "transparent";
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      rotation={rotation}
      fill={fillColor}
      opacity={opacity}
      stroke={isSelected ? "#3b82f6" : isHovered ? "#3b82f6" : "transparent"}
      strokeWidth={isSelected || isHovered ? 2 : 0}
      cornerRadius={8}
      draggable={isDraggable}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onMouseEnter={() => {
        setIsHovered(true);
        onMouseEnter();
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave();
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      crop={
        cropX !== undefined &&
        cropY !== undefined &&
        cropWidth !== undefined &&
        cropHeight !== undefined
          ? {
              x: cropX,
              y: cropY,
              width: cropWidth,
              height: cropHeight,
            }
          : undefined
      }
    />
  );
};
