"""Quick question endpoints; no course-agent tool execution."""
import asyncio
from contextlib import suppress
import uuid
from fastapi import APIRouter,Depends,Request,HTTPException,Query
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models.user import User
from services.auth.dependency import get_current_user
from services import quick_ask as service
router=APIRouter()

@router.get('')
async def load_quick_ask(course_id:uuid.UUID|None=None,node_id:uuid.UUID|None=None,
    user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    if node_id and not course_id:raise HTTPException(422,'章节必须属于课程。')
    return await service.load(db,user.id,service.Scope(course_id=course_id,node_id=node_id))

@router.post('')
async def send_quick_ask(body:service.AskRequest,request:Request,
    user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    task=asyncio.create_task(service.ask(db,user.id,body))
    try:
        while True:
            try: return await asyncio.wait_for(asyncio.shield(task),timeout=0.3)
            except asyncio.TimeoutError:
                if await request.is_disconnected():raise HTTPException(499,'客户端已停止等待。')
    finally:
        if not task.done():
            task.cancel()
            with suppress(asyncio.CancelledError):await task

@router.post('/reset')
async def reset_quick_ask(body:service.ResetRequest,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await service.reset(db,user.id,body)

@router.post('/report')
async def report_quick_answer(body:service.ReportInput,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await service.report_answer(db,user.id,body)


@router.get('/history')
async def earlier_quick_ask(generation:uuid.UUID,before:int=Query(ge=1),course_id:uuid.UUID|None=None,node_id:uuid.UUID|None=None,
    user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    if node_id and not course_id:raise HTTPException(422,'章节必须属于课程。')
    return await service.load_earlier(db,user.id,service.Scope(course_id=course_id,node_id=node_id),before,generation)
