/**
 * Serves asset images from the database (imageData column).
 * GET /api/asset-image/:id
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  const id = params.id;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new Response("Not Found", { status: 404 });
  }

  const account = await prisma.account.findFirst({
    where: { id, userId: user.id },
    select: { imageData: true, imageMimeType: true },
  });

  if (!account?.imageData) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(account.imageData, {
    status: 200,
    headers: {
      "Content-Type": account.imageMimeType || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
