"""Current user's first-run profile and editable learning preferences."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from services.auth.dependency import get_current_user
from services.learning_profile import ProfileInput, PaceInput, load_profile, save_profile, update_pace

router = APIRouter()


@router.get("")
async def get_learning_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await load_profile(db, user.id)


@router.put("")
async def put_learning_profile(body: ProfileInput, user: User = Depends(get_current_user),
                               db: AsyncSession = Depends(get_db)):
    return await save_profile(db, user.id, body)


@router.patch("/pace")
async def patch_learning_pace(body: PaceInput, user: User = Depends(get_current_user),
                              db: AsyncSession = Depends(get_db)):
    return await update_pace(db,user.id,body)
