from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])

# Contador de intentos fallidos en memoria (key: email, value: count)
# En producción con múltiples workers usar Redis en su lugar.
_failed_attempts: dict[str, int] = {}
_MAX_ATTEMPTS = 10
_LOCK_MSG = "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos."


def _check_lockout(email: str) -> None:
    if _failed_attempts.get(email, 0) >= _MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=_LOCK_MSG)


def _record_failure(email: str) -> None:
    _failed_attempts[email] = _failed_attempts.get(email, 0) + 1


def _clear_attempts(email: str) -> None:
    _failed_attempts.pop(email, None)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    _check_lockout(data.email)

    user = db.execute(select(User).where(User.email == data.email)).scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        _record_failure(data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacta al administrador.",
        )

    _clear_attempts(data.email)
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)) -> User:
    return user
