"""
TradeFinder — Auth API (register, login, refresh, me)
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import hashlib, secrets

from app.db.session import get_db
from app.models.models import User, RefreshToken
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_access_token
)
from app.core.config import settings
from pydantic import BaseModel, EmailStr


router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str = ""

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    subscription_tier: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return await _issue_tokens(user, db)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    return await _issue_tokens(user, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(token: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.expires_at > datetime.utcnow(),
        )
    )
    rt = result.scalars().first()
    if not rt:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Rotate refresh token
    await db.delete(rt)
    return await _issue_tokens(user, db)


@router.get("/me")
async def me(token: str, db: AsyncSession = Depends(get_db)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "subscription_tier": user.subscription_tier,
        "subscription_expires_at": user.subscription_expires_at,
        "is_verified": user.is_verified,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _issue_tokens(user: User, db: AsyncSession) -> dict:
    access = create_access_token({"sub": str(user.id), "email": user.email})
    raw_refresh = secrets.token_urlsafe(48)
    rt = RefreshToken(
        user_id=str(user.id),
        token_hash=hashlib.sha256(raw_refresh.encode()).hexdigest(),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    await db.commit()
    return TokenResponse(
        access_token=access,
        refresh_token=raw_refresh,
        user_id=str(user.id),
        email=user.email,
        subscription_tier=user.subscription_tier,
    )
