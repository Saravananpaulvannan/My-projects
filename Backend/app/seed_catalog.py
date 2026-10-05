import json
from pathlib import Path

from app.database import SessionLocal
from app.models import Product


def seed_catalog(catalog_path: Path | None = None) -> int:
    catalog_path = catalog_path or Path(__file__).resolve().parents[1] / "catalog.json"
    if not catalog_path.exists():
        raise SystemExit("Catalog file missing. Run `npm --prefix Frontend run export-catalog` first.")

    records = json.loads(catalog_path.read_text(encoding="utf-8"))
    inserted = 0
    with SessionLocal.begin() as db:
        for record in records:
            if db.get(Product, record["id"]) is not None:
                continue
            db.add(Product(**record))
            inserted += 1
    return inserted


if __name__ == "__main__":
    print(f"Imported {seed_catalog()} new products; existing catalog records were preserved.")