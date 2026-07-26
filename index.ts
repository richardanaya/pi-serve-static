/**
 * pi-serve-static — static file server for the session cwd via live-server.
 *
 * /serve-start  Start (or restart) live-server on 127.0.0.1 with an
 *               OS-assigned free port, then open the browser.
 * /serve-stop   Stop the running server.
 *
 * Binds localhost only. Live reload is provided by the `live-server`
 * package. Stops automatically on session_shutdown.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { execFile } from "node:child_process";
import type { Server } from "node:http";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const require = createRequire(import.meta.url);

/** Minimal typing for the CJS `live-server` package. */
type LiveServerApi = {
	start: (params: {
		port?: number;
		host?: string;
		root?: string;
		open?: boolean | string;
		logLevel?: number;
		wait?: number;
		ignore?: string;
		cors?: boolean;
		middleware?: Array<
			(req: unknown, res: unknown, next: (err?: unknown) => void) => void
		>;
	}) => Server;
	shutdown: () => void;
	server?: Server | null;
};

const liveServer = require("live-server") as LiveServerApi;

type ServerState = {
	port: number;
	root: string;
	url: string;
};

let state: ServerState | null = null;

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
	return `serve ${state.url} · live-server`;
}

function stopServer(): void {
	if (!state) return;
	state = null;
	try {
		liveServer.shutdown();
	} catch {
		// Already stopped or never fully started.
	}
}

/** live-server's listen is async; wait until the port is bound. */
function startServer(root: string): Promise<ServerState> {
	return new Promise((resolve, reject) => {
		let settled = false;

		const fail = (err: unknown) => {
			if (settled) return;
			settled = true;
			try {
				liveServer.shutdown();
			} catch {
				/* ignore */
			}
			reject(err instanceof Error ? err : new Error(String(err)));
		};

		// Port 0 → OS picks a free ephemeral port. Bind loopback only.
		// open: false — we open the browser ourselves after we know the URL.
		let server: Server;
		try {
			server = liveServer.start({
				port: 0,
				host: "127.0.0.1",
				root,
				open: false,
				logLevel: 0,
				wait: 100,
				// Skip noisy / heavy trees; live-server ignore is anymatch-style.
				ignore: "node_modules/**,.git/**",
			});
		} catch (err) {
			fail(err);
			return;
		}

		const onListening = () => {
			if (settled) return;
			const addr = server.address();
			if (!addr || typeof addr === "string") {
				fail(new Error("Failed to bind local port"));
				return;
			}
			settled = true;
			const port = addr.port;
			const url = `http://127.0.0.1:${port}/`;
			resolve({ port, root, url });
		};

		server.once("error", fail);

		// May already be listening by the time we attach.
		if (server.listening) {
			onListening();
		} else {
			server.once("listening", onListening);
		}
	});
}

export default function (pi: ExtensionAPI) {
	const refreshStatus = (ctx: {
		ui: { setStatus: (id: string, text?: string) => void };
	}) => {
		ctx.ui.setStatus("pi-serve-static", statusLine());
	};

	pi.registerCommand("serve-start", {
		description:
			"Serve cwd with live-server (live reload) on a random local port; open the browser",
		handler: async (_args, ctx) => {
			const root = path.resolve(ctx.cwd);

			if (state) {
				if (state.root === root) {
					openBrowser(state.url);
					refreshStatus(ctx);
					ctx.ui.notify(`Already serving ${state.url} (live-server)`, "info");
					return;
				}
				stopServer();
			}

			try {
				state = await startServer(root);
				openBrowser(state.url);
				refreshStatus(ctx);
				ctx.ui.notify(
					`Serving ${state.root}\n${state.url}\nlive-server (live reload on)`,
					"info",
				);
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
		description: "Stop the local live-server instance",
		handler: async (_args, ctx) => {
			if (!state) {
				ctx.ui.notify("No server running", "info");
				refreshStatus(ctx);
				return;
			}
			const url = state.url;
			stopServer();
			refreshStatus(ctx);
			ctx.ui.notify(`Stopped ${url}`, "info");
		},
	});

	pi.on("session_shutdown", async () => {
		stopServer();
	});

	pi.on("session_start", async (_event, ctx) => {
		refreshStatus(ctx);
	});
}
