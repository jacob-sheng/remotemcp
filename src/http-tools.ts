import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 262_144;
const HARD_MAX_BYTES = 1_048_576;
const DEFAULT_MAX_CHARS = 8_000;
const HARD_MAX_CHARS = 20_000;
const DEFAULT_PREVIEW_CHARS = 4_000;

const BLOCKED_HEADER_NAMES = new Set([
	"connection",
	"content-length",
	"host",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

const SENSITIVE_HEADER_NAMES = new Set([
	"authorization",
	"cookie",
	"proxy-authorization",
	"set-cookie",
]);

const WEB_BLOCK_TAGS = new Set([
	"address",
	"article",
	"aside",
	"blockquote",
	"br",
	"dd",
	"div",
	"dl",
	"dt",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hr",
	"li",
	"main",
	"nav",
	"ol",
	"p",
	"pre",
	"section",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"ul",
]);

export const fetchUrlInputSchema = {
	url: z.string().url().describe("The http or https URL to request."),
	method: z
		.enum(["GET", "POST"])
		.default("GET")
		.describe("HTTP method to use."),
	headers: z
		.record(z.string(), z.string())
		.optional()
		.describe("Optional request headers."),
	body: z
		.union([z.string(), z.record(z.string(), z.unknown())])
		.optional()
		.describe("Optional POST body. Strings are sent as-is; objects are sent as JSON."),
	timeoutMs: z
		.number()
		.int()
		.min(1)
		.max(MAX_TIMEOUT_MS)
		.optional()
		.describe(`Request timeout in milliseconds. Default ${DEFAULT_TIMEOUT_MS}.`),
	maxBytes: z
		.number()
		.int()
		.min(1)
		.max(HARD_MAX_BYTES)
		.optional()
		.describe(
			`Maximum response bytes to read before truncating. Default ${DEFAULT_MAX_BYTES}.`,
		),
};

export const getJsonInputSchema = {
	url: z.string().url().describe("The http or https URL to request."),
	headers: z
		.record(z.string(), z.string())
		.optional()
		.describe("Optional request headers."),
	timeoutMs: z
		.number()
		.int()
		.min(1)
		.max(MAX_TIMEOUT_MS)
		.optional()
		.describe(`Request timeout in milliseconds. Default ${DEFAULT_TIMEOUT_MS}.`),
	maxBytes: z
		.number()
		.int()
		.min(1)
		.max(HARD_MAX_BYTES)
		.optional()
		.describe(
			`Maximum response bytes to read before truncating. Default ${DEFAULT_MAX_BYTES}.`,
		),
};

export const headUrlInputSchema = {
	url: z.string().url().describe("The http or https URL to request."),
	headers: z
		.record(z.string(), z.string())
		.optional()
		.describe("Optional request headers."),
	timeoutMs: z
		.number()
		.int()
		.min(1)
		.max(MAX_TIMEOUT_MS)
		.optional()
		.describe(`Request timeout in milliseconds. Default ${DEFAULT_TIMEOUT_MS}.`),
};

export const extractWebpageInputSchema = {
	url: z.string().url().describe("The http or https URL to request."),
	headers: z
		.record(z.string(), z.string())
		.optional()
		.describe("Optional request headers."),
	timeoutMs: z
		.number()
		.int()
		.min(1)
		.max(MAX_TIMEOUT_MS)
		.optional()
		.describe(`Request timeout in milliseconds. Default ${DEFAULT_TIMEOUT_MS}.`),
	maxBytes: z
		.number()
		.int()
		.min(1)
		.max(HARD_MAX_BYTES)
		.optional()
		.describe(
			`Maximum response bytes to read before truncating. Default ${DEFAULT_MAX_BYTES}.`,
		),
	maxChars: z
		.number()
		.int()
		.min(1)
		.max(HARD_MAX_CHARS)
		.optional()
		.describe(
			`Maximum extracted characters to return. Default ${DEFAULT_MAX_CHARS}.`,
		),
};

type HeaderMap = Record<string, string>;

type RequestBody = z.infer<
	z.ZodUnion<[z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>]>
>;

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	structuredContent: Record<string, unknown>;
	isError?: boolean;
};

type BaseHttpRequest = {
	url: string;
	headers?: HeaderMap;
	timeoutMs?: number;
	maxBytes?: number;
};

type PreparedRequest = {
	url: URL;
	urlString: string;
	method: "GET" | "POST" | "HEAD";
	headers: Headers;
	requestHeaders: HeaderMap;
	timeoutMs: number;
	maxBytes: number;
	body?: string;
	bodyKind: "none" | "text" | "json";
};

type HttpResponseMetadata = {
	contentLength: string | null;
	contentType: string | null;
	etag: string | null;
	finalUrl: string;
	headers: HeaderMap;
	lastModified: string | null;
	ok: boolean;
	redirected: boolean;
	status: number;
	statusText: string;
};

type JsonData = {
	kind: "json";
	json?: unknown;
	jsonPreview: string;
	jsonTruncated: boolean;
};

type TextData = {
	kind: "text";
	textPreview: string;
	textTruncated: boolean;
};

type BinaryData = {
	kind: "binary";
	bytesRead: number;
};

type ErrorData = {
	kind: "error";
	message: string;
	bodyPreview?: string;
};

type FetchData = JsonData | TextData | BinaryData | ErrorData;

type RequestExecution = {
	data: FetchData;
	decodedText: string;
	request: {
		hasBody: boolean;
		headers: HeaderMap;
		maxBytes: number;
		method: string;
		timeoutMs: number;
		url: string;
	};
	response: HttpResponseMetadata | null;
	truncated: boolean;
};

function createResult(
	summary: string,
	structuredContent: Record<string, unknown>,
	isError = false,
): ToolResult {
	return {
		content: [{ type: "text", text: summary }],
		structuredContent,
		...(isError ? { isError: true } : {}),
	};
}

function clampTimeout(timeoutMs?: number): number {
	return timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

function clampMaxBytes(maxBytes?: number): number {
	return maxBytes ?? DEFAULT_MAX_BYTES;
}

function clampMaxChars(maxChars?: number): number {
	return maxChars ?? DEFAULT_MAX_CHARS;
}

function normalizeHost(hostname: string): string {
	return hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
}

function parseIpv4(hostname: string): number[] | null {
	if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
		return null;
	}

	const parts = hostname.split(".").map((part) => Number(part));
	return parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
		? parts
		: null;
}

function isBlockedIpv4(parts: number[]): boolean {
	const [a, b] = parts;
	return (
		a === 10 ||
		a === 127 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168)
	);
}

