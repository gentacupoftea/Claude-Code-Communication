const fs = require('fs');

// server.jsを読み込み
let serverCode = fs.readFileSync('server.js', 'utf8');

// 新しいルート定義
const newRoutes = `
// Google Analytics Routes
try {
  const googleAnalyticsRoutes = require('./src/routes/google-analytics.routes');
  app.use('/api/google-analytics', googleAnalyticsRoutes);
  console.log('✅ Google Analytics routes loaded');
} catch (error) {
  console.error('⚠️ Failed to load Google Analytics routes:', error.message);
}

// Search Console Routes
try {
  const searchConsoleRoutes = require('./src/routes/search-console.routes');
  app.use('/api/search-console', searchConsoleRoutes);
  console.log('✅ Search Console routes loaded');
} catch (error) {
  console.error('⚠️ Failed to load Search Console routes:', error.message);
}

// スマレジ Routes
try {
  const smaregiRoutes = require('./src/routes/smaregi.routes');
  app.use('/api/smaregi', smaregiRoutes);
  console.log('✅ スマレジ routes loaded');
} catch (error) {
  console.error('⚠️ Failed to load スマレジ routes:', error.message);
}
`;

// Shopify routes の後に挿入
const shopifyRoutesEnd = serverCode.indexOf("console.log('✅ Shopify routes loaded');");
if (shopifyRoutesEnd !== -1) {
  const insertPosition = serverCode.indexOf('\n', shopifyRoutesEnd) + 1;
  serverCode = serverCode.slice(0, insertPosition) + newRoutes + serverCode.slice(insertPosition);
  
  // 書き込み
  fs.writeFileSync('server.js', serverCode);
  console.log('✅ API routes integrated into server.js');
} else {
  console.error('❌ Could not find Shopify routes section');
}