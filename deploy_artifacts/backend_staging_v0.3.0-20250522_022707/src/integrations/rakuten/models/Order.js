/**
 * Rakuten Order Model
 * 楽天注文データモデル
 */

class RakutenOrder {
  constructor(data = {}) {
    this.orderNumber = data.orderNumber || '';
    this.orderDatetime = data.orderDatetime || null;
    this.orderStatus = data.orderStatus || '';
    this.paymentMethod = data.paymentMethod || '';
    this.paymentStatus = data.paymentStatus || '';
    this.itemsPrice = data.itemsPrice || 0;
    this.postagePrice = data.postagePrice || 0;
    this.totalPrice = data.totalPrice || 0;
    this.requestPrice = data.requestPrice || 0;
    this.couponPrice = data.couponPrice || 0;
    this.pointUsage = data.pointUsage || 0;
    this.deliveryMethod = data.deliveryMethod || '';
    this.deliveryInfo = data.deliveryInfo || {};
    this.customerInfo = data.customerInfo || {};
    this.items = data.items || [];
    this.notes = data.notes || '';
    this.cancelType = data.cancelType || null;
    this.cancelDate = data.cancelDate || null;
    this.shopCode = data.shopCode || '';
  }

  /**
   * Convert Rakuten order to common format
   * 楽天注文データを共通フォーマットに変換
   * @returns {Object} Common order format
   */
  toCommonFormat() {
    return {
      id: this.orderNumber,
      orderNumber: this.orderNumber,
      createdAt: this.orderDatetime,
      status: this.normalizeStatus(),
      financialStatus: this.normalizePaymentStatus(),
      totalPrice: this.totalPrice,
      subtotalPrice: this.itemsPrice,
      shippingPrice: this.postagePrice,
      discountPrice: this.couponPrice,
      taxPrice: this.calculateTax(),
      currency: 'JPY',
      customer: this.normalizeCustomer(),
      shippingAddress: this.normalizeShippingAddress(),
      billingAddress: this.normalizeBillingAddress(),
      items: this.normalizeItems(),
      paymentMethod: this.paymentMethod,
      notes: this.notes,
      tags: this.generateTags(),
      metadata: {
        platform: 'rakuten',
        shopCode: this.shopCode,
        deliveryMethod: this.deliveryMethod,
        pointUsage: this.pointUsage,
        cancelType: this.cancelType,
        cancelDate: this.cancelDate
      }
    };
  }

  /**
   * Normalize order status
   * @returns {string} Normalized status
   */
  normalizeStatus() {
    const statusMap = {
      '100': 'pending',        // 注文確定待ち
      '200': 'processing',     // 楽天処理中
      '300': 'preparing',      // 発送待ち
      '400': 'shipped',        // 発送済み
      '500': 'delivered',      // 配送完了
      '600': 'cancelled',      // キャンセル
      '700': 'returned',       // 返品
      '800': 'exchanged'       // 交換
    };
    
    return statusMap[this.orderStatus] || 'unknown';
  }

  /**
   * Normalize payment status
   * @returns {string} Normalized payment status
   */
  normalizePaymentStatus() {
    const paymentStatusMap = {
      '10': 'pending',     // 未処理
      '20': 'authorized',  // オーソリ済み
      '30': 'paid',        // 支払済み
      '40': 'refunded',    // 返金済み
      '50': 'failed'       // 失敗
    };
    
    return paymentStatusMap[this.paymentStatus] || 'pending';
  }

  /**
   * Calculate tax amount
   * @returns {number} Tax amount
   */
  calculateTax() {
    // 日本の消費税10%として計算（簡易的）
    const taxRate = 0.10;
    return Math.round(this.itemsPrice * taxRate);
  }

  /**
   * Normalize customer information
   * @returns {Object} Normalized customer
   */
  normalizeCustomer() {
    const customer = this.customerInfo;
    return {
      id: customer.customerId || customer.encryptedMailAddress,
      email: customer.mailAddress,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      firstNameKana: customer.firstNameKana || '',
      lastNameKana: customer.lastNameKana || '',
      phone: customer.phoneNumber,
      acceptsMarketing: customer.optIn === 1,
      tags: customer.customerTag || [],
      metadata: {
        encryptedEmail: customer.encryptedMailAddress,
        gender: customer.sex,
        birthDate: customer.birthDate
      }
    };
  }

  /**
   * Normalize shipping address
   * @returns {Object} Normalized shipping address
   */
  normalizeShippingAddress() {
    const delivery = this.deliveryInfo;
    return {
      firstName: delivery.firstName || '',
      lastName: delivery.lastName || '',
      firstNameKana: delivery.firstNameKana || '',
      lastNameKana: delivery.lastNameKana || '',
      company: delivery.companyName || '',
      address1: delivery.address1 || '',
      address2: delivery.address2 || '',
      address3: delivery.address3 || '',
      city: delivery.city || '',
      province: delivery.prefecture || '',
      country: 'JP',
      zip: delivery.zipCode || '',
      phone: delivery.phoneNumber || '',
      email: delivery.emailAddress || ''
    };
  }

