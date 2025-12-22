#!/usr/bin/env python3
"""Verification script to check that ErrorResponse schema appears in OpenAPI documentation.

This script imports the FastAPI app and checks the generated OpenAPI schema
to verify that the ErrorResponse schema is properly exposed.

Usage:
    python scripts/verify_openapi_schema.py

Expected output:
    - ErrorResponse schema should appear in components/schemas
    - Error responses should be defined for common HTTP status codes
"""

import json
import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def verify_openapi_schema():
    """Verify that ErrorResponse schema appears in OpenAPI documentation."""
    # Import the FastAPI app
    from app.main import app

    # Get the OpenAPI schema
    openapi_schema = app.openapi()

    print("=" * 60)
    print("OpenAPI Schema Verification")
    print("=" * 60)

    # Check if ErrorResponse is in the schemas
    schemas = openapi_schema.get("components", {}).get("schemas", {})

    print("\n1. Checking for ErrorResponse schema in components/schemas...")
    if "ErrorResponse" in schemas:
        print("   ✅ ErrorResponse schema found!")
        print("\n   Schema definition:")
        print(json.dumps(schemas["ErrorResponse"], indent=4))
    else:
        print("   ❌ ErrorResponse schema NOT found!")
        print("   Available schemas:", list(schemas.keys()))
        return False

    # Check for error responses in the paths
    print("\n2. Checking for error responses defined at app level...")
    paths = openapi_schema.get("paths", {})

    # Check a sample path for error responses
    if paths:
        sample_path = list(paths.keys())[0]
        sample_methods = paths[sample_path]
        for method, details in sample_methods.items():
            if method in ["get", "post", "put", "delete", "patch"]:
                responses = details.get("responses", {})
                error_codes = [code for code in responses.keys() if code not in ["200", "201", "204"]]
                if error_codes:
                    print(f"   ✅ Error responses defined for {method.upper()} {sample_path}")
                    print(f"      Status codes with responses: {error_codes}")
                break

    # Check for common error status codes
    print("\n3. Checking for common error response definitions...")
    expected_codes = ["400", "401", "403", "404", "422", "500", "503"]

    # FastAPI's responses parameter adds these to all paths
    # Check the first endpoint for these responses
    if paths:
        sample_path = list(paths.keys())[0]
        sample_methods = paths[sample_path]
        for method, details in sample_methods.items():
            if method in ["get", "post", "put", "delete", "patch"]:
                responses = details.get("responses", {})
                for code in expected_codes:
                    if code in responses:
                        print(f"   ✅ {code} response defined")
                    else:
                        print(f"   ⚠️  {code} response not found (may be normal if not applicable)")
                break

    print("\n" + "=" * 60)
    print("Verification Complete!")
    print("=" * 60)

    print("\nTo view the full OpenAPI schema, run the server and visit:")
    print("  - Swagger UI: http://localhost:8000/docs")
    print("  - ReDoc: http://localhost:8000/redoc")
    print("  - OpenAPI JSON: http://localhost:8000/openapi.json")

    return True


if __name__ == "__main__":
    try:
        success = verify_openapi_schema()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error during verification: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
