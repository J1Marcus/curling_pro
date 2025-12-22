"""
Test Suite for Everbound Backend

This package contains unit tests, integration tests, and end-to-end tests
for the Everbound backend application.

Test structure:
    tests/schemas/     - Tests for Pydantic schema validation
    tests/core/        - Tests for core business logic and exceptions
    tests/middleware/  - Tests for middleware components (error handling, etc.)
    tests/api/         - Integration tests for API endpoints

Usage:
    pytest tests/                    # Run all tests
    pytest tests/schemas/           # Run schema tests only
    pytest tests/middleware/        # Run middleware tests only
    pytest tests/ -v                # Verbose output
    pytest tests/ --cov=app         # With coverage
"""
