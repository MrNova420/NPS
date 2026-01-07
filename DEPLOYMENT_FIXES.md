# Deployment Fixes and Improvements

This document explains the fixes applied to resolve deployment issues with NPS server templates.

## Issues Addressed

### 1. **Password Prompts During Deployment** ✅ FIXED
**Problem:** SSH connections required password input in the terminal, blocking deployment.

**Solution:** 
- Created `setup-ssh-keys.sh` script for SSH key-based authentication
- Eliminates all password prompts after one-time setup
- Works on both PC → Android and within Termux

**How to use:**
```bash
bash setup-ssh-keys.sh
```

This will:
1. Generate SSH keys if they don't exist
2. Copy the public key to your Android device
3. Configure passwordless SSH authentication

After running this once, you'll never need to enter a password again!

---

### 2. **Deployment Timeouts** ✅ FIXED
**Problem:** Server templates failed after 1-2 minutes due to hardcoded short timeouts.

**Solution:**
- Increased default timeout from 30s to 5 minutes (300,000ms)
- `npm install` and `pip install` now have adequate time to complete
- Added timeout parameter to `sshExec` function
- Long-running commands now show progress indicators

**Changes:**
```javascript
// Before: 30 second timeout (too short)
await sshExec(command);

// After: 5 minute timeout with feedback
await sshExec(command, { timeout: 300000 });
console.log('⏳ Running long operation...');
```

---

### 3. **No Process Verification** ✅ FIXED
**Problem:** Templates didn't verify that servers actually started successfully.

**Solution:**
- Added `verifyProcessRunning()` to check if PID exists
- Added `isPortListening()` to verify port is open
- Templates now throw errors if deployment fails
- Better error messages tell you exactly what went wrong

**New verification flow:**
1. Start process
2. Get PID from PID file
3. Verify PID is actually running
4. Wait for port to be listening (10 second timeout with retries)
5. Return success only if all checks pass

---

### 4. **Poor Error Messages** ✅ FIXED
**Problem:** Generic errors like "Command failed" didn't help troubleshoot.

**Solution:**
- SSH connection errors now show specific issues:
  - "SSH connection refused" → SSH server not running
  - "Command timed out" → Shows which command and timeout duration
  - "Process not running" → Shows PID and log file location
- Deployment errors include helpful tips for resolution

**Example error messages:**
```
❌ Failed to start server: Process (PID 1234) is not running.
   Check logs at ~/server/instances/xyz/logs/server.log

💡 Tip: Verify SSH is running and credentials are correct
   Try: ssh -p 8022 user@android-ip
```

---

### 5. **CPU Overload and Crashes** ✅ FIXED
**Problem:** Dashboard hitting 100% CPU and crashing after deployment attempts.

**Solution:**
- Added rate limiting: 100 requests per minute per IP
- Returns HTTP 429 with retry-after header when exceeded
- Automatic cleanup of old rate limit data
- Better graceful shutdown handling

**Rate limiting response:**
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Maximum 100 requests per minute.",
  "retryAfter": 45
}
```

---

### 6. **Deployment Stage Feedback** ✅ IMPROVED
**Problem:** No visibility into what stage of deployment was happening.

**Solution:**
- Added `deploymentStage` field to server object
- WebSocket broadcasts deployment progress
- Shows: initializing → allocating resources → deploying template → verifying deployment → completed

**Stages:**
1. `initializing` - Starting deployment
2. `allocating resources` - Reserving CPU/memory/bandwidth
3. `deploying template` - Running template deploy function
4. `verifying deployment` - Checking process/port
5. `completed` or `failed` - Final status

---

### 7. **Graceful Shutdown** ✅ IMPROVED
**Problem:** Server crashed ungracefully, losing state.

**Solution:**
- Proper SIGINT/SIGTERM handlers
- Closes HTTP server gracefully
- Closes all WebSocket connections
- Saves server state before exit
- Gives processes time to finish

---

## Updated Server Templates

All templates (nodejs-api, discord-bot, flask-app) now include:

✅ Extended timeouts for package installation (5 minutes)
✅ Process verification after start
✅ Better error messages with actionable tips
✅ Try-catch blocks around critical operations
✅ Log file locations in error messages

## Deployment Best Practices

### First Time Setup
1. Run `bash setup-ssh-keys.sh` to configure passwordless SSH
2. Verify connection: `ssh -p 8022 user@android-ip "echo OK"`
3. Start dashboard: `cd dashboard && npm start`

### Before Deploying Servers
- ✅ SSH keys configured (no password prompts)
- ✅ Adequate resources available (check CPU/memory)
- ✅ Network connection stable
- ✅ Target device has required packages (nodejs, python, etc.)

### If Deployment Fails
1. Check the deployment error message (now much more helpful!)
2. Verify SSH connection works manually
3. Check device resources: `ssh -p 8022 user@ip "free -h && df -h"`
4. Review logs at `~/server/instances/<server-id>/logs/`
5. Try deploying again (may have been a network hiccup)

### Monitoring CPU Usage
The dashboard now has automatic protections:
- Rate limiting prevents request floods
- Performance manager throttles when CPU > 80%
- Auto-recovery system restarts failed services
- Thermal manager prevents overheating

## API Changes

### sshExec Function
New signature with options:
```javascript
sshExec(command, options = {
    timeout: 300000,  // 5 minutes default
    silent: false     // Show progress for long operations
})
```

### Server Manager Methods
New methods added:
- `verifyProcessRunning(pid)` - Check if PID exists
- `waitForProcess(pidFile, maxWaitMs)` - Wait for process to start
- `isPortListening(port)` - Check if port is open

## Troubleshooting

### "SSH connection refused"
```bash
# On Android device:
pgrep sshd || sshd

# Verify it's listening:
netstat -tuln | grep 8022
```

### "Command timed out after 300000ms"
- Check network connection
- Verify device has internet for package downloads
- May need to increase timeout for very slow devices

### "Process not running"
- Check logs at the path shown in error message
- Usually indicates a configuration error in the server code
- May be missing dependencies

### "Port not listening"
- Server may have crashed immediately after start
- Check logs for startup errors
- Verify port is not already in use

## Performance Tips

1. **Use SSH keys** - Eliminates password overhead
2. **Close unused servers** - Frees up resources  
3. **Monitor CPU** - Dashboard will throttle automatically
4. **Check logs** - Early warning of issues
5. **Stable network** - Avoid deployment during network issues

## Security Improvements

- ✅ Rate limiting prevents DOS attacks
- ✅ SSH key authentication more secure than passwords
- ✅ Proper error handling prevents information leakage
- ✅ Graceful shutdown prevents data corruption
- ✅ Process verification prevents zombie processes

---

## Summary

All major deployment issues have been addressed:
- ✅ No more password prompts (use setup-ssh-keys.sh)
- ✅ Extended timeouts for slow operations
- ✅ Process verification ensures servers actually start
- ✅ Detailed error messages for troubleshooting
- ✅ Rate limiting prevents CPU overload
- ✅ Graceful shutdown preserves state
- ✅ Better deployment feedback via WebSockets

The deployment system is now much more robust and user-friendly!
