from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.models import (
    Contract,
    ContractStatus,
    FreelancePost,
    FreelancePostStatus,
    Proposal,
    ProposalStatus,
    Review,
    User,
)
from app.db.session import get_db
from app.freelance.schemas import (
    CompleteContractBody,
    ContractOut,
    PostCreate,
    PostOut,
    ProposalCreate,
    ProposalOut,
    SubmitResultBody,
)

router = APIRouter(tags=["freelance"])


@router.post("/posts", response_model=PostOut)
def create_post(body: PostCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> FreelancePost:
    post = FreelancePost(
        title=body.title,
        description=body.description,
        tech_stack=body.tech_stack,
        budget=body.budget,
        deadline=body.deadline,
        status=FreelancePostStatus.open,
        client_id=user.id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.get("/posts", response_model=list[PostOut])
def list_posts(
    min_budget: int | None = Query(default=None),
    max_budget: int | None = Query(default=None),
    tech: str | None = Query(default=None),
    status_filter: FreelancePostStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[FreelancePost]:
    q = db.query(FreelancePost)
    if min_budget is not None:
        q = q.filter(FreelancePost.budget >= min_budget)
    if max_budget is not None:
        q = q.filter(FreelancePost.budget <= max_budget)
    if tech:
        q = q.filter(FreelancePost.tech_stack.ilike(f"%{tech}%"))
    if status_filter is not None:
        q = q.filter(FreelancePost.status == status_filter)
    return q.order_by(FreelancePost.id.desc()).limit(200).all()


@router.get("/posts/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: Session = Depends(get_db)) -> FreelancePost:
    post = db.query(FreelancePost).filter(FreelancePost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


@router.post("/posts/{post_id}/apply", response_model=ProposalOut)
def apply_post(
    post_id: int,
    body: ProposalCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Proposal:
    post = db.query(FreelancePost).filter(FreelancePost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.client_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client cannot apply own post")
    if post.status != FreelancePostStatus.open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Post is not open")

    existing = (
        db.query(Proposal)
        .filter(Proposal.post_id == post_id, Proposal.developer_id == user.id, Proposal.status == ProposalStatus.pending)
        .first()
    )
    if existing:
        return existing

    proposal = Proposal(
        post_id=post_id,
        developer_id=user.id,
        message=body.message,
        portfolio_url=body.portfolio_url,
        status=ProposalStatus.pending,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.get("/posts/{post_id}/proposals", response_model=list[ProposalOut])
def list_proposals(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Proposal]:
    post = db.query(FreelancePost).filter(FreelancePost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only post owner can view proposals")
    return db.query(Proposal).filter(Proposal.post_id == post_id).order_by(Proposal.id.desc()).all()


@router.post("/proposals/{proposal_id}/accept", response_model=ContractOut)
def accept_proposal(proposal_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Contract:
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    post = db.query(FreelancePost).filter(FreelancePost.id == proposal.post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only client can accept proposal")
    if post.status != FreelancePostStatus.open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Post is not open")

    db.query(Proposal).filter(Proposal.post_id == post.id).update({Proposal.status: ProposalStatus.rejected})
    proposal.status = ProposalStatus.accepted
    post.status = FreelancePostStatus.in_progress

    contract = Contract(
        post_id=post.id,
        client_id=post.client_id,
        developer_id=proposal.developer_id,
        status=ContractStatus.active,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.get("/contracts/my", response_model=list[ContractOut])
def my_contracts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Contract]:
    return (
        db.query(Contract)
        .filter((Contract.client_id == user.id) | (Contract.developer_id == user.id))
        .order_by(Contract.id.desc())
        .all()
    )


@router.post("/contracts/{contract_id}/submit", response_model=ContractOut)
def submit_contract_result(
    contract_id: int,
    body: SubmitResultBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Contract:
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    if contract.developer_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only developer can submit result")
    if contract.status not in (ContractStatus.active, ContractStatus.submitted):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contract is closed")

    contract.result_text = body.result_text
    contract.status = ContractStatus.submitted
    db.commit()
    db.refresh(contract)
    return contract


@router.post("/contracts/{contract_id}/complete")
def complete_contract(
    contract_id: int,
    body: CompleteContractBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    if contract.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only client can complete contract")
    if contract.status != ContractStatus.submitted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Developer must submit result before completion",
        )

    post = db.query(FreelancePost).filter(FreelancePost.id == contract.post_id).first()
    assert post is not None
    dev = db.query(User).filter(User.id == contract.developer_id).first()
    assert dev is not None

    contract.status = ContractStatus.completed
    post.status = FreelancePostStatus.completed
    dev.pts = dev.pts + max(10, post.budget // 20)

    review = Review(contract_id=contract.id, rating=body.rating, comment=body.comment)
    db.add(review)
    db.commit()
    return {
        "status": "completed",
        "contract_id": contract.id,
        "developer_id": dev.id,
        "pts_awarded": max(10, post.budget // 20),
        "developer_pts": dev.pts,
        "virtual_payment": post.budget,
    }

