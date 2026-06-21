import dotenv from 'dotenv';
dotenv.config();

import { createPrismaClientFromEnvironment } from '../packages/db/src/client.js';

const prisma = createPrismaClientFromEnvironment();

async function main() {
  const callId = "call_3d10c929402f413b9a31f1b3514a2c87";
  console.log(`=== QUERYING CALL: ${callId} ===`);
  const call = await prisma.callSession.findUnique({
    where: { publicId: callId },
    include: {
      booking: {
        include: {
          agreements: true,
          inventoryHolds: true,
          riskAssessments: true,
        }
      },
      riskAssessments: true,
      transcriptTurns: true
    }
  });

  if (!call) {
    console.log("Call not found in database!");
    return;
  }

  console.log(`Call ID: ${call.publicId}`);
  console.log(`Status: ${call.status}`);
  console.log(`Risk assessments on call: ${call.riskAssessments.length}`);
  for (const r of call.riskAssessments) {
    console.log(`  Risk on call: ${r.publicId}, Version: ${r.assessmentVersion}`);
  }

  if (call.booking) {
    console.log(`Booking ID: ${call.booking.publicId}`);
    console.log(`Booking Status: ${call.booking.status}`);
    console.log(`Risk assessments on booking: ${call.booking.riskAssessments.length}`);
    for (const r of call.booking.riskAssessments) {
      console.log(`  Risk on booking: ${r.publicId}, Version: ${r.assessmentVersion}, Completeness: ${r.completenessScore}, Readiness: ${r.paymentReadinessScore}, Gate: ${r.gateDecision}`);
    }
  } else {
    console.log("No booking linked.");
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
