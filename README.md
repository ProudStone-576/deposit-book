# Deposit Book — prototype

Daily cash-deposit tracking for 15 stores across 6 cities, with one Company Admin.

Built by [Aethon Core](https://aethoncore.com).

- **Store manager** signs in with their **store number only** (no password),
  files that day's deposit amount, and sees a calendar of their own store only.
- **Company Admin** signs in and sees every store, every day, every number.

## Run it

```bash
npm install
cp .env.example .env     # fill in DATABASE_URL, DIRECT_URL, SESSION_SECRET
npm run db:deploy        # apply migrations
npm run db:seed          # 15 stores + Company Admin; prints the PIN
npm run dev              # http://localhost:3000
```

Sign-in:

| Who | Code | PIN |
| --- | --- | --- |
| Store manager | their store number | none |
| Company Admin | Company Admin tab | `ADMIN_PIN` |

The Company Admin PIN is set by `ADMIN_PIN` at seed time. If it is unset the
seed generates one and prints it once — write it down, it is stored only as a
hash.

Store numbers are **text, not integers** — `02627`, `02631`, `0013` and `0014`
carry a leading zero that an integer column would silently drop. They are not
all the same length, so a manager who types `2627` is matched to `02627`, and
one who types `13` is matched to `0013`, rather than being told their store
number is wrong.

### Stores

| # | Store | City |
| --- | --- | --- |
| `02627` | Gas Bar | Abbotsford |
| `68295` | Townline | Abbotsford |
| `69830` | Whatcom | Abbotsford |
| `69910` | Clearbrook | Abbotsford |
| `69926` | Sumas | Abbotsford |
| `69975` | King | Abbotsford |
| `36997` | Sardis | Chilliwack |
| `78057` | Evans | Chilliwack |
| `02631` | Horne St | Mission |
| `37815` | 7th Ave | Mission |
| `77947` | Aldergrove | Aldergrove |
| `38866` | Langley | Langley |
| `91214` | Hope | Hope |
| `0013` | A&W King Rd | Abbotsford |
| `0014` | A&W Aldergrove | Aldergrove |

Every store deposits **seven days a week**, so any day without a deposit is a
missed day. Change `depositDays` on a store (CSV of `0`=Sunday .. `6`=Saturday)
if that ever stops being true.

Each store carries a `startDate`, set to the day it was seeded. Days before it
are never flagged as missed, so going live does not paint the calendar red.

### Changing the Company Admin PIN

```bash
npm run admin:pin -- 4821
```

Rotates the PIN in place and leaves every deposit untouched. Use this rather
than re-seeding, which erases the books.

### Opening a new store

```bash
npm run store:add -- 0013 "A&W King Rd" Abbotsford
```

Adds the store and its manager sign-in to a live database and leaves every
deposit untouched — use this rather than re-seeding. Its `startDate` is the day
you run it, so the days before it are never flagged as missed. Re-running with
the same store number corrects the name and city instead of failing.

### Re-seeding

`npm run db:seed` **erases the books**. Once real deposits exist it refuses to
run and tells you so; `FORCE_RESEED=1` overrides it.

## The calendar

Same idea as the reference screenshot: one square per day, a mark when the
deposit is in.

| Mark | Meaning |
| --- | --- |
| green ✓ | deposit filed |
| amber ! | due today, not filed yet |
| red ✕ | expected, never filed |
| plain | store closed that day (Sundays by default) |

The Company Admin's calendar shows **filed / expected** per day — `15/15` and a green
tick means every store is in. Tap any day to see exactly which store is short.

## How the numbers are protected

The Company Admin is sensitive about numbers, so accuracy is enforced by the system
rather than by care:

1. **Money is stored as integer cents.** No floats anywhere, so no rounding
   drift. `lib/money.ts` is the only place money is parsed or formatted.
2. **Re-key confirmation.** The manager types the deposit amount, then types it
   a second time. If the two do not match to the cent, the deposit is rejected
   and nothing is written.
3. **The server re-parses the amount.** Whatever the browser shows is display
   only; `createDepositAction` parses and validates the submitted value itself
   and rejects anything ambiguous (`1.234`, `12,3`, letters, blank, zero).
4. **A manager can never edit.** A wrong deposit is *voided* with a written
   reason; the original stays in the books and both records remain visible. A
   manager can only correct — void or delete — on the same day they filed, and
   only for their own store; after that it is the Company Admin'''s call.
5. **Deleting is heavier than voiding.** It removes the row from the books —
   calendar, day totals and month totals all change as though it was never
   filed. It needs a written reason and the exact amount re-keyed, and the whole
   deposit is copied into the audit log first, so the figure stays recoverable
   from the trail even though the row is gone. The Company Admin can delete any
   deposit; a manager only within the same-day window in rule 4. Prefer voiding:
   it leaves the correction visible.
6. **Date guards.** No future dates, and nothing older than 45 days without the
   Company Admin. Business dates are stored as `YYYY-MM-DD` strings so no timezone can
   move money into the wrong day.
7. **Duplicate guard.** A second deposit on a date that already has one needs an
   explicit tick, so a double-filing is deliberate rather than accidental.
8. **One timezone decides the date.** `BUSINESS_TZ` (default
   `America/Vancouver`) determines what "today" means, so a server running in
   UTC cannot file an evening deposit under tomorrow's date.
9. **Everything is audited.** Sign-ins, failed sign-ins, filings, voids and
   blocked access attempts, exports and deletions all land in `AuditLog`.

## How stores are kept apart

Managers sign in with the store number alone, so **a store number is the only
credential** — anyone who knows it can act as that store. The Company Admin
account is the one that can see all 15 stores, and it still requires a PIN.

A manager's `storeId` comes from their signed session cookie — never from a URL
or form field. Every deposit read passes through `assertStoreAccess()`, which
lets the Company Admin through and redirects anyone else, writing a `VIEW_DENIED` audit
row on the way out. Admin-only pages go through `requireOwner()`, which audits
the same way.

Verified live in `scripts/verify.ts`:

```bash
npm run dev            # in one terminal
npx tsx --env-file=.env scripts/verify.ts
```

74 checks covering the arithmetic, the calendar states, stored-data integrity
(every stored amount is still a positive whole number of cents), and
cross-store access — a manager for store 101 cannot open store 102's deposit,
cannot reach the admin pages, and a forged cookie is rejected. The last group
checks the shell renders: header wordmark and Aethon Core attribution on every
screen.

## Layout

```
app/
  login/                sign in (store number, or Company Admin + PIN)
  dashboard/            manager: own-store calendar
  dashboard/[date]/     manager: one day's deposits
  deposit/new/          manager: file a deposit
  deposit/[id]/         one deposit in full
  owner/                admin: all-store calendar + city rollups
  owner/day/[date]/     admin: all 15 stores for one date
  owner/store/[id]/     admin: one store's month
components/
  AppShell.tsx  header + page body + footer, used by every signed-in screen
  Brand.tsx     product mark and wordmark
  Footer.tsx    Aethon Core attribution
lib/
  money.ts   cents-only parsing and formatting
  dates.ts   YYYY-MM-DD business dates, calendar grid, day states
  auth.ts    session cookie, PIN check, store-access gate, audit
  actions.ts server actions: login, file deposit, void deposit
  queries.ts all reads (store month, owner month, day drill-down)
prisma/
  schema.prisma  Store, User, Deposit, AuditLog
  seed.ts        the 15 stores, their managers, and the Company Admin
```

## Deploying (Vercel + Neon)

The app runs on Vercel with Postgres on Neon. There is no server to run and
TLS is handled for you.

**It cannot run on Vercel with a file database.** Vercel's filesystem is
per-invocation and discarded, so a SQLite file would be recreated empty on
every cold start and each deposit would quietly disappear. That is why the
datasource is Postgres.

### One-time setup

1. **Database** — create a Neon project. Take two connection strings from the
   dashboard: the pooled one (contains `-pooler`) and the direct one (same
   without it).

2. **Import the repo** into Vercel (New Project → pick `deposit-book`). The
   defaults are correct; `npm run build` already runs `prisma generate`.

3. **Environment variables** in Vercel → Settings → Environment Variables, for
   Production *and* Preview:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** string |
   | `DIRECT_URL` | Neon **direct** string |
   | `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `BUSINESS_TZ` | `America/Vancouver` |

   The app refuses to start if any of these are missing, if the secret is too
   short, or if `DATABASE_URL` is not the pooled endpoint.

4. **Schema and stores**, once, from your machine with the same values in
   `.env`:

   ```bash
   npm run db:deploy     # create the tables
   ADMIN_PIN=... npm run db:seed
   ```

5. **Deploy.** Vercel gives you `*.vercel.app` with TLS immediately; add your
   own domain in Settings → Domains when ready.

### Protecting the records

**Neon keeps continuous point-in-time restore.** You can rewind the database to
any moment inside the retention window from the Neon dashboard — that covers a
bad query, a wrong bulk edit, or anything we get wrong. Check the retention
period on your plan and raise it if it is short; it is the main safety net.

**Take your own copy too.** Point-in-time restore lives inside Neon, so it does
not survive losing the Neon account. The Company Admin can download the whole
book as CSV from the overview page ("Download CSV"), and the same thing runs
from a terminal:

```bash
npm run db:export           # ./exports/deposit-book-YYYY-MM-DD.csv
```

The CSV carries `amount_cents` alongside the formatted amount, so it can be
re-imported without a rounding argument. Do this monthly and keep it somewhere
that is not Neon. Exports contain every figure for every store — treat the file
as the books.

### Configuration

The server refuses to start if `SESSION_SECRET` is missing, too short, or still
a placeholder; if `DATABASE_URL` is absent, not a Postgres url, or not the
pooled endpoint in production; if `DIRECT_URL` is missing; or if `BUSINESS_TZ`
names a timezone it does not recognise. A deposit system that boots with a
forgeable signing key is worse than one that will not boot.

## Still open

None of these block going live, but the Company Admin should know:

- **Store-number-only sign-in.** Store numbers appear on receipts and signage,
  so anyone holding one can file deposits for that store and read its history.
  A short per-store PIN would close it — roughly an hour of work.
- **Serverless cold starts** add a second or two to the first request after a
  quiet period. Harmless for a once-a-day deposit.
- **Managing stores and staff** happens through `prisma/seed.ts`. There is no
  admin screen for adding or renaming a store.
- **No CSV export.** The Company Admin can read every figure on screen but cannot
  download a month.
