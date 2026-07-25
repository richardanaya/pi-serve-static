/**
 * pi-serve — static file server for the session cwd.
 *
 * /serve-start  Start (or restart) a local static server on 127.0.0.1
 *               with an OS-assigned free port, then open the browser.
 * /serve-stop   Stop the running server.
 *
 * Binds localhost only. Stops automatically on session_shutdown.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ServerState = {
	server: http.Server;
	port: number;
	root: string;
	url: string;
};

let state: ServerState | null = null;

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".htm": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".cjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".bmp": "image/bmp",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".eot": "application/vnd.ms-fontobject",
	".mp3": "audio/mpeg",
	".mp4": "video/mp4",
	".webm": "video/webm",
	".wav": "audio/wav",
	".pdf": "application/pdf",
	".wasm": "application/wasm",
	".ts": "text/plain; charset=utf-8",
	".tsx": "text/plain; charset=utf-8",
	".jsx": "text/plain; charset=utf-8",
	".vue": "text/plain; charset=utf-8",
	".py": "text/plain; charset=utf-8",
	".rs": "text/plain; charset=utf-8",
	".go": "text/plain; charset=utf-8",
	".java": "text/plain; charset=utf-8",
	".c": "text/plain; charset=utf-8",
	".h": "text/plain; charset=utf-8",
	".cpp": "text/plain; charset=utf-8",
	".yml": "text/yaml; charset=utf-8",
	".yaml": "text/yaml; charset=utf-8",
	".toml": "text/plain; charset=utf-8",
	".csv": "text/csv; charset=utf-8",
};

function contentType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	return MIME[ext] ?? "application/octet-stream";
}

/** Resolve URL path under root; reject path traversal. */
function safeJoin(root: string, urlPath: string): string | null {
	const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
	const cleaned = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
	const full = path.resolve(root, "." + (cleaned.startsWith("/") ? cleaned : `/${cleaned}`));
	const rootResolved = path.resolve(root);
	if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
		return null;
	}
	return full;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function directoryListing(dirPath: string, urlPath: string): string {
	const entries = fs.readdirSync(dirPath, { withFileTypes: true });
	entries.sort((a, b) => {
		if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	const base = urlPath.endsWith("/") ? urlPath : `${urlPath}/`;
	const rows: string[] = [];

	if (base !== "/") {
		const parent = path.posix.dirname(base.replace(/\/$/, "")) || "/";
		const parentHref = parent.endsWith("/") ? parent : `${parent}/`;
		rows.push(`<li><a href="${escapeHtml(parentHref)}">../</a></li>`);
	}

	for (const ent of entries) {
		if (ent.name.startsWith(".")) continue;
		const name = ent.isDirectory() ? `${ent.name}/` : ent.name;
		const href = path.posix.join(base, ent.name) + (ent.isDirectory() ? "/" : "");
		rows.push(`<li><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></li>`);
	}

	const title = escapeHtml(base);
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Index of ${title}</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 2rem; background: #0d1117; color: #e6edf3; }
  h1 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { padding: 0.2rem 0; }
  a { color: #58a6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  footer { margin-top: 2rem; opacity: 0.5; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>Index of ${title}</h1>
<ul>
${rows.join("\n")}
</ul>
<footer>pi-serve · ${escapeHtml(dirPath)}</footer>
</body>
</html>`;
}

function createStaticServer(root: string): http.Server {
	return http.createServer((req, res) => {
		try {
			const method = req.method ?? "GET";
			if (method !== "GET" && method !== "HEAD") {
				res.writeHead(405, { Allow: "GET, HEAD" });
				res.end("Method Not Allowed");
				return;
			}

			const urlPath = req.url ?? "/";
			let filePath = safeJoin(root, urlPath);
			if (!filePath) {
				res.writeHead(403);
				res.end("Forbidden");
				return;
			}

			if (!fs.existsSync(filePath)) {
				res.writeHead(404);
				res.end("Not Found");
				return;
			}

			let stat = fs.statSync(filePath);

			if (stat.isDirectory()) {
				const indexHtml = path.join(filePath, "index.html");
				if (fs.existsSync(indexHtml) && fs.statSync(indexHtml).isFile()) {
					filePath = indexHtml;
					stat = fs.statSync(filePath);
				} else {
					const html = directoryListing(filePath, decodeURIComponent(urlPath.split("?")[0] ?? "/"));
					res.writeHead(200, {
						"Content-Type": "text/html; charset=utf-8",
						"Cache-Control": "no-cache",
					});
					if (method === "HEAD") {
						res.end();
						return;
					}
					res.end(html);
					return;
				}
			}

			const type = contentType(filePath);
			res.writeHead(200, {
				"Content-Type": type,
				"Content-Length": stat.size,
				"Cache-Control": "no-cache",
			});
			if (method === "HEAD") {
				res.end();
				return;
			}
			fs.createReadStream(filePath).pipe(res);
		} catch (err) {
			res.writeHead(500);
			res.end(err instanceof Error ? err.message : "Internal Server Error");
		}
	});
}

function listen(root: string): Promise<ServerState> {
	return new Promise((resolve, reject) => {
		const server = createStaticServer(root);
		// Port 0 → OS picks a free ephemeral port. Bind loopback only.
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			if (!addr || typeof addr === "string") {
				server.close();
				reject(new Error("Failed to bind local port"));
				return;
			}
			const port = addr.port;
			const url = `http://127.0.0.1:${port}/`;
			resolve({ server, port, root, url });
		});
		server.on("error", reject);
	});
}

