'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Nota: .then(m => m.default) para asegurar el default export
const SwaggerUI = dynamic(
  () => import('swagger-ui-react').then(m => m.default),
  { ssr: false }
);

export default function DocsPage() {
  return (
    <div style={{ height: '100vh' }}>
      <SwaggerUI
        url="/api/openapi"
        docExpansion="none"
        defaultModelsExpandDepth={-1}
        tryItOutEnabled
      />
    </div>
  );
}
