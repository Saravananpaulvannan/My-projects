from datetime import UTC, datetime
from hashlib import sha256
from math import ceil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import get_db
from app.models import AdminSession, CustomerSession, Order, Product, User
from app.schemas import (
    AdminCustomerRead,
    AdminDashboardRead,
    AdminLogin,
    AdminLoginRead,
    AdminOrderPage,
    AdminProductRead,
    AdminProductWrite,
    AdminRead,
    AdminRoleUpdate,
    DeliveryStatusUpdate,
    OrderCreate,
    OrderRead,
    ProductRead,
    UserLogin,
    UserRead,
    UserRegister,
    UserSessionRead,
)
from app.services import (
    OrderRuleError,
    active_admin,
    active_customer,
    create_customer,
    create_order,
    customer_by_identifier,
    new_admin_session,
    new_customer_session,
    public_order,
    public_admin_customer,
    public_admin_order_summary,
    public_user,
    verify_admin,
    verify_customer_password,
)

api = APIRouter(prefix="/api/v1")
auth = APIRouter(prefix="/api/v1/auth", tags=["admin authentication"])
customer_auth = APIRouter(prefix="/api/v1/customer/auth", tags=["customer authentication"])

MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_TYPES = {
    "image/jpeg": (b"\xff\xd8\xff", "jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", "png"),
    "image/gif": (b"GIF", "gif"),
    "image/webp": (b"RIFF", "webp"),
}


@api.get("/products", response_model=list[ProductRead])
def list_products(
    category: str | None = None,
    q: str | None = Query(default=None, max_length=120),
    sort: str = Query(default="default", pattern="^(default|low|high)$"),
    db: Session = Depends(get_db),
):
    query = select(Product).where(Product.is_active.is_(True))
    if category and category.casefold() != "all":
        query = query.where(Product.category == category)
    if q and q.strip():
        query = query.where(Product.name.ilike(f"%{q.strip()}%"))
    if sort == "low":
        query = query.order_by(Product.price, Product.id)
    elif sort == "high":
        query = query.order_by(Product.price.desc(), Product.id)
    else:
        query = query.order_by(Product.id)
    return db.scalars(query).all()


@api.get("/products/{product_id}", response_model=ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.is_active.is_(True))
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@api.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(
        select(Product.category)
        .where(Product.is_active.is_(True))
        .group_by(Product.category)
        .order_by(func.min(Product.id))
    ).all()


def require_admin_access(request: Request, db: Session) -> None:
    if active_admin(db, request.cookies.get("admin_session")) is not None:
        return
    customer = active_customer(db, request.cookies.get("customer_session"))
    if customer is not None and customer.is_admin:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN if customer is not None else status.HTTP_401_UNAUTHORIZED,
        detail="Admin access required",
    )


@api.get("/admin/customers", response_model=list[AdminCustomerRead])
def list_admin_customers(request: Request, db: Session = Depends(get_db)):
    require_admin_access(request, db)
    return [public_admin_customer(user) for user in db.scalars(select(User).order_by(User.id)).all()]


def product_values(product: AdminProductWrite) -> dict:
    values = product.model_dump()
    image_url = values.pop("image_url")
    values["image_path"] = image_url.removeprefix("/media/") if image_url else None
    return values


@api.get("/admin/dashboard", response_model=AdminDashboardRead)
def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    require_admin_access(request, db)
    product_count = db.scalar(select(func.count(Product.id))) or 0
    active_product_count = db.scalar(select(func.count(Product.id)).where(Product.is_active.is_(True))) or 0
    order_count = db.scalar(select(func.count(Order.id))) or 0
    pending_delivery_count = db.scalar(
        select(func.count(Order.id)).where(Order.delivery_status != "Delivered")
    ) or 0
    total_revenue = db.scalar(select(func.coalesce(func.sum(Order.total), 0))) or 0
    return {
        "product_count": product_count,
        "active_product_count": active_product_count,
        "order_count": order_count,
        "pending_delivery_count": pending_delivery_count,
        "total_revenue": int(total_revenue),
    }


@api.get("/admin/products", response_model=list[AdminProductRead])
def list_admin_products(request: Request, db: Session = Depends(get_db)):
    require_admin_access(request, db)
    return db.scalars(select(Product).order_by(Product.id)).all()


@api.post("/admin/products", response_model=AdminProductRead, status_code=status.HTTP_201_CREATED)
def create_admin_product(product_data: AdminProductWrite, request: Request, db: Session = Depends(get_db)):
    require_admin_access(request, db)
    product = Product(**product_values(product_data))
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@api.put("/admin/products/{product_id}", response_model=AdminProductRead)
def update_admin_product(
    product_id: int,
    product_data: AdminProductWrite,
    request: Request,
    db: Session = Depends(get_db),
):
    require_admin_access(request, db)
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    for field, value in product_values(product_data).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@api.delete("/admin/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_admin_product(product_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin_access(request, db)
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product.is_active = False
    db.commit()


@api.post("/admin/product-images", status_code=status.HTTP_201_CREATED)
async def upload_admin_product_image(request: Request, db: Session = Depends(get_db)):
    require_admin_access(request, db)
    media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    image_type = IMAGE_TYPES.get(media_type)
    if image_type is None:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a PNG, JPEG, GIF, or WebP image")

    image_bytes = bytearray()
    async for chunk in request.stream():
        image_bytes.extend(chunk)
        if len(image_bytes) > MAX_PRODUCT_IMAGE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image must be 5 MB or smaller")

    signature, extension = image_type
    valid_signature = image_bytes.startswith(signature)
    if media_type == "image/webp":
        valid_signature = valid_signature and image_bytes[8:12] == b"WEBP"
    if not valid_signature:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Image content does not match its file type")

    filename = f"{uuid4().hex}.{extension}"
    upload_dir: Path = settings.upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / filename).write_bytes(image_bytes)
    return {"image_url": f"/media/{filename}"}


