"""
Webhook Authentication Module

This module provides authentication functions for VAPI webhook endpoints.
It implements defense-in-depth security with HMAC-SHA256 signature validation
and API key authentication.
"""

import hashlib
import hmac
import os

from fastapi import Depends, HTTPException, Request