function expandIpv4MappedIpv6(hostname: string): string {
	if (!hostname.includes(".")) {
		return hostname;
	}

	const lastColon = hostname.lastIndexOf(":");
	if (lastColon === -1) {
		return hostname;
	}

	const ipv4 = parseIpv4(hostname.slice(lastColon + 1));
	if (!ipv4) {
		return hostname;
	}

	const left = (ipv4[0] * 256 + ipv4[1]).toString(16);
	const right = (ipv4[2] * 256 + ipv4[3]).toString(16);
	return `${hostname.slice(0, lastColon)}:${left}:${right}`;
}

function parseIpv6(hostname: string): bigint | null {
	const normalized = expandIpv4MappedIpv6(hostname.toLowerCase());
	if (!/^[0-9a-f:]+$/.test(normalized)) {
		return null;
	}

	const segments = normalized.split("::");
	if (segments.length > 2) {
		return null;
	}

	const left = segments[0]
		? segments[0].split(":").filter((segment) => segment.length > 0)
		: [];
	const right = segments[1]
		? segments[1].split(":").filter((segment) => segment.length > 0)
		: [];

	if (!left.every(isValidIpv6Segment) || !right.every(isValidIpv6Segment)) {
		return null;
	}

	const fill = segments.length === 2 ? 8 - left.length - right.length : 0;
	if ((segments.length === 2 && fill < 1) || (segments.length === 1 && left.length !== 8)) {
		return null;
	}

	const full = [...left, ...Array(fill).fill("0"), ...right];
	if (full.length !== 8) {
		return null;
	}

	let value = 0n;
	for (const segment of full) {
		value = (value << 16n) + BigInt(Number.parseInt(segment, 16));
	}
	return value;
}

function isValidIpv6Segment(segment: string): boolean {
	return /^[0-9a-f]{1,4}$/i.test(segment);
}

