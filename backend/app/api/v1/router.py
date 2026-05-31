from fastapi import APIRouter

from app.api.v1.endpoints import auth, interests, matching, messages, notifications, profiles, search, users

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
api_router.include_router(matching.router, prefix="/matching", tags=["matching"])
api_router.include_router(interests.router, prefix="/interests", tags=["interests"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
