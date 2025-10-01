import React from "react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShortcutBadge } from "./ShortcutBadge";
import {
  Play,
  Copy,
  Crop,
  Scissors,
  Filter,
  Combine,
  Download,
  X,
  Layers,
  ChevronUp,
  ChevronDown,
  MoveUp,
  MoveDown,
  Video,
  FilePlus,
} from "lucide-react";
import { SpinnerIcon } from "@/components/icons";
import { checkOS } from "@/utils/os-utils";
import { exportVideoAsGif } from "@/utils/gif-export";
import type {
  PlacedImage,
  PlacedVideo,
  GenerationSettings,
} from "@/types/canvas";
import { MAX_CONCURRENT_GENERATIONS } from "@/utils/constants";

interface CanvasContextMenuProps {
  selectedIds: string[];
  images: PlacedImage[];
  videos?: PlacedVideo[];
  activeGenerationsSize: number;
  generationSettings: GenerationSettings;
  isolateInputValue: string;
  isIsolating: boolean;
  handleRun: () => void;
  handleDuplicate: () => void;
  handleRemoveBackground: () => void;
  handleCombineImages: () => void;
  handleDelete: () => void;
  handleIsolate: () => void;
  handleConvertToVideo?: (imageId: string) => void;
  handleVideoToVideo?: (videoId: string) => void;
  handleExtendVideo?: (videoId: string) => void;
  handleRemoveVideoBackground?: (videoId: string) => void;
  setCroppingImageId: (id: string | null) => void;
  setIsolateInputValue: (value: string) => void;
  setIsolateTarget: (id: string | null) => void;
  sendToFront: () => void;
  sendToBack: () => void;
  bringForward: () => void;
  sendBackward: () => void;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  selectedIds,
  images,
  videos = [], // Provide a default empty array
  activeGenerationsSize,
  generationSettings,
  isolateInputValue,
  isIsolating,
  handleRun,
  handleDuplicate,
  handleRemoveBackground,
  handleCombineImages,
  handleDelete,
  handleIsolate,
  handleConvertToVideo,
  handleVideoToVideo,
  handleExtendVideo,
  handleRemoveVideoBackground,
  setCroppingImageId,
  setIsolateInputValue,
  setIsolateTarget,
  sendToFront,
  sendToBack,
  bringForward,
  sendBackward,
}) => {
  return (
    <ContextMenuContent>
      <ContextMenuItem
        onClick={handleRun}
        disabled={
          activeGenerationsSize >= MAX_CONCURRENT_GENERATIONS ||
          !generationSettings.prompt.trim()
        }
        className="flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-content" />
          <span>Executar</span>
        </div>
        <ShortcutBadge
          variant="alpha"
          size="xs"
          shortcut={
            checkOS("Win") || checkOS("Linux") ? "ctrl+enter" : "meta+enter"
          }
        />
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleDuplicate}
        disabled={selectedIds.length === 0}
        className="flex items-center gap-2"
      >
        <Copy className="h-4 w-4" />
        Duplicar
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          if (selectedIds.length === 1) {
            setCroppingImageId(selectedIds[0]);
          }
        }}
        disabled={
          selectedIds.length !== 1 ||
          videos?.some((v) => selectedIds.includes(v.id))
        }
        className="flex items-center gap-2"
      >
        <Crop className="h-4 w-4" />
        Cortar
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleRemoveBackground}
        disabled={
          selectedIds.length === 0 ||
          videos?.some((v) => selectedIds.includes(v.id))
        }
        className="flex items-center gap-2"
      >
        <Scissors className="h-4 w-4" />
        Remover Fundo
      </ContextMenuItem>
      {selectedIds.length === 1 &&
        handleConvertToVideo &&
        images.some((img) => img.id === selectedIds[0]) && (
          <ContextMenuItem
            onClick={() => {
              handleConvertToVideo(selectedIds[0]);
            }}
            className="flex items-center gap-2"
          >
            <Video className="h-4 w-4" />
            Imagem para Vídeo
          </ContextMenuItem>
        )}
      {/* Temporarily disabled Video to Video option
      {selectedIds.length === 1 &&
        handleVideoToVideo &&
        videos?.some((v) => v.id === selectedIds[0]) && (
          <ContextMenuItem
            onClick={() => {
              handleVideoToVideo(selectedIds[0]);
            }}
            className="flex items-center gap-2"
          >
            <Video className="h-4 w-4" />
            Video to Video
          </ContextMenuItem>
        )} */}
      {selectedIds.length === 1 &&
        handleExtendVideo &&
        videos?.some((v) => v.id === selectedIds[0]) && (
          <ContextMenuItem
            onClick={() => {
              handleExtendVideo(selectedIds[0]);
            }}
            className="flex items-center gap-2"
          >
            <FilePlus className="h-4 w-4" />
            Estender Vídeo
          </ContextMenuItem>
        )}
      {selectedIds.length === 1 &&
        handleRemoveVideoBackground &&
        videos?.some((v) => v.id === selectedIds[0]) && (
          <ContextMenuItem
            onClick={() => {
              handleRemoveVideoBackground(selectedIds[0]);
            }}
            className="flex items-center gap-2"
          >
            <Scissors className="h-4 w-4" />
            Remover Fundo do Vídeo
          </ContextMenuItem>
        )}
      <ContextMenuSub>
        <ContextMenuSubTrigger
          disabled={
            selectedIds.length !== 1 ||
            videos?.some((v) => selectedIds.includes(v.id))
          }
          className="flex items-center gap-2"
          onMouseEnter={() => {
            // Reset input value and set target when hovering over the submenu trigger
            setIsolateInputValue("");
            if (
              selectedIds.length === 1 &&
              !videos?.some((v) => v.id === selectedIds[0])
            ) {
              setIsolateTarget(selectedIds[0]);
            }
          }}
        >
          <Filter className="h-4 w-4" />
          Isolar Objeto
        </ContextMenuSubTrigger>
        <ContextMenuSubContent
          className="w-72 p-3"
          sideOffset={10}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div
            className="flex flex-col gap-2"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Label
              htmlFor="isolate-context-input"
              className="text-sm font-medium"
            >
              O que isolar:
            </Label>
            <div className="flex gap-2">
              <Input
                id="isolate-context-input"
                type="text"
                placeholder="ex: carro, rosto, pessoa"
                value={isolateInputValue}
                onChange={(e) => setIsolateInputValue(e.target.value)}
                style={{ fontSize: "16px" }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    isolateInputValue.trim() &&
                    !isIsolating
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleIsolate();
                  }
                }}
                onFocus={(e) => {
                  // Select all text on focus for easier replacement
                  e.target.select();
                }}
                className="flex-1"
                autoFocus
                disabled={isIsolating}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isolateInputValue.trim() && !isIsolating) {
                    handleIsolate();
                  }
                }}
                disabled={!isolateInputValue.trim() || isIsolating}
              >
                {isIsolating ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin mr-1 text-white" />
                    <span className="text-white">Processando...</span>
                  </>
                ) : (
                  <>
                    <span className="text-white">Executar</span>
                    <span className="flex flex-row space-x-0.5">
                      <kbd className="flex items-center justify-center text-white tracking-tighter rounded-xl border px-1 font-mono bg-white/10 border-white/10 h-6 min-w-6 text-xs">
                        ↵
                      </kbd>
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem
        onClick={handleCombineImages}
        disabled={selectedIds.length < 2}
        className="flex items-center gap-2"
      >
        <Combine className="h-4 w-4" />
        Combinar Imagens
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger
          disabled={
            selectedIds.length === 0 ||
            videos?.some((v) => selectedIds.includes(v.id))
          }
          className="flex items-center gap-2"
        >
          <Layers className="h-4 w-4" />
          Ordem das Camadas
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-64" sideOffset={10}>
          <ContextMenuItem
            onClick={sendToFront}
            disabled={selectedIds.length === 0}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <MoveUp className="h-4 w-4" />
              <span>Trazer para Frente</span>
            </div>
            <ShortcutBadge
              variant="alpha"
              size="xs"
              shortcut={
                checkOS("Win") || checkOS("Linux") ? "ctrl+]" : "meta+]"
              }
            />
          </ContextMenuItem>
          <ContextMenuItem
            onClick={bringForward}
            disabled={selectedIds.length === 0}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <ChevronUp className="h-4 w-4" />
              <span>Avançar</span>
            </div>
            <ShortcutBadge variant="alpha" size="xs" shortcut="]" />
          </ContextMenuItem>
          <ContextMenuItem
            onClick={sendBackward}
            disabled={selectedIds.length === 0}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              <span>Recuar</span>
            </div>
            <ShortcutBadge variant="alpha" size="xs" shortcut="[" />
          </ContextMenuItem>
          <ContextMenuItem
            onClick={sendToBack}
            disabled={selectedIds.length === 0}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <MoveDown className="h-4 w-4" />
              <span>Enviar para Trás</span>
            </div>
            <ShortcutBadge
              variant="alpha"
              size="xs"
              shortcut={
                checkOS("Win") || checkOS("Linux") ? "ctrl+[" : "meta+["
              }
            />
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      {selectedIds.length === 1 &&
        videos?.some((v) => v.id === selectedIds[0]) && (
          <ContextMenuItem
            onClick={async () => {
              const video = videos.find((v) => v.id === selectedIds[0]);
              if (video) {
                try {
                  await exportVideoAsGif(video.src);
                } catch (error) {
                  console.error("Failed to export GIF:", error);
                }
              }
            }}
            className="flex items-center gap-2"
          >
            <Video className="h-4 w-4" />
            Exportar GIF
          </ContextMenuItem>
        )}
      <ContextMenuItem
        onClick={async () => {
          for (const id of selectedIds) {
            const image = images.find((img) => img.id === id);
            const video = videos?.find((vid) => vid.id === id);

            if (image) {
              const link = document.createElement("a");
              link.download = `image-${Date.now()}.png`;
              link.href = image.src;
              link.click();
            } else if (video) {
              try {
                // For videos, we need to fetch as blob to force download
                const response = await fetch(video.src);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.download = `video-${Date.now()}.mp4`;
                link.href = blobUrl;
                link.click();

                // Clean up the blob URL after a short delay
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
              } catch (error) {
                console.error("Failed to download video:", error);
                // Fallback to regular download if fetch fails
                const link = document.createElement("a");
                link.download = `video-${Date.now()}.mp4`;
                link.href = video.src;
                link.target = "_blank";
                link.click();
              }
            }
          }
        }}
        disabled={selectedIds.length === 0}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        Baixar
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleDelete}
        disabled={selectedIds.length === 0}
        className="flex items-center gap-2 text-destructive"
      >
        <X className="h-4 w-4" />
        Excluir
      </ContextMenuItem>
    </ContextMenuContent>
  );
};
