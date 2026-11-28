// Сгенерировано scripts/gen_models.py из Swift-моделей iOS-приложения. Не редактируйте вручную.
import { newId, nowISO, isoYearsFromNow } from './ids';
import { KKSUPaymentDefaults, paymentMethodManualCases } from './constants';

export type FieldKind = string | { array: FieldKind } | { map: FieldKind };
export interface FieldInfo { kind: FieldKind; optional: boolean }

export type KKSURole = 'student' | 'parent' | 'teacher' | 'psychologist' | 'expert' | 'mentor' | 'partner' | 'admin';
export const KKSURole = {
  values: ['student', 'parent', 'teacher', 'psychologist', 'expert', 'mentor', 'partner', 'admin'] as KKSURole[],
  title: { 'student': "Ученик", 'parent': "Родитель", 'teacher': "Педагог", 'psychologist': "Психолог", 'expert': "Эксперт", 'mentor': "Наставник", 'partner': "Партнёр", 'admin': "Администратор" } as Record<KKSURole, string>,
  icon: { 'student': "graduationcap.fill", 'parent': "person.2.fill", 'teacher': "person.fill.viewfinder", 'psychologist': "heart.text.square.fill", 'expert': "checkmark.seal.fill", 'mentor': "figure.2.and.child.holdinghands", 'partner': "building.2.fill", 'admin': "gearshape.2.fill" } as Record<KKSURole, string>,
};

export interface KKSUUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: KKSURole;
  passwordHash: string;
  salt: string;
  createdAt: string;
  isBlocked: boolean;
  linkedStudentIDs: string[];
  partnerID?: string;
  recoveryCode?: string;
  recoveryExpires?: string;
  lastLogin?: string;
}
export function makeKKSUUser(init: Pick<KKSUUser, 'fullName' | 'email' | 'role' | 'passwordHash' | 'salt'> & Partial<KKSUUser>): KKSUUser {
  return {
    id: newId(),
    phone: "",
    createdAt: nowISO(),
    isBlocked: false,
    linkedStudentIDs: [],
    ...init,
  } as KKSUUser;
}

export interface StudentProfile {
  id: string;
  userID: string;
  birthDate: string;
  grade: string;
  school: string;
  city: string;
  interests: string[];
  specialNeeds: string;
  supportNotes: string;
  goals: string;
  avatarSymbol: string;
  xp: number;
}
export function makeStudentProfile(init: Pick<StudentProfile, 'userID'> & Partial<StudentProfile>): StudentProfile {
  return {
    id: newId(),
    birthDate: isoYearsFromNow(-12),
    grade: "6",
    school: "KKSU",
    city: "Алматы",
    interests: [],
    specialNeeds: "",
    supportNotes: "",
    goals: "",
    avatarSymbol: "person.crop.circle.fill",
    xp: 0,
    ...init,
  } as StudentProfile;
}

export interface IntakeQuestionnaire {
  id: string;
  studentID: string;
  date: string;
  learningFormat: LearningFormat;
  strengths: string;
  difficulties: string;
  healthNotes: string;
  communication: string;
  parentExpectations: string;
  assistiveTech: string[];
  needsPsychologist: boolean;
}
export function makeIntakeQuestionnaire(init: Pick<IntakeQuestionnaire, 'studentID'> & Partial<IntakeQuestionnaire>): IntakeQuestionnaire {
  return {
    id: newId(),
    date: nowISO(),
    learningFormat: 'mixed',
    strengths: "",
    difficulties: "",
    healthNotes: "",
    communication: "",
    parentExpectations: "",
    assistiveTech: [],
    needsPsychologist: false,
    ...init,
  } as IntakeQuestionnaire;
}

export type LearningFormat = 'online' | 'offline' | 'mixed';
export const LearningFormat = {
  values: ['online', 'offline', 'mixed'] as LearningFormat[],
  title: { 'online': "Онлайн", 'offline': "Очно", 'mixed': "Смешанный" } as Record<LearningFormat, string>,
};

export type ApplicationStatus = 'submitted' | 'review' | 'interview' | 'accepted' | 'rejected';
export const ApplicationStatus = {
  values: ['submitted', 'review', 'interview', 'accepted', 'rejected'] as ApplicationStatus[],
  title: { 'submitted': "Подана", 'review': "На рассмотрении", 'interview': "Собеседование", 'accepted': "Принята", 'rejected': "Отклонена" } as Record<ApplicationStatus, string>,
};

export interface EnrollmentApplication {
  id: string;
  applicantUserID?: string;
  childName: string;
  childAge: number;
  parentName: string;
  email: string;
  phone: string;
  programID?: string;
  format: LearningFormat;
  comment: string;
  status: ApplicationStatus;
  date: string;
}
export function makeEnrollmentApplication(init: Pick<EnrollmentApplication, 'childName' | 'childAge' | 'parentName' | 'email' | 'phone'> & Partial<EnrollmentApplication>): EnrollmentApplication {
  return {
    id: newId(),
    format: 'mixed',
    comment: "",
    status: 'submitted',
    date: nowISO(),
    ...init,
  } as EnrollmentApplication;
}

export type ConsentType = 'personalData' | 'photoVideo' | 'aiUsage' | 'psychologist' | 'international' | 'publication';
export const ConsentType = {
  values: ['personalData', 'photoVideo', 'aiUsage', 'psychologist', 'international', 'publication'] as ConsentType[],
  title: { 'personalData': "Обработка персональных данных", 'photoVideo': "Фото- и видеосъёмка", 'aiUsage': "Использование AI-помощника", 'psychologist': "Сопровождение психолога", 'international': "Участие в международных проектах", 'publication': "Публикация проектов на выставке" } as Record<ConsentType, string>,
};

export interface ParentConsent {
  id: string;
  studentID: string;
  parentID: string;
  type: ConsentType;
  granted: boolean;
  signatureName: string;
  date: string;
}
export function makeParentConsent(init: Pick<ParentConsent, 'studentID' | 'parentID' | 'type' | 'granted' | 'signatureName'> & Partial<ParentConsent>): ParentConsent {
  return {
    id: newId(),
    date: nowISO(),
    ...init,
  } as ParentConsent;
}

export type ProgramDirection = 'school' | 'engineering' | 'inventions' | 'global' | 'inclusive' | 'digital' | 'teacherAcademy';
export const ProgramDirection = {
  values: ['school', 'engineering', 'inventions', 'global', 'inclusive', 'digital', 'teacherAcademy'] as ProgramDirection[],
  title: { 'school': "Школьная программа", 'engineering': "Инженерия", 'inventions': "Изобретательство", 'global': "Международные", 'inclusive': "Инклюзия", 'digital': "Цифровые навыки / AI", 'teacherAcademy': "Teacher Academy" } as Record<ProgramDirection, string>,
  icon: { 'school': "book.fill", 'engineering': "gearshape.2.fill", 'inventions': "lightbulb.fill", 'global': "globe.europe.africa.fill", 'inclusive': "figure.roll", 'digital': "cpu.fill", 'teacherAcademy': "person.crop.rectangle.stack.fill" } as Record<ProgramDirection, string>,
};

export interface EducationProgram {
  id: string;
  title: string;
  direction: ProgramDirection;
  ageRange: string;
  durationWeeks: number;
  format: LearningFormat;
  summary: string;
  subjects: string[];
  seats: number;
}
export function makeEducationProgram(init: Pick<EducationProgram, 'title' | 'direction' | 'ageRange' | 'durationWeeks' | 'format' | 'summary' | 'subjects'> & Partial<EducationProgram>): EducationProgram {
  return {
    id: newId(),
    seats: 20,
    ...init,
  } as EducationProgram;
}

export type StepStatus = 'planned' | 'inProgress' | 'done';
export const StepStatus = {
  values: ['planned', 'inProgress', 'done'] as StepStatus[],
  title: { 'planned': "Запланировано", 'inProgress': "В процессе", 'done': "Завершено" } as Record<StepStatus, string>,
  icon: { 'planned': "circle", 'inProgress': "circle.lefthalf.filled", 'done': "checkmark.circle.fill" } as Record<StepStatus, string>,
};

export interface TrajectoryStep {
  id: string;
  studentID: string;
  title: string;
  programID?: string;
  targetDate: string;
  status: StepStatus;
  note: string;
}
export function makeTrajectoryStep(init: Pick<TrajectoryStep, 'studentID' | 'title' | 'targetDate'> & Partial<TrajectoryStep>): TrajectoryStep {
  return {
    id: newId(),
    status: 'planned',
    note: "",
    ...init,
  } as TrajectoryStep;
}

export interface StudyPlanItem {
  id: string;
  studentID: string;
  subject: string;
  hoursPerWeek: number;
  goal: string;
  term: string;
  adaptation: string;
}
export function makeStudyPlanItem(init: Pick<StudyPlanItem, 'studentID' | 'subject' | 'hoursPerWeek' | 'goal' | 'term'> & Partial<StudyPlanItem>): StudyPlanItem {
  return {
    id: newId(),
    adaptation: "",
    ...init,
  } as StudyPlanItem;
}

export type ConferencePlatform = 'jitsi' | 'zoom' | 'meet' | 'teams' | 'other';
export const ConferencePlatform = {
  values: ['jitsi', 'zoom', 'meet', 'teams', 'other'] as ConferencePlatform[],
  title: { 'jitsi': "Jitsi Meet", 'zoom': "Zoom", 'meet': "Google Meet", 'teams': "Microsoft Teams", 'other': "Другая" } as Record<ConferencePlatform, string>,
};

export interface ScheduleSession {
  id: string;
  title: string;
  subject: string;
  teacherID?: string;
  start: string;
  durationMinutes: number;
  room: string;
  isOnline: boolean;
  platform: ConferencePlatform;
  meetingURL: string;
  participantIDs: string[];
  attendedIDs: string[];
  recordingURL: string;
}
export function makeScheduleSession(init: Pick<ScheduleSession, 'title' | 'subject' | 'start'> & Partial<ScheduleSession>): ScheduleSession {
  return {
    id: newId(),
    durationMinutes: 45,
    room: "",
    isOnline: true,
    platform: 'jitsi',
    meetingURL: "",
    participantIDs: [],
    attendedIDs: [],
    recordingURL: "",
    ...init,
  } as ScheduleSession;
}

