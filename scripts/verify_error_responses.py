#!/usr/bin/env python3
"""Manual verification script for error handling middleware.

This script tests all error response scenarios via HTTP requests and verifies
that the responses match the expected ErrorResponse schema format.

Usage:
    1. Start the server: uvicorn app.main:app --reload --port 8000
    2. Run this script: python scripts/verify_error_responses.py

All error responses should follow this JSON format:
    {
        "status_code": <int>,
        "error_type": "<string>",
        "message": "<string>",
        "detail": "<string or null>",
        "request_id": "<string or null>"
    }
"""

import json
import sys

import httpx

# Base URL for the API
BASE_URL = "http://localhost:8000"

# ANSI colors for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"


def print_header(text: str) -> None:
    """Print a formatted header."""
    print(f"\n{BOLD}{BLUE}{'=' * 60}{RESET}")
    print(f"{BOLD}{BLUE}{text}{RESET}")
    print(f"{BOLD}{BLUE}{'=' * 60}{RESET}")


def print_test(name: str, passed: bool, message: str = "") -> None:
    """Print test result with color."""
    status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    print(f"  [{status}] {name}")
    if message and not passed:
        print(f"         {YELLOW}{message}{RESET}")


def validate_error_response(
    response: httpx.Response,
    expected_status_code: int,
    expected_error_type: str,
    check_message: bool = True,
) -> tuple[bool, str]:
    """Validate that a response matches the ErrorResponse schema.

    Args:
        response: The HTTP response to validate.
        expected_status_code: The expected HTTP status code.
        expected_error_type: The expected error_type field value.
        check_message: Whether to check that message is non-empty.

    Returns:
        Tuple of (passed, error_message).
    """
    # Check status code
    if response.status_code != expected_status_code:
        return False, f"Status code: got {response.status_code}, expected {expected_status_code}"

    # Parse JSON body
    try:
        body = response.json()
    except json.JSONDecodeError:
        return False, f"Response is not valid JSON: {response.text[:100]}"

    # Validate required fields
    required_fields = ["status_code", "error_type", "message"]
    for field in required_fields:
        if field not in body:
            return False, f"Missing required field: {field}"

    # Validate optional fields are present (can be null)
    optional_fields = ["detail", "request_id"]
    for field in optional_fields:
        if field not in body:
            return False, f"Missing optional field: {field}"

    # Validate field values
    if body["status_code"] != expected_status_code:
        return False, f"Body status_code: got {body['status_code']}, expected {expected_status_code}"

    if body["error_type"] != expected_error_type:
        return False, f"error_type: got {body['error_type']}, expected {expected_error_type}"

    if check_message and not body["message"]:
        return False, "message field is empty"

    # Validate field types
    if not isinstance(body["status_code"], int):
        return False, f"status_code is not an int: {type(body['status_code'])}"

    if not isinstance(body["error_type"], str):
        return False, f"error_type is not a string: {type(body['error_type'])}"

    if not isinstance(body["message"], str):
        return False, f"message is not a string: {type(body['message'])}"

    if body["detail"] is not None and not isinstance(body["detail"], str):
        return False, f"detail is not a string or null: {type(body['detail'])}"

    if body["request_id"] is not None and not isinstance(body["request_id"], str):
        return False, f"request_id is not a string or null: {type(body['request_id'])}"

    return True, ""


