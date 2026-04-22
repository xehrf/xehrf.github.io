from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.deps import get_current_user
from app.db.models import (
    Contract,
    ContractEvent,
    ContractEventType,
    ContractMessage,
    ContractStatus,
    FreelancePost,
    FreelancePostStatus,
    Proposal,
    ProposalStatus,
    Review,
    User,
)
from app.db.session import get_db
from app.rating.pts import level_from_pts
from app.rating.service import add_rating_history
from app.freelance.schemas import (
    CompleteContractBody,
    ContractEventOut,
    ContractMessageCreate,
    ContractMessageOut,
    ContractOut,
    ContractTimelineOut,
    PostCreate,
    PostOut,
    ProposalCreate,
    ProposalOut,
    RequestRevisionBody,
    SubmitResultBody,
)

router = APIRouter(tags=["freelance"])


STATUS_PROGRESS = {
    ContractStatus.active: 40,
    ContractStatus.submitted: 75,
    ContractStatus.completed: 100,
}

STATUS_TITLE = {
    ContractStatus.active: "In progress",
    ContractStatus.submitted: "Submitted for review",
    ContractStatus.completed: "Completed",
}

STATUS_NEXT_ACTION = {
    ContractStatus.active: "Developer works on delivery",
    ContractStatus.submitted: "Client reviews and approves or requests revision",
    ContractStatus.completed: None,
}