export interface CalendarNote {
  id: string;
  userID: string;
  title: string;
  date: string;
}
export function makeCalendarNote(init: Pick<CalendarNote, 'userID' | 'title' | 'date'> & Partial<CalendarNote>): CalendarNote {
  return {
    id: newId(),
    ...init,
  } as CalendarNote;
}

export type AssignmentAudience = 'students' | 'teachers';
export const AssignmentAudience = {
  values: ['students', 'teachers'] as AssignmentAudience[],
};

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  details: string;
  teacherID?: string;
  createdAt: string;
  dueDate: string;
  maxScore: number;
  assignedIDs: string[];
  audience: AssignmentAudience;
  courseID?: string;
  isAIGenerated: boolean;
  approvedByTeacher: boolean;
  textAlternative: string;
}
export function makeAssignment(init: Pick<Assignment, 'title' | 'subject' | 'details' | 'dueDate'> & Partial<Assignment>): Assignment {
  return {
    id: newId(),
    createdAt: nowISO(),
    maxScore: 10,
    assignedIDs: [],
    audience: 'students',
    isAIGenerated: false,
    approvedByTeacher: true,
    textAlternative: "",
    ...init,
  } as Assignment;
}

export type AttachmentKind = 'photo' | 'video' | 'drawing' | 'document' | 'pdf' | 'presentation' | 'other';
export const AttachmentKind = {
  values: ['photo', 'video', 'drawing', 'document', 'pdf', 'presentation', 'other'] as AttachmentKind[],
  title: { 'photo': "Фото", 'video': "Видео", 'drawing': "Чертёж", 'document': "Документ", 'pdf': "PDF", 'presentation': "Презентация", 'other': "Файл" } as Record<AttachmentKind, string>,
  icon: { 'photo': "photo.fill", 'video': "video.fill", 'drawing': "pencil.and.ruler.fill", 'document': "doc.text.fill", 'pdf': "doc.richtext.fill", 'presentation': "rectangle.on.rectangle.angled.fill", 'other': "paperclip" } as Record<AttachmentKind, string>,
};

export interface Attachment {
  id: string;
  fileName: string;
  kind: AttachmentKind;
  sizeBytes: number;
  storedName?: string;
  remoteURL?: string;
  altText: string;
}
export function makeAttachment(init: Pick<Attachment, 'fileName' | 'kind'> & Partial<Attachment>): Attachment {
  return {
    id: newId(),
    sizeBytes: 0,
    altText: "",
    ...init,
  } as Attachment;
}

export type SubmissionStatus = 'submitted' | 'graded' | 'returned';
export const SubmissionStatus = {
  values: ['submitted', 'graded', 'returned'] as SubmissionStatus[],
  title: { 'submitted': "На проверке", 'graded': "Оценено", 'returned': "На доработку" } as Record<SubmissionStatus, string>,
};

export interface Submission {
  id: string;
  assignmentID: string;
  studentID: string;
  submittedAt: string;
  text: string;
  attachments: Attachment[];
  score?: number;
  feedback: string;
  gradedAt?: string;
  gradedBy?: string;
  status: SubmissionStatus;
}
export function makeSubmission(init: Pick<Submission, 'assignmentID' | 'studentID' | 'text'> & Partial<Submission>): Submission {
  return {
    id: newId(),
    submittedAt: nowISO(),
    attachments: [],
    feedback: "",
    status: 'submitted',
    ...init,
  } as Submission;
}

export interface PortfolioItem {
  id: string;
  studentID: string;
  title: string;
  category: string;
  date: string;
  summary: string;
  attachments: Attachment[];
  verifiedBy?: string;
}
export function makePortfolioItem(init: Pick<PortfolioItem, 'studentID' | 'title' | 'category' | 'summary'> & Partial<PortfolioItem>): PortfolioItem {
  return {
    id: newId(),
    date: nowISO(),
    attachments: [],
    ...init,
  } as PortfolioItem;
}

export interface Achievement {
  id: string;
  userID: string;
  title: string;
  icon: string;
  points: number;
  date: string;
}
export function makeAchievement(init: Pick<Achievement, 'userID' | 'title' | 'icon' | 'points'> & Partial<Achievement>): Achievement {
  return {
    id: newId(),
    date: nowISO(),
    ...init,
  } as Achievement;
}

export type CertificateIssuer = 'school' | 'teacherAcademy' | 'youngInventors' | 'conference' | 'internship';
export const CertificateIssuer = {
  values: ['school', 'teacherAcademy', 'youngInventors', 'conference', 'internship'] as CertificateIssuer[],
  title: { 'school': "KKSU Online", 'teacherAcademy': "KKSU Teacher Academy", 'youngInventors': "Young Inventors 30", 'conference': "Конференции KKSU", 'internship': "Стажировки KKSU" } as Record<CertificateIssuer, string>,
};

export interface Certificate {
  id: string;
  userID: string;
  recipientName: string;
  title: string;
  issuer: CertificateIssuer;
  date: string;
  serial: string;
  hours?: number;
}
export function makeCertificate(init: Pick<Certificate, 'userID' | 'recipientName' | 'title' | 'issuer' | 'serial'> & Partial<Certificate>): Certificate {
  return {
    id: newId(),
    date: nowISO(),
    ...init,
  } as Certificate;
}

export interface HistoryEntry {
  id: string;
  userID: string;
  date: string;
  action: string;
  details: string;
  icon: string;
}
export function makeHistoryEntry(init: Pick<HistoryEntry, 'userID' | 'action'> & Partial<HistoryEntry>): HistoryEntry {
  return {
    id: newId(),
    date: nowISO(),
    details: "",
    icon: "clock",
    ...init,
  } as HistoryEntry;
}

export type LibraryKind = 'video' | 'methodical' | 'pdf' | 'presentation' | 'instruction' | 'textbook';
export const LibraryKind = {
  values: ['video', 'methodical', 'pdf', 'presentation', 'instruction', 'textbook'] as LibraryKind[],
  title: { 'video': "Видеоурок", 'methodical': "Методический материал", 'pdf': "PDF", 'presentation': "Презентация", 'instruction': "Инструкция", 'textbook': "Учебник" } as Record<LibraryKind, string>,
  icon: { 'video': "play.rectangle.fill", 'methodical': "text.book.closed.fill", 'pdf': "doc.richtext.fill", 'presentation': "rectangle.on.rectangle.angled.fill", 'instruction': "list.bullet.clipboard.fill", 'textbook': "books.vertical.fill" } as Record<LibraryKind, string>,
};

export type ContentFormat = 'video' | 'text' | 'audio' | 'interactive';
export const ContentFormat = {
  values: ['video', 'text', 'audio', 'interactive'] as ContentFormat[],
  title: { 'video': "Видео", 'text': "Текст", 'audio': "Аудио", 'interactive': "Интерактив" } as Record<ContentFormat, string>,
};

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}
export function makeCaptionSegment(init: Pick<CaptionSegment, 'start' | 'end' | 'text'> & Partial<CaptionSegment>): CaptionSegment {
  return {
    ...init,
  } as CaptionSegment;
}

export interface LibraryItem {
  id: string;
  title: string;
  kind: LibraryKind;
  subject: string;
  author: string;
  summary: string;
  url: string;
  durationMinutes: number;
  captions: CaptionSegment[];
  textAlternative: string;
  tags: string[];
  forTeachers: boolean;
  isTeacherAcademy: boolean;
  views: number;
}
export function makeLibraryItem(init: Pick<LibraryItem, 'title' | 'kind' | 'subject' | 'author' | 'summary'> & Partial<LibraryItem>): LibraryItem {
  return {
    id: newId(),
    url: "",
    durationMinutes: 0,
    captions: [],
    textAlternative: "",
    tags: [],
    forTeachers: false,
    isTeacherAcademy: false,
    views: 0,
    ...init,
  } as LibraryItem;
}

export type QuestionKind = 'single' | 'multiple' | 'number' | 'text';
export const QuestionKind = {
  values: ['single', 'multiple', 'number', 'text'] as QuestionKind[],
  title: { 'single': "Один ответ", 'multiple': "Несколько ответов", 'number': "Число", 'text': "Короткий текст" } as Record<QuestionKind, string>,
};

export interface TestQuestion {
  id: string;
  text: string;
  kind: QuestionKind;
  options: string[];
  correctIndices: number[];
  correctText: string;
  points: number;
  explanation: string;
}
export function makeTestQuestion(init: Pick<TestQuestion, 'text'> & Partial<TestQuestion>): TestQuestion {
  return {
    id: newId(),
    kind: 'single',
    options: [],
    correctIndices: [],
    correctText: "",
    points: 1,
    explanation: "",
    ...init,
  } as TestQuestion;
}

export interface KKSUTest {
  id: string;
  title: string;
  subject: string;
  authorID?: string;
  questions: TestQuestion[];
  timeLimitMinutes: number;
  passingPercent: number;
  audience: AssignmentAudience;
  courseID?: string;
  isPublished: boolean;
}
export function makeKKSUTest(init: Pick<KKSUTest, 'title' | 'subject' | 'questions'> & Partial<KKSUTest>): KKSUTest {
  return {
    id: newId(),
    timeLimitMinutes: 20,
    passingPercent: 60,
    audience: 'students',
    isPublished: true,
    ...init,
  } as KKSUTest;
}

export interface TestAnswer {
  questionID: string;
  selected: number[];
  text: string;
}
export function makeTestAnswer(init: Pick<TestAnswer, 'questionID'> & Partial<TestAnswer>): TestAnswer {
  return {
    selected: [],
    text: "",
    ...init,
  } as TestAnswer;
}

