#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[TEST] Testing default parameters...');

// Start the MCP server
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let requestStartTime = null;
let responseBuffer = '';

server.stderr.on('data', (data) => {
  const message = data.toString();
  if (message.includes('Found') || message.includes('listPullRequests')) {
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
        
        if (response.id === 1 && response.result) {
          if (response.result.content && response.result.content[0]) {
            const content = JSON.parse(response.result.content[0].text);
            console.log(`\n✓ Response received in ${elapsed}ms`);
            console.log(`  Total PRs: ${content.total_count}`);
            
            if (content.pull_requests && content.pull_requests.length > 0) {
              const firstPR = content.pull_requests[0];
              console.log(`  First PR: #${firstPR.number}`);
              console.log(`  Has comments_list: ${firstPR.comments_list ? 'YES' : 'NO'}`);
              console.log(`  Has check_runs: ${firstPR.check_runs ? 'YES' : 'NO'}`);
              console.log(`  Has statuses: ${firstPR.statuses ? 'YES' : 'NO'}`);
              
              if (!firstPR.comments_list && !firstPR.check_runs) {
                console.log('\n✅ SUCCESS: Defaults are working correctly!');
                console.log('   Comments and checks are NOT included by default.');
              } else {
                console.log('\n❌ FAILURE: Defaults not working!');
                console.log('   Comments or checks were included when they shouldn\'t be.');
              }
            }
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
  requestStartTime = Date.now();
  server.stdin.write(JSON.stringify(message) + '\n');
};

// Wait for server to start
setTimeout(() => {
  console.log('\nCalling github_list_pull_requests WITHOUT specifying include_comments or include_checks...');
  
  // Call WITHOUT specifying the boolean flags - should use defaults (false)
  sendMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "github_list_pull_requests",
      arguments: {
        owner: "cybermental",
        repo: "system-designer-web",
        state: "open"
      }
      // Note: NOT specifying include_comments or include_checks
    }
  });

  setTimeout(() => {
    server.kill();
    process.exit(0);
  }, 5000);
}, 2000);

server.on('exit', (code) => {
  console.log(`\n[TEST] Server exited with code ${code}`);
});