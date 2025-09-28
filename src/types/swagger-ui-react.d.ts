declare module 'swagger-ui-react' {
  import * as React from 'react';

  type DocExpansion = 'list' | 'full' | 'none';

  // Props mínimas que usamos (puedes ampliar si lo necesitas)
  export interface SwaggerUIProps {
    url?: string;
    spec?: Record<string, unknown>;
    docExpansion?: DocExpansion;
    defaultModelsExpandDepth?: number;
    defaultModelExpandDepth?: number;
    tryItOutEnabled?: boolean;
    presets?: unknown[];
  }

  const SwaggerUI: React.ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}

declare module 'swagger-ui-react/swagger-ui.css';
