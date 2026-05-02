'use strict';

// ============================================================
//  app.js — 교육 이수 관리 시스템 메인 로직
// ============================================================

// ─── 상태 ─────────────────────────────────────────────────
let uid        = null;   // 현재 로그인 사용자 ID
let allEdus    = [];     // 전체 교육 항목 배열
let editId     = null;   // 수정 중인 항목 ID (null = 신규)
let curFilter  = 'all'; // 현재 필터
let unsubEdu   = null;  // Firestore 실시간 구독 해제 함수

// ─── DOM 참조 ──────────────────────────────────────────────
const $ = id => document.getElementById(id);

const loadingScreen = $('loadingScreen');
const loginScreen   = $('loginScreen');
const appScreen     = $('appScreen');
const authError     = $('authError');
const authEmailEl   = $('authEmail');
const authPassEl    = $('authPassword');
const userPhotoEl   = $('userPhoto');
const userNameEl    = $('userName');
const statTotalEl   = $('statTotal');
const statDoneEl    = $('statDone');
const statPendingEl = $('statPending');
const progressFill  = $('progressFill');
const progressBar   = $('progressBar');
const progressPct   = $('progressPct');
const emptyState    = $('emptyState');
const cardContainer = $('cardContainer');
const modalOverlay  = $('modalOverlay');
const modalTitle    = $('modalTitle');
const fTitle        = $('fTitle');
const fDesc         = $('fDesc');
const fStart        = $('fStart');
const fDue          = $('fDue');
const fEnrolled     = $('fEnrolled');
const fDone         = $('fDone');
const formError     = $('formError');
const toastEl       = $('toast');

// ─── 필수 교육 기본 목록 ───────────────────────────────────
const DEFAULT_EDUS = [
  { order: 1,  title: '성인지 원격교육',       description: '', dueDate: '2026-12-31', url: 'https://mnd.nhi.go.kr/home/main/newHomeMain.do' },
  { order: 2,  title: '장애인식 개선교육',      description: '', dueDate: '2026-12-31', url: 'https://mnd.nhi.go.kr/home/main/newHomeMain.do' },
  { order: 3,  title: '자살예방교육 (전반기)',   description: '', dueDate: '2026-06-30', url: 'https://mnd.nhi.go.kr/home/main/newHomeMain.do' },
  { order: 4,  title: '자살예방교육 (후반기)',   description: '', dueDate: '2026-12-31', url: 'https://mnd.nhi.go.kr/home/main/newHomeMain.do' },
  { order: 5,  title: '인권 교육',             description: '', dueDate: '2026-12-31', url: 'https://mnd.nhi.go.kr/home/main/newHomeMain.do' },
  { order: 6,  title: '아동학대 예방교육',      description: '', dueDate: '2026-12-31', url: 'https://mnd.nhi.go.kr/home/main/newHomeMain.do' },
  { order: 7,  title: '다문화 이해교육',        description: '', dueDate: '2026-12-31', url: 'https://mnd.nhi.go.kr/home/main/newHomeMain.do' },
  { order: 8,  title: '헌법수호교육',           description: '', dueDate: '2026-12-31', url: 'https://mnd.nhi.go.kr/home/main/newHomeMain.do' },
  { order: 9,  title: 'e-러닝 안전교육',        description: '', dueDate: '2026-12-31', url: 'https://safety.step.or.kr/main.do' },
  { order: 10, title: '청렴교육',              description: '', dueDate: '2026-12-31', url: 'https://acti.nhi.go.kr/' },
];

// 누락된 항목 추가 + 기존 항목에 order 필드 없으면 업데이트
async function seedDefaultEdus() {
  const col      = db.collection('users').doc(uid).collection('educations');
  const snap     = await col.get();
  const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const existingTitles = new Set(existing.map(d => d.title));

  const batch = db.batch();
  const ts    = firebase.firestore.FieldValue.serverTimestamp();
  let changed = false;

  // 누락된 필수 교육 추가
  DEFAULT_EDUS.forEach(edu => {
    if (!existingTitles.has(edu.title)) {
      batch.set(col.doc(), { ...edu, completed: false, createdAt: ts, updatedAt: ts });
      changed = true;
    }
  });

  // 기존 항목에 order 필드가 없으면 채워넣기
  existing.forEach(item => {
    const def = DEFAULT_EDUS.find(d => d.title === item.title);
    if (def && item.order === undefined) {
      batch.update(col.doc(item.id), { order: def.order });
      changed = true;
    }
  });

  if (changed) await batch.commit();
}

