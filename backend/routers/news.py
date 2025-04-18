from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from services.news_service import NewsService
from utils.logger import logger
from models.news import FlashNews, NewsArticle

router = APIRouter()

def get_news_service() -> NewsService:
    logger.debug("创建新闻服务实例")
    return NewsService()

@router.get("/daily")
async def get_daily_news(
    start_date: Optional[str] = Query(None, description="开始日期，格式：YYYYMMDD"),
    end_date: Optional[str] = Query(None, description="结束日期，格式：YYYYMMDD"),
    service: NewsService = Depends(get_news_service)
):
    """获取每日新闻"""
    try:
        news = service.get_news(start_date, end_date)
        return news
    except Exception as e:
        logger.error(f"获取每日新闻失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/flash")
async def get_flash_news(
    service: NewsService = Depends(get_news_service)
):
    """获取快讯"""
    try:
        flash_news = service.get_flash_news()
        return flash_news
    except Exception as e:
        logger.error(f"获取快讯失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/articles")
async def get_news_articles(
    service: NewsService = Depends(get_news_service)
):
    """获取资讯文章"""
    try:
        articles = service.get_news_articles()
        return articles
    except Exception as e:
        logger.error(f"获取资讯文章失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analysis")
async def get_news_analysis(
    news_date: str = Query(..., description="新闻日期，格式：YYYYMMDD"),
    service: NewsService = Depends(get_news_service)
):
    """获取新闻分析"""
    try:
        analysis = service.analyze_news_impact(news_date)
        if not analysis:
            return {
                "date": news_date,
                "news_count": 0,
                "price_change": None,
                "volume_change": None,
                "analysis": [],
                "message": "未找到该日期的新闻数据"
            }
        return analysis
    except Exception as e:
        logger.error(f"获取新闻分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
async def analyze_news(
    news_date: str = Query(..., description="新闻日期，格式：YYYYMMDD"),
    service: NewsService = Depends(get_news_service)
):
    """分析新闻"""
    try:
        analysis = await service.analyze_news_with_deepseek(news_date)
        return analysis
    except Exception as e:
        logger.error(f"分析新闻失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 