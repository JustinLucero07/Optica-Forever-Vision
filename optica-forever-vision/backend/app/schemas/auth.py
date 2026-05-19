from pydantic import BaseModel

from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: str  # str simple — la validación de formato es responsabilidad del frontend
    password: str


class UserPublic(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
