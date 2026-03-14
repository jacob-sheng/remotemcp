# Remote Network MCP on Cloudflare Workers

This project deploys a remote MCP server on Cloudflare Workers and exposes a small network toolset over the `/mcp` endpoint.

## Warning

This server can fetch arbitrary public HTTP/HTTPS URLs, and its protection is currently just a shared static request header.

That makes it convenient for testing, but it still behaves like a network proxy for anyone who knows the header value. Before exposing it broadly, you should add stronger authentication, rate limits, and ideally an allowlist.

## Authentication

All real MCP requests to `/mcp` must include this exact request header:

```text
aayang: aayang
```

- `OPTIONS /mcp` preflight requests are allowed without the header
- `GET / POST / DELETE /mcp` must include the header
- If your MCP client or proxy cannot inject a custom request header, it cannot connect to this server

## Get Started

Deploy from the template or run locally:

```bash
npm install
npm run dev
```

The local MCP endpoint is:

```text
http://localhost:8787/mcp
```

Your deployed endpoint will look like:

```text
https://<your-worker>.<your-account>.workers.dev/mcp
```

Minimal HTTP example:

```bash
curl -i http://localhost:8787/mcp \
  -X POST \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'aayang: aayang' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

## Available MCP Tools

### `fetch_url`

General HTTP fetch tool for public URLs.

- Supports `GET` and `POST`
- Accepts optional headers
- Accepts a string body or JSON object body for `POST`
- Returns response metadata plus a response preview

Example arguments:

```json
{
	"url": "https://example.com",
	"method": "GET",
	"maxBytes": 262144,
	"timeoutMs": 10000
}
```

POST example:

```json
{
	"url": "https://httpbin.org/post",
	"method": "POST",
	"headers": {
		"content-type": "application/json",
		"authorization": "Bearer <token>"
	},
	"body": {
		"message": "hello"
	}
}
```

### `get_json`

GET a public URL and force JSON parsing.

- Best for JSON APIs
- Returns `isError: true` if the response is not valid JSON
- Includes structured metadata and a JSON preview

Example arguments:

```json
{
	"url": "https://api.github.com/repos/cloudflare/workers-sdk",
	"headers": {
		"accept": "application/vnd.github+json"
	}
}
```

### `head_url`

Send a `HEAD` request without downloading the response body.

- Returns status code
- Returns redirect/final URL info
- Returns headers such as `content-type`, `content-length`, `etag`, and `last-modified`

Example arguments:

```json
{
	"url": "https://example.com"
}
```

### `extract_webpage`

Fetch a page and return cleaned text.

- HTML pages are cleaned with `HTMLRewriter`
- Removes `script`, `style`, and `noscript`
- Returns the page title and normalized text
- Plain text responses are also supported

Example arguments:

```json
{
	"url": "https://developers.cloudflare.com/workers/",
	"maxChars": 8000
}
```

## Existing Example Tools

The original sample tools are still available:

- `add`
- `calculate`

## Connect from Cloudflare AI Playground

1. Open <https://playground.ai.cloudflare.com/>
2. Add your MCP server URL, for example `https://<your-worker>.<your-account>.workers.dev/mcp`
3. Call the tools from the playground

## Connect from Claude Desktop

Use `mcp-remote` to bridge the remote MCP server:

```json
{
	"mcpServers": {
		"remote-network-mcp": {
			"command": "npx",
			"args": [
				"mcp-remote",
				"http://localhost:8787/mcp"
			]
		}
	}
}
```

If your bridge or client supports custom headers, configure it to send `aayang: aayang` on every real MCP request. Then restart Claude Desktop.

## Implementation Notes

- Route: `/mcp`
- Static auth header: `aayang: aayang`
- Public URL schemes allowed: `http`, `https`
- Obvious localhost/private IP targets are blocked
- Hop-by-hop and proxy headers are stripped before outgoing requests
- Response bodies are read with byte limits to avoid oversized MCP responses
