# Agent setup runbook

Instructions for an AI coding agent (Claude Code or similar) setting this repo up for a new seller. The person may only have said "make this work" or "set this up". Do the work yourself, and ask them only what is in **Ask** below.

The goal: their own copy of the repo on GitHub, a live site on Vercel with a database and photo storage, and the admin password in their hands. It should take about five minutes and one short message from them.

## Assumptions

- The `git`, `gh` (logged in), `vercel` (logged in), `node` 20+ and `pnpm` CLIs are installed. Check with `gh auth status`, `vercel whoami` and `pnpm -v`. If one is missing or logged out, tell the person the exact command (`gh auth login`, `vercel login`, `npm i -g pnpm`), wait for them to run it, then continue. Don't ask them to do anything in a browser that a CLI can do.
- Everything else (project, Neon database, Blob store, secrets, tables, deploy) is handled by `node scripts/setup.mjs`.

## 1. Get your own copy

Skip this if you are already inside a clone that the person owns, i.e. `git remote get-url origin` isn't `0xRamonM/moving-sale-kit`.

```bash
gh repo create <project> --template 0xRamonM/moving-sale-kit --private --clone
cd <project>
pnpm install
```

`<project>` is a lowercase slug based on their name, e.g. `alex-sale`. It also becomes the Vercel project and the URL `<project>.vercel.app`, so make it short. Private is fine, because the site is public either way. If you're in a clone of the template itself (origin is `0xRamonM/moving-sale-kit`), create the new repo from the template as above rather than pushing to the template.

## 2. Ask (one message, then wait)

Ask for these together in one short, friendly message. Offer the defaults so they can just say "ok":

1. **Your first name**, as buyers will see it.
2. **Pickup spot**: a public place near you (café, shop, metro exit) plus the neighbourhood and city. Not a home address.
3. **Anthropic API key** for the buyer chat. Get one at https://console.anthropic.com/settings/keys; the chat costs cents. They can say "later": the site works, but the chat won't answer until a key is added.
4. Optional: **who else handles pickups** (default: just them), and **an admin password** (default: you generate one).

Work out everything else yourself and don't ask:

- **City, area:** split from their answer. Give both a Portuguese and an English form (for most places they're the same; Lisbon is "Lisboa" in Portuguese).
- **MAP_URL:** `https://www.google.com/maps/search/?api=1&query=<url-encoded "place, area, city">`.
- **TIME_ZONE:** the IANA zone of the city.
- **COUNTRY_CODE and LOCAL_MOBILE:** that country's calling code, and a regex for a local mobile number without it. If you're unsure, use a regex that matches nothing, like `/^$/`.
- **SITE_TITLE:** `{ pt: "Venda do/da <Name>", en: "<Name>'s sale" }`. Use "do" by default, or "da" if the name is clearly feminine in Portuguese.
- **HANDLERS:** `[name, ...others]`. Leave **CHANNELS** as it is.
- **Blob region:** the Vercel region nearest them, e.g. `fra1` or `cdg1` for Europe, `iad1` for the US east, `sfo1` for the US west, `gru1` for South America, `syd1` for Australia.

## 3. Configure

Edit `lib/site.ts` with those values, keeping its comments and structure. The buyer-facing text stays Portuguese + English. If they're clearly not in a Portuguese-speaking place, tell them in one line after setup that the second language can be changed later (README → Customising). Don't change it unless they ask.

## 4. Provision and deploy

```bash
node scripts/setup.mjs --project <project> --anthropic-key <key> --region <region> [--admin-password <pw>]
```

Leave `--anthropic-key` out if they said "later". The script is idempotent: if it stops, fix the cause and run it again. Known stops:

- **Neon terms not accepted.** Happens the first time a Vercel team uses Neon. Send them https://vercel.com/marketplace/neon, ask them to click Install (free plan) and say when it's done, then rerun.
- **Not logged in to Vercel.** They run `vercel login`, then you rerun.
- **`git connect` warning.** Not fatal. Deploys still work from the script. To deploy on push, they install the Vercel GitHub app for the repo at https://github.com/apps/vercel.

## 5. Commit, push, check

```bash
git add lib/site.ts && git commit -m "Set up my sale" && git push
```

Then check the live site:

- `curl -s <site>/llms.txt | head -5` shows their name and pickup spot.
- `curl -s -o /dev/null -w "%{http_code}" <site>/admin` returns 200.
- If a key was set, the chat answers: `curl -s -X POST <site>/api/chat -H 'content-type: application/json' -d '{"itemIds":[],"messages":[{"role":"user","content":"hi"}]}'`. With no items yet this returns `{"error":"not_found"}`, which is expected and means the API is up. The chat itself is tested once they add an item.

## 6. Hand over

Tell them in a few lines:

- the site URL and `<site>/admin`, plus the admin password (it's printed once by the script; it's also in Vercel → Settings → Environment Variables);
- next step: log in to the admin, write their pickup availability under **Chat bot instructions**, and add items with **+ Add an item** (photos straight from the phone);
- on their own phone, open `<site>/?internal=1` once so their visits don't count in the stats.

## Later requests

For "add an item", "change my pickup spot" and the like, see README → Customising and the agent notes at the end of the README. Items are normally added in the admin, not in code.
