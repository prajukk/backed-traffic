const express = require('express');
const router = express.Router();
const Analytics = require('../models/Analytics');
const { authenticateToken } = require('../middleware/auth');

// Get analytics data (with optional date filtering)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Parse date filters if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    // Find analytics within date range
    const analytics = await Analytics.find({
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });
    
    // Aggregate data by day
    const aggregatedData = await Analytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: startDate, $lte: endDate } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } 
          },
          averageTrafficVolume: { $avg: '$trafficVolume' },
          averageSpeed: { $avg: '$averageSpeed' },
          congestionLevels: { $push: '$congestionLevel' },
          vehicleTypeCounts: { 
            $push: {
              cars: '$vehicleTypes.cars',
              motorcycles: '$vehicleTypes.motorcycles',
              trucks: '$vehicleTypes.trucks'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      rawData: analytics,
      aggregatedData
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get analytics for a specific junction
router.get('/junction/:junctionId', authenticateToken, async (req, res) => {
  try {
    const { junctionId } = req.params;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    const analytics = await Analytics.find({
      junctionId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });
    
    res.json(analytics);
  } catch (err) {
    console.error('Get junction analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;