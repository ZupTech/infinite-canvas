/**
 * Placeholder detection and utilities
 * Centralized logic for identifying and working with placeholder images
 */

/**
 * The base64 data URI used for placeholder images
 * This is a 1x1 transparent GIF
 */
export const PLACEHOLDER_DATA_URI =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Check if an image src is a placeholder
 */
export function isPlaceholder(src: string): boolean {
  return src.startsWith("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP");
}

/**
 * Check if a placeholder should be skipped for storage
 */
export function shouldSkipStorage(src: string): boolean {
  return isPlaceholder(src);
}
