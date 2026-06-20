import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

export type DatabaseClient = PrismaClient;

export type CreatePrismaClientOptions = {
  databaseUrl: string;
};

export function createPrismaClient({ databaseUrl }: CreatePrismaClientOptions): PrismaClient {
  if (databaseUrl.trim().length === 0) {
    throw new Error("DATABASE_URL must not be empty");
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export function createPrismaClientFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): PrismaClient {
  const databaseUrl = environment.DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required");
  }

  return createPrismaClient({ databaseUrl });
}
