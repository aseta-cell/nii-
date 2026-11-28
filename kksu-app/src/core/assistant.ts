// Локальный AI-помощник (без сети) — как LocalAssistant в iOS-приложении.
// Ключи AI-сервисов в браузер не передаются, поэтому сайт отвечает по правилам на основе данных школы.
import type { KKSUStore } from './store';
import { analyze, recommendations, teacherInsights } from './analytics';
import { sameId, time } from './ids';
import { firstName } from './helpers';

export type AssistantMode = 'student' | 'teacher';

export const ASSISTANT = {
  student: { title: 'AI-помощник KKSU', suggestions: ['Какие у меня дедлайны?', 'Объясни дроби простыми словами', 'Как мой прогресс?', 'Что мне повторить?', 'Помоги спланировать неделю'] },
  teacher: { title: 'AI-помощник педагога', suggestions: ['Составь план урока по дробям', 'Как адаптировать урок для ученика с нарушением слуха?', 'Кто из учеников требует внимания?', 'Напиши отзыв на работу ученика', 'Идеи для проектного урока'] },
};

export function reply(text: string, mode: AssistantMode, store: KKSUStore): string {
  const q = text.toLowerCase();
  const user = store.currentUser;
  if (!user) return 'Войдите в аккаунт, чтобы я мог помочь.';

  if (mode === 'student') {
    const a = analyze(user.id, store);
    const minutes = store.preferences(user.id).sessionMinutes;
    if (q.includes('дедлайн') || q.includes('задани') || q.includes('сдать')) {
      const pending = store.assignmentsFor(user.id).filter((x) => !store.submission(x.id, user.id));
      if (!pending.length) return 'У тебя нет несданных заданий. Отличная работа! 🎉';
      return 'Вот что нужно сделать:\n' + pending.slice(0, 5).map((x) => `• ${x.title} (${x.subject}) — до ${store.fmtDateTime(x.dueDate)}`).join('\n') +
        `\n\nСовет: начни с ближайшего задания и раздели его на маленькие шаги по ${minutes} минут.`;
    }
    if (q.includes('прогресс') || q.includes('успева') || q.includes('оценк')) {
      let answer = `Твой общий прогресс — ${Math.round(a.overall * 100)}%. `;
      if (a.strongest) answer += `Лучше всего получается «${a.strongest.subject}» (${Math.round(a.strongest.average * 100)}%). `;
      if (a.weakest && a.subjects.length > 1) answer += `Больше внимания стоит уделить «${a.weakest.subject}». `;
      return answer + 'Продолжай в том же духе!';
    }
    if (q.includes('повтор') || q.includes('рекоменд') || q.includes('что учить')) {
      const recs = recommendations(user.id, store).slice(0, 3);
      if (!recs.length) return 'Загляни в библиотеку видеоуроков — там много интересного!';
      return 'Рекомендую:\n' + recs.map((r) => `• ${r.title} — ${r.reason.toLowerCase()}`).join('\n');
    }
    if (q.includes('распис') || q.includes('недел') || q.includes('план')) {
      const sessions = store.db.sessions.filter((s) => s.participantIDs.some((p) => sameId(p, user.id)) && time(s.start) > Date.now())
        .sort((x, y) => time(x.start) - time(y.start)).slice(0, 5);
      return 'Ближайшие занятия:\n' + (sessions.map((s) => `• ${store.fmtDateTime(s.start)} — ${s.subject}: ${s.title}`).join('\n') || '• пока нет') +
        `\n\nПланируй по 1–2 задания в день и делай перерывы каждые ${minutes} минут.`;
    }
    const words = q.split(/\s+/).filter((w) => w.length > 3);
    const item = store.db.library.find((i) => i.textAlternative && words.some((w) => i.title.toLowerCase().includes(w.slice(0, 5))));
    if (item) return `Вот простое объяснение из урока «${item.title}»:\n\n${item.textAlternative}\n\nХочешь, разберём пример вместе? Напиши, что именно непонятно.`;
    return `${firstName(user)}, я локальный помощник KKSU и лучше всего подскажу про задания, дедлайны, расписание и прогресс. Попробуй спросить: «Какие у меня дедлайны?» или «Объясни дроби».`;
  }

  if (q.includes('план урока') || (q.includes('урок') && q.includes('план'))) {
    const topic = text.split(' по ').pop() ?? 'теме';
    return `План урока по ${topic} (45 мин):
1. Мотивация (5 мин): жизненная ситуация, вопрос классу.
2. Актуализация (5 мин): короткий опрос, визуальная опора на доске.
3. Новый материал (15 мин): объяснение с наглядностью; письменные инструкции и субтитры к видео для учеников с нарушением слуха.
4. Практика в парах (12 мин): 3 задания разного уровня сложности.
5. Рефлексия (5 мин): «светофор» понимания.
6. Домашнее задание (3 мин): выбор из двух вариантов.
Не забудьте проверить материалы перед отправкой ученикам.`;
  }
  if (q.includes('адапт') || q.includes('слух') || q.includes('оуп') || q.includes('ооп')) {
    return `Рекомендации по адаптации:
• Дублируйте устные инструкции письменно; используйте субтитры (включены в библиотеке видео).
• Добавляйте текстовые альтернативы к изображениям и схемам.
• Делите задания на короткие шаги, давайте больше времени.
• Используйте визуальные опоры и проверку понимания после каждого шага.
• Согласуйте индивидуальный учебный план с психологом и родителями.`;
  }
  if (q.includes('внимани') || q.includes('риск') || q.includes('кто')) {
    const list = teacherInsights(store.students.map((s) => analyze(s.id, store)), store);
    return list.length ? list.slice(0, 5).map((i) => `• ${i.title}\n  → ${i.action}`).join('\n') : 'Все ученики стабильны.';
  }
  if (q.includes('отзыв') || q.includes('обратн')) {
    return 'Шаблон отзыва: «[Имя], ты хорошо справился с [сильная сторона]. Обрати внимание на [зона роста]: попробуй [конкретный шаг]. Я уверен, у тебя получится!» — Конкретная похвала + одна зона роста + следующий шаг.';
  }
  if (q.includes('проект')) {
    return 'Идеи для проектного урока: 1) «Умный дом для бабушки» — датчики и доступность; 2) «Школа без барьеров» — аудит доступности здания; 3) «Эко-сортировщик» — AI-распознавание мусора. Используйте стадии Idea → Research → Prototype → Testing → Result в KKSU Inventions.';
  }
  return 'Я локальный помощник педагога: помогу с планом урока, адаптацией для учеников с ООП, списком учеников, требующих внимания, шаблонами отзывов и идеями проектов.';
}

