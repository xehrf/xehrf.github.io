from pydantic import BaseModel, Field


class PlacementItem(BaseModel):
    user_id: int
    placement: int = Field(ge=1, le=16)


class FinalizeMatchBody(BaseModel):
    placements: list[PlacementItem]
