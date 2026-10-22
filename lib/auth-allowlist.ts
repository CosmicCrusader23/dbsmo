import { AuthAllowlistKind } from "@prisma/client";
import { prisma } from "@/lib/db";

const LEGACY_CUSTOM_EMAIL = "s202201109@dbspd.edu.hk";

/** Move the formerly hardcoded school email into removable, admin-managed storage once. */
export async function ensureLegacyAllowlistImported() {
  await prisma.$transaction(async (tx) => {
    const state = await tx.authAllowlistState.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global" },
    });
    if (state.legacyEmailImported) return;

    const claim = await tx.authAllowlistState.updateMany({
      where: { id: "global", legacyEmailImported: false },
      data: { legacyEmailImported: true },
    });
    if (claim.count !== 1) return;

    await tx.authAllowlistEntry.upsert({
      where: { value: LEGACY_CUSTOM_EMAIL },
      update: {},
      create: { kind: AuthAllowlistKind.EMAIL, value: LEGACY_CUSTOM_EMAIL },
    });
  });
}
