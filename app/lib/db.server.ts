// Use require to avoid ESM bundling issues with Prisma
const { PrismaClient } = require("../../generated/prisma/client.js");

let prisma: InstanceType<typeof PrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var __db__: InstanceType<typeof PrismaClient> | undefined;
}

// Prisma 7 generated client
const createPrismaClient = () => new PrismaClient();

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (process.env.NODE_ENV === "production") {
  prisma = createPrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = createPrismaClient();
  }
  prisma = global.__db__;
}

export { prisma };
