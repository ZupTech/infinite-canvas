import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VideoGenerationSettings } from "@/types/canvas";
import { SpinnerIcon } from "@/components/icons";
import { ChevronRight, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MediaModel } from "@/utils/model-utils";
import { supportsImageInput } from "@/utils/model-utils";

interface MediaModelParameter {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  uiPriority?: "primary" | "secondary";
}

interface ImageToVideoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConvert: (settings: VideoGenerationSettings) => void;
  imageUrl: string;
  isConverting: boolean;
  models: MediaModel[];
  isLoading: boolean;
  error: string | null;
}

const buildInitialValues = (model: MediaModel | null) => {
  if (!model?.parameters) {
    return {} as Record<string, any>;
  }

  const values: Record<string, any> = {};

  model.parameters.forEach((param) => {
    if (param.type === "file" || param.type === "multifile") {
      return;
    }

    if (param.default !== undefined) {
      values[param.name] = param.default;
    } else if (param.type === "boolean" || param.type === "switch") {
      values[param.name] = false;
    } else {
      values[param.name] = "";
    }
  });

  if (values.prompt === undefined) {
    values.prompt = "";
  }

  return values;
};

const isSecondary = (param: MediaModelParameter) =>
  param.uiPriority === "secondary";

const normalizeNumber = (value: string) => {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

export const ImageToVideoDialog: React.FC<ImageToVideoDialogProps> = ({
  isOpen,
  onClose,
  onConvert,
  imageUrl,
  isConverting,
  models,
  isLoading,
  error,
}) => {
  const videoModels = useMemo(
    () =>
      models.filter(
        (model) => model.type === "video" && supportsImageInput(model),
      ),
    [models],
  );

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [optionValues, setOptionValues] = useState<Record<string, any>>({});
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  useEffect(() => {
    if (videoModels.length === 0) {
      setSelectedModelId(null);
      setOptionValues({});
      return;
    }

    const existingSelection = videoModels.find(
      (model) => model.id === selectedModelId,
    );
    if (existingSelection) {
      return;
    }

    const defaultModel =
      videoModels.find((model) => model.featured) ?? videoModels[0];
    setSelectedModelId(defaultModel.id);
    setOptionValues(buildInitialValues(defaultModel));
  }, [videoModels, selectedModelId]);

  const selectedModel = useMemo(
    () => videoModels.find((model) => model.id === selectedModelId) ?? null,
    [videoModels, selectedModelId],
  );

  useEffect(() => {
    if (!selectedModel) {
      setOptionValues({});
      return;
    }

    setOptionValues(buildInitialValues(selectedModel));
  }, [selectedModel?.id]);

  const handleOptionChange = (field: string, value: any) => {
    setOptionValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedModel) {
      return;
    }

    const settings: VideoGenerationSettings = {
      ...optionValues,
      prompt:
        typeof optionValues.prompt === "string"
          ? optionValues.prompt
          : (optionValues.prompt ?? ""),
      sourceUrl: imageUrl,
      modelId: selectedModel.id,
      styleId: selectedModel.id,
    };

    onConvert(settings);
  };

  const visibleParameters: MediaModelParameter[] = useMemo(() => {
    if (!selectedModel?.parameters) return [];
    return selectedModel.parameters.filter(
      (param) =>
        param.type !== "hidden" &&
        param.type !== "file" &&
        param.type !== "multifile",
    );
  }, [selectedModel]);

  const promptParam = visibleParameters.find(
    (param) => param.name === "prompt",
  );
  const primaryParams = visibleParameters.filter(
    (param) => param.name !== "prompt" && !isSecondary(param),
  );
  const secondaryParams = visibleParameters.filter(
    (param) => param.name !== "prompt" && isSecondary(param),
  );

  const renderParameterField = (param: MediaModelParameter) => {
    const value = optionValues[param.name];
    const normalizedType = param.type.toLowerCase();

    const description =
      param.description && param.description.trim().length > 0
        ? param.description
        : null;

    const fieldId = `video-param-${param.name}`;

    const commonLabel = (
      <Label htmlFor={fieldId} className="text-sm font-medium">
        {param.label || param.name}
        {param.required && <span className="text-destructive ml-1">*</span>}
      </Label>
    );

    const descriptionElement = description ? (
      <p className="text-xs text-muted-foreground">{description}</p>
    ) : null;

    if (normalizedType === "textarea") {
      return (
        <div key={param.name} className="space-y-1">
          {commonLabel}
          {descriptionElement}
          <Textarea
            id={fieldId}
            value={value ?? ""}
            onChange={(event) =>
              handleOptionChange(param.name, event.target.value)
            }
            placeholder={param.placeholder}
            disabled={isConverting}
            required={param.required}
            className="min-h-[120px]"
          />
        </div>
      );
    }

    if (
      normalizedType === "select" ||
      (param.options && param.options.length > 0)
    ) {
      const stringValue = value === undefined ? "" : String(value);

      return (
        <div key={param.name} className="space-y-1">
          {commonLabel}
          {descriptionElement}
          <Select
            value={stringValue}
            onValueChange={(next) => handleOptionChange(param.name, next)}
            disabled={isConverting}
          >
            <SelectTrigger id={fieldId} className="rounded-xl">
              <SelectValue placeholder={param.placeholder || "Select"} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {param.options?.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (normalizedType === "boolean" || normalizedType === "switch") {
      return (
        <div
          key={param.name}
          className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-2"
        >
          <div className="flex-1 space-y-1">
            {commonLabel}
            {descriptionElement}
          </div>
          <Switch
            id={fieldId}
            checked={Boolean(value)}
            onCheckedChange={(checked) =>
              handleOptionChange(param.name, checked)
            }
            disabled={isConverting}
          />
        </div>
      );
    }

    if (
      normalizedType === "number" ||
      normalizedType === "integer" ||
      normalizedType === "float"
    ) {
      return (
        <div key={param.name} className="space-y-1">
          {commonLabel}
          {descriptionElement}
          <Input
            id={fieldId}
            type="number"
            inputMode="decimal"
            value={value ?? ""}
            onChange={(event) =>
              handleOptionChange(
                param.name,
                normalizeNumber(event.target.value),
              )
            }
            disabled={isConverting}
            min={param.min}
            max={param.max}
            step={param.step}
            placeholder={param.placeholder}
            required={param.required}
          />
        </div>
      );
    }

    return (
      <div key={param.name} className="space-y-1">
        {commonLabel}
        {descriptionElement}
        <Input
          id={fieldId}
          value={value ?? ""}
          onChange={(event) =>
            handleOptionChange(param.name, event.target.value)
          }
          disabled={isConverting}
          placeholder={param.placeholder}
          required={param.required}
        />
      </div>
    );
  };

  const hasAdvancedOptions = secondaryParams.length > 0;

  const renderFormContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          <span>Loading models...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <span>Falha ao carregar modelos de vídeo.</span>
          <span className="text-xs text-muted-foreground/80">{error}</span>
        </div>
      );
    }

    if (!selectedModel) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <span>Nenhum modelo de vídeo compatível disponível.</span>
        </div>
      );
    }

    return (
      <div className="flex gap-4">
        <div className="w-1/3">
          <div className="border rounded-xl overflow-hidden aspect-square flex items-center justify-center">
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Imagem de origem"
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>

        <div className="w-2/3 space-y-4">
          {promptParam && renderParameterField(promptParam)}
          {primaryParams.map((param, index) => (
            <div key={`primary-${param.name}-${index}`}>
              {renderParameterField(param)}
            </div>
          ))}

          {hasAdvancedOptions && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowMoreOptions(true)}
              className="px-0 pr-4 flex gap-2 text-sm"
            >
              <ChevronRight className="h-4 w-4" />
              Mais Opções
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-5">
        <DialogHeader>
          <DialogTitle>Converter Imagem para Vídeo</DialogTitle>
          <DialogDescription>
            Transforme sua imagem estática em um vídeo dinâmico usando IA.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="py-2 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Modelo</Label>
            <Select
              value={selectedModelId ?? ""}
              onValueChange={(value) => {
                setSelectedModelId(value);
                const nextModel = videoModels.find(
                  (model) => model.id === value,
                );
                setOptionValues(buildInitialValues(nextModel ?? null));
              }}
              disabled={isConverting || videoModels.length === 0 || isLoading}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue
                  placeholder={
                    isLoading
                      ? "Carregando modelos..."
                      : videoModels.length === 0
                        ? "Nenhum modelo de vídeo disponível"
                        : "Selecione um modelo"
                  }
                />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {videoModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col text-left">
                      <span>{model.name}</span>
                      {model.description && (
                        <span className="text-xs text-muted-foreground">
                          {model.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {renderFormContent()}

          <DialogFooter className="mt-4 flex justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isConverting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isConverting}
              className="flex items-center gap-2"
            >
              {isConverting ? (
                <>
                  <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                  <span className="text-white">Convertendo...</span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-white">Executar</span>
                  <span className="flex flex-row space-x-0.5">
                    <kbd className="flex items-center justify-center text-white tracking-tighter rounded-xl border px-1 font-mono bg-white/10 border-white/10 h-6 min-w-6 text-xs">
                      ↵
                    </kbd>
                  </span>
                </div>
              )}
            </Button>
          </DialogFooter>
        </form>

        {/* Slide-out Panel for More Options */}
        {showMoreOptions && selectedModel && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
              onClick={() => setShowMoreOptions(false)}
            />

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full w-96 bg-card shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-3 border-b">
                  <h3 className="font-semibold text-lg">Opções Avançadas</h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowMoreOptions(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {secondaryParams.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Este modelo não possui parâmetros adicionais.
                      </p>
                    ) : (
                      secondaryParams.map((param, index) => (
                        <div key={`${param.name}-${index}`}>
                          {renderParameterField(param)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
