import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface MediaModel {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  type: string;
  category?: string | null;
  visible: boolean;
  featured?: boolean;
  isNew?: boolean;
  hasUnlimitedBadge?: boolean;
  modelId?: string | null;
  restricted?: boolean | null;
  ui?: {
    icon?: string | null;
    color?: string | null;
    layout?: string | null;
    image?: string | null;
    resolution?: string | null;
  };
  pricing?: {
    type: string;
    unit_cost?: number;
    [key: string]: any;
  };
  parameters?: Array<{
    name: string;
    type: string;
    label: string;
    required?: boolean;
    placeholder?: string;
    description?: string;
    default?: any;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{
      value: string;
      label: string;
    }>;
    uiPriority?: "primary" | "secondary";
    conditional?: any;
  }>;
  capabilities?: {
    aspectRatios?: string[];
    maxWidth?: number;
    maxHeight?: number;
    maxDuration?: number;
    batchSize?: number;
    formats?: string[];
    [key: string]: any;
  };
  processing?: {
    estimatedTime: number;
    timeout: number;
  };
  [key: string]: any;
}

interface ModelDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: MediaModel | null;
  onSave?: (parameters: Record<string, any>) => void;
}

export function ModelDetailsDialog({
  open,
  onOpenChange,
  model,
  onSave,
}: ModelDetailsDialogProps) {
  const [parameters, setParameters] = useState<Record<string, any>>({});

  useEffect(() => {
    if (model?.parameters) {
      const initialParams: Record<string, any> = {};
      model.parameters.forEach((param) => {
        initialParams[param.name] = param.default || "";
      });
      setParameters(initialParams);
    }
  }, [model]);

  if (!model) {
    return null;
  }

  const handleSave = () => {
    if (onSave) {
      onSave(parameters);
    }
    onOpenChange(false);
  };

  const primaryParams = model.parameters?.filter(
    (param) =>
      param.uiPriority === "primary" &&
      param.type !== "hidden" &&
      param.name !== "prompt",
  );
  const secondaryParams = model.parameters?.filter(
    (param) =>
      (param.uiPriority === "secondary" ||
        (!param.uiPriority && param.type !== "hidden")) &&
      param.name !== "prompt",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {model.ui?.icon && (
              <span className="text-2xl">{model.ui.icon}</span>
            )}
            Configurações: {model.name}
          </DialogTitle>
          <DialogDescription className="text-left">
            Configure os parâmetros do modelo conforme necessário
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Parâmetros principais */}
            {primaryParams && primaryParams.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Configurações Principais
                  </CardTitle>
                  <CardDescription>
                    Configure os parâmetros essenciais para este modelo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {primaryParams.map((param) => (
                      <div key={param.name} className="space-y-2">
                        <Label
                          htmlFor={param.name}
                          className="text-sm font-medium"
                        >
                          {param.label}
                          {param.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>

                        {param.type === "text" && (
                          <Input
                            id={param.name}
                            type="text"
                            value={parameters[param.name] || ""}
                            onChange={(e) =>
                              setParameters((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            placeholder={param.placeholder}
                            className="text-sm"
                          />
                        )}

                        {param.type === "textarea" && (
                          <Textarea
                            id={param.name}
                            value={parameters[param.name] || ""}
                            onChange={(e) =>
                              setParameters((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            placeholder={param.placeholder}
                            className="text-sm h-20 resize-none"
                          />
                        )}

                        {param.type === "number" && (
                          <Input
                            id={param.name}
                            type="number"
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            value={parameters[param.name] || ""}
                            onChange={(e) =>
                              setParameters((prev) => ({
                                ...prev,
                                [param.name]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            placeholder={param.placeholder}
                            className="text-sm"
                          />
                        )}

                        {param.type === "select" && param.options && (
                          <select
                            id={param.name}
                            value={parameters[param.name] || ""}
                            onChange={(e) =>
                              setParameters((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                          >
                            <option value="">Selecione uma opção</option>
                            {param.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {param.type === "boolean" && (
                          <div className="flex items-center space-x-2">
                            <input
                              id={param.name}
                              type="checkbox"
                              checked={parameters[param.name] || false}
                              onChange={(e) =>
                                setParameters((prev) => ({
                                  ...prev,
                                  [param.name]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4"
                            />
                            <Label
                              htmlFor={param.name}
                              className="text-sm font-normal"
                            >
                              Ativado
                            </Label>
                          </div>
                        )}

                        {param.type === "slider" && (
                          <div className="space-y-2">
                            <input
                              id={param.name}
                              type="range"
                              min={param.min}
                              max={param.max}
                              step={param.step || 1}
                              value={parameters[param.name] || param.min}
                              onChange={(e) =>
                                setParameters((prev) => ({
                                  ...prev,
                                  [param.name]: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{param.min}</span>
                              <span className="font-medium">
                                {parameters[param.name] || param.min}
                              </span>
                              <span>{param.max}</span>
                            </div>
                          </div>
                        )}

                        {param.description && (
                          <p className="text-xs text-muted-foreground">
                            {param.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Parâmetros avançados */}
            {secondaryParams && secondaryParams.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Configurações Avançadas
                  </CardTitle>
                  <CardDescription>
                    Configurações opcionais para controle fino
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {secondaryParams.map((param) => (
                      <div key={param.name} className="space-y-2">
                        <Label
                          htmlFor={param.name}
                          className="text-sm font-medium"
                        >
                          {param.label}
                          {param.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>

                        {param.type === "text" && (
                          <Input
                            id={param.name}
                            type="text"
                            value={parameters[param.name] || ""}
                            onChange={(e) =>
                              setParameters((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            placeholder={param.placeholder}
                            className="text-sm"
                          />
                        )}

                        {param.type === "textarea" && (
                          <Textarea
                            id={param.name}
                            value={parameters[param.name] || ""}
                            onChange={(e) =>
                              setParameters((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            placeholder={param.placeholder}
                            className="text-sm h-20 resize-none"
                          />
                        )}

                        {param.type === "number" && (
                          <Input
                            id={param.name}
                            type="number"
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            value={parameters[param.name] || ""}
                            onChange={(e) =>
                              setParameters((prev) => ({
                                ...prev,
                                [param.name]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            placeholder={param.placeholder}
                            className="text-sm"
                          />
                        )}

                        {param.type === "select" && param.options && (
                          <select
                            id={param.name}
                            value={parameters[param.name] || ""}
                            onChange={(e) =>
                              setParameters((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                          >
                            <option value="">Selecione uma opção</option>
                            {param.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {param.type === "boolean" && (
                          <div className="flex items-center space-x-2">
                            <input
                              id={param.name}
                              type="checkbox"
                              checked={parameters[param.name] || false}
                              onChange={(e) =>
                                setParameters((prev) => ({
                                  ...prev,
                                  [param.name]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4"
                            />
                            <Label
                              htmlFor={param.name}
                              className="text-sm font-normal"
                            >
                              Ativado
                            </Label>
                          </div>
                        )}

                        {param.type === "slider" && (
                          <div className="space-y-2">
                            <input
                              id={param.name}
                              type="range"
                              min={param.min}
                              max={param.max}
                              step={param.step || 1}
                              value={parameters[param.name] || param.min}
                              onChange={(e) =>
                                setParameters((prev) => ({
                                  ...prev,
                                  [param.name]: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{param.min}</span>
                              <span className="font-medium">
                                {parameters[param.name] || param.min}
                              </span>
                              <span>{param.max}</span>
                            </div>
                          </div>
                        )}

                        {param.description && (
                          <p className="text-xs text-muted-foreground">
                            {param.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="ml-2">
            Aplicar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
