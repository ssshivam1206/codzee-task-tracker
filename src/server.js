import { createApp } from './app.js';
import { createFileTaskStore } from './file-store.js';

const port = Number(process.env.PORT ?? 3000);
const store = process.env.TASKS_FILE
  ? await createFileTaskStore(process.env.TASKS_FILE)
  : undefined;
const server = createApp({ store });

server.listen(port, () => {
  console.log(`Task API listening on http://localhost:${port}`);
});
