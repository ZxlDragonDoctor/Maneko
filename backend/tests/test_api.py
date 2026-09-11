# tests/test_api.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_upload_novel():
    # 创建测试文件
    content = """第一章 初遇
    
    小明遇见了小红。

第二章 离别
    
    小红离开了。"""
    
    files = {"file": ("test.txt", content.encode('utf-8'), "text/plain")}
    response = client.post("/api/novels/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["status"] == "completed"

def test_list_novels():
    response = client.get("/api/novels/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)