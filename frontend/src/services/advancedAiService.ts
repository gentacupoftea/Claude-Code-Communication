import axios from 'axios';

export interface UserBehavior {
  userId: string;
  sessionId: string;
  timestamp: Date;
  action: string;
  context: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AIRecommendation {
  id: string;
  type: 'product' | 'action' | 'insight' | 'optimization';
  title: string;
  description: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  data: Record<string, any>;
  feedback?: RecommendationFeedback;
  createdAt: Date;
  expiresAt?: Date;
}

export interface RecommendationFeedback {
  useful: boolean;
  implemented: boolean;
  rating: number; // 1-5
  comment?: string;
  timestamp: Date;
}

export interface UserProfile {
  userId: string;
  preferences: Record<string, any>;
  behaviorPatterns: BehaviorPattern[];
  interests: string[];
  segmentId: string;
  lastUpdated: Date;
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  lastOccurrence: Date;
  context: Record<string, any>;
}

export interface PredictionResult {
  prediction: string;
  confidence: number;
  factors: Array<{
    factor: string;
    weight: number;
    value: any;
  }>;
  metadata: Record<string, any>;
}

class AdvancedAiService {
  private baseURL: string;
  private behaviorQueue: UserBehavior[] = [];
  private flushInterval: number = 5000; // 5 seconds
  private maxQueueSize: number = 100;
  private userProfiles: Map<string, UserProfile> = new Map();
  private recommendations: Map<string, AIRecommendation[]> = new Map();

  constructor(baseURL: string = '/api/ai') {
    this.baseURL = baseURL;
    this.startBehaviorTracking();
    this.loadCachedData();
  }

  private startBehaviorTracking(): void {
    setInterval(() => {
      if (this.behaviorQueue.length > 0) {
        this.flushBehaviorData();
      }
    }, this.flushInterval);
  }

  private loadCachedData(): void {
    try {
      const cachedProfiles = localStorage.getItem('ai-user-profiles');
      if (cachedProfiles) {
        const profiles = JSON.parse(cachedProfiles);
        Object.entries(profiles).forEach(([userId, profile]) => {
          this.userProfiles.set(userId, profile as UserProfile);
        });
      }

      const cachedRecommendations = localStorage.getItem('ai-recommendations');
      if (cachedRecommendations) {
        const recommendations = JSON.parse(cachedRecommendations);
        Object.entries(recommendations).forEach(([userId, recs]) => {
          this.recommendations.set(userId, recs as AIRecommendation[]);
        });
      }
    } catch (error) {
      console.error('Failed to load cached AI data:', error);
    }
  }

  private saveCachedData(): void {
    try {
      const profiles = Object.fromEntries(this.userProfiles);
      localStorage.setItem('ai-user-profiles', JSON.stringify(profiles));

      const recommendations = Object.fromEntries(this.recommendations);
      localStorage.setItem('ai-recommendations', JSON.stringify(recommendations));
    } catch (error) {
      console.error('Failed to save AI data to cache:', error);
    }
  }

  // Behavior Tracking
  public trackUserBehavior(
    userId: string,
    action: string,
    context: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    const behavior: UserBehavior = {
      userId,
      sessionId: this.getSessionId(),
      timestamp: new Date(),
      action,
      context,
      metadata
    };

    this.behaviorQueue.push(behavior);

    // Flush immediately if queue is full
    if (this.behaviorQueue.length >= this.maxQueueSize) {
      this.flushBehaviorData();
    }

    // Update local behavior patterns
    this.updateUserProfile(userId, behavior);
  }

  private async flushBehaviorData(): Promise<void> {
    if (this.behaviorQueue.length === 0) return;

    const behaviors = [...this.behaviorQueue];
    this.behaviorQueue = [];

    try {
      await axios.post(`${this.baseURL}/behavior/track`, {
        behaviors
      });
    } catch (error) {
      console.error('Failed to flush behavior data:', error);
      // Re-add to queue on failure
      this.behaviorQueue.unshift(...behaviors);
    }
  }

  private updateUserProfile(userId: string, behavior: UserBehavior): void {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        preferences: {},
        behaviorPatterns: [],
        interests: [],
        segmentId: 'default',
        lastUpdated: new Date()
      };
    }

