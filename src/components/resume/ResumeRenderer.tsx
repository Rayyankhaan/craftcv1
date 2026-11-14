import React from 'react';
import type { ResumeContent, ResumeSectionKey } from '../../types/resume';
import { getTemplateById } from '../../lib/templates';

interface ResumeRendererProps {
  content: ResumeContent;
  templateId: string;
  scale?: number;
  id?: string;
}

const DEFAULT_TITLES: Record<ResumeSectionKey, string> = {
  summary: 'Professional Summary',
  objective: 'Career Objective',
  experience: 'Work Experience',
  internships: 'Internships',
  education: 'Education',
  technicalSkills: 'Technical Skills',
  softSkills: 'Soft Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  achievements: 'Achievements',
  awards: 'Awards',
  languages: 'Languages',
  publications: 'Publications',
  volunteer: 'Volunteer Experience',
  coursework: 'Relevant Coursework',
  responsibilities: 'Positions of Responsibility',
  extracurricular: 'Extracurricular Activities',
  custom: 'Additional Information',
};

const FONT_CSS_MAP: Record<string, string> = {
  'plus-jakarta': "'Plus Jakarta Sans', system-ui, sans-serif",
  'dm-sans': "'DM Sans', system-ui, sans-serif",
  'source-serif': "'Source Serif 4', Georgia, serif",
  playfair: "'Playfair Display', Georgia, serif",
  lora: "'Lora', Georgia, serif",
  'jetbrains-mono': "'JetBrains Mono', monospace",
};

const SIDEBAR_KEYS = new Set<ResumeSectionKey>([
  'technicalSkills',
  'softSkills',
  'languages',
  'certifications',
  'coursework',
  'extracurricular',
]);

