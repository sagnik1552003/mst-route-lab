import { useEffect, useState } from 'react';
import MstLab from './MstLab.jsx';
import { loadPandals } from './lib/pandals.js';
import { getInitialTheme } from './lib/theme.js';

// The page reads PANDALS synchronously everywhere (see lib/pandals.js), so
// nothing mounts until the dataset has loaded once.
export default function App() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', getInitialTheme());
  }, []);

  const load = () => {
    setStatus('loading');
    loadPandals()
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'));
  };
  useEffect(load, []);

  if (status === 'ready') return <MstLab />;
  return (
    <div className="boot" role={status === 'error' ? 'alert' : 'status'} aria-live="polite">
      <img src="/images/durga-face.png" alt="" width="40" height="40" />
      <p>{status === 'error' ? "Couldn't load the pandal data." : 'Loading pandals…'}</p>
      {status === 'error' && (
        <button type="button" className="btn btn-primary" onClick={load}>
          Retry
        </button>
      )}
    </div>
  );
}
