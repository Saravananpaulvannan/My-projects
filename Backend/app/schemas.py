import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class ProductRead(BaseModel):
    id: int
    name: str
    category: str
    mrp: int
    price: int
    pack_unit: str
    pieces: int | str | None
    description: str | None = None
    image_url: str | None = None
    stock_quantity: int = 0

    model_config = ConfigDict(from_attributes=True)


class AdminProductRead(ProductRead):
    is_active: bool


class AdminProductWrite(BaseModel):
    name: str = Field(min_length=2, max_length=240)
    category: str = Field(min_length=1, max_length=100)
    mrp: int = Field(gt=0)
    price: int = Field(gt=0)
    pack_unit: str = Field(min_length=1, max_length=40)
    pieces: int | str | None = None
    description: str | None = Field(default=None, max_length=4000)
    image_url: str | None = None
    stock_quantity: int = Field(default=0, ge=0)
    is_active: bool = True

    @field_validator("name", "category", "pack_unit", "description", mode="before")
    @classmethod
    def strip_product_text(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @field_validator("image_url")
    @classmethod
    def validate_product_image_url(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"/media/[0-9a-f]{32}\.(?:jpg|png|webp|gif)", value):
            raise ValueError("Image must be uploaded through the admin image endpoint")
        return value

    @model_validator(mode="after")
    def validate_prices(self):
        if self.mrp < self.price:
            raise ValueError("Original price must be greater than or equal to price")
        if not self.name or not self.category or not self.pack_unit:
            raise ValueError("Name, category, and pack unit are required")
        return self


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
    delivery_status: str
    user_category: Literal["guest", "loginuser"]
    customer: CustomerRead
    payment_method: Literal["cod"]
    items: list[OrderItemRead]
    subtotal: int
    delivery_fee: Literal[0] = 0
    total: int


class AdminDashboardRead(BaseModel):
    product_count: int
    active_product_count: int
    order_count: int
    pending_delivery_count: int
    total_revenue: int


class AdminOrderSummary(BaseModel):
    order_id: str
    placed_at: datetime
    customer_name: str
    phone: str
    item_count: int
    total: int
    payment_method: str
    delivery_status: str


class AdminOrderPage(BaseModel):
    orders: list[AdminOrderSummary]
    current_page: int
    page_size: int
    total_items: int
    total_pages: int


class DeliveryStatusUpdate(BaseModel):
    delivery_status: Literal["Placed", "Packed", "Shipped", "Delivered"]


class AdminLogin(BaseModel):
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    password: str = Field(min_length=1, max_length=256)


class AdminRead(BaseModel):
    name: str
    phone: str


class AdminLoginRead(BaseModel):
    admin: AdminRead


class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr | None = None
    mobile: str = Field(pattern=r"^[6-9]\d{9}$")
    address_line1: str | None = Field(default=None, max_length=240)
    address_line2: str | None = Field(default=None, max_length=240)
    pincode: str | None = Field(default=None, pattern=r"^\d{6}$")
    password: str = Field(min_length=12, max_length=256)

    @field_validator("name", "address_line1", "address_line2", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class UserLogin(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class UserRead(BaseModel):
    id: int
    name: str
    email: str | None
    mobile: str
    address_line1: str | None
    address_line2: str | None
    pincode: str | None
    is_admin: bool


class AdminCustomerRead(BaseModel):
    id: int
    name: str
    email: str | None
    mobile: str
    is_admin: bool

    model_config = ConfigDict(from_attributes=True)


class AdminRoleUpdate(BaseModel):
    is_admin: bool


class UserSessionRead(BaseModel):
    user: UserRead