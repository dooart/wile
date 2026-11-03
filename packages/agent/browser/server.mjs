import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import { chromium } from 'playwright-core';

const executable = process.env.CHROME_EXECUTABLE_PATH;
const versionText = execFileSync(executable, ['--version'], { encoding: 'utf8' });
const version = versionText.match(/\b(\d+)\.(\d+)\.(\d+)\.(\d+)\b/)?.slice(1).map(Number);
const minimum = [156, 0, 8078, 79];
const firstDifference = version?.findIndex((part, i) => part !== minimum[i]);
if (!version || (firstDifference !== -1 && version[firstDifference] < minimum[firstDifference])) {
  throw new Error(`Browser is below the patched baseline 156.0.8078.79: ${versionText.trim()}`);
}
const profile = await mkdtemp('/tmp/wile-browser-');
const child = spawn(executable, [
  '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9223',
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-sync', 'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'], env: { PATH: process.env.PATH, HOME: '/home/browser', TMPDIR: '/tmp' } });
let launchError;
child.once('error', error => { launchError = error; });
let relay;
let stopped = false;
async function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  relay?.close();
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await exited;
  }
  await rm(profile, { recursive: true, force: true });
  process.exit(code);
}
process.once('SIGTERM', () => void stop());
process.once('SIGINT', () => void stop());
child.once('exit', code => { if (!stopped) void stop(code ?? 1); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error('Sandboxed browser exited before startup');
    try { ready = (await fetch('http://127.0.0.1:9223/json/version')).ok; } catch { /* Wait only for this owned browser. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Sandboxed browser startup timed out');
  const client = await chromium.connectOverCDP('http://127.0.0.1:9223');
  const context = client.contexts()[0];
  const page = await context.newPage();
  await page.goto('chrome://sandbox');
  const sandboxStatus = await page.locator('body').innerText();
  console.log(versionText.trim());
  console.log(sandboxStatus);
  if (!/Seccomp-BPF sandbox\s+Yes/i.test(sandboxStatus) || !/(?:PID namespaces|Namespace Sandbox)\s+Yes/i.test(sandboxStatus)) {
    throw new Error('Refusing CDP service: renderer sandbox could not be verified');
  }
  await page.close();
  await client.close();
  const externalEndpoint = 'ws://wile-browser:9222';
  relay = http.createServer((request, response) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: 9223, path: request.url,
      method: request.method, headers: { ...request.headers, host: '127.0.0.1:9223' } }, result => {
      if ((result.headers['content-type'] ?? '').includes('application/json')) {
        const chunks = [];
        result.on('data', chunk => chunks.push(chunk));
        result.on('end', () => {
          const body = Buffer.concat(chunks).toString().replaceAll('ws://127.0.0.1:9223', externalEndpoint)
            .replaceAll('ws://localhost:9223', externalEndpoint);
          response.writeHead(result.statusCode ?? 502, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
          response.end(body);
        });
      } else { response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response); }
    });
    upstream.on('error', () => { response.writeHead(502); response.end(); });
    request.pipe(upstream);
  });
  relay.on('upgrade', (request, socket, head) => {
    const upstream = net.connect(9223, '127.0.0.1', () => {
      const headers = Object.entries(request.headers).filter(([key]) => !['host', 'origin'].includes(key.toLowerCase()));
      upstream.write(`${request.method} ${request.url} HTTP/1.1\r\nHost: 127.0.0.1:9223\r\n${headers.map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
  });
  relay.listen(9222, '0.0.0.0', () => console.log('Sandbox verified; CDP ready on the private container network'));
} catch (error) { console.error(error); await stop(1); }
