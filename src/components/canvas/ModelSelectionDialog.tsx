import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpinnerIcon } from "@/components/icons";
import { filterModelsForContext, type MediaModel } from "@/utils/model-utils";

interface ModelSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: MediaModel[];
  selectedModelId: string | undefined;
  hasSelectedImages: boolean;
  isLoading: boolean;
  error: string | null;
  onModelSelect: (modelId: string) => void;
  onCustomSelect: () => void;
}

const isVideoAsset = (value?: string | null): boolean =>
  typeof value === "string" && /\.webm($|\?)/i.test(value);

const isRenderableMediaUrl = (value?: string | null): boolean =>
  typeof value === "string" &&
  (value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/"));

export const ModelSelectionDialog: React.FC<ModelSelectionDialogProps> = ({
  open,
  onOpenChange,
  models,
  selectedModelId,
  hasSelectedImages,
  isLoading,
  error,
  onModelSelect,
  onCustomSelect,
}) => {
  // Filter models based on context
  const filteredModels = useMemo(
    () => filterModelsForContext(models, hasSelectedImages),
    [models, hasSelectedImages],
  );

  const dialogTitle = hasSelectedImages
    ? "Choose Model for Image Edit"
    : "Choose Model";

  const dialogDescription = hasSelectedImages
    ? "Select a model to transform your selected image"
    : "Select a model to generate images or choose Custom to use your own LoRA";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          {/* Fixed gradient overlays */}
          <div className="pointer-events-none absolute -top-[1px] left-0 right-0 z-30 h-4 md:h-12 bg-gradient-to-b from-background via-background/90 to-transparent" />
          <div className="pointer-events-none absolute -bottom-[1px] left-0 right-0 z-30 h-4 md:h-12 bg-gradient-to-t from-background via-background/90 to-transparent" />

          {/* Scrollable content */}
          <div className="overflow-y-auto max-h-[60vh] px-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4 pb-6 md:pt-8 md:pb-12">
              {/* Custom option - only show when no image selected */}
              {!hasSelectedImages && (
                <button
                  onClick={onCustomSelect}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 p-3 rounded-xl border",
                    selectedModelId === "custom"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">Custom</span>
                </button>
              )}

              {isLoading ? (
                <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  <span>Loading models...</span>
                </div>
              ) : error ? (
                <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <span>Failed to load models.</span>
                  <span className="text-xs text-muted-foreground/80">
                    {error}
                  </span>
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <span>
                    {hasSelectedImages
                      ? "No models support image-to-image for the selected image"
                      : "No models available"}
                  </span>
                </div>
              ) : (
                filteredModels.map((model) => {
                  const isSelected = selectedModelId === model.id;
                  const artwork = model.ui?.image || model.ui?.icon;
                  const shouldRenderArtwork = isRenderableMediaUrl(artwork);
                  const artworkUrl = shouldRenderArtwork
                    ? (artwork as string)
                    : "";
                  const typeLabel = model.type.replace(/_/g, " ");

                  return (
                    <div
                      key={model.id}
                      className={cn(
                        "group relative flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <button
                        onClick={() => onModelSelect(model.id)}
                        className="w-full h-full absolute inset-0 z-10"
                      />
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {shouldRenderArtwork ? (
                          isVideoAsset(artworkUrl) ? (
                            <video
                              src={artworkUrl}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={artworkUrl}
                              alt={model.name}
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 p-3 text-center text-xs text-muted-foreground">
                            <span className="text-lg font-semibold uppercase">
                              {model.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                              {typeLabel}
                            </span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <Check className="h-6 w-6 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="text-sm font-medium">
                          {model.name}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {typeLabel}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
