// Какие данные синхронизируются с сервером и кому видна каждая запись — копия KKSUCloudSync.swift.
// visible_to: список пользователей, которым видна запись (сотрудники школы видят всё);
// пустой список — запись видна всей школе; STAFF_ONLY — только сотрудникам.
import type { KKSUBillingDatabase, KKSUDatabase } from './db';
import { normalize } from './codable';
import type { KKSUUser, AccessibilitySettings, LearningPreferences } from './models.gen';
import { sameId } from './ids';

export const STAFF_ONLY = ['00000000-0000-0000-0000-000000000000'];
export const BILLING_SETTINGS_ID = '00000000-0000-0000-0000-0000000B1111';

/** Коллекции, которые на сервере может менять только персонал (kksu_is_staff_only в schema.sql). */
export const STAFF_ONLY_COLLECTIONS = new Set(['entitlements', 'products', 'promoCodes', 'billingSettings', 'programs', 'partners', 'internships', 'events']);

export interface SyncState {
  db: KKSUDatabase;
  billing: KKSUBillingDatabase;
  currentUserID?: string;
}

export interface CloudRecord { collection: string; id: string; visibleTo: string[]; data: unknown }
export interface PulledRow { collection: string; id: string; data: unknown | null; deleted: boolean }

const uniq = (ids: string[]) => Array.from(new Set(ids.map((x) => x.toUpperCase())));

/** Ученик, его родители и наставники. */
export function audience(studentID: string | undefined, s: SyncState): string[] {
  if (!studentID) return STAFF_ONLY;
  const guardians = s.db.users
    .filter((u) => (u.role === 'parent' || u.role === 'mentor') && u.linkedStudentIDs.some((id) => sameId(id, studentID)))
    .map((u) => u.id);
  return [studentID, ...guardians];
}

export function audienceOf(ids: string[], s: SyncState): string[] {
  const all = ids.flatMap((id) => audience(id, s));
  return all.length === 0 ? STAFF_ONLY : uniq(all);
}

function projectAudience(projectID: string, s: SyncState): string[] {
  const project = s.db.projects.find((p) => sameId(p.id, projectID));
  if (!project) return STAFF_ONLY;
  return audienceOf([...project.authorIDs, ...(project.mentorID ? [project.mentorID] : [])], s);
}

interface Collection {
  name: string;
  encode: (s: SyncState) => CloudRecord[];
  apply: (s: SyncState, rows: PulledRow[]) => void;
}

type Item = { id: string };

function applyRows<T extends Item>(items: T[], rows: PulledRow[], merge?: (local: T | undefined, remote: T) => T): T[] {
  const out = items.slice();
  for (const row of rows) {
    const index = out.findIndex((x) => sameId(x.id, row.id));
    if (row.deleted) {
      if (index >= 0) out.splice(index, 1);
    } else if (row.data) {
      const remote = row.data as T;
      const value = merge ? merge(index >= 0 ? out[index] : undefined, remote) : remote;
      if (index >= 0) out[index] = value; else out.push(value);
    }
  }
  return out;
}

function list<K extends keyof KKSUDatabase>(
  name: string, key: K, type: string,
  visible: (item: KKSUDatabase[K] extends (infer T)[] ? T : never, s: SyncState) => string[],
  prepare?: (item: any, s: SyncState) => any,
  merge?: (local: any, remote: any) => any,
): Collection {
  return {
    name,
    encode: (s) => (s.db[key] as unknown as Item[]).map((item) => ({
      collection: name, id: item.id,
      visibleTo: visible(item as never, s),
      data: normalize(type, prepare ? prepare(item, s) : item),
    })),
    apply: (s, rows) => {
      (s.db as any)[key] = applyRows(s.db[key] as unknown as Item[], rows, merge);
    },
  };
}

function billingList<K extends 'products' | 'promoCodes' | 'invoices' | 'entitlements' | 'marketplaceCourses'>(
  name: string, key: K, type: string, visible: (item: KKSUBillingDatabase[K][number], s: SyncState) => string[],
): Collection {
  return {
    name,
    encode: (s) => (s.billing[key] as Item[]).map((item) => ({
      collection: name, id: item.id, visibleTo: visible(item as never, s), data: normalize(type, item),
    })),
    apply: (s, rows) => { (s.billing as any)[key] = applyRows(s.billing[key] as Item[], rows); },
  };
}

const none = () => [] as string[];

