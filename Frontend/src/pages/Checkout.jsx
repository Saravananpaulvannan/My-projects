import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { formatINR, formatUnit } from '../data/products.js';
import Icon from '../components/Icons.jsx';
import { downloadOrderPdf } from '../utils/orderPdf.js';
import { useAuth } from '../context/AuthContext.jsx';
import { createOrder } from '../services/api.js';

const initialForm = { name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', payment: 'cod' };
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
];
const PAYMENT_OPTIONS = [
  { v: 'cod', l: 'Cash on Delivery', icon: 'banknote' },
  { v: 'upi', l: 'UPI', icon: 'smartphone', disabled: true },
  { v: 'bank', l: 'Bank Transfer', icon: 'landmark', disabled: true },
];

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Please enter your full name';
  if (!/^[6-9]\d{9}$/.test(f.phone)) e.phone = 'Enter a valid 10-digit mobile number';
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email';
  if (f.address.trim().length < 10) e.address = 'Please enter your complete address';
  if (!f.city.trim()) e.city = 'City is required';
  if (!f.state) e.state = 'State is required';
  if (!/^\d{6}$/.test(f.pincode)) e.pincode = 'Enter a valid 6-digit pincode';
  return e;
}

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { isAdmin } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [order, setOrder] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  if (order) {
    return (
      <div className="page">
        <div className="card success">
          <div className="empty-icon success-icon"><Icon name="party-popper" size={56} strokeWidth={1.5} /></div>
          <h1>Order Placed!</h1>
          <p>Thank you, {order.customer.name}. Your order <strong>#{order.orderId}</strong> has been received.</p>
          <p>Our team will call you on {order.customer.phone} to confirm delivery.</p>
          <p className="muted-text">Your order copy has been downloaded. If it didn&apos;t start, use the button below.</p>
          <div className="success-actions">
            <button type="button" className="btn btn-outline" onClick={() => downloadOrderPdf({ ...order, branded: true })}>
              <Icon name="download" size={18} /> Download Order Copy
            </button>
            <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Checkout</h1>
        <div className="empty card">
          <div className="empty-icon"><Icon name="shopping-bag" size={56} strokeWidth={1.5} /></div>
          <p>Your cart is empty. Add some products to continue.</p>
          <Link to="/products" className="btn btn-primary">Browse Products</Link>
        </div>
      </div>
    );
  }

  const minimumOrder = form.state === 'Tamil Nadu' ? 3000 : 5000;
  const belowMin = Boolean(form.state) && subtotal < minimumOrder;

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length || belowMin) return;
    setBusy(true);
    setSubmitError('');
    try {
      const savedOrder = await createOrder({
        customer: {
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
        },
        payment_method: 'cod',
        items: items.map(({ id, qty }) => ({ product_id: id, quantity: qty })),
      });
      const placed = {
        orderId: savedOrder.order_id,
        placedAt: savedOrder.placed_at,
        items: savedOrder.items.map((item) => ({
          id: item.product_id,
          name: item.name,
          unit: formatUnit(item.pack_unit, item.pieces),
          mrp: item.mrp,
          price: item.price,
          qty: item.quantity,
        })),
        subtotal: savedOrder.subtotal,
        deliveryFee: savedOrder.delivery_fee,
        customer: savedOrder.customer,
        paymentMethod: 'Cash on Delivery',
      };
      setOrder(placed);
      downloadOrderPdf({ ...placed, branded: true });
      clearCart();
    } catch (error) {
      setSubmitError(error.message || 'Unable to place your order. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = (branded) =>
    downloadOrderPdf({ items, subtotal, deliveryFee: 0, customer: form, branded });

  const field = (name, label, props = {}) => (
    <label className="field">
      <span>{label}</span>
      <input className={`input ${errors[name] ? 'invalid' : ''}`} name={name} value={form[name]} onChange={onChange} {...props} />
      {errors[name] && <small className="error">{errors[name]}</small>}
    </label>
  );

  return (
    <div className="page">
      <h1 className="page-title">Checkout</h1>

      <form className="cart-layout" onSubmit={onSubmit} noValidate>
        <div className="card">
          <h2>Delivery Details</h2>
          <div className="form-grid">
            {field('name', 'Full Name *', { autoComplete: 'name' })}
            {field('phone', 'Mobile Number *', { type: 'tel', maxLength: 10, autoComplete: 'tel' })}
            {field('email', 'Email (optional)', { type: 'email', autoComplete: 'email' })}
            {field('city', 'City *', { autoComplete: 'address-level2' })}
            <label className="field">
              <span>State *</span>
              <select className={`input ${errors.state ? 'invalid' : ''}`} name="state" value={form.state} onChange={onChange} autoComplete="address-level1">
                <option value="">Select state or union territory</option>
                {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              {errors.state && <small className="error">{errors.state}</small>}
            </label>
            <label className="field span-2">
              <span>Address *</span>
              <textarea
                className={`input ${errors.address ? 'invalid' : ''}`}
                name="address"
                rows="3"
                value={form.address}
                onChange={onChange}
                autoComplete="street-address"
              />
              {errors.address && <small className="error">{errors.address}</small>}
            </label>
            {field('pincode', 'Pincode *', { maxLength: 6, inputMode: 'numeric', autoComplete: 'postal-code' })}
          </div>

          <h2>Payment Method</h2>
          <div className="pay-options">
            {PAYMENT_OPTIONS.map((o) => (
              <label key={o.v} className={`pay-option ${form.payment === o.v ? 'active' : ''}`}>
                <input type="radio" name="payment" value={o.v} checked={form.payment === o.v} onChange={onChange} disabled={o.disabled} />
                <Icon name={o.icon} size={20} />
                <span>{o.l}{o.disabled && <small>Coming soon</small>}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="card summary">
          <h2>Your Order</h2>
          {items.map((i) => (
            <div className="summary-row small" key={i.id}>
              <span className="with-icon"><Icon name={i.icon} size={16} /> {i.name} × {i.qty}</span>
              <span>{formatINR(i.price * i.qty)}</span>
            </div>
          ))}
          <hr />
          <div className="summary-row"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
          <div className="summary-row"><span>Delivery</span><span>No charge</span></div>
          <div className="summary-row total"><span>Total</span><span>{formatINR(subtotal)}</span></div>
          {!form.state && <p className="notice">Minimum order is Rs. 3,000 within Tamil Nadu and Rs. 5,000 for other states.</p>}
          {belowMin && <p className="notice">Minimum order for {form.state} is {formatINR(minimumOrder)}.</p>}
          {submitError && <p className="error" role="alert">{submitError}</p>}
          <button type="submit" className="btn btn-primary full" disabled={busy || belowMin}>
            {busy ? 'Placing order...' : 'Place Order'}
          </button>
          {isAdmin && (
            <div className="pdf-actions">
              <span className="pdf-label">Download order as PDF</span>
              <button type="button" className="btn btn-outline" onClick={() => downloadPdf(true)}>
                <Icon name="download" size={16} /> With Brand
              </button>
              <button type="button" className="btn btn-outline" onClick={() => downloadPdf(false)}>
                <Icon name="download" size={16} /> Without Brand
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
