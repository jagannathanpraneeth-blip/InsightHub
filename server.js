const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

dotenv.config();

const app = express();
const http = require('http').createServer(app);
const io = new Server(http, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }
});

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/insighthub')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Data Point Schema
const dataPointSchema = new mongoose.Schema({
  datasetId: String,
  timestamp: { type: Date, default: Date.now },
  value: Number,
  category: String,
  metadata: Object
});

const DataPoint = mongoose.model('DataPoint', dataPointSchema);

// Analytics Report Schema
const reportSchema = new mongoose.Schema({
  title: String,
  description: String,
  datasetIds: [String],
  chartType: { type: String, enum: ['line', 'bar', 'pie', 'area'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', reportSchema);

// Analytics Endpoints
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const totalDataPoints = await DataPoint.countDocuments();
    const latestData = await DataPoint.find().sort({ timestamp: -1 }).limit(100);
    const reportCount = await Report.countDocuments();
    
    res.json({
      totalDataPoints,
      latestData,
      reportCount,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analytics/data', async (req, res) => {
  try {
    const dataPoint = new DataPoint(req.body);
    await dataPoint.save();
    io.emit('data:new', dataPoint);
    res.status(201).json(dataPoint);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/analytics/data/:datasetId', async (req, res) => {
  try {
    const data = await DataPoint.find({ datasetId: req.params.datasetId })
      .sort({ timestamp: -1 })
      .limit(1000);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report Endpoints
app.post('/api/reports', async (req, res) => {
  try {
    const report = new Report(req.body);
    await report.save();
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const reports = await Report.find();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real-time WebSocket Handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('subscribe:dataset', (datasetId) => {
    socket.join(`dataset:${datasetId}`);
  });

  socket.on('data:stream', async (datasetId) => {
    try {
      const latestData = await DataPoint.find({ datasetId })
        .sort({ timestamp: -1 })
        .limit(50);
      socket.emit('data:stream:response', latestData);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
http.listen(PORT, () => {
  console.log(`InsightHub running on port ${PORT}`);
});

module.exports = app;
