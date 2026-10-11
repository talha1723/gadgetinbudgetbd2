// ফায়ারবেস কনফিগারেশন
var firebaseConfig = {
  apiKey: "AIzaSyAb5lUbA15BaWIqJhCXC6sZ8vWaxttHwiQ",
  authDomain: "gib-store-1723.firebaseapp.com",
  projectId: "gib-store-1723",
  storageBucket: "gib-store-1723.firebasestorage.app",
  messagingSenderId: "163598178784",
  appId: "1:163598178784:web:6af3e60e3cf20aebb93385"
};

// ইনিশিয়ালাইজেশন
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// গ্লোবাল ডাটাবেস অবজেক্ট
window.db = (typeof firebase !== 'undefined') ? firebase.firestore() : null;