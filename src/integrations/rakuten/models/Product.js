/**
 * Rakuten Product Model
 * 楽天商品データモデル
 */

class RakutenProduct {
  constructor(data = {}) {
    this.itemUrl = data.itemUrl || '';
    this.itemNumber = data.itemNumber || '';
    this.itemName = data.itemName || '';
    this.itemPrice = data.itemPrice || 0;
    this.genreId = data.genreId || '';
    this.catalogId = data.catalogId || '';
    this.itemCaption = data.itemCaption || '';
    this.catchCopy = data.catchCopy || '';
    this.isIncludedTax = data.isIncludedTax || 1;
    this.isIncludedPostage = data.isIncludedPostage || 0;
    this.postageType = data.postageType || 0;
    this.imageUrl = data.imageUrl || '';
    this.images = data.images || [];
    this.options = data.options || [];
    this.categories = data.categories || [];
    this.tags = data.tags || [];
    this.inventory = data.inventory || null;
    this.variations = data.variations || [];
    this.shopCode = data.shopCode || '';
    this.status = data.status || 'active';
    this.publishedAt = data.publishedAt || null;
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Convert Rakuten product to common format
   * 楽天商品データを共通フォーマットに変換
   * @returns {Object} Common product format
   */
  toCommonFormat() {
    return {
      id: this.itemNumber,
      title: this.itemName,
      description: this.itemCaption,
      price: {
        amount: this.itemPrice,
        currency: 'JPY',
        includeTax: this.isIncludedTax === 1,
        includeShipping: this.isIncludedPostage === 1
      },
      images: this.normalizeImages(),
      variants: this.normalizeVariants(),
      categories: this.categories,
      tags: this.tags,
      inventory: this.inventory,
      metadata: {
        platform: 'rakuten',
        shopCode: this.shopCode,
        genreId: this.genreId,
        catalogId: this.catalogId,
        catchCopy: this.catchCopy,
        url: this.itemUrl
      },
      status: this.status,
      publishedAt: this.publishedAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Normalize image data
   * @returns {Array} Normalized images
   */
  normalizeImages() {
    const images = [];
    
    // Add main image
    if (this.imageUrl) {
      images.push({
        src: this.imageUrl,
        alt: this.itemName,
        position: 0,
        isMain: true
      });
    }
    
    // Add additional images
    this.images.forEach((img, index) => {
      images.push({
        src: img.url || img,
        alt: img.alt || `${this.itemName} - Image ${index + 1}`,
        position: index + 1,
        isMain: false
      });
    });
    
    return images;
  }

  /**
   * Normalize variant data
   * @returns {Array} Normalized variants
   */
  normalizeVariants() {
    if (!this.variations || this.variations.length === 0) {
      return [{
        id: `${this.itemNumber}-default`,
        title: 'Default',
        price: this.itemPrice,
        sku: this.itemNumber,
        inventory: this.inventory,
        isDefault: true
      }];
    }
    
    return this.variations.map((variant, index) => ({
      id: variant.variantId || `${this.itemNumber}-${index}`,
      title: variant.variantName || variant.optionName,
      price: variant.price || this.itemPrice,
      sku: variant.sku || `${this.itemNumber}-${index}`,
      inventory: variant.inventory,
      options: this.normalizeOptions(variant.options),
      isDefault: index === 0
    }));
  }

  /**
   * Normalize option data
   * @param {Array} options - Variant options
   * @returns {Array} Normalized options
   */
  normalizeOptions(options = []) {
    return options.map(option => ({
      name: option.name || option.optionName,
      value: option.value || option.optionValue,
      displayName: option.displayName,
      position: option.position || 0
    }));
  }

  /**
   * Validate product data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    
    if (!this.itemNumber) {
      errors.push('Item number is required');
    }
    
    if (!this.itemName) {
      errors.push('Item name is required');
    }
    
    if (this.itemPrice < 0) {
      errors.push('Item price must be non-negative');
    }
    
    if (!this.genreId) {
      errors.push('Genre ID is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create from API response
   * @param {Object} apiData - Rakuten API response
   * @returns {RakutenProduct} Product instance
   */
  static fromAPI(apiData) {
    const product = new RakutenProduct();
    
    // Map API fields to model
    product.itemUrl = apiData.itemUrl;
    product.itemNumber = apiData.itemNumber;
    product.itemName = apiData.itemName;
    product.itemPrice = Number(apiData.itemPrice) || 0;
    product.genreId = apiData.genreId;
    product.catalogId = apiData.catalogId;
    product.itemCaption = apiData.itemCaption;
    product.catchCopy = apiData.catchCopy;
    product.isIncludedTax = apiData.isIncludedTax;
    product.isIncludedPostage = apiData.isIncludedPostage;
    product.postageType = apiData.postageType;
    product.imageUrl = apiData.imageUrl;
    
    // Map complex fields
    if (apiData.images) {
      product.images = Array.isArray(apiData.images) ? apiData.images : [apiData.images];
    }
    
    if (apiData.options) {
      product.options = apiData.options;
    }
    
    if (apiData.inventory) {
      product.inventory = {
        quantity: apiData.inventory.quantity || 0,
        type: apiData.inventory.inventoryType || 'normal',
        backorderQuantity: apiData.inventory.backorderQuantity || 0
      };
    }
    
    return product;
  }

  /**
   * Convert to API format for updates
   * @returns {Object} API-formatted data
   */
  toAPIFormat() {
    return {
      item: {
        itemUrl: this.itemUrl,
        itemNumber: this.itemNumber,
        itemName: this.itemName,
        itemPrice: this.itemPrice,
        genreId: this.genreId,
        catalogId: this.catalogId,
        itemCaption: this.itemCaption,
        catchCopy: this.catchCopy,
        isIncludedTax: this.isIncludedTax,
        isIncludedPostage: this.isIncludedPostage,
        postageType: this.postageType,
        imageUrl: this.imageUrl,
        images: this.images,
        options: this.options,
        inventory: this.inventory
      }
    };
  }
}

module.exports = RakutenProduct;
