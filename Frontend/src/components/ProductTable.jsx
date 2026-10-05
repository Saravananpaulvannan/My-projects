import QuantityStepper from './QuantityStepper.jsx';
import { formatINR } from '../data/products.js';

export const MAX_QTY = 999;

export default function ProductTable({ rows, getQty, onSetQty, footer, mobileProductView = false }) {
  const allSelected = rows.length > 0 && rows.every((p) => getQty(p.id) > 0);
  const someSelected = rows.some((p) => getQty(p.id) > 0);

  const setQty = (product, qty) => onSetQty(product, Math.min(MAX_QTY, Math.max(0, qty)));

  const toggleAll = () =>
    rows.forEach((p) => {
      const qty = getQty(p.id);
      if (allSelected) setQty(p, 0);
      else if (!qty) setQty(p, 1);
    });

  return (
    <div className="card table-card">
      <div className="table-wrap">
        <table className={`admin-table ${mobileProductView ? 'mobile-product-table' : ''}`}>
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  aria-label="Select all products"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                />
              </th>
              <th className="col-no">S.No</th>
              <th className="col-name">Product</th>
              <th className="col-category">Category</th>
              <th className="col-pack">Pack</th>
              <th className="num col-mrp">MRP</th>
              <th className="num col-price">Price</th>
              <th className="col-mobile-price">Price</th>
              <th className="col-qty">Qty</th>
              <th className="num col-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const qty = getQty(p.id);
              return (
                <tr key={p.id} className={qty ? 'selected' : ''}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={qty > 0}
                      onChange={() => setQty(p, qty ? 0 : 1)}
                    />
                  </td>
                  <td className="col-no">{p.id}</td>
                  <td className="col-name">{p.name}</td>
                  <td className="col-category muted">{p.category}</td>
                  <td className="col-pack muted">{p.unit}</td>
                  <td className="num mrp col-mrp">{formatINR(p.mrp)}</td>
                  <td className="num strong col-price">{formatINR(p.price)}</td>
                  <td className="col-mobile-price">
                    <div className="mobile-price-lines">
                      <strong>{formatINR(p.price)}</strong>
                      <span className="mrp">{formatINR(p.mrp)}</span>
                      <small>{Math.round(((p.mrp - p.price) / p.mrp) * 100)}% off</small>
                    </div>
                  </td>
                  <td className="col-qty">
                    <QuantityStepper
                      qty={qty}
                      label={p.name}
                      className="qty-sm"
                      onDecrease={() => setQty(p, qty - 1)}
                      onIncrease={() => setQty(p, qty + 1)}
                    />
                  </td>
                  <td className="num strong col-total">{qty ? formatINR(p.price * qty) : '-'}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan="10" className="empty">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
