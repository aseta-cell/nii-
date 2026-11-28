// Сгенерировано scripts/gen_nav.py из KKSU/Core/KKSUNavigation.swift. Не редактируйте вручную.
import type { KKSURole } from './models.gen';

export type RouteId = "studentCabinet" | "parentCabinet" | "teacherCabinet" | "expertCabinet" | "psychologistCabinet" | "partnerCabinet" | "adminPanel" | "studentProfile" | "intake" | "application" | "consents" | "programs" | "trajectory" | "studyPlan" | "schedule" | "calendar" | "homework" | "grading" | "portfolio" | "achievements" | "progressDashboard" | "history" | "videoLibrary" | "methodicalLibrary" | "documents" | "tests" | "testBuilder" | "onlineLessons" | "chat" | "notifications" | "deadlines" | "teacherAcademy" | "academyRegistration" | "academyCourses" | "academyLibrary" | "academyTasks" | "certificates" | "methodologies" | "pilots" | "methodologyReview" | "pilotRegistry" | "inventions" | "teams" | "prototypes" | "youngInventors" | "yiApply" | "yiReview" | "exhibition" | "globalClassroom" | "globalClasses" | "internationalProjects" | "internationalExperts" | "futureEngineers" | "engineeringCourses" | "challenges" | "mashstroyCases" | "araiAI" | "iken" | "ataMura" | "inclusiveEngineering" | "inclusiveCatalog" | "accessibility" | "learningSettings" | "recommendations" | "aiAssistant" | "teacherAI" | "aiTaskGenerator" | "progressAnalysis" | "teacherRecommendations" | "impactDashboard" | "impactReport" | "impactPublic" | "partners" | "internships" | "events" | "analytics" | "users" | "featureMap" | "marketplace" | "subscriptions" | "paymentHistory" | "teacherMarketplace" | "teacherCertification" | "inventionsServices" | "revenue" | "paymentsAdmin" | "promoCodes" | "scholarships" | "pricing" | "paymentSettings" | "cloudSettings" | "myData" | "courseStudio" | "schoolCourses" | "moderation";

export interface RouteInfo { id: RouteId; title: string; icon: string; roles: KKSURole[]; swiftView: string }

