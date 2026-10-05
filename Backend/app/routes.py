from datetime import UTC, datetime
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AdminSession, CustomerSession, Product, User
from app.schemas import (
    AdminLogin,
    AdminLoginRead,
    AdminRead,
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
    new_customer_session,
    new_admin_session,
    public_order,
    public_user,
    verify_admin,
    verify_customer_password,
)

api = APIRouter(prefix="/api/v1")
auth = APIRouter(prefix="/api/v1/auth", tags=["admin authentication"])
customer_auth = APIRouter(prefix="/api/v1/customer/auth", tags=["customer authentication"])


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