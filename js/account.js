// ============================================================
// account.js - Global User Account & Currency System (Firebase Synced)
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

    async init() {
        this.loadLocalSession();
        if (this.uid) {
            this.startSync();
        }
    },

    loadLocalSession() {
        this.username = localStorage.getItem('coca_username');
        this.uid = localStorage.getItem('coca_uid');
        this.chips = Number(localStorage.getItem('coca_chips')) || 0;
        this.lastDailyReward = Number(localStorage.getItem('coca_lastDaily')) || 0;
        this.isAdmin = this.username === this.ADMIN_USERNAME;
    },

    saveLocalSession() {
        if (this.username) localStorage.setItem('coca_username', this.username);
        else localStorage.removeItem('coca_username');

        if (this.uid) localStorage.setItem('coca_uid', this.uid);
        else localStorage.removeItem('coca_uid');

        localStorage.setItem('coca_chips', this.chips);
        localStorage.setItem('coca_lastDaily', this.lastDailyReward);
    },

    startSync() {
        if (!this.uid || !window.db) {
            // If DB not ready yet, retry in 500ms
            if (!window.db) setTimeout(() => this.startSync(), 500);
            return;
        }

        const userRef = db.ref('users/' + this.uid);
        userRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.chips = Number(data.chips) || 0;
                this.lastDailyReward = Number(data.lastDaily) || 0;
                this.isAdmin = data.role === 'admin' || this.username === this.ADMIN_USERNAME;
                this.saveLocalSession();
                this.notifyUpdate();
            }
        });
    },

    stopSync() {
        if (this.uid && window.db) {
            db.ref('users/' + this.uid).off();
        }
    },

    notifyUpdate() {
        window.dispatchEvent(new CustomEvent('accountUpdated', { 
            detail: { chips: this.chips, username: this.username, uid: this.uid } 
        }));
        
        // Update any generic chip displays
        const chipDisplays = document.querySelectorAll('#chips-display, #display-chips, #bl-chips, #pk-chips, #mb-chips, #rl-chips, #account-chips-val');
        chipDisplays.forEach(el => {
            el.textContent = this.chips.toLocaleString();
        });
    },

    async register(name, password) {
        if (!name || name.trim() === '' || !password || password.trim() === '') {
            return { success: false, msg: "Vui lòng nhập đầy đủ thông tin!" };
        }
        const cleanName = name.trim();
        if (cleanName.toLowerCase() === this.ADMIN_USERNAME) {
            return { success: false, msg: "Tên đăng nhập không hợp lệ!" };
        }

        if (!window.db) return { success: false, msg: "Dịch vụ hiện không khả dụng!" };

        try {
            // Check if username exists
            const nameRef = db.ref('usernames/' + cleanName.toLowerCase());
            const nameSnap = await nameRef.get();
            if (nameSnap.exists()) {
                return { success: false, msg: "Tên đăng nhập đã tồn tại!" };
            }

            // Create new UID
            const newUID = 'U' + Math.random().toString(36).substr(2, 7).toUpperCase();
            
            const userData = {
                username: cleanName,
                password: password,
                chips: this.DEFAULT_START_CHIPS,
                lastDaily: 0,
                role: 'user',
                uid: newUID,
                createdAt: Date.now()
            };

            await db.ref('users/' + newUID).set(userData);
            await nameRef.set(newUID);

            return { success: true, uid: newUID };
        } catch (e) {
            console.error(e);
            return { success: false, msg: "Lỗi đăng ký: " + e.message };
        }
    },

    async login(name, password) {
        if (!name || name.trim() === '') return { success: false, msg: "Vui lòng nhập tên đăng nhập!" };
        const cleanName = name.trim();

        if (!window.db) return { success: false, msg: "Dịch vụ hiện không khả dụng!" };

        try {
            const nameRef = db.ref('usernames/' + cleanName.toLowerCase());
            const nameSnap = await nameRef.get();
            
            let foundUID = null;
            let userData = null;

            if (nameSnap.exists()) {
                foundUID = nameSnap.val();
                const userSnap = await db.ref('users/' + foundUID).get();
                userData = userSnap.val();
            } else {
                // MIGRATION CHECK: If not in Firebase, check local legacy storage
                const legacyUsers = JSON.parse(localStorage.getItem('coca_users') || '{}');
                const legacyUser = legacyUsers[cleanName];
                
                if (legacyUser && legacyUser.password === password) {
                    console.log("Migrating legacy user to Firebase:", cleanName);
                    // Use their existing UID if they have one, or generate a new one
                    const newUID = legacyUser.uid || ('U' + Math.random().toString(36).substr(2, 7).toUpperCase());
                    
                    userData = {
                        username: cleanName,
                        password: password,
                        chips: Number(legacyUser.chips) || this.DEFAULT_START_CHIPS,
                        lastDaily: Number(legacyUser.lastDaily) || 0,
                        role: legacyUser.role || 'user',
                        uid: newUID,
                        createdAt: Date.now()
                    };

                    await db.ref('users/' + newUID).set(userData);
                    await nameRef.set(newUID);
                    foundUID = newUID;

                    // Clear legacy local storage for this user specifically or just leave it
                } else {
                    return { success: false, msg: "Tài khoản không tồn tại!" };
                }
            }

            if (!userData || userData.password !== password) {
                return { success: false, msg: "Sai mật khẩu!" };
            }

            this.stopSync(); // Stop any old syncs

            this.username = userData.username;
            this.uid = foundUID;
            this.chips = Number(userData.chips);
            this.lastDailyReward = Number(userData.lastDaily) || 0;
            this.isAdmin = userData.role === 'admin' || this.username === this.ADMIN_USERNAME;

            this.saveLocalSession();
            this.startSync();
            this.notifyUpdate();

            return { success: true };
        } catch (e) {
            console.error(e);
            return { success: false, msg: "Lỗi đăng nhập: " + e.message };
        }
    },

    logout() {
        this.stopSync();
        this.username = null;
        this.uid = null;
        this.chips = 0;
        this.isAdmin = false;
        this.saveLocalSession();
        this.notifyUpdate();
    },

    async addChips(amount) {
        if (!this.uid || !window.db) return;
        const newTotal = this.chips + parseInt(amount);
        await db.ref('users/' + this.uid + '/chips').set(newTotal);
    },

    async deductChips(amount) {
        if (!this.uid || !window.db) return false;
        if (this.chips >= amount) {
            const newTotal = this.chips - parseInt(amount);
            await db.ref('users/' + this.uid + '/chips').set(newTotal);
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

    async claimDaily() {
        if (this.canClaimDaily() && this.uid) {
            await this.addChips(this.DAILY_AMOUNT);
            await db.ref('users/' + this.uid + '/lastDaily').set(Date.now());
            return true;
        }
        return false;
    },

    // ---- Admin Functions (Firebase) ----
    async adminAddChips(targetUID, amount) {
        if (!this.isAdmin) return { success: false, msg: "Bạn không có quyền admin!" };
        amount = parseInt(amount);
        if (isNaN(amount) || amount <= 0) return { success: false, msg: "Số chip không hợp lệ!" };

        try {
            const targetRef = db.ref('users/' + targetUID + '/chips');
            const snap = await targetRef.get();
            if (!snap.exists()) return { success: false, msg: "Không tìm thấy user với UID: " + targetUID };

            const current = Number(snap.val()) || 0;
            const updated = current + amount;
            await targetRef.set(updated);

            return { success: true, msg: `Đã nạp ${amount.toLocaleString()} cho ${targetUID}. Số dư mới: ${updated.toLocaleString()}` };
        } catch(e) {
            return { success: false, msg: e.message };
        }
    },

    async adminGetAllUsers() {
        if (!this.isAdmin || !window.db) return [];
        try {
            const snap = await db.ref('users').get();
            const data = snap.val() || {};
            return Object.values(data).map(u => ({
                username: u.username,
                uid: u.uid || 'N/A',
                chips: Number(u.chips),
                role: u.role || 'user'
            }));
        } catch(e) {
            return [];
        }
    }
};

// Auto-initialize when file loads
Account.init();
