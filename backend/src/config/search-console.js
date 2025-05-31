const { google } = require('googleapis');

const searchConsoleConfig = {
  siteUrl: process.env.SEARCH_CONSOLE_SITE_URL,
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
};

// Search Console APIクライアントの初期化
const auth = new google.auth.JWT(
  searchConsoleConfig.credentials.client_email,
  null,
  searchConsoleConfig.credentials.private_key,
  searchConsoleConfig.scopes
);

const searchConsole = google.searchconsole({
  version: 'v1',
  auth,
});

module.exports = {
  searchConsoleConfig,
  searchConsole,
};