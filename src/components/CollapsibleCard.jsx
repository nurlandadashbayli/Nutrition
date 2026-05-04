import React, { useState } from 'react';

export default function CollapsibleCard({ title, children, defaultOpen = false, count, style = {} }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card collapsible-card" style={style}>
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>{title}</h3>
          {count !== undefined && (
            <span className="collapsible-count">{count}</span>
          )}
        </div>
        <span className={`collapsible-chevron ${open ? 'open' : ''}`}>▾</span>
      </div>
      {open && (
        <div className="collapsible-body">
          {children}
        </div>
      )}
    </div>
  );
}
