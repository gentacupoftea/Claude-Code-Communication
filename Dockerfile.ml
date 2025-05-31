# Phase 4: ML Training Service Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements-ml.txt ./
RUN pip install --no-cache-dir -r requirements-ml.txt

# Copy training scripts
COPY src/ai/training/ ./src/ai/training/
COPY src/ai/models/ ./src/ai/models/

# Create directories
RUN mkdir -p /app/models /app/data /app/logs

# Set environment
ENV PYTHONUNBUFFERED=1
ENV TF_CPP_MIN_LOG_LEVEL=2

# Default command (can be overridden)
CMD ["python", "-m", "src.ai.training.train_models"]