export interface TestAttempt {
  id: string;
  testID: string;
  userID: string;
  date: string;
  answers: TestAnswer[];
  score: number;
  maxScore: number;
  passed: boolean;
}
export function makeTestAttempt(init: Pick<TestAttempt, 'testID' | 'userID' | 'answers' | 'score' | 'maxScore' | 'passed'> & Partial<TestAttempt>): TestAttempt {
  return {
    id: newId(),
    date: nowISO(),
    ...init,
  } as TestAttempt;
}

export interface ChatThread {
  id: string;
  participantIDs: string[];
  title: string;
}
export function makeChatThread(init: Pick<ChatThread, 'participantIDs' | 'title'> & Partial<ChatThread>): ChatThread {
  return {
    id: newId(),
    ...init,
  } as ChatThread;
}

export interface ChatMessage {
  id: string;
  threadID: string;
  senderID: string;
  text: string;
  date: string;
  readBy: string[];
}
export function makeChatMessage(init: Pick<ChatMessage, 'threadID' | 'senderID' | 'text'> & Partial<ChatMessage>): ChatMessage {
  return {
    id: newId(),
    date: nowISO(),
    readBy: [],
    ...init,
  } as ChatMessage;
}

export type NotificationKind = 'info' | 'deadline' | 'grade' | 'message' | 'event' | 'system' | 'ai';
export const NotificationKind = {
  values: ['info', 'deadline', 'grade', 'message', 'event', 'system', 'ai'] as NotificationKind[],
  icon: { 'info': "info.circle.fill", 'deadline': "clock.badge.exclamationmark.fill", 'grade': "star.circle.fill", 'message': "bubble.left.fill", 'event': "calendar.badge.plus", 'system': "gearshape.fill", 'ai': "sparkles" } as Record<NotificationKind, string>,
};

export interface KKSUNotification {
  id: string;
  userID: string;
  title: string;
  body: string;
  kind: NotificationKind;
  date: string;
  isRead: boolean;
}
export function makeKKSUNotification(init: Pick<KKSUNotification, 'userID' | 'title' | 'body'> & Partial<KKSUNotification>): KKSUNotification {
  return {
    id: newId(),
    kind: 'info',
    date: nowISO(),
    isRead: false,
    ...init,
  } as KKSUNotification;
}

export interface TeacherAcademyProfile {
  id: string;
  userID: string;
  specialization: string;
  experienceYears: number;
  organization: string;
  date: string;
}
export function makeTeacherAcademyProfile(init: Pick<TeacherAcademyProfile, 'userID' | 'specialization' | 'experienceYears' | 'organization'> & Partial<TeacherAcademyProfile>): TeacherAcademyProfile {
  return {
    id: newId(),
    date: nowISO(),
    ...init,
  } as TeacherAcademyProfile;
}

export interface TeacherCourse {
  id: string;
  title: string;
  hours: number;
  level: string;
  summary: string;
  modules: string[];
  enrolledIDs: string[];
  completedModules: Record<string, string[]>;
  completedIDs: string[];
}
export function makeTeacherCourse(init: Pick<TeacherCourse, 'title' | 'hours' | 'level' | 'summary' | 'modules'> & Partial<TeacherCourse>): TeacherCourse {
  return {
    id: newId(),
    enrolledIDs: [],
    completedModules: {},
    completedIDs: [],
    ...init,
  } as TeacherCourse;
}

export type MethodologyStatus = 'draft' | 'piloting' | 'reviewed' | 'approved';
export const MethodologyStatus = {
  values: ['draft', 'piloting', 'reviewed', 'approved'] as MethodologyStatus[],
  title: { 'draft': "Черновик", 'piloting': "Апробация", 'reviewed': "Экспертиза", 'approved': "Утверждена" } as Record<MethodologyStatus, string>,
};

export interface Methodology {
  id: string;
  title: string;
  author: string;
  subject: string;
  ageGroup: string;
  summary: string;
  status: MethodologyStatus;
  documents: Attachment[];
}
export function makeMethodology(init: Pick<Methodology, 'title' | 'author' | 'subject' | 'ageGroup' | 'summary'> & Partial<Methodology>): Methodology {
  return {
    id: newId(),
    status: 'draft',
    documents: [],
    ...init,
  } as Methodology;
}

export interface MethodologyPilot {
  id: string;
  methodologyID: string;
  site: string;
  teacherName: string;
  startDate: string;
  endDate: string;
  participants: number;
  baselineScore: number;
  finalScore: number;
  summary: string;
}
export function makeMethodologyPilot(init: Pick<MethodologyPilot, 'methodologyID' | 'site' | 'teacherName' | 'startDate' | 'endDate' | 'participants' | 'baselineScore' | 'finalScore' | 'summary'> & Partial<MethodologyPilot>): MethodologyPilot {
  return {
    id: newId(),
    ...init,
  } as MethodologyPilot;
}

export type ReviewTarget = 'methodology' | 'project' | 'youngInventors';
export const ReviewTarget = {
  values: ['methodology', 'project', 'youngInventors'] as ReviewTarget[],
};

export type ReviewDecision = 'approve' | 'revise' | 'reject';
export const ReviewDecision = {
  values: ['approve', 'revise', 'reject'] as ReviewDecision[],
  title: { 'approve': "Рекомендовать", 'revise': "На доработку", 'reject': "Отклонить" } as Record<ReviewDecision, string>,
};

export interface ReviewScore {
  criterion: string;
  score: number;
}
export function makeReviewScore(init: Pick<ReviewScore, 'criterion' | 'score'> & Partial<ReviewScore>): ReviewScore {
  return {
    ...init,
  } as ReviewScore;
}

export interface ExpertReview {
  id: string;
  targetID: string;
  target: ReviewTarget;
  expertID: string;
  date: string;
  scores: ReviewScore[];
  comment: string;
  decision: ReviewDecision;
}
export function makeExpertReview(init: Pick<ExpertReview, 'targetID' | 'target' | 'expertID' | 'scores' | 'comment' | 'decision'> & Partial<ExpertReview>): ExpertReview {
  return {
    id: newId(),
    date: nowISO(),
    ...init,
  } as ExpertReview;
}

export type ProjectStage = 'idea' | 'research' | 'prototype' | 'testing' | 'result';
export const ProjectStage = {
  values: ['idea', 'research', 'prototype', 'testing', 'result'] as ProjectStage[],
  title: { 'idea': "Idea", 'research': "Research", 'prototype': "Prototype", 'testing': "Testing", 'result': "Result" } as Record<ProjectStage, string>,
  subtitle: { 'idea': "Идея", 'research': "Исследование", 'prototype': "Прототип", 'testing': "Испытания", 'result': "Результат" } as Record<ProjectStage, string>,
  icon: { 'idea': "lightbulb.fill", 'research': "magnifyingglass", 'prototype': "hammer.fill", 'testing': "testtube.2", 'result': "flag.checkered" } as Record<ProjectStage, string>,
};

export type ProjectTrack = 'inventions' | 'futureEngineers' | 'mashstroy' | 'araiAI' | 'iken' | 'ataMura' | 'inclusiveEngineering' | 'global';
export const ProjectTrack = {
  values: ['inventions', 'futureEngineers', 'mashstroy', 'araiAI', 'iken', 'ataMura', 'inclusiveEngineering', 'global'] as ProjectTrack[],
  title: { 'inventions': "KKSU Inventions", 'futureEngineers': "Future Engineers", 'mashstroy': "MASHSTROY", 'araiAI': "ARAI AI", 'iken': "IKEN", 'ataMura': "ATA MURA", 'inclusiveEngineering': "Inclusive Engineering", 'global': "Global Classroom" } as Record<ProjectTrack, string>,
  icon: { 'inventions': "lightbulb.max.fill", 'futureEngineers': "wrench.and.screwdriver.fill", 'mashstroy': "gearshape.2.fill", 'araiAI': "brain.head.profile", 'iken': "leaf.fill", 'ataMura': "building.columns.fill", 'inclusiveEngineering': "figure.roll", 'global': "globe" } as Record<ProjectTrack, string>,
  summary: { 'inventions': "Изобретения и прототипы учеников KKSU.", 'futureEngineers': "Инженерная школа: курсы, виртуальные задания, кейсы.", 'mashstroy': "Проектные кейсы машиностроения от индустриальных партнёров.", 'araiAI': "Интеграция AI-решений ARAI в учебные и инженерные проекты.", 'iken': "Проекты IKEN: экология, энергия и устойчивое развитие.", 'ataMura': "Проекты ATA MURA: культурное наследие и история в цифровом формате.", 'inclusiveEngineering': "Инженерные разработки для людей с особыми потребностями.", 'global': "Совместные международные проекты." } as Record<ProjectTrack, string>,
};

export interface InventionProject {
  id: string;
  title: string;
  summary: string;
  problem: string;
  solution: string;
  stage: ProjectStage;
  track: ProjectTrack;
  teamID?: string;
  mentorID?: string;
  authorIDs: string[];
  media: Attachment[];
  createdAt: string;
  stageHistory: StageChange[];
  isPrototype: boolean;
  prototypeSpecs: string;
  inclusiveTarget: string;
  showInExhibition: boolean;
  likes: number;
  tags: string[];
}
export function makeInventionProject(init: Pick<InventionProject, 'title' | 'summary'> & Partial<InventionProject>): InventionProject {
  return {
    id: newId(),
    problem: "",
    solution: "",
    stage: 'idea',
    track: 'inventions',
    authorIDs: [],
    media: [],
    createdAt: nowISO(),
    stageHistory: [],
    isPrototype: false,
    prototypeSpecs: "",
    inclusiveTarget: "",
    showInExhibition: false,
    likes: 0,
    tags: [],
    ...init,
  } as InventionProject;
}

export interface StageChange {
  stage: ProjectStage;
  date: string;
  note: string;
}
export function makeStageChange(init: Pick<StageChange, 'stage' | 'date' | 'note'> & Partial<StageChange>): StageChange {
  return {
    ...init,
  } as StageChange;
}

export interface ProjectTeam {
  id: string;
  name: string;
  memberIDs: string[];
  captainID?: string;
}
export function makeProjectTeam(init: Pick<ProjectTeam, 'name' | 'memberIDs'> & Partial<ProjectTeam>): ProjectTeam {
  return {
    id: newId(),
    ...init,
  } as ProjectTeam;
}

