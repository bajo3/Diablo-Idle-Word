/**
 * Minimal stdio JSON-RPC client for the pixel-mcp (Aseprite) MCP server.
 *
 * The MCP Inspector's `--cli` mode passes each tool argument as a separate `--tool-arg key=value`
 * flag, which cannot carry a `draw_pixels` payload of a few thousand pixel objects. This client
 * speaks the protocol directly so a whole sprite can be drawn in one call.
 */
import { spawn } from 'node:child_process';

// The plugin's `pixel-mcp` entry point is a POSIX shell dispatcher, which `spawn` cannot execute on
// Windows — point straight at the platform binary it would have selected.
const SERVER_BIN =
  'C:/Users/felip/.claude/plugins/cache/pixel-plugin/pixel-plugin/0.5.0/bin/pixel-mcp-windows-amd64.exe';

export class PixelMcp {
  #child;
  #nextId = 1;
  #pending = new Map();
  #buffer = '';

  async start() {
    this.#child = spawn(SERVER_BIN, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.#child.stdout.setEncoding('utf8');
    this.#child.stdout.on('data', (chunk) => this.#onData(chunk));
    // The server logs to stderr; surface only genuine failures so runs stay readable.
    this.#child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      if (/ERR|FTL|panic/i.test(text)) process.stderr.write(`[server] ${text}`);
    });

    await this.#request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'brecha-sprite-gen', version: '1.0.0' },
    });
    this.#notify('notifications/initialized', {});
  }

  #onData(chunk) {
    this.#buffer += chunk;
    let index;
    while ((index = this.#buffer.indexOf('\n')) >= 0) {
      const line = this.#buffer.slice(0, index).trim();
      this.#buffer = this.#buffer.slice(index + 1);
      if (line.length === 0) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue; // non-JSON server chatter
      }
      const pending = this.#pending.get(message.id);
      if (pending === undefined) continue;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    }
  }

  #send(payload) {
    this.#child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  #notify(method, params) {
    this.#send({ jsonrpc: '2.0', method, params });
  }

  #request(method, params) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#send({ jsonrpc: '2.0', id, method, params });
    });
  }

  /** Calls a tool and returns its `structuredContent`, throwing on a tool-level error. */
  async call(name, args) {
    const result = await this.#request('tools/call', { name, arguments: args });
    if (result.isError) throw new Error(`${name} failed: ${JSON.stringify(result.content)}`);
    return result.structuredContent ?? result;
  }

  stop() {
    this.#child?.kill();
  }
}
