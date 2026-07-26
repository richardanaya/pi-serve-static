# pi-serve-static

A pi extension that serves the current working directory with
[`live-server`](https://www.npmjs.com/package/live-server) — static files
plus automatic browser reload on change.

## Install

```bash
# npm
pi install npm:pi-serve-static

# git
pi install git:github.com/richardanaya/pi-serve-static

# local path
pi install /absolute/path/to/pi-serve-static

# try once without installing
pi -e npm:pi-serve-static
```

## Usage

| Command        | Effect                                                        |
|----------------|---------------------------------------------------------------|
| `/serve-start` | Serve cwd with live-server (live reload); open the browser    |
| `/serve-stop`  | Stop the running server                                       |

Calling `/serve-start` again while a server is already up for the same
directory **keeps the same port**, leaves the process running, and only
opens the browser again. If the session cwd changed, it stops the old
server and starts a new one on a fresh free port for the new root.

## Behavior

- **Engine:** [`live-server`](https://www.npmjs.com/package/live-server) `^1.2.2` (runtime dependency).
- **Root:** pi session `ctx.cwd` (the directory pi is operating in).
- **Bind:** `127.0.0.1` only (not exposed on the LAN).
- **Port:** ephemeral (`0` → OS picks a free local port).
- **Live reload:** provided by live-server (full reload on most changes; CSS inject without full reload).
- **Ignore:** `node_modules/**`, `.git/**`.
- **Status:** footer shows `serve http://127.0.0.1:<port>/ · live-server` while up.
- **Cleanup:** stops on `/serve-stop` and on session shutdown (`liveServer.shutdown()`).

## License

MIT © Richard Anaya
