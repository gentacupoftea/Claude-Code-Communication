/**
 * Mock data utility for development
 */

export const mockDashboardMetrics = {
  totalSales: 12567890,
  totalOrders: 489,
  averageOrderValue: 25730,
  conversionRate: 3.4,
  customerCount: 1234,
  productCount: 567,
};

export const mockChartData = {
  salesChart: [
    { date: '2024-05-01', amount: 4500000, orders: 45 },
    { date: '2024-05-02', amount: 3800000, orders: 38 },
    { date: '2024-05-03', amount: 5200000, orders: 52 },
    { date: '2024-05-04', amount: 6100000, orders: 61 },
    { date: '2024-05-05', amount: 4900000, orders: 49 },
    { date: '2024-05-06', amount: 5600000, orders: 56 },
    { date: '2024-05-07', amount: 7200000, orders: 72 },
  ],
  categoryChart: [
    { category: '衣類', value: 45 },
    { category: '電子機器', value: 30 },
    { category: '食品', value: 15 },
    { category: 'その他', value: 10 },
  ],
};

export const mockOrders = [
  {
    id: '1001',
    orderNumber: '#ORD-2024-1001',
    customer: {
      name: '田中 太郎',
      email: 'tanaka@example.com',
      avatar: 'https://i.pravatar.cc/150?img=1',
    },
    createdAt: new Date('2024-05-07T10:30:00'),
    status: 'delivered' as const,
    totalAmount: 45000,
    items: [
      { id: '1', name: 'ワイヤレスイヤホン', quantity: 1, price: 25000 },
      { id: '2', name: 'スマホケース', quantity: 2, price: 10000 },
    ],
    platform: 'shopify' as const,
    currency: 'JPY',
    paymentMethod: 'credit_card',
    shippingAddress: {
      line1: '東京都渋谷区渋谷1-1-1',
      city: '渋谷区',
      state: '東京都',
      postalCode: '150-0002',
      country: 'JP',
    },
  },
  {
    id: '1002',
    orderNumber: '#ORD-2024-1002',
    customer: {
      name: '佐藤 花子',
      email: 'sato@example.com',
      avatar: 'https://i.pravatar.cc/150?img=2',
    },
    createdAt: new Date('2024-05-07T09:15:00'),
    status: 'processing' as const,
    totalAmount: 32000,
    items: [
      { id: '3', name: 'スマートウォッチ', quantity: 1, price: 32000 },
    ],
    platform: 'rakuten' as const,
    currency: 'JPY',
    paymentMethod: 'bank_transfer',
    shippingAddress: {
      line1: '大阪府大阪市中央区本町2-2-2',
      city: '大阪市',
      state: '大阪府',
      postalCode: '541-0053',
      country: 'JP',
    },
  },
  {
    id: '1003',
    orderNumber: '#ORD-2024-1003',
    customer: {
      name: '鈴木 一郎',
      email: 'suzuki@example.com',
      avatar: 'https://i.pravatar.cc/150?img=3',
    },
    createdAt: new Date('2024-05-06T16:45:00'),
    status: 'pending' as const,
    totalAmount: 18500,
    items: [
      { id: '4', name: 'Bluetoothスピーカー', quantity: 1, price: 18500 },
    ],
    platform: 'amazon' as const,
    currency: 'JPY',
    paymentMethod: 'convenience_store',
    shippingAddress: {
      line1: '福岡県福岡市博多区博多駅前3-3-3',
      city: '福岡市',
      state: '福岡県',
      postalCode: '812-0011',
      country: 'JP',
    },
  },
];

export const mockCustomers = [
  {
    id: '1',
    name: '田中 太郎',
    email: 'tanaka@example.com',
    avatar: 'https://i.pravatar.cc/150?img=1',
    phone: '090-1234-5678',
    registeredAt: new Date('2023-01-15'),
    lastOrderAt: new Date('2024-05-07'),
    totalOrders: 24,
    totalSpent: 580000,
    status: 'active' as const,
    tags: ['VIP', 'リピーター'],
    address: {
      line1: '東京都渋谷区渋谷1-1-1',
      city: '渋谷区',
      state: '東京都',
      postalCode: '150-0002',
      country: 'JP',
    },
  },
  {
    id: '2',
    name: '佐藤 花子',
    email: 'sato@example.com',
    avatar: 'https://i.pravatar.cc/150?img=2',
    phone: '080-2345-6789',
    registeredAt: new Date('2023-03-20'),
    lastOrderAt: new Date('2024-05-07'),
    totalOrders: 15,
    totalSpent: 320000,
    status: 'active' as const,
    tags: ['新規'],
    address: {
      line1: '大阪府大阪市中央区本町2-2-2',
      city: '大阪市',
      state: '大阪府',
      postalCode: '541-0053',
      country: 'JP',
    },
  },
  {
    id: '3',
    name: '鈴木 一郎',
    email: 'suzuki@example.com',
    avatar: 'https://i.pravatar.cc/150?img=3',
    phone: '070-3456-7890',
    registeredAt: new Date('2023-06-10'),
    lastOrderAt: new Date('2024-05-06'),
    totalOrders: 8,
    totalSpent: 185000,
    status: 'active' as const,
    tags: ['要フォロー'],
    address: {
      line1: '福岡県福岡市博多区博多駅前3-3-3',
      city: '福岡市',
      state: '福岡県',
      postalCode: '812-0011',
      country: 'JP',
    },
  },
];