export interface ExperimentEntry {
  id: string;
  projectID: string;
  authorID: string;
  date: string;
  hypothesis: string;
  method: string;
  result: string;
  conclusion: string;
  success: boolean;
}
export function makeExperimentEntry(init: Pick<ExperimentEntry, 'projectID' | 'authorID' | 'hypothesis' | 'method' | 'result' | 'conclusion' | 'success'> & Partial<ExperimentEntry>): ExperimentEntry {
  return {
    id: newId(),
    date: nowISO(),
    ...init,
  } as ExperimentEntry;
}

export interface LabMeasurement {
  id: string;
  name: string;
  value: number;
  unit: string;
}
export function makeLabMeasurement(init: Pick<LabMeasurement, 'name' | 'value' | 'unit'> & Partial<LabMeasurement>): LabMeasurement {
  return {
    id: newId(),
    ...init,
  } as LabMeasurement;
}

export interface LabNotebookPage {
  id: string;
  projectID: string;
  authorID: string;
  date: string;
  title: string;
  content: string;
  measurements: LabMeasurement[];
  signedByMentor: boolean;
}
export function makeLabNotebookPage(init: Pick<LabNotebookPage, 'projectID' | 'authorID' | 'title' | 'content'> & Partial<LabNotebookPage>): LabNotebookPage {
  return {
    id: newId(),
    date: nowISO(),
    measurements: [],
    signedByMentor: false,
    ...init,
  } as LabNotebookPage;
}

export type YIStatus = 'submitted' | 'underReview' | 'finalist' | 'winner' | 'rejected';
export const YIStatus = {
  values: ['submitted', 'underReview', 'finalist', 'winner', 'rejected'] as YIStatus[],
  title: { 'submitted': "Подана", 'underReview': "Экспертиза", 'finalist': "Финалист", 'winner': "Победитель", 'rejected': "Не прошла" } as Record<YIStatus, string>,
};

export interface YoungInventorsApplication {
  id: string;
  projectID: string;
  applicantID: string;
  season: string;
  nomination: string;
  motivation: string;
  date: string;
  status: YIStatus;
}
export function makeYoungInventorsApplication(init: Pick<YoungInventorsApplication, 'projectID' | 'applicantID' | 'season' | 'nomination' | 'motivation'> & Partial<YoungInventorsApplication>): YoungInventorsApplication {
  return {
    id: newId(),
    date: nowISO(),
    status: 'submitted',
    ...init,
  } as YoungInventorsApplication;
}

export interface GlobalClass {
  id: string;
  title: string;
  country: string;
  language: string;
  partnerSchool: string;
  teacherName: string;
  start: string;
  summary: string;
  meetingURL: string;
  participantIDs: string[];
}
export function makeGlobalClass(init: Pick<GlobalClass, 'title' | 'country' | 'language' | 'partnerSchool' | 'teacherName' | 'start' | 'summary'> & Partial<GlobalClass>): GlobalClass {
  return {
    id: newId(),
    meetingURL: "",
    participantIDs: [],
    ...init,
  } as GlobalClass;
}

export interface InternationalProject {
  id: string;
  title: string;
  countries: string[];
  partners: string;
  summary: string;
  participantIDs: string[];
  isActive: boolean;
}
export function makeInternationalProject(init: Pick<InternationalProject, 'title' | 'countries' | 'partners' | 'summary'> & Partial<InternationalProject>): InternationalProject {
  return {
    id: newId(),
    participantIDs: [],
    isActive: true,
    ...init,
  } as InternationalProject;
}

export interface InternationalExpert {
  id: string;
  name: string;
  country: string;
  expertise: string;
  bio: string;
  email: string;
  isTeacher: boolean;
}
export function makeInternationalExpert(init: Pick<InternationalExpert, 'name' | 'country' | 'expertise' | 'bio' | 'email' | 'isTeacher'> & Partial<InternationalExpert>): InternationalExpert {
  return {
    id: newId(),
    ...init,
  } as InternationalExpert;
}

export interface EngineeringCourse {
  id: string;
  title: string;
  track: ProjectTrack;
  level: string;
  summary: string;
  lessons: string[];
  enrolledIDs: string[];
}
export function makeEngineeringCourse(init: Pick<EngineeringCourse, 'title' | 'track' | 'level' | 'summary' | 'lessons'> & Partial<EngineeringCourse>): EngineeringCourse {
  return {
    id: newId(),
    enrolledIDs: [],
    ...init,
  } as EngineeringCourse;
}

export interface EngineeringChallenge {
  id: string;
  title: string;
  track: ProjectTrack;
  summary: string;
  steps: string[];
  difficulty: number;
  points: number;
  isIndustryCase: boolean;
  company: string;
  completedIDs: string[];
}
export function makeEngineeringChallenge(init: Pick<EngineeringChallenge, 'title' | 'track' | 'summary' | 'steps' | 'difficulty' | 'points'> & Partial<EngineeringChallenge>): EngineeringChallenge {
  return {
    id: newId(),
    isIndustryCase: false,
    company: "",
    completedIDs: [],
    ...init,
  } as EngineeringChallenge;
}

export type PartnerKind = 'company' | 'university' | 'school' | 'ngo' | 'government' | 'international';
export const PartnerKind = {
  values: ['company', 'university', 'school', 'ngo', 'government', 'international'] as PartnerKind[],
  title: { 'company': "Компания", 'university': "Университет", 'school': "Школа", 'ngo': "НКО", 'government': "Гос. организация", 'international': "Международная организация" } as Record<PartnerKind, string>,
};

export interface Partner {
  id: string;
  name: string;
  kind: PartnerKind;
  country: string;
  summary: string;
  email: string;
  website: string;
  since: string;
}
export function makePartner(init: Pick<Partner, 'name' | 'kind' | 'country' | 'summary' | 'email' | 'website' | 'since'> & Partial<Partner>): Partner {
  return {
    id: newId(),
    ...init,
  } as Partner;
}

export interface Internship {
  id: string;
  partnerID: string;
  title: string;
  summary: string;
  requirements: string;
  start: string;
  durationWeeks: number;
  seats: number;
  isOpen: boolean;
}
export function makeInternship(init: Pick<Internship, 'partnerID' | 'title' | 'summary' | 'requirements' | 'start' | 'durationWeeks' | 'seats'> & Partial<Internship>): Internship {
  return {
    id: newId(),
    isOpen: true,
    ...init,
  } as Internship;
}

export type InternshipStatus = 'submitted' | 'interview' | 'accepted' | 'rejected' | 'completed';
export const InternshipStatus = {
  values: ['submitted', 'interview', 'accepted', 'rejected', 'completed'] as InternshipStatus[],
  title: { 'submitted': "Подана", 'interview': "Собеседование", 'accepted': "Принят", 'rejected': "Отказ", 'completed': "Завершена" } as Record<InternshipStatus, string>,
};

export interface InternshipApplication {
  id: string;
  internshipID: string;
  studentID: string;
  motivation: string;
  date: string;
  status: InternshipStatus;
}
export function makeInternshipApplication(init: Pick<InternshipApplication, 'internshipID' | 'studentID' | 'motivation'> & Partial<InternshipApplication>): InternshipApplication {
  return {
    id: newId(),
    date: nowISO(),
    status: 'submitted',
    ...init,
  } as InternshipApplication;
}

export type EventKind = 'conference' | 'webinar' | 'exhibition' | 'hackathon' | 'olympiad';
export const EventKind = {
  values: ['conference', 'webinar', 'exhibition', 'hackathon', 'olympiad'] as EventKind[],
  title: { 'conference': "Конференция", 'webinar': "Вебинар", 'exhibition': "Выставка", 'hackathon': "Хакатон", 'olympiad': "Олимпиада" } as Record<EventKind, string>,
};

export interface KKSUEvent {
  id: string;
  title: string;
  kind: EventKind;
  date: string;
  location: string;
  isOnline: boolean;
  meetingURL: string;
  summary: string;
  capacity: number;
  isInternational: boolean;
  hours: number;
}
export function makeKKSUEvent(init: Pick<KKSUEvent, 'title' | 'kind' | 'date' | 'location' | 'isOnline' | 'summary' | 'capacity'> & Partial<KKSUEvent>): KKSUEvent {
  return {
    id: newId(),
    meetingURL: "",
    isInternational: false,
    hours: 4,
    ...init,
  } as KKSUEvent;
}

export type EventRole = 'listener' | 'participant' | 'speaker';
export const EventRole = {
  values: ['listener', 'participant', 'speaker'] as EventRole[],
  title: { 'listener': "Слушатель", 'participant': "Участник", 'speaker': "Докладчик" } as Record<EventRole, string>,
};

export interface EventRegistration {
  id: string;
  eventID: string;
  userID: string;
  role: EventRole;
  talkTitle: string;
  date: string;
  attended: boolean;
  certificateID?: string;
}
export function makeEventRegistration(init: Pick<EventRegistration, 'eventID' | 'userID' | 'role'> & Partial<EventRegistration>): EventRegistration {
  return {
    id: newId(),
    talkTitle: "",
    date: nowISO(),
    attended: false,
    ...init,
  } as EventRegistration;
}

export interface AccessibilitySettings {
  textScale: number;
  highContrast: boolean;
  boldText: boolean;
  dyslexiaFriendlyFont: boolean;
  reduceMotion: boolean;
  simplifiedInterface: boolean;
  largeButtons: boolean;
  captionsEnabled: boolean;
  showTextAlternatives: boolean;
  darkMode: DarkModePreference;
}
export function makeAccessibilitySettings(init: {} & Partial<AccessibilitySettings> = {}): AccessibilitySettings {
  return {
    textScale: 1.0,
    highContrast: false,
    boldText: false,
    dyslexiaFriendlyFont: false,
    reduceMotion: false,
    simplifiedInterface: false,
    largeButtons: false,
    captionsEnabled: true,
    showTextAlternatives: false,
    darkMode: 'system',
    ...init,
  } as AccessibilitySettings;
}

