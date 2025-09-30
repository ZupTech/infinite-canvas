import { NextResponse } from "next/server";
import { uniteGenFetch } from "@/lib/unite-gen";

const toJsonResponse = (data: unknown, init?: ResponseInit) =>
  new NextResponse(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

export async function GET() {
  try {
    const response = await uniteGenFetch("/models", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      const bodyText = await response.text().catch(() => "");
      return toJsonResponse(
        {
          error:
            bodyText || "Unexpected response when requesting Unite models.",
        },
        { status: 502 },
      );
    }

    const body = await response.json();

    if (!response.ok) {
      return toJsonResponse(body, { status: response.status });
    }

    return toJsonResponse(body, { status: 200 });
  } catch (error) {
    console.error("Failed to load Unite models", error);
    return toJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Unite models.",
      },
      { status: 500 },
    );
  }
}
