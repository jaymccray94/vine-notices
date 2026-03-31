# VineAdmin Notices & Meetings

FL-compliant HOA notice and meeting management application for Vine Management Group.

## Features

- **Admin Notices** — 13 FL-compliant notice types with PDF upload/download
- **Admin Meetings** — Meeting records with video, agenda, and minutes URLs
- **AI Meeting Notices** — Auto-generate FL-statutory board/annual meeting notices
- **AI Meeting Minutes** — Record motions, action items, generate formatted minutes
- **Public Embed Pages** — Embeddable notices/meetings via association slug URLs
- **Public Document API** — Returns only `isPublic` + `current` status documents
- **Magic Link Auth** — 6-digit code, Bearer tokens, 24h expiry
- **Per-Association RBAC** — super_admin, association_admin, staff roles
- **CINC OAuth2 Integration** — Settings UI, test connection, sync

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Auth:** Magic link (Bearer tokens)
- **Validation:** Zod schemas

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

## Railway Deployment

Connect this repo to Railway. The `railway.json` and `Dockerfile` are pre-configured.

Set custom domain: `notices.vinemgmt.app`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |

## Seeded Users

- `jay@vinemgt.com` (super_admin)
- `admin@vinemgt.com` (super_admin)
