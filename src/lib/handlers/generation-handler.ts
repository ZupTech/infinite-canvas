import type { FalClient } from "@fal-ai/client";
import type React from "react";

type ToastFunction = (props: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

export const uploadImageDirect = async (
  dataUrl: string,
  falClient: FalClient,
  toast: ToastFunction,
  setIsApiKeyDialogOpen: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  // Convert data URL to blob first
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  try {
    // Check size before attempting upload
    if (blob.size > 10 * 1024 * 1024) {
      // 10MB warning
      console.warn(
        "Large image detected:",
        (blob.size / 1024 / 1024).toFixed(2) + "MB",
      );
    }

    // Upload directly to FAL through proxy (using the client instance)
    const uploadResult = await falClient.storage.upload(blob);

    return { url: uploadResult };
  } catch (error: any) {
    // Check for rate limit error
    const isRateLimit =
      error.status === 429 ||
      error.message?.includes("429") ||
      error.message?.includes("rate limit") ||
      error.message?.includes("Rate limit");

    if (isRateLimit) {
      toast({
        title: "Rate limit exceeded",
        description:
          "Add your FAL API key to bypass rate limits. Without an API key, uploads are limited.",
        variant: "destructive",
      });
      // Open API key dialog automatically
      setIsApiKeyDialogOpen(true);
    } else {
      toast({
        title: "Failed to upload image",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }

    // Re-throw the error so calling code knows upload failed
    throw error;
  }
};
