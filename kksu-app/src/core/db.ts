// База данных сайта — те же коллекции, что KKSUDatabase и KKSUBillingDatabase в iOS-приложении.
import type * as M from './models.gen';
import { makePaymentSettings } from './models.gen';

export interface KKSUDatabase {
  users: M.KKSUUser[];
  studentProfiles: M.StudentProfile[];
  questionnaires: M.IntakeQuestionnaire[];
  applications: M.EnrollmentApplication[];
  consents: M.ParentConsent[];
  programs: M.EducationProgram[];
  trajectory: M.TrajectoryStep[];
  studyPlan: M.StudyPlanItem[];
  sessions: M.ScheduleSession[];
  calendarNotes: M.CalendarNote[];
  assignments: M.Assignment[];
  submissions: M.Submission[];
  portfolio: M.PortfolioItem[];
  achievements: M.Achievement[];
  certificates: M.Certificate[];
  history: M.HistoryEntry[];
  library: M.LibraryItem[];
  tests: M.KKSUTest[];
  attempts: M.TestAttempt[];
  threads: M.ChatThread[];
  messages: M.ChatMessage[];
  notifications: M.KKSUNotification[];
  academyProfiles: M.TeacherAcademyProfile[];
  teacherCourses: M.TeacherCourse[];
  methodologies: M.Methodology[];
  pilots: M.MethodologyPilot[];
  reviews: M.ExpertReview[];
  projects: M.InventionProject[];
  teams: M.ProjectTeam[];
  experiments: M.ExperimentEntry[];
  notebook: M.LabNotebookPage[];
  yiApplications: M.YoungInventorsApplication[];
  globalClasses: M.GlobalClass[];
  internationalProjects: M.InternationalProject[];
  internationalExperts: M.InternationalExpert[];
  engineeringCourses: M.EngineeringCourse[];
  challenges: M.EngineeringChallenge[];
  partners: M.Partner[];
  internships: M.Internship[];
  internshipApplications: M.InternshipApplication[];
  events: M.KKSUEvent[];
  eventRegistrations: M.EventRegistration[];
  schoolCourses: M.SchoolCourse[];
  lessonProgress: M.LessonProgress[];
  contentReports: M.ContentReport[];
  userBlocks: M.UserBlock[];
  /** Личные настройки по id пользователя (синхронизируются записью userSettings). */
  accessibility: Record<string, M.AccessibilitySettings>;
  preferences: Record<string, M.LearningPreferences>;
  /** Только в этом браузере (как в iOS — не синхронизируются). */
  aiChats: Record<string, M.AIChatMessage[]>;
  viewedLibraryIDs: Record<string, string[]>;
  currentUserID?: string;
}

export interface KKSUBillingDatabase {
  settings: M.PaymentSettings;
  products: M.Product[];
  invoices: M.Invoice[];
  entitlements: M.Entitlement[];
  promoCodes: M.PromoCode[];
  marketplaceCourses: M.MarketplaceCourse[];
  invoiceCounter: number;
}

export type ListKey = { [K in keyof KKSUDatabase]-?: KKSUDatabase[K] extends unknown[] ? K : never }[keyof KKSUDatabase] & keyof KKSUDatabase;
export type BillingListKey = 'products' | 'invoices' | 'entitlements' | 'promoCodes' | 'marketplaceCourses';

export function emptyDatabase(): KKSUDatabase {
  return {
    users: [], studentProfiles: [], questionnaires: [], applications: [], consents: [], programs: [],
    trajectory: [], studyPlan: [], sessions: [], calendarNotes: [], assignments: [], submissions: [],
    portfolio: [], achievements: [], certificates: [], history: [], library: [], tests: [], attempts: [],
    threads: [], messages: [], notifications: [], academyProfiles: [], teacherCourses: [], methodologies: [],
    pilots: [], reviews: [], projects: [], teams: [], experiments: [], notebook: [], yiApplications: [],
    globalClasses: [], internationalProjects: [], internationalExperts: [], engineeringCourses: [],
    challenges: [], partners: [], internships: [], internshipApplications: [], events: [],
    eventRegistrations: [], schoolCourses: [], lessonProgress: [], contentReports: [], userBlocks: [],
    accessibility: {}, preferences: {}, aiChats: {}, viewedLibraryIDs: {},
  };
}

export function emptyBilling(): KKSUBillingDatabase {
  return { settings: makePaymentSettings(), products: [], invoices: [], entitlements: [], promoCodes: [], marketplaceCourses: [], invoiceCounter: 0 };
}
