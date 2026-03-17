// ============================================================
// account.js - Global User Account & Currency System (with UID & Admin)
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

    init() {
        this._ensureAdminExists();
        this.loadData();
    },

    _generateUID() {
        // 8-character alphanumeric UID
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let uid = '';
        for (let i = 0; i < 8; i++) uid += chars.charAt(Math.floor(Math.random() * chars.length));
        // Ensure uniqueness
        const users = this.getUsers();
        const existingUIDs = Object.values(users).map(u => u.uid);
        if (existingUIDs.includes(uid)) return this._generateUID();
        return uid;
    },

    _ensureAdminExists() {
        const users = this.getUsers();
        if (!users[this.ADMIN_USERNAME]) {
            users[this.ADMIN_USERNAME] = {
                password: this.ADMIN_PASSWORD,
                chips: 999999,
                lastDaily: 0,
                uid: 'ADMIN001',
                role: 'admin'
            };
            this.saveUsers(users);
        }
        // Migrate: ensure all existing users have a uid
        let changed = false;
        for (const name in users) {
            if (!users[name].uid) {
                users[name].uid = this._generateUID();
                changed = true;
            }
        }
        if (changed) this.saveUsers(users);
    },

    getUsers() {
        try {
            return JSON.parse(localStorage.getItem('coca_users')) || {};
        } catch(e) {
            return {};
        }
    },

    saveUsers(usersObj) {
        localStorage.setItem('coca_users', JSON.stringify(usersObj));
    },

    loadData() {
        const currentUser = localStorage.getItem('coca_currentUser');
        if (currentUser) {
            const users = this.getUsers();
            if (users[currentUser]) {
                this.username = currentUser;
                this.uid = users[currentUser].uid || null;
                this.chips = Number(users[currentUser].chips) || 0;
                this.lastDailyReward = Number(users[currentUser].lastDaily) || 0;
                this.isAdmin = users[currentUser].role === 'admin';
            } else {
                this.logout();
            }
        }
    },

    saveData() {
        if (!this.username) return;
        const users = this.getUsers();
        if (users[this.username]) {
            users[this.username].chips = Number(this.chips);
            users[this.username].lastDaily = Number(this.lastDailyReward);
            this.saveUsers(users);
        }
        
        window.dispatchEvent(new CustomEvent('accountUpdated', { 
            detail: { chips: this.chips, username: this.username, uid: this.uid } 
        }));
    },

    register(name, password) {
        if (!name || name.trim() === '' || !password || password.trim() === '') {
            return { success: false, msg: "Vui lòng nhập đầy đủ thông tin!" };
        }
        const cleanName = name.trim();
        if (cleanName.toLowerCase() === this.ADMIN_USERNAME) {
            return { success: false, msg: "Tên đăng nhập không hợp lệ!" };
        }
        const users = this.getUsers();
        
        if (users[cleanName]) {
            return { success: false, msg: "Tên đăng nhập đã tồn tại!" };
        }
        
        const newUID = this._generateUID();
        users[cleanName] = {
            password: password,
            chips: this.DEFAULT_START_CHIPS,
            lastDaily: 0,
            uid: newUID,
            role: 'user'
        };
        this.saveUsers(users);
        return { success: true, uid: newUID };
    },

    login(name, password) {
        if (!name || name.trim() === '') return { success: false, msg: "Vui lòng nhập tên đăng nhập!" };
        const cleanName = name.trim();
        const users = this.getUsers();
        
        if (!users[cleanName]) {
            return { success: false, msg: "Tài khoản không tồn tại!" };
        }

        if (users[cleanName].password !== password) {
            return { success: false, msg: "Sai mật khẩu!" };
        }
        
        this.username = cleanName;
        this.uid = users[cleanName].uid;
        this.chips = Number(users[cleanName].chips);
        this.lastDailyReward = Number(users[cleanName].lastDaily) || 0;
        this.isAdmin = users[cleanName].role === 'admin';
        
        localStorage.setItem('coca_currentUser', this.username);
        
        window.dispatchEvent(new CustomEvent('accountUpdated', { 
            detail: { chips: this.chips, username: this.username, uid: this.uid } 
        }));
        return { success: true };
    },

    logout() {
        this.username = null;
        this.uid = null;
        this.chips = 0;
        this.isAdmin = false;
        localStorage.removeItem('coca_currentUser');
        window.dispatchEvent(new Event('accountUpdated'));
    },

    addChips(amount) {
        this.loadData();
        this.chips += parseInt(amount);
        this.saveData();
    },

    deductChips(amount) {
        this.loadData();
        if (this.chips >= amount) {
            this.chips -= parseInt(amount);
            this.saveData();
            return true;
        }
        return false;
    },

    canClaimDaily() {
        if (!this.username) return false;
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return this.lastDailyReward < midnight;
    },

    claimDaily() {
        if (this.canClaimDaily()) {
            this.addChips(this.DAILY_AMOUNT);
            this.lastDailyReward = Date.now();
            this.saveData();
            return true;
        }
        return false;
    },

    // ---- Admin Functions ----
    adminAddChips(targetUID, amount) {
        if (!this.isAdmin) return { success: false, msg: "Bạn không có quyền admin!" };
        amount = parseInt(amount);
        if (isNaN(amount) || amount <= 0) return { success: false, msg: "Số chip không hợp lệ!" };

        const users = this.getUsers();
        for (const name in users) {
            if (users[name].uid === targetUID) {
                users[name].chips = Number(users[name].chips) + amount;
                this.saveUsers(users);
                // If the target is self, also update in-memory
                if (name === this.username) {
                    this.chips = users[name].chips;
                    this.saveData();
                }
                return { success: true, msg: `Đã nạp ${amount.toLocaleString()} chip cho ${name} (${targetUID}). Số dư mới: ${users[name].chips.toLocaleString()}` };
            }
        }
        return { success: false, msg: `Không tìm thấy user với UID: ${targetUID}` };
    },

    adminGetAllUsers() {
        if (!this.isAdmin) return [];
        const users = this.getUsers();
        return Object.entries(users).map(([name, data]) => ({
            username: name,
            uid: data.uid || 'N/A',
            chips: Number(data.chips),
            role: data.role || 'user'
        }));
    }
};

// Auto-initialize when file loads
Account.init();

// Cross-tab synchronization
window.addEventListener('storage', (e) => {
    if (e.key === 'coca_users' || e.key === 'coca_currentUser') {
        const oldChips = Account.chips;
        Account.loadData();
        if (Account.chips !== oldChips) {
            window.dispatchEvent(new CustomEvent('accountUpdated', { 
                detail: { chips: Account.chips, username: Account.username, uid: Account.uid } 
            }));
            
            // Auto update generic chip displays if they exist
            const chipDisplays = document.querySelectorAll('#chips-display, #display-chips, #bl-chips, #pk-chips, #mb-chips, #rl-chips');
            chipDisplays.forEach(el => {
                el.textContent = Account.chips.toLocaleString();
            });
        }
    }
});
