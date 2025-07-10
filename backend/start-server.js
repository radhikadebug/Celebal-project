const { execSync, spawn } = require('child_process');
const process = require('process');
const fs = require('fs');
const path = require('path');

// Default port
const DEFAULT_PORT = 3001;
const FALLBACK_PORTS = [3002, 3003, 3004, 3005, 8080, 8081, 8082, 9000];

// Get the port from command line arguments or environment or use default
let port = process.env.PORT || DEFAULT_PORT;

// Ensure port is a valid number
port = parseInt(port, 10);
if (isNaN(port) || port < 0 || port > 65535) {
  console.warn(`Invalid port: ${port}. Using default port ${DEFAULT_PORT} instead.`);
  port = DEFAULT_PORT;
}

console.log(`Attempting to start server on port ${port}...`);

// Function to find and kill process using a specific port (Windows-specific)
function killProcessOnPort(port) {
  try {
    // Find process ID using the port
    const findCommand = `netstat -ano | findstr :${port}`;
    console.log(`Running: ${findCommand}`);
    
    const output = execSync(findCommand, { encoding: 'utf8' });
    console.log('Network status output:', output);
    
    // Extract PID from the output
    // Output format is like: "  TCP    127.0.0.1:3001         0.0.0.0:0              LISTENING       12345"
    const lines = output.split('\n').filter(line => line.includes('LISTENING'));
    
    if (lines.length === 0) {
      console.log(`No process found listening on port ${port}`);
      return false;
    }
    
    // Get PID from the last column
    const pid = lines[0].trim().split(/\s+/).pop();
    
    if (pid && parseInt(pid, 10) > 0) {
      console.log(`Found process with PID ${pid} using port ${port}, attempting to terminate...`);
      
      // Kill the process
      execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
      console.log(`Process with PID ${pid} has been terminated`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error finding or killing process on port ${port}:`, error.message);
    return false;
  }
}

// Function to find available port
function findAvailablePort(initialPort) {
  // Ensure port is numeric
  initialPort = parseInt(initialPort, 10);
  
  // Validate port number
  if (isNaN(initialPort) || initialPort < 1024 || initialPort > 65535) {
    console.warn(`Invalid port: ${initialPort}. Using default port ${DEFAULT_PORT}`);
    initialPort = DEFAULT_PORT;
  }
  
  // Try the initial port first
  if (tryPort(initialPort)) {
    return initialPort;
  }
  
  // Try each fallback port in sequence (fixed list of reasonable ports)
  for (const fbPort of FALLBACK_PORTS) {
    if (fbPort !== initialPort && tryPort(fbPort)) {
      return fbPort;
    }
  }
  
  // If all ports are taken, use a random port in the safe range
  const randomPort = Math.floor(Math.random() * (10000) + 40000); // Between 40000-50000
  console.log(`All specific ports are in use. Using random port ${randomPort}`);
  return randomPort;
}

function tryPort(port) {
  try {
    killProcessOnPort(port);
    return true;
  } catch (error) {
    console.warn(`Could not free port ${port}: ${error.message}`);
    return false;
  }
}

// Find an available port
const selectedPort = findAvailablePort(port);

// Try to kill any process using our port
try {
  killProcessOnPort(selectedPort);
} catch (error) {
  console.warn(`Unable to kill process on port ${selectedPort}: ${error.message}`);
}

// Start the server with the selected port (ensure it's a string for env vars)
console.log(`Starting server on port ${selectedPort}...`);

// Use spawn to start the server in a new process with the properly formatted port
const serverProcess = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: selectedPort.toString() }
});

// Handle server process events
serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

console.log(`Server started with PID ${serverProcess.pid}`);