function stopServer(): Promise<void> {
	return new Promise((resolve) => {
		if (!state) {
			resolve();
			return;
		}
		const { server } = state;
		state = null;
		server.close(() => resolve());
		// Force-close hung keep-alives
		server.closeAllConnections?.();
	});
}

function openBrowser(url: string): void {
	const platform = process.platform;
	try {
		if (platform === "darwin") {
			execFile("open", [url], () => {});
		} else if (platform === "win32") {
			execFile("cmd", ["/c", "start", "", url], () => {});
		} else {
			execFile("xdg-open", [url], () => {});
		}
	} catch {
		// Best-effort; user can open the URL manually.
	}
}

function statusLine(): string | undefined {
	if (!state) return undefined;
	return `serve ${state.url}`;
}

export default function (pi: ExtensionAPI) {
	const refreshStatus = (ctx: { ui: { setStatus: (id: string, text?: string) => void } }) => {
		ctx.ui.setStatus("pi-serve", statusLine());
	};

	pi.registerCommand("serve-start", {
		description: "Serve cwd on a random local port and open the browser",
		handler: async (_args, ctx) => {
			const root = ctx.cwd;

			if (state) {
				if (state.root === path.resolve(root)) {
					openBrowser(state.url);
					refreshStatus(ctx);
					ctx.ui.notify(`Already serving ${state.url}`, "info");
					return;
				}
				await stopServer();
			}

			try {
				state = await listen(path.resolve(root));
				openBrowser(state.url);
				refreshStatus(ctx);
				ctx.ui.notify(`Serving ${state.root}\n${state.url}`, "info");
			} catch (err) {
				state = null;
				refreshStatus(ctx);
				ctx.ui.notify(
					`Failed to start server: ${err instanceof Error ? err.message : String(err)}`,
					"error",
				);
			}
		},
	});

	pi.registerCommand("serve-stop", {
		description: "Stop the local static file server",
		handler: async (_args, ctx) => {
			if (!state) {
				ctx.ui.notify("No server running", "info");
				refreshStatus(ctx);
				return;
			}
			const url = state.url;
			await stopServer();
			refreshStatus(ctx);
			ctx.ui.notify(`Stopped ${url}`, "info");
		},
	});

	pi.on("session_shutdown", async () => {
		await stopServer();
	});

	pi.on("session_start", async (_event, ctx) => {
		refreshStatus(ctx);
	});
}
