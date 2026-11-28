// Impact Dashboard (84–89), KKSU Impact Report с печатью в PDF (90, 91), публичная страница (92) — как KKSUImpact.swift.
import { useState } from 'react';
import * as M from '../core/models.gen';
import { analyze, impactMetrics, RISK_COLOR, RISK_TITLE, type ImpactMetrics, type RiskLevel } from '../core/analytics';
import { time } from '../core/ids';
import { Badge, Card, DateInput, InfoRow, Page, RouteRow, Section, StatTile, TextInput, fmt, useStore } from '../ui/kit';
import { Icon } from '../ui/icon';
import { BarChart, HBarChart, escapeHTML, printDocument } from './shared';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function ImpactDashboardScreen() {
  const s = useStore();
  const m = impactMetrics(s.db);
  const analyses = s.students.map((x) => analyze(x.id, s));
  const risk = (['low', 'medium', 'high'] as RiskLevel[]).map((r) => ({ label: RISK_TITLE[r], value: analyses.filter((a) => a.risk === r).length, color: RISK_COLOR[r] }));
  const grid = (min = 150) => ({ ['--min' as string]: `${min}px` });
  return (
    <Page title="Impact Dashboard" wide>
      <span className="muted">Все показатели рассчитываются автоматически по данным платформы в реальном времени.</span>
      <Section title="Ключевые показатели" icon="sum" />
      <div className="grid" style={grid()}>
        <StatTile title="Учеников" value={m.students} icon="graduationcap.fill" />
        <StatTile title="Проведено занятий" value={m.lessonsHeld} icon="video.fill" color="var(--accent)" />
        <StatTile title="Проектов" value={m.projects} icon="lightbulb.fill" color="var(--success)" />
        <StatTile title="Результатов (итоги проектов и сертификаты)" value={m.results} icon="flag.checkered" color="purple" />
      </div>
      <Section title="Образовательный прогресс" icon="chart.line.uptrend.xyaxis" />
      <div className="grid" style={grid()}>
        <StatTile title="Средний балл работ" value={pct(m.averageScore)} icon="star.fill" />
        <StatTile title="Выполнение заданий" value={pct(m.completionRate)} icon="checkmark.circle.fill" color="var(--success)" />
        <StatTile title="Посещаемость" value={pct(m.attendanceRate)} icon="person.fill.checkmark" color="var(--accent)" />
        <StatTile title="Сдано тестов" value={m.testsPassed} icon="checklist" color="purple" />
        <StatTile title="Достижений" value={m.achievements} icon="trophy.fill" color="var(--accent)" />
        <StatTile title="Выпускников Teacher Academy" value={m.academyGraduates} icon="building.columns.fill" />
      </div>
      <Card><h3>Распределение учеников по статусу</h3><HBarChart data={risk} /></Card>
      <Section title="Проекты и изобретения" icon="lightbulb.max.fill" />
      <Card><h3>Воронка стадий проектов</h3><BarChart data={m.projectsByStage.map(([st, n]) => ({ label: M.ProjectStage.title[st], value: n }))} /></Card>
      <div className="grid" style={grid()}>
        <StatTile title="Прототипов" value={m.prototypes} icon="cube.transparent.fill" />
        <StatTile title="Экспериментов" value={m.experiments} icon="testtube.2" color="var(--accent)" />
        <StatTile title="Заявок Young Inventors" value={m.yiApplications} icon="sparkles" color="purple" />
        <StatTile title="Инклюзивных разработок" value={m.inclusiveProjects} icon="figure.roll" color="var(--success)" />
      </div>
      <Section title="Партнёрства" icon="handshake.fill" />
      <div className="grid" style={grid()}>
        <StatTile title="Партнёров" value={m.partners} icon="building.2.fill" />
        <StatTile title="Стажировок" value={m.internships} icon="briefcase.fill" color="var(--accent)" />
        <StatTile title="Заявок на стажировки" value={m.internshipApplications} icon="person.crop.rectangle.stack" color="purple" />
        <StatTile title="Учеников на стажировках" value={m.internshipAccepted} icon="checkmark.circle.fill" color="var(--success)" />
      </div>
      {m.partnersByKind.length > 0 && <Card><h3>Партнёры по типам</h3><HBarChart data={m.partnersByKind.map(([k, n]) => ({ label: M.PartnerKind.title[k], value: n }))} /></Card>}
      <Section title="Международная деятельность" icon="globe" />
      <div className="grid" style={grid()}>
        <StatTile title="Стран-участниц" value={m.countries} icon="flag.fill" />
        <StatTile title="Международных классов" value={m.globalClasses} icon="video.bubble.fill" color="var(--accent)" />
        <StatTile title="Совместных проектов" value={m.internationalProjects} icon="globe" color="var(--success)" />
        <StatTile title="Зарубежных экспертов" value={m.internationalExperts} icon="person.crop.square.filled.and.at.rectangle" color="purple" />
        <StatTile title="Международных партнёров" value={m.internationalPartners} icon="building.2.crop.circle" />
        <StatTile title="Международных мероприятий" value={m.internationalEvents} icon="calendar.badge.plus" color="var(--accent)" />
      </div>
      <Card><div className="list">
        {s.role === 'admin' && <RouteRow route="impactReport" subtitle="Сформировать отчёт в PDF" />}
        <RouteRow route="impactPublic" subtitle="Как показатели видят посетители сайта" />
      </div></Card>
    </Page>
  );
}