@api.get("/admin/orders", response_model=AdminOrderPage)
def list_admin_orders(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
    delivery_status: str | None = Query(default=None, pattern="^(Placed|Packed|Shipped|Delivered)$"),
    db: Session = Depends(get_db),
):
    require_admin_access(request, db)
    query = select(Order)
    count_query = select(func.count(Order.id))
    if delivery_status:
        query = query.where(Order.delivery_status == delivery_status)
        count_query = count_query.where(Order.delivery_status == delivery_status)
    total_items = db.scalar(count_query) or 0
    orders = db.scalars(
        query.options(selectinload(Order.items))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "orders": [public_admin_order_summary(order) for order in orders],
        "current_page": page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": ceil(total_items / page_size),
    }


def get_admin_order(order_number: str, request: Request, db: Session) -> Order:
    require_admin_access(request, db)
    order = db.scalar(
        select(Order).options(selectinload(Order.items)).where(Order.order_number == order_number)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@api.get("/admin/orders/{order_number}", response_model=OrderRead)
def admin_order_details(order_number: str, request: Request, db: Session = Depends(get_db)):
    return public_order(get_admin_order(order_number, request, db))


@api.patch("/admin/orders/{order_number}/delivery-status", response_model=OrderRead)
def update_admin_order_delivery_status(
    order_number: str,
    update: DeliveryStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    order = get_admin_order(order_number, request, db)
    order.delivery_status = update.delivery_status
    db.commit()
    db.refresh(order)
    return public_order(order)


@api.get("/admin/orders/{order_number}/pdf")
def download_admin_order_pdf(order_number: str, request: Request, db: Session = Depends(get_db)):
    order = get_admin_order(order_number, request, db)
    try:
        from app.order_pdf import render_order_pdf

        pdf = render_order_pdf(order)
    except ImportError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="PDF support is not installed") from error
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to generate order PDF") from error
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="order-{order.order_number}.pdf"'},
    )


@api.patch("/admin/customers/{user_id}/role", response_model=AdminCustomerRead)
def update_customer_admin_role(
    user_id: int,
    role: AdminRoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    require_admin_access(request, db)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    user.is_admin = role.is_admin
    db.commit()
    db.refresh(user)
    return public_admin_customer(user)


@api.post("/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def place_order(request: OrderCreate, http_request: Request, db: Session = Depends(get_db)):
    try:
        user = active_customer(db, http_request.cookies.get("customer_session"))
        return public_order(create_order(db, request, user_id=user.id if user else None))
    except OrderRuleError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error


@auth.post("/login", response_model=AdminLoginRead)
def login(credentials: AdminLogin, response: Response, db: Session = Depends(get_db)):
    if not settings.admin_phone or not settings.admin_password_hash:
        raise HTTPException(status_code=503, detail="Admin authentication is not configured")
    if not verify_admin(credentials.phone, credentials.password):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    token = new_admin_session(db, credentials.phone)
    response.set_cookie(
        "admin_session",
        token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_hours * 3600,
        path="/",
    )
    return {"admin": {"name": settings.admin_name, "phone": credentials.phone}}


@auth.get("/me", response_model=AdminRead)
def current_admin(request: Request, db: Session = Depends(get_db)):
    session = active_admin(db, request.cookies.get("admin_session"))
    if session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"name": settings.admin_name, "phone": session.phone}


@auth.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("admin_session")
    if token:
        token_hash = sha256(token.encode()).hexdigest()
        session = db.scalar(select(AdminSession).where(AdminSession.token_hash == token_hash))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie("admin_session", path="/", httponly=True, secure=settings.session_cookie_secure, samesite="lax")


def set_customer_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        "customer_session",
        token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_hours * 3600,
        path="/",
    )


@customer_auth.post("/register", response_model=UserSessionRead, status_code=status.HTTP_201_CREATED)
def register_customer(registration: UserRegister, response: Response, db: Session = Depends(get_db)):
    try:
        user = create_customer(db, registration)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    set_customer_cookie(response, new_customer_session(db, user.id))
    return {"user": public_user(user)}


@customer_auth.post("/login", response_model=UserSessionRead)
def login_customer(credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = customer_by_identifier(db, credentials.identifier)
    if not verify_customer_password(user, credentials.password):
        raise HTTPException(status_code=401, detail="Invalid email/mobile or password")
    set_customer_cookie(response, new_customer_session(db, user.id))
    return {"user": public_user(user)}


@customer_auth.get("/me", response_model=UserRead)
def current_customer(request: Request, db: Session = Depends(get_db)):
    user = active_customer(db, request.cookies.get("customer_session"))
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return public_user(user)


@customer_auth.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_customer(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("customer_session")
    if token:
        token_hash = sha256(token.encode()).hexdigest()
        session = db.scalar(select(CustomerSession).where(CustomerSession.token_hash == token_hash))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(
        "customer_session",
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


router = APIRouter()
router.include_router(api, tags=["store"])
router.include_router(auth)
router.include_router(customer_auth)