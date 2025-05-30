const express = require('express');
const router = express.Router();
const googleAnalyticsService = require('../services/google-analytics.service');

/**
 * 基本レポート取得
 */
router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate, metrics, dimensions } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDateとendDateは必須です',
      });
    }

    const report = await googleAnalyticsService.getBasicReport(
      startDate,
      endDate,
      metrics?.split(','),
      dimensions?.split(',')
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * ECコマースデータ取得
 */
router.get('/ecommerce', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDateとendDateは必須です',
      });
    }

    const data = await googleAnalyticsService.getEcommerceData(startDate, endDate);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * リアルタイムデータ取得
 */
router.get('/realtime', async (req, res) => {
  try {
    const data = await googleAnalyticsService.getRealtimeData();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;