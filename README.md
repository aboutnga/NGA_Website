# Next Generation Advocates Website

This repository contains the website for Next Generation Advocates (NGA). It uses Astro with TypeScript and produces a fully static site for deployment to Cloudflare Pages.

This initial foundation is intentionally minimal. Visual design, branding, content, and organization-specific features will be developed separately.

## Technical setup

- Astro 7
- TypeScript using Astro's strict configuration
- Node.js 24 (see `.nvmrc`)
- npm with a committed `package-lock.json`
- Static output written to `dist/`

## Local development

Install dependencies:

```bash
npm install
```

Start the development server at `http://localhost:4321`:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

To verify the project using the same clean-install workflow used by Cloudflare Pages:

```bash
npm ci && npm run build
```

## Static site configuration

`astro.config.mjs` sets Astro's output mode to `static`. The public site URL used by Astro resolves in this order:

1. `SITE_URL` — the final custom production domain
2. `CF_PAGES_URL` — supplied automatically by Cloudflare Pages
3. `http://localhost:4321` — local fallback

Do not hardcode an unconfirmed Cloudflare Pages hostname.

## Cloudflare Pages deployment

Connect the GitHub repository `aboutnga/NGA_Website` to a Cloudflare Pages project with these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Astro |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `24` (from `.nvmrc`) |

Cloudflare Pages should build preview deployments for non-production branches and deploy production whenever `main` changes.

After connecting NGA's custom domain, set `SITE_URL` in the Cloudflare Pages production environment to the complete HTTPS origin, for example `https://www.example.org`. Cloudflare supplies `CF_PAGES_URL` automatically for deployments where `SITE_URL` is not set.

No Cloudflare Functions, databases, KV namespaces, storage bindings, analytics integrations, or other runtime services are part of this foundation.

## Project structure

```text
public/                 Static assets copied directly to the build
src/pages/              File-based Astro routes
astro.config.mjs        Astro and static-output configuration
tsconfig.json           Strict TypeScript configuration
package.json            npm scripts and dependencies
package-lock.json       Reproducible dependency lockfile
```
