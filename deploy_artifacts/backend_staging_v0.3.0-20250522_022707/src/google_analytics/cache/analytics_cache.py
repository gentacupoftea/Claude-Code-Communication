"""Google Analytics cache management using Redis."""
import json
import hashlib
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta
import redis
from redis import Redis

from ..config import RedisConfig
from ..models import GoogleAnalyticsReport, RealtimeReport


class AnalyticsCache:
    """Cache manager for Google Analytics data."""
    
    # TTL settings in minutes
    TTL_REALTIME = 5  # 5 minutes for realtime data
    TTL_DAILY = 60   # 1 hour for daily reports
    TTL_WEEKLY = 360  # 6 hours for weekly reports
    TTL_MONTHLY = 720  # 12 hours for monthly reports
    
    def __init__(self, redis_config: RedisConfig):
        """Initialize cache manager."""
        self.redis_config = redis_config
        self._redis_client: Optional[Redis] = None
    
    @property
    def redis(self) -> Redis:
        """Get Redis client."""
        if self._redis_client is None:
            self._redis_client = redis.Redis(
                host=self.redis_config.host,
                port=self.redis_config.port,
                db=self.redis_config.db,
                password=self.redis_config.password,
                decode_responses=True
            )
        return self._redis_client
    
    def _generate_cache_key(
        self, 
        report_type: str, 
        property_id: str,
        params: Dict[str, Any]
    ) -> str:
        """Generate cache key for reports."""
        # Create a deterministic key from parameters
        param_str = json.dumps(params, sort_keys=True)
        param_hash = hashlib.md5(param_str.encode()).hexdigest()
        return f"ga:{report_type}:{property_id}:{param_hash}"
    
    def _determine_ttl(self, report_type: str, params: Dict[str, Any]) -> int:
        """Determine TTL based on report type and parameters."""
        if report_type == "realtime":
            return self.TTL_REALTIME
        
        # For standard reports, check date range
        date_range = params.get("dateRange", {})
        start_date = date_range.get("startDate")
        end_date = date_range.get("endDate")
        
        # If no date range specified, use default TTL
        if not start_date or not end_date:
            return self.TTL_DAILY
        
        # Calculate date range duration
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
            duration = (end - start).days
            
            if duration <= 1:
                return self.TTL_DAILY
            elif duration <= 7:
                return self.TTL_WEEKLY
            else:
                return self.TTL_MONTHLY
        except ValueError:
            return self.TTL_DAILY
    
    def get_report(
        self, 
        property_id: str,
        report_type: str,
        params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Get cached report data."""
        cache_key = self._generate_cache_key(report_type, property_id, params)
        
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            # Log but don't fail if cache is unavailable
            print(f"Cache retrieval error: {e}")
        
        return None
    
    def set_report(
        self,
        property_id: str,
        report_type: str,
        params: Dict[str, Any],
        data: Dict[str, Any],
        custom_ttl: Optional[int] = None
    ) -> bool:
        """Cache report data with intelligent TTL."""
        cache_key = self._generate_cache_key(report_type, property_id, params)
        
        # Use custom TTL or determine based on report type
        ttl_minutes = custom_ttl or self._determine_ttl(report_type, params)
        
        try:
            self.redis.setex(
                cache_key,
                ttl_minutes * 60,  # Convert to seconds
                json.dumps(data)
            )
            
            # Update cache metadata
            self._update_cache_metadata(property_id, report_type, cache_key)
            return True
        except Exception as e:
            # Log but don't fail if cache is unavailable
            print(f"Cache storage error: {e}")
            return False
    
    def _update_cache_metadata(
        self, 
        property_id: str, 
        report_type: str, 
        cache_key: str
    ) -> None:
        """Update cache metadata for monitoring."""
        metadata_key = f"ga:metadata:{property_id}"
        metadata = {
            "last_cached": datetime.utcnow().isoformat(),
            "report_type": report_type,
            "cache_key": cache_key
        }
        
        try:
            # Store metadata with extended TTL
            self.redis.hset(metadata_key, cache_key, json.dumps(metadata))
            self.redis.expire(metadata_key, 86400)  # 24 hours
        except Exception:
            pass
    
    def invalidate_property_cache(self, property_id: str) -> int:
        """Invalidate all cache entries for a property."""
        pattern = f"ga:*:{property_id}:*"
        deleted_count = 0
        
        try:
            # Use SCAN to find matching keys
            for key in self.redis.scan_iter(match=pattern):
                self.redis.delete(key)
                deleted_count += 1
            
            # Also clean up metadata
            metadata_key = f"ga:metadata:{property_id}"
            self.redis.delete(metadata_key)
        except Exception as e:
            print(f"Cache invalidation error: {e}")
        
        return deleted_count
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            info = self.redis.info()
            keyspace_hits = info.get("keyspace_hits", 0)
            keyspace_misses = info.get("keyspace_misses", 0)
            total_requests = keyspace_hits + keyspace_misses
            
            return {
                "connected": True,
                "used_memory": info.get("used_memory_human"),
                "total_keys": self.redis.dbsize(),
                "keyspace_hits": keyspace_hits,
                "keyspace_misses": keyspace_misses,
                "hit_rate": keyspace_hits / max(total_requests, 1)
            }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e)
            }
    
    def cleanup_expired_keys(self, pattern: str = "ga:*") -> int:
        """Clean up expired keys matching pattern."""
        cleaned_count = 0
        
        try:
            for key in self.redis.scan_iter(match=pattern):
                # Check if key has TTL
                ttl = self.redis.ttl(key)
                if ttl == -2:  # Key does not exist
                    continue
                elif ttl == -1:  # Key exists but has no TTL
                    # Set a default TTL to prevent memory bloat
                    self.redis.expire(key, 3600)  # 1 hour
                    cleaned_count += 1
        except Exception as e:
            print(f"Cleanup error: {e}")
        
        return cleaned_count