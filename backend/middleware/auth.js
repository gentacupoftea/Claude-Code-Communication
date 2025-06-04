/**
 * 認証ミドルウェア for Express.js
 * Authentication middleware for Express.js endpoints
 */
const jwt = require('jsonwebtoken');

// Public endpoints that don't require authentication
const PUBLIC_PATHS = [
    '/api/health',
    '/api/health/ready',
    '/api/health/live',
    '/health',
    '/ready',
    '/metrics'
];

/**
 * JWT token verification middleware
 */
const authenticateToken = async (req, res, next) => {
    // Check if path is public
    if (PUBLIC_PATHS.includes(req.path) || PUBLIC_PATHS.some(path => req.path.startsWith(path))) {
        return next();
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please provide a valid authentication token'
        });
    }

    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET not configured');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'Authentication service is not properly configured'
        });
    }

    try {
        // Verify JWT token (jwt.verify automatically checks expiration)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user info to request
        req.user = {
            id: decoded.sub,
            email: decoded.email,
            is_superuser: decoded.is_superuser || false,
            jti: decoded.jti // For blacklist checking if needed
        };
        
        next();
    } catch (error) {
        // Use structured logging in production
        if (process.env.NODE_ENV === 'production') {
            // Log to structured logging service
            console.error(JSON.stringify({
                event: 'jwt_verification_error',
                error: error.name,
                message: error.message,
                timestamp: new Date().toISOString()
            }));
        } else {
            console.error('JWT verification error:', error.message);
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your authentication token has expired. Please login again.'
            });
        }
        
        return res.status(403).json({
            error: 'Invalid token',
            message: 'The provided authentication token is invalid.'
        });
    }
};

/**
 * API Key authentication middleware
 */
const authenticateApiKey = async (req, res, next) => {
    // Check if path is public (use same logic as authenticateToken)
    if (PUBLIC_PATHS.includes(req.path) || PUBLIC_PATHS.some(path => req.path.startsWith(path))) {
        return next();
    }

    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({
            error: 'API key required',
            message: 'Please provide a valid API key'
        });
    }

    try {
        // TODO: Implement actual API key verification against database
        // For now, this is a placeholder
        
        // Example verification (replace with actual implementation):
        // const validApiKey = await verifyApiKeyInDatabase(apiKey);
        // if (!validApiKey) {
        //     throw new Error('Invalid API key');
        // }
        
        // Attach API key info to request
        req.apiKey = {
            key: apiKey,
            // Add other relevant info from database
        };
        
        next();
    } catch (error) {
        console.error('API key verification error:', error.message);
        return res.status(403).json({
            error: 'Invalid API key',
            message: 'The provided API key is invalid or has been revoked.'
        });
    }
};

/**
 * Combined authentication middleware (JWT or API Key)
 */
const authenticate = async (req, res, next) => {
    // Try JWT first
    const authHeader = req.headers.authorization;
    const hasJWT = authHeader && authHeader.startsWith('Bearer ');
    
    // Try API key second
    const hasApiKey = req.headers['x-api-key'];
    
    if (hasJWT) {
        return authenticateToken(req, res, next);
    } else if (hasApiKey) {
        return authenticateApiKey(req, res, next);
    } else {
        // Check if path is public
        if (PUBLIC_PATHS.includes(req.path) || PUBLIC_PATHS.some(path => req.path.startsWith(path))) {
            return next();
        }
        
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please provide a valid JWT token or API key'
        });
    }
};

/**
 * Role-based access control middleware
 */
const requireRole = (requiredRole) => {
    return (req, res, next) => {
        // Ensure user is authenticated
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please authenticate before accessing this resource'
            });
        }
        
        // Check role (simplified - expand based on actual role system)
        if (requiredRole === 'admin' && !req.user.is_superuser) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                message: 'This resource requires admin privileges'
            });
        }
        
        next();
    };
};

module.exports = {
    authenticateToken,
    authenticateApiKey,
    authenticate,
    requireRole
};