// socketHandlers.js
const jwt = require('jsonwebtoken');
const Camera = require('./models/Camera');
const Signal = require('./models/Signal');
const Analytics = require('./models/Analytics');

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Join admin room if authenticated
    socket.on('authenticate', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
        socket.join('admin');
        console.log(`User ${decoded.id} joined admin room`);
      } catch (error) {
        console.error('Authentication error:', error);
      }
    });
    
    // Handle camera control events
    socket.on('cameraControl', async (data) => {
      try {
        // Update camera in database
        const camera = await Camera.findByIdAndUpdate(
          data.id,
          { $set: data.settings },
          { new: true }
        );
        
        // Emit to all admin clients
        io.to('admin').emit('cameraUpdate', camera);
        
        // Emit to device if online
        io.to(`camera-${data.id}`).emit('configUpdate', data.settings);
      } catch (error) {
        console.error('Camera control error:', error);
        socket.emit('error', { message: 'Failed to control camera' });
      }
    });
    
    // Handle signal control events
    socket.on('signalControl', async (data) => {
      try {
        // Update signal in database
        const signal = await Signal.findByIdAndUpdate(
          data.id,
          { $set: data.settings },
          { new: true }
        );
        
        // Emit to all admin clients
        io.to('admin').emit('signalUpdate', signal);
        
        // Emit to device if online
        io.to(`signal-${data.id}`).emit('configUpdate', data.settings);
      } catch (error) {
        console.error('Signal control error:', error);
        socket.emit('error', { message: 'Failed to control signal' });
      }
    });
    
    // Handle device connection (cameras and signals)
    socket.on('deviceConnect', async (data) => {
      try {
        const { type, id, apiKey } = data;
        
        // Validate API key
        if (apiKey !== process.env.DEVICE_API_KEY) {
          throw new Error('Invalid API key');
        }
        
        // Join device room
        socket.join(`${type}-${id}`);
        
        // Update device status to online
        let device;
        if (type === 'camera') {
          device = await Camera.findByIdAndUpdate(
            id,
            { status: 'online', lastSeen: new Date() },
            { new: true }
          );
          io.to('admin').emit('cameraUpdate', device);
        } else if (type === 'signal') {
          device = await Signal.findByIdAndUpdate(
            id,
            { status: 'online', lastSeen: new Date() },
            { new: true }
          );
          io.to('admin').emit('signalUpdate', device);
        }
        
        console.log(`Device ${type}-${id} connected`);
      } catch (error) {
        console.error('Device connection error:', error);
        socket.emit('error', { message: 'Authentication failed' });
      }
    });
    
    // Handle device data updates
    socket.on('deviceData', async (data) => {
      try {
        const { type, id, metrics } = data;
        
        // Update device data in database
        if (type === 'camera') {
          const camera = await Camera.findByIdAndUpdate(
            id,
            { 
              $set: { 
                lastSeen: new Date(),
                metrics
              }
            },
            { new: true }
          );
          io.to('admin').emit('cameraUpdate', camera);
          
          // Process analytics
          processTrafficAnalytics(metrics, io);
        } else if (type === 'signal') {
          const signal = await Signal.findByIdAndUpdate(
            id,
            { 
              $set: { 
                lastSeen: new Date(),
                currentPhase: metrics.currentPhase,
                remainingTime: metrics.remainingTime,
                metrics
              }
            },
            { new: true }
          );
          io.to('admin').emit('signalUpdate', signal);
        }
      } catch (error) {
        console.error('Device data update error:', error);
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
  
  // Process traffic analytics data
  async function processTrafficAnalytics(metrics, io) {
    try {
      // Create new analytics entry
      await Analytics.create({
        timestamp: new Date(),
        trafficVolume: metrics.vehicleCount || 0,
        congestionLevel: metrics.congestionLevel || 'Low',
        averageSpeed: metrics.averageSpeed || 0,
        vehicleTypes: metrics.vehicleTypes || { cars: 0, motorcycles: 0, trucks: 0 },
        junctionId: metrics.junctionId
      });
      
      // Calculate and emit aggregated analytics
      const aggregatedData = await Analytics.aggregate([
        { 
          $match: { 
            timestamp: { 
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
            } 
          } 
        },
        {
          $group: {
            _id: null,
            averageTrafficVolume: { $avg: '$trafficVolume' },
            averageSpeed: { $avg: '$averageSpeed' },
            vehicleTypesAggregate: { 
              $push: '$vehicleTypes' 
            }
          }
        }
      ]);
      
      if (aggregatedData.length > 0) {
        io.to('admin').emit('analyticsUpdate', aggregatedData[0]);
      }
    } catch (error) {
      console.error('Analytics processing error:', error);
    }
  }
  
  // Return handlers if needed elsewhere
  return {
    processTrafficAnalytics
  };
};