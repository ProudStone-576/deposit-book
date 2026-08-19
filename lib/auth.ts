import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
export { hashPin, verifyPin } from "./pin";

const COOKIE = "ds_session";
const MAX_AGE_SECONDS = 12 * 60 * 60; // a shift, not a month

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET missing or too short (need 32+ chars)");
  }
  return new TextEncoder().encode(s);
}

// ---------- Session ----------

export type Session = {
  userId: number;
  name: string;
  role: "MANAGER" | "OWNER";
  storeId: number | null;
  storeNumber: string | null;
  storeName: string | null;
};

export async function createSession(s: Session): Promise<void> {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * A signature alone is not enough. The cookie names a user and a store, and
 * both must still exist and still be linked the same way — otherwise a cookie
 * issued before a re-seed or a staff change would let stale ids reach the
 * database and fail there instead of here.
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  let userId: number;
  let role: "MANAGER" | "OWNER";
  let storeId: number | null;
  try {
    const { payload } = await jwtVerify(token, secret());
    userId = payload.userId as number;
    role = payload.role as "MANAGER" | "OWNER";
    storeId = (payload.storeId as number | null) ?? null;
  } catch {
    return null;
  }
  if (!Number.isInteger(userId)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { store: true },
  });

  // Deleted, deactivated, re-roled, or moved to another store: sign them out.
  if (!user || !user.active) return null;
  if (user.role !== role) return null;
  if ((user.storeId ?? null) !== storeId) return null;
  if (user.role === "MANAGER" && !user.store) return null;

  // Names come from the row, not the cookie, so a renamed store shows correctly.
  return {
    userId: user.id,
    name: user.name,
    role: user.role as "MANAGER" | "OWNER",
    storeId: user.storeId,
    storeNumber: user.store?.storeNumber ?? null,
    storeName: user.store?.name ?? null,
  };
}

/** Any signed-in user, or bounce to login. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Owner only. Managers get pushed back to their own dashboard. */
export async function requireOwner(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "OWNER") {
    await prisma.auditLog.create({
      data: {
        userId: s.userId,
        userName: s.name,
        action: "VIEW_DENIED",
        entity: "OwnerArea",
        detail: JSON.stringify({ storeId: s.storeId }),
      },
    });
    redirect("/dashboard");
  }
  return s;
}

/**
 * The single gate for "can this user see this store's numbers?".
 * Managers are pinned to exactly one store; the owner sees all of them.
 * Every query that touches deposits must go through this.
 */
export async function assertStoreAccess(
  session: Session,
  storeId: number,
): Promise<void> {
  if (session.role === "OWNER") return;
  if (session.storeId === storeId) return;

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      userName: session.name,
      action: "VIEW_DENIED",
      entity: "Store",
      entityId: storeId,
      detail: JSON.stringify({ ownStoreId: session.storeId }),
    },
  });
  redirect("/dashboard");
}

export async function audit(entry: {
  userId?: number | null;
  userName: string;
  action: string;
  entity?: string;
  entityId?: number;
  detail?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      userName: entry.userName,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      detail: entry.detail === undefined ? null : JSON.stringify(entry.detail),
    },
  });
}
