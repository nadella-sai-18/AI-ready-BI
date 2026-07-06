"""Framework-agnostic domain exceptions.

Keeping these free of FastAPI/HTTP details lets the service layer stay
independent of the web framework (clean architecture). The routing/exception
handlers in `app.main` translate them into HTTP responses.
"""


class AppError(Exception):
    """Base class for all application/domain errors."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class NotFoundError(AppError):
    """Raised when a requested entity does not exist."""


class ConflictError(AppError):
    """Raised when an operation violates a uniqueness/integrity constraint."""


class ValidationError(AppError):
    """Raised when input is well-formed but violates a business rule."""
