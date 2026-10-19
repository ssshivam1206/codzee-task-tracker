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
- `GET /tasks` lists tasks.
- `POST /tasks` creates a task from `{ "title": "Plan review" }`.
- `GET /tasks/:id` gets one task.
- `PATCH /tasks/:id` updates `title` and/or `completed`.
- `DELETE /tasks/:id` removes a task.

Task write requests must send `Content-Type: application/json`. Data is kept in memory and resets when the server restarts.

This project uses only Node.js built-in modules.
