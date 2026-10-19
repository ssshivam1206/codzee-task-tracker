# Task Tracker API

A small, dependency-free Node.js API used to explore GitHub pull request reviews. It starts with a health endpoint; task features are added through focused pull requests.

## Requirements

Node.js 20 or newer.

## Run

```bash
npm start
```

The server listens on port 3000 by default. Set `PORT` to choose another port.

## Test

```bash
npm test
```

## Current endpoint

- `GET /health` returns `{ "status": "ok" }`.

This project uses only Node.js built-in modules.
