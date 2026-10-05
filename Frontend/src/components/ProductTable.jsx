import QuantityStepper from './QuantityStepper.jsx';
import { formatINR } from '../data/products.js';

export const MAX_QTY = 999;

export default function ProductTable({ rows, getQty, onSetQty, footer }) {
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
        <table className="admin-table">
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
              <th>Product</th>
              <th>Category</th>
              <th>Pack</th>
              <th className="num">MRP</th>
              <th className="num">Price</th>
              <th className="col-qty">Qty</th>
              <th className="num">Amount</th>
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
                  <td className="muted">{p.category}</td>
                  <td className="muted">{p.unit}</td>
                  <td className="num mrp">{formatINR(p.mrp)}</td>
                  <td className="num strong">{formatINR(p.price)}</td>
                  <td className="col-qty">
                    <QuantityStepper
                      qty={qty}
                      label={p.name}
                      className="qty-sm"
                      onDecrease={() => setQty(p, qty - 1)}
                      onIncrease={() => setQty(p, qty + 1)}
                    />
                  </td>
                  <td className="num strong">{qty ? formatINR(p.price * qty) : '-'}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan="9" className="empty">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