def _enum_value(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _serialize_post(post: FreelancePost, proposals_count: int = 0) -> PostOut:
    return PostOut(
        id=post.id,
        title=post.title,
        description=post.description,
        tech_stack=post.tech_stack,
        budget=post.budget,
        deadline=post.deadline,
        status=_enum_value(post.status),
        client_id=post.client_id,
        client_display_name=post.client.display_name if post.client else None,
        proposals_count=proposals_count,
        created_at=post.created_at,
    )


def _serialize_proposal(proposal: Proposal) -> ProposalOut:
    return ProposalOut(
        id=proposal.id,
        post_id=proposal.post_id,
        developer_id=proposal.developer_id,
        message=proposal.message,
        portfolio_url=proposal.portfolio_url,
        status=_enum_value(proposal.status),
        developer_display_name=proposal.developer.display_name if proposal.developer else None,
        created_at=proposal.created_at,
    )


def _serialize_contract(contract: Contract) -> ContractOut:
    return ContractOut(
        id=contract.id,
        post_id=contract.post_id,
        client_id=contract.client_id,
        developer_id=contract.developer_id,
        status=_enum_value(contract.status),
        result_text=contract.result_text,
        post_title=contract.post.title if contract.post else None,
        post_budget=contract.post.budget if contract.post else None,
        post_status=_enum_value(contract.post.status) if contract.post else None,
        client_display_name=contract.client.display_name if contract.client else None,
        developer_display_name=contract.developer.display_name if contract.developer else None,
        created_at=contract.created_at,
    )


def _serialize_message(row: ContractMessage) -> ContractMessageOut:
    return ContractMessageOut(
        id=row.id,
        contract_id=row.contract_id,
        sender_id=row.sender_id,
        sender_display_name=row.sender.display_name if row.sender else None,
        message=row.message,
        created_at=row.created_at,
    )


def _serialize_event(row: ContractEvent) -> ContractEventOut:
    return ContractEventOut(
        id=row.id,
        contract_id=row.contract_id,
        actor_id=row.actor_id,
        actor_display_name=row.actor.display_name if row.actor else None,
        event_type=_enum_value(row.event_type),
        note=row.note,
        created_at=row.created_at,
    )


def _get_post_or_404(post_id: int, db: Session) -> FreelancePost:
    post = (
        db.query(FreelancePost)
        .options(selectinload(FreelancePost.client))
        .filter(FreelancePost.id == post_id)
        .first()
    )
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


def _get_contract_or_404(contract_id: int, db: Session) -> Contract:
    contract = (
        db.query(Contract)
        .options(
            joinedload(Contract.post),
            joinedload(Contract.client),
            joinedload(Contract.developer),
        )
        .filter(Contract.id == contract_id)
        .first()
    )
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return contract


def _assert_contract_member(contract: Contract, user: User) -> None:
    if user.id not in (contract.client_id, contract.developer_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this contract")


def _create_event(
    db: Session,
    *,
    contract_id: int,
    event_type: ContractEventType,
    actor_id: int | None,
    note: str | None = None,
) -> None:
    db.add(
        ContractEvent(
            contract_id=contract_id,
            actor_id=actor_id,
            event_type=event_type,
            note=note,
        )
    )


def _build_timeline(contract: Contract, events: list[ContractEventOut]) -> ContractTimelineOut:
    status_value = contract.status
    return ContractTimelineOut(
        contract_id=contract.id,
        status=_enum_value(status_value),
        progress_percent=STATUS_PROGRESS[status_value],
        status_title=STATUS_TITLE[status_value],
        next_action=STATUS_NEXT_ACTION[status_value],
        events=events,
    )


@router.post("/posts", response_model=PostOut)
def create_post(body: PostCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PostOut:
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
    db.refresh(user)
    post.client = user
    return _serialize_post(post)


@router.get("/posts", response_model=list[PostOut])
def list_posts(
    min_budget: int | None = Query(default=None),
    max_budget: int | None = Query(default=None),
    tech: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status_filter: FreelancePostStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[PostOut]:
    query = db.query(FreelancePost).options(selectinload(FreelancePost.client))
    if min_budget is not None:
        query = query.filter(FreelancePost.budget >= min_budget)
    if max_budget is not None:
        query = query.filter(FreelancePost.budget <= max_budget)
    if tech:
        query = query.filter(FreelancePost.tech_stack.ilike(f"%{tech}%"))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((FreelancePost.title.ilike(like)) | (FreelancePost.description.ilike(like)))
    if status_filter is not None:
        query = query.filter(FreelancePost.status == status_filter)

    posts = query.order_by(FreelancePost.id.desc()).limit(200).all()
    if not posts:
        return []

    post_ids = [p.id for p in posts]
    rows = (
        db.query(Proposal.post_id, func.count(Proposal.id))
        .filter(Proposal.post_id.in_(post_ids))
        .group_by(Proposal.post_id)
        .all()
    )
    count_by_post_id = {post_id: int(total) for post_id, total in rows}
    return [_serialize_post(post, proposals_count=count_by_post_id.get(post.id, 0)) for post in posts]


@router.get("/posts/my", response_model=list[PostOut])
def my_posts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PostOut]:
    posts = (
        db.query(FreelancePost)
        .options(selectinload(FreelancePost.client))
        .filter(FreelancePost.client_id == user.id)
        .order_by(FreelancePost.id.desc())
        .all()
    )
    if not posts:
        return []
    post_ids = [p.id for p in posts]
    rows = (
        db.query(Proposal.post_id, func.count(Proposal.id))
        .filter(Proposal.post_id.in_(post_ids))
        .group_by(Proposal.post_id)
        .all()
    )
    count_by_post_id = {post_id: int(total) for post_id, total in rows}
    return [_serialize_post(post, proposals_count=count_by_post_id.get(post.id, 0)) for post in posts]


@router.get("/posts/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: Session = Depends(get_db)) -> PostOut:
    post = _get_post_or_404(post_id, db)
    proposals_count = db.query(Proposal).filter(Proposal.post_id == post.id).count()
    return _serialize_post(post, proposals_count=proposals_count)


@router.post("/posts/{post_id}/apply", response_model=ProposalOut)
def apply_post(
    post_id: int,
    body: ProposalCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProposalOut:
    post = _get_post_or_404(post_id, db)
    if post.client_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client cannot apply own post")
    if post.status != FreelancePostStatus.open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Post is not open")

    existing = (
        db.query(Proposal)
        .options(joinedload(Proposal.developer))
        .filter(Proposal.post_id == post_id, Proposal.developer_id == user.id, Proposal.status == ProposalStatus.pending)
        .first()
    )
    if existing:
        return _serialize_proposal(existing)

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
    proposal.developer = user
    return _serialize_proposal(proposal)


@router.get("/posts/{post_id}/proposals", response_model=list[ProposalOut])
def list_proposals(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ProposalOut]:
    post = _get_post_or_404(post_id, db)
    if post.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only post owner can view proposals")
    proposals = (
        db.query(Proposal)
        .options(joinedload(Proposal.developer))
        .filter(Proposal.post_id == post_id)
        .order_by(Proposal.id.desc())
        .all()
    )
    return [_serialize_proposal(row) for row in proposals]


@router.post("/proposals/{proposal_id}/accept", response_model=ContractOut)
def accept_proposal(proposal_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ContractOut:
    proposal = db.query(Proposal).options(joinedload(Proposal.developer)).filter(Proposal.id == proposal_id).first()
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    post = db.query(FreelancePost).filter(FreelancePost.id == proposal.post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only client can accept proposal")
    if post.status != FreelancePostStatus.open:
        existing_contract = (
            db.query(Contract)
            .options(joinedload(Contract.post), joinedload(Contract.client), joinedload(Contract.developer))
            .filter(Contract.post_id == post.id)
            .first()
        )
        if existing_contract is not None:
            return _serialize_contract(existing_contract)
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
    db.flush()
    _create_event(
        db,
        contract_id=contract.id,
        event_type=ContractEventType.contract_started,
        actor_id=user.id,
        note=f"Developer #{proposal.developer_id} accepted for this order",
    )
    db.commit()

    contract = _get_contract_or_404(contract.id, db)
    return _serialize_contract(contract)


@router.get("/posts/{post_id}/contract", response_model=ContractOut | None)
def contract_by_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ContractOut | None:
    contract = (
        db.query(Contract)
        .options(
            joinedload(Contract.post),
            joinedload(Contract.client),
            joinedload(Contract.developer),
        )
        .filter(Contract.post_id == post_id)
        .first()
    )
    if contract is None:
        return None
    if user.id not in (contract.client_id, contract.developer_id):
        return None
    return _serialize_contract(contract)


@router.get("/contracts/my", response_model=list[ContractOut])
def my_contracts(
    role_filter: str | None = Query(default=None, alias="role"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContractOut]:
    query = db.query(Contract).options(
        joinedload(Contract.post),
        joinedload(Contract.client),
        joinedload(Contract.developer),
    )
    if role_filter == "client":
        query = query.filter(Contract.client_id == user.id)
    elif role_filter == "developer":
        query = query.filter(Contract.developer_id == user.id)
    else:
        query = query.filter((Contract.client_id == user.id) | (Contract.developer_id == user.id))
    contracts = query.order_by(Contract.id.desc()).all()
    return [_serialize_contract(row) for row in contracts]


@router.get("/contracts/{contract_id}/timeline", response_model=ContractTimelineOut)
def get_contract_timeline(
    contract_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContractTimelineOut:
    contract = _get_contract_or_404(contract_id, db)
    _assert_contract_member(contract, user)
    events = (
        db.query(ContractEvent)
        .options(joinedload(ContractEvent.actor))
        .filter(ContractEvent.contract_id == contract.id)
        .order_by(ContractEvent.id.asc())
        .all()
    )
    serialized_events = [_serialize_event(row) for row in events]
    if not serialized_events:
        serialized_events = [
            ContractEventOut(
                id=0,
                contract_id=contract.id,
                actor_id=contract.client_id,
                actor_display_name=contract.client.display_name if contract.client else None,
                event_type=ContractEventType.contract_started.value,
                note="Contract has been created",
                created_at=contract.created_at,
            )
        ]
    return _build_timeline(contract, serialized_events)


@router.get("/contracts/{contract_id}/messages", response_model=list[ContractMessageOut])
def list_contract_messages(
    contract_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContractMessageOut]:
    contract = _get_contract_or_404(contract_id, db)
    _assert_contract_member(contract, user)
    rows = (
        db.query(ContractMessage)
        .options(joinedload(ContractMessage.sender))
        .filter(ContractMessage.contract_id == contract.id)
        .order_by(ContractMessage.id.asc())
        .all()
    )
    return [_serialize_message(row) for row in rows]


@router.post("/contracts/{contract_id}/messages", response_model=ContractMessageOut)
def send_contract_message(
    contract_id: int,
    body: ContractMessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContractMessageOut:
    contract = _get_contract_or_404(contract_id, db)
    _assert_contract_member(contract, user)

    text = body.message.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    row = ContractMessage(contract_id=contract.id, sender_id=user.id, message=text)
    db.add(row)
    db.flush()
    preview = text if len(text) <= 180 else f"{text[:177]}..."
    _create_event(
        db,
        contract_id=contract.id,
        event_type=ContractEventType.message_sent,
        actor_id=user.id,
        note=preview,
    )
    db.commit()
    db.refresh(row)
    row.sender = user
    return _serialize_message(row)


@router.post("/contracts/{contract_id}/submit", response_model=ContractOut)
def submit_contract_result(
    contract_id: int,
    body: SubmitResultBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContractOut:
    contract = _get_contract_or_404(contract_id, db)
    _assert_contract_member(contract, user)
    if contract.developer_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only developer can submit result")
    if contract.status == ContractStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contract is already completed")

    contract.result_text = body.result_text
    contract.status = ContractStatus.submitted
    _create_event(
        db,
        contract_id=contract.id,
        event_type=ContractEventType.result_submitted,
        actor_id=user.id,
        note="Developer submitted the result",
    )
    db.commit()

    contract = _get_contract_or_404(contract.id, db)
    return _serialize_contract(contract)


@router.post("/contracts/{contract_id}/request-revision", response_model=ContractOut)
def request_contract_revision(
    contract_id: int,
    body: RequestRevisionBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContractOut:
    contract = _get_contract_or_404(contract_id, db)
    _assert_contract_member(contract, user)
    if contract.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only client can request revision")
    if contract.status != ContractStatus.submitted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Result must be submitted first")

    contract.status = ContractStatus.active
    note = body.note.strip() if body.note else "Client requested a revision"
    _create_event(
        db,
        contract_id=contract.id,
        event_type=ContractEventType.revision_requested,
        actor_id=user.id,
        note=note,
    )
    db.commit()

    contract = _get_contract_or_404(contract.id, db)
    return _serialize_contract(contract)


@router.post("/contracts/{contract_id}/complete")
def complete_contract(
    contract_id: int,
    body: CompleteContractBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    contract = _get_contract_or_404(contract_id, db)
    _assert_contract_member(contract, user)
    if contract.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only client can complete contract")
    if contract.status != ContractStatus.submitted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Developer must submit result before completion",
        )

    post = db.query(FreelancePost).filter(FreelancePost.id == contract.post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    dev = db.query(User).filter(User.id == contract.developer_id).first()
    if dev is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Developer not found")

    pts_awarded = max(10, post.budget // 20)
    contract.status = ContractStatus.completed
    post.status = FreelancePostStatus.completed
    dev.pts = dev.pts + pts_awarded
    dev.level = level_from_pts(dev.pts)

    review = Review(contract_id=contract.id, rating=body.rating, comment=body.comment)
    db.add(review)
    add_rating_history(
        db,
        user_id=dev.id,
        pts_delta=pts_awarded,
        reason="freelance_contract_completed",
        task_id=None,
        language_key=None,
        topic_key="freelance",
    )
    _create_event(
        db,
        contract_id=contract.id,
        event_type=ContractEventType.contract_completed,
        actor_id=user.id,
        note=f"Work accepted with rating {body.rating}/5",
    )
    db.commit()
    return {
        "status": "completed",
        "contract_id": contract.id,
        "developer_id": dev.id,
        "pts_awarded": pts_awarded,
        "developer_pts": dev.pts,
        "virtual_payment": post.budget,
    }
