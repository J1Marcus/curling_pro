import logging
import os
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from database.database_utils import DatabaseUtils

"""
Session Module

This module provides a session for database operations.
"""

load_dotenv()

# Connection pool configuration via environment variables with production-ready defaults
pool_size = int(os.getenv("DB_POOL_SIZE", "10"))  # Core pool size - number of persistent connections
max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))  # Additional connections during traffic spikes
pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))  # Seconds to wait for available connection
pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "3600"))  # Recycle connections after 1 hour to prevent stale connections

engine = create_engine(
    DatabaseUtils.get_connection_string(),
    pool_size=pool_size,        # Core pool size
    max_overflow=max_overflow,  # Additional connections during bursts
    pool_timeout=pool_timeout,  # Seconds to wait for connection
    pool_recycle=pool_recycle,  # Recycle connections after 1 hour
    pool_pre_ping=True,         # Verify connections before use (handles database restarts)
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def db_session() -> Generator:
    """Database Session Dependency.

    This function provides a database session for each request.
    It ensures that the session is committed after successful operations.
    """
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as ex:
        session.rollback()
        logging.error(ex)
        raise ex
    finally:
        session.close()
