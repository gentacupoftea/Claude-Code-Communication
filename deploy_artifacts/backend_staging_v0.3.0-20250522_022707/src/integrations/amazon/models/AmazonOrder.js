/**
 * Amazon Order Model
 * アマゾン注文データモデル
 */

class AmazonOrder {
  constructor(data = {}) {
    this.amazonOrderId = data.amazonOrderId || '';
    this.purchaseDate = data.purchaseDate || null;
    this.lastUpdateDate = data.lastUpdateDate || null;
    this.orderStatus = data.orderStatus || '';
    this.fulfillmentChannel = data.fulfillmentChannel || '';
    this.orderType = data.orderType || 'StandardOrder';
    this.isPrime = data.isPrime || false;
    this.isPremiumOrder = data.isPremiumOrder || false;
    this.isBusinessOrder = data.isBusinessOrder || false;
    this.orderTotal = data.orderTotal || {};
    this.numberOfItemsShipped = data.numberOfItemsShipped || 0;
    this.numberOfItemsUnshipped = data.numberOfItemsUnshipped || 0;
    this.paymentMethod = data.paymentMethod || '';
    this.paymentMethodDetails = data.paymentMethodDetails || [];
    this.marketplaceId = data.marketplaceId || '';
    this.buyerInfo = data.buyerInfo || {};
    this.shippingAddress = data.shippingAddress || {};
    this.shipServiceLevel = data.shipServiceLevel || '';
    this.earliestShipDate = data.earliestShipDate || null;
    this.latestShipDate = data.latestShipDate || null;
    this.earliestDeliveryDate = data.earliestDeliveryDate || null;
    this.latestDeliveryDate = data.latestDeliveryDate || null;
    this.items = data.items || [];
    this.taxInfo = data.taxInfo || {};
    this.shipmentStatus = data.shipmentStatus || '';
    this.defaultShipFromLocationAddress = data.defaultShipFromLocationAddress || {};
  }

  /**
   * Convert Amazon order to common format
   * アマゾン注文データを共通フォーマットに変換
   * @returns {Object} Common order format
   */
  toCommonFormat() {
    return {
      id: this.amazonOrderId,
      orderNumber: this.amazonOrderId,
      createdAt: this.purchaseDate,
      updatedAt: this.lastUpdateDate,
      status: this.normalizeStatus(),
      financialStatus: this.normalizeFinancialStatus(),
      fulfillmentStatus: this.normalizeFulfillmentStatus(),
      totalPrice: this.orderTotal.Amount || 0,
      currency: this.orderTotal.CurrencyCode || 'JPY',
      subtotalPrice: this.calculateSubtotal(),
      shippingPrice: this.calculateShipping(),
      taxPrice: this.calculateTax(),
      discountPrice: this.calculateDiscount(),
      customer: this.normalizeCustomer(),
      shippingAddress: this.normalizeShippingAddress(),
      billingAddress: this.normalizeBillingAddress(),
      items: this.normalizeItems(),
      paymentMethod: this.paymentMethod,
      paymentDetails: this.paymentMethodDetails,
      shippingMethod: this.shipServiceLevel,
      fulfillmentChannel: this.fulfillmentChannel,
      notes: this.generateNotes(),
      tags: this.generateTags(),
      metadata: {
        platform: 'amazon',
        marketplaceId: this.marketplaceId,
        orderType: this.orderType,
        isPrime: this.isPrime,
        isPremiumOrder: this.isPremiumOrder,
        isBusinessOrder: this.isBusinessOrder,
        shipmentStatus: this.shipmentStatus,
        deliveryWindow: {
          earliestDate: this.earliestDeliveryDate,
          latestDate: this.latestDeliveryDate
        },
        shipWindow: {
          earliestDate: this.earliestShipDate,
          latestDate: this.latestShipDate
        }
      }
    };
  }

  /**
   * Normalize order status
   * 注文ステータスを正規化
   * @returns {string} Normalized status
   */
  normalizeStatus() {
    const statusMap = {
      'Pending': 'pending',
      'Unshipped': 'processing',
      'PartiallyShipped': 'partially_fulfilled',
      'Shipped': 'fulfilled',
      'Cancelled': 'cancelled',
      'Unfulfillable': 'unfulfillable',
      'PendingAvailability': 'pending_availability',
      'InvoiceUnconfirmed': 'payment_pending'
    };
    
    return statusMap[this.orderStatus] || 'unknown';
  }

