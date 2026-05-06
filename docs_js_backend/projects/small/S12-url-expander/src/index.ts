import app from './app.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`S12 URL Expander on ${PORT}`));