    // Update behavior patterns
    const existingPattern = profile.behaviorPatterns.find(p => p.pattern === behavior.action);
    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastOccurrence = behavior.timestamp;
      existingPattern.context = { ...existingPattern.context, ...behavior.context };
    } else {
      profile.behaviorPatterns.push({
        pattern: behavior.action,
        frequency: 1,
        lastOccurrence: behavior.timestamp,
        context: behavior.context
      });
    }

    profile.lastUpdated = new Date();
    this.userProfiles.set(userId, profile);
    this.saveCachedData();
  }

  // AI Recommendations
  public async getRecommendations(
    userId: string,
    context?: Record<string, any>
  ): Promise<AIRecommendation[]> {
    try {
      const response = await axios.post(`${this.baseURL}/recommendations/generate`, {
        userId,
        context,
        userProfile: this.userProfiles.get(userId)
      });

      const recommendations = response.data.recommendations.map((rec: any) => ({
        ...rec,
        createdAt: new Date(rec.createdAt),
        expiresAt: rec.expiresAt ? new Date(rec.expiresAt) : undefined
      }));

      this.recommendations.set(userId, recommendations);
      this.saveCachedData();

      return recommendations;
    } catch (error) {
      console.error('Failed to get AI recommendations:', error);
      return this.recommendations.get(userId) || [];
    }
  }

  public async submitRecommendationFeedback(
    recommendationId: string,
    feedback: Omit<RecommendationFeedback, 'timestamp'>
  ): Promise<void> {
    const fullFeedback: RecommendationFeedback = {
      ...feedback,
      timestamp: new Date()
    };

    try {
      await axios.post(`${this.baseURL}/recommendations/${recommendationId}/feedback`, {
        feedback: fullFeedback
      });

      // Update local recommendations
      for (const [userId, recommendations] of Array.from(this.recommendations.entries())) {
        const rec = recommendations.find(r => r.id === recommendationId);
        if (rec) {
          rec.feedback = fullFeedback;
          this.saveCachedData();
          break;
        }
      }
    } catch (error) {
      console.error('Failed to submit recommendation feedback:', error);
      throw error;
    }
  }

  // Predictive Analytics
  public async predictUserBehavior(
    userId: string,
    timeframe: string = '7d',
    context?: Record<string, any>
  ): Promise<PredictionResult[]> {
    try {
      const response = await axios.post(`${this.baseURL}/predict/behavior`, {
        userId,
        timeframe,
        context,
        userProfile: this.userProfiles.get(userId)
      });

      return response.data.predictions;
    } catch (error) {
      console.error('Failed to get behavior predictions:', error);
      return [];
    }
  }

  public async predictChurnRisk(userId: string): Promise<PredictionResult> {
    try {
      const response = await axios.post(`${this.baseURL}/predict/churn`, {
        userId,
        userProfile: this.userProfiles.get(userId)
      });

      return response.data.prediction;
    } catch (error) {
      console.error('Failed to predict churn risk:', error);
      throw error;
    }
  }

  public async predictLifetimeValue(userId: string): Promise<PredictionResult> {
    try {
      const response = await axios.post(`${this.baseURL}/predict/ltv`, {
        userId,
        userProfile: this.userProfiles.get(userId)
      });

      return response.data.prediction;
    } catch (error) {
      console.error('Failed to predict lifetime value:', error);
      throw error;
    }
  }

  // Personalization
  public async personalizeContent(
    userId: string,
    contentType: string,
    candidates: any[]
  ): Promise<any[]> {
    try {
      const response = await axios.post(`${this.baseURL}/personalize/content`, {
        userId,
        contentType,
        candidates,
        userProfile: this.userProfiles.get(userId)
      });

      return response.data.personalizedContent;
    } catch (error) {
      console.error('Failed to personalize content:', error);
      return candidates; // Return original candidates on error
    }
  }

  public async getPersonalizationInsights(userId: string): Promise<Record<string, any>> {
    try {
      const response = await axios.get(`${this.baseURL}/personalize/insights/${userId}`);
      return response.data.insights;
    } catch (error) {
      console.error('Failed to get personalization insights:', error);
      return {};
    }
  }

  // Utility Methods
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('ai-session-id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('ai-session-id', sessionId);
    }
    return sessionId;
  }

  public getUserProfile(userId: string): UserProfile | undefined {
    return this.userProfiles.get(userId);
  }

  public getCachedRecommendations(userId: string): AIRecommendation[] {
    return this.recommendations.get(userId) || [];
  }

  public clearUserData(userId: string): void {
    this.userProfiles.delete(userId);
    this.recommendations.delete(userId);
    this.saveCachedData();
  }

  // Analytics
  public async getAIAnalytics(timeframe: string = '30d'): Promise<Record<string, any>> {
    try {
      const response = await axios.get(`${this.baseURL}/analytics?timeframe=${timeframe}`);
      return response.data.analytics;
    } catch (error) {
      console.error('Failed to get AI analytics:', error);
      return {};
    }
  }

  public async optimizeRecommendationEngine(): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/optimize/recommendations`);
    } catch (error) {
      console.error('Failed to optimize recommendation engine:', error);
      throw error;
    }
  }
}

export default new AdvancedAiService();