from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.routers import (
    academic_year,
    attendance,
    competency,
    course,
    dashboard,
    enrollment,
    exam,
    faculty,
    mark,
    program,
    semester,
    student,
)
from app.utils.exceptions import ConflictError, NotFoundError, ValidationError

app = FastAPI(
    title=settings.APP_NAME,
    description="FastAPI backend on top of the existing lms_db PostgreSQL database.",
    version=settings.APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Domain exception handlers: translate service errors into HTTP responses ---
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": exc.message})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": exc.message})


@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": exc.message}
    )


# --- Routers ---
app.include_router(student.router)
app.include_router(faculty.router)
app.include_router(course.router)
app.include_router(enrollment.router)
app.include_router(attendance.router)
app.include_router(exam.router)
app.include_router(mark.router)
app.include_router(competency.router)
app.include_router(program.router)
app.include_router(semester.router)
app.include_router(academic_year.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["Health"])
def health():
    """Liveness + DB connectivity check against the existing database."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok", "database": "connected" if db_ok else "unreachable"}
