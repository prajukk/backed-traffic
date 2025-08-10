// index.js - Backend for AI-Based Intelligent Traffic Management System

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Configure middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic-management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Define schemas and models
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'operator', 'viewer'], default: 'viewer' },
  createdAt: { type: Date, default: Date.now }
});

const cameraSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  ipAddress: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline', 'warning'], default: 'offline' },
  model: { type: String, default: 'ESP32-CAM' },
  firmware: { type: String, default: 'v2.4.1' },
  lastUpdate: { type: Date, default: Date.now }
});

const signalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  mode: { type: String, enum: ['AI', 'Manual', 'Scheduled'], default: 'Scheduled' },
  currentPhase: { type: String, default: 'All-Way Red' },
  remainingTime: { type: String, default: '0s' },
  congestionLevel: { type: String, enum: ['Low', 'Medium', 'High', 'Unknown'], default: 'Unknown' },
  lastUpdate: { type: Date, default: Date.now }
});

const analyticsSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  trafficVolume: {
    total: { type: Number, default: 0 },
    peakHour: { type: String },
    average: { type: Number }
  },
  congestion: {
    mostCongestedDay: { type: String },
    averageWaitTime: { type: Number }
  },
  vehicleDistribution: {
    cars: { type: Number },
    motorcycles: { type: Number },
    trucks: { type: Number }
  },
  signalPerformance: {
    avgGreenTime: { type: Number },
    optimizationRate: { type: Number }
  }
});

