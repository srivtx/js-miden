import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`M12 Error Handler API running on http://localhost:${PORT}`);
});
