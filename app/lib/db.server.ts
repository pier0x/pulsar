import { PrismaClient } from "../../generated/prisma/client";
import { config } from "./config.server";

let prisma: PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __db__: PrismaClient | undefined;
}

// Prisma 7 requires options parameter
// @ts-expect-error - Prisma 7 type inference issue with the Subset type
const createPrismaClient = () => new PrismaClient({});

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (config("app.env") === "production") {
  prisma = createPrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = createPrismaClient();
  }
  prisma = global.__db__;
}

export { prisma };
