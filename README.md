# CV Upload

This SPA supports two storage backends:

- Local IndexedDB (default, offline)
- AWS S3 (via presigned URLs and a tiny Express server). Intended to be fronted by CloudFront + S3.

## Quick start (local storage)

1. Install deps
   - `npm i`
2. Start dev
   - `npm run dev`

## S3 mode (presigned URLs)

1. Copy `.env.example` to `.env` and fill values
2. Start the API server (port 8787)
   - `npm run dev:server`
3. In another terminal start Vite (the client proxies `/api` to `http://localhost:8787`)
   - `npm run dev`
4. Switch storage backend to S3 by setting `VITE_STORAGE=s3` in `.env`

### Environment

Client (`.env`):

```
VITE_STORAGE=s3
VITE_S3_BUCKET=your-bucket
VITE_S3_REGION=eu-central-1
```

Server (`.env` shared or separate):

```
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
S3_BUCKET=your-bucket
S3_PREFIX=cv-uploads/
PORT=8787
ALLOW_ORIGIN=http://localhost:5173
```

Endpoints provided by the server:

- `POST /api/upload-url { name, type }` -> `{ url, key }`
- `GET /api/download-url?key=...` -> `{ url }`
- `GET /api/list` -> `{ items: [{ key, name, size, lastModified, type }] }`
- `POST /api/delete { key }`

## Deploying to AWS

- Build the SPA: `npm run build` and upload `dist/` to an S3 bucket configured for static website hosting or behind CloudFront.
- Deploy the API server to your preferred runtime (EC2, ECS/Fargate, Lambda + API Gateway). It only needs network access to S3 and returns presigned URLs, so it can also run as a Lambda function behind API Gateway.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
