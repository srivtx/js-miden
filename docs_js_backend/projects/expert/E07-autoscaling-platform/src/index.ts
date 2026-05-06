import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`Autoscaling platform listening on port ${PORT}`);
});
