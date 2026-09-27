# Family Frame — Collage Engine

Creative family collage maker. **React + Vite**.

**Repo:** https://github.com/sk6594246/collageengine  
**Live (after Pages setup):** https://sk6594246.github.io/collageengine/

## Features
- Upload up to 30 photos
- Layouts: collage grid, equal grid, masonry
- Smart size matching
- Per-photo captions (background + size)
- Global collage caption and moods
- **Projects**: create / save / load / delete (IndexedDB)
- Export PNG @ 3×, print
- Warm Family Frame UI

## Quick start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy (GitHub Pages)

This repo uses a **GitHub Actions workflow** (not a branch-only deploy):

- Workflow file: `.github/workflows/deploy.yml`
- Builds on every push to `main` (and manual **Run workflow**)
- Vite `base` is `/collageengine/`

### One-time setup in GitHub

1. Open **Settings → Pages**
2. Under **Build and deployment → Source**, choose **GitHub Actions**
3. Open the **Actions** tab → select **Deploy to GitHub Pages** → confirm the run succeeds
4. Site URL: https://sk6594246.github.io/collageengine/

If the first run fails on permissions, re-check Pages source is **GitHub Actions** and allow the `github-pages` environment if prompted.
