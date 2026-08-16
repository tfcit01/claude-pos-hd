// Firebase 初始化設定
// 專案:pos-hd-25e72(獨立於既有的收銀機硬體管理系統,完全隔離)
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAx-mcMRUxADXcRmGHuHMtvKemOgnEG17s",
  authDomain: "pos-hd-25e72.firebaseapp.com",
  projectId: "pos-hd-25e72",
  storageBucket: "pos-hd-25e72.firebasestorage.app",
  messagingSenderId: "13223410693",
  appId: "1:13223410693:web:2f0a69c07381c8365bf06c",
  measurementId: "G-PZ0HPPRYC8",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
