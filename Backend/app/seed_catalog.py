import json
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Product


def seed_catalog() -> int:
    catalog_path = Path(__file__).resolve().parents[1] / "catalog.json"
    if not catalog_path.exists():
        raise SystemExit("Catalog file missing. Run `npm --prefix Frontend run export-catalog` first.")

    records = json.loads(catalog_path.read_text(encoding="utf-8"))
    with SessionLocal.begin() as db:
        db.query(Product).update({Product.is_active: False})
        for record in records:
            product = db.get(Product, record["id"])
            if product is None:
                product = Product(id=record["id"])
                db.add(product)
            product.name = record["name"]
            product.category = record["category"]
            product.mrp = record["mrp"]
            product.price = record["price"]
            product.pack_unit = record["pack_unit"]
            product.pieces = record["pieces"]
            product.is_active = True
    return len(records)


if __name__ == "__main__":
    print(f"Seeded {seed_catalog()} products.")