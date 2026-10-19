import { randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createTaskStore } from './tasks.js';

function isTask(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && typeof value.id === 'string' && typeof value.title === 'string'
    && typeof value.completed === 'boolean'
    && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string';
}

async function saveTasks(filePath, tasks) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(tasks, null, 2)}\n`, { flag: 'wx' });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function createFileTaskStore(filePath) {
  let initialTasks;
  try {
    initialTasks = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') initialTasks = [];
    else throw error;
  }
  if (!Array.isArray(initialTasks) || !initialTasks.every(isTask)) {
    throw new Error(`Invalid task data in ${filePath}`);
  }

  let current = createTaskStore(initialTasks);
  let pending = Promise.resolve();

  function mutate(operation) {
    const next = pending.then(async () => {
      const candidate = createTaskStore(current.list());
      const result = operation(candidate);
      if (result === undefined || result === false) return result;
      await saveTasks(filePath, candidate.list());
      current = candidate;
      return result;
    });
    pending = next.catch(() => {});
    return next;
  }

  return {
    list: () => current.list(),
    get: (id) => current.get(id),
    create: (title) => mutate((candidate) => candidate.create(title)),
    update: (id, changes) => mutate((candidate) => candidate.update(id, changes)),
    remove: (id) => mutate((candidate) => candidate.remove(id)),
  };
}