  /**
   * Normalize financial status
   * 支払いステータスを正規化
   * @returns {string} Normalized financial status
   */
  normalizeFinancialStatus() {
    if (this.orderStatus === 'Cancelled') {
      return 'cancelled';
    }
    
    // Amazon doesn't provide explicit payment status, so we infer
    if (this.orderStatus === 'InvoiceUnconfirmed') {
      return 'pending';
    }
    
    if (this.numberOfItemsShipped > 0) {
      return 'paid';
    }
    
    return 'authorized';
  }

  /**
   * Normalize fulfillment status
   * 配送ステータスを正規化
   * @returns {string} Normalized fulfillment status
   */
  normalizeFulfillmentStatus() {
    if (this.numberOfItemsShipped === 0 && this.numberOfItemsUnshipped === 0) {
      return 'pending';
    }
    
    if (this.numberOfItemsShipped === 0) {
      return 'unfulfilled';
    }
    
    if (this.numberOfItemsUnshipped === 0) {
      return 'fulfilled';
    }
    
    return 'partially_fulfilled';
  }

  /**
   * Calculate subtotal
   * 小計を計算
   * @returns {number} Subtotal
   */
  calculateSubtotal() {
    return this.items.reduce((total, item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      return total + itemTotal;
    }, 0);
  }

  /**
   * Calculate shipping total
   * 配送料合計を計算
   * @returns {number} Shipping total
   */
  calculateShipping() {
    return this.items.reduce((total, item) => {
      return total + (item.shippingPrice || 0);
    }, 0);
  }

  /**
   * Calculate tax total
   * 税金合計を計算
   * @returns {number} Tax total
   */
  calculateTax() {
    if (this.taxInfo.TaxAmount) {
      return this.taxInfo.TaxAmount;
    }
    
    return this.items.reduce((total, item) => {
      return total + (item.itemTax || 0) + (item.shippingTax || 0);
    }, 0);
  }

  /**
   * Calculate discount total
   * 割引合計を計算
   * @returns {number} Discount total
   */
  calculateDiscount() {
    return this.items.reduce((total, item) => {
      return total + (item.promotionDiscount || 0);
    }, 0);
  }

  /**
   * Normalize customer information
   * 顧客情報を正規化
   * @returns {Object} Normalized customer
   */
  normalizeCustomer() {
    return {
      id: this.buyerInfo.BuyerEmail || this.amazonOrderId,
      email: this.buyerInfo.BuyerEmail,
      name: this.buyerInfo.BuyerName,
      phone: this.buyerInfo.BuyerPhone,
      taxId: this.buyerInfo.BuyerTaxInfo?.TaxClassifications?.[0]?.Value,
      isBusinessCustomer: this.isBusinessOrder,
      metadata: {
        buyerCounty: this.buyerInfo.BuyerCounty,
        buyerPurchaseOrderNumber: this.buyerInfo.PurchaseOrderNumber
      }
    };
  }

  /**
   * Normalize shipping address
   * 配送先住所を正規化
   * @returns {Object} Normalized address
   */
  normalizeShippingAddress() {
    const addr = this.shippingAddress;
    return {
      name: addr.Name,
      firstName: this.extractFirstName(addr.Name),
      lastName: this.extractLastName(addr.Name),
      company: addr.CompanyName,
      address1: addr.AddressLine1,
      address2: addr.AddressLine2,
      address3: addr.AddressLine3,
      city: addr.City,
      province: addr.StateOrProvinceCode,
      country: addr.CountryCode,
      zip: addr.PostalCode,
      phone: addr.Phone,
      district: addr.District,
      county: addr.County
    };
  }

  /**
   * Normalize billing address
   * 請求先住所を正規化
   * @returns {Object} Normalized address
   */
  normalizeBillingAddress() {
    // Amazon doesn't provide separate billing address
    // Use shipping address as billing address
    return this.normalizeShippingAddress();
  }

