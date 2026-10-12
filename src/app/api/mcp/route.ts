import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPathwaysMcpServer } from "@/lib/mcp-server";

// MCP endpoint (Streamable HTTP). Stateless: every tool is a pure function
// of its arguments, so each request gets a fresh server + transport and
// there's no session to track.
async function handle(req: Request) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  const server = createPathwaysMcpServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
