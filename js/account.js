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
        this.chips = Number(localStorage.getItem('coca_chips')) || this.DEFAULT_START_CHIPS;
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
            this.chips = Number(data.chips) || 0;
            this.lastDailyReward = Number(data.lastDaily) || 0;
            this.isAdmin = data.role === 'admin' || this.username === this.ADMIN_USERNAME;
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

        if (window.db) {
            try {
                await db.ref('users/' + userData.uid).set(userData);
                await db.ref('usernames/' + normalized).set(userData.uid);
                this.mode = 'firebase';
            } catch {
                this.mode = 'local';
            }
        }

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
        this.chips = Number(userData.chips) || this.DEFAULT_START_CHIPS;
        this.lastDailyReward = Number(userData.lastDaily) || 0;
        this.isAdmin = userData.role === 'admin' || this.username === this.ADMIN_USERNAME;

        this.saveLocalSession();
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
        const existing = users[this.uid];
        if (existing) {
            existing.chips = this.chips;
            existing.lastDaily = this.lastDailyReward;
            users[this.uid] = existing;
            this.saveLocalUsers(users);
        }
        this.saveLocalSession();
    },

    async addChips(amount) {
        const value = parseInt(amount, 10);
        if (!this.uid || Number.isNaN(value) || value <= 0) return false;

        this.chips += value;
        await this.persistLocalState();

        if (window.db && this.mode === 'firebase') {
            try {
                await db.ref('users/' + this.uid + '/chips').set(this.chips);
            } catch {
                this.mode = 'local';
            }
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

        if (window.db && this.mode === 'firebase') {
            try {
                await db.ref('users/' + this.uid + '/chips').set(this.chips);
            } catch {
                this.mode = 'local';
            }
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

        if (window.db && this.mode === 'firebase') {
            try {
                await db.ref('users/' + this.uid + '/lastDaily').set(this.lastDailyReward);
            } catch {
                this.mode = 'local';
            }
        }

        this.notifyUpdate();
        return true;
    },

    async adminAddChips(targetUID, amount) {
        if (!this.isAdmin) return { success: false, msg: 'Ban khong co quyen admin!' };
        const value = parseInt(amount, 10);
        if (Number.isNaN(value) || value <= 0) return { success: false, msg: 'So chip khong hop le!' };

        const users = this.loadLocalUsers();
        if (!users[targetUID]) return { success: false, msg: 'Khong tim thay user voi UID: ' + targetUID };

        users[targetUID].chips = Number(users[targetUID].chips || 0) + value;
        this.saveLocalUsers(users);

        if (window.db && this.mode === 'firebase') {
            try {
                await db.ref('users/' + targetUID + '/chips').set(users[targetUID].chips);
            } catch {
                this.mode = 'local';
            }
        }

        if (targetUID === this.uid) {
            this.chips = users[targetUID].chips;
            this.notifyUpdate();
        }

        return { success: true, msg: `Da nap ${value.toLocaleString()} cho ${targetUID}. So du moi: ${users[targetUID].chips.toLocaleString()}` };
    },

    async adminDeductChips(targetUID, amount) {
        if (!this.isAdmin) return { success: false, msg: 'Ban khong co quyen admin!' };
        const value = parseInt(amount, 10);
        if (Number.isNaN(value) || value <= 0) return { success: false, msg: 'So chip khong hop le!' };

        const users = this.loadLocalUsers();
        if (!users[targetUID]) return { success: false, msg: 'Khong tim thay user voi UID: ' + targetUID };

        users[targetUID].chips = Math.max(0, Number(users[targetUID].chips || 0) - value);
        this.saveLocalUsers(users);

        if (window.db && this.mode === 'firebase') {
            try {
                await db.ref('users/' + targetUID + '/chips').set(users[targetUID].chips);
            } catch {
                this.mode = 'local';
            }
        }

        if (targetUID === this.uid) {
            this.chips = users[targetUID].chips;
            this.notifyUpdate();
        }

        return { success: true, msg: `Da tru ${value.toLocaleString()} tu ${targetUID}. So du moi: ${users[targetUID].chips.toLocaleString()}` };
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
