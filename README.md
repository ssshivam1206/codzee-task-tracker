# Task Tracker API

A small, dependency-free Node.js API used to explore GitHub pull request reviews.

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

## Endpoints

- `GET /health` returns `{ "status": "ok" }`.
- `GET /tasks` lists tasks. Optional filters: `completed=true|false`, `q=term`, `sort=oldest|newest`, `limit=1..100`, and `offset=0..`.
- `POST /tasks` creates a task from `{ "title": "Plan review" }`.
- `GET /tasks/:id` gets one task.
- `PATCH /tasks/:id` updates `title` and/or `completed`.
- `DELETE /tasks/:id` removes a task.

Task write requests must send `Content-Type: application/json`. Data is kept in memory and resets when the server restarts.

`GET /tasks` returns `{ "tasks": [...], "total": 0, "limit": null, "offset": 0 }`. Omitting `limit` keeps the original behavior of returning every matching task; set `limit` for larger lists. Filtering happens before sorting and pagination. The default order is creation order (oldest first).

This project uses only Node.js built-in modules.
