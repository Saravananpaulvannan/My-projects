import { useEffect, useState } from 'react';
import Icon from '../components/Icons.jsx';
import { formatINR } from '../data/products.js';
import {
  downloadAdminOrderPdf,
  getAdminOrder,
  getAdminOrders,
  updateAdminOrderDeliveryStatus,
} from '../services/api.js';

const DELIVERY_STATUSES = ['Placed', 'Packed', 'Shipped', 'Delivered'];
const PAGE_SIZE = 10;

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AdminOrders() {
  const [page, setPage] = useState(1);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [pdfId, setPdfId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAdminOrders({ page, pageSize: PAGE_SIZE, deliveryStatus })
      .then((data) => active && setResult(data))
      .catch((requestError) => active && setError(requestError.message || 'Unable to load orders.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, deliveryStatus]);

  const changeFilter = (event) => {
    setDeliveryStatus(event.target.value);
    setPage(1);
  };

  const updateStatus = async (order, nextStatus) => {
    setUpdatingId(order.order_id);
    setError('');
    try {
      const updated = await updateAdminOrderDeliveryStatus(order.order_id, nextStatus);
      setResult((current) => current && ({
        ...current,
        orders: current.orders.map((item) => item.order_id === order.order_id
          ? { ...item, delivery_status: updated.delivery_status }
          : item),
      }));
      setSelectedOrder((current) => current?.order_id === order.order_id ? updated : current);
    } catch (requestError) {
      setError(requestError.message || 'Unable to update delivery status.');
    } finally {
      setUpdatingId('');
    }
  };

  const showDetails = async (orderNumber) => {
    setDetailsLoading(true);
    setSelectedOrder(null);
    setError('');
    try {
      setSelectedOrder(await getAdminOrder(orderNumber));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load order details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const downloadPdf = async (orderNumber) => {
    setPdfId(orderNumber);
    setError('');
    try {
      const { blob, filename } = await downloadAdminOrderPdf(orderNumber);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.message || 'Unable to generate the order PDF.');
    } finally {
      setPdfId('');
    }
  };

  const totalPages = result?.total_pages || 0;
  const pageNumbers = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [...new Set([1, page - 1, page, page + 1, totalPages])].filter((value) => value > 0 && value <= totalPages).sort((a, b) => a - b);

  return (
    <section className="admin-orders" aria-labelledby="admin-orders-title">
      <div className="admin-section-head">
        <div>
          <h2 id="admin-orders-title">Orders</h2>
          <p>Review orders and update delivery progress.</p>
        </div>
        <label className="field admin-order-filter">
          <span>Delivery status</span>
          <select className="input select" value={deliveryStatus} onChange={changeFilter}>
            <option value="">All statuses</option>
            {DELIVERY_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading orders...</p> : error || !result ? null : result.orders.length === 0 ? (
        <div className="admin-empty"><p>No orders found.</p></div>
      ) : (
        <>
          <div className="admin-data-wrap">
            <table className="admin-data-table admin-order-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Delivery</th><th>Actions</th></tr></thead>
              <tbody>
                {result.orders.map((order) => (
                  <tr key={order.order_id}>
                    <td><strong>{order.order_id}</strong></td>
                    <td><span className="admin-order-customer">{order.customer_name}<small>{order.phone}</small></span></td>
                    <td>{formatDate(order.placed_at)}</td>
                    <td>{order.item_count}</td>
                    <td>{formatINR(order.total)}</td>
                    <td><span className="admin-status neutral">Due on delivery</span></td>
                    <td>
                      <select
                        className={`input select admin-status-select ${order.delivery_status.toLowerCase()}`}
                        value={order.delivery_status}
                        aria-label={`Delivery status for order ${order.order_id}`}
                        disabled={updatingId !== ''}
                        onChange={(event) => updateStatus(order, event.target.value)}
                      >
                        {DELIVERY_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                      {updatingId === order.order_id && <small className="admin-updating">Updating...</small>}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" className="icon-btn" aria-label={`View order ${order.order_id}`} title="View details" onClick={() => showDetails(order.order_id)}><Icon name="eye" size={17} /></button>
                        <button type="button" className="icon-btn" aria-label={`Download PDF for ${order.order_id}`} title={pdfId === order.order_id ? 'Generating PDF...' : 'Download PDF'} disabled={pdfId !== ''} onClick={() => downloadPdf(order.order_id)}><Icon name="download" size={17} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination" aria-label="Order pages">
            <span>{result.total_items} orders</span>
            <div>
              <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
              {pageNumbers.map((number, index) => (
                <span className="admin-page-number" key={number}>
                  {index > 0 && number - pageNumbers[index - 1] > 1 && <span aria-hidden="true">...</span>}
                  <button type="button" className={`btn ${number === page ? 'btn-primary' : 'btn-outline'}`} aria-current={number === page ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>
                </span>
              ))}
              <button type="button" className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          </div>
        </>
      )}

      {(selectedOrder || detailsLoading) && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedOrder(null)}>
          <div className="modal admin-order-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
            <div className="modal-head">
              <h2 id="order-detail-title">{detailsLoading ? 'Loading order...' : `Order ${selectedOrder.order_id}`}</h2>
              <button type="button" className="icon-btn" aria-label="Close order details" onClick={() => setSelectedOrder(null)}><Icon name="x" size={18} /></button>
            </div>
            {detailsLoading ? <p role="status">Loading order details...</p> : (
              <div className="admin-order-details">
                <dl className="admin-detail-grid">
                  <div><dt>Customer</dt><dd>{selectedOrder.customer.name}</dd></div>
                  <div><dt>Contact</dt><dd>{selectedOrder.customer.phone}{selectedOrder.customer.email ? ` · ${selectedOrder.customer.email}` : ''}</dd></div>
                  <div><dt>Delivery address</dt><dd>{[selectedOrder.customer.address, selectedOrder.customer.city, selectedOrder.customer.state, selectedOrder.customer.pincode].filter(Boolean).join(', ')}</dd></div>
                  <div><dt>Order date</dt><dd>{formatDate(selectedOrder.placed_at)}</dd></div>
                  <div><dt>Payment status</dt><dd>Due on delivery (COD)</dd></div>
                  <div><dt>Delivery status</dt><dd>{selectedOrder.delivery_status}</dd></div>
                </dl>
                <div className="admin-data-wrap">
                  <table className="admin-data-table admin-detail-items">
                    <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
                    <tbody>{selectedOrder.items.map((item, index) => <tr key={`${item.product_id}-${index}`}><td>{item.name}<small>{item.pack_unit}</small></td><td>{item.quantity}</td><td>{formatINR(item.price)}</td><td>{formatINR(item.line_total)}</td></tr>)}</tbody>
                  </table>
                </div>
                <div className="admin-order-totals"><span>Subtotal</span><strong>{formatINR(selectedOrder.subtotal)}</strong><span>Delivery</span><strong>{formatINR(selectedOrder.delivery_fee)}</strong><span>Total</span><strong>{formatINR(selectedOrder.total)}</strong></div>
                <div className="admin-order-detail-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setSelectedOrder(null)}>Close</button>
                  <button type="button" className="btn btn-primary" disabled={pdfId !== ''} onClick={() => downloadPdf(selectedOrder.order_id)}><Icon name="download" size={17} /> {pdfId === selectedOrder.order_id ? 'Generating PDF...' : 'Download PDF'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}