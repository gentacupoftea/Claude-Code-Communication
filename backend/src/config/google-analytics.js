const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const googleAnalyticsConfig = {
  propertyId: process.env.GA4_PROPERTY_ID,
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
};

// GA4 Data APIクライアントの初期化
const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: googleAnalyticsConfig.credentials,
});

module.exports = {
  googleAnalyticsConfig,
  analyticsDataClient,
};