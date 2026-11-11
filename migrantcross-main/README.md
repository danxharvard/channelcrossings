# Channel Crossings Tracker

A one-page site showing how many people cross the English Channel in small boats each day, using the Home Office's provisional daily figures.

## Files

- `index.html` – the page
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
- `studio.js`, `studio.css` – Studio, the paid fourth tab: every graph in six styles and many chart forms, plus Ask for a chart (`studio-ask.js`), unlocked for £1.99; loaded only when the tab opens
- `scripts/studio-worker.js` – the Cloudflare Worker behind Studio's accounts and payments (an account is an email address; Stripe is the only record of who has paid)
- `404.html` – shown for any address that doesn't exist (including the retired beta, classic and Beach Radar pages); sends visitors to the homepage
- `sw.js` – offline mode: keeps a copy of the site on visitors' devices
- `robots.txt`, `sitemap.xml` – help search engines find and index the site
- `week-card.png` – the "Week in numbers" picture, redrawn daily for the last full week
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png` – let visitors add the site to their home screen as an app
- Report Channel Crossing (the eye button) is a private form sent through Web3Forms; the access key `RS_KEY` in `index.html` decides which inbox reports go to
- `vendor/inter/`, `vendor/inter-tight/` – the Inter and Inter Tight fonts (SIL Open Font License), used on every device: Inter for text, Inter Tight for headings and big figures
- `scripts/update.py` – fetches the latest figures from GOV.UK and updates `data.json`
- `scripts/news.py`, `news.json`, `.github/workflows/news.yml` – breaking news about small boats from UK news feeds, every 15 minutes (create `news-override.json` to hide or pin a story)
- `scripts/build-towns.js`, `towns.json` – the extra town names on the homepage map (GeoNames, CC BY 4.0), shown more as you zoom in; rebuilt by hand, not on a schedule
- `scripts/facebook.py`, `fb.json` – posts each day's figures to the Facebook Page once they're published (needs the `FB_PAGE_ID` and `FB_PAGE_TOKEN` secrets; `fb.json` remembers the last day posted)
- `scripts/vessels.py`, `vessels.json` – every 15 minutes, the positions of lifeboats, Border Force, navy ships and rescue aircraft in the Strait from live AIS, drawn on the map (needs the free `AISSTREAM_KEY` secret from [aisstream.io](https://aisstream.io/))
- `scripts/tg_login.py` – run once by hand to make the `TG_SESSION` secret; with `TG_API_ID`, `TG_API_HASH` and `TG_SESSION` set, `news.py` reads the live sightings channels through Telegram's API
- `.github/workflows/vessels.yml` – runs `scripts/vessels.py` every 15 minutes
- `3c699a48e42e6f3a4c6573138dd6fc80.txt` – the IndexNow key; `update.py` pings search engines with it when new figures arrive, so keep it
- `CNAME` – the custom domain, channelcrossings.world
- `vendor/leaflet/` – the Leaflet map library (BSD licence)
- `.github/workflows/update.yml` and `scripts/gate.py` – from 12 noon UK time, check for new figures every 15 minutes until they're in, then stop until noon the next day

## Put it online with GitHub Pages

1. Create a new **public** repository on GitHub.
2. Upload everything in this folder, keeping the folder structure (including the `.github` folder).
   On a Mac, press Cmd+Shift+. in Finder to see the hidden `.github` folder.
3. In the repository, go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. Go to **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, and save.
5. Go to the **Actions** tab, open **Update crossing figures**, and click **Run workflow** once to load the full history.

The site expects to be served from the root of its own domain (set in `CNAME`): the sitemap, robots.txt, canonical links and IndexNow all name channelcrossings.world, and `404.html` sends visitors to `/`. After that, the figures update themselves every day.

## About the data

Source: [Small boat activity in the English Channel](https://www.gov.uk/government/publications/migrants-detected-crossing-the-english-channel-in-small-boats) (Home Office, Open Government Licence v3.0). Figures are provisional and can be revised. The daily page covers the last 7 days; the time-series spreadsheet, updated on Fridays, goes back to 2018.

## Studio: switching on payments

Studio stays hidden until the worker is running. To switch it on:

1. **Stripe.** Make an account at stripe.com and stay in **test mode** to start. Copy the secret key (`sk_test_…`) from Developers → API keys.
2. **Resend.** Make an account at resend.com, add `channelcrossings.world` under Domains and add the DNS records it shows at your domain provider, then create an API key.
3. **Cloudflare.** Make a free account, go to Workers & Pages → Create → Worker, paste in `scripts/studio-worker.js` and deploy. Under Settings → Variables and Secrets, add `STRIPE_KEY`, `RESEND_KEY` and `SECRET` (any long random string) as secrets, and `SITE` = `https://channelcrossings.world`, `MAIL_FROM` = `Channel Crossings <studio@channelcrossings.world>`, `PRICE_PENCE` = `199` as text.
4. Put the worker's address (for example `https://studio.yourname.workers.dev`) into `window.CC_STUDIO_API` in `index.html`. The Studio tab still only appears on devices that have opened `https://channelcrossings.world/?studio=preview#studio`, so you can test privately.
5. Try it with Stripe's test card 4242 4242 4242 4242, any future date and any CVC. Nothing is charged in test mode.
6. When you're happy, activate your Stripe account, swap `STRIPE_KEY` in Cloudflare for the live key (`sk_live_…`), and set `STUDIO_LIVE = true` in `index.html` to show the tab to everyone.
