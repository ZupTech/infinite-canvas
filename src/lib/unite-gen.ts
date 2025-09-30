import { headers } from "next/headers";

const DEFAULT_GENERATE_PATH = "/api/generate";
const DEFAULT_STATUS_PATH = "/api/jobs/status";
const DEFAULT_UPLOAD_PATH = "/api/uploads/presign";

type UnitePaths = {
  generatePath: string;
  statusPath: string;
  uploadPath: string;
};

const buildPaths = (): UnitePaths => {
  const generatePath =
    process.env.UNITE_GEN_GENERATE_PATH || DEFAULT_GENERATE_PATH;
  const statusPath = process.env.UNITE_GEN_STATUS_PATH || DEFAULT_STATUS_PATH;
  const uploadPath = process.env.UNITE_GEN_UPLOAD_PATH || DEFAULT_UPLOAD_PATH;

  return { generatePath, statusPath, uploadPath };
};

export const getUniteGenBaseUrl = () => {
  const baseUrl = process.env.UNITE_GEN_BASE_URL;
  if (!baseUrl) {
    throw new Error("UNITE_GEN_BASE_URL environment variable is not set");
  }
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
};

export const getUniteGenSessionToken = () =>
  process.env.UNITE_GEN_SESSION_TOKEN || process.env.UNITE_GEN_API_KEY;

const buildUrl = (path: string) => {
  const base = getUniteGenBaseUrl();
  return new URL(path.replace(/^\//, ""), base).toString();
};

type FetchOptions = RequestInit & { skipAuthHeader?: boolean };

export const uniteGenFetch = async (path: string, init: FetchOptions = {}) => {
  const url = buildUrl(path);
  const sessionToken = getUniteGenSessionToken();
  const headersInit = new Headers(init.headers);
  const incomingHeaders = await headers();

  if (init.body && !headersInit.has("content-type")) {
    headersInit.set("content-type", "application/json");
  }

  if (!headersInit.has("cookie")) {
    const cookieHeader = incomingHeaders.get("cookie");
    if (cookieHeader) {
      headersInit.set("cookie", cookieHeader);
    }
  }

  if (!init.skipAuthHeader && !headersInit.has("authorization")) {
    const forwardedAuth = incomingHeaders.get("authorization");
    if (forwardedAuth) {
      headersInit.set("authorization", forwardedAuth);
    } else if (sessionToken) {
      headersInit.set("authorization", `Bearer ${sessionToken}`);
    }
  }

  const sessionHeaders = ["x-unite-session", "x-session-token"] as const;
  for (const headerName of sessionHeaders) {
    if (!headersInit.has(headerName)) {
      const forwarded = incomingHeaders.get(headerName);
      if (forwarded) {
        headersInit.set(headerName, forwarded);
      }
    }
  }

  const forwardedFor = incomingHeaders.get("x-forwarded-for");
  if (forwardedFor && !headersInit.has("x-forwarded-for")) {
    headersInit.set("x-forwarded-for", forwardedFor);
  }

  const response = await fetch(url, {
    ...init,
    headers: headersInit,
  });

  return response;
};

export const unitePaths = buildPaths();
