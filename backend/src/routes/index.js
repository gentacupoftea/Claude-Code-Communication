const express = require('express');
const router = express.Router();

// 既存のルート
const shopifyRoutes = require('./shopify');

// 新規追加のルート
const googleAnalyticsRoutes = require('./google-analytics.routes');
const searchConsoleRoutes = require('./search-console.routes');
const smaregiRoutes = require('./smaregi.routes');

// ルートの登録
router.use('/shopify', shopifyRoutes);
router.use('/google-analytics', googleAnalyticsRoutes);
router.use('/search-console', searchConsoleRoutes);
router.use('/smaregi', smaregiRoutes);

module.exports = router;