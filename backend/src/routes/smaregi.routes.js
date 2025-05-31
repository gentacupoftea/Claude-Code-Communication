const express = require('express');
const router = express.Router();
const smaregiService = require('../services/smaregi.service');

/**
 * 商品一覧取得
 */
router.get('/products', async (req, res) => {
  try {
    const products = await smaregiService.getProducts(req.query);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 在庫情報取得
 */
router.get('/stock/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { productId } = req.query;

    const stock = await smaregiService.getStock(storeId, productId);

    res.json({
      success: true,
      data: stock,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 取引データ取得
 */
router.get('/transactions', async (req, res) => {
  try {
    const { startDate, endDate, storeId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDateとendDateは必須です',
      });
    }

    const transactions = await smaregiService.getTransactions(
      startDate,
      endDate,
      storeId
    );

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 売上サマリー取得
 */
router.get('/sales-summary', async (req, res) => {
  try {
    const { date, storeId } = req.query;
    
    if (!date) {
      return res.status(400).json({
        error: 'dateは必須です',
      });
    }

    const summary = await smaregiService.getSalesSummary(date, storeId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 顧客一覧取得
 */
router.get('/customers', async (req, res) => {
  try {
    const customers = await smaregiService.getCustomers(req.query);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * カテゴリ一覧取得
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await smaregiService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;