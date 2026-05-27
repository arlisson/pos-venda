import React from 'react';

/**
 * Executa a rotina card.
 */
function Card({ children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-body">
        {children}
      </div>
    </section>
  );
}

export default Card;
