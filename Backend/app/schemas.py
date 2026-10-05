from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ProductRead(BaseModel):
    id: int
    name: str
    category: str
    mrp: int
    price: int
    pack_unit: str
    pieces: int | str | None

    model_config = ConfigDict(from_attributes=True)


class CustomerInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    email: EmailStr | None = None
    address: str = Field(min_length=10, max_length=2000)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    pincode: str = Field(pattern=r"^\d{6}$")

    @field_validator("name", "address", "city", "state", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class OrderItemInput(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=999)


class OrderCreate(BaseModel):
    customer: CustomerInput
    payment_method: Literal["cod"]
    items: list[OrderItemInput] = Field(min_length=1, max_length=100)


class OrderItemRead(BaseModel):
    product_id: int
    name: str
    pack_unit: str
    pieces: int | str | None
    mrp: int
    price: int
    quantity: int
    line_total: int

    model_config = ConfigDict(from_attributes=True)


class CustomerRead(BaseModel):
    name: str
    phone: str
    email: str | None
    address: str
    city: str
    state: str
    pincode: str


class OrderRead(BaseModel):
    order_id: str
    placed_at: datetime
    status: str
    customer: CustomerRead
    payment_method: Literal["cod"]
    items: list[OrderItemRead]
    subtotal: int
    delivery_fee: Literal[0] = 0
    total: int


class AdminLogin(BaseModel):
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    password: str = Field(min_length=1, max_length=256)


class AdminRead(BaseModel):
    name: str
    phone: str


class AdminLoginRead(BaseModel):
    admin: AdminRead