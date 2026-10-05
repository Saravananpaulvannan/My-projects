const categoryIcons = {
  'Sound Crackers': 'zap',
  'Flower Pots': 'flower',
  'Fancy Novelties': 'party-popper',
  'Night Specials': 'moon',
  'Kids Specials': 'baby',
  'Sky Shots': 'sparkles',
  'Multi Shots': 'rainbow',
  Chakkars: 'disc-3',
  Garlands: 'link',
  Bombs: 'bomb',
  Rockets: 'rocket',
  Sparklers: 'star',
  'Matches & Caps': 'flame',
  'Gift Boxes': 'gift',
  'Combo Packs': 'package',
};

export const formatUnit = (per, pcs) => {
  if (pcs == null) return `1 ${per}`;
  return `1 ${per} · ${typeof pcs === 'number' ? `${pcs} Pcs` : pcs}`;
};

export const toProduct = (product) => ({
  ...product,
  unit: formatUnit(product.pack_unit, product.pieces),
  icon: categoryIcons[product.category] || 'sparkles',
});

export const formatINR = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