// Create models
const User = mongoose.model('User', userSchema);
const Camera = mongoose.model('Camera', cameraSchema);
const Signal = mongoose.model('Signal', signalSchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Authorization middleware
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Insufficient permissions' });
    next();
  };
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Emit initial data
  const sendInitialData = async () => {
    try {
      const cameras = await Camera.find();
      const signals = await Signal.find();
      const analytics = await Analytics.findOne().sort({ date: -1 });
      
      socket.emit('initialData', { cameras, signals, analytics });
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  };
  
  sendInitialData();
  
  // Simulate real-time updates
  const simulateUpdates = () => {
    // Create intervals for different update types
    const cameraInterval = setInterval(async () => {
      try {
        const cameras = await Camera.find();
        if (cameras.length > 0) {
          const randomCamera = cameras[Math.floor(Math.random() * cameras.length)];
          randomCamera.lastUpdate = new Date();
          
          // Randomly change status sometimes
          if (Math.random() < 0.1) {
            const statuses = ['online', 'offline', 'warning'];
            randomCamera.status = statuses[Math.floor(Math.random() * statuses.length)];
          }
          
          await randomCamera.save();
          socket.emit('cameraUpdate', randomCamera);
        }
      } catch (error) {
        console.error('Error in camera simulation:', error);
      }
    }, 8000);
    
    const signalInterval = setInterval(async () => {
      try {
        const signals = await Signal.find({ status: 'online' });
        if (signals.length > 0) {
          const randomSignal = signals[Math.floor(Math.random() * signals.length)];
          
          // Update signal properties
          const phases = ['North-South Green', 'East-West Green', 'All-Way Red', 'North-South Yellow', 'East-West Yellow'];
          const congestionLevels = ['Low', 'Medium', 'High'];
          
          randomSignal.currentPhase = phases[Math.floor(Math.random() * phases.length)];
          randomSignal.remainingTime = `${Math.floor(Math.random() * 45) + 5}s`;
          randomSignal.congestionLevel = congestionLevels[Math.floor(Math.random() * congestionLevels.length)];
          randomSignal.lastUpdate = new Date();
          
          await randomSignal.save();
          socket.emit('signalUpdate', randomSignal);
        }
      } catch (error) {
        console.error('Error in signal simulation:', error);
      }
    }, 5000);
    
    // Clean up on disconnect
    socket.on('disconnect', () => {
      clearInterval(cameraInterval);
      clearInterval(signalInterval);
      console.log('Client disconnected:', socket.id);
    });
  };
  
  // Start simulation for this connection
  simulateUpdates();
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });
    
    // Validate password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(400).json({ message: 'Invalid email or password' });
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '12h' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already registered' });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'viewer'
    });
    
    await user.save();
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Camera routes
app.get('/api/cameras', authenticateToken, async (req, res) => {
  try {
    const cameras = await Camera.find();
    res.json(cameras);
  } catch (error) {
    console.error('Error fetching cameras:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/cameras/:id', authenticateToken, async (req, res) => {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera) return res.status(404).json({ message: 'Camera not found' });
    res.json(camera);
  } catch (error) {
    console.error('Error fetching camera details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/cameras', authenticateToken, authorizeRole(['admin', 'operator']), async (req, res) => {
  try {
    const { name, location, ipAddress } = req.body;
    
    const camera = new Camera({
      name,
      location,
      ipAddress,
      status: 'offline'
    });
    
    await camera.save();
    
    // Emit to all connected clients
    io.emit('cameraUpdate', camera);
    
    res.status(201).json(camera);
  } catch (error) {
    console.error('Error creating camera:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/cameras/:id', authenticateToken, authorizeRole(['admin', 'operator']), async (req, res) => {
  try {
    const { name, location, ipAddress, status } = req.body;
    
    const camera = await Camera.findById(req.params.id);
    if (!camera) return res.status(404).json({ message: 'Camera not found' });
    
    // Update fields
    if (name) camera.name = name;
    if (location) camera.location = location;
    if (ipAddress) camera.ipAddress = ipAddress;
    if (status) camera.status = status;
    
    camera.lastUpdate = new Date();
    
    await camera.save();
    
    // Emit to all connected clients
    io.emit('cameraUpdate', camera);
    
    res.json(camera);
  } catch (error) {
    console.error('Error updating camera:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/cameras/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const camera = await Camera.findByIdAndDelete(req.params.id);
    if (!camera) return res.status(404).json({ message: 'Camera not found' });
    
    // Emit to all connected clients
    io.emit('cameraRemoved', { id: req.params.id });
    
    res.json({ message: 'Camera removed successfully' });
  } catch (error) {
    console.error('Error deleting camera:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Signal routes
app.get('/api/signals', authenticateToken, async (req, res) => {
  try {
    const signals = await Signal.find();
    res.json(signals);
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/signals/:id', authenticateToken, async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id);
    if (!signal) return res.status(404).json({ message: 'Signal not found' });
    res.json(signal);
  } catch (error) {
    console.error('Error fetching signal details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/signals', authenticateToken, authorizeRole(['admin', 'operator']), async (req, res) => {
  try {
    const { name, location, mode } = req.body;
    
    const signal = new Signal({
      name,
      location,
      mode: mode || 'Scheduled',
      status: 'offline'
    });
    
    await signal.save();
    
    // Emit to all connected clients
    io.emit('signalUpdate', signal);
    
    res.status(201).json(signal);
  } catch (error) {
    console.error('Error creating signal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/signals/:id', authenticateToken, authorizeRole(['admin', 'operator']), async (req, res) => {
  try {
    const { name, location, status, mode, currentPhase, congestionLevel } = req.body;
    
    const signal = await Signal.findById(req.params.id);
    if (!signal) return res.status(404).json({ message: 'Signal not found' });
    
    // Update fields
    if (name) signal.name = name;
    if (location) signal.location = location;
    if (status) signal.status = status;
    if (mode) signal.mode = mode;
    if (currentPhase) signal.currentPhase = currentPhase;
    if (congestionLevel) signal.congestionLevel = congestionLevel;
    
    signal.lastUpdate = new Date();
    
    await signal.save();
    
    // Emit to all connected clients
    io.emit('signalUpdate', signal);
    
    res.json(signal);
  } catch (error) {
    console.error('Error updating signal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/signals/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const signal = await Signal.findByIdAndDelete(req.params.id);
    if (!signal) return res.status(404).json({ message: 'Signal not found' });
    
    // Emit to all connected clients
    io.emit('signalRemoved', { id: req.params.id });
    
    res.json({ message: 'Signal removed successfully' });
  } catch (error) {
    console.error('Error deleting signal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Analytics routes
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'day';
    
    // Find the most recent analytics or create default if none exists
    let analytics = await Analytics.findOne().sort({ date: -1 });
    
    if (!analytics) {
      // Create default analytics for demonstration
      analytics = new Analytics({
        trafficVolume: {
          total: 12450,
          peakHour: '5:00 PM - 6:00 PM',
          average: 520
        },
        congestion: {
          mostCongestedDay: 'Friday',
          averageWaitTime: 4.2
        },
        vehicleDistribution: {
          cars: 68,
          motorcycles: 12,
          trucks: 20
        },
        signalPerformance: {
          avgGreenTime: 45,
          optimizationRate: 87
        }
      });
      
      await analytics.save();
    }
    
    // Format analytics based on timeframe
    const formattedAnalytics = {
      ...analytics.toObject(),
      timeframe
    };
    
    // Adjust values based on timeframe for demo purposes
    if (timeframe === 'week') {
      formattedAnalytics.trafficVolume.total *= 7;
      formattedAnalytics.trafficVolume.average *= 1.2;
    } else if (timeframe === 'month') {
      formattedAnalytics.trafficVolume.total *= 30;
      formattedAnalytics.trafficVolume.average *= 1.5;
    }
    
    res.json(formattedAnalytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard route
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    // Count active cameras and signals
    const activeCameras = await Camera.countDocuments({ status: 'online' });
    const activeSignals = await Signal.countDocuments({ status: 'online' });
    
    // Get congestion levels from signals
    const signals = await Signal.find();
    let congestionSum = 0;
    let congestionCount = 0;
    
    signals.forEach(signal => {
      const congestionMap = { 'Low': 1, 'Medium': 2, 'High': 3, 'Unknown': 0 };
      if (signal.congestionLevel !== 'Unknown') {
        congestionSum += congestionMap[signal.congestionLevel];
        congestionCount++;
      }
    });
    
    const avgCongestion = congestionCount > 0 ? congestionSum / congestionCount : 0;
    let congestionLevel = 'Low';
    
    if (avgCongestion >= 2.5) congestionLevel = 'High';
    else if (avgCongestion >= 1.5) congestionLevel = 'Moderate';
    
    // Generate recent events
    const recentEvents = [
      { id: 1, type: 'alert', message: 'High congestion detected at Junction 4', timestamp: new Date(Date.now() - 60000 * 15).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      { id: 2, type: 'success', message: 'Signal timing optimized at CBD area', timestamp: new Date(Date.now() - 60000 * 32).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      { id: 3, type: 'alert', message: 'Camera 7 connectivity issues', timestamp: new Date(Date.now() - 60000 * 55).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      { id: 4, type: 'success', message: 'Traffic flow improved by 23% at Junction 2', timestamp: new Date(Date.now() - 60000 * 80).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ];
    
    res.json({
      activeCameras,
      activeSignals,
      congestionLevel,
      recentEvents
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a default admin user if none exists
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const admin = new User({
        name: 'Admin User',
        email: 'admin@traffic.com',
        password: hashedPassword,
        role: 'admin'
      });
      
      await admin.save();
      console.log('Default admin user created with email: admin@traffic.com and password: admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

// Create default data for demonstration
const createDemoData = async () => {
  try {
    // Check if we already have cameras
    const cameraCount = await Camera.countDocuments();
    if (cameraCount === 0) {
      // Create sample cameras
      const cameras = [
        { name: 'Junction 1 - North', location: 'Main St & 1st Ave', ipAddress: '192.168.1.11', status: 'online' },
        { name: 'Junction 1 - South', location: 'Main St & 1st Ave', ipAddress: '192.168.1.12', status: 'online' },
        { name: 'Junction 2 - East', location: 'Broadway & 5th St', ipAddress: '192.168.1.13', status: 'offline' },
        { name: 'Junction 3 - West', location: 'Park Ave & 3rd St', ipAddress: '192.168.1.14', status: 'online' },
        { name: 'Highway Entrance', location: 'Highway 101 Entrance', ipAddress: '192.168.1.15', status: 'online' },
        { name: 'CBD Area', location: 'Financial District', ipAddress: '192.168.1.16', status: 'online' },
        { name: 'Shopping Mall', location: 'City Mall Entrance', ipAddress: '192.168.1.17', status: 'warning' },
        { name: 'School Zone', location: 'Elementary School', ipAddress: '192.168.1.18', status: 'online' }
      ];
      
      await Camera.insertMany(cameras);
      console.log('Sample cameras created');
    }
    
    // Check if we already have signals
    const signalCount = await Signal.countDocuments();
    if (signalCount === 0) {
      // Create sample signals
      const signals = [
        { name: 'Junction 1', location: 'Main St & 1st Ave', status: 'online', mode: 'AI', currentPhase: 'North-South Green', remainingTime: '35s', congestionLevel: 'Medium' },
        { name: 'Junction 2', location: 'Broadway & 5th St', status: 'online', mode: 'AI', currentPhase: 'East-West Green', remainingTime: '15s', congestionLevel: 'High' },
        { name: 'Junction 3', location: 'Park Ave & 3rd St', status: 'online', mode: 'Manual', currentPhase: 'All-Way Red', remainingTime: '5s', congestionLevel: 'Low' },
        { name: 'Highway Entrance', location: 'Highway 101 Entrance', status: 'offline', mode: 'Scheduled', currentPhase: 'Unknown', remainingTime: '-', congestionLevel: 'Unknown' }
      ];
      
      await Signal.insertMany(signals);
      console.log('Sample signals created');
    }
  } catch (error) {
    console.error('Error creating demo data:', error);
  }
};

// Initialize data and start server
app.get('/', (req, res) => {
  res.send('AI-Based Intelligent Traffic Management System API is running');
});

// Custom 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Create default admin and demo data
  await createDefaultAdmin();
  await createDemoData();
});