import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { formatINR } from '../data/products.js';
import Icon from './Icons.jsx';
import QuantityStepper from './QuantityStepper.jsx';

export default function ProductCard({ product }) {
  const { getQty, addToCart, updateQty } = useCart();
  const qty = getQty(product.id);
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);

  return (
    <article className="product-card">
      <Link className="product-card-link" to={`/products/${product.id}`} aria-label={`View details for ${product.name}`}>
        <div className="product-img">
          {product.image_url
            ? <img src={product.image_url} alt={product.name} loading="lazy" />
            : <Icon name={product.icon} size={46} strokeWidth={1.5} />}
          <span className="discount-tag">{discount}% OFF</span>
        </div>
        <div className="product-body">
          <span className="product-cat">{product.category}</span>
          <h3>{product.name}</h3>
          <span className="product-unit">{product.unit}</span>
          <div className="price-row">
            <span className="price">{formatINR(product.price)}</span>
            <span className="mrp">{formatINR(product.mrp)}</span>
          </div>
        </div>
      </Link>
      <div className="product-card-actions">
        {qty > 0 ? (
          <div className="card-actions">
            <QuantityStepper
              qty={qty}
              label={product.name}
              className="qty-lg"
              onDecrease={() => updateQty(product.id, qty - 1)}
              onIncrease={() => updateQty(product.id, qty + 1)}
            />
            <span className="in-cart">{formatINR(product.price * qty)}</span>
          </div>
        ) : (
          <button type="button" className="btn btn-primary full" onClick={() => addToCart(product)}>
            <Icon name="shopping-cart" size={16} /> Add to Cart
          </button>
        )}
      </div>
      </article>
  );
}
