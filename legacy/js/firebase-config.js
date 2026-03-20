// Firebase Configuration & Initialization
// Using Firebase SDK v9+ (Compatibility/UMD versions for static HTML)

const firebaseConfig = {
  apiKey: "AIzaSyD8Y40caYxBP33S7BoSBF3tK-NzLb-paZA",
  authDomain: "casino-34809.firebaseapp.com",
  projectId: "casino-34809",
  storageBucket: "casino-34809.firebasestorage.app",
  messagingSenderId: "79234215816",
  appId: "1:79234215816:web:ce3e506182eac193a8143d",
  measurementId: "G-R5XR211LY8",
  databaseURL: "https://casino-34809-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// We will use the Firebase Compat SDK to make it easier to inject via script tags
// These will be available globally after loading the scripts in HTML:
// - firebase.initializeApp(config)
// - firebase.database()

if (!window.firebase) {
    console.error("Firebase SDK not loaded! Make sure to include Firebase scripts in your HTML.");
} else {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.database();
    console.log("Firebase initialized successfully.");
}
