// ============================================================
// account.js - Local-first account and chip system
// Works on static hosting like Vercel, with Firebase as optional sync.
// ============================================================

const Account = {
    username: null,
    uid: null,
    chips: 0,
    lastDailyReward: 0,
    isAdmin: false,
    DAILY_AMOUNT: 500,
    DEFAULT_START_CHIPS: 1000,
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin123',
    mode: 'local',
    syncStarted: false,
    syncRetries: 0,
    MAX_SYNC_RETRIES: 6,

    async init() {
        this.loadLocalSession();
        this.detectMode();
        if (this.uid) {
            this.startSync();
        }
        this.notifyUpdate();
    },

    detectMode() {
        this.mode = window.db ? 'firebase' : 'local';
        document.documentElement.dataset.accountMode = this.mode;
    },

    loadLocalSession() {
        this.username = localStorage.getItem('coca_username');
        this.uid = localStorage.getItem('coca_uid');
        const storedChips = localStorage.getItem('coca_chips');
        this.chips = storedChips === null ? this.DEFAULT_START_CHIPS : Number(storedChips);
        if (Number.isNaN(this.chips)) {
            this.chips = this.DEFAULT_START_CHIPS;
        }
        this.lastDailyReward = Number(localStorage.getItem('coca_lastDaily')) || 0;
        this.isAdmin = this.username === this.ADMIN_USERNAME;
    },

    saveLocalSession() {
        if (this.username) localStorage.setItem('coca_username', this.username);
        else localStorage.removeItem('coca_username');

        if (this.uid) localStorage.setItem('coca_uid', this.uid);
        else localStorage.removeItem('coca_uid');

        localStorage.setItem('coca_chips', String(this.chips));
        localStorage.setItem('coca_lastDaily', String(this.lastDailyReward));
    },

    loadLocalUsers() {
        try {
            return JSON.parse(localStorage.getItem('coca_users') || '{}');
        } catch {
            return {};
        }
    },

    saveLocalUsers(users) {
        localStorage.setItem('coca_users', JSON.stringify(users));
    },

    cacheUserRecord(user) {
        if (!user || !user.uid) return;
        const users = this.loadLocalUsers();
        users[user.uid] = {
            ...users[user.uid],
            ...user,
        };
        this.saveLocalUsers(users);
    },

    normalizeRemoteUser(uid, userData = {}) {
        const normalizedChips = userData.chips === undefined || userData.chips === null
            ? this.DEFAULT_START_CHIPS
            : Number(userData.chips);
        return {
            uid,
            username: userData.username || uid,
            password: userData.password,
            chips: Number.isNaN(normalizedChips) ? this.DEFAULT_START_CHIPS : normalizedChips,
            lastDaily: Number(userData.lastDaily) || 0,
            role: userData.role || 'user',
            createdAt: userData.createdAt || Date.now(),
        };
    },

    async syncUserToCloud(user) {
        if (!window.db || !user?.uid) return false;
        const normalized = this.normalizeRemoteUser(user.uid, user);
        const payload = Object.fromEntries(
            Object.entries(normalized).filter(([, value]) => value !== undefined)
        );
        try {
            await db.ref('users/' + payload.uid).update(payload);
            await db.ref('usernames/' + payload.username.toLowerCase()).set(payload.uid);
            this.cacheUserRecord(payload);
            this.mode = 'firebase';
            return true;
        } catch {
            this.mode = 'local';
            return false;
        }
    },

    resolveUserKey(targetValue) {
        const users = this.loadLocalUsers();
        const raw = String(targetValue || '').trim();
        if (!raw) {
            return { users, key: null, user: null };
        }

        if (users[raw]) {
            return { users, key: raw, user: users[raw] };
        }

        const normalized = raw.toLowerCase();
        const match = Object.entries(users).find(([key, user]) => {
            return key.toLowerCase() === normalized ||
                String(user.uid || '').toLowerCase() === normalized ||
                String(user.username || '').toLowerCase() === normalized;
        });

        if (!match) {
            return { users, key: null, user: null };
        }

        return { users, key: match[0], user: match[1] };
    },

    async resolveUserRecord(targetValue) {
        const localResult = this.resolveUserKey(targetValue);
        if (localResult.key && localResult.user) {
            return localResult;
        }

        const raw = String(targetValue || '').trim();
        if (!raw || !window.db) {
            return localResult;
        }

        try {
            const directSnap = await db.ref('users/' + raw).get();
            if (directSnap.exists()) {
                const users = localResult.users;
                const user = directSnap.val();
                users[raw] = user;
                this.saveLocalUsers(users);
                return { users, key: raw, user };
            }

            const normalized = raw.toLowerCase();
            const nameSnap = await db.ref('usernames/' + normalized).get();
            if (nameSnap.exists()) {
                const key = nameSnap.val();
                const userSnap = await db.ref('users/' + key).get();
                if (userSnap.exists()) {
                    const users = localResult.users;
                    const user = userSnap.val();
                    users[key] = user;
                    this.saveLocalUsers(users);
                    return { users, key, user };
                }
            }
        } catch {
            // Fall back to local-only result.
        }

        return localResult;
    },

    createLocalUser(name, password) {
        return {
            username: name,
            password,
            chips: this.DEFAULT_START_CHIPS,
            lastDaily: 0,
            role: name.toLowerCase() === this.ADMIN_USERNAME ? 'admin' : 'user',
            uid: 'U' + Math.random().toString(36).slice(2, 9).toUpperCase(),
            createdAt: Date.now(),
        };
    },

    startSync() {
        if (!this.uid || this.syncStarted) return;

        if (!window.db) {
            if (this.syncRetries < this.MAX_SYNC_RETRIES) {
                this.syncRetries += 1;
                setTimeout(() => this.startSync(), 600);
            } else {
                this.mode = 'local';
                this.notifyUpdate();
            }
            return;
        }

        this.mode = 'firebase';
        this.syncStarted = true;
        const userRef = db.ref('users/' + this.uid);

        userRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            const normalizedUser = this.normalizeRemoteUser(this.uid, {
                ...data,
                username: data.username || this.username || this.uid,
            });
            this.username = normalizedUser.username;
            this.chips = normalizedUser.chips;
            this.lastDailyReward = normalizedUser.lastDaily;
            this.isAdmin = normalizedUser.role === 'admin' || this.username === this.ADMIN_USERNAME;
            this.cacheUserRecord(normalizedUser);
            this.saveLocalSession();
            this.notifyUpdate();
        }, () => {
            this.mode = 'local';
            this.syncStarted = false;
            this.notifyUpdate();
        });
    },

    stopSync() {
        if (this.uid && window.db) {
            db.ref('users/' + this.uid).off();
        }
        this.syncStarted = false;
    },

    notifyUpdate() {
        window.dispatchEvent(new CustomEvent('accountUpdated', {
            detail: {
                chips: this.chips,
                username: this.username,
                uid: this.uid,
                mode: this.mode,
            }
        }));

        const chipDisplays = document.querySelectorAll('#chips-display, #display-chips, #bl-chips, #pk-chips, #mb-chips, #rl-chips, #account-chips-val');
        chipDisplays.forEach((el) => {
            el.textContent = this.chips.toLocaleString();
        });
    },

    async register(name, password) {
        if (!name || !name.trim() || !password || !password.trim()) {
            return { success: false, msg: 'Vui long nhap day du thong tin!' };
        }

        const cleanName = name.trim();
        const normalized = cleanName.toLowerCase();

        const localUsers = this.loadLocalUsers();
        if (Object.values(localUsers).some((user) => user.username.toLowerCase() === normalized)) {
            return { success: false, msg: 'Ten dang nhap da ton tai!' };
        }

        const userData = this.createLocalUser(cleanName, password);
        localUsers[userData.uid] = userData;
        this.saveLocalUsers(localUsers);

        await this.syncUserToCloud(userData);

        return { success: true, uid: userData.uid };
    },

    async login(name, password) {
        if (!name || !name.trim()) {
            return { success: false, msg: 'Vui long nhap ten dang nhap!' };
        }

        const cleanName = name.trim();
        const normalized = cleanName.toLowerCase();
        let userData = null;
        let foundUID = null;

        if (window.db) {
            try {
                const nameSnap = await db.ref('usernames/' + normalized).get();
                if (nameSnap.exists()) {
                    foundUID = nameSnap.val();
                    const userSnap = await db.ref('users/' + foundUID).get();
                    userData = userSnap.val();
                    this.mode = 'firebase';
                }
            } catch {
                this.mode = 'local';
            }
        }

        if (!userData) {
            const localUsers = this.loadLocalUsers();
            const localEntry = Object.values(localUsers).find(
                (user) => user.username.toLowerCase() === normalized
            );
            if (!localEntry) {
                return { success: false, msg: 'Tai khoan khong ton tai!' };
            }
            userData = localEntry;
            foundUID = localEntry.uid;
            this.mode = 'local';
        }

        if (userData.password !== password) {
            return { success: false, msg: 'Sai mat khau!' };
        }

        this.stopSync();
        this.username = userData.username;
        this.uid = foundUID;
        this.chips = userData.chips === undefined || userData.chips === null
            ? this.DEFAULT_START_CHIPS
            : Number(userData.chips);
        if (Number.isNaN(this.chips)) {
            this.chips = this.DEFAULT_START_CHIPS;
        }
        this.lastDailyReward = Number(userData.lastDaily) || 0;
        this.isAdmin = userData.role === 'admin' || this.username === this.ADMIN_USERNAME;

        this.saveLocalSession();
        this.cacheUserRecord({
            uid: this.uid,
            username: this.username,
            password: userData.password,
            chips: this.chips,
            lastDaily: this.lastDailyReward,
            role: userData.role || (this.isAdmin ? 'admin' : 'user'),
            createdAt: userData.createdAt,
        });

        if (window.db) {
            await this.syncUserToCloud({
                uid: this.uid,
                username: this.username,
                password: userData.password,
                chips: this.chips,
                lastDaily: this.lastDailyReward,
                role: userData.role || (this.isAdmin ? 'admin' : 'user'),
                createdAt: userData.createdAt,
            });
        }

        this.startSync();
        this.notifyUpdate();

        return { success: true };
    },

    logout() {
        this.stopSync();
        this.username = null;
        this.uid = null;
        this.chips = this.DEFAULT_START_CHIPS;
        this.isAdmin = false;
        this.lastDailyReward = 0;
        this.saveLocalSession();
        this.notifyUpdate();
    },

    async persistLocalState() {
        if (!this.uid) return;
        const users = this.loadLocalUsers();
        const existing = users[this.uid] || {};
        users[this.uid] = {
            ...existing,
            uid: this.uid,
            username: this.username || existing.username || this.uid,
            password: existing.password,
            role: existing.role || (this.isAdmin ? 'admin' : 'user'),
            chips: this.chips,
            lastDaily: this.lastDailyReward,
            createdAt: existing.createdAt || Date.now(),
        };
        this.saveLocalUsers(users);
        this.saveLocalSession();
    },

    async addChips(amount) {
        const value = parseInt(amount, 10);
        if (!this.uid || Number.isNaN(value) || value <= 0) return false;

        this.chips += value;
        await this.persistLocalState();

        if (window.db) {
            await this.syncUserToCloud({
                uid: this.uid,
                username: this.username,
                chips: this.chips,
                lastDaily: this.lastDailyReward,
                role: this.isAdmin ? 'admin' : 'user',
            });
        }

        this.notifyUpdate();
        return true;
    },

    async deductChips(amount) {
        const value = parseInt(amount, 10);
        if (!this.uid || Number.isNaN(value) || value <= 0) return false;
        if (this.chips < value) return false;

        this.chips -= value;
        await this.persistLocalState();

        if (window.db) {
            await this.syncUserToCloud({
                uid: this.uid,
                username: this.username,
                chips: this.chips,
                lastDaily: this.lastDailyReward,
                role: this.isAdmin ? 'admin' : 'user',
            });
        }

        this.notifyUpdate();
        return true;
    },

    canClaimDaily() {
        if (!this.username) return false;
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return this.lastDailyReward < midnight;
    },

    async claimDaily() {
        if (!this.uid || !this.canClaimDaily()) return false;
        this.lastDailyReward = Date.now();
        await this.addChips(this.DAILY_AMOUNT);
        await this.persistLocalState();

        if (window.db) {
            await this.syncUserToCloud({
                uid: this.uid,
                username: this.username,
                chips: this.chips,
                lastDaily: this.lastDailyReward,
                role: this.isAdmin ? 'admin' : 'user',
            });
        }

        this.notifyUpdate();
        return true;
    },

    async adminAddChips(targetUID, amount) {
        if (!this.isAdmin) return { success: false, msg: 'Ban khong co quyen admin!' };
        const value = parseInt(amount, 10);
        if (Number.isNaN(value) || value <= 0) return { success: false, msg: 'So chip khong hop le!' };

        const { users, key, user } = await this.resolveUserRecord(targetUID);
        if (!key || !user) return { success: false, msg: 'Khong tim thay user voi UID/ten: ' + targetUID };

        const isCurrentUser = String(key).toLowerCase() === String(this.uid || '').toLowerCase() ||
            String(user.uid || '').toLowerCase() === String(this.uid || '').toLowerCase() ||
            String(user.username || '').toLowerCase() === String(this.username || '').toLowerCase();

        users[key].uid = users[key].uid || key;
        users[key].username = users[key].username || targetUID || key;
        const baseChips = isCurrentUser ? this.chips : Number(users[key].chips || 0);
        users[key].chips = baseChips + value;
        this.saveLocalUsers(users);

        if (window.db && this.mode === 'firebase') {
            try {
                await db.ref('users/' + key).update({
                    chips: users[key].chips,
                    uid: users[key].uid,
                    username: users[key].username
                });
            } catch {
                this.mode = 'local';
            }
        }

        if (isCurrentUser) {
            this.uid = users[key].uid || key;
            this.username = users[key].username || this.username;
            this.chips = users[key].chips;
            this.saveLocalSession();
            await this.persistLocalState();
            this.notifyUpdate();
        }

        return { success: true, msg: `Da nap ${value.toLocaleString()} cho ${users[key].username} (${users[key].uid}). So du moi: ${users[key].chips.toLocaleString()}` };
    },

    async adminDeductChips(targetUID, amount) {
        if (!this.isAdmin) return { success: false, msg: 'Ban khong co quyen admin!' };
        const value = parseInt(amount, 10);
        if (Number.isNaN(value) || value <= 0) return { success: false, msg: 'So chip khong hop le!' };

        const { users, key, user } = await this.resolveUserRecord(targetUID);
        if (!key || !user) return { success: false, msg: 'Khong tim thay user voi UID/ten: ' + targetUID };

        const isCurrentUser = String(key).toLowerCase() === String(this.uid || '').toLowerCase() ||
            String(user.uid || '').toLowerCase() === String(this.uid || '').toLowerCase() ||
            String(user.username || '').toLowerCase() === String(this.username || '').toLowerCase();

        users[key].uid = users[key].uid || key;
        users[key].username = users[key].username || targetUID || key;
        const baseChips = isCurrentUser ? this.chips : Number(users[key].chips || 0);
        users[key].chips = Math.max(0, baseChips - value);
        this.saveLocalUsers(users);

        if (window.db && this.mode === 'firebase') {
            try {
                await db.ref('users/' + key).update({
                    chips: users[key].chips,
                    uid: users[key].uid,
                    username: users[key].username
                });
            } catch {
                this.mode = 'local';
            }
        }

        if (isCurrentUser) {
            this.uid = users[key].uid || key;
            this.username = users[key].username || this.username;
            this.chips = users[key].chips;
            this.saveLocalSession();
            await this.persistLocalState();
            this.notifyUpdate();
        }

        return { success: true, msg: `Da tru ${value.toLocaleString()} tu ${users[key].username} (${users[key].uid}). So du moi: ${users[key].chips.toLocaleString()}` };
    },

    async adminGetAllUsers() {
        if (!this.isAdmin) return [];
        const users = this.loadLocalUsers();
        return Object.values(users).map((user) => ({
            username: user.username,
            uid: user.uid || 'N/A',
            chips: Number(user.chips || 0),
            role: user.role || 'user',
        }));
    }
};

Account.init();
