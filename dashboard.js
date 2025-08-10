const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Camera = require('../models/Camera');
const Signal = require('../models/Signal');
const Analytics = require('../models/Analytics');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Get dashboard overview data
router.get('/overview', verifyToken, async (req, res) => {
  try {
    // Get counts
    const cameraCount = await Camera.countDocuments();
    const onlineCameraCount = await Camera.countDocuments({ status: 'online' });
    const signalCount = await Signal.countDocuments();
    const onlineSignalCount = await Signal.countDocuments({ status: 'online' });
    
    // Get recent analytics
    const recentAnalytics = await Analytics.find()
      .sort({ timestamp: -1 })
      .limit(1);
    
    // Current congestion level calculation (from most recent analytics)
    let congestionLevel = 'Low';
    if (recentAnalytics.length > 0) {
      const latestRecord = recentAnalytics[0];
      congestionLevel = latestRecord.congestionLevel;
    }
    
    // Get recent events
    // This would typically come from an Events collection
    // For this example, we'll create synthetic events from cameras and signals with issues
    const camerasWithIssues = await Camera.find({ 
      $or: [
        { status: 'offline' },
        { status: 'maintenance' }
      ]
    }).limit(5).sort({ lastSeen: -1 });
    
    const signalsWithIssues = await Signal.find({ 
      $or: [
        { status: 'offline' },
        { status: 'maintenance' }
      ]
    }).limit(5).sort({ lastSeen: -1 });
    
    // Create events from the issues
    const cameraEvents = camerasWithIssues.map(camera => ({
      id: `camera-${camera._id}`,
      type: 'camera',
      severity: camera.status === 'offline' ? 'high' : 'medium',
      message: `Camera ${camera.name || camera._id} is ${camera.status}`,
      location: camera.location || 'Unknown',
      timestamp: camera.lastSeen
    }));
    
    const signalEvents = signalsWithIssues.map(signal => ({
      id: `signal-${signal._id}`,
      type: 'signal',
      severity: signal.status === 'offline' ? 'high' : 'medium',
      message: `Signal ${signal.name || signal._id} is ${signal.status}`,
      location: signal.location || 'Unknown',
      timestamp: signal.lastSeen
    }));
    
    // Get 24-hour traffic trend
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyTraffic = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: last24Hours }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            month: { $month: '$timestamp' },
            year: { $year: '$timestamp' }
          },
          averageTrafficVolume: { $avg: '$trafficVolume' },
          averageCongestion: { $avg: { $cond: [
            { $eq: ['$congestionLevel', 'High'] }, 
            3, 
            { $cond: [
              { $eq: ['$congestionLevel', 'Moderate'] }, 
              2, 
              1
            ]}
          ]}}
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1,
          '_id.hour': 1
        }
      }
    ]);
    
    // Get performance metrics
    const systemUptime = process.uptime(); // Server uptime in seconds
    const responseTime = 150; // Simulated average API response time in ms
    
    // Create response object
    const dashboardData = {
      overview: {
        totalCameras: cameraCount,
        onlineCameras: onlineCameraCount,
        totalSignals: signalCount,
        onlineSignals: onlineSignalCount,
        systemStatus: onlineCameraCount > 0.7 * cameraCount && onlineSignalCount > 0.7 * signalCount ? 'Healthy' : 'Warning',
        congestionLevel: congestionLevel
      },
      events: {
        recent: [...cameraEvents, ...signalEvents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10)
      },
      trafficTrend: hourlyTraffic.map(hour => ({
        time: `${hour._id.hour}:00`,
        trafficVolume: Math.round(hour.averageTrafficVolume),
        congestionLevel: hour.averageCongestion < 1.5 ? 'Low' : hour.averageCongestion < 2.5 ? 'Moderate' : 'High'
      })),
      performance: {
        uptime: systemUptime,
        responseTime: responseTime,
        status: responseTime < 200 ? 'Optimal' : 'Degraded'
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ message: 'Error retrieving dashboard data', error: error.message });
  }
});

// Get hotspot map data
router.get('/hotspots', verifyToken, async (req, res) => {
  try {
    const cameras = await Camera.find()
      .select('location coordinates metrics status')
      .sort({ 'metrics.congestionLevel': -1 });
    
    const signals = await Signal.find()
      .select('location coordinates currentPhase metrics status')
      .sort({ 'metrics.waitTime': -1 });
    
    // Process cameras to create hotspots
    const hotspots = cameras
      .filter(camera => camera.coordinates && camera.metrics)
      .map(camera => {
        let congestionLevel = 'Low';
        let trafficVolume = 0;
        
        if (camera.metrics) {
          trafficVolume = camera.metrics.vehicleCount || 0;
          congestionLevel = camera.metrics.congestionLevel || 'Low';
        }
        
        return {
          id: camera._id,
          type: 'camera',
          location: camera.location || 'Unknown',
          coordinates: camera.coordinates,
          congestionLevel: congestionLevel,
          trafficVolume: trafficVolume,
          status: camera.status
        };
      });
    
    // Process signals to include in the response
    const trafficSignals = signals
      .filter(signal => signal.coordinates)
      .map(signal => {
        return {
          id: signal._id,
          type: 'signal',
          location: signal.location || 'Unknown',
          coordinates: signal.coordinates,
          currentPhase: signal.currentPhase || 'Unknown',
          waitTime: signal.metrics?.waitTime || 0,
          status: signal.status
        };
      });
    
    res.json({
      hotspots: hotspots,
      signals: trafficSignals
    });
  } catch (error) {
    console.error('Hotspot map error:', error);
    res.status(500).json({ message: 'Error retrieving hotspot data', error: error.message });
  }
});

// Get alert zones
router.get('/alert-zones', verifyToken, async (req, res) => {
  try {
    // Get cameras with high congestion
    const highCongestionCameras = await Camera.find({
      'metrics.congestionLevel': 'High'
    }).select('location coordinates metrics');
    
    // Get signals with long wait times
    const longWaitSignals = await Signal.find({
      'metrics.waitTime': { $gt: 120 } // Wait time greater than 120 seconds
    }).select('location coordinates metrics');
    
    // Process to create alert zones
    const alertZones = [];
    
    // Add camera-based alerts
    highCongestionCameras.forEach(camera => {
      if (camera.coordinates) {
        alertZones.push({
          id: `zone-camera-${camera._id}`,
          type: 'congestion',
          severity: 'high',
          location: camera.location || 'Unknown',
          coordinates: camera.coordinates,
          radius: 300, // meters
          vehicleCount: camera.metrics?.vehicleCount || 0,
          source: {
            type: 'camera',
            id: camera._id
          }
        });
      }
    });
    
    // Add signal-based alerts
    longWaitSignals.forEach(signal => {
      if (signal.coordinates) {
        alertZones.push({
          id: `zone-signal-${signal._id}`,
          type: 'waiting',
          severity: signal.metrics.waitTime > 180 ? 'high' : 'medium',
          location: signal.location || 'Unknown',
          coordinates: signal.coordinates,
          radius: 200, // meters
          waitTime: signal.metrics.waitTime,
          source: {
            type: 'signal',
            id: signal._id
          }
        });
      }
    });
    
    res.json(alertZones);
  } catch (error) {
    console.error('Alert zones error:', error);
    res.status(500).json({ message: 'Error retrieving alert zones', error: error.message });
  }
});

module.exports = router;