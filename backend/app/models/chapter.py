from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    novel_id = Column(String(36), ForeignKey("novels.id"), nullable=False)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    comic_status = Column(
        Enum("pending", "generating", "completed", "error", name="comic_status"),
        default="pending",
    )
    comic_images = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    novel = relationship("Novel", back_populates="chapters")
    comic_panels = relationship(
        "ComicPanel", back_populates="chapter", cascade="all, delete-orphan"
    )
