"""
TradeFinder — Async Redis client wrapper
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Optional, AsyncGenerator
import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    def __init__(self):
        self._client: Optional[aioredis.Redis] = None

    async def connect(self):
        self._client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
        logger.info("Redis connected")

    async def disconnect(self):
        if self._client:
            await self._client.aclose()

    async def ping(self) -> bool:
        try:
            return await self._client.ping()
        except Exception:
            return False

    async def get(self, key: str) -> Optional[str]:
        return await self._client.get(key)

    async def set(self, key: str, value: str, ex: int = None):
        await self._client.set(key, value, ex=ex)

    async def delete(self, key: str):
        await self._client.delete(key)

    async def publish(self, channel: str, message: str):
        await self._client.publish(channel, message)

    async def subscribe(self, channel: str) -> AsyncGenerator[str, None]:
        """Async generator that yields messages from a pub/sub channel."""
        pubsub = self._client.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for msg in pubsub.listen():
                if msg["type"] == "message":
                    yield msg["data"]
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    async def hset(self, name: str, mapping: dict):
        await self._client.hset(name, mapping=mapping)

    async def hgetall(self, name: str) -> dict:
        return await self._client.hgetall(name)


redis_client = RedisClient()
