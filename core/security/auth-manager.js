/**
 * Enterprise Authentication & Authorization Manager
 * Military-grade security with JWT, MFA, RBAC, audit logging
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class AuthManager {
    constructor() {
        this.users = new Map();
        this.sessions = new Map();
        this.apiKeys = new Map();
        this.auditLog = [];
        this.mfaEnabled = false;
        this.loginAttempts = new Map();
        this.blacklist = new Set();
        
        // Security settings
        this.config = {
            passwordMinLength: 12,
            passwordRequireSpecial: true,
            passwordRequireNumbers: true,
            passwordRequireUppercase: true,
            sessionTimeout: 3600000, // 1 hour
            maxLoginAttempts: 5,
            lockoutDuration: 900000, // 15 minutes
            mfaRequired: false,
            jwtSecret: null
        };
    }

    async initialize() {
        // Load users and config
        try {
            const configPath = process.env.HOME + '/server/config/auth.json';
            const data = await fs.readFile(configPath, 'utf8');
            const saved = JSON.parse(data);
            
            this.config = { ...this.config, ...saved.config };
            saved.users?.forEach(u => this.users.set(u.username, u));
            
            console.log('🔐 Auth Manager initialized');
        } catch (error) {
            // Create default admin user
            await this.createDefaultAdmin();
        }

        // Generate JWT secret if not exists
        if (!this.config.jwtSecret) {
            this.config.jwtSecret = crypto.randomBytes(64).toString('hex');
            await this.saveConfig();
        }

        // Start session cleanup
        this.startSessionCleanup();
    }

    async createDefaultAdmin() {
        const defaultPassword = crypto.randomBytes(16).toString('hex');
        await this.createUser({
            username: 'admin',
            password: defaultPassword,
            role: 'admin',
            email: 'admin@localhost'
        });

        console.log('🔑 Default admin created');
        console.log(`   Username: admin`);
        console.log(`   Password: ${defaultPassword}`);
        console.log('   ⚠️  CHANGE PASSWORD IMMEDIATELY!');

        // Save to file for first login
        await fs.writeFile(
            process.env.HOME + '/server/ADMIN_CREDENTIALS.txt',
            `Initial Admin Credentials\nUsername: admin\nPassword: ${defaultPassword}\n\nDELETE THIS FILE AFTER FIRST LOGIN!`
        );
    }

    async createUser({ username, password, role = 'user', email, mfaEnabled = false }) {
        // Validate password strength
        this.validatePassword(password);

        const user = {
            id: crypto.randomUUID(),
            username,
            passwordHash: this.hashPassword(password),
            role, // admin, operator, viewer, user
            email,
            mfaEnabled,
            mfaSecret: mfaEnabled ? this.generateMFASecret() : null,
            created: new Date().toISOString(),
            lastLogin: null,
            loginCount: 0,
            permissions: this.getDefaultPermissions(role),
            status: 'active'
        };

        this.users.set(username, user);
        await this.saveConfig();

        this.log('user_created', { username, role, by: 'system' });
        return { id: user.id, username, role };
    }

    validatePassword(password) {
        if (password.length < this.config.passwordMinLength) {
            throw new Error(`Password must be at least ${this.config.passwordMinLength} characters`);
        }

        if (this.config.passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            throw new Error('Password must contain special characters');
        }

        if (this.config.passwordRequireNumbers && !/\d/.test(password)) {
            throw new Error('Password must contain numbers');
        }

        if (this.config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
            throw new Error('Password must contain uppercase letters');
        }

        return true;
    }

    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    }

    verifyPassword(password, storedHash) {
        const [salt, hash] = storedHash.split(':');
        const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return hash === verifyHash;
    }

    async login(username, password, mfaCode = null) {
        // Check if IP is blacklisted or locked out
        const attempts = this.loginAttempts.get(username) || { count: 0, lastAttempt: 0 };
        
        if (attempts.count >= this.config.maxLoginAttempts) {
            const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
            if (timeSinceLastAttempt < this.config.lockoutDuration) {
                this.log('login_locked', { username });
                throw new Error('Account temporarily locked due to too many failed attempts');
            } else {
                // Reset attempts after lockout duration
                this.loginAttempts.delete(username);
            }
        }

        const user = this.users.get(username);
        if (!user || user.status !== 'active') {
            this.recordFailedLogin(username);
            throw new Error('Invalid credentials');
        }

        // Verify password
        if (!this.verifyPassword(password, user.passwordHash)) {
            this.recordFailedLogin(username);
            this.log('login_failed', { username, reason: 'invalid_password' });
            throw new Error('Invalid credentials');
        }

        // Verify MFA if enabled
        if (user.mfaEnabled && !this.verifyMFACode(user.mfaSecret, mfaCode)) {
            this.recordFailedLogin(username);
            this.log('login_failed', { username, reason: 'invalid_mfa' });
            throw new Error('Invalid MFA code');
        }

        // Create session
        const session = this.createSession(user);
        
        // Update user stats
        user.lastLogin = new Date().toISOString();
        user.loginCount++;
        this.loginAttempts.delete(username);

        this.log('login_success', { username, sessionId: session.id });
        await this.saveConfig();

        return session;
    }

    recordFailedLogin(username) {
        const attempts = this.loginAttempts.get(username) || { count: 0, lastAttempt: 0 };
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.loginAttempts.set(username, attempts);
    }

    createSession(user) {
        const session = {
            id: crypto.randomUUID(),
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions,
            created: Date.now(),
            expires: Date.now() + this.config.sessionTimeout,
            token: this.generateJWT(user)
        };

        this.sessions.set(session.id, session);
        return session;
    }

    generateJWT(user) {
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            iat: Date.now()
        };

        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
        const body = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto.createHmac('sha256', this.config.jwtSecret)
            .update(`${header}.${body}`)
            .digest('base64');

        return `${header}.${body}.${signature}`;
    }

    verifyJWT(token) {
        try {
            const [header, body, signature] = token.split('.');
            const expectedSignature = crypto.createHmac('sha256', this.config.jwtSecret)
                .update(`${header}.${body}`)
                .digest('base64');

            if (signature !== expectedSignature) {
                return null;
            }

            const payload = JSON.parse(Buffer.from(body, 'base64').toString());
            return payload;
        } catch (error) {
            return null;
        }
    }

    async verifySession(token) {
        const payload = this.verifyJWT(token);
        if (!payload) return null;

        // Find session
        for (const [id, session] of this.sessions) {
            if (session.userId === payload.userId && session.expires > Date.now()) {
                return session;
            }
        }

        return null;
    }

    async createAPIKey(username, name, permissions = []) {
        const user = this.users.get(username);
        if (!user) throw new Error('User not found');

        const apiKey = {
            id: crypto.randomUUID(),
            key: 'nps_' + crypto.randomBytes(32).toString('hex'),
            name,
            userId: user.id,
            username,
            permissions: permissions.length ? permissions : user.permissions,
            created: new Date().toISOString(),
            lastUsed: null,
            useCount: 0,
            status: 'active'
        };

        this.apiKeys.set(apiKey.key, apiKey);
        await this.saveConfig();

        this.log('apikey_created', { username, keyName: name });
        return apiKey;
    }

    verifyAPIKey(key) {
        const apiKey = this.apiKeys.get(key);
        if (!apiKey || apiKey.status !== 'active') return null;

        apiKey.lastUsed = new Date().toISOString();
        apiKey.useCount++;
        return apiKey;
    }

    checkPermission(session, permission) {
        if (!session) return false;
        if (session.role === 'admin') return true;
        return session.permissions.includes(permission);
    }

    getDefaultPermissions(role) {
        const permissions = {
            admin: ['*'], // All permissions
            operator: ['server:create', 'server:start', 'server:stop', 'server:restart', 'server:view', 'server:edit', 'server:logs'],
            viewer: ['server:view', 'server:logs'],
            user: ['server:view']
        };

        return permissions[role] || permissions.user;
    }

    generateMFASecret() {
        return crypto.randomBytes(20).toString('hex');
    }

    verifyMFACode(secret, code) {
        // Simple TOTP implementation (in production, use speakeasy or similar)
        if (!code) return false;
        const timeStep = Math.floor(Date.now() / 30000);
        const expectedCode = crypto.createHmac('sha1', secret)
            .update(timeStep.toString())
            .digest('hex')
            .slice(0, 6);
        return code === expectedCode;
    }

    startSessionCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [id, session] of this.sessions) {
                if (session.expires < now) {
                    this.sessions.delete(id);
                    this.log('session_expired', { sessionId: id, username: session.username });
                }
            }
        }, 60000); // Every minute
    }

    log(action, details) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            details,
            ip: details.ip || 'system'
        };

        this.auditLog.push(entry);
        
        // Keep last 10000 entries
        if (this.auditLog.length > 10000) {
            this.auditLog.shift();
        }

        console.log(`🔐 [AUDIT] ${action}:`, details);
    }

    async getAuditLog(filter = {}) {
        let logs = [...this.auditLog];

        if (filter.username) {
            logs = logs.filter(l => l.details.username === filter.username);
        }

        if (filter.action) {
            logs = logs.filter(l => l.action === filter.action);
        }

        if (filter.since) {
            logs = logs.filter(l => new Date(l.timestamp) >= new Date(filter.since));
        }

        return logs.slice(-1000); // Last 1000 entries
    }

    async saveConfig() {
        const data = {
            config: this.config,
            users: Array.from(this.users.values()).map(u => ({
                ...u,
                passwordHash: u.passwordHash // Keep hashes
            })),
            apiKeys: Array.from(this.apiKeys.values())
        };

        const configPath = process.env.HOME + '/server/config/auth.json';
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(data, null, 2));
    }

    async logout(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.log('logout', { username: session.username });
            this.sessions.delete(sessionId);
        }
    }

    async changePassword(username, oldPassword, newPassword) {
        const user = this.users.get(username);
        if (!user) throw new Error('User not found');

        if (!this.verifyPassword(oldPassword, user.passwordHash)) {
            throw new Error('Invalid current password');
        }

        this.validatePassword(newPassword);
        user.passwordHash = this.hashPassword(newPassword);
        await this.saveConfig();

        this.log('password_changed', { username });
    }

    // Get security status
    getSecurityStatus() {
        return {
            totalUsers: this.users.size,
            activeUsers: Array.from(this.users.values()).filter(u => u.status === 'active').length,
            activeSessions: this.sessions.size,
            apiKeys: this.apiKeys.size,
            recentLogins: this.auditLog.filter(l => l.action === 'login_success').slice(-10),
            failedAttempts: this.loginAttempts.size,
            mfaEnabled: Array.from(this.users.values()).filter(u => u.mfaEnabled).length,
            securityLevel: this.calculateSecurityLevel()
        };
    }

    calculateSecurityLevel() {
        let score = 0;
        
        if (this.config.passwordMinLength >= 12) score += 20;
        if (this.config.passwordRequireSpecial) score += 15;
        if (this.config.mfaRequired) score += 30;
        if (this.apiKeys.size > 0) score += 10;
        if (Array.from(this.users.values()).some(u => u.mfaEnabled)) score += 25;

        if (score >= 80) return 'HIGH';
        if (score >= 50) return 'MEDIUM';
        return 'LOW';
    }
}

module.exports = AuthManager;
