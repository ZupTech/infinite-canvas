import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterModelsForContext, type MediaModel } from "@/utils/model-utils";

interface ModelSelectorProps {
  models: MediaModel[];
  selectedModelId: string | undefined;
  hasSelectedImages: boolean;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * ModelSelector component
 * Automatically filters models based on context (with/without selected images)
 * Shows only compatible models for the current operation
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  hasSelectedImages,
  onModelChange,
  disabled = false,
  className = "",
}) => {
  // Filter models based on whether images are selected
  const availableModels = useMemo(
    () => filterModelsForContext(models, hasSelectedImages),
    [models, hasSelectedImages],
  );

  // If selected model is no longer available, auto-select first available
  const effectiveModelId = useMemo(() => {
    if (!selectedModelId) {
      return availableModels[0]?.id;
    }

    const isAvailable = availableModels.some((m) => m.id === selectedModelId);
    return isAvailable ? selectedModelId : availableModels[0]?.id;
  }, [selectedModelId, availableModels]);

  // Get display name for selected model
  const selectedModel = availableModels.find((m) => m.id === effectiveModelId);
  const displayName = selectedModel
    ? `${selectedModel.ui?.icon || "🎨"} ${selectedModel.name}`
    : "Select model";

  if (availableModels.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        {hasSelectedImages
          ? "No models support image-to-image"
          : "No models available"}
      </div>
    );
  }

  return (
    <Select
      value={effectiveModelId}
      onValueChange={onModelChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue>{displayName}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableModels.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <div className="flex items-center gap-2">
              {model.ui?.icon && (
                <span className="text-lg">{model.ui.icon}</span>
              )}
              <div className="flex flex-col">
                <span className="font-medium">{model.name}</span>
                {model.description && (
                  <span className="text-xs text-muted-foreground">
                    {model.description}
                  </span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
