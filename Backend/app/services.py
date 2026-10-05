from datetime import UTC, datetime, timedelta
from decimal import Decimal
from hashlib import sha256
from secrets import token_urlsafe
from uuid import uuid4

from pwdlib import PasswordHash
from sqlalchemy import insert, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.models import AdminSession, CustomerSession, Order, OrderItem, Product, User, UserIdSequence
from app.schemas import OrderCreate, UserRegister

password_hash = PasswordHash.recommended()
dummy_customer_password_hash = password_hash.hash("constant-time-customer-login-check")


class OrderRuleError(Exception):
    pass


def is_tamil_nadu(state: str) -> bool:
    normalized = "".join(character for character in state.casefold() if character.isalnum())
    return normalized in {"tamilnadu", "tn"}


def minimum_order(state: str) -> int:
    return 3000 if is_tamil_nadu(state) else 5000


def create_order(db: Session, request: OrderCreate, user_id: int | None = None) -> Order:
    product_ids = [item.product_id for item in request.items]
    if len(set(product_ids)) != len(product_ids):
        raise OrderRuleError("Each product may only appear once in an order.")

    products = db.scalars(
        select(Product).where(Product.id.in_(product_ids), Product.is_active.is_(True))
    ).all()
    products_by_id = {product.id: product for product in products}
    if len(products_by_id) != len(product_ids):
        raise OrderRuleError("One or more products are unavailable. Refresh the catalog and try again.")

    subtotal = sum(products_by_id[item.product_id].price * item.quantity for item in request.items)
    required_minimum = minimum_order(request.customer.state)
    if subtotal < required_minimum:
        raise OrderRuleError(f"Minimum order for this state is Rs. {required_minimum}.")

    order = Order(
        order_number=f"AC{uuid4().hex[:10].upper()}",
        customer_name=request.customer.name,
        phone=request.customer.phone,
        email=str(request.customer.email) if request.customer.email else None,
        address=request.customer.address,
        city=request.customer.city,
        state=request.customer.state,
        pincode=request.customer.pincode,
        payment_method=request.payment_method,
        user_category="loginuser" if user_id is not None else "guest",
        user_id=user_id,
        subtotal=Decimal(subtotal),
        total=Decimal(subtotal),
        status="received",
    )
    for requested_item in request.items:
        product = products_by_id[requested_item.product_id]
        line_total = product.price * requested_item.quantity
        order.items.append(
            OrderItem(
                product_id=product.id,
                name=product.name,
                pack_unit=product.pack_unit,
                pieces=product.pieces,
                mrp=product.mrp,
                price=product.price,
                quantity=requested_item.quantity,
                line_total=Decimal(line_total),
            )
        )

    db.add(order)
    db.commit()
    return db.scalar(
        select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
    )


def public_order(order: Order) -> dict:
    return {
        "order_id": order.order_number,
        "placed_at": order.created_at,
        "status": order.status,
        "delivery_status": order.delivery_status,
        "user_category": order.user_category,
        "customer": {
            "name": order.customer_name,
            "phone": order.phone,
            "email": order.email,
            "address": order.address,
            "city": order.city,
            "state": order.state,
            "pincode": order.pincode,
        },
        "payment_method": order.payment_method,
        "items": [
            {
                "product_id": item.product_id,
                "name": item.name,
                "pack_unit": item.pack_unit,
                "pieces": item.pieces,
                "mrp": item.mrp,
                "price": item.price,
                "quantity": item.quantity,
                "line_total": int(item.line_total),
            }
            for item in order.items
        ],
        "subtotal": int(order.subtotal),
        "delivery_fee": 0,
        "total": int(order.total),
    }


def verify_admin(phone: str, password: str) -> bool:
    if not settings.admin_phone or not settings.admin_password_hash:
        return False
    try:
        password_matches = password_hash.verify(password, settings.admin_password_hash)
        return phone == settings.admin_phone and password_matches
    except (ValueError, TypeError):
        return False


def new_admin_session(db: Session, phone: str) -> str:
    token = token_urlsafe(32)
    db.add(
        AdminSession(
            token_hash=sha256(token.encode()).hexdigest(),
            phone=phone,
            expires_at=datetime.now(UTC) + timedelta(hours=settings.session_ttl_hours),
        )
    )
    db.commit()
    return token


def active_admin(db: Session, token: str | None) -> AdminSession | None:
    if not token:
        return None
    token_hash = sha256(token.encode()).hexdigest()
    session = db.scalar(select(AdminSession).where(AdminSession.token_hash == token_hash))
    if session is None:
        return None
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        db.delete(session)
        db.commit()
        return None
    return session


def create_customer(db: Session, request: UserRegister) -> User:
    normalized_email = str(request.email).casefold() if request.email else None
    existing = db.scalar(select(User.id).where(User.user_mobile == request.mobile))
    if existing is not None:
        raise ValueError("An account with this mobile number already exists.")
    if normalized_email and db.scalar(select(User.id).where(User.user_email == normalized_email)) is not None:
        raise ValueError("An account with this email address already exists.")

    user_id = None
    if db.get_bind().dialect.name == "sqlite":
        user_id = db.execute(insert(UserIdSequence).returning(UserIdSequence.id)).scalar_one()

    user = User(
        id=user_id,
        user_name=request.name,
        user_email=normalized_email,
        user_mobile=request.mobile,
        user_addr1=request.address_line1 or None,
        user_addr2=request.address_line2 or None,
        pincode=request.pincode,
        password=password_hash.hash(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def customer_by_identifier(db: Session, identifier: str) -> User | None:
    normalized = identifier.strip().casefold()
    matches = db.scalars(
        select(User).where(
            (User.user_email == normalized) | (User.user_mobile == identifier.strip())
        )
    ).all()
    return matches[0] if len(matches) == 1 else None


def verify_customer_password(user: User | None, password: str) -> bool:
    if user is None:
        password_hash.verify(password, dummy_customer_password_hash)
        return False
    try:
        return password_hash.verify(password, user.password)
    except (ValueError, TypeError):
        return False


def new_customer_session(db: Session, user_id: int) -> str:
    token = token_urlsafe(32)
    db.add(
        CustomerSession(
            token_hash=sha256(token.encode()).hexdigest(),
            user_id=user_id,
            expires_at=datetime.now(UTC) + timedelta(hours=settings.session_ttl_hours),
        )
    )
    db.commit()
    return token


def active_customer(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    token_hash = sha256(token.encode()).hexdigest()
    session = db.scalar(select(CustomerSession).where(CustomerSession.token_hash == token_hash))
    if session is None:
        return None
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        db.delete(session)
        db.commit()
        return None
    return session.user


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.user_name,
        "email": user.user_email,
        "mobile": user.user_mobile,
        "address_line1": user.user_addr1,
        "address_line2": user.user_addr2,
        "pincode": user.pincode,
        "is_admin": user.is_admin,
    }


def public_admin_customer(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.user_name,
        "email": user.user_email,
        "mobile": user.user_mobile,
        "is_admin": user.is_admin,
    }


def public_admin_order_summary(order: Order) -> dict:
    return {
        "order_id": order.order_number,
        "placed_at": order.created_at,
        "customer_name": order.customer_name,
        "phone": order.phone,
        "item_count": sum(item.quantity for item in order.items),
        "total": int(order.total),
        "payment_method": order.payment_method,
        "delivery_status": order.delivery_status,
    }