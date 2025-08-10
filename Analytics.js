// models/Analytics.js
const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  trafficVolume: {
    type: Number,
    default: 0
  },
  congestionLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Unknown'],
    default: 'Unknown'
  },
  averageSpeed: {
    type: Number,
    default: 0
  },
  vehicleTypes: {
    cars: {
      type: Number,
      default: 0
    },
    motorcycles: {
      type: Number,
      default: 0
    },
    trucks: {
      type: Number,
      default: 0
    }
  },
  junctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Signal'
  }
});

// Index for time-based queries
AnalyticsSchema.index({ timestamp: -1 });
// Index for junction-specific queries
AnalyticsSchema.index({ junctionId: 1, timestamp: -1 });

module.exports = mongoose.model('Analytics', AnalyticsSchema);