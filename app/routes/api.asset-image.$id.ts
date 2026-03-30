/**
 * Serves asset images from data/assets/<id>.*
 * GET /api/asset-image/:id
 */

import { createReadStream, existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";

const ASSETS_DIR = join(process.cwd(), "data", "assets");

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Require auth — asset images are private
  await requireAuth(request);

  const id = params.id;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new Response("Not Found", { status: 404 });
  }

  // Find the file by scanning for any extension
  let filePath: string | null = null;
  let ext = "";

  try {
    const files = await readdir(ASSETS_DIR);
    const match = files.find((f) => f.startsWith(`${id}.`));
    if (match) {
      filePath = join(ASSETS_DIR, match);
      ext = match.split(".").pop()?.toLowerCase() || "";
    }
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  if (!filePath || !existsSync(filePath)) {
    return new Response("Not Found", { status: 404 });
  }

  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

  const stream = createReadStream(filePath);
  return new Response(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
