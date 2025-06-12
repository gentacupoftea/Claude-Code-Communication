import { Injectable } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';

interface AccessPattern {
  userId: string;
  timestamp: number;
  endpoint: string;
  ip: string;
  userAgent: string;
  responseTime: number;
  statusCode: number;
  geoLocation?: {
    country: string;
    city: string;
    lat: number;
    lon: number;
  };
}

interface AnomalyScore {
  score: number;
  factors: {
    temporal: number;
    geographic: number;
    behavioral: number;
    velocity: number;
  };
  recommendation: 'allow' | 'challenge' | 'block';
  confidence: number;
}

/**
 * AI-powered anomaly detection for authentication security
 */
@Injectable()
export class AIAnomalyDetector {
  private model: tf.LayersModel | null = null;
  private userPatterns = new Map<string, AccessPattern[]>();
  private readonly patternHistoryLimit = 1000;
  private readonly anomalyThreshold = 0.85;
  
  // Feature engineering constants
  private readonly timeWindows = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000
  };

  constructor() {
    this.initializeModel();
  }

  /**
   * Initialize or load the anomaly detection model
   */
  private async initializeModel() {
    try {
      // Try to load existing model
      this.model = await tf.loadLayersModel('file://./models/auth-anomaly-detector/model.json');
    } catch {
      // Create new model if not exists
      this.model = this.createModel();
    }
  }

  /**
   * Create a new anomaly detection model
   */
  private createModel(): tf.Sequential {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [15], // Feature vector size
          units: 32,
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 8,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid' // Anomaly score between 0 and 1
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Analyze access pattern for anomalies
   */
  async analyzePattern(pattern: AccessPattern): Promise<AnomalyScore> {
    // Store pattern for future analysis
    this.storePattern(pattern);

    // Extract features
    const features = await this.extractFeatures(pattern);
    
    // Get anomaly prediction
    const anomalyScore = await this.predictAnomaly(features);
    
    // Calculate component scores
    const factors = {
      temporal: await this.calculateTemporalAnomaly(pattern),
      geographic: await this.calculateGeographicAnomaly(pattern),
      behavioral: await this.calculateBehavioralAnomaly(pattern),
      velocity: await this.calculateVelocityAnomaly(pattern)
    };

    // Determine recommendation
    const recommendation = this.getRecommendation(anomalyScore, factors);
    
    // Calculate confidence based on available data
    const confidence = this.calculateConfidence(pattern.userId);

    return {
      score: anomalyScore,
      factors,
      recommendation,
      confidence
    };
  }

  /**
   * Extract features from access pattern
   */
  private async extractFeatures(pattern: AccessPattern): Promise<number[]> {
    const userHistory = this.userPatterns.get(pattern.userId) || [];
    const now = pattern.timestamp;
    
    // Time-based features
    const hour = new Date(now).getHours();
    const dayOfWeek = new Date(now).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
    
    // Access frequency features
    const accessCountLastMinute = this.countAccessesInWindow(userHistory, now, this.timeWindows.minute);
    const accessCountLastHour = this.countAccessesInWindow(userHistory, now, this.timeWindows.hour);
    const accessCountLastDay = this.countAccessesInWindow(userHistory, now, this.timeWindows.day);
    
    // Endpoint diversity
    const uniqueEndpointsLastHour = this.countUniqueEndpoints(userHistory, now, this.timeWindows.hour);
    
    // Geographic features
    const geoChangeRate = await this.calculateGeoChangeRate(pattern, userHistory);
    const distanceFromUsual = await this.calculateDistanceFromUsualLocation(pattern, userHistory);
    
    // Response time features
    const avgResponseTime = this.calculateAverageResponseTime(userHistory);
    const responseTimeDeviation = Math.abs(pattern.responseTime - avgResponseTime) / (avgResponseTime || 1);
    
    // Error rate
    const errorRate = this.calculateErrorRate(userHistory);
    
    // User agent consistency
    const userAgentChanged = this.hasUserAgentChanged(pattern, userHistory) ? 1 : 0;
    
    // Time since last access
    const timeSinceLastAccess = this.getTimeSinceLastAccess(pattern, userHistory);
    
    // New endpoint indicator
    const isNewEndpoint = this.isNewEndpoint(pattern.endpoint, userHistory) ? 1 : 0;

    return [
      hour / 24,
      dayOfWeek / 7,
      isWeekend,
      Math.min(accessCountLastMinute / 10, 1),
      Math.min(accessCountLastHour / 100, 1),
      Math.min(accessCountLastDay / 1000, 1),
      Math.min(uniqueEndpointsLastHour / 20, 1),
      geoChangeRate,
      Math.min(distanceFromUsual / 1000, 1),
      Math.min(responseTimeDeviation, 1),
      errorRate,
      userAgentChanged,
      Math.min(timeSinceLastAccess / (24 * 60 * 60 * 1000), 1),
      isNewEndpoint,
      pattern.statusCode >= 400 ? 1 : 0
    ];
  }

  /**
   * Predict anomaly score using the model
   */
  private async predictAnomaly(features: number[]): Promise<number> {
    if (!this.model) {
      // Fallback to rule-based scoring if model not available
      return this.ruleBasedAnomalyScore(features);
    }

    const prediction = this.model.predict(tf.tensor2d([features])) as tf.Tensor;
    const score = await prediction.data();
    prediction.dispose();
    
    return score[0];
  }

  /**
   * Rule-based anomaly scoring as fallback
   */
  private ruleBasedAnomalyScore(features: number[]): number {
    let score = 0;
    
    // High access frequency
    if (features[3] > 0.5) score += 0.2; // Many accesses in last minute
    if (features[4] > 0.7) score += 0.3; // Many accesses in last hour
    
    // Geographic anomaly
    if (features[7] > 0.8) score += 0.2; // High geo change rate
    if (features[8] > 0.5) score += 0.15; // Far from usual location
    
    // Behavioral anomaly
    if (features[11] === 1) score += 0.1; // User agent changed
    if (features[13] === 1) score += 0.1; // New endpoint
    if (features[14] === 1) score += 0.15; // Error response
    
    return Math.min(score, 1);
  }

  /**
   * Calculate temporal anomaly score
   */
  private async calculateTemporalAnomaly(pattern: AccessPattern): Promise<number> {
    const userHistory = this.userPatterns.get(pattern.userId) || [];
    const hour = new Date(pattern.timestamp).getHours();
    
    // Build hour distribution
    const hourCounts = new Array(24).fill(0);
    userHistory.forEach(p => {
      const h = new Date(p.timestamp).getHours();
      hourCounts[h]++;
    });
    
    const totalAccesses = hourCounts.reduce((a, b) => a + b, 0);
    if (totalAccesses === 0) return 0;
    
    const expectedFrequency = hourCounts[hour] / totalAccesses;
    return 1 - expectedFrequency; // Higher score for unusual hours
  }

  /**
   * Calculate geographic anomaly score
   */
  private async calculateGeographicAnomaly(pattern: AccessPattern): Promise<number> {
    if (!pattern.geoLocation) return 0;
    
    const userHistory = this.userPatterns.get(pattern.userId) || [];
    const recentLocations = userHistory
      .filter(p => p.geoLocation)
      .slice(-10);
    
    if (recentLocations.length === 0) return 0;
    
    // Calculate average distance from recent locations
    const distances = recentLocations.map(p => 
      this.calculateDistance(
        pattern.geoLocation!.lat,
        pattern.geoLocation!.lon,
        p.geoLocation!.lat,
        p.geoLocation!.lon
      )
    );
    
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    
    // Normalize to 0-1 range (consider 1000km as maximum anomaly)
    return Math.min(avgDistance / 1000, 1);
  }

  /**
   * Calculate behavioral anomaly score
   */
  private async calculateBehavioralAnomaly(pattern: AccessPattern): Promise<number> {
    const userHistory = this.userPatterns.get(pattern.userId) || [];
    
    // Endpoint usage pattern
    const endpointFrequency = new Map<string, number>();
    userHistory.forEach(p => {
      endpointFrequency.set(p.endpoint, (endpointFrequency.get(p.endpoint) || 0) + 1);
    });
    
    const currentEndpointFreq = endpointFrequency.get(pattern.endpoint) || 0;
    const totalAccesses = userHistory.length;
    
    if (totalAccesses === 0) return 0;
    
    const expectedFrequency = currentEndpointFreq / totalAccesses;
    return 1 - expectedFrequency; // Higher score for unusual endpoints
  }

  /**
   * Calculate velocity anomaly score
   */
  private async calculateVelocityAnomaly(pattern: AccessPattern): Promise<number> {
    const userHistory = this.userPatterns.get(pattern.userId) || [];
    const recentAccesses = userHistory
      .filter(p => p.timestamp > pattern.timestamp - this.timeWindows.minute)
      .length;
    
    // Flag rapid successive accesses
    if (recentAccesses > 20) return 1;
    if (recentAccesses > 10) return 0.7;
    if (recentAccesses > 5) return 0.3;
    
    return 0;
  }

  /**
   * Get recommendation based on anomaly scores
   */
  private getRecommendation(
    overallScore: number,
    factors: AnomalyScore['factors']
  ): AnomalyScore['recommendation'] {
    // Critical factors that warrant blocking
    if (factors.velocity > 0.9) return 'block';
    if (overallScore > 0.95) return 'block';
    
    // High anomaly warrants additional verification
    if (overallScore > this.anomalyThreshold) return 'challenge';
    if (factors.geographic > 0.8 && factors.temporal > 0.7) return 'challenge';
    
    return 'allow';
  }

  /**
   * Store access pattern for future analysis
   */
  private storePattern(pattern: AccessPattern): void {
    const patterns = this.userPatterns.get(pattern.userId) || [];
    patterns.push(pattern);
    
    // Keep only recent patterns
    if (patterns.length > this.patternHistoryLimit) {
      patterns.splice(0, patterns.length - this.patternHistoryLimit);
    }
    
    this.userPatterns.set(pattern.userId, patterns);
  }

  /**
   * Utility functions
   */
  private countAccessesInWindow(history: AccessPattern[], now: number, window: number): number {
    return history.filter(p => p.timestamp > now - window).length;
  }

  private countUniqueEndpoints(history: AccessPattern[], now: number, window: number): number {
    const endpoints = new Set(
      history
        .filter(p => p.timestamp > now - window)
        .map(p => p.endpoint)
    );
    return endpoints.size;
  }

  private calculateAverageResponseTime(history: AccessPattern[]): number {
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, p) => acc + p.responseTime, 0);
    return sum / history.length;
  }

  private calculateErrorRate(history: AccessPattern[]): number {
    if (history.length === 0) return 0;
    const errors = history.filter(p => p.statusCode >= 400).length;
    return errors / history.length;
  }

  private hasUserAgentChanged(current: AccessPattern, history: AccessPattern[]): boolean {
    const lastPattern = history[history.length - 1];
    return lastPattern && lastPattern.userAgent !== current.userAgent;
  }

  private getTimeSinceLastAccess(current: AccessPattern, history: AccessPattern[]): number {
    const lastPattern = history[history.length - 1];
    return lastPattern ? current.timestamp - lastPattern.timestamp : Infinity;
  }

  private isNewEndpoint(endpoint: string, history: AccessPattern[]): boolean {
    return !history.some(p => p.endpoint === endpoint);
  }

  private async calculateGeoChangeRate(current: AccessPattern, history: AccessPattern[]): Promise<number> {
    if (!current.geoLocation || history.length < 2) return 0;
    
    const recentWithGeo = history
      .filter(p => p.geoLocation)
      .slice(-5);
    
    if (recentWithGeo.length < 2) return 0;
    
    let changes = 0;
    for (let i = 1; i < recentWithGeo.length; i++) {
      const distance = this.calculateDistance(
        recentWithGeo[i].geoLocation!.lat,
        recentWithGeo[i].geoLocation!.lon,
        recentWithGeo[i-1].geoLocation!.lat,
        recentWithGeo[i-1].geoLocation!.lon
      );
      if (distance > 100) changes++; // Significant change if > 100km
    }
    
    return changes / (recentWithGeo.length - 1);
  }

  private async calculateDistanceFromUsualLocation(current: AccessPattern, history: AccessPattern[]): Promise<number> {
    if (!current.geoLocation) return 0;
    
    const locationsWithGeo = history.filter(p => p.geoLocation);
    if (locationsWithGeo.length === 0) return 0;
    
    // Calculate centroid of usual locations
    const latSum = locationsWithGeo.reduce((sum, p) => sum + p.geoLocation!.lat, 0);
    const lonSum = locationsWithGeo.reduce((sum, p) => sum + p.geoLocation!.lon, 0);
    const centroidLat = latSum / locationsWithGeo.length;
    const centroidLon = lonSum / locationsWithGeo.length;
    
    return this.calculateDistance(
      current.geoLocation.lat,
      current.geoLocation.lon,
      centroidLat,
      centroidLon
    );
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private calculateConfidence(userId: string): number {
    const history = this.userPatterns.get(userId) || [];
    // Confidence increases with more historical data
    return Math.min(history.length / 100, 1);
  }

  /**
   * Train the model with new data (called periodically)
   */
  async trainModel(labeledData: { features: number[], isAnomaly: boolean }[]): Promise<void> {
    if (!this.model || labeledData.length < 100) return;
    
    const features = labeledData.map(d => d.features);
    const labels = labeledData.map(d => d.isAnomaly ? 1 : 0);
    
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);
    
    await this.model.fit(xs, ys, {
      epochs: 10,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs?.loss}`);
        }
      }
    });
    
    xs.dispose();
    ys.dispose();
    
    // Save updated model
    await this.model.save('file://./models/auth-anomaly-detector');
  }
}