export const ResumeRenderer: React.FC<ResumeRendererProps> = ({
  content,
  templateId,
  scale = 1,
  id,
}) => {
  const template = getTemplateById(templateId);
  const design = content.design;
  const accentColor = design?.accentColor || template.defaultAccent;
  const fontFamily = FONT_CSS_MAP[design?.fontFamily || template.defaultFont] || FONT_CSS_MAP['plus-jakarta'];
  const fontSizePt = design?.fontSize || 10;
  const lineHeight = design?.lineHeight || 1.42;
  const sectionSpacing = design?.sectionSpacing || 14;
  const marginMm = design?.marginMm || 14;
  const bulletListClass =
    design?.bulletStyle === 'square'
      ? 'list-[square]'
      : design?.bulletStyle === 'dash'
      ? 'list-none'
      : 'list-disc';

  const hidden = new Set(content.hiddenSections || []);
  const p = content.personal;

  const contactItems = [
    p.email,
    p.phone,
    p.location,
    p.linkedin,
    p.github,
    p.portfolio,
  ].filter((v) => Boolean(v && v.trim()));

  const renderSectionContent = (key: ResumeSectionKey) => {
    const title = content.sectionHeadings?.[key] || DEFAULT_TITLES[key] || key;

    const sectionHeader = (
      <div
        className="mb-1.5 pb-0.5 border-b"
        style={{
          borderColor: template.layout === 'executive-serif' ? '#cbd5e1' : accentColor,
        }}
      >
        <h3
          className="font-bold tracking-wider uppercase"
          style={{
            color: accentColor,
            fontSize: `${fontSizePt + 0.5}pt`,
          }}
        >
          {title}
        </h3>
      </div>
    );

    if (key === 'summary' && content.summary?.trim()) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <p className="text-slate-700 whitespace-pre-line">{content.summary}</p>
        </section>
      );
    }

    if (key === 'objective' && content.objective?.trim()) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <p className="text-slate-700 whitespace-pre-line">{content.objective}</p>
        </section>
      );
    }

    if ((key === 'experience' || key === 'internships' || key === 'volunteer') && content[key]?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <div className="space-y-2.5">
            {content[key].map((item) => (
              <div key={item.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold text-slate-900">
                    {item.role || 'Role'}
                    {item.company ? <span className="font-normal text-slate-700"> · {item.company}</span> : null}
                  </div>
                  <div className="text-slate-500 whitespace-nowrap shrink-0 tabular-nums" style={{ fontSize: `${fontSizePt - 1}pt` }}>
                    {[item.startDate, item.current ? 'Present' : item.endDate].filter(Boolean).join(' – ')}
                  </div>
                </div>
                {item.location ? (
                  <div className="text-slate-500 italic" style={{ fontSize: `${fontSizePt - 1}pt` }}>
                    {item.location}
                  </div>
                ) : null}
                {item.bullets?.length > 0 && (
                  <ul className={`mt-1 space-y-0.5 text-slate-700 ${bulletListClass} ${design?.bulletStyle === 'dash' ? 'pl-0' : 'pl-4'}`}>
                    {item.bullets.filter((b) => b.trim()).map((b, idx) => (
                      <li key={idx}>
                        {design?.bulletStyle === 'dash' ? '– ' : ''}
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (key === 'education' && content.education?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <div className="space-y-2">
            {content.education.map((edu) => (
              <div key={edu.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold text-slate-900">
                    {[edu.degree, edu.specialization].filter(Boolean).join(' — ') || edu.institution}
                  </div>
                  <div className="text-slate-500 whitespace-nowrap shrink-0 tabular-nums" style={{ fontSize: `${fontSizePt - 1}pt` }}>
                    {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
                  </div>
                </div>
                <div className="text-slate-600">
                  {[edu.institution, edu.location, edu.score].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (key === 'projects' && content.projects?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <div className="space-y-2.5">
            {content.projects.map((proj) => (
              <div key={proj.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold text-slate-900">
                    {proj.title}
                    {proj.domain ? <span className="font-normal text-slate-500"> · {proj.domain}</span> : null}
                  </div>
                  {proj.technologies?.length > 0 && (
                    <div className="text-slate-500 text-right" style={{ fontSize: `${fontSizePt - 1}pt` }}>
                      {proj.technologies.join(', ')}
                    </div>
                  )}
                </div>
                {proj.description ? <p className="text-slate-700 mt-0.5">{proj.description}</p> : null}
                {proj.bullets?.length > 0 && (
                  <ul className={`mt-1 space-y-0.5 text-slate-700 ${bulletListClass} ${design?.bulletStyle === 'dash' ? 'pl-0' : 'pl-4'}`}>
                    {proj.bullets.filter((b) => b.trim()).map((b, idx) => (
                      <li key={idx}>
                        {design?.bulletStyle === 'dash' ? '– ' : ''}
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (key === 'technicalSkills' && content.technicalSkills?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <p className="text-slate-700">{content.technicalSkills.join(' · ')}</p>
        </section>
      );
    }

    if (key === 'softSkills' && content.softSkills?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <p className="text-slate-700">{content.softSkills.join(' · ')}</p>
        </section>
      );
    }

    if (key === 'coursework' && content.coursework?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <p className="text-slate-700">{content.coursework.join(' · ')}</p>
        </section>
      );
    }

    if (key === 'extracurricular' && content.extracurricular?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <ul className={`space-y-0.5 text-slate-700 ${bulletListClass} pl-4`}>
            {content.extracurricular.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      );
    }

    if (key === 'certifications' && content.certifications?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <ul className="space-y-1 text-slate-700">
            {content.certifications.map((cert) => (
              <li key={cert.id} className="flex justify-between gap-2">
                <span>
                  <span className="font-medium text-slate-900">{cert.name}</span>
                  {cert.issuer ? ` — ${cert.issuer}` : ''}
                </span>
                {cert.date ? <span className="text-slate-500 tabular-nums">{cert.date}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      );
    }

    if ((key === 'achievements' || key === 'awards' || key === 'responsibilities') && content[key]?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <ul className={`space-y-1 text-slate-700 ${bulletListClass} pl-4`}>
            {content[key].map((item) => (
              <li key={item.id}>
                <span className="font-medium text-slate-900">{item.title}</span>
                {item.context ? ` — ${item.context}` : ''}
                {item.date ? <span className="text-slate-500"> ({item.date})</span> : ''}
              </li>
            ))}
          </ul>
        </section>
      );
    }

    if (key === 'languages' && content.languages?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <p className="text-slate-700">
            {content.languages.map((l) => `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`).join(' · ')}
          </p>
        </section>
      );
    }

    if (key === 'publications' && content.publications?.length) {
      return (
        <section key={key} style={{ marginBottom: `${sectionSpacing}px` }}>
          {sectionHeader}
          <ul className="space-y-1 text-slate-700">
            {content.publications.map((pub) => (
              <li key={pub.id}>
                <span className="font-medium text-slate-900">{pub.title}</span>
                {pub.venue ? ` · ${pub.venue}` : ''}
                {pub.date ? ` (${pub.date})` : ''}
              </li>
            ))}
          </ul>
        </section>
      );
    }

    return null;
  };

  const activeSections = (content.sectionOrder || []).filter((k) => !hidden.has(k));
  const isTwoColumn = template.layout === 'left-sidebar' || template.layout === 'right-sidebar';
  const sidebarSections = activeSections.filter((k) => SIDEBAR_KEYS.has(k));
  const mainSections = activeSections.filter((k) => !SIDEBAR_KEYS.has(k));

  const renderHeader = () => {
    if (template.layout === 'split-header') {
      return (
        <header className="flex items-start justify-between gap-6 pb-3 mb-4 border-b-2" style={{ borderColor: accentColor }}>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight" style={{ fontSize: `${fontSizePt + 9}pt` }}>
              {p.fullName || 'Your Full Name'}
            </h1>
            {p.targetRole && (
              <p className="font-medium mt-0.5" style={{ color: accentColor, fontSize: `${fontSizePt + 1.5}pt` }}>
                {p.targetRole}
              </p>
            )}
          </div>
          <div className="text-right text-slate-600 space-y-0.5" style={{ fontSize: `${fontSizePt - 1}pt` }}>
            {contactItems.map((item, idx) => (
              <div key={idx}>{item}</div>
            ))}
          </div>
        </header>
      );
    }

    return (
      <header
        className={`pb-3 mb-4 ${template.headerAlignment === 'center' ? 'text-center' : 'text-left'} ${
          template.layout === 'modern-accent' ? 'pt-2 border-t-4' : 'border-b'
        }`}
        style={{ borderColor: accentColor }}
      >
        <h1 className="font-bold text-slate-900 tracking-tight" style={{ fontSize: `${fontSizePt + 9}pt` }}>
          {p.fullName || 'Your Full Name'}
        </h1>
        {p.targetRole && (
          <p className="font-medium mt-0.5" style={{ color: accentColor, fontSize: `${fontSizePt + 1.5}pt` }}>
            {p.targetRole}
          </p>
        )}
        {contactItems.length > 0 && (
          <p className="text-slate-600 mt-1.5" style={{ fontSize: `${fontSizePt - 1}pt` }}>
            {contactItems.join('  ·  ')}
          </p>
        )}
      </header>
    );
  };

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        width: '210mm',
      }}
      className="mx-auto"
    >
      <div
        id={id}
        className="bg-white text-slate-900 shadow-sm border border-slate-200 relative overflow-hidden"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: `${marginMm}mm`,
          fontFamily,
          fontSize: `${fontSizePt}pt`,
          lineHeight,
        }}
      >
        {renderHeader()}

        {isTwoColumn ? (
          <div className="grid grid-cols-12 gap-6 items-start">
            {template.layout === 'left-sidebar' && (
              <aside className="col-span-4 bg-slate-50/80 p-3 rounded border border-slate-200/70">
                {sidebarSections.map(renderSectionContent)}
              </aside>
            )}
            <main className="col-span-8">
              {mainSections.map(renderSectionContent)}
            </main>
            {template.layout === 'right-sidebar' && (
              <aside className="col-span-4 bg-slate-50/80 p-3 rounded border border-slate-200/70">
                {sidebarSections.map(renderSectionContent)}
              </aside>
            )}
          </div>
        ) : (
          <div>{activeSections.map(renderSectionContent)}</div>
        )}

        {(content.customSections || []).map((custom) => (
          <section key={custom.id} style={{ marginBottom: `${sectionSpacing}px` }}>
            <div className="mb-1.5 pb-0.5 border-b" style={{ borderColor: accentColor }}>
              <h3 className="font-bold tracking-wider uppercase" style={{ color: accentColor, fontSize: `${fontSizePt + 0.5}pt` }}>
                {custom.title}
              </h3>
            </div>
            <div className="space-y-1.5">
              {custom.items.map((item) => (
                <div key={item.id}>
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>
                      {item.heading}
                      {item.subheading ? ` — ${item.subheading}` : ''}
                    </span>
                    {item.date ? <span className="text-slate-500 font-normal">{item.date}</span> : null}
                  </div>
                  {item.description ? <p className="text-slate-700">{item.description}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Visual A4 page boundary guide (screen-only, hidden on print) */}
        <div
          className="print:hidden pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-300 text-right pr-2 text-[10px] text-slate-400"
          style={{ top: '296.5mm' }}
        >
          Page 1 boundary (A4)
        </div>
      </div>
    </div>
  );
};
