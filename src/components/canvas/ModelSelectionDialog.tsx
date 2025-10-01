import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";
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
}

const isVideoAsset = (value?: string | null): boolean =>
  typeof value === "string" && /\.webm($|\?)/i.test(value);

const isRenderableMediaUrl = (value?: string | null): boolean =>
  typeof value === "string" &&
  (value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/"));

// IDs and types that should not appear in the model selection dialog
const HIDDEN_MODEL_IDS = [
  "ideogram_v3_reframe",
  "face_swap",
  "ideogram_character",
  "flux_dev_lora",
  "flux_kontext_portrait_series",
];
const HIDDEN_MODEL_TYPES = ["upscale", "video"];

export const ModelSelectionDialog: React.FC<ModelSelectionDialogProps> = ({
  open,
  onOpenChange,
  models,
  selectedModelId,
  hasSelectedImages,
  isLoading,
  error,
  onModelSelect,
}) => {
  // Filter models based on context and exclude hidden models
  const filteredModels = useMemo(() => {
    const contextFilteredModels = filterModelsForContext(
      models,
      hasSelectedImages,
    );
    return contextFilteredModels.filter(
      (model) =>
        !HIDDEN_MODEL_IDS.includes(model.id) &&
        !HIDDEN_MODEL_TYPES.includes(model.type),
    );
  }, [models, hasSelectedImages]);

  const dialogTitle = hasSelectedImages
    ? "Escolher Modelo para Editar Imagem"
    : "Escolher Modelo";

  const dialogDescription = hasSelectedImages
    ? "Selecione um modelo para transformar sua imagem selecionada"
    : "Selecione um modelo para gerar imagens";

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
              {isLoading ? (
                <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  <span>Carregando modelos...</span>
                </div>
              ) : error ? (
                <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <span>Falha ao carregar modelos.</span>
                  <span className="text-xs text-muted-foreground/80">
                    {error}
                  </span>
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <span>
                    {hasSelectedImages
                      ? "Nenhum modelo suporta imagem-para-imagem para a imagem selecionada"
                      : "Nenhum modelo disponível"}
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
