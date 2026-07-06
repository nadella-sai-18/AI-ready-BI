from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

# Engine bound to the EXISTING lms_db database.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

# Declarative base. NOTE: we NEVER call Base.metadata.create_all().
# Models map to tables that already exist (created by sql/schema.sql).
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a scoped DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
