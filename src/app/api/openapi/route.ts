// app/api/openapi/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reusa tu preflight centralizado
export { makeOptions as OPTIONS } from "../_lib/http";

// Tipado ancho pero sin `any`
type OpenAPISpec = Record<string, unknown>;

export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "FitTracker Simple API",
      version: "1.0.0",
      description:
        "API para registro de comidas con foto, rachas y notificaciones. Auth JWT (access/refresh).",
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "auth" },
      { name: "users" },
      { name: "records" },
      { name: "streaks" },
      { name: "notifications" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: { ok: { type: "boolean" }, error: { type: "string" } },
          example: { ok: false, error: "Bad Request" },
        },
        TokenPair: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
          },
          required: ["accessToken", "refreshToken"],
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            name: { type: "string", nullable: true },
            avatar_url: { type: "string", nullable: true },
            tz: { type: "string" },
            settings: { type: "object", additionalProperties: true },
            last_login_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        },
        RefreshRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        },
        Record: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
            note: { type: "string", nullable: true },
            photo_url: { type: "string" },
            thumbnail_url: { type: "string", nullable: true },
            upload_id: { type: "string", format: "uuid", nullable: true },
            client_tz: { type: "string" },
            recorded_at: { type: "string", format: "date-time" },
            local_date: { type: "string", format: "date" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        CreateRecordRequest: {
          type: "object",
          required: ["meal_type", "photoUrl", "clientTz"],
          properties: {
            meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
            note: { type: "string", nullable: true },
            photoUrl: { type: "string" },
            thumbnailUrl: { type: "string", nullable: true },
            uploadId: { type: "string", format: "uuid", nullable: true },
            clientTz: { type: "string" },
            recordedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        StreakResponse: {
          type: "object",
          properties: { current: { type: "integer" }, max: { type: "integer" } },
        },
        DeviceTokenRequest: {
          type: "object",
          required: ["provider", "token", "device_os"],
          properties: {
            provider: { type: "string", enum: ["expo", "fcm", "apns"] },
            token: { type: "string" },
            device_os: { type: "string", enum: ["android", "ios", "web"] },
            device_model: { type: "string", nullable: true },
          },
        },
        DeviceToken: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            provider: { type: "string" },
            token: { type: "string" },
            device_os: { type: "string" },
            device_model: { type: "string", nullable: true },
            last_seen_at: { type: "string", format: "date-time" },
          },
        },
        PresignRequest: {
          type: "object",
          required: ["filename", "contentType"],
          properties: {
            filename: { type: "string" },
            contentType: { type: "string" },
          },
        },
        PresignResponse: {
          type: "object",
          properties: {
            uploadUrl: { type: "string" },
            fileUrl: { type: "string" },
            uploadId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    paths: {
      "/api/auth/register": {
        post: {
          tags: ["auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } },
            },
          },
          responses: {
            "201": {
              description: "Usuario creado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      user: { $ref: "#/components/schemas/User" },
                      accessToken: { type: "string" },
                      refreshToken: { type: "string" },
                    },
                  },
                },
              },
            },
            "409": {
              description: "Email ya existe",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } },
            },
          },
          responses: {
            "200": {
              description: "Login ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      user: { $ref: "#/components/schemas/User" },
                      accessToken: { type: "string" },
                      refreshToken: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Credenciales inválidas",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RefreshRequest" } },
            },
          },
          responses: {
            "200": {
              description: "Tokens nuevos",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TokenPair" } },
              },
            },
            "401": {
              description: "Refresh inválido",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/users/me": {
        get: {
          tags: ["users"],
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Perfil del usuario",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No autorizado",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/records": {
        get: {
          tags: ["records"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
          ],
          responses: {
            "200": {
              description: "Listado paginado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      items: { type: "array", items: { $ref: "#/components/schemas/Record" } },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No autorizado",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
        post: {
          tags: ["records"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateRecordRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Registro creado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      record: { $ref: "#/components/schemas/Record" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No autorizado",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/streaks": {
        get: {
          tags: ["streaks"],
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Rachas",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      streak: { $ref: "#/components/schemas/StreakResponse" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No autorizado",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/device-tokens": {
        post: {
          tags: ["notifications"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DeviceTokenRequest" } },
            },
          },
          responses: {
            "200": {
              description: "Token guardado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      device: { $ref: "#/components/schemas/DeviceToken" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No autorizado",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      }
    },
  } as const satisfies OpenAPISpec;

  // ✅ GET público (sin credenciales): CORS abierto
  return new Response(JSON.stringify(spec), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*", // seguro aquí, no hay cookies/credenciales
    },
  });
}
