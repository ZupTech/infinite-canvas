import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Undo,
  Redo,
  Trash2,
  SlidersHorizontal,
  PlayIcon,
  Paperclip,
  ChevronDown,
} from "lucide-react";
import { SpinnerIcon } from "@/components/icons";
import { checkOS } from "@/utils/os-utils";
import { MAX_CONCURRENT_GENERATIONS } from "@/utils/constants";
import { ModelParametersButton } from "./ModelParametersButton";
import { ShortcutBadge } from "./ShortcutBadge";
import type { GenerationSettings } from "@/types/canvas";
import type { MediaModel } from "@/utils/model-utils";

interface GenerationFormProps {
  // Settings
  generationSettings: GenerationSettings;
  onPromptChange: (prompt: string) => void;

  // Image to image
  hasImageToImage: boolean;
  selectedImageSrc?: string;

  // Model selection
  displayModelName?: string;
  displayModelIcon?: string;
  displayModelImage?: string;
  selectedModel?: MediaModel | null;
  isModelsLoading: boolean;
  modelsError: string | null;
  onOpenModelDialog: () => void;
  onOpenModelParameters: (model: MediaModel) => void;

  // Actions
  onRun: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onOpenSettings: () => void;
  onFilesSelected: (files: FileList | null) => void;
  onFileUploadError?: (error: Error) => void;

  // State
  activeGenerationsSize: number;
  canUndo: boolean;
  canRedo: boolean;
}

