import app from './app.js';
import { PORT } from './config.js';

app.listen(PORT, () => {
  console.log(`S03 Weather Cache API running on port ${PORT}`);
});
