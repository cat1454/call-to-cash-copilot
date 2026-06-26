import { createPrismaClient } from "../packages/db/src/client.js";
import {
  applyDemoCatalogueFixtures,
  loadPickupPointRows,
  loadRevenueTwinPolicyRows,
  loadTripInventoryRows,
  loadTripScheduleRows
} from "./schedule-fixture.js";
import { fileURLToPath } from "node:url";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://call_to_cash:call_to_cash@127.0.0.1:55432/call_to_cash?schema=public";
const prisma = createPrismaClient({ databaseUrl });
const fixtureUrl = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));
const pickupRows = loadPickupPointRows(fixtureUrl("./fixtures/pickup-point-demo.csv"));
const scheduleRows = loadTripScheduleRows(fixtureUrl("./fixtures/trip-schedule-demo.csv"), {
  pickupRows,
  policyRows: loadRevenueTwinPolicyRows(fixtureUrl("./fixtures/revenue-twin-policy-demo.csv"))
});
const inventoryRows = loadTripInventoryRows(
  fixtureUrl("./fixtures/trip-inventory-demo.csv"),
  scheduleRows
);

try {
  await prisma.user.upsert({
    where: { publicId: "usr_provider_demo" },
    update: {
      role: "PROVIDER_ADMIN",
      displayName: "Demo Bus Provider"
    },
    create: {
      publicId: "usr_provider_demo",
      role: "PROVIDER_ADMIN",
      displayName: "Demo Bus Provider"
    }
  });

  await applyDemoCatalogueFixtures(prisma, { scheduleRows, pickupRows, inventoryRows });
} finally {
  await prisma.$disconnect();
}
