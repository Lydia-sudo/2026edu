'use strict';
// v1.0.0

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions }   = require('firebase-functions/v2');
const admin = require('firebase-admin');
const https = require('https');

admin.initializeApp();
setGlobalOptions({ region: 'asia-northeast3' }); // 서울 리전

// 카카오 액세스 토큰 → Firebase 커스텀 토큰 교환
exports.kakaoCustomToken = onCall({ cors: true }, async (req) => {
  const { accessToken } = req.data;
  if (!accessToken) {
    throw new HttpsError('invalid-argument', 'accessToken이 필요합니다.');
  }

  // 카카오 API로 사용자 정보 조회
  const kakaoUser = await new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'kapi.kakao.com',
      path: '/v2/user/me',
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(body));
        else reject(new HttpsError('unauthenticated', `Kakao API 오류: ${res.statusCode}`));
      });
    });
    request.on('error', err => reject(new HttpsError('internal', err.message)));
    request.end();
  });

  const uid        = `kakao:${kakaoUser.id}`;
  const profile    = kakaoUser.kakao_account?.profile || {};
  const nickname   = profile.nickname || kakaoUser.properties?.nickname || '카카오사용자';
  const email      = kakaoUser.kakao_account?.email   || null;
  const photoURL   = profile.thumbnail_image_url      || kakaoUser.properties?.thumbnail_image || null;

  // Firebase Auth 사용자 생성 or 업데이트
  const userRecord = { displayName: nickname };
  if (photoURL) userRecord.photoURL = photoURL;
  if (email)    { userRecord.email = email; userRecord.emailVerified = true; }

  try {
    await admin.auth().updateUser(uid, userRecord);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      await admin.auth().createUser({ uid, ...userRecord });
    } else {
      throw new HttpsError('internal', e.message);
    }
  }

  const token = await admin.auth().createCustomToken(uid);
  return { token };
});
