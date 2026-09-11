from sqlalchemy import Column, DateTime, Integer, String
from datetime import datetime
import uuid

from app.database import Base


class Category(Base):
    """User-defined book category / shelf label."""

    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(64), nullable=False, unique=True)
    color = Column(String(16), default="#ff1493")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
