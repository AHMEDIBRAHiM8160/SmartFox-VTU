require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRouter = require('./routes/health');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Smart Fox VTU API',
    version: '0.1.0',
    message: 'Backend foundation is running.'
  });
});

app.use('/api/health', healthRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found.'
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error.'
  });
});

app.listen(PORT, () => {
  console.log(`Smart Fox VTU API running on http://localhost:${PORT}`);
});
