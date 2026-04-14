#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const binary = path.join(__dirname, '..', 'dist', 'agentflow');
const proc = spawn(binary, process.argv.slice(2), { stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code ?? 0));
