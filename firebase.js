// ============================================================
//  firebase.js — Firebase 설정 파일
//
//  ★ 아래 firebaseConfig 안의 값들을 본인 Firebase 프로젝트
//    설정으로 교체해야 앱이 동작합니다.
//
//  설정값 확인 방법:
//    1. https://console.firebase.google.com 접속
//    2. 본인 프로젝트 선택
//    3. [프로젝트 설정] (톱니바퀴 아이콘) 클릭
//    4. [앱] 탭 > 웹 앱 선택 > [SDK 설정 및 구성] 섹션
//    5. firebaseConfig 객체 전체를 아래에 붙여넣기
// ============================================================

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
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