def run_tests() -> tuple[int, int]:
    """Run all error response verification tests.

    Returns:
        Tuple of (passed_count, failed_count).
    """
    passed = 0
    failed = 0

    print_header("ERROR HANDLING MIDDLEWARE VERIFICATION")
    print(f"\n{BOLD}Base URL:{RESET} {BASE_URL}")

    # Test 1: NotFoundError (404)
    print_header("Test 1: NotFoundError (404)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/not-found")
        ok, msg = validate_error_response(response, 404, "not_found")
        print_test("NotFoundError returns 404", ok, msg)
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("NotFoundError returns 404", False, "Could not connect to server")
        failed += 1

    # Test 2: Custom ValidationError (400)
    print_header("Test 2: Custom ValidationError (400)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/validation-error")
        ok, msg = validate_error_response(response, 400, "bad_request")
        print_test("ValidationError returns 400", ok, msg)
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("ValidationError returns 400", False, "Could not connect to server")
        failed += 1

    # Test 3: UnauthorizedError (401)
    print_header("Test 3: UnauthorizedError (401)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/unauthorized")
        ok, msg = validate_error_response(response, 401, "unauthorized")
        print_test("UnauthorizedError returns 401", ok, msg)
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("UnauthorizedError returns 401", False, "Could not connect to server")
        failed += 1

    # Test 4: ForbiddenError (403)
    print_header("Test 4: ForbiddenError (403)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/forbidden")
        ok, msg = validate_error_response(response, 403, "forbidden")
        print_test("ForbiddenError returns 403", ok, msg)
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("ForbiddenError returns 403", False, "Could not connect to server")
        failed += 1

    # Test 5: DatabaseError (503)
    print_header("Test 5: DatabaseError (503)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/database-error")
        ok, msg = validate_error_response(response, 503, "service_unavailable")
        print_test("DatabaseError returns 503", ok, msg)
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("DatabaseError returns 503", False, "Could not connect to server")
        failed += 1

    # Test 6: BusinessLogicError (422)
    print_header("Test 6: BusinessLogicError (422)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/business-logic-error")
        ok, msg = validate_error_response(response, 422, "unprocessable_entity")
        print_test("BusinessLogicError returns 422", ok, msg)
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("BusinessLogicError returns 422", False, "Could not connect to server")
        failed += 1

    # Test 7: HTTPException (404)
    print_header("Test 7: HTTPException (404)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/http-exception/404")
        ok, msg = validate_error_response(response, 404, "not_found")
        print_test("HTTPException with 404 returns 404", ok, msg)
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("HTTPException with 404 returns 404", False, "Could not connect to server")
        failed += 1

    # Test 8: HTTPException (500)
    print_header("Test 8: HTTPException (500)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/http-exception/500")
        ok, msg = validate_error_response(response, 500, "internal_server_error")
        print_test("HTTPException with 500 returns 500", ok, msg)
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("HTTPException with 500 returns 500", False, "Could not connect to server")
        failed += 1

    # Test 9: Unhandled Exception (500)
    print_header("Test 9: Unhandled Exception (500)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/unhandled-error")
        ok, msg = validate_error_response(response, 500, "internal_server_error")
        print_test("Unhandled exception returns 500", ok, msg)
        # Verify generic message (no sensitive data exposure)
        body = response.json()
        if "unexpected" in body["message"].lower() or "try again" in body["message"].lower():
            print_test("Response contains generic message (no sensitive data)", True)
            passed += 1
        else:
            print_test("Response contains generic message (no sensitive data)", False, f"Message: {body['message']}")
            failed += 1
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("Unhandled exception returns 500", False, "Could not connect to server")
        failed += 2

    # Test 10: Pydantic ValidationError (422)
    print_header("Test 10: Pydantic RequestValidationError (422)")
    try:
        # Send invalid payload (missing required fields)
        response = httpx.post(
            f"{BASE_URL}/test-errors/pydantic-validation",
            json={"invalid": "data"},
        )
        ok, msg = validate_error_response(response, 422, "validation_error")
        print_test("Pydantic validation error returns 422", ok, msg)
        # Check for field-specific details
        body = response.json()
        if body.get("detail") and ("name" in body["detail"] or "age" in body["detail"]):
            print_test("Response contains field-specific error details", True)
            passed += 1
        else:
            print_test("Response contains field-specific error details", False, f"Detail: {body.get('detail')}")
            failed += 1
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("Pydantic validation error returns 422", False, "Could not connect to server")
        failed += 2

    # Test 11: Pydantic ValidationError with invalid types (422)
    print_header("Test 11: Pydantic Type Validation Error (422)")
    try:
        # Send payload with wrong types
        response = httpx.post(
            f"{BASE_URL}/test-errors/pydantic-validation",
            json={"name": "Test", "age": "not-a-number", "email": "test@example.com"},
        )
        ok, msg = validate_error_response(response, 422, "validation_error")
        print_test("Type validation error returns 422", ok, msg)
        body = response.json()
        if body.get("detail") and "age" in body["detail"]:
            print_test("Response identifies age field error", True)
            passed += 1
        else:
            print_test("Response identifies age field error", False, f"Detail: {body.get('detail')}")
            failed += 1
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        passed += 1 if ok else 0
        failed += 0 if ok else 1
    except httpx.ConnectError:
        print_test("Type validation error returns 422", False, "Could not connect to server")
        failed += 2

    # Test 12: Success endpoint (200)
    print_header("Test 12: Success Endpoint (200)")
    try:
        response = httpx.get(f"{BASE_URL}/test-errors/success")
        if response.status_code == 200:
            print_test("Success endpoint returns 200", True)
            passed += 1
        else:
            print_test("Success endpoint returns 200", False, f"Got {response.status_code}")
            failed += 1
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
    except httpx.ConnectError:
        print_test("Success endpoint returns 200", False, "Could not connect to server")
        failed += 1

    # Test 13: OpenAPI schema includes ErrorResponse
    print_header("Test 13: OpenAPI Schema Verification")
    try:
        response = httpx.get(f"{BASE_URL}/openapi.json")
        if response.status_code == 200:
            print_test("OpenAPI schema accessible", True)
            passed += 1
            schema = response.json()
            if "ErrorResponse" in str(schema.get("components", {}).get("schemas", {})):
                print_test("ErrorResponse schema in OpenAPI", True)
                passed += 1
            else:
                print_test("ErrorResponse schema in OpenAPI", False, "Schema not found in components/schemas")
                failed += 1
        else:
            print_test("OpenAPI schema accessible", False, f"Got {response.status_code}")
            failed += 2
    except httpx.ConnectError:
        print_test("OpenAPI schema accessible", False, "Could not connect to server")
        failed += 2

    return passed, failed


