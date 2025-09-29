/**
 * Model utilities for capability detection and endpoint resolution
 */

export interface MediaModel {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  type: string;
  visible?: boolean;
  featured?: boolean;
  isNew?: boolean;
  hasUnlimitedBadge?: boolean;
  pricing?: {
    type: string;
    unit_cost: number;
  };
  endpointResolution?: {
    type: "static" | "composite";
    endpoint?: string;
    rules?: Array<{
      if: Record<string, any>;
      then: string;
    }>;
  };
  capabilities?: {
    aspectRatios?: string[];
    batchSize?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
  parameters?: Array<{
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
    excludeFromEndpoints?: string[];
    [key: string]: any;
  }>;
  ui?: {
    icon?: string | null;
    color?: string | null;
    layout?: string | null;
    image?: string | null;
    resolution?: string | null;
  };
  processing?: {
    estimatedTime?: number;
    timeout?: number;
  };
  compression?: {
    enabled?: boolean;
    parameters?: Record<string, any>;
  };
}

/**
 * Check if a model can work with image input
 * Includes both optional and required image inputs
 */
export function supportsImageInput(model: MediaModel): boolean {
  if (!model.parameters) return false;

  return model.parameters.some((param) => {
    // Check if parameter type is file or multifile
    const isFileType = param.type === "file" || param.type === "multifile";

    // Check if it accepts images
    const acceptsImages =
      param.accept === "image/*" ||
      (typeof param.accept === "string" && param.accept?.includes("image"));

    return isFileType && acceptsImages;
  });
}

/**
 * Legacy alias - use supportsImageInput instead
 */
export function supportsImageToImage(model: MediaModel): boolean {
  return supportsImageInput(model);
}

/**
 * Get the parameter name for image input (varies by model)
 * Finds the first parameter that accepts image files
 */
export function getImageInputParamName(model: MediaModel): string | null {
  if (!model.parameters) return null;

  const imageParam = model.parameters.find((param) => {
    const isFileType = param.type === "file" || param.type === "multifile";
    const acceptsImages =
      param.accept === "image/*" ||
      (typeof param.accept === "string" && param.accept.includes("image"));

    return isFileType && acceptsImages;
  });

  return imageParam?.name || null;
}

/**
 * Resolve the correct endpoint for a model based on parameters
 */
export function resolveModelEndpoint(
  model: MediaModel,
  hasImageInput: boolean,
): string {
  if (!model.endpointResolution) {
    // Fallback: use model ID as endpoint
    return model.id;
  }

  if (model.endpointResolution.type === "static") {
    return model.endpointResolution.endpoint || model.id;
  }

  if (
    model.endpointResolution.type === "composite" &&
    model.endpointResolution.rules
  ) {
    // Evaluate rules in order
    for (const rule of model.endpointResolution.rules) {
      if (matchesCondition(rule.if, hasImageInput)) {
        return rule.then;
      }
    }
  }

  // Fallback
  return model.id;
}

/**
 * Check if a condition matches the current state
 */
function matchesCondition(
  condition: Record<string, any>,
  hasImageInput: boolean,
): boolean {
  // Empty condition {} always matches
  if (Object.keys(condition).length === 0) {
    return true;
  }

  // Check image_urls condition
  if (condition.image_urls) {
    const sizeCondition = condition.image_urls.$size;
    if (sizeCondition) {
      if (sizeCondition.$gte !== undefined) {
        return hasImageInput && sizeCondition.$gte <= 1;
      }
    }
  }

  return false;
}

/**
 * Filter models to show only those compatible with current context
 */
export function filterModelsForContext(
  models: MediaModel[],
  hasSelectedImages: boolean,
): MediaModel[] {
  if (!hasSelectedImages) {
    // No selection: show all visible image models (text-to-image)
    return models.filter((m) => m.type === "image" && m.visible !== false);
  }

  // Has selection: show models that accept image input
  // Includes: image models, upscale models, and video models with img2vid
  return models.filter((m) => {
    if (m.visible === false) return false;

    // Accept image, upscale, or video types
    const acceptedTypes = ["image", "upscale", "video"];
    if (!acceptedTypes.includes(m.type)) return false;

    // Must have image input parameter
    return supportsImageInput(m);
  });
}

/**
 * Filter parameters to include only those defined by the model
 * Removes parameters that don't belong to the current model
 */
export function filterModelParameters(
  model: MediaModel,
  parameters: Record<string, any>,
  endpoint: string,
): Record<string, any> {
  if (!model.parameters) {
    // If model doesn't define parameters, return as is
    return parameters;
  }

  const filtered: Record<string, any> = {};

  // Get valid parameter names for this model
  const validParamNames = new Set(
    model.parameters
      .filter((param) => {
        // Check if parameter is excluded from this endpoint
        if (
          param.excludeFromEndpoints &&
          param.excludeFromEndpoints.includes(endpoint)
        ) {
          return false;
        }
        return true;
      })
      .map((param) => param.name),
  );

  // Always include these core parameters
  const coreParams = ["prompt", "num_images"];

  // Filter parameters to only include valid ones
  Object.keys(parameters).forEach((key) => {
    if (validParamNames.has(key) || coreParams.includes(key)) {
      filtered[key] = parameters[key];
    }
  });

  return filtered;
}
