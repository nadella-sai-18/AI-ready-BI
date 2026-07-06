from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProgramBase(BaseModel):
    program_name: str = Field(..., min_length=1, max_length=100)
    duration_years: Optional[int] = Field(None, ge=1, le=10)


class ProgramCreate(ProgramBase):
    """Payload for creating a program."""


class ProgramUpdate(BaseModel):
    program_name: Optional[str] = Field(None, min_length=1, max_length=100)
    duration_years: Optional[int] = Field(None, ge=1, le=10)


class ProgramOut(ProgramBase):
    program_id: int

    model_config = ConfigDict(from_attributes=True)