def print_summary(passed: int, failed: int) -> None:
    """Print test summary."""
    total = passed + failed
    print_header("TEST SUMMARY")
    print(f"\n  Total tests: {total}")
    print(f"  {GREEN}Passed: {passed}{RESET}")
    print(f"  {RED}Failed: {failed}{RESET}")

    if failed == 0:
        print(f"\n  {GREEN}{BOLD}All tests passed! Error handling middleware is working correctly.{RESET}")
    else:
        print(f"\n  {YELLOW}{BOLD}Some tests failed. Please review the error messages above.{RESET}")


def print_curl_examples() -> None:
    """Print curl command examples for manual testing."""
    print_header("CURL COMMANDS FOR MANUAL TESTING")
    print("""
You can also test manually using these curl commands:

# NotFoundError (404)
curl -X GET http://localhost:8000/test-errors/not-found

# Custom ValidationError (400)
curl -X GET http://localhost:8000/test-errors/validation-error

# UnauthorizedError (401)
curl -X GET http://localhost:8000/test-errors/unauthorized

# ForbiddenError (403)
curl -X GET http://localhost:8000/test-errors/forbidden

# DatabaseError (503)
curl -X GET http://localhost:8000/test-errors/database-error

# BusinessLogicError (422)
curl -X GET http://localhost:8000/test-errors/business-logic-error

# HTTPException (any status code)
curl -X GET http://localhost:8000/test-errors/http-exception/418

# Unhandled Exception (500)
curl -X GET http://localhost:8000/test-errors/unhandled-error

# Pydantic ValidationError (422) - Missing fields
curl -X POST http://localhost:8000/test-errors/pydantic-validation \\
  -H "Content-Type: application/json" \\
  -d '{"invalid": "data"}'

# Pydantic ValidationError (422) - Invalid types
curl -X POST http://localhost:8000/test-errors/pydantic-validation \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Test", "age": "not-a-number", "email": "test@example.com"}'

# Valid request (200)
curl -X POST http://localhost:8000/test-errors/pydantic-validation \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John Doe", "age": 30, "email": "john@example.com"}'

# Success endpoint (200)
curl -X GET http://localhost:8000/test-errors/success

# OpenAPI schema
curl -X GET http://localhost:8000/openapi.json | python -m json.tool
""")


if __name__ == "__main__":
    print(f"\n{BOLD}Error Handling Middleware Verification Script{RESET}")
    print("=" * 60)

    # Check if we should just print curl examples
    if len(sys.argv) > 1 and sys.argv[1] == "--curl":
        print_curl_examples()
        sys.exit(0)

    # Check server is running
    try:
        httpx.get(f"{BASE_URL}/openapi.json", timeout=5)
    except httpx.ConnectError:
        print(f"\n{RED}ERROR: Could not connect to server at {BASE_URL}{RESET}")
        print(f"\nPlease start the server first:")
        print(f"  uvicorn app.main:app --reload --port 8000")
        print(f"\nThen run this script again:")
        print(f"  python scripts/verify_error_responses.py")
        print(f"\nAlternatively, use --curl flag to see manual test commands:")
        print(f"  python scripts/verify_error_responses.py --curl")
        sys.exit(1)

    # Run tests
    passed, failed = run_tests()
    print_summary(passed, failed)

    # Print curl examples for reference
    print_curl_examples()

    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)
