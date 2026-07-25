# pi-serve-static

A pi extension that serves the current working directory over a local
static HTTP server and opens it in your browser.

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

| Command        | Effect                                      |
|----------------|---------------------------------------------|
| `/serve-start` | Serve cwd on localhost; open the browser    |
| `/serve-stop`  | Stop the running server                     |

Calling `/serve-start` again while a server is already up for the same
directory **keeps the same port**, leaves the process running, and only
opens the browser again. If the session cwd changed, it stops the old
server and starts a new one on a fresh free port for the new root.

## Behavior

- **Root:** pi session `ctx.cwd` (the directory pi is operating in).
- **Bind:** `127.0.0.1` only (not exposed on the LAN).
- **Port:** ephemeral (`0` → OS picks a free local port).
- **index.html:** served automatically when present in a directory.
- **Directory listing:** dark HTML index when there is no `index.html`.
- **Traversal:** paths stay under the root; `..` escapes are rejected.
- **Status:** footer shows `serve http://127.0.0.1:<port>/` while up.
- **Cleanup:** stops on `/serve-stop` and on session shutdown.

No npm runtime dependencies — Node built-in `http` / `fs` only.

## License

MIT © Richard Anaya
