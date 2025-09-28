import Link from 'next/link';

export default function Home() {
  return (
    <main className="hero">
      <div className="hero__glass">
        <h1>FitTracker Simple API</h1>
        <p className="lead">
          API para registro de comidas, fotos, rachas y notificaciones. JWT (access/refresh). Simple. Clara. Rápida.
        </p>

        <div className="badges">
          <span className="badge">v1.0.0</span>
          <span className="badge badge--green">OAS 3.0</span>
          <span className="badge badge--blue">Ready on Vercel</span>
        </div>

        <div className="cta">
          <Link href="/docs" className="btn btn--primary">Abrir documentación</Link>
          <a href="/api/openapi" className="btn btn--ghost">Descargar OpenAPI</a>
        </div>

        <div className="grid">
          <div className="card">
            <h3>Auth</h3>
            <p>Registro, login y refresh con JWT.</p>
            <code>POST /api/auth/login</code>
          </div>
          <div className="card">
            <h3>Users</h3>
            <p>Perfil y administración básica.</p>
            <code>GET /api/users/me</code>
          </div>
          <div className="card">
            <h3>Records</h3>
            <p>Comidas con foto y notas.</p>
            <code>POST /api/records</code>
          </div>
          <div className="card">
            <h3>Streaks</h3>
            <p>Rachas diarias y progreso.</p>
            <code>GET /api/streaks</code>
          </div>
        </div>

        <footer className="footer">
          <span>© {new Date().getFullYear()} FitTracker API</span>
        </footer>
      </div>
    </main>
  );
}
