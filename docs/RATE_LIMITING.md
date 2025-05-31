# Shopify API Rate Limiting

The Shopify MCP Server includes adaptive rate limiting features to prevent API rate limit errors and ensure smooth operation when interacting with the Shopify API.

## Overview

Starting with v0.2.1, the server includes:

- Automatic request throttling
- Smart exponential backoff for retries
- Rate limit header monitoring
- Configurable limits via environment variables
- Statistics tracking

## Configuration

Rate limiting can be configured via environment variables in your `.env` file:

```
# Enable/disable rate limiting (default: true)
RATE_LIMIT_ENABLED=true

# Requests per second (default: 2.0)
SHOPIFY_RATE_LIMIT_RPS=2.0

# Maximum burst size (default: 10)
SHOPIFY_RATE_LIMIT_BURST=10

# Enable detailed logging (default: true)
SHOPIFY_RATE_LIMIT_LOG=true
```

## How It Works

1. **Request Throttling**: The rate limiter ensures requests don't exceed the configured rate (default: 2 requests per second)
2. **Burst Handling**: Short bursts of requests are allowed up to the configured limit (default: 10)
3. **Backoff Mechanism**: If rate limits are hit, the system automatically implements exponential backoff
4. **Header Monitoring**: Response headers from Shopify API are analyzed to adjust limits dynamically
5. **Automatic Retries**: Requests that hit rate limits are automatically retried with appropriate delays

## Monitoring Rate Limits

You can monitor the current rate limit status using the `get_rate_limit_stats` MCP tool, which provides:

- Total request count
- Throttled request count and percentage
- Current backoff time
- Recent requests per second
- Maximum configured requests per second

Example output:

```
# Shopify API レート制限状況

| 指標 | 値 |
|---|---|
| 総リクエスト数 | 1250 |
| スロットル（制限）されたリクエスト | 42 |
| スロットル率 | 3.4% |
| 現在のバックオフ時間 | 0.25秒 |
| 連続スロットル数 | 0 |
| 平均再試行回数 | 0.1 |
| 直近の毎秒リクエスト数 | 1.8 |
| 設定された最大毎秒リクエスト数 | 2.0 |
```

## Headers and Response Codes

The system monitors Shopify API response headers:

- `X-Shopify-Shop-Api-Call-Limit`: Shows current API usage (e.g., "39/40")
- HTTP 429 responses: "Too Many Requests" error when rate limits are exceeded

When a 429 status code is received, the system automatically:
1. Logs the rate limit error
2. Increases the backoff time
3. Retries the request after an appropriate delay (up to 3 retries by default)

## Best Practices

1. **Monitor Usage**: Regularly check `get_rate_limit_stats` during development
2. **Adjust Limits**: If you consistently hit rate limits, reduce `SHOPIFY_RATE_LIMIT_RPS`
3. **Enable Logging**: Keep `SHOPIFY_RATE_LIMIT_LOG=true` to track rate limit events
4. **Batch Requests**: For multiple operations, use batch requests where possible
5. **Consider GraphQL**: Use GraphQL for complex queries to reduce the number of API calls

## Troubleshooting

If you're experiencing rate limit issues:

1. **Check Logs**: Look for "Rate limit exceeded" or "Shopify API Rate Limit Warning" messages
2. **Reduce Concurrency**: Lower the `SHOPIFY_RATE_LIMIT_RPS` value (e.g., to 1.0)
3. **Increase Backoff**: If you have custom retry logic, ensure sufficient delays between retries
4. **Verify Credentials**: Ensure your Shopify API access token has the required permissions
5. **Contact Shopify**: For persistent issues, you may need to request higher rate limits from Shopify

## Technical Details

The rate limiting is implemented in:
- `utils.py`: Contains the `RateLimiter` class
- `shopify_mcp_server.py`: Integrates rate limiting with the Shopify API client

The implementation uses:
- Thread-safe locking mechanism
- Deque for tracking recent request history
- Adaptive backoff that increases with consecutive throttling events
- Request-per-second and burst limiting