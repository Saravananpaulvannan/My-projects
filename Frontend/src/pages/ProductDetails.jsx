import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icons.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatINR, toProduct } from '../data/products.js';
import { getProduct } from '../services/api.js';

export default function ProductDetails() {
  const { productId } = useParams();
  const { addToCart, getQty, updateQty } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getProduct(productId, { signal: controller.signal })
      .then((record) => setProduct(toProduct(record)))
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setProduct(null);
          setError(requestError.message || 'Unable to load this product.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [productId]);

  if (loading) {
    return <div className="page" role="status">Loading product details...</div>;
  }

  if (error || !product) {
    return (
      <div className="page">
        <Link to="/products" className="link"><Icon name="arrow-left" size={16} /> Back to products</Link>
        <div className="card" role="alert">{error || 'Product not found.'}</div>
      </div>
    );
  }

  const quantity = getQty(product.id);
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);

  return (
    <div className="page">
      <Link to="/products" className="link"><Icon name="arrow-left" size={16} /> Back to products</Link>
      <div className="product-detail">
        <div className="card product-detail-visual" aria-label={`${product.name} product image`}>
          {product.image_url
            ? <img src={product.image_url} alt={product.name} />
            : <Icon name={product.icon} size={120} strokeWidth={1.25} />}
        </div>
        <section className="card product-detail-info" aria-labelledby="product-detail-title">
          <span className="product-cat">{product.category}</span>
          <h1 id="product-detail-title">{product.name}</h1>
          {product.description && <p>{product.description}</p>}
          <div className="product-detail-price">
            <span className="price">{formatINR(product.price)}</span>
            <span className="mrp">{formatINR(product.mrp)}</span>
            <span className="discount-tag">{discount}% OFF</span>
          </div>
          <dl className="product-detail-meta">
            <div><dt>Product ID</dt><dd>{product.id}</dd></div>
            <div><dt>Pack</dt><dd>{product.unit}</dd></div>
            <div><dt>Category</dt><dd>{product.category}</dd></div>
            <div><dt>Listed MRP</dt><dd>{formatINR(product.mrp)}</dd></div>
            <div><dt>Offer price</dt><dd>{formatINR(product.price)}</dd></div>
            <div className="product-detail-save"><dt>You save</dt><dd>{formatINR(product.mrp - product.price)}</dd></div>
          </dl>
          <div className="product-detail-actions">
            {quantity > 0 ? (
              <QuantityStepper
                qty={quantity}
                label={product.name}
                className="qty-lg"
                onDecrease={() => updateQty(product.id, quantity - 1)}
                onIncrease={() => updateQty(product.id, quantity + 1)}
              />
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => addToCart(product)}>
                <Icon name="shopping-cart" size={18} /> Add to Cart
              </button>
            )}
            {quantity > 0 && <strong className="product-detail-cart-total">{formatINR(product.price * quantity)} in cart</strong>}
          </div>
        </section>
      </div>
    </div>
  );
}