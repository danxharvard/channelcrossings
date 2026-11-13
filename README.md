# Channel Crossings Tracker

A one-page site showing how many people cross the English Channel in small boats each day, using the Home Office's provisional daily figures.

## Files

- `index.html` – the page: the "Bridge" instrument panel (radar of the Strait, year total, daily log, vessels, news)
- `previous.html` – the earlier map homepage, kept for reference and linked from the footer (not indexed by search engines)
- `privacy.html` – the Privacy Policy and Terms of Use, linked from the page footer
- `favicon.svg` – the CC logo shown in the browser tab
- `apple-touch-icon.png` – the icon used when someone adds the site to their iPhone home screen
- `logo-badge.png` – the full Channel Crossings badge, for your X profile and elsewhere
- `og-image.png` – the preview picture X shows when someone shares the link; redrawn whenever new figures are published
- `scripts/og_image.py` – draws `og-image.png`
- `data.json` – the full daily history, loaded by the homepage
- `recent.json` – the last 90 days and totals, used by the embed widget
- `status.json` – a tiny heartbeat written at every check, so open pages know when the site last looked and when to fetch new figures
- `gender.json`, `nationalities.json`, `perboat.json`, `returns.json`, `petitions.json` – sex and age, nationalities, people per boat, UK–France returns and related petitions, all gathered automatically by `scripts/extras.py`
- `requirements.txt` – the Python packages the update job installs
- `data.csv` – the same daily figures as a spreadsheet download, linked from the footer
- `how-it-works.html` – where the figures come from
- `embed.html` – the small "latest figure" box other sites can embed
- `404.html` – shown for any address that doesn't exist (including the retired beta, classic and Beach Radar pages); sends visitors to the homepage
- `sw.js` – offline mode: keeps a copy of the site on visitors' devices
- `robots.txt`, `sitemap.xml` – help search engines find and index the site
- `week-card.png` – the "Week in numbers" picture, redrawn daily for the last full week
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png` – let visitors add the site to their home screen as an app
- Report Channel Crossing (the eye button) is a private form sent through Web3Forms; the access key `RS_KEY` in `index.html` decides which inbox reports go to
- `vendor/inter/`, `vendor/inter-tight/`, `vendor/jetbrains-mono/` – the Inter, Inter Tight and JetBrains Mono fonts (SIL Open Font License): JetBrains Mono for the homepage's panels, Inter Tight for its big figures
- `scripts/update.py` – fetches the latest figures from GOV.UK and updates `data.json`
- `scripts/news.py`, `news.json`, `.github/workflows/news.yml` – breaking news about small boats from UK news feeds, every 15 minutes (create `news-override.json` to hide or pin a story)
- `scripts/build-towns.js`, `towns.json` – the extra town names on the homepage map (GeoNames, CC BY 4.0), shown more as you zoom in; rebuilt by hand, not on a schedule
- `scripts/vessels.py`, `vessels.json` – every 15 minutes, the positions of lifeboats, Border Force, navy ships and rescue aircraft in the Strait from live AIS, drawn on the map (needs the free `AISSTREAM_KEY` secret from [aisstream.io](https://aisstream.io/))
- `.github/workflows/vessels.yml` – runs `scripts/vessels.py` every 15 minutes
- `3c699a48e42e6f3a4c6573138dd6fc80.txt` – the IndexNow key; `update.py` pings search engines with it when new figures arrive, so keep it
- `CNAME` – the custom domain, channelcrossings.world
- `vendor/leaflet/` – the Leaflet map library (BSD licence)
- `.github/workflows/update.yml` and `scripts/gate.py` – from 12 noon UK time, check for new figures every 15 minutes until they're in, then stop until noon the next day

## Put it online with Cloudflare

The site is served by Cloudflare Workers (free plan), not GitHub Pages: `site-worker/wrangler.toml` serves this folder's
files at channelcrossings.world (leaving out what's listed in `site-worker/exclude.txt`, such as the scripts and workflows), and `site-worker/www.toml`
sends www.channelcrossings.world on to it. `.github/workflows/deploy.yml` deploys on every push to main and after every data update.

1. In Cloudflare, add channelcrossings.world to your account (Websites → Add a domain) and switch the domain's nameservers to the two Cloudflare shows.
2. In Cloudflare → My Profile → API Tokens, create a token from the **Edit Cloudflare Workers** template, with your account and the channelcrossings.world zone.
3. In the repository, go to **Settings → Secrets and variables → Actions** and add `CLOUDFLARE_API_TOKEN` (that token) and `CLOUDFLARE_ACCOUNT_ID` (shown on the Cloudflare dashboard's home page), plus `AISSTREAM_KEY` for the rescue and patrol boat positions.
4. Go to **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, and save.
5. In the domain's DNS records in Cloudflare, delete any A, AAAA or `www` CNAME records that point at GitHub, then run **Deploy to Cloudflare** from the **Actions** tab.

The site expects to be served from the root of its own domain (set in `CNAME`): the sitemap, robots.txt, canonical links and IndexNow all name channelcrossings.world, and `404.html` sends visitors to `/`. After that, the figures update themselves every day.

## About the data

Source: [Small boat activity in the English Channel](https://www.gov.uk/government/publications/migrants-detected-crossing-the-english-channel-in-small-boats) (Home Office, Open Government Licence v3.0). Figures are provisional and can be revised. The daily page covers the last 7 days; the time-series spreadsheet, updated on Fridays, goes back to 2018.
