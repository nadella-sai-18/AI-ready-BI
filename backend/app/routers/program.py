"""HTTP layer for the Program module."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.program import ProgramCreate, ProgramOut, ProgramUpdate
from app.services.program_service import ProgramService

router = APIRouter(prefix="/programs", tags=["Programs"])


def get_program_service(db: Session = Depends(get_db)) -> ProgramService:
    return ProgramService(db)


@router.get("", response_model=Page[ProgramOut])
def list_programs(
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: ProgramService = Depends(get_program_service),
):
    items, total = service.list_programs(
        search=search, sort_by=sort_by, order=order, skip=skip, limit=limit
    )
    return Page(items=items, total=total, skip=skip, limit=limit)


@router.get("/{program_id}", response_model=ProgramOut)
def get_program(program_id: int, service: ProgramService = Depends(get_program_service)):
    return service.get_program(program_id)


@router.post("", response_model=ProgramOut, status_code=status.HTTP_201_CREATED)
def create_program(payload: ProgramCreate, service: ProgramService = Depends(get_program_service)):
    return service.create_program(payload)


@router.put("/{program_id}", response_model=ProgramOut)
def update_program(
    program_id: int, payload: ProgramUpdate, service: ProgramService = Depends(get_program_service)
):
    return service.update_program(program_id, payload)


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program(program_id: int, service: ProgramService = Depends(get_program_service)):
    service.delete_program(program_id)
    return None
