from fastapi import APIRouter, Request

from app.routers._envelope import ok


router = APIRouter(prefix="/stubs", tags=["Stubs"])


@router.get("")
async def list_stubs(request: Request):
    return ok(
        data={
            "message": "Stub router. Replace with real Feature 2+ routers.",
            "domains": [
                "auth",
                "users",
                "meetings",
                "dashboard",
                "calendar",
                "messenger",
                "action-items",
                "settings",
                "profile",
                "notifications",
            ],
        },
        request=request,
    )

