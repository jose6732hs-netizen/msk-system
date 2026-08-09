/** Especificação OpenAPI 3.1 das rotas públicas do LOVABLE MSK. */

const licenseObject = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["active", "inactive", "expired", "suspended", "revoked"] },
    plan: { type: "string", nullable: true },
    plan_name: { type: "string", nullable: true },
    expires_at: { type: "string", format: "date-time", nullable: true },
    max_devices: { type: "integer" },
    devices_used: { type: "integer" },
    features: { type: "object", additionalProperties: { type: "boolean" } },
  },
} as const;

const errorResponse = {
  description: "Erro (fail-closed)",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [false] },
          error: {
            type: "string",
            enum: [
              "RATE_LIMITED",
              "INVALID_REQUEST",
              "INVALID_LICENSE",
              "LICENSE_REVOKED",
              "LICENSE_SUSPENDED",
              "LICENSE_EXPIRED",
              "DEVICE_LIMIT_REACHED",
              "DEVICE_NOT_REGISTERED",
              "DEVICE_NOT_FOUND",
            ],
          },
          message: { type: "string" },
        },
      },
    },
  },
} as const;

function body(properties: Record<string, unknown>, required: string[]) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: { type: "object", required, properties },
      },
    },
  };
}

const token = { type: "string", minLength: 8, maxLength: 64, example: "MSK-XXXX-XXXX-XXXX-XXXX" };
const fingerprint = { type: "string", minLength: 8, maxLength: 256 };

export function openApiSpec(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "LOVABLE MSK — API de Licenciamento",
      version: "1.0.0",
      description:
        "API pública consumida pela extensão Chrome. Toda decisão de acesso é do backend (fail-closed). " +
        "Tokens são armazenados como hash SHA-256 com pepper — nunca em claro. " +
        "Rate limit por IP em todas as rotas. CORS restrito à origem da extensão quando EXTENSION_ORIGIN está configurada.",
    },
    servers: [{ url: `${origin}/api/public` }],
    tags: [
      { name: "Licença", description: "Ciclo de vida da licença e dispositivos" },
      { name: "Extensão", description: "Status remoto e runtime de compatibilidade" },
      { name: "Manutenção", description: "Rotinas agendadas protegidas por segredo" },
    ],
    components: {
      securitySchemes: {
        licenseToken: {
          type: "http",
          scheme: "bearer",
          description: "Token da licença (MSK-XXXX-...) enviado como Bearer.",
        },
        cronSecret: {
          type: "apiKey",
          in: "header",
          name: "x-cron-secret",
          description: "Segredo CRON_SECRET para rotinas agendadas.",
        },
      },
      schemas: { License: licenseObject },
    },
    paths: {
      "/license/activate": {
        post: {
          tags: ["Licença"],
          summary: "Ativa a licença e vincula o dispositivo (hardware binding)",
          description:
            "Respeita o limite de dispositivos do plano. Reativa o dispositivo se ele já existir.",
          requestBody: body(
            {
              token,
              device_fingerprint: fingerprint,
              extension_version: { type: "string", maxLength: 32 },
              browser: { type: "string", maxLength: 64 },
              os: { type: "string", maxLength: 64 },
              device_name: { type: "string", maxLength: 120 },
            },
            ["token", "device_fingerprint"],
          ),
          responses: {
            200: {
              description: "Licença ativa",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      license: { $ref: "#/components/schemas/License" },
                    },
                  },
                },
              },
            },
            400: errorResponse,
            403: errorResponse,
            404: errorResponse,
            429: errorResponse,
          },
        },
      },
      "/license/validate": {
        post: {
          tags: ["Licença"],
          summary: "Valida licença + dispositivo",
          requestBody: body({ token, device_fingerprint: fingerprint }, [
            "token",
            "device_fingerprint",
          ]),
          responses: {
            200: {
              description: "Resultado da validação (success=false quando inativa)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      status: { type: "string" },
                      license: { $ref: "#/components/schemas/License" },
                    },
                  },
                },
              },
            },
            400: errorResponse,
            403: errorResponse,
            404: errorResponse,
            429: errorResponse,
          },
        },
      },
      "/license/heartbeat": {
        post: {
          tags: ["Licença"],
          summary: "Atualiza last_seen do dispositivo (recomendado: 15 min)",
          requestBody: body({ token, device_fingerprint: fingerprint }, [
            "token",
            "device_fingerprint",
          ]),
          responses: { 200: { description: "OK" }, 403: errorResponse, 429: errorResponse },
        },
      },
      "/license/me": {
        get: {
          tags: ["Licença"],
          summary: "Dados da licença e dispositivos ativos",
          security: [{ licenseToken: [] }],
          responses: {
            200: {
              description: "Licença e dispositivos",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      license: { $ref: "#/components/schemas/License" },
                      devices: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
            400: errorResponse,
            404: errorResponse,
            429: errorResponse,
          },
        },
      },
      "/license/deactivate": {
        post: {
          tags: ["Licença"],
          summary: "Desvincula o dispositivo atual",
          requestBody: body({ token, device_fingerprint: fingerprint }, [
            "token",
            "device_fingerprint",
          ]),
          responses: { 200: { description: "OK" }, 404: errorResponse, 429: errorResponse },
        },
      },
      "/license/device/remove": {
        post: {
          tags: ["Licença"],
          summary: "Remove um dispositivo pelo id",
          requestBody: body({ token, device_id: { type: "string", format: "uuid" } }, [
            "token",
            "device_id",
          ]),
          responses: { 200: { description: "OK" }, 404: errorResponse, 429: errorResponse },
        },
      },
      "/extension/status": {
        get: {
          tags: ["Extensão"],
          summary: "Kill-switch remoto do canal reserva",
          responses: {
            200: {
              description: "Status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      channel: { type: "string" },
                      enabled: { type: "boolean" },
                      version: { type: "string", nullable: true },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/ext/runtime/manifest": {
        get: {
          tags: ["Extensão"],
          summary: "Manifesto de compatibilidade (builds legados)",
          description:
            "Depreciado. A arquitetura oficial é API direta; este endpoint só evita 404 em builds antigos.",
          deprecated: true,
          responses: { 200: { description: "Manifesto" } },
        },
      },
      "/ext/runtime/bundle": {
        get: {
          tags: ["Extensão"],
          summary: "Bundle de compatibilidade (JS)",
          deprecated: true,
          responses: { 200: { description: "JavaScript" } },
        },
      },
      "/cron/renew-licenses": {
        post: {
          tags: ["Manutenção"],
          summary: "Renovação automática de licenças e assinaturas vencidas",
          security: [{ cronSecret: [] }],
          responses: {
            200: { description: "Resumo do processamento" },
            401: { description: "Segredo inválido" },
          },
        },
      },
    },
  };
}