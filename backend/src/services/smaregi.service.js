const { smaregiClient } = require('../config/smaregi');

class SmaregiService {
  /**
   * 商品情報を取得
   */
  async getProducts(params = {}) {
    try {
      const response = await smaregiClient.get('/pos/products', { params });
      return response.data;
    } catch (error) {
      console.error('スマレジ商品取得エラー:', error);
      throw error;
    }
  }

  /**
   * 在庫情報を取得
   */
  async getStock(storeId, productId = null) {
    try {
      const params = { store_id: storeId };
      if (productId) {
        params.product_id = productId;
      }

      const response = await smaregiClient.get('/pos/stock', { params });
      return response.data;
    } catch (error) {
      console.error('スマレジ在庫取得エラー:', error);
      throw error;
    }
  }

  /**
   * 取引データを取得
   */
  async getTransactions(startDate, endDate, storeId = null) {
    try {
      const params = {
        transaction_date_from: startDate,
        transaction_date_to: endDate,
      };
      
      if (storeId) {
        params.store_id = storeId;
      }

      const response = await smaregiClient.get('/pos/transactions', { params });
      return response.data;
    } catch (error) {
      console.error('スマレジ取引取得エラー:', error);
      throw error;
    }
  }

  /**
   * 売上サマリーを取得
   */
  async getSalesSummary(date, storeId = null) {
    try {
      const params = {
        summary_date: date,
      };
      
      if (storeId) {
        params.store_id = storeId;
      }

      const response = await smaregiClient.get('/pos/daily_summary', { params });
      return response.data;
    } catch (error) {
      console.error('スマレジ売上サマリー取得エラー:', error);
      throw error;
    }
  }

  /**
   * 顧客情報を取得
   */
  async getCustomers(params = {}) {
    try {
      const response = await smaregiClient.get('/pos/customers', { params });
      return response.data;
    } catch (error) {
      console.error('スマレジ顧客取得エラー:', error);
      throw error;
    }
  }

  /**
   * カテゴリ情報を取得
   */
  async getCategories() {
    try {
      const response = await smaregiClient.get('/pos/categories');
      return response.data;
    } catch (error) {
      console.error('スマレジカテゴリ取得エラー:', error);
      throw error;
    }
  }
}

module.exports = new SmaregiService();