import Icon from './Icons.jsx';

export default function QuantityStepper({ qty, onDecrease, onIncrease, label = 'item', className = '' }) {
  return (
    <div className={`qty ${className}`.trim()}>
      <button type="button" aria-label={`Decrease ${label} quantity`} onClick={onDecrease}>
        <Icon name="minus" size={16} />
      </button>
      <span aria-live="polite">{qty}</span>
      <button type="button" aria-label={`Increase ${label} quantity`} onClick={onIncrease}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
