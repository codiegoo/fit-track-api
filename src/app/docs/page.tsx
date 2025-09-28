'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Asegura el default export de swagger-ui-react
const SwaggerUI = dynamic(() => import('swagger-ui-react').then(m => m.default), {
  ssr: false,
});

export default function DocsPage() {
  return (
    <div className="docs-wrapper">
      <SwaggerUI url="/api/openapi" docExpansion="none" defaultModelsExpandDepth={-1} tryItOutEnabled />
    </div>
  );
}
