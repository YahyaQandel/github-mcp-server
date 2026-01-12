#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the MCP server
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let responseBuffer = '';

server.stderr.on('data', (data) => {
  // Suppress server logs
});

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  const lines = responseBuffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const response = JSON.parse(line);
        
        if (response.id === 1 && response.result) {
          if (response.result.content && response.result.content[0]) {
            const content = JSON.parse(response.result.content[0].text);
            const pr = content.pull_request;
            
            if (pr && pr.files) {
              console.log(`PR #${pr.number}: ${pr.title}`);
              console.log(`\nChanged Files (${pr.files.length} files):`);
              console.log('================================');
              pr.files.forEach(file => {
                console.log(`  ${file.filename}`);
              });
            } else {
              console.log('PR not found or no files data available');
            }
            
            server.kill();
            process.exit(0);
          }
        }
      } catch (e) {
        // Not a complete JSON message yet
      }
    }
  }
  
  responseBuffer = lines[lines.length - 1];
});

const sendMessage = (message) => {
  server.stdin.write(JSON.stringify(message) + '\n');
};

// Wait for server to start, then fetch PR details
setTimeout(() => {
  sendMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "github_get_pr_details",
      arguments: {
        owner: "cybermental",
        repo: "system-designer-web",
        pull_number: 445,
        include_diff: false
      }
    }
  });
  
  setTimeout(() => {
    console.log('Request timed out or PR not found');
    server.kill();
    process.exit(1);
  }, 10000);
}, 2000);