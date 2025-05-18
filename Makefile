# Shopify MCP Server Makefile

.PHONY: help install test test-ga clean docker-build docker-run lint format docs

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       Install all dependencies"
	@echo "  make install-ga    Install Google Analytics dependencies"
	@echo "  make test         Run all tests"
	@echo "  make test-ga      Run Google Analytics tests"
	@echo "  make lint         Run linters"
	@echo "  make format       Format code"
	@echo "  make clean        Clean cache and temp files"
	@echo "  make docker-ga    Build and run GA Docker container"
	@echo "  make docs         Build documentation"

# Install dependencies
install:
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

install-ga:
	pip install -r requirements-ga.txt

# Testing
test:
	python -m pytest tests/ -v --cov=src --cov-report=html

test-ga:
	python -m pytest tests/test_google_analytics/ -v --cov=src/google_analytics --cov-report=html

test-integration:
	python -m pytest tests/integration/ -v

# Code quality
lint:
	flake8 src/ tests/
	mypy src/ --ignore-missing-imports
	pylint src/

format:
	black src/ tests/
	isort src/ tests/

# Docker
docker-ga:
	docker-compose -f docker-compose.ga.yml up --build

docker-down:
	docker-compose -f docker-compose.ga.yml down

# Clean
clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name ".pytest_cache" -rm -rf
	find . -name ".coverage" -delete
	rm -rf htmlcov/
	rm -rf .mypy_cache/

# Documentation
docs:
	cd docs && make html

# Development
dev-ga:
	uvicorn src.google_analytics.main:app --reload --host 0.0.0.0 --port 8000

# Production
prod-ga:
	gunicorn src.google_analytics.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000