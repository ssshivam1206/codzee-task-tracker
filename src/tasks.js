import { randomUUID } from 'node:crypto';

export function createTaskStore() {
  const tasks = new Map();

  return {
    list() {
      return [...tasks.values()];
    },
    get(id) {
      return tasks.get(id);
    },
    create(title) {
      const now = new Date().toISOString();
      const task = {
        id: randomUUID(),
        title,
        completed: false,
        createdAt: now,
        updatedAt: now,
      };
      tasks.set(task.id, task);
      return task;
    },
    update(id, changes) {
      const task = tasks.get(id);
      if (!task) return undefined;
      const updated = { ...task, ...changes, updatedAt: new Date().toISOString() };
      tasks.set(id, updated);
      return updated;
    },
    remove(id) {
      return tasks.delete(id);
    },
  };
}
