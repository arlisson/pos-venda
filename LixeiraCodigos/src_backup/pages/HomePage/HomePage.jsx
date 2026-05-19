import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';

import './HomePage.css';

function HomePage() {
  return (
    <LayoutPrivado>
      <section className="home-page">
        <h1 className="home-page__title">Pós-venda</h1>
        <p className="home-page__subtitle">
          Bem-vindo ao sistema.
        </p>
      </section>
    </LayoutPrivado>
  );
}

export default HomePage;