function isBlockedIpv6(hostname: string): boolean {
	const ipv4Suffix = hostname.includes(".")
		? parseIpv4(hostname.slice(hostname.lastIndexOf(":") + 1))
		: null;
	if (ipv4Suffix && isBlockedIpv4(ipv4Suffix)) {
		return true;
	}

	const value = parseIpv6(hostname);
	if (value === null) {
		return false;
	}

	const firstHextet = Number(value >> 112n);
	return (
		value === 1n ||
		(firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
		(firstHextet >= 0xfe80 && firstHextet <= 0xfebf)
	);
}

function validateUrl(urlValue: string): URL {
	const url = new URL(urlValue);
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Only http and https URLs are allowed.");
	}

	const hostname = normalizeHost(url.hostname);
	if (hostname === "localhost" || hostname.endsWith(".localhost")) {
		throw new Error("Localhost targets are blocked.");
	}

	const ipv4 = parseIpv4(hostname);
	if (ipv4 && isBlockedIpv4(ipv4)) {
		throw new Error("Private IPv4 targets are blocked.");
	}

	if (hostname.includes(":") && isBlockedIpv6(hostname)) {
		throw new Error("Private IPv6 targets are blocked.");
	}

	return url;
}

function sanitizeHeaders(input?: HeaderMap): { headers: Headers; publicHeaders: HeaderMap } {
	const headers = new Headers();
	const publicHeaders: HeaderMap = {};

	for (const [rawName, rawValue] of Object.entries(input ?? {})) {
		const name = rawName.trim().toLowerCase();
		if (!name) {
			continue;
		}

		if (
			BLOCKED_HEADER_NAMES.has(name) ||
			name.startsWith("cf-") ||
			name.startsWith("x-forwarded-")
		) {
			continue;
		}

		try {
			headers.set(name, rawValue);
			publicHeaders[name] = redactHeaderValue(name, rawValue);
		} catch (_error) {
			throw new Error(`Invalid request header: ${rawName}`);
		}
	}

	return { headers, publicHeaders };
}

function redactHeaderValue(name: string, value: string): string {
	return SENSITIVE_HEADER_NAMES.has(name) ? "[redacted]" : value;
}

function serializeHeaders(headers: Headers): HeaderMap {
	const serialized: HeaderMap = {};
	for (const [name, value] of headers.entries()) {
		serialized[name] = redactHeaderValue(name, value);
	}
	return serialized;
}

function mediaTypeFromHeader(contentType: string | null): string | null {
	return contentType?.split(";")[0]?.trim().toLowerCase() ?? null;
}

function isJsonMediaType(mediaType: string | null): boolean {
	return mediaType === "application/json" || mediaType?.endsWith("+json") === true;
}

function isHtmlMediaType(mediaType: string | null): boolean {
	return mediaType === "text/html" || mediaType === "application/xhtml+xml";
}

function isTextMediaType(mediaType: string | null): boolean {
	return (
		mediaType?.startsWith("text/") === true ||
		mediaType === "application/xml" ||
		mediaType?.endsWith("+xml") === true
	);
}

async function fetchWithTimeout(
	input: URL,
	init: RequestInit,
	timeoutMs: number,
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(input, {
			...init,
			signal: controller.signal,
		});
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error(`Request timed out after ${timeoutMs}ms.`);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

async function readResponseBytes(
	response: Response,
	maxBytes: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
	if (!response.body) {
		return { bytes: new Uint8Array(0), truncated: false };
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let bytesRead = 0;
	let truncated = false;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			if (!value) {
				continue;
			}

			if (bytesRead + value.byteLength > maxBytes) {
				const remaining = maxBytes - bytesRead;
				if (remaining > 0) {
					chunks.push(value.subarray(0, remaining));
					bytesRead += remaining;
				}
				truncated = true;
				await reader.cancel();
				break;
			}

			chunks.push(value);
			bytesRead += value.byteLength;
		}
	} finally {
		reader.releaseLock();
	}

	const combined = new Uint8Array(bytesRead);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return { bytes: combined, truncated };
}

function truncateString(
	value: string,
	maxChars: number,
): { text: string; truncated: boolean } {
	if (value.length <= maxChars) {
		return { text: value, truncated: false };
	}

	return {
		text:
			maxChars <= 3
				? ".".repeat(maxChars)
				: `${value.slice(0, maxChars - 3)}...`,
		truncated: true,
	};
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\r/g, "").replace(/[ \t\f\v]+/g, " ").trim();
}

