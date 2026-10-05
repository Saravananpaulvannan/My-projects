---
description: "Rules for using icons in the Aaradhaya Crackers React app (Lucide icons via the shared Icon component)."
applyTo: "src/**/*.{js,jsx}"
---

# Icon Usage Rules

- All icons come from **Lucide** (https://lucide.dev/icons/) via the `lucide-react` package.
- Always render icons through the shared component `src/components/Icons.jsx`:
  ```jsx
  import Icon from '../components/Icons.jsx';
  <Icon name="shopping-cart" size={20} />
  ```
- Do **not** import from `lucide-react` anywhere except `src/components/Icons.jsx`.
- Do **not** use emojis, inline SVGs, icon fonts or other icon libraries in the UI.
- `name` must be the kebab-case icon name exactly as shown on lucide.dev (e.g. `party-popper`, `trash-2`).
- To use a new icon: import it in `Icons.jsx` and add it to the `registry` map with its kebab-case key. Keep imports and keys alphabetical.
- Icons are decorative (`aria-hidden`). Icon-only buttons must have an `aria-label`.
- Use `size` and `strokeWidth` props for sizing; set colour via CSS `color` (icons use `currentColor`).
- Data files (e.g. `src/data/products.js`) store icon names as strings, never components.
