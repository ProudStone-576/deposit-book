import { requireOwner } from "@/lib/auth";
import { depositsCsv } from "@/lib/export";
import { audit } from "@/lib/auth";
import { todayYmd } from "@/lib/dates";

/**
 * Company Admin downloads the whole book as CSV. Gated by the same check as
 * every other all-stores view, and audited — an export is a copy of every
 * figure leaving the system.
 */
export async function GET() {
  const session = await requireOwner();
  const csv = await depositsCsv();

  await audit({
    userId: session.userId,
    userName: session.name,
    action: "EXPORT_CSV",
    detail: { bytes: csv.length },
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deposit-book-${todayYmd()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
