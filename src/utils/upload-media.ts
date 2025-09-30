const uploadCache = new Map<string, Promise<{ url: string; key?: string }>>();

const DEFAULT_UPLOAD_ENDPOINT = "/api/uploads/presign";

const extensionFromMime = (mime?: string) => {
  if (!mime) return undefined;
  const [type, subtype] = mime.split("/");
  if (!subtype) return undefined;
  if (subtype.includes("+")) {
    return subtype.split("+")[0];
  }
  switch (subtype) {
    case "jpeg":
      return "jpg";
    case "svg+xml":
      return "svg";
    default:
      return subtype;
  }
};

const pickAssetUrl = (payload: any) =>
  payload?.assetUrl ||
  payload?.url ||
  payload?.fileUrl ||
  payload?.cdnUrl ||
  payload?.publicUrl;

const pickHeaders = (payload: any) => {
  const headers = payload?.headers || payload?.uploadHeaders;
  if (!headers) return undefined;
  return headers as Record<string, string>;
};

const pickFields = (payload: any) => payload?.fields || payload?.formData;

const pickMethod = (payload: any) => payload?.method || payload?.httpMethod;

const pickFileField = (payload: any) =>
  payload?.fileField || payload?.fileParameter || "file";

async function requestPresignedUpload(init: {
  contentType?: string;
  size?: number;
  extension?: string;
  endpoint?: string;
}) {
  const response = await fetch(init.endpoint ?? DEFAULT_UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contentType: init.contentType,
      size: init.size,
      extension: init.extension,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data?.error || "Failed to prepare upload");
  }

  return data;
}

const ensureFileName = (name: string | undefined, extension?: string) => {
  if (name) return name;
  const suffix = extension ? `.${extension}` : "";
  return `upload-${Date.now()}${suffix}`;
};

export interface EnsureUploadOptions {
  filename?: string;
  endpoint?: string;
  existingUrl?: string | null;
}

export async function ensureRemoteAsset(
  source: string,
  options: EnsureUploadOptions = {},
): Promise<{ url: string; key?: string }> {
  if (!source) {
    throw new Error("Missing media source");
  }

  if (/^https?:\/\//i.test(source)) {
    return { url: source };
  }

  if (options.existingUrl && /^https?:\/\//i.test(options.existingUrl)) {
    return { url: options.existingUrl };
  }

  if (!source.startsWith("data:") && !source.startsWith("blob:")) {
    return { url: source };
  }

  if (!uploadCache.has(source)) {
    uploadCache.set(
      source,
      (async () => {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error("Failed to read media contents");
        }
        const blob = await response.blob();
        const contentType =
          blob.type || response.headers.get("content-type") || undefined;
        const extension = extensionFromMime(contentType);
        const fileName = ensureFileName(options.filename, extension);

        const presignPayload = await requestPresignedUpload({
          contentType,
          size: blob.size,
          extension,
          endpoint: options.endpoint,
        });

        const uploadUrl = presignPayload?.uploadUrl || presignPayload?.url;
        if (!uploadUrl) {
          throw new Error("Upload endpoint was not provided by backend");
        }

        const method = (pickMethod(presignPayload) || "PUT").toUpperCase();
        const fields = pickFields(presignPayload);
        const headers = pickHeaders(presignPayload);
        const fileField = pickFileField(presignPayload);

        if (fields) {
          const form = new FormData();
          Object.entries(fields as Record<string, string>).forEach(
            ([key, value]) => {
              form.append(key, value);
            },
          );
          form.append(
            fileField,
            new File([blob], fileName, {
              type: contentType || "application/octet-stream",
            }),
          );

          const uploadResponse = await fetch(uploadUrl, {
            method: method || "POST",
            body: form,
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload media to storage");
          }
        } else {
          const uploadHeaders = new Headers(headers);
          if (!uploadHeaders.has("content-type") && contentType) {
            uploadHeaders.set("content-type", contentType);
          }

          const uploadResponse = await fetch(uploadUrl, {
            method,
            headers: uploadHeaders,
            body: blob,
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload media to storage");
          }
        }

        const assetUrl = pickAssetUrl(presignPayload);
        if (!assetUrl) {
          throw new Error("Backend response did not include asset URL");
        }

        return {
          url: assetUrl,
          key: presignPayload?.assetKey || presignPayload?.key,
        };
      })(),
    );
  }

  return uploadCache.get(source)!;
}
