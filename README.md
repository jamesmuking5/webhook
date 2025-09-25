# Webhook Service

This repository contains a simple Node.js webhook with a single `/webhook` route. It accepts `multipart/form-data` POST requests (one or many files) and stores each batch inside a timestamped folder under `uploads/`, returning metadata about the saved files in the JSON response.

## Prerequisites

- Node.js 18.x or newer
- npm 9.x or newer

## Install

```powershell
pnpm install
```

> Prefer pnpm for its deterministic installs. If you do use npm, delete `pnpm-lock.yaml` first to avoid lockfile conflicts.

## Run the server

```powershell
pnpm start
```

The service listens on port `3000` by default. Override the port with the `PORT` environment variable:

```powershell
$env:PORT="8080"; pnpm start
```

## Build

```powershell
pnpm run build
```

> The build script is a lightweight no-op because this Express service does not require compilation.

## Try the webhook

Run the server and send a multipart request with one or more files:

```powershell
curl -X POST http://localhost:3000/webhook `
  -F "files=@path\to\file1.txt" `
  -F "files=@path\to\file2.jpg" `
  -F "event=test"
```

## Uploaded files

- Files are saved beneath `uploads/<ISO-timestamp>/` using sanitized filenames.
- The JSON response includes `uploadDir` and `files[].path` so you can locate the persisted assets on disk.
- Add your own post-processing (e.g., move to cloud storage, virus scan) inside `src/app.js` after the upload middleware if needed.

## Tests

```powershell
pnpm test
```

The test suite exercises the `/webhook` endpoint, checking successful uploads and validation when no files are provided.
