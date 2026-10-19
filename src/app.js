import { createServer } from 'node:http';
import { createTaskStore } from './tasks.js';

const MAX_BODY_BYTES = 16 * 1024;

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function readJson(request) {
  const contentType = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw httpError(415, 'Content-Type must be application/json');
  }

  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  // Drain an oversized request before responding; leaving the async iterator
  // early destroys the request stream and can reset the client's connection.
  if (bytes > MAX_BODY_BYTES) throw httpError(413, 'Request body is too large');

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, 'Request body must contain valid JSON');
  }
}

function validateTaskInput(value, partial = false) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw httpError(400, 'Task must be a JSON object');
  }

  const allowed = partial ? ['title', 'completed'] : ['title'];
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !allowed.includes(key))) {
    throw httpError(400, `Allowed fields: ${allowed.join(', ')}`);
  }

  const result = {};
  if (!partial || Object.hasOwn(value, 'title')) {
    const title = typeof value.title === 'string' ? value.title.trim() : null;
    if (title === null || [...title].length === 0 || [...title].length > 120) {
      throw httpError(400, 'Title must contain 1 to 120 characters');
    }
    result.title = title;
  }
  if (Object.hasOwn(value, 'completed')) {
    if (typeof value.completed !== 'boolean') {
      throw httpError(400, 'Completed must be a boolean');
    }
    result.completed = value.completed;
  }

  return result;
}

export function createApp({ store = createTaskStore() } = {}) {
  return createServer(async (request, response) => {
    try {
      const { pathname } = new URL(request.url, 'http://localhost');

      if (request.method === 'GET' && pathname === '/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }
      if (pathname === '/health') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      if (pathname === '/tasks') {
        if (request.method === 'GET') {
          sendJson(response, 200, { tasks: store.list() });
          return;
        }
        if (request.method === 'POST') {
          const input = validateTaskInput(await readJson(request));
          const task = store.create(input.title);
          response.setHeader('location', `/tasks/${task.id}`);
          sendJson(response, 201, task);
          return;
        }
        response.setHeader('allow', 'GET, POST');
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      const taskMatch = /^\/tasks\/([^/]+)$/.exec(pathname);
      if (taskMatch) {
        const id = taskMatch[1];
        if (request.method === 'GET') {
          const task = store.get(id);
          if (!task) throw httpError(404, 'Task not found');
          sendJson(response, 200, task);
          return;
        }
        if (request.method === 'PATCH') {
          const changes = validateTaskInput(await readJson(request), true);
          const task = store.update(id, changes);
          if (!task) throw httpError(404, 'Task not found');
          sendJson(response, 200, task);
          return;
        }
        if (request.method === 'DELETE') {
          if (!store.remove(id)) throw httpError(404, 'Task not found');
          response.writeHead(204);
          response.end();
          return;
        }
        response.setHeader('allow', 'GET, PATCH, DELETE');
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      if (!error.status) console.error(error);
      const status = error.status ?? 500;
      sendJson(response, status, { error: status === 500 ? 'Internal server error' : error.message });
    }
  });
}
