// Хранилище сайта: состояние школы с сервера и бизнес-логика — перенос KKSUStore и его расширений
// (KKSUBillingLogic, KKSUCourseLogic, KKSUModeration, KKSUCloudStore, KKSUPrivacy) из iOS-приложения.
import { cloud, CloudError, memberRole, type CloudMember } from './cloud';
import { emptyBilling, emptyDatabase, type KKSUBillingDatabase, type KKSUDatabase, type ListKey } from './db';

export type ItemOf<K extends ListKey> = KKSUDatabase[K] extends (infer T)[] ? T : never;
import { newId, nowISO, isoIn, sameId, time, toISO } from './ids';
import * as M from './models.gen';
import {
  makeAchievement, makeAssignment, makeCertificate, makeChatMessage, makeChatThread, makeContentReport, makeEntitlement,
  makeEventRegistration, makeHistoryEntry, makeInvoice, makeKKSUNotification, makeKKSUUser, makeLessonProgress,
  makeProduct, makeScheduleSession, makeStageChange, makeStudentProfile, makeSubmission, makeTestAttempt, makeUserBlock,
  makeAccessibilitySettings, makeLearningPreferences,
} from './models.gen';
import {
  attemptPercent, containsObjectionable, coveredBySubscription, entitlementActive, invoiceAmount, invoiceTotal, nextStage,
  promoDiscount, promoValid, publishedLessons, reviewAverage, testMaxScore, lessonJoinURL, KKSURoleExtra,
} from './helpers';

export type SyncStatus = 'signedOut' | 'loading' | 'syncing' | 'synced' | 'failed';

export class AuthError extends Error {}

export const AuthErrors = {
  emptyFields: 'Заполните все обязательные поля.',
  invalidEmail: 'Введите корректный email.',
  weakPassword: 'Пароль должен быть не короче 8 символов и содержать цифру.',
  invalidCode: 'Код восстановления неверный или устарел.',
};

export const BillingErrors = {
  invalidPromo: 'Промокод недействителен или не подходит для этого продукта.',
  alreadyOwned: 'Доступ уже открыт.',
  noBeneficiary: 'Выберите, для кого оформляется оплата.',
  tooManyChildren: (seats: number) => `Семейная подписка покрывает не более ${seats} детей.`,
  refundExpired: 'Срок запроса возврата истёк.',
};