/** Шаблонная генерация индивидуального задания (задача 81). */
export function generateTask(studentID: string, subject: string, topic: string, difficulty: number, store: KKSUStore) {
  const profile = store.profile(studentID);
  const interest = profile?.interests[0] ?? 'повседневной жизни';
  const prefs = store.preferences(studentID);
  const level = ['базовый', 'средний', 'повышенный'][Math.min(Math.max(difficulty - 1, 0), 2)];
  const steps = prefs.pace === 'gentle' ? 3 : difficulty >= 3 ? 6 : 4;
  let details = `Тема: ${topic}. Уровень: ${level}.\n`;
  details += `Ситуация: представь, что ты работаешь над проектом, связанным с темой «${interest}». Тебе нужно применить знания по теме «${topic}».\n\n`;
  details += `Выполни ${steps} шага(ов):\n`;
  for (let step = 1; step <= steps; step++) {
    details += `${step}. ` + (step === 1 ? 'Прочитай условие и выпиши, что известно.' : step === steps ? 'Проверь ответ и запиши вывод одним предложением.' : `Реши подзадачу ${step - 1} и запиши решение по шагам.`) + '\n';
  }
  if (profile?.specialNeeds) details += `\nАдаптация: инструкции даны письменно, можно выполнять с перерывами каждые ${prefs.sessionMinutes} минут.`;
  return {
    title: `${subject}: ${topic} — индивидуальное задание`,
    details,
    textAlternative: `Задание по предмету «${subject}», тема «${topic}», ${steps} шагов: прочитать условие, решить подзадачи, проверить ответ.`,
  };
}
