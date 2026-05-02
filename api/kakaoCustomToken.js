'use strict';

const https = require('https');
let admin;

function getAdmin() {
  if (!admin) {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(
          JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        ),
      });
    }
  }
  return admin;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

  try {
    const kakaoUser = await new Promise((resolve, reject) => {
      const request = https.request({
        hostname: 'kapi.kakao.com',
        path: '/v2/user/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }, r => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => r.statusCode === 200
          ? resolve(JSON.parse(body))
          : reject(new Error(`Kakao API ${r.statusCode}`))
        );
      });
      request.on('error', reject);
      request.end();
    });

    const firebaseAdmin = getAdmin();
    const uid      = `kakao:${kakaoUser.id}`;
    const profile  = kakaoUser.kakao_account?.profile || {};
    const nickname = profile.nickname || kakaoUser.properties?.nickname || '카카오사용자';
    const email    = kakaoUser.kakao_account?.email || null;
    const photoURL = profile.thumbnail_image_url || null;

    const userRecord = { displayName: nickname };
    if (photoURL) userRecord.photoURL = photoURL;
    if (email)    { userRecord.email = email; userRecord.emailVerified = true; }

    try {
      await firebaseAdmin.auth().updateUser(uid, userRecord);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        await firebaseAdmin.auth().createUser({ uid, ...userRecord });
      } else throw e;
    }

    const token = await firebaseAdmin.auth().createCustomToken(uid);
    res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
