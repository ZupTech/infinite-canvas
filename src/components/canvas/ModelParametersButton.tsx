import React from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

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
  [key: string]: any;
}

interface ModelParametersButtonProps {
  model: MediaModel | null;
  onOpenParameters: (model: MediaModel) => void;
}

export function ModelParametersButton({
  model,
  onOpenParameters,
}: ModelParametersButtonProps) {
  // Only show button if model has configurable parameters
  if (!model || !model.parameters || model.parameters.length === 0) {
    return null;
  }

  const hasConfigurableParams = model.parameters.some(
    (param) => param.type !== "hidden" && param.name !== "prompt",
  );

  if (!hasConfigurableParams) {
    return null;
  }

  return (
    <Button
      variant="secondary"
      size="icon"
      className="ml-2"
      onClick={() => onOpenParameters(model)}
      title="Ver opções do modelo"
    >
      <Settings className="h-4 w-4" />
    </Button>
  );
}
