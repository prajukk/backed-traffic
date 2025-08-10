// routes/signals.js
const express = require('express');
const router = express.Router();
const Signal = require('../models/Signal');
const { authenticateToken, isOperator } = require('../middleware/auth');

// Get all signals
router.get('/', authenticateToken, async (req, res) => {
  try {
    const signals = await Signal.find();
    res.json(signals);
  } catch (err) {
    console.error('Get signals error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single signal
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id);
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }
    res.json(signal);
  } catch (err) {
    console.error('Get signal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new signal
router.post('/', authenticateToken, isOperator, async (req, res) => {
  try {
    const { name, location, coordinates, ipAddress } = req.body;
    
    const signal = new Signal({
      name,
      location,
      coordinates,
      ipAddress
    });
    
    await signal.save();
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('signalUpdate', signal);
    
    res.status(201).json(signal);
  } catch (err) {
    console.error('Create signal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update signal
router.put('/:id', authenticateToken, isOperator, async (req, res) => {
  try {
    const { name, location, coordinates, ipAddress, status, mode, currentPhase, remainingTime } = req.body;
    
    const signal = await Signal.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name,
          location,
          coordinates,
          ipAddress,
          status,
          mode,
          currentPhase,
          remainingTime
        }
      },
      { new: true }
    );
    
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('signalUpdate', signal);
    
    // Notify device if online
    if (mode || currentPhase) {
      req.app.get('io').to(`signal-${signal._id}`).emit('configUpdate', {
        mode,
        currentPhase,
        remainingTime
      });
    }
    
    res.json(signal);
  } catch (err) {
    console.error('Update signal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete signal
router.delete('/:id', authenticateToken, isOperator, async (req, res) => {
  try {
    const signal = await Signal.findByIdAndDelete(req.params.id);
    
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('signalDeleted', { id: req.params.id });
    
    res.json({ message: 'Signal deleted successfully' });
  } catch (err) {
    console.error('Delete signal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update signal settings
router.put('/:id/settings', authenticateToken, isOperator, async (req, res) => {
  try {
    const { settings } = req.body;
    
    const signal = await Signal.findByIdAndUpdate(
      req.params.id,
      { $set: { settings } },
      { new: true }
    );
    
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('signalUpdate', signal);
    
    // Notify device if online
    req.app.get('io').to(`signal-${signal._id}`).emit('configUpdate', settings);
    
    res.json(signal);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Manual signal control
router.post('/:id/control', authenticateToken, isOperator, async (req, res) => {
  try {
    const { phase, duration, mode } = req.body;
    
    const signal = await Signal.findById(req.params.id);
    
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }
    
    // Update signal with new control settings
    signal.mode = mode || 'Manual';
    if (phase) signal.currentPhase = phase;
    if (duration) signal.remainingTime = `${duration}s`;
    
    await signal.save();
    
    // Notify connected clients
    req.app.get('io').to('admin').emit('signalUpdate', signal);
    
    // Notify device if online
    req.app.get('io').to(`signal-${signal._id}`).emit('controlCommand', {
      mode: signal.mode,
      phase: signal.currentPhase,
      duration
    });
    
    res.json(signal);
  } catch (err) {
    console.error('Signal control error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