export const isValidEmail = (email: string) => {
  const parts = email.split('@');
  return parts.length === 2 && parts[1].includes('.') && parts[0].length > 0;
};
export const isStrongPassword = (p: string) => p.length >= 8 && /\d/.test(p);

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export class KKSUStore {
  db: KKSUDatabase = emptyDatabase();
  billing: KKSUBillingDatabase = emptyBilling();
  status: SyncStatus = cloud.isSignedIn ? 'loading' : 'signedOut';
  statusMessage = '';
  lastSynced: Date | null = null;
  members: CloudMember[] = [];

  private version = 0;
  private listeners = new Set<() => void>();
  private syncTimer: number | null = null;
  private pollTimer: number | null = null;
  private syncing = false;
  private needsAnotherSync = false;

  // MARK: подписка React

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.listeners.forEach((l) => l()); }

  /** Данные изменились: обновить экран и отправить изменения на сервер. */
  changed() {
    this.emit();
    this.scheduleSync();
  }

  // MARK: - Вход, регистрация, сессия

  get currentUser(): M.KKSUUser | undefined {
    return this.db.currentUserID ? this.user(this.db.currentUserID) : undefined;
  }
  get role(): M.KKSURole { return this.currentUser?.role ?? 'student'; }

  /** Восстановление сессии при открытии сайта. */
  async start() {
    if (!cloud.isSignedIn) { this.status = 'signedOut'; this.emit(); return; }
    try {
      const me = cloud.session!;
      const member = await cloud.fetchMember(me.userID);
      if (!member) throw new CloudError('Участник школы не найден.', 0, 'noSession');
      await cloud.checkMember(member);
      await this.loadSchool(member, member.full_name || me.email, me.email, '');
    } catch (e) {
      await cloud.signOut();
      this.reset();
      this.statusMessage = (e as Error).message;
      this.status = 'signedOut';
      this.emit();
    }
  }

  async login(email: string, password: string, expectedRole?: M.KKSURole) {
    email = email.trim().toLowerCase();
    if (!email || !password) throw new AuthError(AuthErrors.emptyFields);
    const result = await cloud.signIn(email, password);
    await cloud.checkMember(result.member, expectedRole);
    await this.loadSchool(result.member, result.fullName, email, result.phone);
  }

  async register(fullName: string, email: string, phone: string, password: string, role: M.KKSURole) {
    email = email.trim().toLowerCase();
    fullName = fullName.trim();
    if (!fullName || !email || !password) throw new AuthError(AuthErrors.emptyFields);
    if (!isValidEmail(email)) throw new AuthError(AuthErrors.invalidEmail);
    if (!isStrongPassword(password)) throw new AuthError(AuthErrors.weakPassword);
    const member = await cloud.signUp(fullName, email, phone, password, role);
    await cloud.checkMember(member);
    await this.loadSchool(member, fullName, email, phone, true);
  }

  /** Сначала загружаем данные школы, потом создаём/обновляем свой профиль — чтобы не затереть данные с других устройств. */
  private async loadSchool(member: CloudMember, fullName: string, email: string, phone: string, isNew = false) {
    this.reset();
    this.status = 'loading';
    this.emit();
    await cloud.pull(this);
    await this.refreshMembers();
    this.adoptCloudUser(member.user_id.toUpperCase(), member.full_name || fullName, email, phone, memberRole(member));
    if (isNew) this.notify(this.db.currentUserID!, 'Добро пожаловать в KKSU Online!', 'Заполните профиль, чтобы получить персональные рекомендации.', 'system');
    this.status = 'synced';
    this.lastSynced = new Date();
    this.emit();
    await this.sync();
    this.startPolling();
  }

  private adoptCloudUser(id: string, fullName: string, email: string, phone: string, role: M.KKSURole) {
    const index = this.db.users.findIndex((u) => sameId(u.id, id));
    if (index >= 0) {
      const u = this.db.users[index];
      this.db.users[index] = { ...u, email, phone: phone || u.phone, role, lastLogin: nowISO() };
    } else {
      this.db.users.push(makeKKSUUser({ id, fullName, email, phone, role, passwordHash: '', salt: '', lastLogin: nowISO() }));
      this.log(id, 'Регистрация на платформе', M.KKSURole.title[role], 'person.badge.plus');
    }
    if (role === 'student' && !this.profile(id)) this.db.studentProfiles.push(makeStudentProfile({ userID: id }));
    this.db.currentUserID = this.db.users.find((u) => sameId(u.id, id))!.id;
  }

  async logout() {
    this.stopPolling();
    try { await this.syncNow(); } catch { /* офлайн */ }
    await cloud.signOut();
    this.reset();
    this.status = 'signedOut';
    this.emit();
  }

  private reset() {
    this.db = emptyDatabase();
    this.billing = emptyBilling();
    this.members = [];
    cloud.resetSyncState();
  }

  async requestPasswordReset(email: string) { await cloud.requestPasswordReset(email); }

  async resetPassword(email: string, code: string, newPassword: string) {
    if (!isStrongPassword(newPassword)) throw new AuthError(AuthErrors.weakPassword);
    await cloud.resetPassword(email, code, newPassword);
  }

  async deleteMyAccount() {
    const id = this.db.currentUserID;
    if (!id) return;
    this.stopPolling();
    await cloud.deleteAccount();
    this.reset();
    this.status = 'signedOut';
    this.emit();
  }

  // MARK: - Синхронизация

  scheduleSync(delay = 1200) {
    if (!cloud.isSignedIn || !this.db.currentUserID) return;
    if (this.syncTimer) window.clearTimeout(this.syncTimer);
    this.syncTimer = window.setTimeout(() => { void this.sync(); }, delay);
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = window.setInterval(() => { void this.sync(); }, 20000);
  }

  private stopPolling() {
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    if (this.syncTimer) window.clearTimeout(this.syncTimer);
    this.pollTimer = this.syncTimer = null;
  }

  async sync() {
    try { await this.syncNow(); } catch { /* статус уже выставлен */ }
  }

  private async syncNow() {
    if (!cloud.isSignedIn || !this.db.currentUserID) return;
    if (this.syncing) { this.needsAnotherSync = true; return; }
    this.syncing = true;
    this.status = 'syncing';
    this.emit();
    try {
      await cloud.push(this, this.role);
      await cloud.pull(this);
      await this.refreshMembers();
      this.status = 'synced';
      this.statusMessage = '';
      this.lastSynced = new Date();
    } catch (e) {
      this.status = 'failed';
      this.statusMessage = (e as Error).message;
      if ((e as CloudError).kind === 'noSession') { this.reset(); this.status = 'signedOut'; }
      throw e;
    } finally {
      this.syncing = false;
      this.emit();
      if (this.needsAnotherSync) { this.needsAnotherSync = false; this.scheduleSync(300); }
    }
  }

  async refreshMembers() {
    try {
      this.members = await cloud.loadMembers();
    } catch { return; }
    // Роль и блокировка берутся из таблицы участников — её меняет только администратор.
    for (const member of this.members) {
      const index = this.db.users.findIndex((u) => sameId(u.id, member.user_id));
      if (index < 0) continue;
      const blocked = member.blocked || !member.approved;
      const role = memberRole(member);
      if (this.db.users[index].role !== role || this.db.users[index].isBlocked !== blocked) {
        this.db.users[index] = { ...this.db.users[index], role, isBlocked: blocked };
      }
    }
  }

  async updateMember(userID: string, fields: { role?: M.KKSURole; approved?: boolean; blocked?: boolean }) {
    await cloud.updateMember(userID, fields);
    await this.refreshMembers();
    this.emit();
  }

  // MARK: - Поиск

  user(id?: string | null) { return id ? this.db.users.find((u) => sameId(u.id, id)) : undefined; }
  userName(id?: string | null) { return this.user(id)?.fullName ?? '—'; }
  users(role: M.KKSURole) { return this.db.users.filter((u) => u.role === role); }
  get students() { return this.users('student'); }
  profile(userID?: string | null) { return userID ? this.db.studentProfiles.find((p) => sameId(p.userID, userID)) : undefined; }
  program(id?: string | null) { return id ? this.db.programs.find((p) => sameId(p.id, id)) : undefined; }
  project(id?: string | null) { return id ? this.db.projects.find((p) => sameId(p.id, id)) : undefined; }
  partner(id?: string | null) { return id ? this.db.partners.find((p) => sameId(p.id, id)) : undefined; }

  /** Ученики, доступные текущему пользователю. */
  get visibleStudents(): M.KKSUUser[] {
    const user = this.currentUser;
    if (!user) return [];
    switch (user.role) {
      case 'student': return [user];
      case 'parent': case 'mentor': {
        const linked = this.students.filter((s) => user.linkedStudentIDs.some((id) => sameId(id, s.id)));
        return linked.length === 0 && user.role === 'mentor' ? this.students : linked;
      }
      case 'partner': return [];
      default: return this.students;
    }
  }

  // MARK: - Настройки

  get accessibility(): M.AccessibilitySettings {
    const id = this.db.currentUserID;
    return (id && this.findByKey(this.db.accessibility, id)) || makeAccessibilitySettings();
  }
  setAccessibility(value: M.AccessibilitySettings) {
    const id = this.db.currentUserID;
    if (!id) return;
    this.db.accessibility[id] = value;
    this.changed();
  }
  preferences(userID: string): M.LearningPreferences {
    return this.findByKey(this.db.preferences, userID) || makeLearningPreferences();
  }
  setPreferences(value: M.LearningPreferences) {
    const id = this.db.currentUserID;
    if (!id) return;
    this.db.preferences[id] = value;
    this.changed();
  }
  private findByKey<T>(map: Record<string, T>, id: string): T | undefined {
    const key = Object.keys(map).find((k) => sameId(k, id));
    return key ? map[key] : undefined;
  }

  // MARK: - История и уведомления

  log(userID: string, action: string, details = '', icon = 'clock') {
    this.db.history.push(makeHistoryEntry({ userID, action, details, icon }));
  }

  notify(userID: string, title: string, body: string, kind: M.NotificationKind = 'info') {
    this.db.notifications.push(makeKKSUNotification({ userID, title, body, kind }));
  }

  get myNotifications() {
    const id = this.db.currentUserID;
    if (!id) return [];
    return this.db.notifications.filter((n) => sameId(n.userID, id)).sort((a, b) => time(b.date) - time(a.date));
  }
  get unreadCount() { return this.myNotifications.filter((n) => !n.isRead).length; }

  markAllRead() {
    const id = this.db.currentUserID;
    if (!id) return;
    this.db.notifications = this.db.notifications.map((n) => (sameId(n.userID, id) && !n.isRead ? { ...n, isRead: true } : n));
    this.changed();
  }

  // MARK: - Задания и оценивание

  assignmentsFor(studentID: string) {
    return this.db.assignments.filter((a) => a.audience === 'students' && a.approvedByTeacher &&
      (a.assignedIDs.length === 0 || a.assignedIDs.some((id) => sameId(id, studentID))))
      .sort((a, b) => time(a.dueDate) - time(b.dueDate));
  }

  submission(assignmentID: string, studentID: string) {
    return this.db.submissions.filter((s) => sameId(s.assignmentID, assignmentID) && sameId(s.studentID, studentID))
      .sort((a, b) => time(b.submittedAt) - time(a.submittedAt))[0];
  }

  publish(assignment: M.Assignment) {
    this.db.assignments.push(assignment);
    if (assignment.approvedByTeacher) this.announce(assignment);
    this.changed();
  }

  private announce(a: M.Assignment) {
    const targets = a.assignedIDs.length === 0 ? this.students.map((s) => s.id) : a.assignedIDs;
    for (const id of targets) this.notify(id, `Новое задание: ${a.title}`, `Срок сдачи: ${fmtDateTime(a.dueDate)}`, 'deadline');
  }

  approveAIAssignment(id: string) {
    const i = this.db.assignments.findIndex((a) => sameId(a.id, id));
    if (i < 0) return;
    this.db.assignments[i] = { ...this.db.assignments[i], approvedByTeacher: true, teacherID: this.db.currentUserID };
    this.announce(this.db.assignments[i]);
    this.changed();
  }

  submitWork(assignmentID: string, studentID: string, text: string, attachments: M.Attachment[]) {
    this.db.submissions.push(makeSubmission({ assignmentID, studentID, text, attachments }));
    const a = this.db.assignments.find((x) => sameId(x.id, assignmentID));
    this.log(studentID, 'Сдана работа', a?.title ?? '', 'tray.and.arrow.up.fill');
    if (a?.teacherID) this.notify(a.teacherID, 'Новая работа на проверку', `${this.userName(studentID)}: ${a.title}`, 'info');
    this.checkAchievements(studentID);
    this.changed();
  }

  grade(submissionID: string, score: number, feedback: string, returnForRevision = false) {
    const i = this.db.submissions.findIndex((s) => sameId(s.id, submissionID));
    if (i < 0) return;
    this.db.submissions[i] = { ...this.db.submissions[i], score: Math.round(score), feedback, gradedAt: nowISO(),
      gradedBy: this.db.currentUserID, status: returnForRevision ? 'returned' : 'graded' };
    const sub = this.db.submissions[i];
    const title = this.db.assignments.find((a) => sameId(a.id, sub.assignmentID))?.title ?? 'Задание';
    this.notify(sub.studentID, returnForRevision ? 'Работа возвращена на доработку' : 'Работа оценена', `${title}: ${score} балл(ов). ${feedback}`, 'grade');
    for (const parent of this.db.users.filter((u) => u.role === 'parent' && u.linkedStudentIDs.some((id) => sameId(id, sub.studentID)))) {
      this.notify(parent.id, 'Новая оценка ребёнка', `${this.userName(sub.studentID)} — ${title}: ${score}`, 'grade');
    }
    this.log(sub.studentID, 'Получена оценка', `${title}: ${score}`, 'star.fill');
    const p = this.db.studentProfiles.findIndex((x) => sameId(x.userID, sub.studentID));
    if (p >= 0) this.db.studentProfiles[p] = { ...this.db.studentProfiles[p], xp: this.db.studentProfiles[p].xp + score * 10 };
    this.checkAchievements(sub.studentID);
    this.changed();
  }

  // MARK: - Тесты

  static evaluate(q: M.TestQuestion, answer?: M.TestAnswer): boolean {
    if (!answer) return false;
    switch (q.kind) {
      case 'single': case 'multiple': {
        const a = new Set(answer.selected), c = new Set(q.correctIndices);
        return answer.selected.length > 0 && a.size === c.size && [...a].every((x) => c.has(x));
      }
      case 'number': {
        const n = (s: string) => { const v = parseFloat(s.replace(',', '.').trim()); return isNaN(v) ? null : v; };
        const given = n(answer.text), correct = n(q.correctText);
        return given !== null && correct !== null && Math.abs(given - correct) < 0.0001;
      }
      case 'text': {
        const clean = (s: string) => s.toLowerCase().trim().replace(/ё/g, 'е');
        return q.correctText.split('|').map(clean).includes(clean(answer.text));
      }
    }
  }

  submitTest(test: M.KKSUTest, answers: M.TestAnswer[], userID: string): M.TestAttempt {
    let score = 0;
    for (const q of test.questions) if (KKSUStore.evaluate(q, answers.find((a) => sameId(a.questionID, q.id)))) score += q.points;
    const maxScore = testMaxScore(test);
    const passed = maxScore > 0 && (score / maxScore) * 100 >= test.passingPercent;
    const attempt = makeTestAttempt({ testID: test.id, userID, answers, score, maxScore, passed });
    this.db.attempts.push(attempt);
    this.log(userID, 'Пройден тест', `${test.title}: ${attemptPercent(attempt)}%`, 'checklist');
    this.notify(userID, passed ? 'Тест сдан' : 'Тест не сдан', `${test.title}: ${score} из ${maxScore}`, 'grade');
    this.checkAchievements(userID);
    this.changed();
    return attempt;
  }

  // MARK: - Достижения и сертификаты

  award(userID: string, title: string, icon: string, points: number) {
    if (this.db.achievements.some((a) => sameId(a.userID, userID) && a.title === title)) return;
    this.db.achievements.push(makeAchievement({ userID, title, icon, points }));
    this.notify(userID, 'Новое достижение!', title, 'info');
  }

  checkAchievements(userID: string) {
    const subs = this.db.submissions.filter((s) => sameId(s.studentID, userID));
    const graded = subs.map((s) => s.score).filter((s): s is number => s !== undefined);
    if (subs.length >= 1) this.award(userID, 'Первая сданная работа', 'tray.and.arrow.up.fill', 10);
    if (subs.length >= 10) this.award(userID, '10 сданных работ', 'trophy.fill', 50);
    if (graded.some((g) => g >= 10)) this.award(userID, 'Высший балл', 'star.fill', 30);
    const passed = this.db.attempts.filter((a) => sameId(a.userID, userID) && a.passed);
    if (passed.length >= 1) this.award(userID, 'Первый сданный тест', 'checkmark.seal.fill', 15);
    if (passed.some((a) => attemptPercent(a) === 100)) this.award(userID, 'Тест на 100%', 'rosette', 40);
    if (this.db.projects.some((p) => p.authorIDs.some((id) => sameId(id, userID)) && p.stage === 'result')) {
      this.award(userID, 'Проект доведён до результата', 'flag.checkered', 100);
    }
  }

  issueCertificate(userID: string, title: string, issuer: M.CertificateIssuer, hours?: number): M.Certificate {
    const existing = this.db.certificates.find((c) => sameId(c.userID, userID) && c.title === title && c.issuer === issuer);
    if (existing) return existing;
    const serial = `${new Date().getFullYear()}-${String(this.db.certificates.length + 1).padStart(5, '0')}-${newId().slice(0, 4)}`;
    const cert = makeCertificate({ userID, recipientName: this.userName(userID), title, issuer, serial, hours });
    this.db.certificates.push(cert);
    this.notify(userID, 'Выдан сертификат', `${M.CertificateIssuer.title[issuer]}: ${title}`, 'info');
    this.log(userID, 'Получен сертификат', title, 'doc.badge.ellipsis');
    return cert;
  }

  // MARK: - Teacher Academy

  enrollTeacherCourse(id: string) {
    const user = this.currentUser;
    const i = this.db.teacherCourses.findIndex((c) => sameId(c.id, id));
    if (!user || i < 0) return;
    const c = this.db.teacherCourses[i];
    if (!c.enrolledIDs.some((x) => sameId(x, user.id))) {
      this.db.teacherCourses[i] = { ...c, enrolledIDs: [...c.enrolledIDs, user.id] };
      this.log(user.id, 'Запись на курс повышения квалификации', c.title, 'person.crop.rectangle.stack');
    }
    this.changed();
  }

  toggleModule(module: string, courseID: string) {
    const user = this.currentUser;
    const i = this.db.teacherCourses.findIndex((c) => sameId(c.id, courseID));
    if (!user || i < 0) return;
    const course = this.db.teacherCourses[i];
    const key = Object.keys(course.completedModules).find((k) => sameId(k, user.id)) ?? user.id;
    let done = [...(course.completedModules[key] ?? [])];
    done = done.includes(module) ? done.filter((m) => m !== module) : [...done, module];
    const updated = { ...course, completedModules: { ...course.completedModules, [key]: done } };
    if (course.modules.every((m) => done.includes(m)) && !course.completedIDs.some((x) => sameId(x, user.id))) {
      updated.completedIDs = [...course.completedIDs, user.id];
      this.db.teacherCourses[i] = updated;
      this.issueCertificate(user.id, `Курс «${course.title}»`, 'teacherAcademy', course.hours);
    } else {
      this.db.teacherCourses[i] = updated;
    }
    this.changed();
  }

  // MARK: - Проекты

  advance(projectID: string, note: string) {
    const i = this.db.projects.findIndex((p) => sameId(p.id, projectID));
    if (i < 0) return;
    const next = nextStage(this.db.projects[i].stage);
    if (!next) return;
    const p = this.db.projects[i];
    this.db.projects[i] = { ...p, stage: next, stageHistory: [...p.stageHistory, makeStageChange({ stage: next, date: nowISO(), note })],
      isPrototype: next === 'prototype' || next === 'testing' ? true : p.isPrototype };
    const project = this.db.projects[i];
    for (const author of project.authorIDs) {
      this.notify(author, `Проект перешёл на стадию ${M.ProjectStage.title[next]}`, project.title, 'info');
      this.log(author, `Стадия проекта: ${M.ProjectStage.title[next]}`, project.title, M.ProjectStage.icon[next]);
      this.checkAchievements(author);
    }
    this.changed();
  }

  submitReview(review: M.ExpertReview) {
    this.db.reviews.push(review);
    if (review.target === 'methodology') {
      const i = this.db.methodologies.findIndex((m) => sameId(m.id, review.targetID));
      if (i >= 0) this.db.methodologies[i] = { ...this.db.methodologies[i], status: review.decision === 'approve' ? 'approved' : 'reviewed' };
    } else if (review.target === 'youngInventors') {
      const i = this.db.yiApplications.findIndex((a) => sameId(a.id, review.targetID));
      if (i >= 0) {
        const app = this.db.yiApplications[i];
        const all = this.db.reviews.filter((r) => sameId(r.targetID, app.id));
        const avg = all.map(reviewAverage).reduce((s, x) => s + x, 0) / Math.max(all.length, 1);
        const status: M.YIStatus = review.decision === 'reject' ? 'rejected' : avg >= 8 ? 'finalist' : 'underReview';
        this.db.yiApplications[i] = { ...app, status };
        this.notify(app.applicantID, 'Экспертиза Young Inventors', `Статус заявки: ${M.YIStatus.title[status]}`, 'info');
      }
    } else {
      const project = this.project(review.targetID);
      if (project) for (const a of project.authorIDs) this.notify(a, 'Экспертная оценка проекта', `${project.title}: ${reviewAverage(review).toFixed(1)}/10`, 'info');
    }
    this.changed();
  }

  reviewsFor(targetID: string) { return this.db.reviews.filter((r) => sameId(r.targetID, targetID)); }

  // MARK: - Мероприятия

  registerEvent(eventID: string, role: M.EventRole, talk: string) {
    const user = this.currentUser;
    if (!user || this.db.eventRegistrations.some((r) => sameId(r.eventID, eventID) && sameId(r.userID, user.id))) return;
    this.db.eventRegistrations.push(makeEventRegistration({ eventID, userID: user.id, role, talkTitle: talk }));
    const title = this.db.events.find((e) => sameId(e.id, eventID))?.title ?? '';
    this.notify(user.id, 'Регистрация подтверждена', title, 'event');
    this.log(user.id, 'Регистрация на мероприятие', title, 'calendar.badge.plus');
    this.changed();
  }

  confirmAttendance(registrationID: string) {
    const i = this.db.eventRegistrations.findIndex((r) => sameId(r.id, registrationID));
    if (i < 0) return;
    const reg = { ...this.db.eventRegistrations[i], attended: true };
    const event = this.db.events.find((e) => sameId(e.id, reg.eventID));
    if (event) {
      const cert = this.issueCertificate(reg.userID, `${M.EventRole.title[reg.role]}: «${event.title}»`, 'conference', event.hours);
      reg.certificateID = cert.id;
    }
    this.db.eventRegistrations[i] = reg;
    this.changed();
  }

  // MARK: - Сообщения

  findThread(otherID: string) {
    const me = this.db.currentUserID;
    if (!me) return undefined;
    return this.db.threads.find((t) => t.participantIDs.length === 2 &&
      t.participantIDs.some((p) => sameId(p, me)) && t.participantIDs.some((p) => sameId(p, otherID)));
  }

  thread(otherID: string): M.ChatThread {
    const me = this.db.currentUserID!;
    const existing = this.findThread(otherID);
    if (existing) return existing;
    const t = makeChatThread({ participantIDs: [me, otherID], title: '' });
    this.db.threads.push(t);
    return t;
  }

  send(text: string, threadID: string) {
    const me = this.db.currentUserID;
    if (!me || !text.trim() || containsObjectionable(text)) return;
    const thread = this.db.threads.find((t) => sameId(t.id, threadID));
    if (thread?.participantIDs.some((p) => !sameId(p, me) && this.hasBlocked(p))) return;
    this.db.messages.push(makeChatMessage({ threadID, senderID: me, text, readBy: [me] }));
    if (thread) for (const other of thread.participantIDs.filter((p) => !sameId(p, me))) {
      this.notify(other, `Сообщение от ${this.userName(me)}`, text, 'message');
    }
    this.changed();
  }

  markThreadRead(threadID: string) {
    const me = this.db.currentUserID;
    if (!me) return;
    let changed = false;
    this.db.messages = this.db.messages.map((m) => {
      if (sameId(m.threadID, threadID) && !m.readBy.some((r) => sameId(r, me))) { changed = true; return { ...m, readBy: [...m.readBy, me] }; }
      return m;
    });
    if (changed) this.changed();
  }

  // MARK: - Оплата (как KKSUBillingLogic)

  productById(id?: string | null) { return id ? this.billing.products.find((p) => sameId(p.id, id)) : undefined; }
  productForRef(refID: string) { return this.billing.products.find((p) => p.refID && sameId(p.refID, refID) && p.isActive); }
  productTitled(title: string) { return this.billing.products.find((p) => p.title === title && p.isActive); }
  get enrollmentProduct() { return this.productTitled('Статус ученика KKSU') ?? this.billing.products.find((p) => p.kind === 'enrollment' && p.isActive); }

  priceText(usd: number, showKZT = true) {
    if (usd <= 0) return 'Бесплатно';
    const usdText = Math.round(usd) === usd ? `$${usd}` : `$${usd.toFixed(2)}`;
    if (!showKZT) return usdText;
    return `${usdText} ≈ ${Math.round(usd * this.billing.settings.usdToKzt).toLocaleString('ru-RU')} ₸`;
  }

  amountText(invoice: M.Invoice, currency?: M.PayCurrency) {
    const cur = currency ?? invoice.currency;
    const v = invoiceAmount(invoice, cur, this.billing.settings);
    if (cur === 'KZT') return `${Math.round(v).toLocaleString('ru-RU')} ₸`;
    if (cur === 'USD') return `$${v.toFixed(2)}`;
    return `${v.toFixed(2)} €`;
  }

  activeEntitlements(userID: string) { return this.billing.entitlements.filter((e) => sameId(e.userID, userID) && entitlementActive(e)); }
  activeSubscription(userID: string) {
    return this.activeEntitlements(userID).find((e) => this.productById(e.productID)?.kind === 'subscription');
  }

  hasAccess(userID: string | undefined | null, product?: M.Product | null): boolean {
    if (!product || product.priceUSD <= 0) return true;
    if (!userID) return false;
    if (this.user(userID)?.role === 'admin') return true;
    if (product.sellerID && sameId(product.sellerID, userID)) return true;
    if (this.activeEntitlements(userID).some((e) => sameId(e.productID, product.id))) return true;
    if (coveredBySubscription(product.kind) && this.activeSubscription(userID)) return true;
    return false;
  }

  hasAccessToRef(userID: string | undefined | null, refID: string) { return this.hasAccess(userID, this.productForRef(refID)); }
  isEnrolled(studentID?: string | null) { return this.hasAccess(studentID, this.enrollmentProduct); }

  openInvoice(productID: string, payerID?: string) {
    return [...this.billing.invoices].reverse().find((i) => sameId(i.productID, productID) && sameId(i.payerID, payerID) &&
      (i.status === 'awaitingPayment' || i.status === 'pendingConfirmation'));
  }

  validatePromo(code: string, product: M.Product) {
    const n = code.trim().toUpperCase();
    if (!n) return undefined;
    return this.billing.promoCodes.find((p) => p.code.toUpperCase() === n && promoValid(p, product));
  }

  private invoiceNumber() {
    // Номер — код для комментария к переводу; случайная часть исключает совпадения между устройствами.
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `KKSU-${new Date().getFullYear()}-W${rand}`;
  }

  createInvoice(product: M.Product, beneficiaries: string[], promo: string, method: M.PaymentMethod, currency: M.PayCurrency, targetID?: string, note = ''): M.Invoice {
    const payer = this.currentUser;
    if (!payer || beneficiaries.length === 0) throw new Error(BillingErrors.noBeneficiary);
    if (product.familySeats > 0 && beneficiaries.filter((b) => !sameId(b, payer.id)).length > product.familySeats) {
      throw new Error(BillingErrors.tooManyChildren(product.familySeats));
    }
    if (product.kind !== 'marketplaceListing' && product.durationDays === undefined && beneficiaries.every((b) => this.hasAccess(b, product))) {
      throw new Error(BillingErrors.alreadyOwned);
    }
    let discount = 0;
    let promoCode: string | undefined;
    if (promo.trim()) {
      const code = this.validatePromo(promo, product);
      if (!code) throw new Error(BillingErrors.invalidPromo);
      discount = promoDiscount(code, product.priceUSD);
      promoCode = code.code;
    }
    this.billing.invoiceCounter += 1;
    const invoice = makeInvoice({
      number: this.invoiceNumber(), payerID: payer.id, beneficiaryIDs: beneficiaries, productID: product.id,
      productTitle: product.title, productKind: product.kind, targetID, priceUSD: product.priceUSD, discountUSD: discount,
      promoCode, currency, rate: this.billing.settings.usdToKzt, method, payerNote: note,
    });
    if (invoiceTotal(invoice) <= 0) {
      invoice.status = 'paid';
      invoice.paidAt = nowISO();
      this.billing.invoices.push(invoice);
      if (promoCode) this.incrementPromo(promoCode);
      this.fulfill(invoice);
    } else {
      this.billing.invoices.push(invoice);
      this.log(payer.id, 'Выставлен счёт', `${invoice.number}: ${product.title}`, 'doc.text');
    }
    this.changed();
    return invoice;
  }

  private incrementPromo(code: string) {
    const i = this.billing.promoCodes.findIndex((p) => p.code === code);
    if (i >= 0) this.billing.promoCodes[i] = { ...this.billing.promoCodes[i], uses: this.billing.promoCodes[i].uses + 1 };
  }

  private updateInvoice(id: string, patch: Partial<M.Invoice>): M.Invoice | undefined {
    const i = this.billing.invoices.findIndex((x) => sameId(x.id, id));
    if (i < 0) return undefined;
    this.billing.invoices[i] = { ...this.billing.invoices[i], ...patch };
    return this.billing.invoices[i];
  }

  reportPayment(invoiceID: string, receipt: M.Attachment | undefined, note: string, method: M.PaymentMethod) {
    const current = this.billing.invoices.find((x) => sameId(x.id, invoiceID));
    if (!current) return;
    const invoice = this.updateInvoice(invoiceID, { status: 'pendingConfirmation', receipt, method, payerNote: note || current.payerNote })!;
    for (const admin of this.users('admin')) {
      this.notify(admin.id, 'Поступила оплата на проверку', `${invoice.number} · ${this.amountText(invoice)} · ${M.PaymentMethod.title[invoice.method]}`, 'system');
    }
    this.notify(invoice.payerID, 'Оплата отправлена на проверку', `Счёт ${invoice.number}. Доступ откроется после подтверждения.`, 'info');
    this.changed();
  }

  cancelInvoice(invoiceID: string) {
    const inv = this.billing.invoices.find((x) => sameId(x.id, invoiceID));
    if (!inv || (inv.status !== 'awaitingPayment' && inv.status !== 'pendingConfirmation')) return;
    this.updateInvoice(invoiceID, { status: 'cancelled' });
    this.log(inv.payerID, 'Счёт отменён', inv.number, 'xmark.circle');
    this.changed();
  }

  confirmPayment(invoiceID: string) {
    const inv = this.billing.invoices.find((x) => sameId(x.id, invoiceID));
    if (!inv || inv.status === 'paid' || inv.status === 'refunded') return;
    const invoice = this.updateInvoice(invoiceID, { status: 'paid', paidAt: nowISO(), confirmedBy: this.db.currentUserID })!;
    if (invoice.promoCode) this.incrementPromo(invoice.promoCode);
    this.fulfill(invoice);
    this.changed();
  }

  rejectPayment(invoiceID: string, reason: string) {
    const invoice = this.updateInvoice(invoiceID, { status: 'rejected' });
    if (!invoice) return;
    this.notify(invoice.payerID, 'Платёж не найден', `Счёт ${invoice.number}: ${reason}. Напишите администратору в чат.`, 'system');
    this.changed();
  }

  /** Выдаёт доступ по оплаченному счёту и выполняет действие продукта. */
  private fulfill(invoice: M.Invoice) {
    const product = this.productById(invoice.productID);
    if (!product) return;
    const expires = product.durationDays !== undefined ? isoIn(product.durationDays * 86400) : undefined;
    for (const userID of invoice.beneficiaryIDs) {
      this.billing.entitlements.push(makeEntitlement({ userID, productID: product.id, source: product.kind === 'subscription' ? 'subscription' : 'payment',
        expiresAt: expires, invoiceID: invoice.id }));
      this.notify(userID, 'Доступ открыт', `«${product.title}» — оплата подтверждена.`, 'info');
      this.log(userID, 'Открыт доступ после оплаты', product.title, 'lock.open.fill');
    }
    if (!sameId(invoice.payerID, invoice.beneficiaryIDs[0])) {
      this.notify(invoice.payerID, 'Оплата подтверждена', `Счёт ${invoice.number}: ${product.title}`, 'info');
    }
    const addTo = (ids: string[]) => [...ids, ...invoice.beneficiaryIDs.filter((b) => !ids.some((x) => sameId(x, b)))];
    switch (product.kind) {
      case 'marketplaceListing': {
        const c = this.billing.marketplaceCourses.findIndex((x) => invoice.targetID && sameId(x.id, invoice.targetID));
        if (c >= 0) {
          this.billing.marketplaceCourses[c] = { ...this.billing.marketplaceCourses[c], status: 'published' };
          const course = this.billing.marketplaceCourses[c];
          if (!this.billing.products.some((p) => p.refID && sameId(p.refID, course.id))) {
            this.billing.products.push(makeProduct({ title: course.title, kind: 'marketplaceCourse', priceUSD: course.priceUSD, summary: course.summary, refID: course.id, sellerID: course.teacherID }));
          }
          this.notify(course.teacherID, 'Курс опубликован в Marketplace', course.title, 'info');
        }
        break;
      }
      case 'enrollment':
        for (const u of invoice.beneficiaryIDs) if (!this.profile(u) && this.user(u)?.role === 'student') this.db.studentProfiles.push(makeStudentProfile({ userID: u }));
        break;
      case 'globalClassroom': {
        const g = this.db.globalClasses.findIndex((x) => product.refID && sameId(x.id, product.refID));
        if (g >= 0) this.db.globalClasses[g] = { ...this.db.globalClasses[g], participantIDs: addTo(this.db.globalClasses[g].participantIDs) };
        break;
      }
      case 'futureEngineers': {
        const e = this.db.engineeringCourses.findIndex((x) => product.refID && sameId(x.id, product.refID));
        if (e >= 0) this.db.engineeringCourses[e] = { ...this.db.engineeringCourses[e], enrolledIDs: addTo(this.db.engineeringCourses[e].enrolledIDs) };
        break;
      }
      case 'teacherAcademy': {
        const t = this.db.teacherCourses.findIndex((x) => product.refID && sameId(x.id, product.refID));
        if (t >= 0) this.db.teacherCourses[t] = { ...this.db.teacherCourses[t], enrolledIDs: addTo(this.db.teacherCourses[t].enrolledIDs) };
        break;
      }
      default: break;
    }
  }

  canRequestRefund(invoice: M.Invoice) {
    if (invoice.status !== 'paid' || !invoice.paidAt) return false;
    return Date.now() - time(invoice.paidAt) <= this.billing.settings.refundDays * 86400000;
  }

  requestRefund(invoiceID: string, reason: string) {
    const inv = this.billing.invoices.find((x) => sameId(x.id, invoiceID));
    if (!inv) return;
    if (!this.canRequestRefund(inv)) throw new Error(BillingErrors.refundExpired);
    const invoice = this.updateInvoice(invoiceID, { status: 'refundRequested', refundReason: reason })!;
    for (const admin of this.users('admin')) this.notify(admin.id, 'Запрос на возврат', `${invoice.number} · ${this.amountText(invoice)}: ${reason}`, 'system');
    this.changed();
  }

  refund(invoiceID: string, reason: string) {
    const inv = this.billing.invoices.find((x) => sameId(x.id, invoiceID));
    if (!inv) return;
    const invoice = this.updateInvoice(invoiceID, { status: 'refunded', refundedAt: nowISO(), refundReason: reason || inv.refundReason })!;
    this.billing.entitlements = this.billing.entitlements.map((e) => (e.invoiceID && sameId(e.invoiceID, invoiceID) ? { ...e, revoked: true } : e));
    this.notify(invoice.payerID, 'Возврат оформлен', `${invoice.number}: ${this.amountText(invoice)} будет возвращено на ${M.PaymentMethod.title[invoice.method]}.`, 'info');
    this.changed();
  }

  grantScholarship(userID: string, product: M.Product, days: number | undefined, note: string) {
    this.billing.entitlements.push(makeEntitlement({ userID, productID: product.id, source: 'scholarship',
      expiresAt: days !== undefined ? isoIn(days * 86400) : undefined, grantedBy: this.db.currentUserID, note }));
    this.notify(userID, 'Вам выдан бесплатный доступ', `«${product.title}». ${note}`, 'info');
    this.log(userID, 'Стипендия / бесплатный доступ', product.title, 'gift.fill');
    this.changed();
  }

  revokeEntitlement(id: string) {
    this.billing.entitlements = this.billing.entitlements.map((e) => (sameId(e.id, id) ? { ...e, revoked: true } : e));
    this.changed();
  }

  get paidInvoices() { return this.billing.invoices.filter((i) => i.status === 'paid'); }
  revenueUSD(list?: M.Invoice[]) { return (list ?? this.paidInvoices).reduce((s, i) => s + invoiceTotal(i), 0); }
  get refundedUSD() { return this.billing.invoices.filter((i) => i.status === 'refunded').reduce((s, i) => s + invoiceTotal(i), 0); }

  salesByKind() {
    return M.ProductKind.values.map((kind) => {
      const items = this.paidInvoices.filter((i) => i.productKind === kind);
      return { kind, usd: this.revenueUSD(items), count: items.length };
    }).filter((x) => x.count > 0).sort((a, b) => b.usd - a.usd);
  }

  salesByProduct() {
    const map = new Map<string, M.Invoice[]>();
    for (const i of this.paidInvoices) map.set(i.productTitle, [...(map.get(i.productTitle) ?? []), i]);
    return [...map.entries()].map(([title, items]) => ({ title, usd: this.revenueUSD(items), count: items.length })).sort((a, b) => b.usd - a.usd);
  }

  salesByTeacher() {
    const map = new Map<string, { usd: number; count: number }>();
    for (const inv of this.paidInvoices) {
      const seller = this.productById(inv.productID)?.sellerID;
      if (!seller) continue;
      const cur = map.get(seller) ?? { usd: 0, count: 0 };
      map.set(seller, { usd: cur.usd + invoiceTotal(inv), count: cur.count + 1 });
    }
    return [...map.entries()].map(([teacherID, v]) => ({ teacherID, ...v })).sort((a, b) => b.usd - a.usd);
  }

  monthlyRevenue(months = 6) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const result: { month: Date; usd: number }[] = [];
    for (let offset = months - 1; offset >= 0; offset--) {
      const month = new Date(start.getFullYear(), start.getMonth() - offset, 1);
      const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const items = this.paidInvoices.filter((i) => { const t = time(i.paidAt ?? i.createdAt); return t >= month.getTime() && t < next.getTime(); });
      result.push({ month, usd: this.revenueUSD(items) });
    }
    return result;
  }

  salesByMethod() {
    return M.PaymentMethod.values.map((method) => ({ method, usd: this.revenueUSD(this.paidInvoices.filter((i) => i.method === method)) }))
      .filter((x) => x.usd > 0);
  }

  // MARK: - Курсы педагогов (как KKSUCourseLogic)

  course(id?: string | null) { return id ? this.db.schoolCourses.find((c) => sameId(c.id, id)) : undefined; }

  coursesFor(studentID: string) {
    return this.db.schoolCourses.filter((c) => c.isPublished && (c.studentIDs.length === 0 || c.studentIDs.some((s) => sameId(s, studentID))))
      .sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }

  get myTeachingCourses() {
    const me = this.db.currentUserID;
    return this.db.schoolCourses.filter((c) => this.role === 'admin' || sameId(c.teacherID, me)).sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }

  courseStudents(course: M.SchoolCourse) {
    return course.studentIDs.length === 0 ? this.students : this.students.filter((s) => course.studentIDs.some((id) => sameId(id, s.id)));
  }

  isLessonCompleted(lessonID: string, studentID: string) {
    return this.db.lessonProgress.some((p) => sameId(p.lessonID, lessonID) && sameId(p.studentID, studentID));
  }

  courseProgress(course: M.SchoolCourse, studentID: string) {
    const lessons = publishedLessons(course);
    if (lessons.length === 0) return 0;
    return lessons.filter((l) => this.isLessonCompleted(l.id, studentID)).length / lessons.length;
  }

  updateCourse(id: string, patch: Partial<M.SchoolCourse> | ((c: M.SchoolCourse) => M.SchoolCourse)) {
    const i = this.db.schoolCourses.findIndex((c) => sameId(c.id, id));
    if (i < 0) return;
    this.db.schoolCourses[i] = typeof patch === 'function' ? patch(this.db.schoolCourses[i]) : { ...this.db.schoolCourses[i], ...patch };
    this.changed();
  }

  updateLesson(courseID: string, lessonID: string, patch: Partial<M.CourseLesson>) {
    this.updateCourse(courseID, (c) => ({ ...c, lessons: c.lessons.map((l) => (sameId(l.id, lessonID) ? { ...l, ...patch } : l)) }));
  }

  toggleLessonCompleted(courseID: string, lessonID: string, studentID: string) {
    const i = this.db.lessonProgress.findIndex((p) => sameId(p.lessonID, lessonID) && sameId(p.studentID, studentID));
    if (i >= 0) { this.db.lessonProgress.splice(i, 1); this.changed(); return; }
    this.db.lessonProgress.push(makeLessonProgress({ courseID, lessonID, studentID }));
    const course = this.course(courseID);
    if (course) {
      const title = course.lessons.find((l) => sameId(l.id, lessonID))?.title ?? '';
      this.log(studentID, 'Пройден урок', `${course.title}: ${title}`, 'checkmark.circle');
      if (this.courseProgress(course, studentID) >= 1) {
        this.issueCertificate(studentID, `Курс «${course.title}» пройден`, 'school', publishedLessons(course).length);
        this.award(studentID, `Курс пройден: ${course.title}`, 'graduationcap.fill', 50);
        if (course.teacherID) this.notify(course.teacherID, 'Ученик прошёл курс', `${this.userName(studentID)} — «${course.title}»`, 'info');
      }
    }
    this.changed();
  }

  publishCourse(courseID: string) {
    const i = this.db.schoolCourses.findIndex((c) => sameId(c.id, courseID));
    if (i < 0) return;
    this.db.schoolCourses[i] = { ...this.db.schoolCourses[i], isPublished: true };
    const course = this.db.schoolCourses[i];
    for (const s of this.courseStudents(course)) this.notify(s.id, `Новый курс: ${course.title}`, `${course.subject} · уроков: ${publishedLessons(course).length}`, 'info');
    this.changed();
  }

  scheduleLiveLesson(courseID: string, lessonID: string) {
    const course = this.course(courseID);
    const lesson = course?.lessons.find((l) => sameId(l.id, lessonID));
    if (!course || !lesson?.liveStart) return;
    const participants = this.courseStudents(course).map((s) => s.id);
    const existing = lesson.sessionID ? this.db.sessions.find((s) => sameId(s.id, lesson.sessionID)) : undefined;
    const session: M.ScheduleSession = {
      ...(existing ?? makeScheduleSession({ title: lesson.title, subject: course.subject, start: lesson.liveStart })),
      title: lesson.title, subject: course.subject, teacherID: course.teacherID ?? this.db.currentUserID, start: lesson.liveStart,
      durationMinutes: lesson.liveDurationMinutes, isOnline: true, platform: lesson.livePlatform,
      meetingURL: lessonJoinURL(lesson) ?? '', participantIDs: participants, recordingURL: lesson.videoURL,
    };
    const si = this.db.sessions.findIndex((s) => sameId(s.id, session.id));
    if (si >= 0) {
      this.db.sessions[si] = session;
      this.changed();
    } else {
      this.db.sessions.push(session);
      for (const s of participants) this.notify(s, `Онлайн-урок: ${lesson.title}`, `${course.title} · ${fmtDateTime(lesson.liveStart)}`, 'event');
      this.updateLesson(courseID, lessonID, { sessionID: session.id });
    }
  }

  askTeacher(course: M.SchoolCourse, lesson: M.CourseLesson, question: string) {
    if (!course.teacherID || !question.trim()) return;
    const t = this.thread(course.teacherID);
    this.send(`Вопрос по уроку «${lesson.title}» (${course.title}):\n${question}`, t.id);
  }

  // MARK: - Блокировки и жалобы (как KKSUModeration)

  get blockedUserIDs(): string[] {
    const me = this.db.currentUserID;
    if (!me) return [];
    return this.db.userBlocks.filter((b) => sameId(b.blockerID, me)).map((b) => b.blockedID);
  }
  hasBlocked(userID?: string | null) { return !!userID && this.blockedUserIDs.some((id) => sameId(id, userID)); }

  blockUser(userID: string) {
    const me = this.db.currentUserID;
    if (!me || sameId(me, userID) || this.hasBlocked(userID)) return;
    this.db.userBlocks.push(makeUserBlock({ blockerID: me, blockedID: userID }));
    this.log(me, 'Пользователь заблокирован', this.userName(userID), 'hand.raised.slash');
    this.changed();
  }

  unblockUser(userID: string) {
    const me = this.db.currentUserID;
    if (!me) return;
    this.db.userBlocks = this.db.userBlocks.filter((b) => !(sameId(b.blockerID, me) && sameId(b.blockedID, userID)));
    this.changed();
  }

  report(kind: M.ReportedContentKind, contentID: string | undefined, reportedUserID: string | undefined, excerpt: string,
    reason: M.ReportReason, comment: string, alsoBlock: boolean) {
    const me = this.db.currentUserID;
    if (!me) return;
    const report = makeContentReport({ reporterID: me, reportedUserID, kind, contentID, excerpt: excerpt.slice(0, 500), reason, comment });
    this.db.contentReports.push(report);
    if (alsoBlock && reportedUserID) this.blockUser(reportedUserID);
    for (const admin of this.db.users.filter((u) => u.role === 'admin' && !u.isBlocked)) {
      this.notify(admin.id, `Новая жалоба: ${M.ReportReason.title[reason]}`, `${M.ReportedContentKind.title[kind]}: ${report.excerpt.slice(0, 80)}`, 'system');
    }
    this.changed();
  }

  isReportedByMe(contentID: string) {
    const me = this.db.currentUserID;
    return !!me && this.db.contentReports.some((r) => sameId(r.reporterID, me) && r.contentID && sameId(r.contentID, contentID) && r.status !== 'dismissed');
  }

  get openReports() { return this.db.contentReports.filter((r) => r.status === 'open').sort((a, b) => time(b.createdAt) - time(a.createdAt)); }

  removeReportedContent(reportID: string) {
    const report = this.db.contentReports.find((r) => sameId(r.id, reportID));
    if (!report) return;
    if (report.contentID) {
      const cid = report.contentID;
      if (report.kind === 'message') this.db.messages = this.db.messages.filter((m) => !sameId(m.id, cid));
      if (report.kind === 'project') this.db.projects = this.db.projects.map((p) => (sameId(p.id, cid) ? { ...p, showInExhibition: false } : p));
      if (report.kind === 'lesson') this.db.schoolCourses = this.db.schoolCourses.map((c) => ({ ...c, lessons: c.lessons.map((l) => (sameId(l.id, cid) ? { ...l, isPublished: false } : l)) }));
    }
    this.closeReport(reportID, 'resolved', 'Контент удалён модератором');
  }

  async banReportedUser(reportID: string) {
    const report = this.db.contentReports.find((r) => sameId(r.id, reportID));
    if (!report?.reportedUserID) return;
    const uid = report.reportedUserID;
    try { await cloud.updateMember(uid, { blocked: true }); } catch { /* блокировка отразится локально */ }
    this.db.users = this.db.users.map((u) => (sameId(u.id, uid) ? { ...u, isBlocked: true } : u));
    if (report.contentID) this.db.messages = this.db.messages.filter((m) => !(sameId(m.senderID, uid) && sameId(m.id, report.contentID)));
    this.closeReport(reportID, 'resolved', 'Пользователь заблокирован модератором');
  }

  closeReport(reportID: string, status: M.ReportStatus, resolution: string) {
    const i = this.db.contentReports.findIndex((r) => sameId(r.id, reportID));
    if (i < 0) return;
    this.db.contentReports[i] = { ...this.db.contentReports[i], status, resolution, resolvedAt: nowISO() };
    this.notify(this.db.contentReports[i].reporterID, 'Жалоба рассмотрена', status === 'dismissed' ? 'Нарушений не найдено.' : resolution, 'system');
    this.changed();
  }

  // MARK: - Мои данные

  exportData(userID: string): string {
    const user = this.user(userID);
    const own = <T,>(list: T[], pick: (x: T) => string | undefined) => list.filter((x) => sameId(pick(x), userID));
    return JSON.stringify({
      exportedAt: toISO(new Date()),
      user: user && { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, createdAt: user.createdAt },
      profile: this.profile(userID),
      questionnaires: own(this.db.questionnaires, (x) => x.studentID),
      consents: this.db.consents.filter((c) => sameId(c.studentID, userID) || sameId(c.parentID, userID)),
      submissions: own(this.db.submissions, (x) => x.studentID),
      attempts: own(this.db.attempts, (x) => x.userID),
      portfolio: own(this.db.portfolio, (x) => x.studentID),
      achievements: own(this.db.achievements, (x) => x.userID),
      certificates: own(this.db.certificates, (x) => x.userID),
      messages: own(this.db.messages, (x) => x.senderID),
      history: own(this.db.history, (x) => x.userID),
      projects: this.db.projects.filter((p) => p.authorIDs.some((a) => sameId(a, userID))),
      invoices: this.billing.invoices.filter((i) => sameId(i.payerID, userID) || i.beneficiaryIDs.some((b) => sameId(b, userID))),
      entitlements: own(this.billing.entitlements, (x) => x.userID),
    }, null, 2);
  }

  /** Родитель удаляет данные ребёнка (аккаунт ребёнка на сервере удаляет сам ребёнок или администратор). */
  deleteChildData(userID: string) {
    const not = (id?: string) => !sameId(id, userID);
    this.db.studentProfiles = this.db.studentProfiles.filter((x) => not(x.userID));
    this.db.questionnaires = this.db.questionnaires.filter((x) => not(x.studentID));
    this.db.trajectory = this.db.trajectory.filter((x) => not(x.studentID));
    this.db.studyPlan = this.db.studyPlan.filter((x) => not(x.studentID));
    this.db.submissions = this.db.submissions.filter((x) => not(x.studentID));
    this.db.portfolio = this.db.portfolio.filter((x) => not(x.studentID));
    this.db.achievements = this.db.achievements.filter((x) => not(x.userID));
    this.db.history = this.db.history.filter((x) => not(x.userID));
    this.db.attempts = this.db.attempts.filter((x) => not(x.userID));
    this.db.users = this.db.users.map((u) => ({ ...u, linkedStudentIDs: u.linkedStudentIDs.filter((id) => not(id)) }));
    this.changed();
  }

  // MARK: - Общие правки коллекций

  /** Добавить запись в коллекцию базы и сохранить. */
  add<K extends ListKey>(key: K, item: ItemOf<K>) {
    (this.db[key] as unknown as unknown[]).push(item);
    this.changed();
  }

  /** Изменить запись по id. */
  update<K extends ListKey>(key: K, id: string, patch: Partial<ItemOf<K>> | ((item: ItemOf<K>) => ItemOf<K>)) {
    const list = this.db[key] as unknown as ItemOf<K>[];
    const i = list.findIndex((x) => sameId((x as { id: string }).id, id));
    if (i < 0) return;
    list[i] = typeof patch === 'function' ? patch(list[i]) : ({ ...(list[i] as object), ...(patch as object) } as ItemOf<K>);
    this.changed();
  }

  remove<K extends ListKey>(key: K, id: string) {
    (this.db as unknown as Record<string, { id: string }[]>)[key as string] =
      (this.db[key] as unknown as { id: string }[]).filter((x) => !sameId(x.id, id));
    this.changed();
  }

  addBilling<K extends 'products' | 'promoCodes' | 'invoices' | 'entitlements' | 'marketplaceCourses'>(key: K, item: KKSUBillingDatabase[K][number]) {
    (this.billing[key] as unknown[]).push(item);
    this.changed();
  }

  updateBilling<K extends 'products' | 'promoCodes' | 'invoices' | 'entitlements' | 'marketplaceCourses'>(key: K, id: string, patch: Partial<KKSUBillingDatabase[K][number]>) {
    const list = this.billing[key] as { id: string }[];
    const i = list.findIndex((x) => sameId(x.id, id));
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    this.changed();
  }

  updateSettings(patch: Partial<M.PaymentSettings>) {
    this.billing.settings = { ...this.billing.settings, ...patch };
    this.changed();
  }

  fmtShort = fmtShort;
  fmtDateTime = fmtDateTime;
  newAssignment = makeAssignment;
  isStaff = () => KKSURoleExtra.isStaff(this.role);
}

export const store = new KKSUStore();
