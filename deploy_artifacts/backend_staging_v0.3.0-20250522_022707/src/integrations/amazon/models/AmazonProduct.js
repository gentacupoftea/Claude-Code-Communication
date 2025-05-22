/**
 * Amazon Product Model
 * アマゾン商品データモデル
 */

class AmazonProduct {
  constructor(data = {}) {
    this.asin = data.asin || '';
    this.parentAsin = data.parentAsin || null;
    this.productType = data.productType || '';
    this.title = data.title || '';
    this.brand = data.brand || '';
    this.manufacturer = data.manufacturer || '';
    this.description = data.description || '';
    this.bulletPoints = data.bulletPoints || [];
    this.price = data.price || {};
    this.images = data.images || [];
    this.variations = data.variations || [];
    this.dimensions = data.dimensions || {};
    this.weight = data.weight || {};
    this.categories = data.categories || [];
    this.keywords = data.keywords || [];
    this.attributes = data.attributes || {};
    this.salesRank = data.salesRank || {};
    this.reviews = data.reviews || {};
    this.inventory = data.inventory || {};
    this.fulfillment = data.fulfillment || {};
    this.marketplaceId = data.marketplaceId || '';
    this.status = data.status || 'active';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Convert Amazon product to common format
   * アマゾン商品データを共通フォーマットに変換
   * @returns {Object} Common product format
   */
  toCommonFormat() {
    return {
      id: this.asin,
      title: this.title,
      description: this.formatDescription(),
      price: this.normalizePrice(),
      images: this.normalizeImages(),
      variants: this.normalizeVariants(),
      categories: this.normalizeCategories(),
      tags: this.generateTags(),
      inventory: this.normalizeInventory(),
      vendor: this.brand || this.manufacturer,
      metadata: {
        platform: 'amazon',
        marketplaceId: this.marketplaceId,
        asin: this.asin,
        parentAsin: this.parentAsin,
        productType: this.productType,
        salesRank: this.salesRank,
        reviews: this.reviews,
        dimensions: this.dimensions,
        weight: this.weight,
        attributes: this.attributes,
        fulfillment: this.fulfillment
      },
      status: this.status,
      publishedAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Format description with bullet points
   * 箇条書きを含む説明文をフォーマット
   * @returns {string} Formatted description
   */
  formatDescription() {
    let description = this.description || '';
    
    if (this.bulletPoints && this.bulletPoints.length > 0) {
      const bullets = this.bulletPoints.map(point => `• ${point}`).join('\n');
      description = description ? `${description}\n\n${bullets}` : bullets;
    }
    
    return description;
  }

  /**
   * Normalize price data
   * 価格データを正規化
   * @returns {Object} Normalized price
   */
  normalizePrice() {
    const price = {
      amount: 0,
      currency: 'JPY',
      includeTax: true,
      includeShipping: false
    };
    
    if (this.price.listingPrice) {
      price.amount = this.price.listingPrice.amount || 0;
      price.currency = this.price.listingPrice.currencyCode || 'JPY';
    } else if (this.price.regularPrice) {
      price.amount = this.price.regularPrice.amount || 0;
      price.currency = this.price.regularPrice.currencyCode || 'JPY';
    }
    
    // Check for sale price
    if (this.price.salePrice) {
      price.salePrice = {
        amount: this.price.salePrice.amount,
        currency: this.price.salePrice.currencyCode || 'JPY',
        startDate: this.price.salePrice.startDate,
        endDate: this.price.salePrice.endDate
      };
    }
    
    return price;
  }

  /**
   * Normalize image data
   * 画像データを正規化
   * @returns {Array} Normalized images
   */
  normalizeImages() {
    const images = [];
    
    if (this.images.main) {
      images.push({
        src: this.images.main.link,
        alt: this.title,
        position: 0,
        isMain: true,
        variant: 'MAIN',
        height: this.images.main.height,
        width: this.images.main.width
      });
    }
    
    // Add additional images
    if (Array.isArray(this.images.variants)) {
      this.images.variants.forEach((img, index) => {
        images.push({
          src: img.link,
          alt: `${this.title} - ${img.variant || index + 1}`,
          position: index + 1,
          isMain: false,
          variant: img.variant,
          height: img.height,
          width: img.width
        });
      });
    }
    
    return images;
  }

  /**
   * Normalize variant data
   * バリアントデータを正規化
   * @returns {Array} Normalized variants
   */
  normalizeVariants() {
    if (!this.variations || this.variations.length === 0) {
      return [{
        id: this.asin,
        title: this.title,
        price: this.normalizePrice().amount,
        sku: this.asin,
        inventory: this.normalizeInventory(),
        attributes: this.attributes,
        isDefault: true
      }];
    }
    
    return this.variations.map((variant, index) => ({
      id: variant.asin || `${this.asin}-${index}`,
      title: variant.title || this.title,
      price: variant.price || this.normalizePrice().amount,
      sku: variant.asin || variant.sku,
      inventory: variant.inventory || this.normalizeInventory(),
      attributes: variant.attributes || {},
      images: variant.images || [],
      dimensions: variant.dimensions || this.dimensions,
      weight: variant.weight || this.weight,
      isDefault: index === 0 || variant.isDefault
    }));
  }

  /**
   * Normalize category data
   * カテゴリーデータを正規化
   * @returns {Array} Normalized categories
   */
  normalizeCategories() {
    const categories = [];
    
    if (this.categories.primary) {
      categories.push({
        id: this.categories.primary.id,
        name: this.categories.primary.name,
        path: this.categories.primary.path,
        rank: this.categories.primary.rank,
        isPrimary: true
      });
    }
    
    if (Array.isArray(this.categories.additional)) {
      this.categories.additional.forEach(cat => {
        categories.push({
          id: cat.id,
          name: cat.name,
          path: cat.path,
          rank: cat.rank,
          isPrimary: false
        });
      });
    }
    
    return categories;
  }

  /**
   * Normalize inventory data
   * 在庫データを正規化
   * @returns {Object} Normalized inventory
   */
  normalizeInventory() {
    return {
      quantity: this.inventory.quantity || 0,
      fulfillmentChannel: this.inventory.fulfillmentChannel || 'DEFAULT',
      availability: this.inventory.availability || 'IN_STOCK',
      isEligibleForPrime: this.inventory.isEligibleForPrime || false,
      condition: this.inventory.condition || 'NEW',
      conditionNote: this.inventory.conditionNote || ''
    };
  }

  /**
   * Generate tags based on product properties
   * 商品プロパティに基づいてタグを生成
   * @returns {Array} Tags
   */
  generateTags() {
    const tags = [];
    
    // Add brand tag
    if (this.brand) {
      tags.push(`brand:${this.brand.toLowerCase()}`);
    }
    
    // Add product type tag
    if (this.productType) {
      tags.push(`type:${this.productType.toLowerCase()}`);
    }
    
    // Add Prime eligibility tag
    if (this.inventory.isEligibleForPrime) {
      tags.push('prime-eligible');
    }
    
    // Add fulfillment tag
    if (this.fulfillment.channel) {
      tags.push(`fulfillment:${this.fulfillment.channel.toLowerCase()}`);
    }
    
    // Add category tags
    this.normalizeCategories().forEach(cat => {
      if (cat.isPrimary) {
        tags.push(`category:${cat.name.toLowerCase()}`);
      }
    });
    
    // Add keywords
    if (Array.isArray(this.keywords)) {
      this.keywords.forEach(keyword => {
        tags.push(keyword.toLowerCase());
      });
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Create from API response
   * APIレスポンスから作成
   * @param {Object} apiData - Amazon API response
   * @returns {AmazonProduct} Product instance
   */
  static fromAPI(apiData) {
    const product = new AmazonProduct();
    
    // Map basic fields
    product.asin = apiData.Identifiers?.MarketplaceASIN?.ASIN;
    product.parentAsin = apiData.Relationships?.VariationParent?.Identifiers?.MarketplaceASIN?.ASIN;
    product.marketplaceId = apiData.Identifiers?.MarketplaceASIN?.MarketplaceId;
    
    // Map summary data
    if (apiData.ItemAttributes) {
      product.title = apiData.ItemAttributes.Title;
      product.brand = apiData.ItemAttributes.Brand;
      product.manufacturer = apiData.ItemAttributes.Manufacturer;
      product.productType = apiData.ItemAttributes.ProductTypeName;
    }
    
    // Map descriptions
    if (apiData.ContentAttributes) {
      product.description = apiData.ContentAttributes.ProductDescription;
      product.bulletPoints = apiData.ContentAttributes.BulletPoints || [];
    }
    
    // Map images
    if (apiData.ImageAttributes) {
      product.images = {
        main: apiData.ImageAttributes.MainImageUrl,
        variants: apiData.ImageAttributes.OtherImageUrls || []
      };
    }
    
    // Map dimensions and weight
    if (apiData.DimensionAttributes) {
      product.dimensions = {
        length: apiData.DimensionAttributes.ItemDimensions?.Length,
        width: apiData.DimensionAttributes.ItemDimensions?.Width,
        height: apiData.DimensionAttributes.ItemDimensions?.Height,
        unit: apiData.DimensionAttributes.ItemDimensions?.Unit
      };
      
      product.weight = {
        value: apiData.DimensionAttributes.ItemDimensions?.Weight?.Value,
        unit: apiData.DimensionAttributes.ItemDimensions?.Weight?.Unit
      };
    }
    
    // Map categories and sales rank
    if (apiData.SalesRankings) {
      product.salesRank = apiData.SalesRankings.map(rank => ({
        category: rank.ProductCategoryId,
        rank: rank.Rank,
        title: rank.Title
      }));
    }
    
    // Map inventory and fulfillment
    if (apiData.OfferSummaries) {
      const summary = apiData.OfferSummaries[0];
      product.inventory = {
        quantity: summary.TotalQuantity,
        condition: summary.Condition
      };
      
      product.price = {
        listingPrice: summary.ListingPrice,
        regularPrice: summary.RegularPrice,
        fulfillmentChannel: summary.FulfillmentChannel
      };
    }
    
    return product;
  }

  /**
   * Validate product data
   * 商品データを検証
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    
    if (!this.asin) {
      errors.push('ASIN is required');
    }
    
    if (!this.title) {
      errors.push('Title is required');
    }
    
    if (!this.marketplaceId) {
      errors.push('Marketplace ID is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to API format for updates
   * 更新用のAPIフォーマットに変換
   * @returns {Object} API-formatted data
   */
  toAPIFormat() {
    return {
      productType: this.productType,
      attributes: {
        title: [{
          value: this.title,
          marketplace_id: this.marketplaceId
        }],
        description: [{
          value: this.description,
          marketplace_id: this.marketplaceId
        }],
        bullet_points: this.bulletPoints.map(point => ({
          value: point,
          marketplace_id: this.marketplaceId
        })),
        brand: [{
          value: this.brand,
          marketplace_id: this.marketplaceId
        }]
      }
    };
  }
}

module.exports = AmazonProduct;