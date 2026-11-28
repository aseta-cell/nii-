// Реестр экранов модулей: маршрут KKSURoute → компонент страницы (как KKSURoute.destination в iOS).
import type { ComponentType } from 'react';
import { ROUTES, ROUTE_IDS, type RouteId } from '../core/routes.gen';
import { EmptyState, Page } from '../ui/kit';
import { FeatureMap } from '../App';
import { ChatScreen, ModerationScreen, NotificationsScreen } from './Communication';
import {
  AdminPanel, ExpertCabinet, ParentCabinet, PartnerCabinet, PsychologistCabinet, ScheduleScreen, StudentCabinet, TeacherCabinet, UsersScreen,
} from './Cabinets';
import {
  AchievementsScreen, ApplicationScreen, CalendarScreen, ConsentsScreen, DeadlinesScreen, GradingScreen, HistoryScreen, HomeworkScreen, IntakeScreen,
  PortfolioScreen, ProgramsScreen, ProgressDashboardScreen, StudentProfileScreen, StudyPlanScreen, TrajectoryScreen,
} from './Student';
import { AcademyLibraryScreen, DocumentsScreen, MethodicalLibraryScreen, TestBuilderScreen, TestsScreen, VideoLibraryScreen } from './Library';
import {
  AcademyCoursesScreen, AcademyRegistrationScreen, AcademyTasksScreen, CertificatesScreen, MethodologiesScreen, MethodologyReviewScreen,
  PilotRegistryScreen, PilotsScreen, TeacherAcademyScreen,
} from './Academy';
import { ExhibitionScreen, InventionsScreen, PrototypesScreen, TeamsScreen, YIApplyScreen, YIReviewScreen, YoungInventorsScreen } from './Inventions';
import {
  AraiAIScreen, AtaMuraScreen, ChallengesScreen, EngineeringCoursesScreen, FutureEngineersScreen, GlobalClassesScreen, GlobalClassroomScreen, IkenScreen,
  InclusiveCatalogScreen, InclusiveEngineeringScreen, InternationalExpertsScreen, InternationalProjectsScreen, MashstroyCasesScreen,
} from './Engineering';
import {
  AccessibilityScreen, AIAssistantScreen, AITaskGeneratorScreen, LearningSettingsScreen, ProgressAnalysisScreen, RecommendationsScreen,
  TeacherAIScreen, TeacherRecommendationsScreen,
} from './AI';
import { ImpactDashboardScreen, ImpactPublicScreen, ImpactReportScreen } from './Impact';
import { AnalyticsScreen, EventsScreen, InternshipsScreen, PartnersScreen } from './Partners';
import {
  InventionsServicesScreen, MarketplaceScreen, PaymentHistoryScreen, PaymentSettingsScreen, PaymentsAdminScreen, PricingScreen, PromoCodesScreen,
  RevenueScreen, ScholarshipsScreen, SubscriptionsScreen, TeacherCertificationScreen, TeacherMarketplaceScreen,
} from './Payments';
import { CloudSettingsScreen, MyDataScreen } from './Account';
import { CourseStudioScreen, SchoolCoursesScreen } from './Courses';

const OnlineLessonsScreen = () => <ScheduleScreen onlyOnline />;
const AllChallengesScreen = () => <ChallengesScreen />;
const Schedule = () => <ScheduleScreen />;

const SCREEN_MAP: Record<RouteId, ComponentType> = {
  studentCabinet: StudentCabinet, parentCabinet: ParentCabinet, teacherCabinet: TeacherCabinet, expertCabinet: ExpertCabinet,
  psychologistCabinet: PsychologistCabinet, partnerCabinet: PartnerCabinet, adminPanel: AdminPanel,
  studentProfile: StudentProfileScreen, intake: IntakeScreen, application: ApplicationScreen, consents: ConsentsScreen, programs: ProgramsScreen,
  trajectory: TrajectoryScreen, studyPlan: StudyPlanScreen, schedule: Schedule, calendar: CalendarScreen, homework: HomeworkScreen,
  grading: GradingScreen, portfolio: PortfolioScreen, achievements: AchievementsScreen, progressDashboard: ProgressDashboardScreen, history: HistoryScreen,
  videoLibrary: VideoLibraryScreen, methodicalLibrary: MethodicalLibraryScreen, documents: DocumentsScreen, tests: TestsScreen, testBuilder: TestBuilderScreen,
  onlineLessons: OnlineLessonsScreen, chat: ChatScreen, notifications: NotificationsScreen, deadlines: DeadlinesScreen,
  teacherAcademy: TeacherAcademyScreen, academyRegistration: AcademyRegistrationScreen, academyCourses: AcademyCoursesScreen,
  academyLibrary: AcademyLibraryScreen, academyTasks: AcademyTasksScreen, certificates: CertificatesScreen, methodologies: MethodologiesScreen,
  pilots: PilotsScreen, methodologyReview: MethodologyReviewScreen, pilotRegistry: PilotRegistryScreen,
  inventions: InventionsScreen, teams: TeamsScreen, prototypes: PrototypesScreen, youngInventors: YoungInventorsScreen, yiApply: YIApplyScreen,
  yiReview: YIReviewScreen, exhibition: ExhibitionScreen,
  globalClassroom: GlobalClassroomScreen, globalClasses: GlobalClassesScreen, internationalProjects: InternationalProjectsScreen,
  internationalExperts: InternationalExpertsScreen, futureEngineers: FutureEngineersScreen, engineeringCourses: EngineeringCoursesScreen,
  challenges: AllChallengesScreen, mashstroyCases: MashstroyCasesScreen, araiAI: AraiAIScreen, iken: IkenScreen, ataMura: AtaMuraScreen,
  inclusiveEngineering: InclusiveEngineeringScreen, inclusiveCatalog: InclusiveCatalogScreen,
  accessibility: AccessibilityScreen, learningSettings: LearningSettingsScreen, recommendations: RecommendationsScreen, aiAssistant: AIAssistantScreen,
  teacherAI: TeacherAIScreen, aiTaskGenerator: AITaskGeneratorScreen, progressAnalysis: ProgressAnalysisScreen, teacherRecommendations: TeacherRecommendationsScreen,
  impactDashboard: ImpactDashboardScreen, impactReport: ImpactReportScreen, impactPublic: ImpactPublicScreen,
  partners: PartnersScreen, internships: InternshipsScreen, events: EventsScreen, analytics: AnalyticsScreen, users: UsersScreen, featureMap: FeatureMap,
  marketplace: MarketplaceScreen, subscriptions: SubscriptionsScreen, paymentHistory: PaymentHistoryScreen, teacherMarketplace: TeacherMarketplaceScreen,
  teacherCertification: TeacherCertificationScreen, inventionsServices: InventionsServicesScreen, revenue: RevenueScreen, paymentsAdmin: PaymentsAdminScreen,
  promoCodes: PromoCodesScreen, scholarships: ScholarshipsScreen, pricing: PricingScreen, paymentSettings: PaymentSettingsScreen,
  cloudSettings: CloudSettingsScreen, myData: MyDataScreen, courseStudio: CourseStudioScreen, schoolCourses: SchoolCoursesScreen, moderation: ModerationScreen,
};

function missing(route: RouteId): ComponentType {
  return function Missing() {
    return <Page title={ROUTES[route].title}><EmptyState text="Раздел недоступен." icon="hammer" /></Page>;
  };
}

export const SCREENS = Object.fromEntries(ROUTE_IDS.map((r) => [r, SCREEN_MAP[r] ?? missing(r)])) as Record<RouteId, ComponentType>;
export const PORTED = Object.keys(SCREEN_MAP) as RouteId[];
