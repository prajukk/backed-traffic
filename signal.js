// models/Signal.js
const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['online', 'offline', 'warning'],
    default: 'offline'
  },
  mode: {
    type: String,
    enum: ['AI', 'Manual', 'Scheduled'],
    default: 'AI'
  },
  currentPhase: {
    type: String,
    default: 'North-South Green'
  },
  remainingTime: {
    type: String,
    default: '0s'
  },
  congestionLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Unknown'],
    default: 'Unknown'
  },
  lastSeen: {
    type: Date
  },
  settings: {
    phases: [
      {
        name: {
          type: String
        },
        duration: {
          type: Number
        }
      }
    ],
    schedule: {
      enabled: {
        type: Boolean,
        default: false
      },
      timings: [
        {
          dayOfWeek: Number,
          startTime: String,
          endTime: String,
          mode: String
        }
      ]
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Signal', SignalSchema);