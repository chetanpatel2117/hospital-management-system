import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, description, onClose, children, wide = false }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-card${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button type="button" className="close-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}
