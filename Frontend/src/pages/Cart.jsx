import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { formatINR } from '../data/products.js';
import Icon from '../components/Icons.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';

export default function Cart() {
  const { items, subtotal, updateQty, removeFromCart, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Your Cart</h1>
        <div className="empty card">
          <div className="empty-icon"><Icon name="shopping-cart" size={56} strokeWidth={1.5} /></div>
          <p>Your cart is empty.</p>
          <Link to="/products" className="btn btn-primary">Browse Products</Link>
        </div>
      </div>
    );
  }

  const savings = items.reduce((s, i) => s + (i.mrp - i.price) * i.qty, 0);

  return (
    <div className="page">
      <h1 className="page-title">Your Cart</h1>

      <div className="cart-layout">
        <div className="card cart-items">
          {items.map((i) => (
            <div className="cart-row" key={i.id}>
              <div className="cart-thumb">
                <Icon name={i.icon} size={30} />
              </div>
              <div className="cart-info">
                <h3>{i.name}</h3>
                <span className="product-unit">{i.unit} · {formatINR(i.price)}</span>
              </div>
              <QuantityStepper
                qty={i.qty}
                label={i.name}
                onDecrease={() => updateQty(i.id, i.qty - 1)}
                onIncrease={() => updateQty(i.id, i.qty + 1)}
              />
              <div className="cart-total">{formatINR(i.price * i.qty)}</div>
              <button className="remove" aria-label={`Remove ${i.name}`} onClick={() => removeFromCart(i.id)}>
                <Icon name="trash-2" size={16} />
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={clearCart}>
            <Icon name="x" size={16} /> Clear cart
          </button>
        </div>

        <div className="card summary">
          <h2>Order Summary</h2>
          <div className="summary-row"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
          <div className="summary-row savings"><span>You save</span><span>{formatINR(savings)}</span></div>
          <div className="summary-row"><span>Delivery</span><span>No charge</span></div>
          <div className="summary-row total"><span>Total</span><span>{formatINR(subtotal)}</span></div>

          <p className="notice">Minimum order depends on the delivery state and is confirmed at checkout.</p>
          <Link to="/checkout" className="btn btn-primary full">Proceed to Checkout</Link>
          <Link to="/products" className="link center">
            <Icon name="arrow-left" size={16} /> Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
