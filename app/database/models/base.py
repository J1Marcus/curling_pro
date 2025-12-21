"""
Base Model Mixins Module

This module provides shared mixins and utilities for SQLAlchemy models.
These mixins provide common functionality that can be inherited by multiple
model classes to ensure consistency across the database schema.

Mixins provided:
- UUIDMixin: Adds a UUID primary key column
- TimestampMixin: Adds created_at and updated_at timestamp columns
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID


class UUIDMixin:
    """Mixin that adds a UUID primary key column to models.

    This mixin provides a standard UUID primary key using uuid1() for
    time-based unique identifiers. All models should use this mixin
    for consistent primary key handling.

    Attributes:
        id: UUID primary key, automatically generated using uuid1
    """

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the record",
    )


class TimestampMixin:
    """Mixin that adds created_at and updated_at timestamp columns.

    This mixin provides automatic timestamping for record creation and
    updates. The created_at timestamp is set once when the record is
    created, while updated_at is refreshed on every update.

    Attributes:
        created_at: Timestamp when the record was created
        updated_at: Timestamp when the record was last updated
    """

    created_at = Column(
        DateTime,
        default=datetime.now,
        nullable=False,
        doc="Timestamp when the record was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        nullable=False,
        doc="Timestamp when the record was last updated",
    )


class BaseModelMixin(UUIDMixin, TimestampMixin):
    """Combined mixin providing both UUID primary key and timestamps.

    This convenience mixin combines UUIDMixin and TimestampMixin for
    models that need both standard UUID primary keys and automatic
    timestamp tracking. Most models in the schema should inherit from
    this mixin along with Base.

    Usage:
        class MyModel(BaseModelMixin, Base):
            __tablename__ = "my_table"
            # Additional columns...
    """

    pass