// ─── Google redirect 결과 처리 (signInWithRedirect 폴백용) ──
auth.getRedirectResult()
  .then(result => {
    // redirect 로그인 성공 시 onAuthStateChanged가 처리하므로 별도 처리 불필요
  })
  .catch(err => {
    if (err.code !== 'auth/no-auth-event') {
      showAuthError(authErrMsg(err.code));
      loadingScreen.classList.add('hidden');
      loginScreen.classList.remove('hidden');
    }
  });

// ─── 인증 상태 감지 ────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  loadingScreen.classList.add('hidden');

  if (user) {
    uid = user.uid;
    const displayName = user.displayName || user.email || '사용자';
    userNameEl.textContent = displayName;
    userPhotoEl.src = user.photoURL || makeAvatarSvg(displayName);

    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    await seedDefaultEdus();
    subscribeEdus();
  } else {
    uid = null;
    if (unsubEdu) { unsubEdu(); unsubEdu = null; }
    allEdus = [];
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }
});

// ─── 인라인 SVG 아바타 (photoURL 없을 때) ─────────────────
function makeAvatarSvg(name) {
  const initial = (name || '?')[0].toUpperCase();
  const colors  = ['#1e3a5f','#2563eb','#16a34a','#d97706','#7c3aed'];
  const color   = colors[initial.charCodeAt(0) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="33" height="33">
    <rect width="33" height="33" rx="16.5" fill="${color}"/>
    <text x="16.5" y="23" text-anchor="middle" fill="white"
          font-size="16" font-weight="700" font-family="sans-serif">${initial}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ─── 이메일 로그인 / 회원가입 ──────────────────────────────
function emailSignIn() {
  clearAuthError();
  const e = authEmailEl.value.trim();
  const p = authPassEl.value;
  if (!e || !p) return showAuthError('이메일과 비밀번호를 모두 입력하세요.');
  auth.signInWithEmailAndPassword(e, p)
    .catch(err => showAuthError(authErrMsg(err.code)));
}

function emailSignUp() {
  clearAuthError();
  const e = authEmailEl.value.trim();
  const p = authPassEl.value;
  if (!e || !p) return showAuthError('이메일과 비밀번호를 모두 입력하세요.');
  if (p.length < 6) return showAuthError('비밀번호는 6자 이상이어야 합니다.');
  auth.createUserWithEmailAndPassword(e, p)
    .catch(err => showAuthError(authErrMsg(err.code)));
}

function isInAppBrowser() {
  return /KAKAOTALK|NAVER|Instagram|FBAV|FBAN|Line|Snapchat|Twitter|MicroMessenger|WebView|wv\)/i.test(navigator.userAgent);
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function googleSignIn() {
  clearAuthError();

  if (isInAppBrowser()) {
    const current = location.href;
    // Android: Chrome으로 강제 열기 시도
    const chromeIntent = `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;
    showAuthError(
      '카카오톡 브라우저에서는 Google 로그인이 지원되지 않습니다.\n' +
      'Chrome 또는 Safari에서 이 페이지를 열어주세요.',
      'warn'
    );
    // 외부 브라우저로 열기 버튼 표시
    const existing = document.getElementById('openExternalBtn');
    if (!existing) {
      const btn = document.createElement('button');
      btn.id = 'openExternalBtn';
      btn.className = 'btn outline full';
      btn.style.marginTop = '8px';
      btn.textContent = '외부 브라우저로 열기';
      btn.onclick = () => {
        // Android Intent 방식 먼저 시도, 실패 시 클립보드 복사
        try {
          location.href = chromeIntent;
        } catch(e) {
          navigator.clipboard.writeText(current)
            .then(() => showAuthError('주소를 복사했습니다. Chrome에 붙여넣어 열어주세요.', 'info'))
            .catch(() => showAuthError('주소창에 직접 입력해주세요: ' + current, 'info'));
        }
      };
      authError.insertAdjacentElement('afterend', btn);
    }
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  if (isMobile()) {
    // 모바일은 팝업 대신 redirect 사용
    auth.signInWithRedirect(provider);
  } else {
    auth.signInWithPopup(provider)
      .catch(err => {
        if (err.code === 'auth/popup-blocked') {
          auth.signInWithRedirect(provider);
        } else {
          showAuthError(authErrMsg(err.code));
        }
      });
  }
}

function resetPassword() {
  clearAuthError();
  const e = authEmailEl.value.trim();
  if (!e) return showAuthError('비밀번호를 찾으려면 이메일 주소를 먼저 입력하세요.');
  auth.sendPasswordResetEmail(e)
    .then(() => showAuthError('비밀번호 재설정 이메일을 발송했습니다. 받은 편지함을 확인하세요.', 'info'))
    .catch(err => showAuthError(authErrMsg(err.code)));
}

function doSignOut() {
  auth.signOut();
}

function showAuthError(msg, type) {
  authError.textContent = msg;
  authError.className = 'auth-msg' + (type === 'info' ? ' info' : type === 'warn' ? ' warn' : '');
  authError.classList.remove('hidden');
}
function clearAuthError() { authError.classList.add('hidden'); }

function authErrMsg(code) {
  const m = {
    'auth/invalid-email':        '올바른 이메일 형식이 아닙니다.',
    'auth/user-not-found':       '등록되지 않은 이메일입니다.',
    'auth/wrong-password':       '비밀번호가 틀렸습니다.',
    'auth/invalid-credential':   '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/weak-password':        '비밀번호가 너무 약합니다. 6자 이상으로 설정하세요.',
    'auth/too-many-requests':    '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 시도해주세요.',
    'auth/popup-blocked':        '팝업이 차단되었습니다. 리디렉션 방식으로 재시도합니다...',
    'auth/cancelled-popup-request': '로그인 요청이 취소되었습니다. 다시 시도해주세요.',
    'auth/network-request-failed': '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.',
    'auth/internal-error':       '인증 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
  };
  return m[code] || '오류가 발생했습니다. (' + code + ')';
}

// 로그인 탭 전환
function switchTab(tab) {
  $('tabEmail').classList.toggle('active', tab === 'email');
  $('tabGoogle').classList.toggle('active', tab === 'google');
  $('panelEmail').classList.toggle('hidden', tab !== 'email');
  $('panelGoogle').classList.toggle('hidden', tab !== 'google');
  clearAuthError();
}

// ─── Firestore 실시간 구독 ─────────────────────────────────
function subscribeEdus() {
  unsubEdu = db
    .collection('users').doc(uid)
    .collection('educations')
    .orderBy('dueDate', 'asc')
    .onSnapshot(
      snap => {
        allEdus = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
      },
      err => {
        console.error('Firestore 구독 오류:', err);
        showToast('데이터를 불러오는 중 오류가 발생했습니다.');
      }
    );
}

function eduRef(id) {
  const col = db.collection('users').doc(uid).collection('educations');
  return id ? col.doc(id) : col;
}

// ─── CRUD ──────────────────────────────────────────────────
async function saveEdu(e) {
  e.preventDefault();
  formError.classList.add('hidden');

  const title = fTitle.value.trim();
  const due   = fDue.value;
  if (!title) return showFormError('교육 제목을 입력하세요.');
  if (!due)   return showFormError('마감일을 선택하세요.');

  const saveBtn = $('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중…';

  const data = {
    title,
    description: fDesc.value.trim(),
    startDate:   fStart.value || null,
    dueDate:     due,
    enrolled:    fEnrolled.checked,
    completed:   fDone.checked,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (editId) {
      await eduRef(editId).update(data);
      showToast('교육이 수정되었습니다.');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await eduRef(null).add(data);
      showToast('교육이 추가되었습니다.');
    }
    closeModal();
  } catch (err) {
    console.error('저장 오류:', err);
    showFormError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '저장';
  }
}

async function deleteEdu(id) {
  const edu = allEdus.find(e => e.id === id);
  if (!edu) return;
  if (!confirm(`"${edu.title}" 교육을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
  try {
    await eduRef(id).delete();
    showToast('교육이 삭제되었습니다.');
  } catch (err) {
    console.error('삭제 오류:', err);
    showToast('삭제 중 오류가 발생했습니다.');
  }
}

async function toggleEnroll(id, current) {
  try {
    await eduRef(id).update({
      enrolled: !current,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('수강신청 업데이트 오류:', err);
    showToast('업데이트 중 오류가 발생했습니다.');
  }
}

async function toggleComplete(id, current) {
  try {
    await eduRef(id).update({
      completed: !current,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('업데이트 오류:', err);
    showToast('업데이트 중 오류가 발생했습니다.');
  }
}

// ─── 상태 계산 ─────────────────────────────────────────────
function getStatus(edu) {
  if (edu.completed) return 'done';
  const today = todayMidnight();

  // 시작일 전이면 수강 대기
  if (edu.startDate) {
    const start = parseLocalDate(edu.startDate);
    if (today < start) return 'waiting';
  }

  // 수강 신청 완료 (미이수)
  if (edu.enrolled) return 'enrolled';

  if (!edu.dueDate) return 'normal';
  const due = parseLocalDate(edu.dueDate);
  if (due < today) return 'overdue';
  if ((due - today) / 86400000 <= 7) return 'soon';
  return 'normal';
}

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseLocalDate(str) {
  // "YYYY-MM-DD" → 로컬 자정
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ─── 렌더링 ────────────────────────────────────────────────
function render() {
  updateStats();
  renderCards();
}

function updateStats() {
  const total   = allEdus.length;
  const done    = allEdus.filter(e => e.completed).length;
  const pending = total - done;
  const pct     = total === 0 ? 0 : Math.round((done / total) * 100);

  statTotalEl.textContent   = total;
  statDoneEl.textContent    = done;
  statPendingEl.textContent = pending;
  progressFill.style.width  = pct + '%';
  progressPct.textContent   = pct + '%';
  progressBar.setAttribute('aria-valuenow', pct);
}

function setFilter(btn, filter) {
  document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  curFilter = filter;
  renderCards();
}

function renderCards() {
  let list = [...allEdus];

  if (curFilter === 'done')    list = list.filter(e => e.completed);
  if (curFilter === 'pending') list = list.filter(e => !e.completed);
  if (curFilter === 'overdue') list = list.filter(e => getStatus(e) === 'overdue');
  if (curFilter === 'soon')    list = list.filter(e => getStatus(e) === 'soon');

  // 정렬: 미완료 → 완료, order 번호 → 마감일 오름차순
  list.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const oa = getOrderNum(a), ob = getOrderNum(b);
    if (oa !== ob) return oa - ob;
    return (a.dueDate || '').localeCompare(b.dueDate || '');
  });

  if (list.length === 0) {
    emptyState.classList.remove('hidden');
    cardContainer.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  cardContainer.classList.remove('hidden');
  cardContainer.innerHTML = list.map(renderCard).join('');
}

// Firestore에 order/url 없으면 DEFAULT_EDUS 제목으로 찾아서 반환
function getOrderNum(edu) {
  const def = DEFAULT_EDUS.find(d => d.title === edu.title);
  return def ? def.order : 999;
}

function getUrl(edu) {
  if (edu.url) return edu.url;
  const def = DEFAULT_EDUS.find(d => d.title === edu.title);
  return def ? def.url : null;
}

function renderCard(edu) {
  const status    = getStatus(edu);
  const badgeCls  = { done:'done', overdue:'overdue', soon:'soon', enrolled:'', waiting:'', normal:'' }[status] || '';
  const countdown = getDueBadge(status, edu.dueDate, edu.startDate);
  const orderNum  = getOrderNum(edu);
  const url       = getUrl(edu);

  // 날짜 표시: 시작일 있으면 범위, 없으면 마감일만
  const dateStr = edu.startDate
    ? `${formatShort(edu.startDate)} ~ ${formatShort(edu.dueDate)}`
    : formatDate(edu.dueDate);

  return `
    <div class="edu-card status-${esc(status)}" role="listitem">
      <input type="checkbox" class="card-check"
             ${edu.completed ? 'checked' : ''}
             onchange="toggleComplete('${esc(edu.id)}', ${edu.completed})"
             aria-label="${esc(edu.title)} 이수 완료 체크">
      <div class="card-body">
        <div class="card-title">${orderNum < 999 ? `<span class="card-num">${orderNum}.</span> ` : ''}${esc(edu.title)}</div>
        ${edu.description ? `<div class="card-desc">${esc(edu.description)}</div>` : ''}
        <div class="card-meta">
          <span class="due-badge ${badgeCls}">📅 ${dateStr}${countdown ? ' · ' + countdown : ''}</span>
          <button class="enroll-btn ${edu.enrolled ? 'on' : ''}"
                  onclick="toggleEnroll('${esc(edu.id)}', ${!!edu.enrolled})">
            ${edu.enrolled ? '✓ 수강신청 완료' : '○ 수강신청 전'}
          </button>
          ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="link-badge">🔗 바로가기</a>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <button class="icon-btn" title="수정" onclick="openEditModal('${esc(edu.id)}')">✏️</button>
        <button class="icon-btn delete" title="삭제" onclick="deleteEdu('${esc(edu.id)}')">🗑️</button>
      </div>
    </div>`;
}

function getDueBadge(status, dueDate, startDate) {
  if (status === 'done')     return '✓ 이수 완료';
  if (status === 'enrolled') return '📚 수강 중';
  if (status === 'waiting') {
    const diff = Math.round((parseLocalDate(startDate) - todayMidnight()) / 86400000);
    return diff === 0 ? '오늘부터 수강 가능' : `${diff}일 후 수강 가능`;
  }
  if (status === 'overdue') return '⚠ 기한 초과';
  if (!dueDate) return '';
  const diff = Math.round((parseLocalDate(dueDate) - todayMidnight()) / 86400000);
  if (diff === 0) return '⚡ 오늘 마감';
  if (status === 'soon') return `⏰ D-${diff}`;
  return `D-${diff}`;
}

function formatDate(str) {
  if (!str) return '-';
  const d = parseLocalDate(str);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatShort(str) {
  if (!str) return '-';
  const d = parseLocalDate(str);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── 모달 ──────────────────────────────────────────────────
function openModal() {
  editId = null;
  modalTitle.textContent = '교육 추가';
  $('eduForm').reset();
  formError.classList.add('hidden');

  // 기본 마감일: 30일 후
  const d = new Date();
  d.setDate(d.getDate() + 30);
  fStart.value    = '';
  fDue.value      = d.toISOString().split('T')[0];
  fEnrolled.checked = false;
  fDone.checked   = false;

  modalOverlay.classList.remove('hidden');
  fTitle.focus();
}

function openEditModal(id) {
  const edu = allEdus.find(e => e.id === id);
  if (!edu) return;

  editId = id;
  modalTitle.textContent = '교육 수정';
  fTitle.value      = edu.title       || '';
  fDesc.value       = edu.description || '';
  fStart.value      = edu.startDate   || '';
  fDue.value        = edu.dueDate     || '';
  fEnrolled.checked = edu.enrolled    || false;
  fDone.checked     = edu.completed   || false;
  formError.classList.add('hidden');

  modalOverlay.classList.remove('hidden');
  fTitle.focus();
}

function closeModal(e) {
  // 오버레이 배경 클릭 시 또는 버튼 클릭 시 닫기
  if (e && e.type === 'click' && e.currentTarget === modalOverlay) {
    if (e.target !== modalOverlay) return;
  }
  modalOverlay.classList.add('hidden');
  editId = null;
  formError.classList.add('hidden');
}

function showFormError(msg) {
  formError.textContent = msg;
  formError.classList.remove('hidden');
}

// 모달 오버레이 클릭 (배경 클릭 시 닫기)
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
    closeModal();
  }
});

// ─── 토스트 알림 ───────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2800);
}
