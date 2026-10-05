import { createContext, useContext, useEffect, useState } from 'react';
import { getCategories, getProducts } from '../services/api.js';
import { toProduct } from '../data/products.js';

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    Promise.all([getProducts(), getCategories()])
      .then(([productRows, categoryRows]) => {
        if (controller.signal.aborted) return;
        setProducts(productRows.map(toProduct));
        setCategories(['All', ...categoryRows]);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError.message || 'Unable to load the catalog.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reload]);

  const refresh = () => setReload((value) => value + 1);

  return (
    <CatalogContext.Provider value={{ products, categories, loading, error, refresh }}>
      {children}
    </CatalogContext.Provider>
  );
}

export const useCatalog = () => useContext(CatalogContext);