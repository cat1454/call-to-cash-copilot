import dotenv from 'dotenv';
dotenv.config();

import { createPrismaClientFromEnvironment } from '../packages/db/src/client.js';
import { presentBooking } from '../apps/api/src/modules/booking/booking.presenter.js';

const prisma = createPrismaClientFromEnvironment();

async function main() {
  const bookingId = "bk_f8bcb8d400684abf93208cb57cd31071";
  console.log(`=== TESTING PRESENTER FOR: ${bookingId} ===`);
  const booking = await prisma.booking.findUnique({
    where: { publicId: bookingId },
    include: {
      agreements: { orderBy: { version: "desc" }, take: 1 },
      riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (!booking) {
    console.log("Booking not found!");
    return;
  }

  console.log("Database booking object:", JSON.stringify({
    publicId: booking.publicId,
    status: booking.status,
    agreements: booking.agreements,
    riskAssessments: booking.riskAssessments
  }, null, 2));

  const presented = presentBooking(booking);
  console.log("\nPresented booking object:", JSON.stringify(presented, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