  /**
   * Normalize order items
   * 注文アイテムを正規化
   * @returns {Array} Normalized items
   */
  normalizeItems() {
    return this.items.map((item, index) => ({
      id: item.OrderItemId || `${this.amazonOrderId}-${index}`,
      orderId: this.amazonOrderId,
      productId: item.ASIN,
      variantId: item.SellerSKU,
      title: item.Title,
      quantity: item.QuantityOrdered || 1,
      quantityShipped: item.QuantityShipped || 0,
      price: item.ItemPrice?.Amount || 0,
      totalPrice: (item.ItemPrice?.Amount || 0) * (item.QuantityOrdered || 1),
      taxPrice: item.ItemTax?.Amount || 0,
      shippingPrice: item.ShippingPrice?.Amount || 0,
      shippingTax: item.ShippingTax?.Amount || 0,
      promotionDiscount: item.PromotionDiscount?.Amount || 0,
      currency: item.ItemPrice?.CurrencyCode || 'JPY',
      sku: item.SellerSKU,
      fulfillmentStatus: this.normalizeItemFulfillmentStatus(item),
      giftWrapLevel: item.GiftWrapLevel,
      giftMessage: item.GiftMessageText,
      isGift: item.IsGift,
      priceDesignation: item.PriceDesignation,
      metadata: {
        asin: item.ASIN,
        orderItemId: item.OrderItemId,
        productInfo: item.ProductInfo,
        pointsGranted: item.PointsGranted,
        isTransparency: item.IsTransparency,
        serialNumbers: item.SerialNumbers,
        deemedResellerCategory: item.DeemedResellerCategory
      }
    }));
  }

  /**
   * Normalize item fulfillment status
   * アイテムの配送ステータスを正規化
   * @param {Object} item - Order item
   * @returns {string} Normalized status
   */
  normalizeItemFulfillmentStatus(item) {
    if (item.QuantityShipped === 0) {
      return 'pending';
    }
    
    if (item.QuantityShipped >= item.QuantityOrdered) {
      return 'fulfilled';
    }
    
    return 'partially_fulfilled';
  }

  /**
   * Generate notes from order data
   * 注文データからメモを生成
   * @returns {string} Notes
   */
  generateNotes() {
    const notes = [];
    
    if (this.isBusinessOrder) {
      notes.push('Business Order');
    }
    
    if (this.isPrime) {
      notes.push('Prime Order');
    }
    
    if (this.isPremiumOrder) {
      notes.push('Premium Order');
    }
    
    if (this.fulfillmentChannel === 'AFN') {
      notes.push('Fulfilled by Amazon');
    }
    
    return notes.join(', ');
  }

  /**
   * Generate tags based on order properties
   * 注文プロパティに基づいてタグを生成
   * @returns {Array} Tags
   */
  generateTags() {
    const tags = [];
    
    // Add fulfillment tags
    tags.push(`fulfillment:${this.fulfillmentChannel.toLowerCase()}`);
    
    // Add order type tags
    if (this.isPrime) tags.push('prime');
    if (this.isPremiumOrder) tags.push('premium');
    if (this.isBusinessOrder) tags.push('b2b');
    
    // Add status tags
    tags.push(`status:${this.normalizeStatus()}`);
    
    // Add shipping level tag
    if (this.shipServiceLevel) {
      tags.push(`shipping:${this.shipServiceLevel.toLowerCase()}`);
    }
    
    // Add marketplace tag
    tags.push(`marketplace:${this.marketplaceId.toLowerCase()}`);
    
    return tags;
  }

  /**
   * Extract first name from full name
   * フルネームから名を抽出
   * @param {string} fullName - Full name
   * @returns {string} First name
   */
  extractFirstName(fullName) {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    return parts[0] || '';
  }

