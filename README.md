# ImgKitLab

Free browser-based image tools for overseas users. All processing happens locally — no upload, no backend.

## Tools

- Compress JPG / PNG
- Resize, crop, circle crop
- PNG ↔ WebP, JPG to WebP
- Remove EXIF metadata
- Instagram resizer
- Image to ICO (favicon)

## Tech

- Static HTML + CSS + vanilla JavaScript
- Canvas API for image processing
- Hosted on Cloudflare Pages (see [DEPLOY.md](DEPLOY.md))

## Local preview

Open `index.html` in a browser, or use a simple static server:

```bash
# Python 3
python -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080`

## Before going live

1. Register domain (e.g. `imgkitlab.com`)
2. Replace `contact@imgkitlab.com` in `pages/contact.html`
3. Update canonical URLs in HTML if your domain differs from `imgkitlab.com`
4. Follow [DEPLOY.md](DEPLOY.md) for GitHub + Cloudflare Pages
5. Submit sitemap in Google Search Console
6. Apply for Google AdSense after 2–4 weeks of traffic

## License

Site code: use freely for your own deployment. No warranty.
