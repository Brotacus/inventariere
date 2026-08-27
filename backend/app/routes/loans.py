from fastapi import APIRouter

router = APIRouter(prefix="/loans", tags=["Loans"])


@router.get("/")
def get_loans():
    return {"message": "Loans endpoint ready"}
