from fastapi import APIRouter

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/status")
def payments_placeholder() -> dict:
    return {"status": "not_implemented", "note": "Donations and escrow for solo tasks will hook in here."}
