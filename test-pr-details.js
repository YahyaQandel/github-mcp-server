#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[TEST] Fetching PR details from design-first/system-designer...\n');

// Start the MCP server
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let responseBuffer = '';
let requestStartTime = null;

server.stderr.on('data', (data) => {
  const message = data.toString();
  if (message.includes('Fetching PR #')) {
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
        
        // Handle PR details response
        if (response.id === 1 && response.result) {
          const elapsed = requestStartTime ? Date.now() - requestStartTime : 0;
          console.log(`✓ Response received in ${elapsed}ms\n`);
          
          if (response.result.content && response.result.content[0]) {
            const content = JSON.parse(response.result.content[0].text);
            const pr = content.pull_request;
            
            console.log('PR Details:');
            console.log('===========');
            console.log(`Number: #${pr.number}`);
            console.log(`Title: ${pr.title}`);
            console.log(`State: ${pr.state}`);
            console.log(`Author: ${pr.user.login}`);
            console.log(`Created: ${pr.created_at}`);
            console.log(`Updated: ${pr.updated_at}`);
            console.log(`Base Branch: ${pr.base.ref}`);
            console.log(`Head Branch: ${pr.head.ref}`);
            console.log(`Additions: +${pr.additions}`);
            console.log(`Deletions: -${pr.deletions}`);
            console.log(`Changed Files: ${pr.changed_files}`);
            console.log(`Total Commits: ${pr.commits_list.length}`);
            
            if (pr.labels && pr.labels.length > 0) {
              console.log(`Labels: ${pr.labels.map(l => l.name).join(', ')}`);
            }
            
            if (pr.body) {
              console.log(`\nDescription:\n${pr.body.substring(0, 200)}${pr.body.length > 200 ? '...' : ''}`);
            }
            
            console.log(`\nFiles Changed (${pr.files.length} files):`);
            console.log('================================');
            pr.files.slice(0, 10).forEach(file => {
              console.log(`  ${file.status.padEnd(10)} ${file.filename} (+${file.additions} -${file.deletions})`);
            });
            
            if (pr.files.length > 10) {
              console.log(`  ... and ${pr.files.length - 10} more files`);
            }
            
            console.log(`\nCommits (${pr.commits_list.length} commits):`);
            console.log('=================================');
            pr.commits_list.slice(0, 5).forEach(commit => {
              const message = commit.message.split('\n')[0];
              console.log(`  ${commit.sha.substring(0, 7)} - ${message}`);
            });
            
            if (pr.commits_list.length > 5) {
              console.log(`  ... and ${pr.commits_list.length - 5} more commits`);
            }
            
            if (content.diff) {
              console.log(`\nDiff Preview (first 500 chars):`);
              console.log('=================================');
              console.log(content.diff.substring(0, 500));
              console.log('...\n');
              console.log(`Total diff size: ${content.diff.length} characters`);
            }
          }
          
          // Exit after displaying results
          setTimeout(() => {
            server.kill();
            process.exit(0);
          }, 500);
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

// Wait for server to start, then fetch PR details
setTimeout(() => {
  console.log('Fetching PR #445 details (without diff)...\n');
  
  sendMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "github_get_pr_details",
      arguments: {
        owner: "design-first",
        repo: "system-designer",
        pull_number: 445,
        include_diff: false  // Set to true if you want the full diff
      }
    }
  });
  
  // Timeout after 10 seconds
  setTimeout(() => {
    console.log('\nTimeout - exiting...');
    server.kill();
    process.exit(1);
  }, 10000);
}, 2000);

server.on('exit', (code) => {
  console.log(`\n[TEST] Server exited with code ${code}`);
});