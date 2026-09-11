from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Novel(Base):
    __tablename__ = "novels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(
        String(16),
        default="processing",
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Library metadata
    author = Column(String(128), default="")
    summary = Column(Text, default="")
    cover_url = Column(String(512), default="")
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    tags = Column(Text, default="[]")  # JSON list of strings
    favorite = Column(Boolean, default=False)
    progress = Column(Float, default=0.0)  # 0.0 ~ 1.0
    source = Column(String(32), default="upload")  # upload|url|gutenberg|wikisource|builtin
    source_ref = Column(String(512), default="")  # external id/url

    category = relationship("Category", lazy="joined")
    chapters = relationship(
        "Chapter", back_populates="novel", cascade="all, delete-orphan"
    )
