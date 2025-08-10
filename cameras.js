// routes/cameras.js
const express = require('express');
const router = express.Router();
const Camera = require('../models/Camera');
const { authenticateToken, isOperator } = require('../middleware/auth');

// Get all cameras
router.get('/', authenticateToken, async (req, res) => {
  try {
    const cameras = await Camera.find();
    res.json(cameras);
  } catch (err) {
    console.error('Get cameras error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single camera
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }
    res.json(camera);
  } catch (err) {
    console.error('Get camera error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new camera (operator or admin only)
router.post('/', authenticateToken, isOperator, async (req, res) => {
  try {
    const { name, location, coordinates, ipAddress, model, firmware } = req.body;
    
    const camera = new Camera({
      name,
      location,
      coordinates,
      ipAddress,
      model,
      firmware
    });
    
    await camera.save();
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('cameraUpdate', camera);
    
    res.status(201).json(camera);
  } catch (err) {
    console.error('Create camera error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update camera
router.put('/:id', authenticateToken, isOperator, async (req, res) => {
  try {
    const { name, location, coordinates, ipAddress, status, settings } = req.body;
    
    const camera = await Camera.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name,
          location,
          coordinates,
          ipAddress,
          status,
          settings
        }
      },
      { new: true }
    );
    
    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('cameraUpdate', camera);
    
    // Notify device if online
    req.app.get('io').to(`camera-${camera._id}`).emit('configUpdate', settings);
    
    res.json(camera);
  } catch (err) {
    console.error('Update camera error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete camera
router.delete('/:id', authenticateToken, isOperator, async (req, res) => {
  try {
    const camera = await Camera.findByIdAndDelete(req.params.id);
    
    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('cameraDeleted', { id: req.params.id });
    
    res.json({ message: 'Camera deleted successfully' });
  } catch (err) {
    console.error('Delete camera error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update camera settings
router.put('/:id/settings', authenticateToken, isOperator, async (req, res) => {
  try {
    const { settings } = req.body;
    
    const camera = await Camera.findByIdAndUpdate(
      req.params.id,
      { $set: { settings } },
      { new: true }
    );
    
    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('cameraUpdate', camera);
    
    // Notify device if online
    req.app.get('io').to(`camera-${camera._id}`).emit('configUpdate', settings);
    
    res.json(camera);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;