from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.approvals.approval_manager import approvals

router = APIRouter()


class Decision(BaseModel):
    approved: bool


@router.post("/approvals")
def decide(d: Decision):
    if not approvals.decide(d.approved):
        raise HTTPException(409, "No approval is pending")
    return {"approved": d.approved}
