from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PostCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10)
    tech_stack: str = Field(min_length=2, max_length=255)
    budget: int = Field(ge=1)
    deadline: datetime


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    tech_stack: str
    budget: int
    deadline: datetime
    status: str
    client_id: int
    created_at: datetime


class ProposalCreate(BaseModel):
    message: str = Field(min_length=3, max_length=3000)
    portfolio_url: str | None = Field(default=None, max_length=500)


class ProposalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    developer_id: int
    message: str
    portfolio_url: str | None
    status: str
    created_at: datetime


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    client_id: int
    developer_id: int
    status: str
    result_text: str | None
    created_at: datetime


class SubmitResultBody(BaseModel):
    result_text: str = Field(min_length=3, max_length=10000)


class CompleteContractBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)

