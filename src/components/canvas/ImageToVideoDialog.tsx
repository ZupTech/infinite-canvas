import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VideoGenerationSettings } from "@/types/canvas";
import { SpinnerIcon } from "@/components/icons";
import { ChevronRight, X } from "lucide-react";
import { type MediaModel } from "@/utils/model-utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImageToVideoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConvert: (settings: VideoGenerationSettings) => void;
  imageUrl: string;
  isConverting: boolean;
  mediaModels: MediaModel[];
}

export const ImageToVideoDialog: React.FC<ImageToVideoDialogProps> = ({
  isOpen,
  onClose,
  onConvert,
  imageUrl,
  isConverting,
  mediaModels,
}) => {
  // Filter video models from dynamic catalog
  const videoModels = React.useMemo(
    () => mediaModels.filter((m) => m.type === "video"),
    [mediaModels],
  );

  const [selectedModelId, setSelectedModelId] = useState("");
  const [optionValues, setOptionValues] = useState<Record<string, any>>({});
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Get selected model (computed, not state)
  const selectedModel = React.useMemo(
    () => videoModels.find((m) => m.id === selectedModelId),
    [videoModels, selectedModelId],
  );

  // Initialize first model when models load
  useEffect(() => {
    if (videoModels.length > 0 && !selectedModelId) {
      const firstModel = videoModels[0];
      setSelectedModelId(firstModel.id);
    }
  }, [videoModels.length]); // Only depend on length, not the array itself

  // Initialize option values when model changes
  useEffect(() => {
    if (selectedModel) {
      const defaults: Record<string, any> = {};
      selectedModel.parameters?.forEach((param) => {
        if (param.default !== undefined) {
          defaults[param.name] = param.default;
        }
      });
      setOptionValues(defaults);
    }
  }, [selectedModel?.id]); // Only depend on model ID

  const handleOptionChange = (field: string, value: any) => {
    setOptionValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) return;

    const settings: VideoGenerationSettings = {
      prompt: optionValues.prompt || "",
      sourceUrl: imageUrl,
      modelId: selectedModel.id,
      ...optionValues,
    };

    onConvert(settings);
  };

  if (!selectedModel) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-5">
        <DialogHeader>
          <DialogTitle>Convert Image to Video</DialogTitle>
          <DialogDescription>
            Transform your static image into a dynamic video using AI.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="py-2 space-y-4">
          {/* Model Selection */}
          <div className="w-full mb-4">
            <Label htmlFor="model-select">Model</Label>
            <Select
              value={selectedModelId}
              onValueChange={setSelectedModelId}
              disabled={isConverting}
            >
              <SelectTrigger id="model-select">
                <SelectValue placeholder="Select a video model" />
              </SelectTrigger>
              <SelectContent>
                {videoModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show model description if available */}
          {selectedModel?.description && (
            <p className="text-sm text-muted-foreground">
              {selectedModel.description}
            </p>
          )}

          <div className="flex gap-4">
            {/* Left column - Image Preview */}
            <div className="w-1/3">
              <div className="border rounded-xl overflow-hidden aspect-square flex items-center justify-center">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Source image"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>

            {/* Right column - Options */}
            <div className="w-2/3 space-y-4">
              {/* Render dynamic parameters */}
              {selectedModel?.parameters
                ?.filter((p) => {
                  // Skip file/image inputs
                  const isFileInput =
                    p.type === "file" || p.type === "multifile";
                  const isImageAccept =
                    p.accept === "image/*" ||
                    (typeof p.accept === "string" &&
                      p.accept?.includes("image"));
                  const isImageParam = isFileInput && isImageAccept;

                  // Only show these main params
                  return (
                    !isImageParam &&
                    ["prompt", "negative_prompt", "duration", "seed"].includes(
                      p.name,
                    )
                  );
                })
                .slice(0, 3)
                .map((param) => (
                  <div key={param.name} className="space-y-2">
                    <Label htmlFor={param.name}>
                      {param.label || param.name}
                    </Label>
                    {param.type === "text" || param.type === "string" ? (
                      param.name === "prompt" ||
                      param.name === "negative_prompt" ? (
                        <Textarea
                          id={param.name}
                          value={optionValues[param.name] || ""}
                          onChange={(e) =>
                            handleOptionChange(param.name, e.target.value)
                          }
                          placeholder={param.placeholder}
                          disabled={isConverting}
                          rows={3}
                        />
                      ) : (
                        <Input
                          id={param.name}
                          type="text"
                          value={optionValues[param.name] || ""}
                          onChange={(e) =>
                            handleOptionChange(param.name, e.target.value)
                          }
                          placeholder={param.placeholder}
                          disabled={isConverting}
                        />
                      )
                    ) : param.type === "number" || param.type === "integer" ? (
                      <Input
                        id={param.name}
                        type="number"
                        value={optionValues[param.name] ?? ""}
                        onChange={(e) =>
                          handleOptionChange(
                            param.name,
                            param.type === "integer"
                              ? parseInt(e.target.value)
                              : parseFloat(e.target.value),
                          )
                        }
                        min={param.min}
                        max={param.max}
                        step={param.type === "integer" ? 1 : 0.1}
                        disabled={isConverting}
                      />
                    ) : param.type === "select" && param.options ? (
                      <Select
                        value={optionValues[param.name]?.toString()}
                        onValueChange={(value) =>
                          handleOptionChange(param.name, value)
                        }
                        disabled={isConverting}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {param.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {param.description && (
                      <p className="text-xs text-muted-foreground">
                        {param.description}
                      </p>
                    )}
                  </div>
                ))}

              {/* More Options Button */}
              {selectedModel &&
                selectedModel.parameters &&
                selectedModel.parameters.length > 4 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowMoreOptions(true)}
                    className="px-0 pr-4 flex gap-2 text-sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                    More Options
                  </Button>
                )}
            </div>
          </div>

          <DialogFooter className="mt-4 flex justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isConverting}
            >
              Cancel
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
                  <span className="text-white">Converting...</span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-white">Run</span>
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
        {showMoreOptions && (
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
                  <h3 className="font-semibold text-lg">Advanced Options</h3>
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
                  {/* Render all other parameters */}
                  {selectedModel?.parameters
                    ?.filter((p) => {
                      // Skip file/image inputs
                      const isFileInput =
                        p.type === "file" || p.type === "multifile";
                      const isImageAccept =
                        p.accept === "image/*" ||
                        (typeof p.accept === "string" &&
                          p.accept?.includes("image"));
                      const isImageParam = isFileInput && isImageAccept;

                      // Show all params except main ones and image inputs
                      return (
                        !isImageParam &&
                        ![
                          "prompt",
                          "negative_prompt",
                          "duration",
                          "seed",
                        ].includes(p.name)
                      );
                    })
                    .map((param) => (
                      <div key={param.name} className="space-y-2 mb-4">
                        <Label htmlFor={`advanced-${param.name}`}>
                          {param.label || param.name}
                        </Label>
                        {param.type === "text" || param.type === "string" ? (
                          <Input
                            id={`advanced-${param.name}`}
                            type="text"
                            value={optionValues[param.name] || ""}
                            onChange={(e) =>
                              handleOptionChange(param.name, e.target.value)
                            }
                            placeholder={param.placeholder}
                            disabled={isConverting}
                          />
                        ) : param.type === "number" ||
                          param.type === "integer" ? (
                          <Input
                            id={`advanced-${param.name}`}
                            type="number"
                            value={optionValues[param.name] ?? ""}
                            onChange={(e) =>
                              handleOptionChange(
                                param.name,
                                param.type === "integer"
                                  ? parseInt(e.target.value)
                                  : parseFloat(e.target.value),
                              )
                            }
                            min={param.min}
                            max={param.max}
                            step={param.type === "integer" ? 1 : 0.1}
                            disabled={isConverting}
                          />
                        ) : param.type === "select" && param.options ? (
                          <Select
                            value={optionValues[param.name]?.toString()}
                            onValueChange={(value) =>
                              handleOptionChange(param.name, value)
                            }
                            disabled={isConverting}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {param.options.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        {param.description && (
                          <p className="text-xs text-muted-foreground">
                            {param.description}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
