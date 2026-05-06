import app from './app.js';
import { PORT } from './config.js';

app.listen(PORT, () => {
  console.log(`S02 Contact Form API running on port ${PORT}`);
});
