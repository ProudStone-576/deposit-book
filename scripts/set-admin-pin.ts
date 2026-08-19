/**
 * Change the Company Admin PIN without touching the books.
 *
 *   npm run admin:pin -- 4821
 *
 * The seed also sets a PIN, but it erases every deposit on the way — this is
 * the safe way to rotate once the system is in use.
 */
import { prisma } from "../lib/db";
import { hashPin } from "../lib/pin";

async function main() {
  const pin = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!pin || !/^\d{4,12}$/.test(pin)) {
    console.error("Usage: npm run admin:pin -- <4-12 digits>");
    process.exit(1);
  }

  const admin = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
  await prisma.user.update({
    where: { id: admin.id },
    data: { pinHash: hashPin(pin) },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      userName: admin.name,
      action: "ADMIN_PIN_CHANGED",
      detail: JSON.stringify({ via: "script", length: pin.length }),
    },
  });

  const deposits = await prisma.deposit.count();
  console.log(`Company Admin PIN updated. ${deposits} deposits untouched.`);
  if (pin.length < 6) {
    console.log(
      "Note: a short PIN guards every store's figures. The login throttle is " +
        "the only thing slowing an attacker down.",
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
