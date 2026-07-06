from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Standard paginated response envelope for list endpoints.

    items  — the rows for the requested page
    total  — total rows matching the filters (across all pages)
    skip   — offset used
    limit  — page size used
    """

    items: list[T]
    total: int
    skip: int
    limit: int
