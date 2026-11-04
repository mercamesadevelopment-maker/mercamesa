/**
 * Lo que devuelve cada herramienta del MCP: JSON en el texto (lo lee el modelo)
 * y el mismo objeto en `structuredContent` (lo lee el programa de Meteor).
 *
 * Los errores llevan un código fijo, para que Carolina decida qué decir sin
 * interpretar el mensaje.
 */
export type McpErrorCode =
  | 'TELEFONO_INVALIDO'
  | 'NO_IDENTIFICADO'
  | 'NO_VERIFICADO'
  | 'AMBIGUO'
  | 'CODIGO_INVALIDO'
  | 'NO_EXISTE'
  | 'FALLO_CONSULTA';

export function ok(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

export function fail(code: McpErrorCode, message: string) {
  const error = { error: { code, message } };
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(error) }],
    structuredContent: error,
  };
}

export type ToolResult = ReturnType<typeof ok> | ReturnType<typeof fail>;
