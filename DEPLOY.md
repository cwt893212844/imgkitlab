# Deployment Guide — ImgKitLab

## Prerequisites

- GitHub account
- Cloudflare account (free)
- Domain name (~$10–15/year), e.g. `imgkitlab.com`

## Step 1: Update site for your domain

If your domain is **not** `imgkitlab.com`, find-and-replace across all files:

- `https://imgkitlab.com` → `https://yourdomain.com`
- `contact@imgkitlab.com` → your real email in `pages/contact.html`

## Step 2: Push to GitHub

```bash
cd "e:\000AI变现\08-网站3"
git init
git add .
git commit -m "Initial ImgKitLab static image tools site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/image-tools-site.git
git push -u origin main
```

Create the empty repository on GitHub first (no README), then run the commands above.

## Step 3: Cloudflare Pages

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Select your `image-tools-site` repository
4. Build settings:
   - **Framework preset:** None
   - **Build command:** (leave empty)
   - **Build output directory:** `/`
5. **Save and Deploy**

Your site will be live at `https://image-tools-site.pages.dev` (or similar).

## Step 4: Custom domain

1. In Cloudflare Pages project → **Custom domains** → **Set up a custom domain**
2. Enter `imgkitlab.com` and `www.imgkitlab.com`
3. If domain is on Cloudflare Registrar/DNS, records are added automatically
4. Enable **Always Use HTTPS**

## Step 5: Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://imgkitlab.com`
3. Verify via DNS TXT record (Cloudflare) or HTML file
4. **Sitemaps** → submit `https://imgkitlab.com/sitemap.xml`
5. Use **URL Inspection** to request indexing for homepage and top tools

## Step 6: Google AdSense (after 2–4 weeks)

1. Apply at [Google AdSense](https://www.google.com/adsense/)
2. After approval, replace ad placeholder divs:

```html
<!-- Replace this -->
<div class="ad-slot ad-slot-banner" aria-hidden="true">Advertisement</div>

<!-- With your AdSense code -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX"
     crossorigin="anonymous"></script>
<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXX" data-ad-slot="YYYY" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

3. Privacy policy already mentions AdSense in `pages/privacy.html`

## Optional: Google Analytics

Add GA4 snippet before `</head>` on each page, or use Cloudflare Web Analytics (privacy-friendly, no cookie banner needed in some regions).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Tools don't load images | Must use HTTPS or localhost; `file://` may block canvas |
| 404 on tool pages | Check paths; Cloudflare output dir must be `/` |
| AdSense rejected | Need more pages, privacy policy, real traffic, original tools |
| ICO preview broken | Some browsers don't preview `.ico`; download still works |

## Costs

| Item | Cost |
|------|------|
| Cloudflare Pages | Free |
| Domain | ~$10–15/year |
| GPU/server | $0 (browser-only) |