export const COLLECTIONS: Collection[] = [
  // Каталог пользователей: имена и роли. Email и телефон чужих пользователей и пароли на сервер не попадают.
  list('users', 'users', 'KKSUUser', none, (user: KKSUUser, s) => {
    const copy = { ...user, passwordHash: '', salt: '', recoveryCode: undefined, recoveryExpires: undefined };
    if (!sameId(user.id, s.currentUserID)) { copy.email = ''; copy.phone = ''; }
    return copy;
  }, (local: KKSUUser | undefined, remote: KKSUUser) => {
    if (!local) return remote;
    return { ...remote, email: remote.email || local.email, phone: remote.phone || local.phone,
             passwordHash: local.passwordHash, salt: local.salt };
  }),
  list('studentProfiles', 'studentProfiles', 'StudentProfile', (i, s) => audience(i.userID, s)),
  list('questionnaires', 'questionnaires', 'IntakeQuestionnaire', (i, s) => audience(i.studentID, s)),
  list('applications', 'applications', 'EnrollmentApplication', (i) => (i.applicantUserID ? [i.applicantUserID] : STAFF_ONLY)),
  list('consents', 'consents', 'ParentConsent', (i, s) => uniq([...audience(i.studentID, s), i.parentID])),
  list('programs', 'programs', 'EducationProgram', none),
  list('trajectory', 'trajectory', 'TrajectoryStep', (i, s) => audience(i.studentID, s)),
  list('studyPlan', 'studyPlan', 'StudyPlanItem', (i, s) => audience(i.studentID, s)),
  list('sessions', 'sessions', 'ScheduleSession', none),
  list('calendarNotes', 'calendarNotes', 'CalendarNote', (i) => [i.userID]),
  list('assignments', 'assignments', 'Assignment', (i, s) => {
    if (!i.approvedByTeacher) return STAFF_ONLY;
    if (i.audience === 'teachers' || i.assignedIDs.length === 0) return [];
    return audienceOf(i.assignedIDs, s);
  }),
  list('submissions', 'submissions', 'Submission', (i, s) => audience(i.studentID, s)),
  list('portfolio', 'portfolio', 'PortfolioItem', (i, s) => audience(i.studentID, s)),
  list('achievements', 'achievements', 'Achievement', (i, s) => audience(i.userID, s)),
  list('certificates', 'certificates', 'Certificate', (i, s) => audience(i.userID, s)),
  list('history', 'history', 'HistoryEntry', (i, s) => audience(i.userID, s)),
  list('library', 'library', 'LibraryItem', none),
  list('tests', 'tests', 'KKSUTest', none),
  list('attempts', 'attempts', 'TestAttempt', (i, s) => audience(i.userID, s)),
  list('threads', 'threads', 'ChatThread', (i) => i.participantIDs),
  list('messages', 'messages', 'ChatMessage', (i, s) =>
    s.db.threads.find((t) => sameId(t.id, i.threadID))?.participantIDs ?? [i.senderID]),
  list('notifications', 'notifications', 'KKSUNotification', (i) => [i.userID]),
  list('academyProfiles', 'academyProfiles', 'TeacherAcademyProfile', (i) => [i.userID]),
  list('teacherCourses', 'teacherCourses', 'TeacherCourse', none),
  list('methodologies', 'methodologies', 'Methodology', none),
  list('pilots', 'pilots', 'MethodologyPilot', none),
  list('reviews', 'reviews', 'ExpertReview', (i, s) => {
    if (i.target !== 'youngInventors') return [];
    const app = s.db.yiApplications.find((a) => sameId(a.id, i.targetID));
    return app ? audience(app.applicantID, s) : [];
  }),
  list('projects', 'projects', 'InventionProject', (i, s) =>
    i.showInExhibition ? [] : audienceOf([...i.authorIDs, ...(i.mentorID ? [i.mentorID] : [])], s)),
  list('teams', 'teams', 'ProjectTeam', none),
  list('experiments', 'experiments', 'ExperimentEntry', (i, s) => projectAudience(i.projectID, s)),
  list('notebook', 'notebook', 'LabNotebookPage', (i, s) => projectAudience(i.projectID, s)),
  list('yiApplications', 'yiApplications', 'YoungInventorsApplication', (i, s) => audience(i.applicantID, s)),
  list('globalClasses', 'globalClasses', 'GlobalClass', none),
  list('internationalProjects', 'internationalProjects', 'InternationalProject', none),
  list('internationalExperts', 'internationalExperts', 'InternationalExpert', none),
  list('engineeringCourses', 'engineeringCourses', 'EngineeringCourse', none),
  list('challenges', 'challenges', 'EngineeringChallenge', none),
  list('partners', 'partners', 'Partner', none),
  list('internships', 'internships', 'Internship', none),
  list('internshipApplications', 'internshipApplications', 'InternshipApplication', (i, s) => {
    const partnerID = s.db.internships.find((x) => sameId(x.id, i.internshipID))?.partnerID;
    const partnerUsers = s.db.users.filter((u) => u.role === 'partner' && u.partnerID && sameId(u.partnerID, partnerID)).map((u) => u.id);
    return uniq([...audience(i.studentID, s), ...partnerUsers]);
  }),
  list('events', 'events', 'KKSUEvent', none),
  list('eventRegistrations', 'eventRegistrations', 'EventRegistration', (i) => [i.userID]),
  // Курсы педагогов: черновик видят только сотрудники, опубликованный — выбранные ученики или все.
  list('schoolCourses', 'schoolCourses', 'SchoolCourse', (i, s) => {
    if (!i.isPublished) return STAFF_ONLY;
    return i.studentIDs.length === 0 ? [] : audienceOf(i.studentIDs, s);
  }),
  list('lessonProgress', 'lessonProgress', 'LessonProgress', (i, s) => audience(i.studentID, s)),
  // Жалобы видят автор жалобы и сотрудники; блокировки — только тот, кто заблокировал.
  list('contentReports', 'contentReports', 'ContentReport', (i) => [i.reporterID]),
  list('userBlocks', 'userBlocks', 'UserBlock', (i) => [i.blockerID]),
  // Оплата
  billingList('products', 'products', 'Product', none),
  billingList('promoCodes', 'promoCodes', 'PromoCode', none),
  billingList('invoices', 'invoices', 'Invoice', (i, s) => audienceOf([i.payerID, ...i.beneficiaryIDs], s)),
  billingList('entitlements', 'entitlements', 'Entitlement', (i, s) => audience(i.userID, s)),
  billingList('marketplaceCourses', 'marketplaceCourses', 'MarketplaceCourse', none),
  {
    name: 'billingSettings',
    encode: (s) => [{ collection: 'billingSettings', id: BILLING_SETTINGS_ID, visibleTo: [], data: normalize('PaymentSettings', s.billing.settings) }],
    apply: (s, rows) => {
      const last = rows[rows.length - 1];
      if (last?.data) s.billing.settings = { ...s.billing.settings, ...(last.data as object) };
    },
  },
  // Личные настройки доступности и обучения — видны только владельцу.
  {
    name: 'userSettings',
    encode: (s) => {
      const ids = uniq([...Object.keys(s.db.accessibility), ...Object.keys(s.db.preferences)]);
      return ids.map((id) => {
        const data: { accessibility?: AccessibilitySettings; preferences?: LearningPreferences } = {};
        const a = findKey(s.db.accessibility, id);
        const p = findKey(s.db.preferences, id);
        if (a) data.accessibility = normalize('AccessibilitySettings', a);
        if (p) data.preferences = normalize('LearningPreferences', p);
        return { collection: 'userSettings', id, visibleTo: [id], data };
      });
    },
    apply: (s, rows) => {
      for (const row of rows) {
        const data = row.data as { accessibility?: AccessibilitySettings; preferences?: LearningPreferences } | null;
        if (!data) continue;
        if (data.accessibility) s.db.accessibility[row.id] = data.accessibility;
        if (data.preferences) s.db.preferences[row.id] = data.preferences;
      }
    },
  },
];

function findKey<T>(map: Record<string, T>, id: string): T | undefined {
  const key = Object.keys(map).find((k) => sameId(k, id));
  return key ? map[key] : undefined;
}

export const SYNCED_NAMES = new Set(COLLECTIONS.map((c) => c.name));

export function encodeAll(s: SyncState): CloudRecord[] {
  return COLLECTIONS.flatMap((c) => c.encode(s));
}

export function applyAll(rows: PulledRow[], s: SyncState) {
  const grouped = new Map<string, PulledRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.collection) ?? [];
    list.push(row);
    grouped.set(row.collection, list);
  }
  for (const c of COLLECTIONS) {
    const items = grouped.get(c.name);
    if (items?.length) c.apply(s, items);
  }
}