export const mockProducts = [
  {
    id: '1',
    name: 'ワイヤレスイヤホン Pro',
    sku: 'WEP-001',
    price: 25000,
    cost: 12000,
    stock: 145,
    category: '電子機器',
    image: 'https://picsum.photos/200/200?random=1',
    sales: 89,
    revenue: 2225000,
    platform: ['shopify', 'rakuten', 'amazon'],
  },
  {
    id: '2',
    name: 'スマートウォッチ X',
    sku: 'SW-001',
    price: 32000,
    cost: 18000,
    stock: 67,
    category: '電子機器',
    image: 'https://picsum.photos/200/200?random=2',
    sales: 45,
    revenue: 1440000,
    platform: ['shopify', 'amazon'],
  },
  {
    id: '3',
    name: 'プレミアムヘッドホン',
    sku: 'PH-001',
    price: 45000,
    cost: 25000,
    stock: 23,
    category: '電子機器',
    image: 'https://picsum.photos/200/200?random=3',
    sales: 28,
    revenue: 1260000,
    platform: ['shopify'],
  },
];

export const mockNotifications = [
  {
    id: '1',
    title: '新規注文',
    message: '田中太郎様から新しい注文が入りました',
    type: 'order' as const,
    read: false,
    createdAt: new Date('2024-05-07T10:30:00'),
    url: '/orders/1001',
  },
  {
    id: '2',
    title: '在庫アラート',
    message: 'ワイヤレスイヤホン Proの在庫が少なくなっています',
    type: 'inventory' as const,
    read: false,
    createdAt: new Date('2024-05-07T09:00:00'),
    url: '/products/1',
  },
  {
    id: '3',
    title: 'システム更新',
    message: 'システムのアップデートが完了しました',
    type: 'system' as const,
    read: true,
    createdAt: new Date('2024-05-06T18:00:00'),
  },
];

export const mockAnalyticsData = {
  traffic: {
    visitors: 15234,
    pageViews: 45678,
    bounceRate: 42.3,
    avgSessionDuration: 245,
  },
  conversion: {
    rate: 3.4,
    transactions: 234,
    revenue: 5678900,
    avgOrderValue: 24270,
  },
  topPages: [
    { page: '/products/wireless-earbuds', views: 5432, conversion: 4.2 },
    { page: '/products/smart-watch', views: 4321, conversion: 3.8 },
    { page: '/category/electronics', views: 3456, conversion: 2.9 },
  ],
  topProducts: [
    { name: 'ワイヤレスイヤホン Pro', sales: 89, revenue: 2225000 },
    { name: 'スマートウォッチ X', sales: 45, revenue: 1440000 },
    { name: 'プレミアムヘッドホン', sales: 28, revenue: 1260000 },
  ],
};

export const mockReports = [
  {
    id: '1',
    name: '月次売上レポート - 2024年4月',
    type: 'sales' as const,
    createdAt: new Date('2024-05-01'),
    status: 'completed' as const,
    size: '2.4MB',
    url: '/reports/monthly-sales-202404.pdf',
  },
  {
    id: '2',
    name: '在庫レポート - 2024年5月7日',
    type: 'inventory' as const,
    createdAt: new Date('2024-05-07'),
    status: 'processing' as const,
    size: '-',
    url: null,
  },
  {
    id: '3',
    name: '顧客分析レポート - Q1 2024',
    type: 'customer' as const,
    createdAt: new Date('2024-04-15'),
    status: 'completed' as const,
    size: '3.8MB',
    url: '/reports/customer-analysis-q1-2024.pdf',
  },
];

export const mockChatMessages = [
  {
    id: '1',
    user: {
      name: '田中 太郎',
      avatar: 'https://i.pravatar.cc/150?img=1',
    },
    message: '商品の在庫状況を教えてください',
    timestamp: new Date('2024-05-07T10:30:00'),
    type: 'user' as const,
  },
  {
    id: '2',
    user: {
      name: 'AI Assistant',
      avatar: '/ai-avatar.png',
    },
    message: '現在の在庫状況をお調べします。ワイヤレスイヤホン Proは145個、スマートウォッチ Xは67個の在庫があります。',
    timestamp: new Date('2024-05-07T10:30:30'),
    type: 'assistant' as const,
  },
  {
    id: '3',
    user: {
      name: '田中 太郎',
      avatar: 'https://i.pravatar.cc/150?img=1',
    },
    message: '先月の売上データを見せてください',
    timestamp: new Date('2024-05-07T10:31:00'),
    type: 'user' as const,
  },
  {
    id: '4',
    user: {
      name: 'AI Assistant',
      avatar: '/ai-avatar.png',
    },
    message: '4月の売上データをお見せします。総売上は￥12,567,890、注文数は489件、平均注文額は￥25,730でした。',
    timestamp: new Date('2024-05-07T10:31:30'),
    type: 'assistant' as const,
    attachments: [
      {
        type: 'chart',
        title: '月次売上推移',
        data: mockChartData.salesChart,
      },
    ],
  },
];

export default {
  dashboard: {
    metrics: mockDashboardMetrics,
    chartData: mockChartData,
  },
  orders: mockOrders,
  customers: mockCustomers,
  products: mockProducts,
  notifications: mockNotifications,
  analytics: mockAnalyticsData,
  reports: mockReports,
  chat: mockChatMessages,
};