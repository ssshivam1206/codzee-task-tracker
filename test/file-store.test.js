import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFileTaskStore } from '../src/file-store.js';

test('file store keeps changes across reloads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codzee-tasks-'));
  const filePath = join(directory, 'tasks.json');
  try {
    const firstStore = await createFileTaskStore(filePath);
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
    await Promise.all(Array.from({ length: 10 }, (_, index) => store.create(`Task ${index}`)));
    const reloaded = await createFileTaskStore(filePath);
    assert.equal(reloaded.list().length, 10);
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).length, 10);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid stored data stops startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codzee-tasks-'));
  const filePath = join(directory, 'tasks.json');
  try {
    await writeFile(filePath, '{"tasks":[]}');
    await assert.rejects(() => createFileTaskStore(filePath), /Invalid task data/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
