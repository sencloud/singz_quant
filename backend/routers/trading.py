from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List
from models.trading import OptionsStrategy, DailyStrategyAnalysis
from services.trading import TradingService
from utils.logger import logger
import httpx
from config import settings
import json
from openai import OpenAI
from fastapi.responses import StreamingResponse
import asyncio
from starlette.background import BackgroundTask
from datetime import datetime

router = APIRouter()

# 初始化OpenAI客户端
client = OpenAI(
    api_key=settings.DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)

def get_trading_service() -> TradingService:
    return TradingService()

async def stream_response(response, request: Request, date: str):
    reasoning_content = ""
    content = ""
    
    try:
        for chunk in response:
            # 检查客户端是否断开连接
            if await request.is_disconnected():
                logger.info("客户端断开连接")
                break
                
            try:
                if chunk.choices[0].delta.reasoning_content:
                    reasoning_content += chunk.choices[0].delta.reasoning_content
                    yield f"data: {json.dumps({'type': 'reasoning', 'content': reasoning_content})}\n\n"
                elif chunk.choices[0].delta.content:
                    content += chunk.choices[0].delta.content
                    yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
            except Exception as e:
                logger.error(f"处理chunk时出错: {str(e)}")
                continue
        
        # 发送完成标记
        yield f"data: {json.dumps({'type': 'done', 'reasoning': reasoning_content, 'content': content})}\n\n"
        
        # 保存到数据库
        try:
            trading_service = TradingService()
            analysis = DailyStrategyAnalysis(
                date=date,  # 使用用户选择的日期
                content=content,
                reasoning_content=reasoning_content
            )
            trading_service.save_strategy_analysis(analysis)
            logger.info(f"策略分析已保存到数据库 - 日期: {date}")
        except Exception as e:
            logger.error(f"保存策略分析到数据库失败: {str(e)}")
            
    except Exception as e:
        logger.error(f"流式响应出错: {str(e)}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    finally:
        logger.info("流式响应结束")

@router.get("/options")
async def get_options_strategies(
    date: str,
    request: Request,
    trading_service: TradingService = Depends(get_trading_service)
):
    """获取期权策略分析"""
    try:
        # 首先尝试从数据库获取
        analysis = trading_service.get_strategy_analysis(date)
        if analysis:
            logger.info(f"从数据库获取到策略分析 - 日期: {date}")
            return {
                "content": analysis.content,
                "reasoning_content": analysis.reasoning_content
            }

        # 如果数据库中没有，则调用Deepseek API
        logger.info("数据库中没有找到策略分析，开始调用Deepseek API")
        
        prompt = f"""今天是{date}，请基于今天的豆粕市场环境，我做出如下交易选择，你评估下是否合适
开空：豆粕2509合约期货
买多2509 3200的期权
买跌2505 2750的期权"""
        
        try:
            response = client.chat.completions.create(
                model="deepseek-reasoner",
                messages=[{"role": "user", "content": prompt}],
                stream=True
            )
            
            return StreamingResponse(
                stream_response(response, request, date),
                media_type="text/event-stream",
                background=BackgroundTask(logger.info, "请求处理完成")
            )
            
        except Exception as e:
            logger.error(f"API调用失败: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"API调用失败: {str(e)}")
            
    except Exception as e:
        logger.error(f"获取期权策略分析失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-strategy")
async def generate_strategy(prompt: str, request: Request):
    """根据提示生成交易策略"""
    try:
        logger.info(f"开始生成策略，prompt: {prompt}")
        
        try:
            response = client.chat.completions.create(
                model="deepseek-reasoner",
                messages=[{"role": "user", "content": prompt}],
                stream=True
            )
            
            return StreamingResponse(
                stream_response(response, request, datetime.now().strftime("%Y-%m-%d")),
                media_type="text/event-stream",
                background=BackgroundTask(logger.info, "请求处理完成")
            )
            
        except Exception as e:
            logger.error(f"API调用失败: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"API调用失败: {str(e)}")
            
    except Exception as e:
        logger.error(f"生成策略失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) 