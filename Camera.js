// models/Camera.js
const mongoose = require('mongoose');

const CameraSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true
  },
  coordinates: {
    lat: Number,
    lng: Number
  },
  ipAddress: {
    type: String
  },
  model: {
    type: String,
    default: 'ESP32-CAM'
  },
  firmware: {
    type: String,
    default: 'v2.4.1'
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'warning'],
    default: 'offline'
  },
  lastSeen: {
    type: Date
  },
  metrics: {
    vehicleCount: Number,
    congestionLevel: String,
    averageSpeed: Number,
    vehicleTypes: {
      cars: Number,
      motorcycles: Number,
      trucks: Number
    }
  },
  settings: {
    resolution: {
      type: String,
      default: '640x480'
    },
    frameRate: {
      type: Number,
      default: 15
    },
    nightMode: {
      type: Boolean,
      default: false
    },
    brightness: {
      type: Number,
      default: 50
    },
    contrast: {
      type: Number,
      default: 50
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Camera', CameraSchema);