export type DarkModePreference = 'system' | 'light' | 'dark';
export const DarkModePreference = {
  values: ['system', 'light', 'dark'] as DarkModePreference[],
  title: { 'system': "Как в системе", 'light': "Светлая", 'dark': "Тёмная" } as Record<DarkModePreference, string>,
};

export type LearningPace = 'gentle' | 'normal' | 'intensive';
export const LearningPace = {
  values: ['gentle', 'normal', 'intensive'] as LearningPace[],
  title: { 'gentle': "Спокойный", 'normal': "Обычный", 'intensive': "Интенсивный" } as Record<LearningPace, string>,
};

export interface LearningPreferences {
  pace: LearningPace;
  formats: ContentFormat[];
  sessionMinutes: number;
  breakReminders: boolean;
  dailyGoalMinutes: number;
  interests: string[];
  aiHintsEnabled: boolean;
}
export function makeLearningPreferences(init: {} & Partial<LearningPreferences> = {}): LearningPreferences {
  return {
    pace: 'normal',
    formats: ['video', 'text'],
    sessionMinutes: 25,
    breakReminders: true,
    dailyGoalMinutes: 40,
    interests: [],
    aiHintsEnabled: true,
    ...init,
  } as LearningPreferences;
}

export interface AIChatMessage {
  id: string;
  isUser: boolean;
  text: string;
  date: string;
}
export function makeAIChatMessage(init: Pick<AIChatMessage, 'isUser' | 'text'> & Partial<AIChatMessage>): AIChatMessage {
  return {
    id: newId(),
    date: nowISO(),
    ...init,
  } as AIChatMessage;
}

export interface PaymentSettings {
  recipientPhone: string;
  recipientName: string;
  usdToKzt: number;
  eurToKzt: number;
  enabledMethods: PaymentMethod[];
  refundDays: number;
  instructionsFooter: string;
  useAppStoreForDigital: boolean;
}
export function makePaymentSettings(init: {} & Partial<PaymentSettings> = {}): PaymentSettings {
  return {
    recipientPhone: KKSUPaymentDefaults.recipientPhone,
    recipientName: KKSUPaymentDefaults.recipientName,
    usdToKzt: KKSUPaymentDefaults.usdToKzt,
    eurToKzt: KKSUPaymentDefaults.eurToKzt,
    enabledMethods: paymentMethodManualCases(),
    refundDays: 14,
    instructionsFooter: "В комментарии к переводу обязательно укажите код счёта — так мы быстрее найдём ваш платёж.",
    useAppStoreForDigital: true,
    ...init,
  } as PaymentSettings;
}

export type PayCurrency = 'USD' | 'EUR' | 'KZT';
export const PayCurrency = {
  values: ['USD', 'EUR', 'KZT'] as PayCurrency[],
  symbol: { 'USD': "$", 'EUR': "€", 'KZT': "₸" } as Record<PayCurrency, string>,
};

export type PaymentRegion = 'kazakhstan' | 'international';
export const PaymentRegion = {
  values: ['kazakhstan', 'international'] as PaymentRegion[],
};

export type PaymentMethod = 'kaspi' | 'halyk' | 'freedom' | 'jusan' | 'forte' | 'bereke' | 'bcc' | 'homeCredit' | 'otherKZBank' | 'internationalCard' | 'koronaPay' | 'westernUnion' | 'wise' | 'appStore';
export const PaymentMethod = {
  values: ['kaspi', 'halyk', 'freedom', 'jusan', 'forte', 'bereke', 'bcc', 'homeCredit', 'otherKZBank', 'internationalCard', 'koronaPay', 'westernUnion', 'wise', 'appStore'] as PaymentMethod[],
  title: { 'kaspi': "Kaspi.kz", 'halyk': "Halyk Bank (Homebank)", 'freedom': "Freedom Bank", 'jusan': "Jusan Bank", 'forte': "ForteBank", 'bereke': "Bereke Bank", 'bcc': "Банк ЦентрКредит", 'homeCredit': "Home Credit Bank", 'otherKZBank': "Другой банк Казахстана", 'internationalCard': "Карта Visa / Mastercard любой страны", 'koronaPay': "Korona Pay (Золотая Корона)", 'westernUnion': "Western Union", 'wise': "Wise", 'appStore': "App Store (Apple)" } as Record<PaymentMethod, string>,
  icon: { 'kaspi': "k.circle.fill", 'halyk': "h.circle.fill", 'freedom': "building.columns.fill", 'jusan': "building.columns.fill", 'forte': "building.columns.fill", 'bereke': "building.columns.fill", 'bcc': "building.columns.fill", 'homeCredit': "building.columns.fill", 'otherKZBank': "building.columns.fill", 'internationalCard': "creditcard.fill", 'koronaPay': "globe.europe.africa.fill", 'westernUnion': "globe.europe.africa.fill", 'wise': "globe.europe.africa.fill", 'appStore': "apple.logo" } as Record<PaymentMethod, string>,
};

export type ProductKind = 'enrollment' | 'course' | 'teacherAcademy' | 'teacherCertification' | 'marketplaceListing' | 'marketplaceCourse' | 'futureEngineers' | 'globalClassroom' | 'youngInventors' | 'inventionsService' | 'conference' | 'subscription';
export const ProductKind = {
  values: ['enrollment', 'course', 'teacherAcademy', 'teacherCertification', 'marketplaceListing', 'marketplaceCourse', 'futureEngineers', 'globalClassroom', 'youngInventors', 'inventionsService', 'conference', 'subscription'] as ProductKind[],
  title: { 'enrollment': "Статус ученика KKSU", 'course': "Образовательные курсы", 'teacherAcademy': "Teacher Academy", 'teacherCertification': "Сертификация педагогов", 'marketplaceListing': "Публикация курса педагогом", 'marketplaceCourse': "Teacher Marketplace", 'futureEngineers': "Future Engineers", 'globalClassroom': "Global Classroom", 'youngInventors': "Young Inventors 30", 'inventionsService': "Услуги KKSU Inventions", 'conference': "Конференции", 'subscription': "Подписка KKSU" } as Record<ProductKind, string>,
  icon: { 'enrollment': "graduationcap.fill", 'course': "book.fill", 'teacherAcademy': "building.columns.fill", 'teacherCertification': "rosette", 'marketplaceListing': "megaphone.fill", 'marketplaceCourse': "storefront.fill", 'futureEngineers': "wrench.and.screwdriver.fill", 'globalClassroom': "globe.europe.africa.fill", 'youngInventors': "sparkles", 'inventionsService': "hammer.fill", 'conference': "calendar.badge.plus", 'subscription': "star.circle.fill" } as Record<ProductKind, string>,
  isDigital: { 'enrollment': true, 'course': true, 'teacherAcademy': true, 'teacherCertification': true, 'marketplaceListing': true, 'marketplaceCourse': true, 'futureEngineers': true, 'globalClassroom': true, 'youngInventors': false, 'inventionsService': false, 'conference': false, 'subscription': true } as Record<ProductKind, boolean>,
};

export interface Product {
  id: string;
  title: string;
  kind: ProductKind;
  priceUSD: number;
  summary: string;
  refID?: string;
  sellerID?: string;
  durationDays?: number;
  familySeats: number;
  isActive: boolean;
}
export function makeProduct(init: Pick<Product, 'title' | 'kind' | 'priceUSD' | 'summary'> & Partial<Product>): Product {
  return {
    id: newId(),
    familySeats: 0,
    isActive: true,
    ...init,
  } as Product;
}

export interface PromoCode {
  id: string;
  code: string;
  percentOff: number;
  amountOffUSD: number;
  validUntil?: string;
  maxUses: number;
  uses: number;
  kinds: ProductKind[];
  isActive: boolean;
}
export function makePromoCode(init: Pick<PromoCode, 'code'> & Partial<PromoCode>): PromoCode {
  return {
    id: newId(),
    percentOff: 0,
    amountOffUSD: 0,
    maxUses: 0,
    uses: 0,
    kinds: [],
    isActive: true,
    ...init,
  } as PromoCode;
}

export type PaymentStatus = 'awaitingPayment' | 'pendingConfirmation' | 'paid' | 'cancelled' | 'rejected' | 'refundRequested' | 'refunded';
export const PaymentStatus = {
  values: ['awaitingPayment', 'pendingConfirmation', 'paid', 'cancelled', 'rejected', 'refundRequested', 'refunded'] as PaymentStatus[],
  title: { 'awaitingPayment': "Ожидает оплаты", 'pendingConfirmation': "Проверяется", 'paid': "Оплачен", 'cancelled': "Отменён", 'rejected': "Платёж не найден", 'refundRequested': "Запрошен возврат", 'refunded': "Возвращён" } as Record<PaymentStatus, string>,
  icon: { 'awaitingPayment': "clock", 'pendingConfirmation': "hourglass", 'paid': "checkmark.seal.fill", 'cancelled': "xmark.circle", 'rejected': "exclamationmark.triangle.fill", 'refundRequested': "arrow.uturn.backward.circle", 'refunded': "arrow.uturn.backward.circle.fill" } as Record<PaymentStatus, string>,
};

export interface Invoice {
  id: string;
  number: string;
  payerID: string;
  beneficiaryIDs: string[];
  productID: string;
  productTitle: string;
  productKind: ProductKind;
  targetID?: string;
  priceUSD: number;
  discountUSD: number;
  promoCode?: string;
  currency: PayCurrency;
  rate: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  payerNote: string;
  receipt?: Attachment;
  paidAt?: string;
  confirmedBy?: string;
  refundReason: string;
  refundedAt?: string;
  storeProductID?: string;
  appStoreTransactionID?: string;
}
export function makeInvoice(init: Pick<Invoice, 'number' | 'payerID' | 'beneficiaryIDs' | 'productID' | 'productTitle' | 'productKind' | 'priceUSD' | 'rate'> & Partial<Invoice>): Invoice {
  return {
    id: newId(),
    discountUSD: 0,
    currency: 'KZT',
    method: 'kaspi',
    status: 'awaitingPayment',
    createdAt: nowISO(),
    payerNote: "",
    refundReason: "",
    ...init,
  } as Invoice;
}

export type AccessSource = 'payment' | 'scholarship' | 'free' | 'subscription' | 'bundle';
export const AccessSource = {
  values: ['payment', 'scholarship', 'free', 'subscription', 'bundle'] as AccessSource[],
  title: { 'payment': "Оплата", 'scholarship': "Стипендия / бесплатный доступ", 'free': "Бесплатно", 'subscription': "Подписка", 'bundle': "Входит в пакет" } as Record<AccessSource, string>,
};

export interface Entitlement {
  id: string;
  userID: string;
  productID: string;
  source: AccessSource;
  grantedAt: string;
  expiresAt?: string;
  invoiceID?: string;
  grantedBy?: string;
  note: string;
  revoked: boolean;
}
export function makeEntitlement(init: Pick<Entitlement, 'userID' | 'productID' | 'source'> & Partial<Entitlement>): Entitlement {
  return {
    id: newId(),
    grantedAt: nowISO(),
    note: "",
    revoked: false,
    ...init,
  } as Entitlement;
}

export type MarketplaceCourseStatus = 'draft' | 'awaitingListingFee' | 'published' | 'archived';
export const MarketplaceCourseStatus = {
  values: ['draft', 'awaitingListingFee', 'published', 'archived'] as MarketplaceCourseStatus[],
  title: { 'draft': "Черновик", 'awaitingListingFee': "Ожидает оплаты публикации", 'published': "Опубликован", 'archived': "В архиве" } as Record<MarketplaceCourseStatus, string>,
};

export interface MarketplaceCourse {
  id: string;
  teacherID: string;
  title: string;
  summary: string;
  subject: string;
  lessons: string[];
  priceUSD: number;
  status: MarketplaceCourseStatus;
  createdAt: string;
}
export function makeMarketplaceCourse(init: Pick<MarketplaceCourse, 'teacherID' | 'title' | 'summary' | 'subject' | 'lessons' | 'priceUSD'> & Partial<MarketplaceCourse>): MarketplaceCourse {
  return {
    id: newId(),
    status: 'draft',
    createdAt: nowISO(),
    ...init,
  } as MarketplaceCourse;
}

export interface LessonLink {
  id: string;
  title: string;
  url: string;
}
export function makeLessonLink(init: Pick<LessonLink, 'title' | 'url'> & Partial<LessonLink>): LessonLink {
  return {
    id: newId(),
    ...init,
  } as LessonLink;
}

export interface CourseLesson {
  id: string;
  title: string;
  summary: string;
  liveStart?: string;
  liveDurationMinutes: number;
  livePlatform: ConferencePlatform;
  liveURL: string;
  sessionID?: string;
  videoURL: string;
  notes: string;
  attachments: Attachment[];
  links: LessonLink[];
  testID?: string;
  assignmentID?: string;
  isPublished: boolean;
}
export function makeCourseLesson(init: Pick<CourseLesson, 'title'> & Partial<CourseLesson>): CourseLesson {
  return {
    id: newId(),
    summary: "",
    liveDurationMinutes: 45,
    livePlatform: 'jitsi',
    liveURL: "",
    videoURL: "",
    notes: "",
    attachments: [],
    links: [],
    isPublished: true,
    ...init,
  } as CourseLesson;
}

export interface SchoolCourse {
  id: string;
  title: string;
  subject: string;
  summary: string;
  teacherID?: string;
  studentIDs: string[];
  icon: string;
  isPublished: boolean;
  createdAt: string;
  lessons: CourseLesson[];
}
export function makeSchoolCourse(init: Pick<SchoolCourse, 'title' | 'subject'> & Partial<SchoolCourse>): SchoolCourse {
  return {
    id: newId(),
    summary: "",
    studentIDs: [],
    icon: "book.closed.fill",
    isPublished: false,
    createdAt: nowISO(),
    lessons: [],
    ...init,
  } as SchoolCourse;
}

export interface LessonProgress {
  id: string;
  courseID: string;
  lessonID: string;
  studentID: string;
  completedAt: string;
}
export function makeLessonProgress(init: Pick<LessonProgress, 'courseID' | 'lessonID' | 'studentID'> & Partial<LessonProgress>): LessonProgress {
  return {
    id: newId(),
    completedAt: nowISO(),
    ...init,
  } as LessonProgress;
}

export type ReportReason = 'harassment' | 'inappropriate' | 'spam' | 'violence' | 'personalData' | 'other';
export const ReportReason = {
  values: ['harassment', 'inappropriate', 'spam', 'violence', 'personalData', 'other'] as ReportReason[],
  title: { 'harassment': "Оскорбления или травля", 'inappropriate': "Неприемлемый контент", 'spam': "Спам или реклама", 'violence': "Угрозы или насилие", 'personalData': "Чужие личные данные", 'other': "Другое" } as Record<ReportReason, string>,
};

export type ReportedContentKind = 'message' | 'project' | 'user' | 'lesson';
export const ReportedContentKind = {
  values: ['message', 'project', 'user', 'lesson'] as ReportedContentKind[],
  title: { 'message': "Сообщение", 'project': "Проект на выставке", 'user': "Пользователь", 'lesson': "Материал урока" } as Record<ReportedContentKind, string>,
  icon: { 'message': "bubble.left.fill", 'project': "lightbulb.fill", 'user': "person.fill", 'lesson': "book.closed.fill" } as Record<ReportedContentKind, string>,
};

export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export const ReportStatus = {
  values: ['open', 'resolved', 'dismissed'] as ReportStatus[],
  title: { 'open': "Новая", 'resolved': "Приняты меры", 'dismissed': "Отклонена" } as Record<ReportStatus, string>,
};

export interface ContentReport {
  id: string;
  reporterID: string;
  reportedUserID?: string;
  kind: ReportedContentKind;
  contentID?: string;
  excerpt: string;
  reason: ReportReason;
  comment: string;
  createdAt: string;
  status: ReportStatus;
  resolution: string;
  resolvedAt?: string;
}
export function makeContentReport(init: Pick<ContentReport, 'reporterID' | 'kind' | 'excerpt' | 'reason'> & Partial<ContentReport>): ContentReport {
  return {
    id: newId(),
    comment: "",
    createdAt: nowISO(),
    status: 'open',
    resolution: "",
    ...init,
  } as ContentReport;
}

export interface UserBlock {
  id: string;
  blockerID: string;
  blockedID: string;
  createdAt: string;
}
export function makeUserBlock(init: Pick<UserBlock, 'blockerID' | 'blockedID'> & Partial<UserBlock>): UserBlock {
  return {
    id: newId(),
    createdAt: nowISO(),
    ...init,
  } as UserBlock;
}

/** Типы полей каждой модели: для приведения к формату Swift Codable перед записью на сервер. */
export const SCHEMA: Record<string, Record<string, FieldInfo>> = {
  KKSUUser: {
    id: { kind: "uuid", optional: false },
    fullName: { kind: "string", optional: false },
    email: { kind: "string", optional: false },
    phone: { kind: "string", optional: false },
    role: { kind: "string", optional: false },
    passwordHash: { kind: "string", optional: false },
    salt: { kind: "string", optional: false },
    createdAt: { kind: "date", optional: false },
    isBlocked: { kind: "bool", optional: false },
    linkedStudentIDs: { kind: {"array": "uuid"}, optional: false },
    partnerID: { kind: "uuid", optional: true },
    recoveryCode: { kind: "string", optional: true },
    recoveryExpires: { kind: "date", optional: true },
    lastLogin: { kind: "date", optional: true },
  },
  StudentProfile: {
    id: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    birthDate: { kind: "date", optional: false },
    grade: { kind: "string", optional: false },
    school: { kind: "string", optional: false },
    city: { kind: "string", optional: false },
    interests: { kind: {"array": "string"}, optional: false },
    specialNeeds: { kind: "string", optional: false },
    supportNotes: { kind: "string", optional: false },
    goals: { kind: "string", optional: false },
    avatarSymbol: { kind: "string", optional: false },
    xp: { kind: "int", optional: false },
  },
  IntakeQuestionnaire: {
    id: { kind: "uuid", optional: false },
    studentID: { kind: "uuid", optional: false },
    date: { kind: "date", optional: false },
    learningFormat: { kind: "string", optional: false },
    strengths: { kind: "string", optional: false },
    difficulties: { kind: "string", optional: false },
    healthNotes: { kind: "string", optional: false },
    communication: { kind: "string", optional: false },
    parentExpectations: { kind: "string", optional: false },
    assistiveTech: { kind: {"array": "string"}, optional: false },
    needsPsychologist: { kind: "bool", optional: false },
  },
  EnrollmentApplication: {
    id: { kind: "uuid", optional: false },
    applicantUserID: { kind: "uuid", optional: true },
    childName: { kind: "string", optional: false },
    childAge: { kind: "int", optional: false },
    parentName: { kind: "string", optional: false },
    email: { kind: "string", optional: false },
    phone: { kind: "string", optional: false },
    programID: { kind: "uuid", optional: true },
    format: { kind: "string", optional: false },
    comment: { kind: "string", optional: false },
    status: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
  },
  ParentConsent: {
    id: { kind: "uuid", optional: false },
    studentID: { kind: "uuid", optional: false },
    parentID: { kind: "uuid", optional: false },
    type: { kind: "string", optional: false },
    granted: { kind: "bool", optional: false },
    signatureName: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
  },
  EducationProgram: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    direction: { kind: "string", optional: false },
    ageRange: { kind: "string", optional: false },
    durationWeeks: { kind: "int", optional: false },
    format: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    subjects: { kind: {"array": "string"}, optional: false },
    seats: { kind: "int", optional: false },
  },
  TrajectoryStep: {
    id: { kind: "uuid", optional: false },
    studentID: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    programID: { kind: "uuid", optional: true },
    targetDate: { kind: "date", optional: false },
    status: { kind: "string", optional: false },
    note: { kind: "string", optional: false },
  },
  StudyPlanItem: {
    id: { kind: "uuid", optional: false },
    studentID: { kind: "uuid", optional: false },
    subject: { kind: "string", optional: false },
    hoursPerWeek: { kind: "int", optional: false },
    goal: { kind: "string", optional: false },
    term: { kind: "string", optional: false },
    adaptation: { kind: "string", optional: false },
  },
  ScheduleSession: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    subject: { kind: "string", optional: false },
    teacherID: { kind: "uuid", optional: true },
    start: { kind: "date", optional: false },
    durationMinutes: { kind: "int", optional: false },
    room: { kind: "string", optional: false },
    isOnline: { kind: "bool", optional: false },
    platform: { kind: "string", optional: false },
    meetingURL: { kind: "string", optional: false },
    participantIDs: { kind: {"array": "uuid"}, optional: false },
    attendedIDs: { kind: {"array": "uuid"}, optional: false },
    recordingURL: { kind: "string", optional: false },
  },
  CalendarNote: {
    id: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
  },
  Assignment: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    subject: { kind: "string", optional: false },
    details: { kind: "string", optional: false },
    teacherID: { kind: "uuid", optional: true },
    createdAt: { kind: "date", optional: false },
    dueDate: { kind: "date", optional: false },
    maxScore: { kind: "int", optional: false },
    assignedIDs: { kind: {"array": "uuid"}, optional: false },
    audience: { kind: "string", optional: false },
    courseID: { kind: "uuid", optional: true },
    isAIGenerated: { kind: "bool", optional: false },
    approvedByTeacher: { kind: "bool", optional: false },
    textAlternative: { kind: "string", optional: false },
  },
  Attachment: {
    id: { kind: "uuid", optional: false },
    fileName: { kind: "string", optional: false },
    kind: { kind: "string", optional: false },
    sizeBytes: { kind: "int", optional: false },
    storedName: { kind: "string", optional: true },
    remoteURL: { kind: "string", optional: true },
    altText: { kind: "string", optional: false },
  },
  Submission: {
    id: { kind: "uuid", optional: false },
    assignmentID: { kind: "uuid", optional: false },
    studentID: { kind: "uuid", optional: false },
    submittedAt: { kind: "date", optional: false },
    text: { kind: "string", optional: false },
    attachments: { kind: {"array": "Attachment"}, optional: false },
    score: { kind: "int", optional: true },
    feedback: { kind: "string", optional: false },
    gradedAt: { kind: "date", optional: true },
    gradedBy: { kind: "uuid", optional: true },
    status: { kind: "string", optional: false },
  },
  PortfolioItem: {
    id: { kind: "uuid", optional: false },
    studentID: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    category: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    summary: { kind: "string", optional: false },
    attachments: { kind: {"array": "Attachment"}, optional: false },
    verifiedBy: { kind: "uuid", optional: true },
  },
  Achievement: {
    id: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    icon: { kind: "string", optional: false },
    points: { kind: "int", optional: false },
    date: { kind: "date", optional: false },
  },
  Certificate: {
    id: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    recipientName: { kind: "string", optional: false },
    title: { kind: "string", optional: false },
    issuer: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    serial: { kind: "string", optional: false },
    hours: { kind: "int", optional: true },
  },
  HistoryEntry: {
    id: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    date: { kind: "date", optional: false },
    action: { kind: "string", optional: false },
    details: { kind: "string", optional: false },
    icon: { kind: "string", optional: false },
  },
  CaptionSegment: {
    start: { kind: "double", optional: false },
    end: { kind: "double", optional: false },
    text: { kind: "string", optional: false },
  },
  LibraryItem: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    kind: { kind: "string", optional: false },
    subject: { kind: "string", optional: false },
    author: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    url: { kind: "string", optional: false },
    durationMinutes: { kind: "int", optional: false },
    captions: { kind: {"array": "CaptionSegment"}, optional: false },
    textAlternative: { kind: "string", optional: false },
    tags: { kind: {"array": "string"}, optional: false },
    forTeachers: { kind: "bool", optional: false },
    isTeacherAcademy: { kind: "bool", optional: false },
    views: { kind: "int", optional: false },
  },
  TestQuestion: {
    id: { kind: "uuid", optional: false },
    text: { kind: "string", optional: false },
    kind: { kind: "string", optional: false },
    options: { kind: {"array": "string"}, optional: false },
    correctIndices: { kind: {"array": "int"}, optional: false },
    correctText: { kind: "string", optional: false },
    points: { kind: "int", optional: false },
    explanation: { kind: "string", optional: false },
  },
  KKSUTest: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    subject: { kind: "string", optional: false },
    authorID: { kind: "uuid", optional: true },
    questions: { kind: {"array": "TestQuestion"}, optional: false },
    timeLimitMinutes: { kind: "int", optional: false },
    passingPercent: { kind: "int", optional: false },
    audience: { kind: "string", optional: false },
    courseID: { kind: "uuid", optional: true },
    isPublished: { kind: "bool", optional: false },
  },
  TestAnswer: {
    questionID: { kind: "uuid", optional: false },
    selected: { kind: {"array": "int"}, optional: false },
    text: { kind: "string", optional: false },
  },
  TestAttempt: {
    id: { kind: "uuid", optional: false },
    testID: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    date: { kind: "date", optional: false },
    answers: { kind: {"array": "TestAnswer"}, optional: false },
    score: { kind: "int", optional: false },
    maxScore: { kind: "int", optional: false },
    passed: { kind: "bool", optional: false },
  },
  ChatThread: {
    id: { kind: "uuid", optional: false },
    participantIDs: { kind: {"array": "uuid"}, optional: false },
    title: { kind: "string", optional: false },
  },
  ChatMessage: {
    id: { kind: "uuid", optional: false },
    threadID: { kind: "uuid", optional: false },
    senderID: { kind: "uuid", optional: false },
    text: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    readBy: { kind: {"array": "uuid"}, optional: false },
  },
  KKSUNotification: {
    id: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    body: { kind: "string", optional: false },
    kind: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    isRead: { kind: "bool", optional: false },
  },
  TeacherAcademyProfile: {
    id: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    specialization: { kind: "string", optional: false },
    experienceYears: { kind: "int", optional: false },
    organization: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
  },
  TeacherCourse: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    hours: { kind: "int", optional: false },
    level: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    modules: { kind: {"array": "string"}, optional: false },
    enrolledIDs: { kind: {"array": "uuid"}, optional: false },
    completedModules: { kind: {"map": {"array": "string"}}, optional: false },
    completedIDs: { kind: {"array": "uuid"}, optional: false },
  },
  Methodology: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    author: { kind: "string", optional: false },
    subject: { kind: "string", optional: false },
    ageGroup: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    status: { kind: "string", optional: false },
    documents: { kind: {"array": "Attachment"}, optional: false },
  },
  MethodologyPilot: {
    id: { kind: "uuid", optional: false },
    methodologyID: { kind: "uuid", optional: false },
    site: { kind: "string", optional: false },
    teacherName: { kind: "string", optional: false },
    startDate: { kind: "date", optional: false },
    endDate: { kind: "date", optional: false },
    participants: { kind: "int", optional: false },
    baselineScore: { kind: "double", optional: false },
    finalScore: { kind: "double", optional: false },
    summary: { kind: "string", optional: false },
  },
  ReviewScore: {
    criterion: { kind: "string", optional: false },
    score: { kind: "int", optional: false },
  },
  ExpertReview: {
    id: { kind: "uuid", optional: false },
    targetID: { kind: "uuid", optional: false },
    target: { kind: "string", optional: false },
    expertID: { kind: "uuid", optional: false },
    date: { kind: "date", optional: false },
    scores: { kind: {"array": "ReviewScore"}, optional: false },
    comment: { kind: "string", optional: false },
    decision: { kind: "string", optional: false },
  },
  InventionProject: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    problem: { kind: "string", optional: false },
    solution: { kind: "string", optional: false },
    stage: { kind: "string", optional: false },
    track: { kind: "string", optional: false },
    teamID: { kind: "uuid", optional: true },
    mentorID: { kind: "uuid", optional: true },
    authorIDs: { kind: {"array": "uuid"}, optional: false },
    media: { kind: {"array": "Attachment"}, optional: false },
    createdAt: { kind: "date", optional: false },
    stageHistory: { kind: {"array": "StageChange"}, optional: false },
    isPrototype: { kind: "bool", optional: false },
    prototypeSpecs: { kind: "string", optional: false },
    inclusiveTarget: { kind: "string", optional: false },
    showInExhibition: { kind: "bool", optional: false },
    likes: { kind: "int", optional: false },
    tags: { kind: {"array": "string"}, optional: false },
  },
  StageChange: {
    stage: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    note: { kind: "string", optional: false },
  },
  ProjectTeam: {
    id: { kind: "uuid", optional: false },
    name: { kind: "string", optional: false },
    memberIDs: { kind: {"array": "uuid"}, optional: false },
    captainID: { kind: "uuid", optional: true },
  },
  ExperimentEntry: {
    id: { kind: "uuid", optional: false },
    projectID: { kind: "uuid", optional: false },
    authorID: { kind: "uuid", optional: false },
    date: { kind: "date", optional: false },
    hypothesis: { kind: "string", optional: false },
    method: { kind: "string", optional: false },
    result: { kind: "string", optional: false },
    conclusion: { kind: "string", optional: false },
    success: { kind: "bool", optional: false },
  },
  LabMeasurement: {
    id: { kind: "uuid", optional: false },
    name: { kind: "string", optional: false },
    value: { kind: "double", optional: false },
    unit: { kind: "string", optional: false },
  },
  LabNotebookPage: {
    id: { kind: "uuid", optional: false },
    projectID: { kind: "uuid", optional: false },
    authorID: { kind: "uuid", optional: false },
    date: { kind: "date", optional: false },
    title: { kind: "string", optional: false },
    content: { kind: "string", optional: false },
    measurements: { kind: {"array": "LabMeasurement"}, optional: false },
    signedByMentor: { kind: "bool", optional: false },
  },
  YoungInventorsApplication: {
    id: { kind: "uuid", optional: false },
    projectID: { kind: "uuid", optional: false },
    applicantID: { kind: "uuid", optional: false },
    season: { kind: "string", optional: false },
    nomination: { kind: "string", optional: false },
    motivation: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    status: { kind: "string", optional: false },
  },
  GlobalClass: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    country: { kind: "string", optional: false },
    language: { kind: "string", optional: false },
    partnerSchool: { kind: "string", optional: false },
    teacherName: { kind: "string", optional: false },
    start: { kind: "date", optional: false },
    summary: { kind: "string", optional: false },
    meetingURL: { kind: "string", optional: false },
    participantIDs: { kind: {"array": "uuid"}, optional: false },
  },
  InternationalProject: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    countries: { kind: {"array": "string"}, optional: false },
    partners: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    participantIDs: { kind: {"array": "uuid"}, optional: false },
    isActive: { kind: "bool", optional: false },
  },
  InternationalExpert: {
    id: { kind: "uuid", optional: false },
    name: { kind: "string", optional: false },
    country: { kind: "string", optional: false },
    expertise: { kind: "string", optional: false },
    bio: { kind: "string", optional: false },
    email: { kind: "string", optional: false },
    isTeacher: { kind: "bool", optional: false },
  },
  EngineeringCourse: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    track: { kind: "string", optional: false },
    level: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    lessons: { kind: {"array": "string"}, optional: false },
    enrolledIDs: { kind: {"array": "uuid"}, optional: false },
  },
  EngineeringChallenge: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    track: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    steps: { kind: {"array": "string"}, optional: false },
    difficulty: { kind: "int", optional: false },
    points: { kind: "int", optional: false },
    isIndustryCase: { kind: "bool", optional: false },
    company: { kind: "string", optional: false },
    completedIDs: { kind: {"array": "uuid"}, optional: false },
  },
  Partner: {
    id: { kind: "uuid", optional: false },
    name: { kind: "string", optional: false },
    kind: { kind: "string", optional: false },
    country: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    email: { kind: "string", optional: false },
    website: { kind: "string", optional: false },
    since: { kind: "date", optional: false },
  },
  Internship: {
    id: { kind: "uuid", optional: false },
    partnerID: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    requirements: { kind: "string", optional: false },
    start: { kind: "date", optional: false },
    durationWeeks: { kind: "int", optional: false },
    seats: { kind: "int", optional: false },
    isOpen: { kind: "bool", optional: false },
  },
  InternshipApplication: {
    id: { kind: "uuid", optional: false },
    internshipID: { kind: "uuid", optional: false },
    studentID: { kind: "uuid", optional: false },
    motivation: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    status: { kind: "string", optional: false },
  },
  KKSUEvent: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    kind: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    location: { kind: "string", optional: false },
    isOnline: { kind: "bool", optional: false },
    meetingURL: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    capacity: { kind: "int", optional: false },
    isInternational: { kind: "bool", optional: false },
    hours: { kind: "int", optional: false },
  },
  EventRegistration: {
    id: { kind: "uuid", optional: false },
    eventID: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    role: { kind: "string", optional: false },
    talkTitle: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
    attended: { kind: "bool", optional: false },
    certificateID: { kind: "uuid", optional: true },
  },
  AccessibilitySettings: {
    textScale: { kind: "double", optional: false },
    highContrast: { kind: "bool", optional: false },
    boldText: { kind: "bool", optional: false },
    dyslexiaFriendlyFont: { kind: "bool", optional: false },
    reduceMotion: { kind: "bool", optional: false },
    simplifiedInterface: { kind: "bool", optional: false },
    largeButtons: { kind: "bool", optional: false },
    captionsEnabled: { kind: "bool", optional: false },
    showTextAlternatives: { kind: "bool", optional: false },
    darkMode: { kind: "string", optional: false },
  },
  LearningPreferences: {
    pace: { kind: "string", optional: false },
    formats: { kind: {"array": "string"}, optional: false },
    sessionMinutes: { kind: "int", optional: false },
    breakReminders: { kind: "bool", optional: false },
    dailyGoalMinutes: { kind: "int", optional: false },
    interests: { kind: {"array": "string"}, optional: false },
    aiHintsEnabled: { kind: "bool", optional: false },
  },
  AIChatMessage: {
    id: { kind: "uuid", optional: false },
    isUser: { kind: "bool", optional: false },
    text: { kind: "string", optional: false },
    date: { kind: "date", optional: false },
  },
  PaymentSettings: {
    recipientPhone: { kind: "string", optional: false },
    recipientName: { kind: "string", optional: false },
    usdToKzt: { kind: "double", optional: false },
    eurToKzt: { kind: "double", optional: false },
    enabledMethods: { kind: {"array": "string"}, optional: false },
    refundDays: { kind: "int", optional: false },
    instructionsFooter: { kind: "string", optional: false },
    useAppStoreForDigital: { kind: "bool", optional: false },
  },
  Product: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    kind: { kind: "string", optional: false },
    priceUSD: { kind: "double", optional: false },
    summary: { kind: "string", optional: false },
    refID: { kind: "uuid", optional: true },
    sellerID: { kind: "uuid", optional: true },
    durationDays: { kind: "int", optional: true },
    familySeats: { kind: "int", optional: false },
    isActive: { kind: "bool", optional: false },
  },
  PromoCode: {
    id: { kind: "uuid", optional: false },
    code: { kind: "string", optional: false },
    percentOff: { kind: "double", optional: false },
    amountOffUSD: { kind: "double", optional: false },
    validUntil: { kind: "date", optional: true },
    maxUses: { kind: "int", optional: false },
    uses: { kind: "int", optional: false },
    kinds: { kind: {"array": "string"}, optional: false },
    isActive: { kind: "bool", optional: false },
  },
  Invoice: {
    id: { kind: "uuid", optional: false },
    number: { kind: "string", optional: false },
    payerID: { kind: "uuid", optional: false },
    beneficiaryIDs: { kind: {"array": "uuid"}, optional: false },
    productID: { kind: "uuid", optional: false },
    productTitle: { kind: "string", optional: false },
    productKind: { kind: "string", optional: false },
    targetID: { kind: "uuid", optional: true },
    priceUSD: { kind: "double", optional: false },
    discountUSD: { kind: "double", optional: false },
    promoCode: { kind: "string", optional: true },
    currency: { kind: "string", optional: false },
    rate: { kind: "double", optional: false },
    method: { kind: "string", optional: false },
    status: { kind: "string", optional: false },
    createdAt: { kind: "date", optional: false },
    payerNote: { kind: "string", optional: false },
    receipt: { kind: "Attachment", optional: true },
    paidAt: { kind: "date", optional: true },
    confirmedBy: { kind: "uuid", optional: true },
    refundReason: { kind: "string", optional: false },
    refundedAt: { kind: "date", optional: true },
    storeProductID: { kind: "string", optional: true },
    appStoreTransactionID: { kind: "string", optional: true },
  },
  Entitlement: {
    id: { kind: "uuid", optional: false },
    userID: { kind: "uuid", optional: false },
    productID: { kind: "uuid", optional: false },
    source: { kind: "string", optional: false },
    grantedAt: { kind: "date", optional: false },
    expiresAt: { kind: "date", optional: true },
    invoiceID: { kind: "uuid", optional: true },
    grantedBy: { kind: "uuid", optional: true },
    note: { kind: "string", optional: false },
    revoked: { kind: "bool", optional: false },
  },
  MarketplaceCourse: {
    id: { kind: "uuid", optional: false },
    teacherID: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    subject: { kind: "string", optional: false },
    lessons: { kind: {"array": "string"}, optional: false },
    priceUSD: { kind: "double", optional: false },
    status: { kind: "string", optional: false },
    createdAt: { kind: "date", optional: false },
  },
  LessonLink: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    url: { kind: "string", optional: false },
  },
  CourseLesson: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    liveStart: { kind: "date", optional: true },
    liveDurationMinutes: { kind: "int", optional: false },
    livePlatform: { kind: "string", optional: false },
    liveURL: { kind: "string", optional: false },
    sessionID: { kind: "uuid", optional: true },
    videoURL: { kind: "string", optional: false },
    notes: { kind: "string", optional: false },
    attachments: { kind: {"array": "Attachment"}, optional: false },
    links: { kind: {"array": "LessonLink"}, optional: false },
    testID: { kind: "uuid", optional: true },
    assignmentID: { kind: "uuid", optional: true },
    isPublished: { kind: "bool", optional: false },
  },
  SchoolCourse: {
    id: { kind: "uuid", optional: false },
    title: { kind: "string", optional: false },
    subject: { kind: "string", optional: false },
    summary: { kind: "string", optional: false },
    teacherID: { kind: "uuid", optional: true },
    studentIDs: { kind: {"array": "uuid"}, optional: false },
    icon: { kind: "string", optional: false },
    isPublished: { kind: "bool", optional: false },
    createdAt: { kind: "date", optional: false },
    lessons: { kind: {"array": "CourseLesson"}, optional: false },
  },
  LessonProgress: {
    id: { kind: "uuid", optional: false },
    courseID: { kind: "uuid", optional: false },
    lessonID: { kind: "uuid", optional: false },
    studentID: { kind: "uuid", optional: false },
    completedAt: { kind: "date", optional: false },
  },
  ContentReport: {
    id: { kind: "uuid", optional: false },
    reporterID: { kind: "uuid", optional: false },
    reportedUserID: { kind: "uuid", optional: true },
    kind: { kind: "string", optional: false },
    contentID: { kind: "uuid", optional: true },
    excerpt: { kind: "string", optional: false },
    reason: { kind: "string", optional: false },
    comment: { kind: "string", optional: false },
    createdAt: { kind: "date", optional: false },
    status: { kind: "string", optional: false },
    resolution: { kind: "string", optional: false },
    resolvedAt: { kind: "date", optional: true },
  },
  UserBlock: {
    id: { kind: "uuid", optional: false },
    blockerID: { kind: "uuid", optional: false },
    blockedID: { kind: "uuid", optional: false },
    createdAt: { kind: "date", optional: false },
  },
};
