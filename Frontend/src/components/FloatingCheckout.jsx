import { Link, useLocation } from 'react-router-dom';
import Icon from './Icons.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatINR } from '../data/products.js';

export default function FloatingCheckout() {
  const { count, subtotal } = useCart();
  const { pathname } = useLocation();

  if (count === 0 || pathname === '/checkout') return null;

  return (
    <Link to="/checkout" className="floating-checkout" aria-label={`Checkout ${count} items, ${formatINR(subtotal)}`}>
      <span className="fc-count">
        <Icon name="shopping-cart" size={18} />
        {count}
      </span>
      <span className="fc-total">{formatINR(subtotal)}</span>
      <span className="fc-cta">
        Checkout <Icon name="arrow-right" size={18} />
      </span>
    </Link>
  );
}