  /**
   * Normalize billing address
   * @returns {Object} Normalized billing address
   */
  normalizeBillingAddress() {
    const customer = this.customerInfo;
    return {
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      firstNameKana: customer.firstNameKana || '',
      lastNameKana: customer.lastNameKana || '',
      company: customer.companyName || '',
      address1: customer.address1 || '',
      address2: customer.address2 || '',
      address3: customer.address3 || '',
      city: customer.city || '',
      province: customer.prefecture || '',
      country: 'JP',
      zip: customer.zipCode || '',
      phone: customer.phoneNumber || '',
      email: customer.mailAddress || ''
    };
  }

  /**
   * Normalize order items
   * @returns {Array} Normalized items
   */
  normalizeItems() {
    return this.items.map((item, index) => ({
      id: item.itemId || `${this.orderNumber}-${index}`,
      productId: item.itemNumber,
      variantId: item.variantId || item.itemNumber,
      title: item.itemName,
      quantity: item.quantity || 1,
      price: item.price || 0,
      totalPrice: (item.price || 0) * (item.quantity || 1),
      sku: item.sku || item.itemNumber,
      vendor: item.vendor || this.shopCode,
      properties: this.normalizeItemProperties(item),
      fulfillmentStatus: this.normalizeFulfillmentStatus(item.status),
      metadata: {
        pointUsage: item.pointUsage || 0,
        couponAmount: item.couponAmount || 0,
        itemOption: item.itemOption || []
      }
    }));
  }

  /**
   * Normalize item properties
   * @param {Object} item - Order item
   * @returns {Array} Normalized properties
   */
  normalizeItemProperties(item) {
    const properties = [];
    
    if (item.itemOption && Array.isArray(item.itemOption)) {
      item.itemOption.forEach(option => {
        properties.push({
          name: option.optionName,
          value: option.optionValue
        });
      });
    }
    
    return properties;
  }

  /**
   * Normalize fulfillment status
   * @param {string} status - Item status
   * @returns {string} Normalized fulfillment status
   */
  normalizeFulfillmentStatus(status) {
    const statusMap = {
      '300': 'pending',
      '400': 'fulfilled',
      '500': 'delivered',
      '600': 'cancelled',
      '700': 'returned'
    };
    
    return statusMap[status] || 'pending';
  }

  /**
   * Generate tags based on order properties
   * @returns {Array} Tags
   */
  generateTags() {
    const tags = [];
    
    // Add payment method tag
    if (this.paymentMethod) {
      tags.push(`payment:${this.paymentMethod}`);
    }
    
    // Add delivery method tag
    if (this.deliveryMethod) {
      tags.push(`delivery:${this.deliveryMethod}`);
    }
    
    // Add status tag
    tags.push(`status:${this.normalizeStatus()}`);
    
    // Add point usage tag if points were used
    if (this.pointUsage > 0) {
      tags.push('point-used');
    }
    
    // Add coupon tag if coupon was used
    if (this.couponPrice > 0) {
      tags.push('coupon-used');
    }
    
    return tags;
  }

  /**
   * Create from API response
   * @param {Object} apiData - Rakuten API response
   * @returns {RakutenOrder} Order instance
   */
  static fromAPI(apiData) {
    const order = new RakutenOrder();
    
    // Map API fields to model
    order.orderNumber = apiData.orderNumber;
    order.orderDatetime = new Date(apiData.orderDatetime);
    order.orderStatus = apiData.orderStatusCode;
    order.paymentMethod = apiData.payMethod;
    order.paymentStatus = apiData.cardStatus;
    order.itemsPrice = Number(apiData.goodsPrice) || 0;
    order.postagePrice = Number(apiData.postagePrice) || 0;
    order.totalPrice = Number(apiData.totalPrice) || 0;
    order.requestPrice = Number(apiData.requestPrice) || 0;
    order.couponPrice = Number(apiData.couponPrice) || 0;
    order.pointUsage = Number(apiData.usePoint) || 0;
    order.deliveryMethod = apiData.deliveryName;
    
    // Map complex fields
    order.deliveryInfo = apiData.deliveryInfo || {};
    order.customerInfo = apiData.ordererInfo || {};
    order.items = apiData.itemList || [];
    order.notes = apiData.remarks || '';
    order.cancelType = apiData.cancelType;
    order.cancelDate = apiData.cancelDate ? new Date(apiData.cancelDate) : null;
    order.shopCode = apiData.shopCode;
    
    return order;
  }

  /**
   * Validate order data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    
    if (!this.orderNumber) {
      errors.push('Order number is required');
    }
    
    if (!this.orderDatetime) {
      errors.push('Order datetime is required');
    }
    
    if (this.totalPrice < 0) {
      errors.push('Total price must be non-negative');
    }
    
    if (!this.items || this.items.length === 0) {
      errors.push('Order must have at least one item');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = RakutenOrder;
