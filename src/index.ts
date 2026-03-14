import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import {
	extractWebpageInputSchema,
	fetchUrlInputSchema,
	getJsonInputSchema,
	handleExtractWebpage,
	handleFetchUrl,
	handleGetJson,
	handleHeadUrl,
	headUrlInputSchema,
} from "./http-tools";

const AUTH_HEADER_NAME = "aayang";
const AUTH_HEADER_VALUE = "aayang";
const MCP_CORS_OPTIONS = {
	methods: "GET, POST, DELETE, OPTIONS",
	headers:
		"Content-Type, Accept, Last-Event-ID, mcp-session-id, mcp-protocol-version, aayang",
	exposeHeaders: "mcp-session-id",
};

function buildCorsHeaders(request: Request): HeadersInit {
	return {
		"Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
		"Access-Control-Allow-Methods": MCP_CORS_OPTIONS.methods,
		"Access-Control-Allow-Headers": MCP_CORS_OPTIONS.headers,
		"Access-Control-Expose-Headers": MCP_CORS_OPTIONS.exposeHeaders,
		"Access-Control-Max-Age": "86400",
	};
}

function isAuthorizedRequest(request: Request): boolean {
	return request.headers.get(AUTH_HEADER_NAME) === AUTH_HEADER_VALUE;
}

function buildUnauthorizedResponse(request: Request): Response {
	return new Response(
		JSON.stringify({
			error: "Unauthorized: missing or invalid aayang header.",
		}),
		{
			status: 401,
			headers: {
				"content-type": "application/json",
				...buildCorsHeaders(request),
			},
		},
	);
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Remote Network MCP",
		version: "1.1.0",
	});

	async init() {
		this.server.registerTool(
			"add",
			{
				title: "Add Numbers",
				description: "Add two numbers together.",
				inputSchema: {
					a: z.number().describe("The first number."),
					b: z.number().describe("The second number."),
				},
				annotations: {
					readOnlyHint: true,
					openWorldHint: false,
				},
			},
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
				structuredContent: { result: a + b },
			}),
		);

		this.server.registerTool(
			"calculate",
			{
				title: "Calculator",
				description: "Run a basic arithmetic operation on two numbers.",
				inputSchema: {
					operation: z
						.enum(["add", "subtract", "multiply", "divide"])
						.describe("The arithmetic operation to apply."),
					a: z.number().describe("The first number."),
					b: z.number().describe("The second number."),
				},
				annotations: {
					readOnlyHint: true,
					openWorldHint: false,
				},
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
								structuredContent: {
									error: "Cannot divide by zero",
									operation,
								},
								isError: true,
							};
						result = a / b;
						break;
				}
				return {
					content: [{ type: "text", text: String(result) }],
					structuredContent: { result, operation },
				};
			},
		);

		this.server.registerTool(
			"fetch_url",
			{
				title: "Fetch URL",
				description:
					"Fetch a public HTTP or HTTPS URL with GET or POST, return response metadata, and preview the body.",
				inputSchema: fetchUrlInputSchema,
				annotations: {
					readOnlyHint: false,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			handleFetchUrl,
		);

		this.server.registerTool(
			"get_json",
			{
				title: "Get JSON",
				description:
					"Fetch a public URL with GET and parse the response as JSON, returning structured metadata and a JSON preview.",
				inputSchema: getJsonInputSchema,
				annotations: {
					readOnlyHint: true,
					openWorldHint: true,
				},
			},
			handleGetJson,
		);

		this.server.registerTool(
			"head_url",
			{
				title: "Head URL",
				description:
					"Send a HEAD request to a public URL and return status, redirect, and header metadata without downloading the body.",
				inputSchema: headUrlInputSchema,
				annotations: {
					readOnlyHint: true,
					openWorldHint: true,
				},
			},
			handleHeadUrl,
		);

		this.server.registerTool(
			"extract_webpage",
			{
				title: "Extract Webpage",
				description:
					"Fetch an HTML or text page, strip noisy markup, and return the cleaned page title and main text preview.",
				inputSchema: extractWebpageInputSchema,
				annotations: {
					readOnlyHint: true,
					openWorldHint: true,
				},
			},
			handleExtractWebpage,
		);
	}
}

const mcpHandler = MyMCP.serve("/mcp", {
	corsOptions: MCP_CORS_OPTIONS,
});

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			if (request.method !== "OPTIONS" && !isAuthorizedRequest(request)) {
				return buildUnauthorizedResponse(request);
			}

			return mcpHandler.fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
