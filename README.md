# moving-sale-kit

A one-page site for selling your own stuff: moving out, clearing a flat, a garage sale. You list items with photos and prices. Buyers tap "I'm interested", and an AI chat answers their questions and takes their phone number. You get the lead in an admin panel with a one-tap WhatsApp message ready to send.

It was built for a real sale in Lisbon, so the public page is **bilingual Portuguese / English** out of the box. Changing the languages is covered under [Customising](#customising).

## What you get

- **Public page:** a grid of items with photos, prices and category filters. There's an "available later" section for things you're still using, and buyers can pick several items and ask about them together.
- **Buyer chat:** runs on Claude Haiku. It answers questions about the items, pickup and timing, passes offers on to you without accepting or refusing them, and records interest once it has a phone number.
- **Admin (`/admin`, password protected):**
  - Add and edit items. Photos upload straight from your phone and are resized automatically.
  - Mark items for sale, reserved or sold. Reserved and sold items disappear from the public page.
  - A list of leads, each with a pre-filled WhatsApp or Telegram message in the buyer's language.
  - A pickup schedule. Reserving an item makes you book its pickup.
  - Editable instructions for the chat bot (when you're available, rules about offers, and so on).
  - A Facebook Marketplace "kit" for each item: copyable title, description and photos.
- **Tracking:** 7 days of visitors, chats and leads. You can create referral links (`?ref=instagram`) to see which places you post bring buyers. Your own devices aren't counted.
- **Agent-friendly:** `/llms.txt` and `/items.json` let AI agents read the catalogue and use the chat over HTTP.

**Stack:** Next.js 16 (App Router), Neon Postgres, Vercel Blob, the Anthropic API and Tailwind 4. It's built to run on Vercel. The free tiers of Vercel, Neon and Blob are plenty for a sale, and the chat costs cents.

---

## Set it up

### Option A: let your AI agent do it (about 5 minutes)

If you have [Claude Code](https://claude.com/claude-code) (or a similar coding agent) with the GitHub CLI (`gh`) and Vercel CLI (`vercel`) installed and logged in, open it in any empty folder and paste:

> Set up my own sale site from https://github.com/0xRamonM/moving-sale-kit, following its SETUP.md.

It will ask you three things in one message: your first name, a public pickup spot (place, neighbourhood, city) and an [Anthropic API key](https://console.anthropic.com/settings/keys) for the buyer chat. It then does the rest:

- creates your copy of the repo,
- fills in your details,
- creates the Vercel project, Neon database and photo storage,
- sets the secrets, creates the tables and deploys.

At the end it gives you your site URL and admin password.

If you've already cloned the repo, run `/setup` inside it, or just say "make this work".

The only thing you might be asked to do in a browser is accept Neon's free-plan terms on Vercel, and only the first time your Vercel account uses Neon.

The agent follows [`SETUP.md`](SETUP.md), and the provisioning is a single idempotent script, [`scripts/setup.mjs`](scripts/setup.mjs), which you can also run yourself:

```bash
node scripts/setup.mjs --project my-sale --anthropic-key sk-ant-... --region fra1
```

### Option B: by hand (about 15 minutes)

You need accounts on [GitHub](https://github.com), [Vercel](https://vercel.com) and [Anthropic](https://console.anthropic.com) (for the API key), plus Node 20+ and [pnpm](https://pnpm.io) if you want to run it locally.

#### 1. Copy the repo

Click **Use this template** (or **Fork**) on GitHub, then clone your copy:

```bash
git clone https://github.com/<you>/<your-repo>.git
cd <your-repo>
pnpm install
```

#### 2. Put in your details

Edit **`lib/site.ts`**. It's the only file with seller-specific settings:

| Setting | What it is |
|---|---|
| `SELLER` | Your first name, as buyers see it |
| `SITE_TITLE` | Page title in Portuguese and English |
| `AREA`, `CITY` | Neighbourhood and city for pickup |
| `PICKUP_PLACE` | A short, exact name of the pickup spot (a café, a shop, a corner). The chat writes it word for word and turns it into a map link. **Don't use your home address.** |
| `MAP_URL` | A Google Maps link to that spot |
| `TIME_ZONE` | IANA zone, e.g. `Europe/Lisbon`, `Europe/Berlin`, `America/New_York` |
| `COUNTRY_CODE`, `LOCAL_MOBILE` | Lets phone numbers typed without a country code still open in WhatsApp |
| `HANDLERS` | Who can do pickups (you, a partner, a flatmate) |
| `CHANNELS` | Where you advertise (shown when booking a pickup) |

Everything in this file ends up public. Never put your phone number in it: buyers give you theirs, and you message them first.

#### 3. Create the Vercel project and storage

1. In Vercel, click **Add New → Project** and import your repo. The first deploy can fail because env vars are missing. That's fine.
2. In the project, go to **Storage → Create Database → Neon** (Postgres) and connect it. This adds `DATABASE_URL`.
3. Go to **Storage → Create → Blob**, pick **public** access and connect it. This adds `BLOB_READ_WRITE_TOKEN`.
4. Go to **Settings → Environment Variables** and add:
   - `ADMIN_PASSWORD`: the password you'll use for `/admin`.
   - `SESSION_SECRET`: a long random string (`openssl rand -hex 32`).
   - `ANTHROPIC_API_KEY`: from [console.anthropic.com](https://console.anthropic.com/settings/keys).
   - Optional: `NEXT_PUBLIC_POSTHOG_KEY`, a [PostHog](https://posthog.com) EU project key for recordings and funnels.
   - Optional: `NEXT_PUBLIC_SITE_URL`, only if you add a custom domain.

All the variables are listed in [`.env.example`](.env.example).

#### 4. Create the tables

From your machine, with the [Vercel CLI](https://vercel.com/docs/cli):

```bash
vercel link
vercel env pull .env.local
pnpm migrate
```

`pnpm migrate` is safe to run again; it only adds what's missing. You can also copy `DATABASE_URL` from Neon into `.env.local` by hand and run `pnpm migrate`.

#### 5. Deploy and add items

Push to `main` (or click **Redeploy** in Vercel). Then:

1. Open `https://<your-project>.vercel.app/admin` and log in with `ADMIN_PASSWORD`.
2. Open **Chat bot instructions** and write when you're available for pickups, plus any rules (for example "sale ends 30 November", "furniture must be collected by two people").
3. Click **+ Add an item**. Give a title and description in both languages, a price (empty means "make an offer"), a category and photos.
4. Share the link. Use **Tracking → links** to make a separate link for each place you post.

To keep your own visits out of the stats on a phone where you don't log in, open `/?internal=1` on it once.

### Run it locally

```bash
pnpm dev
```

Open http://localhost:3000. It uses the same database and Blob store as production. If you want separate test data, make a Neon branch and put its `DATABASE_URL` in `.env.local`.

---

## Customising

- **Categories:** edit `lib/categories.ts`. The keys are stored in the database, so add new ones rather than renaming existing ones.
- **Chat behaviour:** for day-to-day rules, use the instructions box in the admin. The base prompt (tone, how it asks for a phone number, how it handles offers) is `systemPrompt` in `app/api/chat/route.ts`. The model is set at the top of that file.
- **Languages:** the page shows Portuguese first, then English. Items have `title_pt`/`title_en` and `description_pt`/`description_en`, and `<Bi pt=… en=…>` in `app/bi.tsx` renders both. To use another language pair, change the Portuguese strings (search for `pt:` and `pt=`), and update the "European Portuguese" lines in the chat prompt and `lib/lead-message.ts`. To use only one language, make `Bi` render just the `en` text.
- **Currency:** prices are in euros (`formatPrice` in `lib/db.ts`, `euros()` in `lib/lead-message.ts` and `lib/marketplace.ts`, and `priceCurrency` in `app/page.tsx`).
- **Colours and fonts:** `app/globals.css`.

## How it fits together

```
app/page.tsx              public page (server component, cached; refreshed when items change)
app/chat.tsx              buyer chat UI
app/api/chat/route.ts     chat endpoint: Claude + the register_interest tool, saves leads and transcripts
app/admin/                admin pages and server actions (actions.ts)
app/api/upload/route.ts   photo upload to Vercel Blob
app/api/track/route.ts    first-party analytics events
app/llms.txt, items.json  machine-readable catalogue
lib/site.ts               ← your settings
lib/db.ts                 Neon client, types, price/date helpers
scripts/migrate.mjs       creates and updates the tables
```

The public page is cached and refreshed whenever you change an item in the admin. If you edit the database directly, call `POST /api/revalidate` with `Authorization: Bearer $SESSION_SECRET` to refresh it.

## Notes for agents

For first-time setup, follow [`SETUP.md`](SETUP.md). For changes later on:

- This is Next.js 16 with `cacheComponents`. Read `AGENTS.md` and the docs in `node_modules/next/dist/docs/` before changing framework code.
- Server actions that change items call `itemsChanged()`, which updates the cache tag and refreshes the page.
- For one-off database changes, write a script in `scripts/`, run it with `node --env-file=.env.local scripts/<file>.mjs`, then delete it.
- Check your work with `pnpm build` and `pnpm lint`.

## License

MIT