// MARK: KKSU Impact Report (90, 91)

const DEFAULT_HIGHLIGHTS = 'KKSU Online объединяет инклюзивное обучение, изобретательство и международное сотрудничество. За отчётный период ученики создали прототипы для людей с особыми потребностями, а педагоги прошли курсы Teacher Academy.';

const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString(); };

export function ImpactReportScreen() {
  const s = useStore();
  const [from, setFrom] = useState(monthsAgo(12));
  const [to, setTo] = useState(new Date().toISOString());
  const [highlights, setHighlights] = useState(DEFAULT_HIGHLIGHTS);
  const toEnd = time(to) + 86400000;
  const m = impactMetrics(s.db, time(from), toEnd);
  const period = `${fmt.short(from)} – ${fmt.short(to)}`;
  const top = s.db.projects.filter((p) => time(p.createdAt) >= time(from) && time(p.createdAt) <= toEnd).sort((a, b) => b.likes - a.likes).slice(0, 4);
  const print = () => printDocument(`KKSU Impact Report ${period}`, reportHTML(m, period, highlights, top, s.db.partners));
  return (
    <Page title="KKSU Impact Report">
      <Card>
        <h3>Период отчёта</h3>
        <div className="form-grid">
          <DateInput label="С" dateOnly value={from} onChange={setFrom} />
          <DateInput label="По" dateOnly value={to} onChange={setTo} />
        </div>
        <div className="row wrap">
          {([['Квартал', 3], ['Полгода', 6], ['Год', 12]] as const).map(([l, n]) => <button key={l} className="btn small" onClick={() => { setFrom(monthsAgo(n)); setTo(new Date().toISOString()); }}>{l}</button>)}
        </div>
      </Card>
      <Card><TextInput label="Ключевые события периода (раздел «Главное»)" multiline rows={5} value={highlights} onChange={setHighlights} /></Card>
      <Card>
        <h3>Показатели будут рассчитаны автоматически</h3>
        <InfoRow label="Ученики / занятия" value={`${m.students} / ${m.lessonsHeld}`} />
        <InfoRow label="Проекты / прототипы" value={`${m.projects} / ${m.prototypes}`} />
        <InfoRow label="Партнёры / стажировки" value={`${m.partners} / ${m.internships}`} />
        <InfoRow label="Страны / международные проекты" value={`${m.countries} / ${m.internationalProjects}`} />
      </Card>
      <button className="btn primary" onClick={print}>📄 Сформировать PDF (печать)</button>
      <span className="muted small">Откроется печатная версия отчёта — выберите «Сохранить как PDF».</span>
    </Page>
  );
}