function normalizeWebText(value: string): string {
	return value
		.replace(/\r/g, "")
		.replace(/[ \t\f\v]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function decodeHtmlEntities(value: string): string {
	return value.replace(
		/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
		(entity) => {
			switch (entity.toLowerCase()) {
				case "&amp;":
					return "&";
				case "&apos;":
					return "'";
				case "&gt;":
					return ">";
				case "&lt;":
					return "<";
				case "&nbsp;":
					return " ";
				case "&quot;":
					return '"';
				default:
					if (entity.startsWith("&#x") || entity.startsWith("&#X")) {
						return String.fromCodePoint(
							Number.parseInt(entity.slice(3, -1), 16),
						);
					}
					if (entity.startsWith("&#")) {
						return String.fromCodePoint(
							Number.parseInt(entity.slice(2, -1), 10),
						);
					}
					return entity;
			}
		},
	);
}

function summarizeJson(value: unknown): JsonData {
	const serialized = JSON.stringify(value, null, 2) ?? "null";
	const preview = truncateString(serialized, DEFAULT_PREVIEW_CHARS);
	return {
		kind: "json",
		...(preview.truncated ? {} : { json: value }),
		jsonPreview: preview.text,
		jsonTruncated: preview.truncated,
	};
}

function summarizeText(value: string): TextData {
	const preview = truncateString(value, DEFAULT_PREVIEW_CHARS);
	return {
		kind: "text",
		textPreview: preview.text,
		textTruncated: preview.truncated,
	};
}

function summarizeBody(
	bytes: Uint8Array,
	contentType: string | null,
): { data: FetchData; decodedText: string; truncatedByPreview: boolean } {
	const mediaType = mediaTypeFromHeader(contentType);
	const decodedText = new TextDecoder().decode(bytes);

	if (isJsonMediaType(mediaType)) {
		try {
			const parsed = JSON.parse(decodedText) as unknown;
			const data = summarizeJson(parsed);
			return {
				data,
				decodedText,
				truncatedByPreview: data.jsonTruncated,
			};
		} catch (_error) {
			const data = summarizeText(decodedText);
			return {
				data,
				decodedText,
				truncatedByPreview: data.textTruncated,
			};
		}
	}

	if (isTextMediaType(mediaType) || mediaType === null) {
		const data = summarizeText(decodedText);
		return {
			data,
			decodedText,
			truncatedByPreview: data.textTruncated,
		};
	}

	return {
		data: { kind: "binary", bytesRead: bytes.byteLength },
		decodedText,
		truncatedByPreview: false,
	};
}

function safePublicHeaders(input?: HeaderMap): HeaderMap {
	try {
		return sanitizeHeaders(input).publicHeaders;
	} catch (_error) {
		return {};
	}
}

function buildResponseMetadata(response: Response): HttpResponseMetadata {
	return {
		contentLength: response.headers.get("content-length"),
		contentType: response.headers.get("content-type"),
		etag: response.headers.get("etag"),
		finalUrl: response.url,
		headers: serializeHeaders(response.headers),
		lastModified: response.headers.get("last-modified"),
		ok: response.ok,
		redirected: response.redirected,
		status: response.status,
		statusText: response.statusText,
	};
}

function buildRequestShape(prepared: PreparedRequest): RequestExecution["request"] {
	return {
		hasBody: prepared.bodyKind !== "none",
		headers: prepared.requestHeaders,
		maxBytes: prepared.maxBytes,
		method: prepared.method,
		timeoutMs: prepared.timeoutMs,
		url: prepared.urlString,
	};
}

function buildNetworkErrorResult(
	prepared: PreparedRequest,
	error: unknown,
): RequestExecution {
	const message = error instanceof Error ? error.message : "Unknown request failure.";
	return {
		data: { kind: "error", message },
		decodedText: "",
		request: buildRequestShape(prepared),
		response: null,
		truncated: false,
	};
}

async function performRequest(prepared: PreparedRequest): Promise<RequestExecution> {
	try {
		const response = await fetchWithTimeout(
			prepared.url,
			{
				method: prepared.method,
				headers: prepared.headers,
				...(prepared.body ? { body: prepared.body } : {}),
			},
			prepared.timeoutMs,
		);

		const responseMeta = buildResponseMetadata(response);
		if (prepared.method === "HEAD") {
			return {
				data: { kind: "binary", bytesRead: 0 },
				decodedText: "",
				request: buildRequestShape(prepared),
				response: responseMeta,
				truncated: false,
			};
		}

		const { bytes, truncated } = await readResponseBytes(response, prepared.maxBytes);
		const summarized = summarizeBody(bytes, responseMeta.contentType);
		return {
			data: summarized.data,
			decodedText: summarized.decodedText,
			request: buildRequestShape(prepared),
			response: responseMeta,
			truncated: truncated || summarized.truncatedByPreview,
		};
	} catch (error) {
		return buildNetworkErrorResult(prepared, error);
	}
}

function buildPreparedRequest(
	input: BaseHttpRequest & {
		body?: RequestBody;
		method: "GET" | "POST" | "HEAD";
	},
): PreparedRequest {
	const url = validateUrl(input.url);
	const timeoutMs = clampTimeout(input.timeoutMs);
	const maxBytes = clampMaxBytes(input.maxBytes);
	const sanitized = sanitizeHeaders(input.headers);

	let body: string | undefined;
	let bodyKind: PreparedRequest["bodyKind"] = "none";
	if (input.body !== undefined) {
		if (input.method !== "POST") {
			throw new Error("Request bodies are only supported for POST.");
		}

		if (typeof input.body === "string") {
			body = input.body;
			bodyKind = "text";
		} else {
			body = JSON.stringify(input.body);
			bodyKind = "json";
			if (!sanitized.headers.has("content-type")) {
				sanitized.headers.set("content-type", "application/json");
			}
		}
	}

	return {
		body,
		bodyKind,
		headers: sanitized.headers,
		maxBytes,
		method: input.method,
		requestHeaders: {
			...sanitized.publicHeaders,
			...(bodyKind === "json" && !("content-type" in sanitized.publicHeaders)
				? { "content-type": "application/json" }
				: {}),
		},
		timeoutMs,
		url,
		urlString: url.toString(),
	};
}

function buildFetchSummary(execution: RequestExecution): string {
	const prefix = `${execution.request.method} ${execution.request.url}`;
	if (!execution.response) {
		return `${prefix} failed: ${(execution.data as ErrorData).message}`;
	}

	const statusLine = `${prefix} -> ${execution.response.status} ${execution.response.statusText}`;
	switch (execution.data.kind) {
		case "json":
			return `${statusLine}\n\nJSON preview:\n${execution.data.jsonPreview}`;
		case "text":
			return `${statusLine}\n\nResponse preview:\n${execution.data.textPreview}`;
		case "binary":
			return `${statusLine}\n\nBinary response (${execution.data.bytesRead} bytes read).`;
		case "error":
			return `${statusLine}\n\n${execution.data.message}`;
	}
}

function buildHeadSummary(execution: RequestExecution): string {
	if (!execution.response) {
		return `HEAD ${execution.request.url} failed: ${(execution.data as ErrorData).message}`;
	}

	const lines = [
		`HEAD ${execution.request.url} -> ${execution.response.status} ${execution.response.statusText}`,
		`final URL: ${execution.response.finalUrl}`,
		`content-type: ${execution.response.contentType ?? "n/a"}`,
		`content-length: ${execution.response.contentLength ?? "n/a"}`,
	];
	return lines.join("\n");
}

function formatTitle(title: string | null): string {
	return title ? `\nTitle: ${title}` : "";
}

class RemoveElementHandler implements HTMLRewriterElementContentHandlers {
	element(element: Element): void {
		element.remove();
	}
}

class BlockElementHandler implements HTMLRewriterElementContentHandlers {
	element(element: Element): void {
		if (WEB_BLOCK_TAGS.has(element.tagName.toLowerCase())) {
			element.before("\n");
			element.after("\n");
		}
	}
}

async function sanitizeHtml(html: string): Promise<string> {
	const transformed = new HTMLRewriter()
		.on("script", new RemoveElementHandler())
		.on("style", new RemoveElementHandler())
		.on("noscript", new RemoveElementHandler())
		.on(
			[
				"address",
				"article",
				"aside",
				"blockquote",
				"br",
				"dd",
				"div",
				"dl",
				"dt",
				"fieldset",
				"figcaption",
				"figure",
				"footer",
				"form",
				"h1",
				"h2",
				"h3",
				"h4",
				"h5",
				"h6",
				"header",
				"hr",
				"li",
				"main",
				"nav",
				"ol",
				"p",
				"pre",
				"section",
				"table",
				"tbody",
				"td",
				"tfoot",
				"th",
				"thead",
				"tr",
				"ul",
			].join(", "),
			new BlockElementHandler(),
		)
		.transform(
			new Response(html, {
				headers: { "content-type": "text/html; charset=utf-8" },
			}),
		);

	return transformed.text();
}

function extractTitle(html: string): string | null {
	const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	if (!match) {
		return null;
	}

	const title = normalizeWhitespace(decodeHtmlEntities(match[1]));
	return title.length > 0 ? title : null;
}

function stripHtmlToText(html: string): string {
	return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

export async function handleFetchUrl(input: {
	body?: RequestBody;
	headers?: HeaderMap;
	maxBytes?: number;
	method?: "GET" | "POST";
	timeoutMs?: number;
	url: string;
}): Promise<ToolResult> {
	let prepared: PreparedRequest;
	try {
		prepared = buildPreparedRequest({
			body: input.body,
			headers: input.headers,
			maxBytes: input.maxBytes,
			method: input.method ?? "GET",
			timeoutMs: input.timeoutMs,
			url: input.url,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid request.";
		return createResult(message, {
			request: {
				hasBody: input.body !== undefined,
				headers: safePublicHeaders(input.headers),
				maxBytes: clampMaxBytes(input.maxBytes),
				method: input.method ?? "GET",
				timeoutMs: clampTimeout(input.timeoutMs),
				url: input.url,
			},
			response: null,
			data: { kind: "error", message },
			truncated: false,
		}, true);
	}

	const execution = await performRequest(prepared);
	const isError =
		execution.response === null ||
		execution.response.status >= 400 ||
		execution.data.kind === "error";

	return createResult(
		buildFetchSummary(execution),
		{
			request: execution.request,
			response: execution.response,
			data: execution.data,
			truncated: execution.truncated,
		},
		isError,
	);
}

export async function handleGetJson(input: BaseHttpRequest): Promise<ToolResult> {
	let prepared: PreparedRequest;
	try {
		prepared = buildPreparedRequest({
			headers: input.headers,
			maxBytes: input.maxBytes,
			method: "GET",
			timeoutMs: input.timeoutMs,
			url: input.url,
		});
		if (!prepared.headers.has("accept")) {
			prepared.headers.set("accept", "application/json");
			prepared.requestHeaders.accept = "application/json";
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid request.";
		return createResult(
			message,
			{
				request: {
					hasBody: false,
					headers: safePublicHeaders(input.headers),
					maxBytes: clampMaxBytes(input.maxBytes),
					method: "GET",
					timeoutMs: clampTimeout(input.timeoutMs),
					url: input.url,
				},
				response: null,
				data: { kind: "error", message },
				truncated: false,
			},
			true,
		);
	}

	const execution = await performRequest(prepared);
	if (!execution.response) {
		return createResult(
			`GET ${execution.request.url} failed: ${(execution.data as ErrorData).message}`,
			{
				request: execution.request,
				response: null,
				data: execution.data,
				truncated: execution.truncated,
			},
			true,
		);
	}

	try {
		const parsed = JSON.parse(execution.decodedText) as unknown;
		const jsonData = summarizeJson(parsed);
		const truncated = execution.truncated || jsonData.jsonTruncated;
		return createResult(
			`GET ${execution.request.url} -> ${execution.response.status} ${execution.response.statusText}\n\nJSON preview:\n${jsonData.jsonPreview}`,
			{
				request: execution.request,
				response: execution.response,
				data: jsonData,
				truncated,
			},
			execution.response.status >= 400,
		);
	} catch (_error) {
		const preview =
			execution.data.kind === "text" ? execution.data.textPreview : undefined;
		return createResult(
			`GET ${execution.request.url} -> ${execution.response.status} ${execution.response.statusText}\n\nResponse body could not be parsed as JSON.`,
			{
				request: execution.request,
				response: execution.response,
				data: {
					kind: "error",
					message: "Response body could not be parsed as JSON.",
					...(preview ? { bodyPreview: preview } : {}),
				},
				truncated: execution.truncated,
			},
			true,
		);
	}
}

export async function handleHeadUrl(input: {
	headers?: HeaderMap;
	timeoutMs?: number;
	url: string;
}): Promise<ToolResult> {
	let prepared: PreparedRequest;
	try {
		prepared = buildPreparedRequest({
			headers: input.headers,
			method: "HEAD",
			timeoutMs: input.timeoutMs,
			url: input.url,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid request.";
		return createResult(
			message,
			{
				request: {
					hasBody: false,
					headers: safePublicHeaders(input.headers),
					maxBytes: DEFAULT_MAX_BYTES,
					method: "HEAD",
					timeoutMs: clampTimeout(input.timeoutMs),
					url: input.url,
				},
				response: null,
				data: { kind: "error", message },
				truncated: false,
			},
			true,
		);
	}

	const execution = await performRequest(prepared);
	const isError =
		execution.response === null ||
		execution.response.status >= 400 ||
		execution.data.kind === "error";

	return createResult(
		buildHeadSummary(execution),
		{
			request: execution.request,
			response: execution.response
				? {
						...execution.response,
						contentLength: execution.response.contentLength,
						contentType: execution.response.contentType,
						etag: execution.response.etag,
						lastModified: execution.response.lastModified,
					}
				: null,
			data: execution.response
				? {
						status: execution.response.status,
						statusText: execution.response.statusText,
						finalUrl: execution.response.finalUrl,
						redirected: execution.response.redirected,
						headers: execution.response.headers,
						contentType: execution.response.contentType,
						contentLength: execution.response.contentLength,
						etag: execution.response.etag,
						lastModified: execution.response.lastModified,
					}
				: execution.data,
			truncated: false,
		},
		isError,
	);
}

export async function handleExtractWebpage(input: BaseHttpRequest & {
	maxChars?: number;
}): Promise<ToolResult> {
	let prepared: PreparedRequest;
	try {
		prepared = buildPreparedRequest({
			headers: input.headers,
			maxBytes: input.maxBytes,
			method: "GET",
			timeoutMs: input.timeoutMs,
			url: input.url,
		});
		if (!prepared.headers.has("accept")) {
			prepared.headers.set(
				"accept",
				"text/html, application/xhtml+xml, text/plain;q=0.9",
			);
			prepared.requestHeaders.accept =
				"text/html, application/xhtml+xml, text/plain;q=0.9";
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid request.";
		return createResult(
			message,
			{
				request: {
					hasBody: false,
					headers: safePublicHeaders(input.headers),
					maxBytes: clampMaxBytes(input.maxBytes),
					method: "GET",
					timeoutMs: clampTimeout(input.timeoutMs),
					url: input.url,
				},
				response: null,
				data: { kind: "error", message },
				truncated: false,
			},
			true,
		);
	}

	const execution = await performRequest(prepared);
	if (!execution.response) {
		return createResult(
			`GET ${execution.request.url} failed: ${(execution.data as ErrorData).message}`,
			{
				request: execution.request,
				response: null,
				data: execution.data,
				truncated: false,
			},
			true,
		);
	}

	const mediaType = mediaTypeFromHeader(execution.response.contentType);
	if (mediaType !== null && !isHtmlMediaType(mediaType) && !isTextMediaType(mediaType)) {
		return createResult(
			`GET ${execution.request.url} -> ${execution.response.status} ${execution.response.statusText}\n\nResponse is not HTML or plain text.`,
			{
				request: execution.request,
				response: execution.response,
				data: {
					kind: "error",
					message: "Response is not HTML or plain text.",
				},
				truncated: execution.truncated,
			},
			true,
		);
	}

	const maxChars = clampMaxChars(input.maxChars);
	let title: string | null = null;
	let extractedText = "";

	if (isHtmlMediaType(mediaType)) {
		const sanitizedHtml = await sanitizeHtml(execution.decodedText);
		title = extractTitle(sanitizedHtml);
		extractedText = normalizeWebText(stripHtmlToText(sanitizedHtml));
	} else {
		extractedText = normalizeWebText(execution.decodedText);
	}

	const truncatedText = truncateString(extractedText, maxChars);
	const truncated = execution.truncated || truncatedText.truncated;
	const summary = `Extracted ${truncatedText.text.length} characters from ${execution.request.url}${formatTitle(title)}\n\n${truncatedText.text}`;
	const isError = execution.response.status >= 400;

	return createResult(
		summary,
		{
			request: execution.request,
			response: execution.response,
			data: {
				kind: "webpage",
				title,
				text: truncatedText.text,
				contentType: execution.response.contentType,
			},
			truncated,
		},
		isError,
	);
}
