import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFileTaskStore } from '../src/file-store.js';

test('file store keeps changes across reloads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codzee-tasks-'));
  const filePath = join(directory, 'tasks.json');
  try {
    const firstStore = await createFileTaskStore(filePath);
    await assert.rejects(readFile(filePath), { code: 'ENOENT' });
    assert.equal(await firstStore.update('missing', { completed: true }), undefined);
    assert.equal(await firstStore.remove('missing'), false);
    await assert.rejects(readFile(filePath), { code: 'ENOENT' });
    const created = await firstStore.create('Persist me');
    await firstStore.update(created.id, { completed: true });

    const secondStore = await createFileTaskStore(filePath);
    assert.equal(secondStore.get(created.id).completed, true);
    assert.equal(secondStore.list().length, 1);

    await secondStore.remove(created.id);
    const thirdStore = await createFileTaskStore(filePath);
    assert.deepEqual(thirdStore.list(), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('concurrent writes do not lose tasks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codzee-tasks-'));
  const filePath = join(directory, 'tasks.json');
  try {
    const store = await createFileTaskStore(filePath);
    const created = await Promise.all(Array.from({ length: 10 }, (_, index) => store.create(`Task ${index}`)));
    await Promise.all([
      store.create('Added during update'),
      store.update(created[0].id, { completed: true }),
      store.remove(created[1].id),
    ]);
    const reloaded = await createFileTaskStore(filePath);
    assert.equal(reloaded.list().length, 10);
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).length, 10);
    assert.equal(reloaded.get(created[0].id).completed, true);
    assert.equal(reloaded.get(created[1].id), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid stored data stops startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codzee-tasks-'));
  const filePath = join(directory, 'tasks.json');
  try {
    for (const content of ['{"tasks":[]}', 'null', '[{"id":"x"}]']) {
      await writeFile(filePath, content);
      await assert.rejects(() => createFileTaskStore(filePath), /Invalid task data/);
      assert.equal(await readFile(filePath, 'utf8'), content);
    }
    await writeFile(filePath, '{');
    await assert.rejects(() => createFileTaskStore(filePath), SyntaxError);
    assert.equal(await readFile(filePath, 'utf8'), '{');

    const task = { id: 'same', title: 'First', completed: false, createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z' };
    const duplicates = JSON.stringify([task, { ...task, title: 'Second' }]);
    await writeFile(filePath, duplicates);
    await assert.rejects(() => createFileTaskStore(filePath), /Invalid task data/);
    assert.equal(await readFile(filePath, 'utf8'), duplicates);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('failed writes leave memory unchanged and do not block a later write', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codzee-tasks-'));
  const filePath = join(directory, 'tasks.json');
  try {
    const store = await createFileTaskStore(filePath);
    await mkdir(filePath);
    await assert.rejects(store.create('Cannot save'));
    assert.deepEqual(store.list(), []);
    assert.deepEqual(await readdir(directory), ['tasks.json']);

    await rm(filePath, { recursive: true });
    const recovered = await store.create('Saved after failure');
    assert.equal((await createFileTaskStore(filePath)).get(recovered.id).title, 'Saved after failure');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
