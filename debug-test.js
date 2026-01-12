#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[DEBUG] Starting MCP server debug test...');
console.log('[DEBUG] GITHUB_TOKEN is set:', !!process.env.GITHUB_TOKEN);

// Start the MCP server
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let requestStartTime = null;
let responseBuffer = '';

server.stderr.on('data', (data) => {
  const message = data.toString();
  console.log('[SERVER LOG]:', message.trim());
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
        console.log(`[RESPONSE] (${elapsed}ms):`, JSON.stringify(response, null, 2));
        
        // Check if this is the PR list response
        if (response.id === 2 && response.result) {
          console.log('\n[DEBUG] Pull request list received!');
          if (response.result.content && response.result.content[0]) {
            const content = JSON.parse(response.result.content[0].text);
            console.log(`[DEBUG] Total PRs found: ${content.total_count}`);
            console.log(`[DEBUG] Response time: ${elapsed}ms`);
            
            if (content.pull_requests && content.pull_requests.length > 0) {
              console.log(`[DEBUG] First PR: #${content.pull_requests[0].number} - ${content.pull_requests[0].title}`);
              
              // Check if comments were included
              if (content.pull_requests[0].comments_list) {
                console.log(`[DEBUG] Comments included for each PR: YES`);
                console.log(`[DEBUG] Comments on first PR: ${content.pull_requests[0].comments_list.length}`);
              }
              
              // Check if checks were included  
              if (content.pull_requests[0].check_runs) {
                console.log(`[DEBUG] Check runs included for each PR: YES`);
                console.log(`[DEBUG] Check runs on first PR: ${content.pull_requests[0].check_runs.length}`);
              }
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

const sendMessage = (message) => {
  console.log('\n[SENDING]:', JSON.stringify(message));
  if (message.method === 'tools/call') {
    requestStartTime = Date.now();
  }
  server.stdin.write(JSON.stringify(message) + '\n');
};

// Wait for server to start
setTimeout(() => {
  console.log('\n[DEBUG] Server should be ready, listing available tools...');
  
  // List tools
  sendMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });

  setTimeout(() => {
    console.log('\n[DEBUG] Calling github_list_pull_requests with comments and checks enabled...');
    console.log('[DEBUG] This may take some time if there are many PRs or if comments/checks are included.');
    
    // Call the list PR function with timing
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
          include_comments: true,
          include_checks: true
        }
      }
    });

    // Give it 30 seconds to complete
    setTimeout(() => {
      console.log('\n[DEBUG] Test complete. Shutting down server...');
      server.kill();
    }, 30000);
  }, 1000);
}, 2000);

server.on('exit', (code) => {
  console.log(`\n[DEBUG] Server exited with code ${code}`);
  process.exit(0);
});