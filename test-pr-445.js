#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[TEST] Fetching PR #445 from system-designer-web...\n');

// Start the MCP server
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let responseBuffer = '';
let requestCount = 0;

server.stderr.on('data', (data) => {
  // Suppress verbose logs
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
        
        // Handle PR list response
        if (response.id === 1 && response.result) {
          if (response.result.content && response.result.content[0]) {
            const content = JSON.parse(response.result.content[0].text);
            
            // Find PR #445
            const pr445 = content.pull_requests.find(pr => pr.number === 445);
            
            if (pr445) {
              console.log('✓ Found PR #445\n');
              console.log('PR Details:');
              console.log('===========');
              console.log(`Number: #${pr445.number}`);
              console.log(`Title: ${pr445.title}`);
              console.log(`State: ${pr445.state}`);
              console.log(`Author: ${pr445.user.login}`);
              console.log(`Created: ${pr445.created_at}`);
              console.log(`Updated: ${pr445.updated_at}`);
              console.log(`Base Branch: ${pr445.base.ref}`);
              console.log(`Head Branch: ${pr445.head.ref}`);
              
              if (pr445.labels && pr445.labels.length > 0) {
                console.log(`Labels: ${pr445.labels.map(l => l.name).join(', ')}`);
              }
              
              if (pr445.body) {
                console.log(`\nDescription:\n${pr445.body.substring(0, 200)}${pr445.body.length > 200 ? '...' : ''}`);
              }
              
              // Now fetch comments for this PR
              console.log('\nFetching comments for PR #445...');
              requestCount++;
              sendMessage({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: {
                  name: "github_get_pr_comments",
                  arguments: {
                    owner: "cybermental",
                    repo: "system-designer-web",
                    pull_number: 445
                  }
                }
              });
            } else {
              console.log('❌ PR #445 not found in the results');
              console.log('Available PRs:', content.pull_requests.map(pr => pr.number).join(', '));
            }
          }
        }
        
        // Handle comments response
        if (response.id === 2 && response.result) {
          if (response.result.content && response.result.content[0]) {
            const content = JSON.parse(response.result.content[0].text);
            
            console.log(`\nComments (${content.total_comments} total):`);
            console.log('=================================');
            
            if (content.comments && content.comments.length > 0) {
              content.comments.slice(0, 3).forEach((comment, index) => {
                console.log(`\nComment ${index + 1}:`);
                console.log(`  Author: ${comment.user.login}`);
                console.log(`  Date: ${comment.created_at}`);
                console.log(`  Type: ${comment.type}`);
                console.log(`  Body: ${comment.body.substring(0, 100)}${comment.body.length > 100 ? '...' : ''}`);
              });
              
              if (content.comments.length > 3) {
                console.log(`\n... and ${content.comments.length - 3} more comments`);
              }
            } else {
              console.log('No comments on this PR');
            }
            
            // Done, exit
            setTimeout(() => {
              server.kill();
              process.exit(0);
            }, 500);
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

// Wait for server to start, then fetch PRs
setTimeout(() => {
  console.log('Fetching all PRs to find #445...\n');
  
  sendMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "github_list_pull_requests",
      arguments: {
        owner: "cybermental",
        repo: "system-designer-web",
        state: "all"  // Search in all PRs
      }
    }
  });
  
  // Timeout after 15 seconds
  setTimeout(() => {
    console.log('\nTimeout - exiting...');
    server.kill();
    process.exit(1);
  }, 15000);
}, 2000);

server.on('exit', (code) => {
  if (requestCount === 0) {
    console.log('\n[TEST] Server exited unexpectedly');
  }
});