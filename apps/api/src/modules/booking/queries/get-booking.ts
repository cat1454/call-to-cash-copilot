import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { presentBooking } from "../booking.presenter.js";
import type { ServiceData } from "../types.js";

export async function getBooking(client: DatabaseClient, bookingId: string): Promise<ServiceData> {
  const booking = await client.booking.findUnique({
    where: { publicId: bookingId },
    include: {
      agreements: { orderBy: { version: "desc" }, take: 1 },
      riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  if (booking === null) {
    throw new ApiCommandError(404, "BOOKING_NOT_FOUND", "Booking was not found.");
  }
  return presentBooking(booking);
}