function reportHTML(m: ImpactMetrics, period: string, highlights: string, top: M.InventionProject[], partners: M.Partner[]) {
  const grid = (items: [string, string | number][]) => `<table><tr>${items.map(([t, v], i) => `${i && i % 3 === 0 ? '</tr><tr>' : ''}<td><div style="font-size:24px;font-weight:700;color:#00337d">${v}</div><div class="muted" style="font-size:12px">${escapeHTML(t)}</div></td>`).join('')}</tr></table>`;
  const header = `<div style="display:flex;justify-content:space-between;color:#00337d;font-size:11px;font-weight:800;letter-spacing:3px;border-bottom:2px solid #00337d;padding-bottom:6px;margin-bottom:16px"><span>KKSU IMPACT REPORT</span><span style="letter-spacing:0;font-weight:400">${escapeHTML(period)}</span></div>`;
  const page = (n: number, html: string) => `<section style="page-break-after:always;min-height:900px">${header}${html}<div class="muted" style="font-size:10px;margin-top:24px;display:flex;justify-content:space-between"><span>KKSU Online · Comfort School-University</span><span>Стр. ${n}</span></div></section>`;
  return [
    page(1, `<h1 style="font-size:34px">Отчёт о влиянии</h1><p>Период: ${escapeHTML(period)}</p><h3>Главное</h3><p>${escapeHTML(highlights)}</p>${grid([
      ['Учеников', m.students], ['Педагогов', m.teachers], ['Занятий проведено', m.lessonsHeld], ['Проектов', m.projects], ['Результатов', m.results],
      ['Сертификатов', m.certificates], ['Партнёров', m.partners], ['Стран', m.countries], ['Мероприятий', m.events]])}
      <p class="muted" style="font-size:10px">Отчёт сформирован автоматически платформой KKSU Online ${escapeHTML(fmt.dateTime(new Date().toISOString()))}.</p>`),
    page(2, `<h2 style="color:#00337d">1. Образовательный прогресс</h2>${grid([
      ['Средний балл работ', pct(m.averageScore)], ['Выполнение заданий', pct(m.completionRate)], ['Посещаемость', pct(m.attendanceRate)],
      ['Сдано тестов', m.testsPassed], ['Достижений', m.achievements], ['Выпускников Academy', m.academyGraduates]])}
      <p>Инклюзивность: все видеоуроки сопровождаются субтитрами и текстовыми альтернативами, ученики получают индивидуальные траектории и учебные планы.</p>`),
    page(3, `<h2 style="color:#00337d">2. Проекты и изобретения</h2>${grid([
      ['Проектов', m.projects], ['Прототипов', m.prototypes], ['Экспериментов', m.experiments], ['Заявок Young Inventors', m.yiApplications],
      ['Финалистов', m.yiFinalists], ['Инклюзивных разработок', m.inclusiveProjects]])}
      <table><tr>${m.projectsByStage.map(([st]) => `<th>${M.ProjectStage.title[st]}</th>`).join('')}</tr><tr>${m.projectsByStage.map(([, n]) => `<td>${n}</td>`).join('')}</tr></table>
      <h3>Лучшие проекты периода</h3>${top.map((p) => `<p><b>${escapeHTML(p.title)}</b> — ${escapeHTML(M.ProjectTrack.title[p.track])}, стадия ${M.ProjectStage.title[p.stage]}<br><span class="muted">${escapeHTML(p.summary)}</span></p>`).join('') || '<p class="muted">—</p>'}`),
    page(4, `<h2 style="color:#00337d">3. Партнёрства</h2>${grid([['Партнёров', m.partners], ['Стажировок', m.internships], ['Учеников на стажировках', m.internshipAccepted]])}
      <p>${partners.map((p) => escapeHTML(p.name)).join(' · ')}</p>
      <h2 style="color:#00337d">4. Международная деятельность</h2>${grid([['Стран', m.countries], ['Международных классов', m.globalClasses], ['Совместных проектов', m.internationalProjects],
      ['Зарубежных экспертов', m.internationalExperts], ['Международных партнёров', m.internationalPartners], ['Международных мероприятий', m.internationalEvents]])}
      <h2 style="color:#00337d">5. Мероприятия</h2>${grid([['Мероприятий', m.events], ['Участников', m.eventParticipants], ['Сертификатов', m.certificates]])}`),
  ].join('');
}

// MARK: Публичная страница Impact (92)

export function ImpactPublicScreen() {
  const s = useStore();
  const m = impactMetrics(s.db);
  const stories = s.db.projects.filter((p) => p.showInExhibition).sort((a, b) => b.likes - a.likes).slice(0, 3);
  return (
    <Page title="Наш Impact" wide>
      <div className="stack tight">
        <h1 style={{ color: 'var(--primary)' }}>KKSU в цифрах</h1>
        <span className="muted">Мы делаем образование доступным для каждого ребёнка и превращаем идеи учеников в реальные изобретения.</span>
      </div>
      <div className="grid" style={{ ['--min' as string]: '150px' }}>
        <StatTile title="учеников учатся в KKSU" value={m.students} icon="graduationcap.fill" />
        <StatTile title="занятий проведено" value={m.lessonsHeld} icon="video.fill" color="var(--accent)" />
        <StatTile title="проектов и изобретений" value={m.projects} icon="lightbulb.fill" color="var(--success)" />
        <StatTile title="прототипов создано" value={m.prototypes} icon="cube.transparent.fill" color="purple" />
        <StatTile title="партнёров" value={m.partners} icon="handshake.fill" />
        <StatTile title="стран-участниц" value={m.countries} icon="globe" color="var(--accent)" />
        <StatTile title="выдано сертификатов" value={m.certificates} icon="rosette" color="var(--success)" />
        <StatTile title="инклюзивных разработок" value={m.inclusiveProjects} icon="figure.roll" color="purple" />
      </div>
      <Section title="Истории изобретений" icon="sparkles" />
      {stories.map((p) => (
        <Card key={p.id}>
          <b className="row"><Icon name={M.ProjectTrack.icon[p.track]} /> {p.title}</b>
          <span>{p.summary}</span>
          {p.inclusiveTarget && <Badge text={`Для: ${p.inclusiveTarget}`} color="purple" />}
        </Card>
      ))}
      <Section title="Партнёры" icon="handshake.fill" />
      <div className="chips">{s.db.partners.map((p) => <span key={p.id} className="chip">{p.name}</span>)}</div>
      <span className="muted small">Данные обновляются автоматически и не содержат персональной информации.</span>
    </Page>
  );
}