  /**
   * Extract last name from full name
   * フルネームから姓を抽出
   * @param {string} fullName - Full name
   * @returns {string} Last name
   */
  extractLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    return parts.slice(1).join(' ') || '';
  }

  /**
   * Create from API response
   * APIレスポンスから作成
   * @param {Object} apiData - Amazon API response
   * @returns {AmazonOrder} Order instance
   */
  static fromAPI(apiData) {
    const order = new AmazonOrder();
    
    // Map basic fields
    order.amazonOrderId = apiData.AmazonOrderId;
    order.purchaseDate = new Date(apiData.PurchaseDate);
    order.lastUpdateDate = new Date(apiData.LastUpdateDate);
    order.orderStatus = apiData.OrderStatus;
    order.fulfillmentChannel = apiData.FulfillmentChannel;
    order.orderType = apiData.OrderType;
    order.isPrime = apiData.IsPrime || false;
    order.isPremiumOrder = apiData.IsPremiumOrder || false;
    order.isBusinessOrder = apiData.IsBusinessOrder || false;
    order.marketplaceId = apiData.MarketplaceId;
    order.shipServiceLevel = apiData.ShipServiceLevel;
    order.numberOfItemsShipped = apiData.NumberOfItemsShipped || 0;
    order.numberOfItemsUnshipped = apiData.NumberOfItemsUnshipped || 0;
    
    // Map order total
    if (apiData.OrderTotal) {
      order.orderTotal = {
        CurrencyCode: apiData.OrderTotal.CurrencyCode,
        Amount: parseFloat(apiData.OrderTotal.Amount)
      };
    }
    
    // Map payment information
    order.paymentMethod = apiData.PaymentMethod;
    order.paymentMethodDetails = apiData.PaymentMethodDetails || [];
    
    // Map buyer information
    if (apiData.BuyerInfo) {
      order.buyerInfo = apiData.BuyerInfo;
    }
    
    // Map shipping address
    if (apiData.ShippingAddress) {
      order.shippingAddress = apiData.ShippingAddress;
    }
    
    // Map shipping dates
    if (apiData.EarliestShipDate) {
      order.earliestShipDate = new Date(apiData.EarliestShipDate);
    }
    if (apiData.LatestShipDate) {
      order.latestShipDate = new Date(apiData.LatestShipDate);
    }
    if (apiData.EarliestDeliveryDate) {
      order.earliestDeliveryDate = new Date(apiData.EarliestDeliveryDate);
    }
    if (apiData.LatestDeliveryDate) {
      order.latestDeliveryDate = new Date(apiData.LatestDeliveryDate);
    }
    
    // Map order items (would be loaded separately)
    order.items = [];
    
    return order;
  }

  /**
   * Add order items from API response
   * APIレスポンスから注文アイテムを追加
   * @param {Array} itemsData - Order items from API
   */
  addItemsFromAPI(itemsData) {
    this.items = itemsData.map(itemData => ({
      OrderItemId: itemData.OrderItemId,
      ASIN: itemData.ASIN,
      SellerSKU: itemData.SellerSKU,
      Title: itemData.Title,
      QuantityOrdered: itemData.QuantityOrdered,
      QuantityShipped: itemData.QuantityShipped,
      ItemPrice: itemData.ItemPrice,
      ItemTax: itemData.ItemTax,
      ShippingPrice: itemData.ShippingPrice,
      ShippingTax: itemData.ShippingTax,
      PromotionDiscount: itemData.PromotionDiscount,
      PromotionIds: itemData.PromotionIds,
      ConditionId: itemData.ConditionId,
      ConditionSubtypeId: itemData.ConditionSubtypeId,
      IsGift: itemData.IsGift,
      GiftWrapLevel: itemData.GiftWrapLevel,
      GiftMessageText: itemData.GiftMessageText,
      PriceDesignation: itemData.PriceDesignation,
      ProductInfo: itemData.ProductInfo,
      SerialNumbers: itemData.SerialNumbers,
      IsTransparency: itemData.IsTransparency,
      DeemedResellerCategory: itemData.DeemedResellerCategory,
      IossNumber: itemData.IossNumber,
      PointsGranted: itemData.PointsGranted
    }));
  }

  /**
   * Validate order data
   * 注文データを検証
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    
    if (!this.amazonOrderId) {
      errors.push('Amazon order ID is required');
    }
    
    if (!this.purchaseDate) {
      errors.push('Purchase date is required');
    }
    
    if (!this.orderStatus) {
      errors.push('Order status is required');
    }
    
    if (!this.marketplaceId) {
      errors.push('Marketplace ID is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = AmazonOrder;