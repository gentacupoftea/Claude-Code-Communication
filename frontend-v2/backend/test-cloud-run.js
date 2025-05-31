const express = require('express');
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Cloud Run!' });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});