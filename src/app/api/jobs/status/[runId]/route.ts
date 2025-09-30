import { NextRequest } from "next/server";
import { uniteGenFetch, unitePaths } from "@/lib/unite-gen";

const toJsonResponse = async (response: Response) => {
  const text = await response.text();
  const contentType =
    response.headers.get("content-type") || "application/json";
  return new Response(text, {
    status: response.status,
    headers: { "content-type": contentType },
  });
};

const toErrorResponse = (error: unknown, status = 500) =>
  new Response(
    JSON.stringify({
      error: error instanceof Error ? error.message : "Unexpected server error",
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId?: string }> },
) {
  const { runId } = await params;

  if (!runId) {
    return toErrorResponse(new Error("Missing runId"), 400);
  }

  try {
    const response = await uniteGenFetch(
      `${unitePaths.statusPath.replace(/\/$/, "")}/${encodeURIComponent(runId)}`,
      {
        method: "GET",
      },
    );

    return await toJsonResponse(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
