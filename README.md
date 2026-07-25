# pi-serve

A pi extension that serves the current working directory over a local static HTTP server and opens it in your browser.

## Install

```bash
# local path
pi install /absolute/path/to/pi-serve

# or try once without installing
pi -e /absolute/path/to/pi-serve
```

## Usage

| Command | Effect |
|---------|--------|
| `/serve-start` | Start a static server for the session cwd on `127.0.0.1` with a free OS-assigned port, then open the browser |
| `/serve-stop` | Stop the running server |

Calling `/serve-start` again while a server is already up for the same directory **keeps the same port**, leaves the process running, and only opens the browser again. If the session cwd changed, it stops the old server and starts a new one on a fresh free port for the new root.

## Behavior

- **Root:** pi session `ctx.cwd` (the directory pi is operating in).
- **Bind:** `127.0.0.1` only (not exposed on the LAN).
- **Port:** ephemeral (`0` → OS picks a free port in the safe local range).
- **index.html:** served automatically for directories that contain one.
- **Directory listing:** dark HTML index when there is no `index.html`.
- **Traversal:** URL paths are resolved under the root; `..` escapes are rejected.
- **Status:** footer status shows `serve http://127.0.0.1:<port>/` while running.
- **Cleanup:** server stops on `/serve-stop` and on session shutdown.

No npm dependencies — uses Node built-in `http` / `fs` only.

## License

MIT
