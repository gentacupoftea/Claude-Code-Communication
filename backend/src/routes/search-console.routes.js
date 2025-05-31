const express = require('express');
const router = express.Router();
const searchConsoleService = require('../services/search-console.service');

/**
 * 検索分析データ取得
 */
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate, dimensions } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDateとendDateは必須です',
      });
    }

    const data = await searchConsoleService.getSearchAnalytics(
      startDate,
      endDate,
      dimensions?.split(',')
    );

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
 * トップクエリ取得
 */
router.get('/top-queries', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDateとendDateは必須です',
      });
    }

    const queries = await searchConsoleService.getTopQueries(
      startDate,
      endDate,
      parseInt(limit) || 10
    );

    res.json({
      success: true,
      data: queries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * ページパフォーマンス取得
 */
router.get('/page-performance', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDateとendDateは必須です',
      });
    }

    const pages = await searchConsoleService.getPagePerformance(
      startDate,
      endDate,
      parseInt(limit) || 20
    );

    res.json({
      success: true,
      data: pages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * サイトマップ取得
 */
router.get('/sitemaps', async (req, res) => {
  try {
    const sitemaps = await searchConsoleService.getSitemaps();

    res.json({
      success: true,
      data: sitemaps,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;