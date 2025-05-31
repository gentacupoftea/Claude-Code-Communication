#!/bin/bash
# CI/CD Cache Optimization Script

set -e

# Constants
CACHE_VERSION="v2"
MAX_CACHE_SIZE="5G"
CACHE_METRICS_FILE="/tmp/cache-metrics.json"

# Functions
calculate_cache_hit_rate() {
    local cache_dir=$1
    local hits=$(find "$cache_dir" -type f -atime -1 | wc -l)
    local total=$(find "$cache_dir" -type f | wc -l)
    
    if [ $total -eq 0 ]; then
        echo "0"
    else
        echo "scale=2; $hits * 100 / $total" | bc
    fi
}

clean_old_caches() {
    local cache_dir=$1
    local days_old=$2
    
    echo "Cleaning caches older than $days_old days..."
    find "$cache_dir" -type f -atime +$days_old -delete
}

optimize_pip_cache() {
    echo "Optimizing pip cache..."
    
    # Remove duplicate wheels
    pip cache purge
    
    # Pre-download common dependencies
    pip download -r requirements-base.txt -d /tmp/pip-wheels
    pip download -r requirements-test.txt -d /tmp/pip-wheels
    
    # Create cache manifest
    ls -la /tmp/pip-wheels > /tmp/cache-manifest.txt
}

generate_cache_key() {
    local os=$1
    local python_version=$2
    local deps_hash=$(sha256sum requirements*.txt | sha256sum | cut -d' ' -f1)
    
    echo "${CACHE_VERSION}-${os}-py${python_version}-${deps_hash:0:8}"
}

collect_metrics() {
    local cache_stats=$(du -sh ~/.cache/pip 2>/dev/null || echo "0")
    local hit_rate=$(calculate_cache_hit_rate ~/.cache/pip)
    
    cat > "$CACHE_METRICS_FILE" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "cache_size": "$cache_stats",
    "hit_rate": "$hit_rate",
    "version": "$CACHE_VERSION"
}
EOF
}

# Main execution
main() {
    echo "Starting cache optimization..."
    
    # Clean old caches
    clean_old_caches ~/.cache/pip 7
    
    # Optimize caches
    optimize_pip_cache
    
    # Collect metrics
    collect_metrics
    
    # Generate optimized cache key
    CACHE_KEY=$(generate_cache_key "$RUNNER_OS" "$PYTHON_VERSION")
    echo "cache_key=$CACHE_KEY" >> $GITHUB_OUTPUT
    
    echo "Cache optimization complete!"
    cat "$CACHE_METRICS_FILE"
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi