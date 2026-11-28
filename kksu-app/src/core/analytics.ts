// Анализ прогресса, рекомендации педагогу и контента, Impact-показатели — как KKSUAnalyticsEngine.swift.
import type { KKSUStore } from './store';
import type * as M from './models.gen';
import { ContentFormat, LibraryKind, ProgramDirection, ProjectStage, PartnerKind } from './models.gen';
import { sameId, time } from './ids';
import { attemptPercent, isInternationalPartner, libraryFormat } from './helpers';
import type { RouteId } from './routes.gen';

export type RiskLevel = 'low' | 'medium' | 'high';
export const RISK_TITLE: Record<RiskLevel, string> = { low: 'Стабильно', medium: 'Требует внимания', high: 'Нужна поддержка' };
export const RISK_COLOR: Record<RiskLevel, string> = { low: 'var(--success)', medium: 'var(--warning)', high: 'var(--danger)' };

export interface SubjectStat { subject: string; average: number; count: number; trend: number }
export interface StudentAnalysis {
  studentID: string;
  subjects: SubjectStat[];
  completionRate: number;
  overdue: M.Assignment[];
  testAverage: number | null;
  attendanceRate: number | null;
  overall: number;
  risk: RiskLevel;
  weeklyActivity: { day: Date; count: number }[];
  strongest?: SubjectStat;
  weakest?: SubjectStat;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function analyze(studentID: string, store: KKSUStore): StudentAnalysis {
  const db = store.db;
  const now = Date.now();
  const assignments = store.assignmentsFor(studentID);
  const subs = db.submissions.filter((s) => sameId(s.studentID, studentID));

  const bySubject = new Map<string, [number, number][]>();
  const push = (subject: string, t: number, v: number) => bySubject.set(subject, [...(bySubject.get(subject) ?? []), [t, v]]);
  for (const sub of subs) {
    const a = assignments.find((x) => sameId(x.id, sub.assignmentID));
    if (sub.score === undefined || !a) continue;
    push(a.subject, time(sub.gradedAt ?? sub.submittedAt), sub.score / Math.max(a.maxScore, 1));
  }
  const attempts = db.attempts.filter((a) => sameId(a.userID, studentID));
  for (const attempt of attempts) {
    const test = db.tests.find((t) => sameId(t.id, attempt.testID));
    if (test) push(test.subject, time(attempt.date), attemptPercent(attempt) / 100);
  }
  const subjects: SubjectStat[] = [...bySubject.entries()].map(([subject, values]) => {
    const sorted = values.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const avg = sorted.reduce((s, x) => s + x, 0) / sorted.length;
    let trend = 0;
    if (sorted.length >= 2) {
      const half = Math.floor(sorted.length / 2);
      const first = sorted.slice(0, half).reduce((s, x) => s + x, 0) / half;
      const second = sorted.slice(half).reduce((s, x) => s + x, 0) / (sorted.length - half);
      trend = second - first;
    }
    return { subject, average: avg, count: sorted.length, trend };
  }).sort((a, b) => a.subject.localeCompare(b.subject));

  const submitted = (a: M.Assignment) => !!store.submission(a.id, studentID);
  const due = assignments.filter((a) => time(a.dueDate) < now || submitted(a));
  const completion = due.length === 0 ? 1 : due.filter(submitted).length / due.length;
  const overdue = assignments.filter((a) => time(a.dueDate) < now && !submitted(a));

  const past = db.sessions.filter((s) => time(s.start) < now && s.participantIDs.some((p) => sameId(p, studentID)));
  const attendance = past.length === 0 ? null : past.filter((s) => s.attendedIDs.some((p) => sameId(p, studentID))).length / past.length;
  const testAvg = attempts.length === 0 ? null : attempts.reduce((s, a) => s + attemptPercent(a) / 100, 0) / attempts.length;
  const gradeAvg = subjects.length === 0 ? null : subjects.reduce((s, x) => s + x.average, 0) / subjects.length;

  let weighted = 0, weights = 0;
  if (gradeAvg !== null) { weighted += gradeAvg * 0.5; weights += 0.5; }
  weighted += completion * 0.3; weights += 0.3;
  if (attendance !== null) { weighted += attendance * 0.2; weights += 0.2; }
  const overall = weights > 0 ? weighted / weights : 0;

  let risk: RiskLevel = 'low';
  if (overall < 0.5 || overdue.length >= 2) risk = 'high';
  else if (overall < 0.7 || overdue.length === 1 || subjects.some((s) => s.trend < -0.15)) risk = 'medium';

  const today = startOfDay(new Date());
  const weeklyActivity = [6, 5, 4, 3, 2, 1, 0].map((offset) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const next = day.getTime() + 86400000;
    return { day, count: db.history.filter((h) => sameId(h.userID, studentID) && time(h.date) >= day.getTime() && time(h.date) < next).length };
  });

  const strongest = subjects.length ? subjects.reduce((a, b) => (b.average > a.average ? b : a)) : undefined;
  const weakest = subjects.length ? subjects.reduce((a, b) => (b.average < a.average ? b : a)) : undefined;
  return { studentID, subjects, completionRate: completion, overdue, testAverage: testAvg, attendanceRate: attendance, overall, risk, weeklyActivity, strongest, weakest };
}

export interface TeacherInsight { studentID: string; icon: string; title: string; action: string; priority: RiskLevel }

export function teacherInsights(analyses: StudentAnalysis[], store: KKSUStore): TeacherInsight[] {
  const result: TeacherInsight[] = [];
  for (const a of analyses) {
    const name = store.userName(a.studentID);
    if (a.overdue.length) result.push({ studentID: a.studentID, icon: 'clock.badge.exclamationmark', title: `${name}: просрочено заданий — ${a.overdue.length}`,
      action: 'Напишите ученику в чат, продлите срок или разбейте задание на короткие шаги.', priority: a.overdue.length >= 2 ? 'high' : 'medium' });
    if (a.weakest && a.weakest.average < 0.6) result.push({ studentID: a.studentID, icon: 'arrow.down.right',
      title: `${name}: низкий результат по предмету «${a.weakest.subject}» (${Math.round(a.weakest.average * 100)}%)`,
      action: 'Сгенерируйте адаптированное задание через AI и проверьте его перед отправкой.', priority: 'high' });
    for (const s of a.subjects.filter((x) => x.trend < -0.15)) result.push({ studentID: a.studentID, icon: 'chart.line.downtrend.xyaxis',
      title: `${name}: снижение по «${s.subject}»`, action: 'Проведите короткую индивидуальную консультацию, уточните трудности.', priority: 'medium' });
    if (a.attendanceRate !== null && a.attendanceRate < 0.7) result.push({ studentID: a.studentID, icon: 'person.crop.circle.badge.xmark',
      title: `${name}: посещаемость ${Math.round(a.attendanceRate * 100)}%`, action: 'Свяжитесь с родителем; предложите запись занятия с субтитрами.', priority: 'medium' });
    if (a.strongest && a.strongest.average >= 0.9) result.push({ studentID: a.studentID, icon: 'star.fill',
      title: `${name}: отличные результаты по «${a.strongest.subject}»`,
      action: 'Предложите олимпиадное задание, проект в KKSU Inventions или Young Inventors 30.', priority: 'low' });
    const profile = store.profile(a.studentID);
    if (profile?.specialNeeds) result.push({ studentID: a.studentID, icon: 'figure.roll', title: `${name}: особые образовательные потребности`,
      action: `Учитывайте: ${profile.specialNeeds}. ${profile.supportNotes}`, priority: 'low' });
  }
  const order: RiskLevel[] = ['high', 'medium', 'low'];
  return result.sort((x, y) => order.indexOf(x.priority) - order.indexOf(y.priority));
}

export interface ContentRecommendation { title: string; reason: string; icon: string; score: number; libraryItem?: M.LibraryItem; route?: RouteId }

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function recommendations(userID: string, store: KKSUStore): ContentRecommendation[] {
  const db = store.db;
  const prefs = store.preferences(userID);
  const profile = store.profile(userID);
  const interests = new Set([...prefs.interests, ...(profile?.interests ?? [])].map((x) => x.toLowerCase()));
  const analysis = analyze(userID, store);
  const weak = new Set(analysis.subjects.filter((s) => s.average < 0.75).map((s) => s.subject.toLowerCase()));
  const viewedKey = Object.keys(db.viewedLibraryIDs).find((k) => sameId(k, userID));
  const viewed = new Set(viewedKey ? db.viewedLibraryIDs[viewedKey] : []);
  const result: ContentRecommendation[] = [];
  for (const item of db.library.filter((i) => !i.forTeachers)) {
    let score = 0;
    const reasons: string[] = [];
    const subject = item.subject.toLowerCase();
    if (weak.has(subject)) { score += 3; reasons.push(`поможет подтянуть «${item.subject}»`); }
    if (interests.has(subject) || item.tags.some((t) => interests.has(t.toLowerCase()))) { score += 2; reasons.push('совпадает с интересами'); }
    const format = libraryFormat(item);
    if (prefs.formats.includes(format)) { score += 1; reasons.push(`удобный формат: ${ContentFormat.title[format].toLowerCase()}`); }
    score += viewed.has(item.id) ? -2 : 0.5;
    if (prefs.pace === 'gentle' && item.durationMinutes > 0 && item.durationMinutes <= prefs.sessionMinutes) score += 0.5;
    if (score > 1) result.push({ title: item.title, reason: capFirst(reasons.join(', ')), icon: LibraryKind.icon[item.kind], score, libraryItem: item });
  }
  for (const program of db.programs.filter((p) => p.subjects.some((s) => interests.has(s.toLowerCase())))) {
    result.push({ title: `Программа «${program.title}»`, reason: 'Соответствует интересам ученика', icon: ProgramDirection.icon[program.direction], score: 1.5, route: 'programs' });
  }
  const challenge = db.challenges.find((c) => !c.completedIDs.some((id) => sameId(id, userID)) && c.difficulty <= 3);
  if (challenge) result.push({ title: `Инженерное задание «${challenge.title}»`, reason: `+${challenge.points} баллов, сложность ${challenge.difficulty}/5`, icon: 'puzzlepiece.extension.fill', score: 1.2, route: 'challenges' });
  const event = db.events.filter((e) => time(e.date) > Date.now()).sort((a, b) => time(a.date) - time(b.date))[0];
  if (event) result.push({ title: event.title, reason: `Ближайшее мероприятие: ${store.fmtShort(event.date)}`, icon: 'calendar', score: 1, route: 'events' });
  return result.sort((a, b) => b.score - a.score);
}

export interface ImpactMetrics {
  students: number; teachers: number; lessonsHeld: number; lessonsPlanned: number; projects: number; results: number;
  averageScore: number; completionRate: number; attendanceRate: number; testsPassed: number; certificates: number; achievements: number; academyGraduates: number;
  projectsByStage: [M.ProjectStage, number][]; prototypes: number; yiApplications: number; yiFinalists: number; exhibitionItems: number; inclusiveProjects: number; experiments: number;
  partners: number; partnersByKind: [M.PartnerKind, number][]; internships: number; internshipApplications: number; internshipAccepted: number;
  countries: number; globalClasses: number; internationalProjects: number; internationalExperts: number; internationalEvents: number; internationalPartners: number;
  events: number; eventParticipants: number;
}

export function impactMetrics(db: KKSUStore['db'], from = -Infinity, to = Infinity): ImpactMetrics {
  const now = Date.now();
  const inRange = (iso: string) => { const t = time(iso); return t >= from && t <= to; };
  const students = db.users.filter((u) => u.role === 'student').length;
  const sessions = db.sessions.filter((s) => inRange(s.start));
  const projectsInRange = db.projects.filter((p) => inRange(p.createdAt));
  const graded = db.submissions.filter((s) => inRange(s.submittedAt)).flatMap((s) => {
    const a = db.assignments.find((x) => sameId(x.id, s.assignmentID));
    return s.score !== undefined && a ? [s.score / Math.max(a.maxScore, 1)] : [];
  });
  const dueAssignments = db.assignments.filter((a) => a.audience === 'students' && a.approvedByTeacher && time(a.dueDate) < now && inRange(a.dueDate));
  const expected = dueAssignments.reduce((t, a) => t + (a.assignedIDs.length === 0 ? Math.max(students, 1) : a.assignedIDs.length), 0);
  const delivered = dueAssignments.reduce((t, a) => t + new Set(db.submissions.filter((s) => sameId(s.assignmentID, a.id)).map((s) => s.studentID.toUpperCase())).size, 0);
  const pastSessions = sessions.filter((s) => time(s.start) < now);
  const seats = pastSessions.reduce((t, s) => t + s.participantIDs.length, 0);
  const attended = pastSessions.reduce((t, s) => t + s.attendedIDs.length, 0);
  const countries = new Set<string>(db.partners.map((p) => p.country));
  db.globalClasses.forEach((g) => countries.add(g.country));
  db.internationalProjects.forEach((p) => p.countries.forEach((c) => countries.add(c)));
  db.internationalExperts.forEach((e) => countries.add(e.country));
  return {
    students, teachers: db.users.filter((u) => u.role === 'teacher').length,
    lessonsHeld: sessions.filter((s) => time(s.start) < now).length, lessonsPlanned: sessions.filter((s) => time(s.start) >= now).length,
    projects: projectsInRange.length,
    results: projectsInRange.filter((p) => p.stage === 'result').length + db.certificates.filter((c) => inRange(c.date)).length,
    averageScore: graded.length ? graded.reduce((s, x) => s + x, 0) / graded.length : 0,
    completionRate: expected === 0 ? 1 : Math.min(delivered / expected, 1),
    attendanceRate: seats === 0 ? 0 : attended / seats,
    testsPassed: db.attempts.filter((a) => a.passed && inRange(a.date)).length,
    certificates: db.certificates.filter((c) => inRange(c.date)).length,
    achievements: db.achievements.filter((a) => inRange(a.date)).length,
    academyGraduates: new Set(db.teacherCourses.flatMap((c) => c.completedIDs.map((x) => x.toUpperCase()))).size,
    projectsByStage: ProjectStage.values.map((s) => [s, projectsInRange.filter((p) => p.stage === s).length]),
    prototypes: projectsInRange.filter((p) => p.isPrototype).length,
    yiApplications: db.yiApplications.filter((a) => inRange(a.date)).length,
    yiFinalists: db.yiApplications.filter((a) => a.status === 'finalist' || a.status === 'winner').length,
    exhibitionItems: db.projects.filter((p) => p.showInExhibition).length,
    inclusiveProjects: projectsInRange.filter((p) => p.track === 'inclusiveEngineering' || !!p.inclusiveTarget).length,
    experiments: db.experiments.filter((e) => inRange(e.date)).length,
    partners: db.partners.length,
    partnersByKind: PartnerKind.values.map((k) => [k, db.partners.filter((p) => p.kind === k).length] as [M.PartnerKind, number]).filter((x) => x[1] > 0),
    internships: db.internships.length,
    internshipApplications: db.internshipApplications.filter((a) => inRange(a.date)).length,
    internshipAccepted: db.internshipApplications.filter((a) => a.status === 'accepted' || a.status === 'completed').length,
    countries: countries.size, globalClasses: db.globalClasses.length, internationalProjects: db.internationalProjects.length,
    internationalExperts: db.internationalExperts.length, internationalEvents: db.events.filter((e) => e.isInternational).length,
    internationalPartners: db.partners.filter(isInternationalPartner).length,
    events: db.events.filter((e) => inRange(e.date)).length,
    eventParticipants: db.eventRegistrations.filter((r) => inRange(r.date)).length,
  };
}
