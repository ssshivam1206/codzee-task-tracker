import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test('GET /health returns a healthy response', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('unknown routes return JSON 404', async () => {
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});

test('creates, reads, updates and deletes a task', async () => {
  const createdResponse = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '  Plan review  ' }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.title, 'Plan review');
  assert.equal(created.completed, false);
  assert.equal(createdResponse.headers.get('location'), `/tasks/${created.id}`);

  const listed = await (await fetch(`${baseUrl}/tasks`)).json();
  assert.equal(listed.tasks.length, 1);
  assert.equal(listed.tasks[0].id, created.id);

  const updatedResponse = await fetch(`${baseUrl}/tasks/${created.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(updatedResponse.status, 200);
  assert.equal((await updatedResponse.json()).completed, true);

  const fetched = await (await fetch(`${baseUrl}/tasks/${created.id}`)).json();
  assert.equal(fetched.completed, true);

  const deleted = await fetch(`${baseUrl}/tasks/${created.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  assert.equal((await fetch(`${baseUrl}/tasks/${created.id}`)).status, 404);
});

test('rejects malformed task input', async () => {
  for (const body of ['{}', '{"title":"  "}', '{"title":4}', '{"title":"ok","extra":true}', '{']) {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    assert.equal(response.status, 400, body);
  }

  const wrongType = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'hello',
  });
  assert.equal(wrongType.status, 415);
});

test('returns 413 JSON for an oversized request body', async () => {
  const response = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'x'.repeat(17_000) }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'Request body is too large' });
});

test('validates PATCH changes and missing task IDs', async () => {
  const missingId = 'missing-task';
  for (const body of ['{}', '{"completed":"yes"}', '{"title":" "}']) {
    const response = await fetch(`${baseUrl}/tasks/${missingId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body,
    });
    assert.equal(response.status, 400, body);
  }

  const createdResponse = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'First title' }),
  });
  const task = await createdResponse.json();
  const renamedResponse = await fetch(`${baseUrl}/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Second title', completed: true }),
  });
  assert.equal(renamedResponse.status, 200);
  assert.equal((await renamedResponse.json()).title, 'Second title');
  const reopenedResponse = await fetch(`${baseUrl}/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ completed: false }),
  });
  assert.equal((await reopenedResponse.json()).completed, false);

  await fetch(`${baseUrl}/tasks/${task.id}`, { method: 'DELETE' });
  assert.equal((await fetch(`${baseUrl}/tasks/${missingId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{"title":"valid"}' })).status, 404);
  assert.equal((await fetch(`${baseUrl}/tasks/${missingId}`, { method: 'DELETE' })).status, 404);
});

test('returns 405 and an Allow header for unsupported methods', async () => {
  const healthResponse = await fetch(`${baseUrl}/health`, { method: 'POST' });
  assert.equal(healthResponse.status, 405);
  assert.equal(healthResponse.headers.get('allow'), 'GET');
  const response = await fetch(`${baseUrl}/tasks`, { method: 'DELETE' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, POST');
  const taskResponse = await fetch(`${baseUrl}/tasks/missing`, { method: 'PUT' });
  assert.equal(taskResponse.status, 405);
  assert.equal(taskResponse.headers.get('allow'), 'GET, PATCH, DELETE');
});

test('accepts 120 emoji code points in a title', async () => {
  const response = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '😀'.repeat(120) }),
  });
  assert.equal(response.status, 201);
  const task = await response.json();
  await fetch(`${baseUrl}/tasks/${task.id}`, { method: 'DELETE' });
});
