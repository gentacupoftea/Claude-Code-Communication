"""
改善された認証ミドルウェア実装
Improved authentication middleware implementation
"""
import time
import logging
from typing import Callable, List, Optional
from uuid import uuid4
from datetime import datetime

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .security import JWTManager, InvalidTokenError
from .config import get_auth_settings

logger = logging.getLogger(__name__)


class ProperAuthenticationMiddleware(BaseHTTPMiddleware):
    """Middleware that actually handles authentication with path exclusion"""
    
    # Default public endpoints that don't require authentication
    DEFAULT_PUBLIC_PATHS = [
        "/health",
        "/api/v1/auth/login",
        "/api/v1/auth/register", 
        "/api/v1/auth/verify-email",
        "/api/v1/auth/resend-verification",
        "/api/v1/auth/password-reset/request",
        "/api/v1/auth/password-reset/verify",
        "/api/v1/auth/password-reset/confirm",
        "/api/v1/auth/refresh",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico"
    ]
    
    def __init__(self, app, jwt_manager: JWTManager, public_paths: Optional[List[str]] = None):
        super().__init__(app)
        self.jwt_manager = jwt_manager
        self.public_paths = public_paths or self.DEFAULT_PUBLIC_PATHS
    
    def is_public_path(self, path: str) -> bool:
        """Check if the path is public and doesn't require authentication"""
        # Exact match
        if path in self.public_paths:
            return True
        
        # Wildcard match only (not general prefix match)
        for public_path in self.public_paths:
            if public_path.endswith("*"):
                # Wildcard path - check prefix
                if path.startswith(public_path[:-1]):
                    return True
            # Remove general startswith to prevent unintended matches
        
        return False
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Add request ID for tracking
        request_id = str(uuid4())
        request.state.request_id = request_id
        
        # Skip authentication for public endpoints
        if self.is_public_path(request.url.path):
            logger.debug(f"Request {request_id}: Public path {request.url.path}")
            return await call_next(request)
        
        # Skip authentication for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        api_key = request.headers.get("X-API-Key")
        
        # Try Bearer token first
        if auth_header and auth_header.startswith("Bearer "):
            try:
                # Extract token more robustly
                token = auth_header[7:].strip()  # Skip "Bearer " and strip whitespace
                if not token:
                    raise InvalidTokenError("Empty token")
                
                # Verify token and get user info
                payload = self.jwt_manager.verify_token(token)
                
                # Check if token is blacklisted (if blacklist service available)
                # TODO: Implement blacklist check
                
                # Set user context in request state
                request.state.user_id = payload.get("sub")
                request.state.user_email = payload.get("email")
                request.state.is_superuser = payload.get("is_superuser", False)
                request.state.auth_type = "jwt"
                request.state.token_jti = payload.get("jti")
                
                logger.debug(f"Request {request_id}: Authenticated user {request.state.user_id} via JWT")
                
            except InvalidTokenError as e:
                logger.warning(f"Request {request_id}: Invalid JWT token - {str(e)}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or expired token"},
                    headers={"WWW-Authenticate": "Bearer"}
                )
            except Exception as e:
                logger.error(f"Request {request_id}: JWT verification error - {str(e)}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication failed"},
                    headers={"WWW-Authenticate": "Bearer"}
                )
        
        # Try API key if no valid JWT
        elif api_key:
            # TODO: Implement API key verification
            # For now, reject API key authentication at middleware level
            # API keys should be handled by specific endpoints
            logger.warning(f"Request {request_id}: API key authentication attempted at middleware level")
            return JSONResponse(
                status_code=401,
                content={"detail": "API key authentication not supported for this endpoint"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # No authentication provided
        else:
            logger.warning(f"Request {request_id}: No authentication credentials provided")
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Process authenticated request
        return await call_next(request)


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware for request tracking and logging (renamed from AuthenticationMiddleware)"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get or create request ID
        request_id = getattr(request.state, 'request_id', str(uuid4()))
        if not hasattr(request.state, 'request_id'):
            request.state.request_id = request_id
        
        # Track request time
        start_time = time.time()
        
        # Log request
        logger.info(f"Request {request_id}: {request.method} {request.url.path}")
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)
        
        # Log response
        logger.info(f"Response {request_id}: status={response.status_code} time={process_time:.3f}s")
        
        return response


class EnhancedSecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware for adding enhanced security headers"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        
        # HSTS (HTTP Strict Transport Security)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://api.conea.ai wss://api.conea.ai"
        )
        
        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )
        
        return response


class WebhookAuthMiddleware(BaseHTTPMiddleware):
    """Special authentication for webhook endpoints"""
    
    WEBHOOK_PATHS = [
        "/api/v1/shopify/webhooks/",
        "/api/v1/stripe/webhooks/"
    ]
    
    def __init__(self, app, webhook_secrets: dict):
        super().__init__(app)
        self.webhook_secrets = webhook_secrets  # {"shopify": "secret", "stripe": "secret"}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        
        # Only process webhook paths
        if not any(path.startswith(webhook_path) for webhook_path in self.WEBHOOK_PATHS):
            return await call_next(request)
        
        # Determine webhook provider
        if "/shopify/" in path:
            provider = "shopify"
            signature_header = "X-Shopify-Hmac-Sha256"
        elif "/stripe/" in path:
            provider = "stripe"
            signature_header = "Stripe-Signature"
        else:
            return JSONResponse(status_code=400, content={"detail": "Unknown webhook provider"})
        
        # Get signature
        signature = request.headers.get(signature_header)
        if not signature:
            logger.warning(f"Webhook request without signature for {provider}")
            return JSONResponse(status_code=401, content={"detail": "Missing webhook signature"})
        
        # Verify signature (simplified - implement provider-specific verification)
        # TODO: Implement actual HMAC verification for each provider
        request.state.webhook_provider = provider
        request.state.webhook_signature = signature
        
        # Continue processing
        return await call_next(request)


class CORSMiddleware(BaseHTTPMiddleware):
    """Enhanced CORS middleware with proper security"""
    
    def __init__(self, app, allowed_origins: List[str] = None):
        super().__init__(app)
        self.allowed_origins = allowed_origins or ["http://localhost:3000", "http://localhost:3001"]
        
        # Define allowed methods and headers explicitly for production
        self.allowed_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
        self.allowed_headers = [
            "Authorization",
            "Content-Type", 
            "X-API-Key",
            "X-Request-ID",
            "Accept",
            "Origin",
            "X-Requested-With"
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response()
            response.headers["Access-Control-Allow-Origin"] = self._get_allowed_origin(request)
            response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allowed_methods)
            response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allowed_headers)
            response.headers["Access-Control-Max-Age"] = "86400"  # 24 hours
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
        
        # Process regular requests
        response = await call_next(request)
        
        # Add CORS headers
        origin = self._get_allowed_origin(request)
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
        
        return response
    
    def _get_allowed_origin(self, request: Request) -> str:
        """Get allowed origin based on request"""
        origin = request.headers.get("origin")
        
        # Check if origin is in allowed list
        if origin in self.allowed_origins:
            return origin
        
        # For production, be strict - no wildcard
        return ""