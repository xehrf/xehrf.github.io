from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.social import service
from app.social.schemas import (
    ActivityEventOut,
    DMConversationOut,
    DMMessageOut,
    DMSendIn,
    FriendRequestIn,
    FriendshipOut,
    FriendshipStatusOut,
    FriendUserOut,
)

router = APIRouter(prefix="/social", tags=["social"])


# ----- Friends -----

@router.get("/friends", response_model=list[FriendshipOut])
def get_friends(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.list_friends(db, user.id)


@router.get("/friends/pending", response_model=list[FriendshipOut])
def get_pending(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.list_pending(db, user.id)


@router.post("/friends/requests", response_model=FriendshipOut)
def send_request(
    data: FriendRequestIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = service.send_friend_request(db, user.id, data.user_id)
    is_incoming = row.addressee_id == user.id
    other_id = row.requester_id if is_incoming else row.addressee_id
    other = db.query(User).filter(User.id == other_id).first()
    direction = "friend" if row.status.value == "accepted" else ("incoming" if is_incoming else "outgoing")
    return {
        "id": row.id,
        "status": row.status.value,
        "direction": direction,
        "created_at": row.created_at,
        "decided_at": row.decided_at,
        "user": other,
    }


@router.post("/friends/requests/{friendship_id}/accept", response_model=FriendshipOut)
def accept_request(
    friendship_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = service.respond_friend_request(db, user.id, friendship_id, accept=True)
    other = db.query(User).filter(User.id == row.requester_id).first()
    return {
        "id": row.id,
        "status": row.status.value,
        "direction": "friend",
        "created_at": row.created_at,
        "decided_at": row.decided_at,
        "user": other,
    }


@router.post("/friends/requests/{friendship_id}/decline", response_model=FriendshipOut)
def decline_request(
    friendship_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = service.respond_friend_request(db, user.id, friendship_id, accept=False)
    other = db.query(User).filter(User.id == row.requester_id).first()
    return {
        "id": row.id,
        "status": row.status.value,
        "direction": "incoming",
        "created_at": row.created_at,
        "decided_at": row.decided_at,
        "user": other,
    }


@router.delete("/friends/{user_id}", status_code=204)
def delete_friend(
    user_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.remove_friend(db, user.id, user_id)
    return None


@router.get("/users/search", response_model=list[FriendUserOut])
def search_users(
    q: str = Query("", min_length=0, max_length=64),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.search_users(db, user.id, q)


@router.get("/friendship/{user_id}", response_model=FriendshipStatusOut)
def get_friendship_status(
    user_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_friendship_status(db, user.id, user_id)


# ----- DMs -----

@router.get("/dms", response_model=list[DMConversationOut])
def get_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.list_dm_conversations(db, user.id)


@router.get("/dms/{partner_id}", response_model=list[DMMessageOut])
def get_thread(
    partner_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.mark_thread_read(db, user.id, partner_id)
    return service.list_dm_thread(db, user.id, partner_id)


@router.post("/dms/{partner_id}", response_model=DMMessageOut)
def send_message(
    partner_id: int,
    data: DMSendIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.send_dm(db, user.id, partner_id, data.body)


@router.post("/dms/{partner_id}/read", status_code=204)
def mark_read(
    partner_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.mark_thread_read(db, user.id, partner_id)
    return None


# ----- Activity feed -----

@router.get("/activity", response_model=list[ActivityEventOut])
def get_activity(
    limit: int = Query(30, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.build_activity_feed(db, user.id, limit)
