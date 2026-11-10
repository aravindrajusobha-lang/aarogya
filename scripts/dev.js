import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('----------------------------------------------------');
console.log('🌿 Aarogya-Drishti (ITDA Paderu Simulation Platform)');
console.log('🚀 Starting AI Engine (Port 8000), Backend (Port 5000) & Frontend (Port 5173)...');
console.log('----------------------------------------------------');

const pyProc = spawn('python', ['-m', 'uvicorn', 'ai_service.main:app', '--port', '8000', '--host', '0.0.0.0'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

pyProc.on('error', (err) => {
  console.warn('⚠️ Python AI microservice not started (fallback to client-side ONNX WASM mode):', err.message);
});

const serverProc = spawn(npmCmd, ['--workspace=server', 'run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

const clientProc = spawn(npmCmd, ['--workspace=client', 'run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  console.log('\n🛑 Shutting down Aarogya-Drishti services...');
  try {
    if (isWin) {
      if (pyProc && pyProc.pid) spawn('taskkill', ['/pid', String(pyProc.pid), '/f', '/t']);
      if (serverProc.pid) spawn('taskkill', ['/pid', String(serverProc.pid), '/f', '/t']);
      if (clientProc.pid) spawn('taskkill', ['/pid', String(clientProc.pid), '/f', '/t']);
    } else {
      if (pyProc) pyProc.kill('SIGINT');
      serverProc.kill('SIGINT');
      clientProc.kill('SIGINT');
    }
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

serverProc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend server exited with code ${code}`);
  }
});

clientProc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Client dev server exited with code ${code}`);
  }
});