export const ROUTES: Record<RouteId, RouteInfo> = {
  "studentCabinet": {
    "id": "studentCabinet",
    "title": "Кабинет ученика",
    "icon": "graduationcap.fill",
    "roles": [
      "student",
      "parent",
      "teacher",
      "psychologist",
      "mentor",
      "admin"
    ],
    "swiftView": "StudentCabinetView()"
  },
  "parentCabinet": {
    "id": "parentCabinet",
    "title": "Кабинет родителя",
    "icon": "person.2.fill",
    "roles": [
      "parent",
      "admin"
    ],
    "swiftView": "ParentHomeView()"
  },
  "teacherCabinet": {
    "id": "teacherCabinet",
    "title": "Кабинет педагога",
    "icon": "person.fill.viewfinder",
    "roles": [
      "teacher",
      "admin"
    ],
    "swiftView": "TeacherHomeView()"
  },
  "expertCabinet": {
    "id": "expertCabinet",
    "title": "Кабинет эксперта / наставника",
    "icon": "checkmark.seal.fill",
    "roles": [
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "ExpertCabinetView()"
  },
  "psychologistCabinet": {
    "id": "psychologistCabinet",
    "title": "Кабинет психолога",
    "icon": "heart.text.square.fill",
    "roles": [
      "psychologist",
      "admin"
    ],
    "swiftView": "PsychologistCabinetView()"
  },
  "partnerCabinet": {
    "id": "partnerCabinet",
    "title": "Кабинет партнёра",
    "icon": "building.2.fill",
    "roles": [
      "partner",
      "admin"
    ],
    "swiftView": "PartnerCabinetView()"
  },
  "adminPanel": {
    "id": "adminPanel",
    "title": "Административная панель",
    "icon": "gearshape.2.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "AdminPanelView()"
  },
  "studentProfile": {
    "id": "studentProfile",
    "title": "Профиль ученика",
    "icon": "person.crop.circle",
    "roles": [],
    "swiftView": "StudentProfileEditorView()"
  },
  "intake": {
    "id": "intake",
    "title": "Анкета поступления",
    "icon": "list.clipboard.fill",
    "roles": [
      "student",
      "parent",
      "teacher",
      "psychologist",
      "mentor",
      "admin"
    ],
    "swiftView": "IntakeQuestionnaireView()"
  },
  "application": {
    "id": "application",
    "title": "Заявка на обучение",
    "icon": "doc.text.fill",
    "roles": [],
    "swiftView": "EnrollmentApplicationView()"
  },
  "consents": {
    "id": "consents",
    "title": "Согласия родителей",
    "icon": "signature",
    "roles": [
      "parent",
      "admin"
    ],
    "swiftView": "ConsentsView()"
  },
  "programs": {
    "id": "programs",
    "title": "Каталог программ",
    "icon": "square.grid.2x2.fill",
    "roles": [],
    "swiftView": "ProgramCatalogView()"
  },
  "trajectory": {
    "id": "trajectory",
    "title": "Образовательная траектория",
    "icon": "point.topleft.down.to.point.bottomright.curvepath.fill",
    "roles": [
      "student",
      "parent",
      "teacher",
      "psychologist",
      "mentor",
      "admin"
    ],
    "swiftView": "TrajectoryView()"
  },
  "studyPlan": {
    "id": "studyPlan",
    "title": "Индивидуальный учебный план",
    "icon": "tablecells.fill",
    "roles": [
      "student",
      "parent",
      "teacher",
      "psychologist",
      "mentor",
      "admin"
    ],
    "swiftView": "StudyPlanView()"
  },
  "schedule": {
    "id": "schedule",
    "title": "Расписание",
    "icon": "clock.fill",
    "roles": [],
    "swiftView": "LessonsView()"
  },
  "calendar": {
    "id": "calendar",
    "title": "Календарь",
    "icon": "calendar",
    "roles": [],
    "swiftView": "StudentCalendarView()"
  },
  "homework": {
    "id": "homework",
    "title": "Домашние задания",
    "icon": "house.and.flag.fill",
    "roles": [
      "student",
      "parent",
      "teacher",
      "psychologist",
      "mentor",
      "admin"
    ],
    "swiftView": "HomeworkListView()"
  },
  "grading": {
    "id": "grading",
    "title": "Проверка работ",
    "icon": "checkmark.rectangle.stack.fill",
    "roles": [
      "teacher",
      "admin"
    ],
    "swiftView": "GradingQueueView()"
  },
  "portfolio": {
    "id": "portfolio",
    "title": "Портфолио",
    "icon": "briefcase.fill",
    "roles": [
      "student",
      "parent",
      "teacher",
      "psychologist",
      "mentor",
      "admin"
    ],
    "swiftView": "PortfolioView()"
  },
  "achievements": {
    "id": "achievements",
    "title": "Достижения и сертификаты",
    "icon": "trophy.fill",
    "roles": [],
    "swiftView": "AchievementsView()"
  },
  "progressDashboard": {
    "id": "progressDashboard",
    "title": "Дашборд прогресса",
    "icon": "chart.line.uptrend.xyaxis",
    "roles": [],
    "swiftView": "ProgressDashboardView()"
  },
  "history": {
    "id": "history",
    "title": "История обучения",
    "icon": "clock.arrow.circlepath",
    "roles": [],
    "swiftView": "LearningHistoryView()"
  },
  "videoLibrary": {
    "id": "videoLibrary",
    "title": "Видеоуроки",
    "icon": "play.rectangle.fill",
    "roles": [],
    "swiftView": "LibraryListView(kinds: [.video], title: \"Видеоуроки\")"
  },
  "methodicalLibrary": {
    "id": "methodicalLibrary",
    "title": "Методические материалы",
    "icon": "text.book.closed.fill",
    "roles": [],
    "swiftView": "LibraryListView(kinds: [.methodical], title: \"Методические материалы\")"
  },
  "documents": {
    "id": "documents",
    "title": "PDF, презентации, учебники",
    "icon": "doc.richtext.fill",
    "roles": [],
    "swiftView": "LibraryListView(kinds: [.pdf, .presentation, .instruction, .textbook], title: \"PDF, презентации, учебники\")"
  },
  "tests": {
    "id": "tests",
    "title": "Онлайн-тестирование",
    "icon": "checklist",
    "roles": [],
    "swiftView": "TestListView(audience: .students)"
  },
  "testBuilder": {
    "id": "testBuilder",
    "title": "Конструктор тестов",
    "icon": "hammer.fill",
    "roles": [
      "teacher",
      "admin"
    ],
    "swiftView": "TestBuilderView()"
  },
  "onlineLessons": {
    "id": "onlineLessons",
    "title": "Онлайн-занятия",
    "icon": "video.fill",
    "roles": [],
    "swiftView": "LessonsView(onlyOnline: true)"
  },
  "chat": {
    "id": "chat",
    "title": "Чат",
    "icon": "bubble.left.and.bubble.right.fill",
    "roles": [],
    "swiftView": "ChatListView()"
  },
  "notifications": {
    "id": "notifications",
    "title": "Уведомления",
    "icon": "bell.fill",
    "roles": [],
    "swiftView": "NotificationsView()"
  },
  "deadlines": {
    "id": "deadlines",
    "title": "Дедлайны",
    "icon": "clock.badge.exclamationmark.fill",
    "roles": [],
    "swiftView": "DeadlinesView()"
  },
  "teacherAcademy": {
    "id": "teacherAcademy",
    "title": "KKSU Teacher Academy",
    "icon": "building.columns.fill",
    "roles": [
      "teacher",
      "psychologist",
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "TeacherAcademyView()"
  },
  "academyRegistration": {
    "id": "academyRegistration",
    "title": "Регистрация в Academy",
    "icon": "person.badge.plus",
    "roles": [
      "teacher",
      "psychologist",
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "AcademyRegistrationView()"
  },
  "academyCourses": {
    "id": "academyCourses",
    "title": "Курсы повышения квалификации",
    "icon": "person.crop.rectangle.stack.fill",
    "roles": [
      "teacher",
      "psychologist",
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "AcademyCoursesView()"
  },
  "academyLibrary": {
    "id": "academyLibrary",
    "title": "Методическая библиотека Academy",
    "icon": "books.vertical.fill",
    "roles": [
      "teacher",
      "psychologist",
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "LibraryListView(kinds: LibraryKind.allCases, title: \"Методическая библиотека\", teacherAcademyOnly: true)"
  },
  "academyTasks": {
    "id": "academyTasks",
    "title": "Задания и тесты педагогов",
    "icon": "pencil.and.list.clipboard",
    "roles": [
      "teacher",
      "psychologist",
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "AcademyTasksView()"
  },
  "certificates": {
    "id": "certificates",
    "title": "Электронные сертификаты",
    "icon": "doc.badge.ellipsis",
    "roles": [],
    "swiftView": "CertificatesView()"
  },
  "methodologies": {
    "id": "methodologies",
    "title": "Авторские методики KKSU",
    "icon": "lightbulb.2.fill",
    "roles": [
      "teacher",
      "psychologist",
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "MethodologyCatalogView()"
  },
  "pilots": {
    "id": "pilots",
    "title": "Апробация методик",
    "icon": "testtube.2",
    "roles": [
      "teacher",
      "psychologist",
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "PilotsView()"
  },
  "methodologyReview": {
    "id": "methodologyReview",
    "title": "Экспертная оценка методик",
    "icon": "star.leadinghalf.filled",
    "roles": [
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "MethodologyReviewQueueView()"
  },
  "pilotRegistry": {
    "id": "pilotRegistry",
    "title": "Реестр результатов апробации",
    "icon": "list.bullet.rectangle.fill",
    "roles": [
      "teacher",
      "psychologist",
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "PilotRegistryView()"
  },
  "inventions": {
    "id": "inventions",
    "title": "KKSU Inventions",
    "icon": "lightbulb.max.fill",
    "roles": [],
    "swiftView": "InventionsView(track: nil)"
  },
  "teams": {
    "id": "teams",
    "title": "Проектные команды",
    "icon": "person.3.fill",
    "roles": [],
    "swiftView": "TeamsView()"
  },
  "prototypes": {
    "id": "prototypes",
    "title": "Каталог прототипов",
    "icon": "cube.transparent.fill",
    "roles": [],
    "swiftView": "PrototypeCatalogView()"
  },
  "youngInventors": {
    "id": "youngInventors",
    "title": "Young Inventors 30",
    "icon": "sparkles",
    "roles": [],
    "swiftView": "YoungInventorsView()"
  },
  "yiApply": {
    "id": "yiApply",
    "title": "Заявка в Young Inventors",
    "icon": "paperplane.fill",
    "roles": [],
    "swiftView": "YoungInventorsApplyView()"
  },
  "yiReview": {
    "id": "yiReview",
    "title": "Экспертиза проектов",
    "icon": "checkmark.seal",
    "roles": [
      "expert",
      "mentor",
      "admin"
    ],
    "swiftView": "YoungInventorsReviewView()"
  },
  "exhibition": {
    "id": "exhibition",
    "title": "Виртуальная выставка",
    "icon": "building.fill",
    "roles": [],
    "swiftView": "VirtualExhibitionView()"
  },
  "globalClassroom": {
    "id": "globalClassroom",
    "title": "Global Classroom",
    "icon": "globe.europe.africa.fill",
    "roles": [],
    "swiftView": "GlobalClassroomView()"
  },
  "globalClasses": {
    "id": "globalClasses",
    "title": "Международные онлайн-классы",
    "icon": "video.bubble.fill",
    "roles": [],
    "swiftView": "GlobalClassesView()"
  },
  "internationalProjects": {
    "id": "internationalProjects",
    "title": "Международные проекты",
    "icon": "globe",
    "roles": [],
    "swiftView": "InternationalProjectsView()"
  },
  "internationalExperts": {
    "id": "internationalExperts",
    "title": "Международные эксперты",
    "icon": "person.crop.square.filled.and.at.rectangle",
    "roles": [],
    "swiftView": "InternationalExpertsView()"
  },
  "futureEngineers": {
    "id": "futureEngineers",
    "title": "Future Engineers",
    "icon": "wrench.and.screwdriver.fill",
    "roles": [],
    "swiftView": "FutureEngineersView()"
  },
  "engineeringCourses": {
    "id": "engineeringCourses",
    "title": "Инженерные онлайн-курсы",
    "icon": "book.and.wrench.fill",
    "roles": [],
    "swiftView": "EngineeringCoursesView(track: nil)"
  },
  "challenges": {
    "id": "challenges",
    "title": "Виртуальные инженерные задания",
    "icon": "puzzlepiece.extension.fill",
    "roles": [],
    "swiftView": "ChallengesView(track: nil, industryOnly: false)"
  },
  "mashstroyCases": {
    "id": "mashstroyCases",
    "title": "Кейсы MASHSTROY",
    "icon": "gearshape.2.fill",
    "roles": [],
    "swiftView": "ChallengesView(track: .mashstroy, industryOnly: true)"
  },
  "araiAI": {
    "id": "araiAI",
    "title": "ARAI AI",
    "icon": "brain.head.profile",
    "roles": [],
    "swiftView": "TrackHubView(track: .araiAI)"
  },
  "iken": {
    "id": "iken",
    "title": "Проекты IKEN",
    "icon": "leaf.fill",
    "roles": [],
    "swiftView": "TrackHubView(track: .iken)"
  },
  "ataMura": {
    "id": "ataMura",
    "title": "Проекты ATA MURA",
    "icon": "building.columns",
    "roles": [],
    "swiftView": "TrackHubView(track: .ataMura)"
  },
  "inclusiveEngineering": {
    "id": "inclusiveEngineering",
    "title": "Inclusive Engineering",
    "icon": "figure.roll",
    "roles": [],
    "swiftView": "TrackHubView(track: .inclusiveEngineering)"
  },
  "inclusiveCatalog": {
    "id": "inclusiveCatalog",
    "title": "Каталог инклюзивных разработок",
    "icon": "accessibility",
    "roles": [],
    "swiftView": "InclusiveCatalogView()"
  },
  "accessibility": {
    "id": "accessibility",
    "title": "Доступность интерфейса",
    "icon": "textformat.size",
    "roles": [],
    "swiftView": "AccessibilitySettingsView()"
  },
  "learningSettings": {
    "id": "learningSettings",
    "title": "Настройки обучения",
    "icon": "slider.horizontal.3",
    "roles": [],
    "swiftView": "LearningSettingsView()"
  },
  "recommendations": {
    "id": "recommendations",
    "title": "Рекомендации",
    "icon": "hand.thumbsup.fill",
    "roles": [],
    "swiftView": "RecommendationsView()"
  },
  "aiAssistant": {
    "id": "aiAssistant",
    "title": "AI-помощник KKSU",
    "icon": "sparkles",
    "roles": [],
    "swiftView": "AIAssistantView(mode: .student)"
  },
  "teacherAI": {
    "id": "teacherAI",
    "title": "AI-помощник педагога",
    "icon": "wand.and.stars",
    "roles": [
      "teacher",
      "admin"
    ],
    "swiftView": "AIAssistantView(mode: .teacher)"
  },
  "aiTaskGenerator": {
    "id": "aiTaskGenerator",
    "title": "Генерация заданий AI",
    "icon": "text.badge.plus",
    "roles": [
      "teacher",
      "admin"
    ],
    "swiftView": "AITaskGeneratorView()"
  },
  "progressAnalysis": {
    "id": "progressAnalysis",
    "title": "Анализ прогресса",
    "icon": "waveform.path.ecg",
    "roles": [
      "teacher",
      "psychologist",
      "parent",
      "mentor",
      "admin"
    ],
    "swiftView": "ProgressAnalysisView()"
  },
  "teacherRecommendations": {
    "id": "teacherRecommendations",
    "title": "Рекомендации педагогу",
    "icon": "lightbulb.fill",
    "roles": [
      "teacher",
      "admin"
    ],
    "swiftView": "TeacherRecommendationsView()"
  },
  "impactDashboard": {
    "id": "impactDashboard",
    "title": "Impact Dashboard",
    "icon": "chart.bar.xaxis",
    "roles": [
      "admin",
      "partner",
      "expert",
      "teacher"
    ],
    "swiftView": "ImpactDashboardView()"
  },
  "impactReport": {
    "id": "impactReport",
    "title": "KKSU Impact Report",
    "icon": "doc.text.image.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "ImpactReportView()"
  },
  "impactPublic": {
    "id": "impactPublic",
    "title": "Публичная страница Impact",
    "icon": "megaphone.fill",
    "roles": [],
    "swiftView": "ImpactPublicView()"
  },
  "partners": {
    "id": "partners",
    "title": "Партнёры KKSU",
    "icon": "handshake.fill",
    "roles": [],
    "swiftView": "PartnersView()"
  },
  "internships": {
    "id": "internships",
    "title": "Стажировки",
    "icon": "briefcase.circle.fill",
    "roles": [],
    "swiftView": "InternshipsView()"
  },
  "events": {
    "id": "events",
    "title": "Конференции и мероприятия",
    "icon": "calendar.badge.plus",
    "roles": [],
    "swiftView": "EventsView()"
  },
  "analytics": {
    "id": "analytics",
    "title": "Аналитика KKSU",
    "icon": "chart.pie.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "AnalyticsView()"
  },
  "users": {
    "id": "users",
    "title": "Пользователи и роли",
    "icon": "person.3.sequence.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "UserManagementView()"
  },
  "featureMap": {
    "id": "featureMap",
    "title": "Карта 100 задач",
    "icon": "map.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "FeatureMapView()"
  },
  "marketplace": {
    "id": "marketplace",
    "title": "KKSU Marketplace",
    "icon": "cart.fill",
    "roles": [],
    "swiftView": "MarketplaceView()"
  },
  "subscriptions": {
    "id": "subscriptions",
    "title": "Подписка KKSU",
    "icon": "star.circle.fill",
    "roles": [],
    "swiftView": "SubscriptionsView()"
  },
  "paymentHistory": {
    "id": "paymentHistory",
    "title": "История платежей",
    "icon": "list.bullet.rectangle.portrait.fill",
    "roles": [],
    "swiftView": "PaymentHistoryView()"
  },
  "teacherMarketplace": {
    "id": "teacherMarketplace",
    "title": "Teacher Marketplace",
    "icon": "storefront.fill",
    "roles": [],
    "swiftView": "TeacherMarketplaceView()"
  },
  "teacherCertification": {
    "id": "teacherCertification",
    "title": "Сертификация преподавателя",
    "icon": "rosette",
    "roles": [
      "teacher",
      "psychologist",
      "admin"
    ],
    "swiftView": "TeacherCertificationView()"
  },
  "inventionsServices": {
    "id": "inventionsServices",
    "title": "Услуги KKSU Inventions",
    "icon": "hammer.fill",
    "roles": [],
    "swiftView": "InventionsServicesView()"
  },
  "revenue": {
    "id": "revenue",
    "title": "Выручка и продажи",
    "icon": "dollarsign.circle.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "RevenueDashboardView()"
  },
  "paymentsAdmin": {
    "id": "paymentsAdmin",
    "title": "Подтверждение оплат",
    "icon": "checkmark.rectangle.stack.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "PaymentsAdminView()"
  },
  "promoCodes": {
    "id": "promoCodes",
    "title": "Промокоды и скидки",
    "icon": "tag.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "PromoCodesAdminView()"
  },
  "scholarships": {
    "id": "scholarships",
    "title": "Стипендии",
    "icon": "gift.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "ScholarshipsView()"
  },
  "pricing": {
    "id": "pricing",
    "title": "Цены и продукты",
    "icon": "tablecells.badge.ellipsis",
    "roles": [
      "admin"
    ],
    "swiftView": "PricingAdminView()"
  },
  "paymentSettings": {
    "id": "paymentSettings",
    "title": "Настройки оплаты",
    "icon": "banknote.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "PaymentSettingsView()"
  },
  "cloudSettings": {
    "id": "cloudSettings",
    "title": "Сервер KKSU",
    "icon": "icloud.fill",
    "roles": [],
    "swiftView": "CloudSettingsView()"
  },
  "myData": {
    "id": "myData",
    "title": "Данные и конфиденциальность",
    "icon": "hand.raised.fill",
    "roles": [],
    "swiftView": "MyDataView()"
  },
  "courseStudio": {
    "id": "courseStudio",
    "title": "Мои курсы (конструктор)",
    "icon": "square.and.pencil",
    "roles": [
      "teacher",
      "admin"
    ],
    "swiftView": "CourseStudioView()"
  },
  "schoolCourses": {
    "id": "schoolCourses",
    "title": "Курсы и уроки",
    "icon": "books.vertical.fill",
    "roles": [],
    "swiftView": "SchoolCoursesView()"
  },
  "moderation": {
    "id": "moderation",
    "title": "Модерация и жалобы",
    "icon": "exclamationmark.shield.fill",
    "roles": [
      "admin"
    ],
    "swiftView": "ModerationView()"
  }
};

export const ROUTE_IDS = Object.keys(ROUTES) as RouteId[];

export const MODULE_SECTIONS: { title: string; routes: RouteId[] }[] = [
  {
    "title": "Обучение",
    "routes": [
      "schoolCourses",
      "programs",
      "trajectory",
      "studyPlan",
      "schedule",
      "calendar",
      "homework",
      "deadlines",
      "tests",
      "progressDashboard",
      "history"
    ]
  },
  {
    "title": "Моё",
    "routes": [
      "studentProfile",
      "portfolio",
      "achievements",
      "certificates",
      "intake",
      "application",
      "consents"
    ]
  },
  {
    "title": "Библиотеки",
    "routes": [
      "videoLibrary",
      "methodicalLibrary",
      "documents"
    ]
  },
  {
    "title": "Связь",
    "routes": [
      "onlineLessons",
      "chat",
      "notifications"
    ]
  },
  {
    "title": "Педагогу",
    "routes": [
      "courseStudio",
      "grading",
      "testBuilder",
      "teacherAI",
      "aiTaskGenerator",
      "progressAnalysis",
      "teacherRecommendations"
    ]
  },
  {
    "title": "KKSU Teacher Academy",
    "routes": [
      "teacherAcademy",
      "academyRegistration",
      "academyCourses",
      "academyLibrary",
      "academyTasks",
      "methodologies",
      "pilots",
      "methodologyReview",
      "pilotRegistry"
    ]
  },
  {
    "title": "Изобретения",
    "routes": [
      "inventions",
      "teams",
      "prototypes",
      "youngInventors",
      "yiApply",
      "yiReview",
      "exhibition"
    ]
  },
  {
    "title": "Global Classroom",
    "routes": [
      "globalClassroom",
      "globalClasses",
      "internationalProjects",
      "internationalExperts"
    ]
  },
  {
    "title": "Future Engineers",
    "routes": [
      "futureEngineers",
      "engineeringCourses",
      "challenges",
      "mashstroyCases",
      "araiAI",
      "iken",
      "ataMura",
      "inclusiveEngineering",
      "inclusiveCatalog"
    ]
  },
  {
    "title": "AI и персонализация",
    "routes": [
      "aiAssistant",
      "recommendations",
      "learningSettings",
      "accessibility"
    ]
  },
  {
    "title": "Партнёрство и события",
    "routes": [
      "partners",
      "internships",
      "events"
    ]
  },
  {
    "title": "Impact и управление",
    "routes": [
      "impactDashboard",
      "impactReport",
      "impactPublic",
      "analytics",
      "users",
      "moderation",
      "adminPanel"
    ]
  },
  {
    "title": "Оплата и Marketplace",
    "routes": [
      "marketplace",
      "subscriptions",
      "paymentHistory",
      "teacherMarketplace",
      "teacherCertification",
      "inventionsServices"
    ]
  },
  {
    "title": "Финансы (администратор)",
    "routes": [
      "revenue",
      "paymentsAdmin",
      "promoCodes",
      "scholarships",
      "pricing",
      "paymentSettings"
    ]
  },
  {
    "title": "О платформе",
    "routes": [
      "cloudSettings",
      "myData",
      "featureMap"
    ]
  }
];

export const FEATURES: { id: number; title: string; route: RouteId; note: string }[] = [
  {
    "id": 1,
    "title": "Главная страница KKSU Online",
    "route": "impactPublic",
    "note": "Стартовый экран до входа (KKSULandingView)"
  },
  {
    "id": 2,
    "title": "Регистрация пользователей",
    "route": "users",
    "note": "RegistrationView"
  },
  {
    "id": 3,
    "title": "Вход и восстановление пароля",
    "route": "users",
    "note": "LoginView, ForgotPasswordView"
  },
  {
    "id": 4,
    "title": "Роли: ученик, родитель, педагог, психолог, эксперт, наставник, партнёр, администратор",
    "route": "users",
    "note": ""
  },
  {
    "id": 5,
    "title": "Личный кабинет ученика",
    "route": "studentCabinet",
    "note": ""
  },
  {
    "id": 6,
    "title": "Кабинет родителя",
    "route": "parentCabinet",
    "note": ""
  },
  {
    "id": 7,
    "title": "Кабинет преподавателя",
    "route": "teacherCabinet",
    "note": ""
  },
  {
    "id": 8,
    "title": "Кабинет эксперта/наставника",
    "route": "expertCabinet",
    "note": ""
  },
  {
    "id": 9,
    "title": "Административная панель",
    "route": "adminPanel",
    "note": ""
  },
  {
    "id": 10,
    "title": "Профиль ученика",
    "route": "studentProfile",
    "note": ""
  },
  {
    "id": 11,
    "title": "Цифровая анкета первичного поступления",
    "route": "intake",
    "note": ""
  },
  {
    "id": 12,
    "title": "Онлайн-заявка на обучение",
    "route": "application",
    "note": ""
  },
  {
    "id": 13,
    "title": "Система согласий родителей",
    "route": "consents",
    "note": ""
  },
  {
    "id": 14,
    "title": "Каталог образовательных программ",
    "route": "programs",
    "note": ""
  },
  {
    "id": 15,
    "title": "Индивидуальная образовательная траектория",
    "route": "trajectory",
    "note": ""
  },
  {
    "id": 16,
    "title": "Индивидуальный учебный план",
    "route": "studyPlan",
    "note": ""
  },
  {
    "id": 17,
    "title": "Расписание занятий",
    "route": "schedule",
    "note": ""
  },
  {
    "id": 18,
    "title": "Календарь ученика",
    "route": "calendar",
    "note": ""
  },
  {
    "id": 19,
    "title": "Система домашних заданий",
    "route": "homework",
    "note": ""
  },
  {
    "id": 20,
    "title": "Загрузка выполненных работ",
    "route": "homework",
    "note": "Фото, видео, документы"
  },
  {
    "id": 21,
    "title": "Оценки и обратная связь преподавателя",
    "route": "grading",
    "note": ""
  },
  {
    "id": 22,
    "title": "Электронное портфолио ученика",
    "route": "portfolio",
    "note": ""
  },
  {
    "id": 23,
    "title": "Система достижений и сертификатов",
    "route": "achievements",
    "note": ""
  },
  {
    "id": 24,
    "title": "Дашборд прогресса",
    "route": "progressDashboard",
    "note": ""
  },
  {
    "id": 25,
    "title": "История обучения",
    "route": "history",
    "note": ""
  },
  {
    "id": 26,
    "title": "Библиотека видеоуроков",
    "route": "videoLibrary",
    "note": ""
  },
  {
    "id": 27,
    "title": "Библиотека методических материалов",
    "route": "methodicalLibrary",
    "note": ""
  },
  {
    "id": 28,
    "title": "База PDF, презентаций, инструкций и учебников",
    "route": "documents",
    "note": ""
  },
  {
    "id": 29,
    "title": "Онлайн-тестирование",
    "route": "tests",
    "note": ""
  },
  {
    "id": 30,
    "title": "Автоматическая проверка тестов",
    "route": "tests",
    "note": "Один/несколько ответов, число, текст"
  },
  {
    "id": 31,
    "title": "Конструктор тестов для преподавателей",
    "route": "testBuilder",
    "note": ""
  },
  {
    "id": 32,
    "title": "Модуль онлайн-занятий",
    "route": "onlineLessons",
    "note": ""
  },
  {
    "id": 33,
    "title": "Ссылки/интеграция видеоконференций",
    "route": "onlineLessons",
    "note": "Jitsi (автокомната), Zoom, Meet, Teams"
  },
  {
    "id": 34,
    "title": "Внутренний чат ученик–преподаватель",
    "route": "chat",
    "note": ""
  },
  {
    "id": 35,
    "title": "Уведомления",
    "route": "notifications",
    "note": "В приложении + системные"
  },
  {
    "id": 36,
    "title": "Система дедлайнов",
    "route": "deadlines",
    "note": ""
  },
  {
    "id": 37,
    "title": "KKSU Teacher Academy",
    "route": "teacherAcademy",
    "note": ""
  },
  {
    "id": 38,
    "title": "Регистрация педагогов в Teacher Academy",
    "route": "academyRegistration",
    "note": ""
  },
  {
    "id": 39,
    "title": "Курсы повышения квалификации",
    "route": "academyCourses",
    "note": ""
  },
  {
    "id": 40,
    "title": "Методическая библиотека Teacher Academy",
    "route": "academyLibrary",
    "note": ""
  },
  {
    "id": 41,
    "title": "Задания и тестирование педагогов",
    "route": "academyTasks",
    "note": ""
  },
  {
    "id": 42,
    "title": "Электронные сертификаты Teacher Academy",
    "route": "certificates",
    "note": "Автовыдача после курса, PDF"
  },
  {
    "id": 43,
    "title": "Каталог авторских методик KKSU",
    "route": "methodologies",
    "note": ""
  },
  {
    "id": 44,
    "title": "Раздел апробации методик",
    "route": "pilots",
    "note": ""
  },
  {
    "id": 45,
    "title": "Форма экспертной оценки методик",
    "route": "methodologyReview",
    "note": ""
  },
  {
    "id": 46,
    "title": "Реестр результатов апробации",
    "route": "pilotRegistry",
    "note": ""
  },
  {
    "id": 47,
    "title": "KKSU Inventions",
    "route": "inventions",
    "note": ""
  },
  {
    "id": 48,
    "title": "Карточка изобретения/проекта",
    "route": "inventions",
    "note": "ProjectDetailView"
  },
  {
    "id": 49,
    "title": "Фото, видео, чертежи и документы проекта",
    "route": "inventions",
    "note": "Вкладка «Материалы» в карточке"
  },
  {
    "id": 50,
    "title": "Проектные команды учеников",
    "route": "teams",
    "note": ""
  },
  {
    "id": 51,
    "title": "Назначение наставника на проект",
    "route": "inventions",
    "note": "В карточке проекта"
  },
  {
    "id": 52,
    "title": "Стадии проекта Idea → Research → Prototype → Testing → Result",
    "route": "inventions",
    "note": ""
  },
  {
    "id": 53,
    "title": "Журнал экспериментов",
    "route": "inventions",
    "note": "Вкладка в карточке проекта"
  },
  {
    "id": 54,
    "title": "Электронная лабораторная тетрадь",
    "route": "inventions",
    "note": "Вкладка в карточке проекта"
  },
  {
    "id": 55,
    "title": "Каталог прототипов KKSU",
    "route": "prototypes",
    "note": ""
  },
  {
    "id": 56,
    "title": "Young Inventors 30",
    "route": "youngInventors",
    "note": ""
  },
  {
    "id": 57,
    "title": "Подача заявок в Young Inventors",
    "route": "yiApply",
    "note": ""
  },
  {
    "id": 58,
    "title": "Экспертное рассмотрение проектов",
    "route": "yiReview",
    "note": ""
  },
  {
    "id": 59,
    "title": "Виртуальная выставка изобретений",
    "route": "exhibition",
    "note": ""
  },
  {
    "id": 60,
    "title": "Global Classroom",
    "route": "globalClassroom",
    "note": ""
  },
  {
    "id": 61,
    "title": "Международные онлайн-классы",
    "route": "globalClasses",
    "note": ""
  },
  {
    "id": 62,
    "title": "Совместные международные проекты",
    "route": "internationalProjects",
    "note": ""
  },
  {
    "id": 63,
    "title": "Международные преподаватели и эксперты",
    "route": "internationalExperts",
    "note": ""
  },
  {
    "id": 64,
    "title": "Future Engineers",
    "route": "futureEngineers",
    "note": ""
  },
  {
    "id": 65,
    "title": "Инженерные онлайн-курсы",
    "route": "engineeringCourses",
    "note": ""
  },
  {
    "id": 66,
    "title": "Виртуальные инженерные задания",
    "route": "challenges",
    "note": ""
  },
  {
    "id": 67,
    "title": "Проектные кейсы MASHSTROY",
    "route": "mashstroyCases",
    "note": ""
  },
  {
    "id": 68,
    "title": "Интеграционный раздел ARAI AI",
    "route": "araiAI",
    "note": ""
  },
  {
    "id": 69,
    "title": "Проекты IKEN",
    "route": "iken",
    "note": ""
  },
  {
    "id": 70,
    "title": "Проекты ATA MURA",
    "route": "ataMura",
    "note": ""
  },
  {
    "id": 71,
    "title": "Раздел Inclusive Engineering",
    "route": "inclusiveEngineering",
    "note": ""
  },
  {
    "id": 72,
    "title": "Каталог инклюзивных инженерных разработок",
    "route": "inclusiveCatalog",
    "note": ""
  },
  {
    "id": 73,
    "title": "Адаптивный интерфейс платформы",
    "route": "accessibility",
    "note": "iPhone/iPad, Dynamic Type, VoiceOver"
  },
  {
    "id": 74,
    "title": "Размер текста, контраст и интерфейс",
    "route": "accessibility",
    "note": ""
  },
  {
    "id": 75,
    "title": "Субтитры к видео",
    "route": "videoLibrary",
    "note": ""
  },
  {
    "id": 76,
    "title": "Текстовые альтернативы материалам",
    "route": "documents",
    "note": ""
  },
  {
    "id": 77,
    "title": "Индивидуальные настройки обучения",
    "route": "learningSettings",
    "note": ""
  },
  {
    "id": 78,
    "title": "Рекомендации образовательного контента",
    "route": "recommendations",
    "note": ""
  },
  {
    "id": 79,
    "title": "AI-помощник KKSU",
    "route": "aiAssistant",
    "note": ""
  },
  {
    "id": 80,
    "title": "AI-помощник преподавателя",
    "route": "teacherAI",
    "note": ""
  },
  {
    "id": 81,
    "title": "Генерация индивидуальных заданий с проверкой педагогом",
    "route": "aiTaskGenerator",
    "note": ""
  },
  {
    "id": 82,
    "title": "Анализ учебного прогресса",
    "route": "progressAnalysis",
    "note": ""
  },
  {
    "id": 83,
    "title": "Рекомендации преподавателю на основе данных",
    "route": "teacherRecommendations",
    "note": ""
  },
  {
    "id": 84,
    "title": "Impact Dashboard",
    "route": "impactDashboard",
    "note": ""
  },
  {
    "id": 85,
    "title": "Автоподсчёт учеников, занятий, проектов и результатов",
    "route": "impactDashboard",
    "note": ""
  },
  {
    "id": 86,
    "title": "Показатели образовательного прогресса",
    "route": "impactDashboard",
    "note": ""
  },
  {
    "id": 87,
    "title": "Показатели проектов и изобретений",
    "route": "impactDashboard",
    "note": ""
  },
  {
    "id": 88,
    "title": "Показатели партнёрств",
    "route": "impactDashboard",
    "note": ""
  },
  {
    "id": 89,
    "title": "Показатели международной деятельности",
    "route": "impactDashboard",
    "note": ""
  },
  {
    "id": 90,
    "title": "Генератор KKSU Impact Report",
    "route": "impactReport",
    "note": ""
  },
  {
    "id": 91,
    "title": "Impact Report в PDF",
    "route": "impactReport",
    "note": ""
  },
  {
    "id": 92,
    "title": "Публичная страница Impact",
    "route": "impactPublic",
    "note": ""
  },
  {
    "id": 93,
    "title": "Каталог партнёров KKSU",
    "route": "partners",
    "note": ""
  },
  {
    "id": 94,
    "title": "Кабинет организации-партнёра",
    "route": "partnerCabinet",
    "note": ""
  },
  {
    "id": 95,
    "title": "Раздел стажировок",
    "route": "internships",
    "note": ""
  },
  {
    "id": 96,
    "title": "Заявки учеников на стажировки",
    "route": "internships",
    "note": ""
  },
  {
    "id": 97,
    "title": "Конференции и мероприятия",
    "route": "events",
    "note": ""
  },
  {
    "id": 98,
    "title": "Регистрация на конференции",
    "route": "events",
    "note": ""
  },
  {
    "id": 99,
    "title": "Электронные сертификаты участников",
    "route": "certificates",
    "note": ""
  },
  {
    "id": 100,
    "title": "Единая административная аналитика KKSU",
    "route": "analytics",
    "note": ""
  },
  {
    "id": 101,
    "title": "Регистрация пользователя — бесплатно",
    "route": "marketplace",
    "note": "RegistrationView: без оплаты"
  },
  {
    "id": 102,
    "title": "Подача заявки в KKSU — бесплатно",
    "route": "application",
    "note": ""
  },
  {
    "id": 103,
    "title": "Статус ученика KKSU (enrollment) — $200",
    "route": "marketplace",
    "note": "Школьные модули закрыты до оплаты или стипендии"
  },
  {
    "id": 104,
    "title": "Отдельный образовательный курс — $10–50",
    "route": "videoLibrary",
    "note": "Платные видеокурсы в библиотеке"
  },
  {
    "id": 105,
    "title": "Teacher Academy — платные программы",
    "route": "academyCourses",
    "note": ""
  },
  {
    "id": 106,
    "title": "Учитель размещает свой курс — $300",
    "route": "teacherMarketplace",
    "note": ""
  },
  {
    "id": 107,
    "title": "Платная сертификация преподавателя",
    "route": "teacherCertification",
    "note": ""
  },
  {
    "id": 108,
    "title": "Future Engineers — бесплатные и платные программы",
    "route": "engineeringCourses",
    "note": ""
  },
  {
    "id": 109,
    "title": "Global Classroom — платные международные программы",
    "route": "globalClasses",
    "note": ""
  },
  {
    "id": 110,
    "title": "Young Inventors — платная регистрация",
    "route": "yiApply",
    "note": ""
  },
  {
    "id": 111,
    "title": "KKSU Inventions — платные услуги",
    "route": "inventionsServices",
    "note": ""
  },
  {
    "id": 112,
    "title": "Конференции — регистрационный взнос",
    "route": "events",
    "note": ""
  },
  {
    "id": 113,
    "title": "Teacher Marketplace",
    "route": "teacherMarketplace",
    "note": ""
  },
  {
    "id": 114,
    "title": "KKSU Marketplace — каталог платных продуктов",
    "route": "marketplace",
    "note": ""
  },
  {
    "id": 115,
    "title": "Подписка KKSU — месяц / год",
    "route": "subscriptions",
    "note": ""
  },
  {
    "id": 116,
    "title": "Семейная подписка — несколько детей",
    "route": "subscriptions",
    "note": ""
  },
  {
    "id": 117,
    "title": "Промокоды и скидки",
    "route": "promoCodes",
    "note": ""
  },
  {
    "id": 118,
    "title": "Стипендия / бесплатный доступ от администратора",
    "route": "scholarships",
    "note": ""
  },
  {
    "id": 119,
    "title": "История платежей пользователя",
    "route": "paymentHistory",
    "note": ""
  },
  {
    "id": 120,
    "title": "Инвойсы, чеки и статусы оплаты",
    "route": "paymentHistory",
    "note": "PDF счёта и чека"
  },
  {
    "id": 121,
    "title": "Панель администратора по выручке",
    "route": "revenue",
    "note": ""
  },
  {
    "id": 122,
    "title": "Продажи по курсам, преподавателям и программам",
    "route": "revenue",
    "note": ""
  },
  {
    "id": 123,
    "title": "Возвраты и отмены",
    "route": "paymentsAdmin",
    "note": ""
  },
  {
    "id": 124,
    "title": "Автооткрытие курса после подтверждённой оплаты",
    "route": "paymentsAdmin",
    "note": ""
  },
  {
    "id": 125,
    "title": "Блокировка платного контента до оплаты",
    "route": "marketplace",
    "note": "PaywallGate во всех платных модулях"
  },
  {
    "id": 126,
    "title": "Конструктор курсов и уроков для педагога",
    "route": "courseStudio",
    "note": ""
  },
  {
    "id": 127,
    "title": "Онлайн-урок по ссылке (Jitsi, Zoom, Meet, Teams) с добавлением в расписание",
    "route": "courseStudio",
    "note": ""
  },
  {
    "id": 128,
    "title": "Запись урока на YouTube — просмотр прямо в приложении",
    "route": "schoolCourses",
    "note": ""
  },
  {
    "id": 129,
    "title": "Конспект урока текстом, файлы и полезные ссылки",
    "route": "schoolCourses",
    "note": ""
  },
  {
    "id": 130,
    "title": "Прохождение курса учеником: прогресс, тест, ДЗ, вопрос учителю",
    "route": "schoolCourses",
    "note": ""
  },
  {
    "id": 131,
    "title": "Жалобы на сообщения, проекты и пользователей",
    "route": "chat",
    "note": "Долгое нажатие на сообщение или меню «…»"
  },
  {
    "id": 132,
    "title": "Блокировка пользователей",
    "route": "chat",
    "note": "Профиль → Заблокированные пользователи"
  },
  {
    "id": 133,
    "title": "Модерация жалоб администратором",
    "route": "moderation",
    "note": ""
  },
  {
    "id": 134,
    "title": "Удаление аккаунта из приложения",
    "route": "myData",
    "note": "Профиль → Аккаунт → Удалить аккаунт"
  }
];

export const CABINET_FOR: Record<KKSURole, RouteId> = {
  "student": "studentCabinet",
  "parent": "parentCabinet",
  "teacher": "teacherCabinet",
  "psychologist": "psychologistCabinet",
  "expert": "expertCabinet",
  "mentor": "expertCabinet",
  "partner": "partnerCabinet",
  "admin": "adminPanel"
};

export function isAvailable(route: RouteId, role: KKSURole): boolean {
  const roles = ROUTES[route].roles;
  return roles.length === 0 || roles.includes(role);
}
