"""AlfredForge — Pydantic models."""
from typing import Optional, Any
from pydantic import BaseModel


class ConfigIn(BaseModel):
    openclaw_endpoint: Optional[str] = None
    openclaw_token: Optional[str] = None
    primary_model: Optional[str] = None
    fallback_model: Optional[str] = None
    broker_stocks: Optional[str] = None
    broker_stocks_key: Optional[str] = None
    broker_stocks_secret: Optional[str] = None
    broker_crypto: Optional[str] = None
    broker_crypto_key: Optional[str] = None
    broker_crypto_secret: Optional[str] = None
    capital_total_aud: Optional[float] = None
    allocation_options_pct: Optional[int] = None
    allocation_crypto_pct: Optional[int] = None
    allocation_cash_pct: Optional[int] = None
    monthly_contribution: Optional[float] = None
    setup_complete: Optional[bool] = None

    model_config = {"extra": "allow"}


class TestConnectionIn(BaseModel):
    endpoint: Optional[str] = None
    token: Optional[str] = None


class TradeFilters(BaseModel):
    source: Optional[str] = None
    ticker: Optional[str] = None
    outcome: Optional[str] = None
    limit: int = 200
