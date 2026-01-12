#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[TEST] Starting optimized MCP server test...');
console.log('[TEST] GITHUB_TOKEN is set:', !!process.env.GITHUB_TOKEN);

// Start the MCP server
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let requestStartTime = null;
let responseBuffer = '';

server.stderr.on('data', (data) => {
  const message = data.toString();
  if (message.includes('[GitHubClient]') || message.includes('[GitHubMCPServer]')) {
    console.log('[SERVER]:', message.trim());
  }
});

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  // Try to parse complete JSON messages
  const lines = responseBuffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const response = JSON.parse(line);
        const elapsed = requestStartTime ? Date.now() - requestStartTime : 0;
        
        // Check if this is the PR list response
        if (response.id >= 2 && response.id <= 4 && response.result) {
          if (response.result.content && response.result.content[0]) {
            const content = JSON.parse(response.result.content[0].text);
            console.log(`\n[RESULT ${response.id}] Response time: ${elapsed}ms`);
            console.log(`  Total PRs: ${content.total_count}`);
            console.log(`  State filter: ${content.state_filter}`);
            
            if (content.pull_requests && content.pull_requests.length > 0) {
              console.log(`  Sample PRs:`);
              content.pull_requests.slice(0, 3).forEach(pr => {
                console.log(`    #${pr.number}: ${pr.title} (${pr.state})`);
              });
            }
          }
        }
      } catch (e) {
        // Not a complete JSON message yet
      }
    }
  }
  
  // Keep the last incomplete line in the buffer
  responseBuffer = lines[lines.length - 1];
});

const sendMessage = (message, description) => {
  console.log(`\n[SENDING] ${description}`);
  requestStartTime = Date.now();
  server.stdin.write(JSON.stringify(message) + '\n');
};

// Wait for server to start
setTimeout(() => {
  console.log('\n=== Running Performance Tests ===\n');
  
  // Test 1: Basic PR list (no extras)
  sendMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "github_list_pull_requests",
      arguments: {
        owner: "cybermental",
        repo: "system-designer-web",
        state: "all",
        include_comments: false,
        include_checks: false
      }
    }
  }, "Test 1: List all PRs (no comments/checks)");

  // Test 2: Only open PRs (should be faster)
  setTimeout(() => {
    sendMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "github_list_pull_requests",
        arguments: {
          owner: "cybermental",
          repo: "system-designer-web",
          state: "open",
          include_comments: false,
          include_checks: false
        }
      }
    }, "Test 2: List only OPEN PRs (no extras)");
  }, 5000);

  // Test 3: Open PRs with comments (slower)
  setTimeout(() => {
    sendMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "github_list_pull_requests",
        arguments: {
          owner: "cybermental",
          repo: "system-designer-web",
          state: "open",
          include_comments: true,
          include_checks: false
        }
      }
    }, "Test 3: List OPEN PRs with comments");
  }, 10000);

  // Shutdown after tests
  setTimeout(() => {
    console.log('\n=== Test Complete ===');
    server.kill();
  }, 20000);
}, 2000);

server.on('exit', (code) => {
  console.log(`\n[TEST] Server exited with code ${code}`);
  process.exit(0);
});