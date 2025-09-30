export const DISPLAYABLE_MODEL_TYPES = [
  "image",
  "video",
  "audio",
  "upscale",
] as const;

export type DisplayableModelType = (typeof DISPLAYABLE_MODEL_TYPES)[number];

export type MediaModelType = "image" | "video" | "upscale" | "audio" | "text";

export interface MediaModel {
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
  [key: string]: any;
}

export interface ModelsResponse {
  ui?: Record<string, unknown>;
  models?: MediaModel[];
}

export const isRenderableMediaUrl = (value?: string | null) =>
  typeof value === "string" &&
  (value.startsWith("http") || value.startsWith("/"));

export const isVideoAsset = (value?: string | null) =>
  typeof value === "string" && /\.webm($|\?)/i.test(value);

export const isDisplayableType = (
  type?: string,
): type is DisplayableModelType => {
  if (!type) {
    return false;
  }

  return DISPLAYABLE_MODEL_TYPES.includes(
    type.toLowerCase() as DisplayableModelType,
  );
};