export const GenerationForm: React.FC<GenerationFormProps> = ({
  generationSettings,
  onPromptChange,
  hasImageToImage,
  selectedImageSrc,
  displayModelName,
  displayModelIcon,
  displayModelImage,
  selectedModel,
  isModelsLoading,
  modelsError,
  onOpenModelDialog,
  onOpenModelParameters,
  onRun,
  onUndo,
  onRedo,
  onClear,
  onOpenSettings,
  onFilesSelected,
  onFileUploadError,
  activeGenerationsSize,
  canUndo,
  canRedo,
}) => {
  const handleAttachFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;

    // Hide input (better mobile support)
    input.style.position = "fixed";
    input.style.top = "-1000px";
    input.style.left = "-1000px";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    input.style.width = "1px";
    input.style.height = "1px";

    input.onchange = (e) => {
      try {
        onFilesSelected((e.target as HTMLInputElement).files);
      } catch (error) {
        console.error("File upload error:", error);
        if (onFileUploadError && error instanceof Error) {
          onFileUploadError(error);
        }
      } finally {
        if (input.parentNode) {
          document.body.removeChild(input);
        }
      }
    };

    input.onerror = () => {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    };

    document.body.appendChild(input);

    setTimeout(() => {
      try {
        input.click();
      } catch (error) {
        console.error("Failed to trigger file dialog:", error);
        if (onFileUploadError && error instanceof Error) {
          onFileUploadError(error);
        }
        if (input.parentNode) {
          document.body.removeChild(input);
        }
      }
    }, 10);

    // Cleanup after timeout in case dialog was cancelled
    setTimeout(() => {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    }, 30000);
  };

  return (
    <div className="flex flex-col gap-3 px-3 md:px-3 py-2 md:py-3 relative">
      {/* Top bar: Undo/Redo, Mode Badge, Actions */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo */}
        <div className="flex items-center bg-secondary/50 rounded-xl overflow-hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded-none"
            title="Desfazer"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="rounded-none"
            title="Refazer"
          >
            <Redo className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>

        {/* Mode indicator badge */}
        <div
          className={cn(
            "h-9 rounded-xl overflow-clip flex items-center px-3",
            "pointer-events-none select-none",
            hasImageToImage
              ? "bg-blue-500/10 dark:bg-blue-500/15 shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_4px_8px_-0.5px_rgba(59,130,246,0.08),0_8px_16px_-2px_rgba(59,130,246,0.04)] dark:shadow-none dark:border dark:border-blue-500/30"
              : "bg-orange-500/10 dark:bg-orange-500/15 shadow-[0_0_0_1px_rgba(249,115,22,0.2),0_4px_8px_-0.5px_rgba(249,115,22,0.08),0_8px_16px_-2px_rgba(249,115,22,0.04)] dark:shadow-none dark:border dark:border-orange-500/30",
          )}
        >
          {hasImageToImage ? (
            <div className="flex items-center gap-2 text-xs font-medium">
              <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-500" />
              <span className="text-blue-600 dark:text-blue-500">
                Imagem para Imagem
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="text-orange-600 dark:text-orange-500 font-bold text-sm">
                T
              </span>
              <span className="text-orange-600 dark:text-orange-500">
                Texto para Imagem
              </span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {/* Clear button */}
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={onClear}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                  title="Limpar armazenamento"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-destructive">
                <span>Limpar</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Settings button */}
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="relative"
                  onClick={onOpenSettings}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span>Configurações</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Prompt textarea */}
      <div className="relative">
        <Textarea
          value={generationSettings.prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={`Digite um prompt... (${checkOS("Win") || checkOS("Linux") ? "Ctrl" : "⌘"}+Enter para executar)`}
          className="w-full h-20 resize-none border-none p-2 pr-36"
          style={{ fontSize: "16px" }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (
                activeGenerationsSize < MAX_CONCURRENT_GENERATIONS &&
                generationSettings.prompt.trim()
              ) {
                onRun();
              }
            }
          }}
        />

        {/* Selected image thumbnail */}
        {hasImageToImage && selectedImageSrc && (
          <div className="absolute top-1 right-2 flex items-center justify-end">
            <div className="relative h-12 w-20">
              <div
                className="absolute rounded-lg border border-border/20 bg-background overflow-hidden"
                style={{
                  right: "0px",
                  top: "0px",
                  zIndex: 3,
                  width: "40px",
                  height: "40px",
                }}
              >
                <img
                  src={selectedImageSrc}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar: Model selector, Parameters, Attach, Run */}
      <div className="flex items-center justify-between">
        {/* Model selector button */}
        <Button
          variant="secondary"
          className="flex items-center gap-2"
          onClick={onOpenModelDialog}
        >
          {isModelsLoading ? (
            <>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading models...</span>
            </>
          ) : modelsError ? (
            <>
              <div className="w-5 h-5 flex items-center justify-center rounded-xl bg-destructive/20 text-[10px] font-medium uppercase text-destructive">
                !
              </div>
              <span className="text-sm">Failed to load models</span>
            </>
          ) : displayModelName ? (
            <>
              {displayModelImage ? (
                <img
                  src={displayModelImage}
                  alt=""
                  className="w-5 h-5 rounded-xl object-cover"
                />
              ) : (
                <div className="w-5 h-5 flex items-center justify-center rounded-xl bg-muted text-[10px] font-medium uppercase">
                  {displayModelIcon || "🎨"}
                </div>
              )}
              <span className="text-sm font-medium">{displayModelName}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </>
          ) : (
            <>
              <div className="w-5 h-5 flex items-center justify-center rounded-xl bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                N/A
              </div>
              <span className="text-sm">Select a model</span>
            </>
          )}
        </Button>

        <div className="flex items-center gap-2">
          {/* Model parameters button */}
          <ModelParametersButton
            model={(selectedModel || null) as any}
            onOpenParameters={onOpenModelParameters as any}
          />

          {/* Attach file button */}
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleAttachFile}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span>Enviar</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Run button */}
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  onClick={onRun}
                  variant="primary"
                  size="icon"
                  disabled={
                    activeGenerationsSize >= MAX_CONCURRENT_GENERATIONS ||
                    !generationSettings.prompt.trim()
                  }
                  className="gap-2 font-medium transition-all"
                >
                  <PlayIcon className="h-4 w-4 text-white fill-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex items-center gap-2">
                  <span>Executar</span>
                  <ShortcutBadge
                    variant="default"
                    size="xs"
                    shortcut={
                      checkOS("Win") || checkOS("Linux")
                        ? "ctrl+enter"
                        : "meta+enter"
                    }
                  />
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
