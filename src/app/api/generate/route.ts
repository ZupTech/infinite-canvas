import { NextRequest } from "next/server";
import { z } from "zod";
import { uniteGenFetch, unitePaths } from "@/lib/unite-gen";

const requestSchema = z.object({
  modelId: z.string(),
  endpoint: z.string().optional(),
  parameters: z.record(z.any()),
});

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

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch (error) {
    return toErrorResponse(new Error("Invalid JSON payload"), 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid request payload",
        issues: parsed.error.flatten(),
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  try {
    const response = await uniteGenFetch(unitePaths.generatePath, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
