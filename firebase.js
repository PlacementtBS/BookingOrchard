import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDwS5vhqh3F0JlbEpSn80zAqMs5SP27pDo",
  authDomain: "bookingorchard.firebaseapp.com",
  projectId: "bookingorchard",
  storageBucket: "bookingorchard.firebasestorage.app",
  messagingSenderId: "1005273805706",
  appId: "1:1005273805706:web:b74abca7cc014ea4480e73",
  measurementId: "G-SQ3GPD6X4Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
