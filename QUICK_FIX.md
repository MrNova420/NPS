# Quick Fix Guide for Deployment Issues

If your server templates are failing to deploy, follow these steps:

## 🚀 Quick Fix (5 minutes)

### Step 1: Setup SSH Keys (ONE TIME)
This eliminates password prompts:

```bash
cd NPS
bash setup-ssh-keys.sh
```

**What this does:**
- Generates SSH keys
- Copies them to your Android device
- Sets up passwordless authentication

You'll be prompted for your password **ONE TIME**, then never again!

### Step 2: Verify Setup
Test that SSH works without a password:

```bash
# Replace with your values
ssh -p 8022 user@android-ip "echo 'SSH OK'"
```

If it prints "SSH OK" without asking for a password, you're good to go!

### Step 3: Start the Dashboard
```bash
cd dashboard
npm install  # If not already done
npm start
```

### Step 4: Deploy a Server
1. Open http://localhost:3000 in your browser
2. Click "Create New Server"
3. Choose a template (e.g., Node.js API)
4. Fill in the configuration
5. Click "Deploy"

**What's different now:**
- ✅ No password prompts!
- ✅ Better error messages if something fails
- ✅ Longer timeouts (5 minutes instead of 30 seconds)
- ✅ Verification that server actually started
- ✅ Progress feedback during deployment

---

## 🔧 If It Still Fails

### Check SSH Connection
```bash
# On Android device (in Termux):
pgrep sshd || sshd

# Find your IP:
ifconfig | grep "inet "

# On PC, test connection:
ssh -p 8022 <username>@<android-ip>
```

### Check Device Resources
```bash
# SSH into device and check:
free -h    # Check memory
df -h      # Check disk space
top        # Check CPU usage
```

You need:
- At least 500MB free memory
- At least 1GB free disk space
- CPU not constantly at 100%

### Check Logs
If deployment fails, check:
```bash
# Dashboard logs
cat dashboard/logs/*.log 2>/dev/null || echo "No logs yet"

# Server logs (replace SERVER_ID with actual ID)
ssh -p 8022 user@android-ip "cat ~/server/instances/SERVER_ID/logs/*.log"
```

---

## 🐛 Common Errors and Fixes

### Error: "Password prompt in terminal"
**Fix:** Run `bash setup-ssh-keys.sh`

### Error: "Command timed out after 300000ms"
**Causes:**
- Slow internet connection during npm install
- Android device is very slow
- Network connectivity issue

**Fix:**
- Ensure stable network connection
- Try again (may have been temporary)
- Check device isn't overloaded with other tasks

### Error: "SSH connection refused"
**Causes:**
- SSH server not running on Android
- Wrong IP address in .env
- Firewall blocking connection

**Fix:**
```bash
# On Android:
sshd

# On PC, update .env:
echo "ANDROID_HOST=<your-android-ip>" >> dashboard/.env
```

### Error: "Process not running"
**Causes:**
- Server crashed immediately after start
- Missing dependencies
- Configuration error

**Fix:**
- Check server logs (path shown in error message)
- Verify dependencies installed: `node --version`, `python --version`
- Check server configuration is valid

### Error: "Port not listening"
**Causes:**
- Server failed to start
- Port already in use
- Firewall blocking port

**Fix:**
```bash
# Check if port is in use:
ssh -p 8022 user@android-ip "lsof -i:PORT_NUMBER"

# Kill process if needed:
ssh -p 8022 user@android-ip "kill \$(lsof -ti:PORT_NUMBER)"
```

### Error: "Rate limit exceeded"
**Cause:** Too many API requests (100 per minute limit)

**Fix:** Wait 60 seconds and try again. This is a protection against CPU overload.

---

## 💡 Pro Tips

1. **Monitor CPU in dashboard** - If it stays at 100%, wait for it to calm down before deploying more servers

2. **Deploy one server at a time** - Don't try to deploy multiple servers simultaneously

3. **Use stable network** - Avoid deployment during network interruptions

4. **Check device temperature** - If phone is hot, let it cool down first

5. **Review server logs** - They'll tell you exactly what went wrong

---

## 📊 Deployment Status Meanings

You'll see these statuses in the dashboard:

- **Creating** - Server object being created
- **Deploying** - Template is being deployed
- **Running** - Server is up and working ✅
- **Failed** - Deployment failed (check error message)
- **Stopped** - Server was stopped by user

---

## ✅ Success Checklist

Before deploying, make sure:
- [ ] SSH keys configured (no password prompts)
- [ ] Dashboard running and accessible
- [ ] Android device has enough resources
- [ ] Network connection is stable
- [ ] Target device has required packages (node/python/etc)

---

## 🆘 Still Having Issues?

If you've tried everything above and it still doesn't work:

1. **Check the full error message** - They're now much more detailed
2. **Review DEPLOYMENT_FIXES.md** - Has detailed technical info
3. **Check logs** - Both dashboard and server logs
4. **Verify SSH manually** - Make sure you can SSH without the dashboard
5. **Check device isn't out of resources** - Memory, disk, CPU

---

## 🎉 Expected Behavior (After Fixes)

When deployment works correctly:

1. Click "Deploy" in dashboard
2. See status: "Creating..." → "Deploying..." → "Verifying..."
3. Progress updates via WebSocket (no page refresh needed)
4. After 1-3 minutes (depending on template):
   - Status changes to "Running" ✅
   - You can access the server
   - Logs are available in dashboard

**No password prompts!**
**No confusing errors!**
**Clear feedback on what's happening!**

---

That's it! The deployment system should now work much better. Enjoy your servers! 🚀
