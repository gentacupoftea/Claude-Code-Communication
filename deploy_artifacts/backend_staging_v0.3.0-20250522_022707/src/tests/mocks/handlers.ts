import { rest, graphql } from 'msw';
import { 
  mockShopData, 
  mockProductsData, 
  mockOrdersData,
  mockAuthResponse,
  mockErrorResponse,
  mockDashboardData
} from './apiMocks';

const apiBaseUrl = 'https://api.test.com';
const shopifyGraphqlUrl = 'https://test-shop.myshopify.com/admin/api/2023-10/graphql.json';

export const handlers = [
  // Auth handlers
  rest.post(`${apiBaseUrl}/auth/token`, (req, res, ctx) => {
    const { code, shop } = req.body as any;
    
    if (code && shop) {
      return res(
        ctx.status(200),
        ctx.json(mockAuthResponse)
      );
    }
    
    return res(
      ctx.status(401),
      ctx.json(mockErrorResponse)
    );
  }),
  
  rest.post(`${apiBaseUrl}/auth/refresh`, (req, res, ctx) => {
    const { refreshToken } = req.body as any;
    
    if (refreshToken === 'test-refresh-token') {
      return res(
        ctx.status(200),
        ctx.json({
          ...mockAuthResponse,
          accessToken: 'new-access-token'
        })
      );
    }
    
    return res(
      ctx.status(401),
      ctx.json(mockErrorResponse)
    );
  }),
  
  // Dashboard data
  rest.get(`${apiBaseUrl}/dashboard/summary`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && authHeader.includes('Bearer test-access-token')) {
      return res(
        ctx.status(200),
        ctx.json(mockDashboardData)
      );
    }
    
    return res(
      ctx.status(401),
      ctx.json(mockErrorResponse)
    );
  }),
  
  // Shopify GraphQL API
  graphql.query('GetShopInfo', (req, res, ctx) => {
    const authHeader = req.headers.get('X-Shopify-Access-Token');
    
    if (authHeader && authHeader === 'test-access-token') {
      return res(
        ctx.data(mockShopData)
      );
    }
    
    return res(
      ctx.errors([
        {
          message: 'Unauthorized access',
          locations: [{ line: 1, column: 1 }],
          path: ['shop']
        }
      ])
    );
  }),
  
  graphql.query('GetProducts', (req, res, ctx) => {
    const authHeader = req.headers.get('X-Shopify-Access-Token');
    
    if (authHeader && authHeader === 'test-access-token') {
      return res(
        ctx.data(mockProductsData)
      );
    }
    
    return res(
      ctx.errors([
        {
          message: 'Unauthorized access',
          locations: [{ line: 1, column: 1 }],
          path: ['products']
        }
      ])
    );
  }),
  
  graphql.query('GetOrders', (req, res, ctx) => {
    const authHeader = req.headers.get('X-Shopify-Access-Token');
    
    if (authHeader && authHeader === 'test-access-token') {
      return res(
        ctx.data(mockOrdersData)
      );
    }
    
    return res(
      ctx.errors([
        {
          message: 'Unauthorized access',
          locations: [{ line: 1, column: 1 }],
          path: ['orders']
        }
      ])
    );
  })
];