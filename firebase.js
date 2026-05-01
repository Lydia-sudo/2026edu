const firebaseConfig = {
  apiKey: "AIzaSyA8MxGh_wuZ6S9rL7v5OXHUvQAGmY6DRIQ",
  authDomain: "edu-a5172.firebaseapp.com",
  projectId: "edu-a5172",
  storageBucket: "edu-a5172.firebasestorage.app",
  messagingSenderId: "451200816453",
  appId: "1:451200816453:web:e67720c0c4e044dabf9a2c",
  measurementId: "G-QJ4877QK85"
};


// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// 앱 전체에서 사용할 서비스 객체
const auth = firebase.auth();
const db   = firebase.firestore();

// 오프라인에서도 기존 데이터를 볼 수 있도록 로컬 캐시 활성화
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('Firestore persistence error:', err);
    }
  });
