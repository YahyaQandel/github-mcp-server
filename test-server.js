#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the MCP server
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

server.stderr.on('data', (data) => {
  console.log('[SERVER STDERR]:', data.toString());
});

server.stdout.on('data', (data) => {
  console.log('[SERVER STDOUT]:', data.toString());
});

// Send test messages
const sendMessage = (message) => {
  console.log('[SENDING]:', JSON.stringify(message));
  server.stdin.write(JSON.stringify(message) + '\n');
};

// Wait a bit for server to start, then send test messages
setTimeout(() => {
  // List tools
  sendMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });

  setTimeout(() => {
    // Skip token setting - should use environment variable automatically
    // Try to list PRs directly
    sendMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "github_list_pull_requests",
        arguments: {
          owner: "cybermental",
          repo: "system-designer-web",
          state: "open"
        }
      }
    });

    setTimeout(() => {
      server.kill();
    }, 3000);
  }, 1000);
}, 1000);

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
});