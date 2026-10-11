import { join } from 'node:path';
import { cliEnvironment, repositoryRoot, type WorkerConfiguration, type WorkerMessage } from './protocol';

/** Host-side process tracking, outside Senderos. No worker reads a sibling's files. */
export class WorkerSession {
  readonly process: ReturnType<typeof Bun.spawn>;
  private readonly pending: Array<{ resolve: (value: WorkerMessage) => void; reject: (error: Error) => void }> = [];
  private readonly messages: WorkerMessage[] = [];
  private failure?: Error;
  cliProcesses = 0;
  private readonly stderr: Promise<string>;

  constructor(readonly configuration: WorkerConfiguration) {
    this.process = Bun.spawn({
      cmd: [process.execPath, join(repositoryRoot, 'examples/external-host/worker.ts')],
      cwd: configuration.workspace,
      env: cliEnvironment(configuration.databaseUrl),
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    this.stderr = new Response(this.process.stderr as ReadableStream).text();
    this.consume(this.process.stdout as ReadableStream<Uint8Array>).catch((error: Error) => {
      this.failure = error;
      for (const pending of this.pending.splice(0)) pending.reject(error);
    });
    this.write(configuration);
  }

  private write(value: unknown) {
    const stdin = this.process.stdin as { write: (value: string) => unknown; flush: () => unknown };
    stdin.write(`${JSON.stringify(value)}\n`);
    stdin.flush();
  }

  private async consume(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const message = JSON.parse(line) as WorkerMessage;
        this.cliProcesses = Number(message.cliProcesses ?? this.cliProcesses);
        const waiting = this.pending.shift();
        if (waiting) waiting.resolve(message);
        else this.messages.push(message);
      }
    }
    const code = await this.process.exited;
    const stderr = await this.stderr;
    if (this.pending.length) throw new Error(`Worker exited before replying (${code}): ${stderr}`);
    this.failure = new Error(`Worker has exited (${code}): ${stderr}`);
  }

  async next(type: string): Promise<WorkerMessage> {
    const message = this.messages.shift() ?? await new Promise<WorkerMessage>((resolve, reject) => {
      if (this.failure) { reject(this.failure); return; }
      const timer = setTimeout(() => {
        const index = this.pending.indexOf(waiting);
        if (index >= 0) this.pending.splice(index, 1);
        reject(new Error(`Worker did not return ${type} within 30 seconds`));
      }, 30_000);
      const waiting = {
        resolve: (value: WorkerMessage) => { clearTimeout(timer); resolve(value); },
        reject: (error: Error) => { clearTimeout(timer); reject(error); },
      };
      this.pending.push(waiting);
    });
    if (message.type !== type) throw new Error(`Expected worker ${type}, received ${JSON.stringify(message)}`);
    return message;
  }

  async request(type: string, expected = type, fields: Record<string, unknown> = {}) {
    this.write({ type, ...fields });
    return this.next(expected);
  }

  async kill() {
    this.process.kill('SIGKILL');
    await this.process.exited;
  }
}
