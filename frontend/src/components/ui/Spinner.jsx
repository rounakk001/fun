import './Spinner.css';

/**
 * Spinner — simple animated loading indicator.
 *
 * Props:
 *   fullPage {boolean} — centers spinner in the full viewport (used during boot)
 *   size     {string}  — 'sm' | 'md' (default) | 'lg'
 */
function Spinner({ fullPage = false, size = 'md' }) {
  const spinner = (
    <div className={`spinner spinner--${size}`} role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
    </div>
  );

  if (fullPage) {
    return <div className="spinner-overlay">{spinner}</div>;
  }

  return spinner;
}

export default Spinner;
