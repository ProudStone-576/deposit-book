# Deposit Book — prototype

Daily cash-deposit tracking for 13 stores across 6 cities, with one Company Admin.

Built by [Aethon Core](https://aethoncore.com).

- **Store manager** signs in with their **store number only** (no password),
  files that day's deposit amount, and sees a calendar of their own store only.
- **Company Admin** signs in and sees every store, every day, every number.

## Run it

```bash
npm install
npm run db:migrate      # creates prisma/dev.db
npm run db:seed         # 13 stores + Company Admin. No deposits: the books start empty.
npm run dev             # http://localhost:3000
```

Sign-in:

| Who | Code | PIN |
| --- | --- | --- |
| Store manager | their store number | none |
| Company Admin | Company Admin tab | `ADMIN_PIN` |

The Company Admin PIN is set by `ADMIN_PIN` at seed time (`OWNER_PIN` is still
honoured). If neither is set the seed generates one and prints it once — write
it down, it is stored only as a hash.

Store numbers are **text, not integers** — `02627` and `02631` carry a leading
zero that an integer column would silently drop. A manager who types `2627`
is matched to `02627` rather than being told their store number is wrong.

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

Every store deposits **seven days a week**, so any day without a deposit is a
missed day. Change `depositDays` on a store (CSV of `0`=Sunday .. `6`=Saturday)
if that ever stops being true.

Each store carries a `startDate`, set to the day it was seeded. Days before it
are never flagged as missed, so going live does not paint the calendar red.

### Re-seeding

`npm run db:seed` **erases the books**. Once real deposits exist it refuses to
run and tells you so; `FORCE_RESEED=1` overrides it. Back up `prisma/dev.db`
first.

## The calendar

Same idea as the reference screenshot: one square per day, a mark when the
deposit is in.

| Mark | Meaning |
| --- | --- |
| green ✓ | deposit filed |
| amber ! | due today, not filed yet |
| red ✕ | expected, never filed |
| plain | store closed that day (Sundays by default) |

The Company Admin's calendar shows **filed / expected** per day — `13/13` and a green
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
4. **Nothing is ever edited or deleted.** A wrong deposit is *voided* with a
   written reason; the original stays in the books and the Company Admin sees both.
   A manager can only void on the same day they filed; after that it is the
   Company Admin's call.
5. **Date guards.** No future dates, and nothing older than 45 days without the
   Company Admin. Business dates are stored as `YYYY-MM-DD` strings so no timezone can
   move money into the wrong day.
6. **Duplicate guard.** A second deposit on a date that already has one needs an
   explicit tick, so a double-filing is deliberate rather than accidental.
7. **One timezone decides the date.** `BUSINESS_TZ` (default
   `America/Vancouver`) determines what "today" means, so a server running in
   UTC cannot file an evening deposit under tomorrow's date.
8. **Everything is audited.** Sign-ins, failed sign-ins, filings, voids and
   blocked access attempts all land in `AuditLog`.

## How stores are kept apart

Managers sign in with the store number alone, so **a store number is the only
credential** — anyone who knows it can act as that store. The Company Admin
account is the one that can see all 13 stores, and it still requires a PIN.

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

63 checks covering the arithmetic, the calendar states, stored-data integrity
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
  owner/day/[date]/     admin: all 13 stores for one date
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
  seed.ts        the 13 stores, their managers, and the Company Admin
```

## Deploying

The app is a single long-running Node process with a SQLite file beside it.
That is a deliberate fit for 13 stores filing one figure a day — there is no
database server to run and the whole book is one file you can copy.

**It must not go on Vercel, Netlify or Lambda.** Those wipe the filesystem
between invocations and the deposits go with it. Use a small VM or any host
that runs a container with a volume.

### Docker (recommended)

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
#   paste into SESSION_SECRET in .env, set BUSINESS_TZ

docker compose up -d --build          # migrates on start, then serves :3000
docker compose exec app npx tsx prisma/seed.ts    # once, prints the Company Admin PIN
```

The database lives on the `deposits` volume at `/data/deposits.db`. The app
binds to `127.0.0.1:3000`, so put a TLS-terminating proxy in front of it.

### Without Docker

```bash
npm ci
npm run build
npm run db:deploy        # apply migrations
npm run db:seed          # once, prints the Company Admin PIN
NODE_ENV=production npm run start
```

### TLS is not optional

The session cookie is issued with `secure`, so over plain HTTP the browser
discards it and sign-in appears to do nothing. Terminate TLS at Caddy, nginx or
Cloudflare and forward to port 3000. Caddy needs three lines and gets a
certificate itself:

```
deposits.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Forward `X-Forwarded-For`; the login throttle uses it to identify a caller.

### Backups

```bash
npm run db:backup        # consistent copy, safe to run while serving
```

Keeps the newest 30 in `BACKUP_DIR`. Schedule it daily — cron on Linux, Task
Scheduler on Windows, or `docker compose exec app npm run db:backup`. Copy those
files somewhere off the machine; a backup on the same disk is not a backup.

### Configuration

The server refuses to start if `SESSION_SECRET` is missing, too short, or still
the placeholder, if `DATABASE_URL` is unset, or if `BUSINESS_TZ` names a
timezone it does not recognise. That check is deliberate: a deposit system that
boots with a forgeable signing key is worse than one that will not boot.

## Still open

None of these block going live, but the Company Admin should know:

- **Store-number-only sign-in.** Store numbers appear on receipts and signage,
  so anyone holding one can file deposits for that store and read its history.
  A short per-store PIN would close it — roughly an hour of work.
- **Login throttling is per-process.** Fine for one server; if the app is ever
  run behind more than one instance, the limiter needs a shared store.
- **Managing stores and staff** happens through `prisma/seed.ts`. There is no
  admin screen for adding or renaming a store.
- **No CSV export.** The Company Admin can read every figure on screen but cannot
  download a month.
