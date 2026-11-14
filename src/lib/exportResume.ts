import { jsPDF } from 'jspdf';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { ResumeContent, ResumeRecord, ResumeSectionKey } from '../types/resume';
import { getTemplateById } from './templates';

const DEFAULT_SECTION_TITLES: Record<ResumeSectionKey, string> = {
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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [30, 41, 59];
  const r = parseInt(clean.slice(0, 2), 16) || 30;
  const g = parseInt(clean.slice(2, 4), 16) || 41;
  const b = parseInt(clean.slice(4, 6), 16) || 59;
  return [r, g, b];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(title: string, ext: string): string {
  const slug = (title || 'resume').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${slug || 'resume'}.${ext}`;
}

export function exportResumeToPdf(resume: ResumeRecord): void {
  const content: ResumeContent = resume.content;
  const template = getTemplateById(resume.templateId);
  const margin = Math.max(10, Math.min(22, content.design?.marginMm || 14));
  const accentHex = content.design?.accentColor || template.defaultAccent;
  const [ar, ag, ab] = hexToRgb(accentHex);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const fontMap: Record<string, string> = {
    'source-serif': 'times',
    playfair: 'times',
    lora: 'times',
    'jetbrains-mono': 'courier',
  };
  const pdfFont = fontMap[content.design?.fontFamily || template.defaultFont] || 'helvetica';
  const baseFontSize = content.design?.fontSize || 10;
  const lineH = (baseFontSize * 0.3527) * (content.design?.lineHeight || 1.4);

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  const p = content.personal;
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  const nameText = p.fullName || resume.title || 'Candidate Name';
  if (template.headerAlignment === 'center') {
    doc.text(nameText, pageWidth / 2, y + 4, { align: 'center' });
    y += 7;
  } else {
    doc.text(nameText, margin, y + 4);
    y += 7;
  }

  if (p.targetRole) {
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(11);
    doc.setTextColor(ar, ag, ab);
    if (template.headerAlignment === 'center') {
      doc.text(p.targetRole, pageWidth / 2, y + 2, { align: 'center' });
    } else {
      doc.text(p.targetRole, margin, y + 2);
    }
    y += 5;
  }

  // Contact line with clickable links
  const contactParts: { label: string; url?: string }[] = [];
  if (p.email) contactParts.push({ label: p.email, url: `mailto:${p.email}` });
  if (p.phone) contactParts.push({ label: p.phone });
  if (p.location) contactParts.push({ label: p.location });
  if (p.linkedin) contactParts.push({ label: p.linkedin, url: p.linkedin.startsWith('http') ? p.linkedin : `https://${p.linkedin}` });
  if (p.github) contactParts.push({ label: p.github, url: p.github.startsWith('http') ? p.github : `https://${p.github}` });
  if (p.portfolio) contactParts.push({ label: p.portfolio, url: p.portfolio.startsWith('http') ? p.portfolio : `https://${p.portfolio}` });

  if (contactParts.length > 0) {
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(71, 85, 105);
    let cursorX = margin;
    let lineY = y + 2;
    contactParts.forEach((part, idx) => {
      const text = idx < contactParts.length - 1 ? `${part.label}  |  ` : part.label;
      const w = doc.getTextWidth(text);
      if (cursorX + w > pageWidth - margin) {
        cursorX = margin;
        lineY += 4.2;
      }
      if (part.url) {
        doc.textWithLink(part.label, cursorX, lineY, { url: part.url });
        if (idx < contactParts.length - 1) {
          doc.text('  |  ', cursorX + doc.getTextWidth(part.label), lineY);
        }
      } else {
        doc.text(text, cursorX, lineY);
      }
      cursorX += w;
    });
    y = lineY + 4;
  }

  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  const drawSectionTitle = (title: string) => {
    ensureSpace(12);
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(ar, ag, ab);
    doc.text(title.toUpperCase(), margin, y);
    y += 1.5;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4.5;
  };

  const drawWrappedText = (text: string, indent = 0, bold = false, color: [number, number, number] = [30, 41, 59]) => {
    doc.setFont(pdfFont, bold ? 'bold' : 'normal');
    doc.setFontSize(baseFontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentWidth - indent) as string[];
    for (const line of lines) {
      ensureSpace(lineH + 1);
      doc.text(line, margin + indent, y);
      y += lineH;
    }
  };

  const bulletChar =
    content.design?.bulletStyle === 'dash' ? '-' : content.design?.bulletStyle === 'square' ? '▪' : '•';

  const hidden = new Set(content.hiddenSections || []);
  for (const key of content.sectionOrder || []) {
    if (hidden.has(key)) continue;
    const heading = content.sectionHeadings?.[key] || DEFAULT_SECTION_TITLES[key] || key;

    if (key === 'summary' && content.summary?.trim()) {
      drawSectionTitle(heading);
      drawWrappedText(content.summary.trim());
      y += 3;
    } else if (key === 'objective' && content.objective?.trim()) {
      drawSectionTitle(heading);
      drawWrappedText(content.objective.trim());
      y += 3;
    } else if ((key === 'experience' || key === 'internships' || key === 'volunteer') && content[key]?.length) {
      drawSectionTitle(heading);
      for (const item of content[key]) {
        ensureSpace(12);
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(15, 23, 42);
        const leftLabel = `${item.role}${item.company ? ` — ${item.company}` : ''}`;
        const dateLabel = [item.startDate, item.current ? 'Present' : item.endDate].filter(Boolean).join(' – ');
        doc.text(leftLabel, margin, y);
        if (dateLabel) {
          doc.setFont(pdfFont, 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(dateLabel, pageWidth - margin, y, { align: 'right' });
        }
        y += lineH;
        if (item.location) {
          doc.setFont(pdfFont, 'italic');
          doc.setFontSize(baseFontSize - 0.8);
          doc.setTextColor(100, 116, 139);
          doc.text(item.location, margin, y);
          y += lineH - 0.5;
        }
        for (const b of item.bullets || []) {
          if (b.trim()) drawWrappedText(`${bulletChar}  ${b.trim()}`, 3);
        }
        y += 2;
      }
    } else if (key === 'education' && content.education?.length) {
      drawSectionTitle(heading);
      for (const edu of content.education) {
        ensureSpace(10);
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(15, 23, 42);
        const deg = [edu.degree, edu.specialization].filter(Boolean).join(' — ');
        doc.text(deg || edu.institution, margin, y);
        const dateStr = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
        if (dateStr) {
          doc.setFont(pdfFont, 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
        }
        y += lineH;
        const sub = [edu.institution, edu.location, edu.score].filter(Boolean).join('  ·  ');
        if (sub) drawWrappedText(sub, 0, false, [71, 85, 105]);
        y += 1.5;
      }
      y += 1.5;
    } else if (key === 'projects' && content.projects?.length) {
      drawSectionTitle(heading);
      for (const proj of content.projects) {
        ensureSpace(12);
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(15, 23, 42);
        doc.text(proj.title, margin, y);
        if (proj.technologies?.length) {
          doc.setFont(pdfFont, 'normal');
          doc.setFontSize(baseFontSize - 1);
          doc.setTextColor(100, 116, 139);
          doc.text(proj.technologies.join(', '), pageWidth - margin, y, { align: 'right' });
        }
        y += lineH;
        if (proj.description?.trim()) drawWrappedText(proj.description.trim());
        for (const b of proj.bullets || []) {
          if (b.trim()) drawWrappedText(`${bulletChar}  ${b.trim()}`, 3);
        }
        y += 2;
      }
    } else if (key === 'technicalSkills' && content.technicalSkills?.length) {
      drawSectionTitle(heading);
      drawWrappedText(content.technicalSkills.join('  ·  '));
      y += 3;
    } else if (key === 'softSkills' && content.softSkills?.length) {
      drawSectionTitle(heading);
      drawWrappedText(content.softSkills.join('  ·  '));
      y += 3;
    } else if (key === 'coursework' && content.coursework?.length) {
      drawSectionTitle(heading);
      drawWrappedText(content.coursework.join('  ·  '));
      y += 3;
    } else if (key === 'extracurricular' && content.extracurricular?.length) {
      drawSectionTitle(heading);
      for (const item of content.extracurricular) {
        drawWrappedText(`${bulletChar}  ${item}`, 3);
      }
      y += 2;
    } else if (key === 'certifications' && content.certifications?.length) {
      drawSectionTitle(heading);
      for (const cert of content.certifications) {
        drawWrappedText(`${bulletChar}  ${[cert.name, cert.issuer, cert.date].filter(Boolean).join(' — ')}`, 3);
      }
      y += 2;
    } else if ((key === 'achievements' || key === 'awards' || key === 'responsibilities') && content[key]?.length) {
      drawSectionTitle(heading);
      for (const item of content[key]) {
        drawWrappedText(`${bulletChar}  ${[item.title, item.context, item.date].filter(Boolean).join(' — ')}`, 3);
      }
      y += 2;
    } else if (key === 'languages' && content.languages?.length) {
      drawSectionTitle(heading);
      drawWrappedText(content.languages.map((l) => `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`).join('  ·  '));
      y += 3;
    } else if (key === 'publications' && content.publications?.length) {
      drawSectionTitle(heading);
      for (const pub of content.publications) {
        drawWrappedText(`${bulletChar}  ${[pub.title, pub.venue, pub.date].filter(Boolean).join(' — ')}`, 3);
      }
      y += 2;
    }
  }

  for (const custom of content.customSections || []) {
    if (!custom.items?.length) continue;
    drawSectionTitle(custom.title);
    for (const item of custom.items) {
      drawWrappedText(`${item.heading}${item.subheading ? ` — ${item.subheading}` : ''}`, 0, true);
      if (item.description) drawWrappedText(item.description, 2);
      y += 1.5;
    }
  }

  doc.save(safeFileName(resume.title, 'pdf'));
}

export async function exportResumeToDocx(resume: ResumeRecord): Promise<void> {
  const c = resume.content;
  const p = c.personal;
  const accentHex = (c.design?.accentColor || '#3730a3').replace('#', '');
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: p.fullName || resume.title || 'Candidate Name',
          bold: true,
          size: 34,
          color: '0F172A',
        }),
      ],
    })
  );

  if (p.targetRole) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: p.targetRole,
            size: 22,
            color: accentHex,
          }),
        ],
      })
    );
  }

  const contactRuns: (TextRun | ExternalHyperlink)[] = [];
  const addContact = (label: string, url?: string) => {
    if (contactRuns.length > 0) {
      contactRuns.push(new TextRun({ text: '  |  ', size: 18, color: '64748B' }));
    }
    if (url) {
      contactRuns.push(
        new ExternalHyperlink({
          link: url,
          children: [new TextRun({ text: label, size: 18, color: accentHex, underline: {} })],
        })
      );
    } else {
      contactRuns.push(new TextRun({ text: label, size: 18, color: '475569' }));
    }
  };

  if (p.email) addContact(p.email, `mailto:${p.email}`);
  if (p.phone) addContact(p.phone);
  if (p.location) addContact(p.location);
  if (p.linkedin) addContact(p.linkedin, p.linkedin.startsWith('http') ? p.linkedin : `https://${p.linkedin}`);
  if (p.github) addContact(p.github, p.github.startsWith('http') ? p.github : `https://${p.github}`);

  if (contactRuns.length > 0) {
    children.push(new Paragraph({ spacing: { after: 180 }, children: contactRuns }));
  }

  const addSectionHeader = (title: string) => {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        border: {
          bottom: { color: accentHex, space: 4, style: BorderStyle.SINGLE, size: 6 },
        },
        children: [
          new TextRun({
            text: title.toUpperCase(),
            bold: true,
            size: 21,
            color: accentHex,
          }),
        ],
      })
    );
  };

  const hidden = new Set(c.hiddenSections || []);
  for (const key of c.sectionOrder || []) {
    if (hidden.has(key)) continue;
    const heading = c.sectionHeadings?.[key] || DEFAULT_SECTION_TITLES[key] || key;

    if (key === 'summary' && c.summary?.trim()) {
      addSectionHeader(heading);
      children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: c.summary, size: 20 })] }));
    } else if (key === 'objective' && c.objective?.trim()) {
      addSectionHeader(heading);
      children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: c.objective, size: 20 })] }));
    } else if ((key === 'experience' || key === 'internships' || key === 'volunteer') && c[key]?.length) {
      addSectionHeader(heading);
      for (const item of c[key]) {
        const dateStr = [item.startDate, item.current ? 'Present' : item.endDate].filter(Boolean).join(' – ');
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: `${item.role} — ${item.company}`, bold: true, size: 20 }),
              ...(dateStr ? [new TextRun({ text: `   (${dateStr})`, size: 18, color: '64748B' })] : []),
            ],
          })
        );
        for (const b of item.bullets || []) {
          if (b.trim()) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 30 },
                children: [new TextRun({ text: b.trim(), size: 20 })],
              })
            );
          }
        }
      }
    } else if (key === 'education' && c.education?.length) {
      addSectionHeader(heading);
      for (const edu of c.education) {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 40 },
            children: [
              new TextRun({ text: [edu.degree, edu.specialization].filter(Boolean).join(' — '), bold: true, size: 20 }),
              new TextRun({ text: `  |  ${edu.institution} (${[edu.startDate, edu.endDate].filter(Boolean).join(' – ')})`, size: 19, color: '475569' }),
              ...(edu.score ? [new TextRun({ text: `  ·  ${edu.score}`, size: 19, bold: true })] : []),
            ],
          })
        );
      }
    } else if (key === 'projects' && c.projects?.length) {
      addSectionHeader(heading);
      for (const proj of c.projects) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 30 },
            children: [
              new TextRun({ text: proj.title, bold: true, size: 20 }),
              ...(proj.technologies?.length
                ? [new TextRun({ text: `  [${proj.technologies.join(', ')}]`, size: 18, color: '64748B' })]
                : []),
            ],
          })
        );
        if (proj.description) {
          children.push(new Paragraph({ children: [new TextRun({ text: proj.description, size: 19 })] }));
        }
        for (const b of proj.bullets || []) {
          if (b.trim()) {
            children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b.trim(), size: 20 })] }));
          }
        }
      }
    } else if (key === 'technicalSkills' && c.technicalSkills?.length) {
      addSectionHeader(heading);
      children.push(new Paragraph({ children: [new TextRun({ text: c.technicalSkills.join('  ·  '), size: 20 })] }));
    } else if (key === 'softSkills' && c.softSkills?.length) {
      addSectionHeader(heading);
      children.push(new Paragraph({ children: [new TextRun({ text: c.softSkills.join('  ·  '), size: 20 })] }));
    } else if (key === 'coursework' && c.coursework?.length) {
      addSectionHeader(heading);
      children.push(new Paragraph({ children: [new TextRun({ text: c.coursework.join('  ·  '), size: 20 })] }));
    } else if (key === 'certifications' && c.certifications?.length) {
      addSectionHeader(heading);
      for (const cert of c.certifications) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: [cert.name, cert.issuer, cert.date].filter(Boolean).join(' — '), size: 20 })],
          })
        );
      }
    } else if ((key === 'achievements' || key === 'awards' || key === 'responsibilities') && c[key]?.length) {
      addSectionHeader(heading);
      for (const ach of c[key]) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: [ach.title, ach.context, ach.date].filter(Boolean).join(' — '), size: 20 })],
          })
        );
      }
    } else if (key === 'languages' && c.languages?.length) {
      addSectionHeader(heading);
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: c.languages.map((l) => `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`).join('  ·  '),
              size: 20,
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, safeFileName(resume.title, 'docx'));
}

export function exportResumeToTxt(resume: ResumeRecord): void {
  const c = resume.content;
  const p = c.personal;
  const lines: string[] = [];
  lines.push(p.fullName || resume.title);
  if (p.targetRole) lines.push(p.targetRole);
  lines.push([p.email, p.phone, p.location, p.linkedin, p.github].filter(Boolean).join(' | '));
  lines.push('');

  if (c.summary) {
    lines.push('PROFESSIONAL SUMMARY');
    lines.push(c.summary);
    lines.push('');
  }
  if (c.objective) {
    lines.push('CAREER OBJECTIVE');
    lines.push(c.objective);
    lines.push('');
  }
  if (c.experience.length) {
    lines.push('WORK EXPERIENCE');
    c.experience.forEach((e) => {
      lines.push(`${e.role} — ${e.company} (${e.startDate} – ${e.current ? 'Present' : e.endDate})`);
      e.bullets.forEach((b) => lines.push(`  * ${b}`));
    });
    lines.push('');
  }
  if (c.projects.length) {
    lines.push('PROJECTS');
    c.projects.forEach((pr) => {
      lines.push(`${pr.title} [${pr.technologies.join(', ')}]`);
      if (pr.description) lines.push(`  ${pr.description}`);
      pr.bullets.forEach((b) => lines.push(`  * ${b}`));
    });
    lines.push('');
  }
  if (c.education.length) {
    lines.push('EDUCATION');
    c.education.forEach((ed) => {
      lines.push(`${ed.degree} ${ed.specialization} — ${ed.institution} (${ed.endDate}) ${ed.score}`);
    });
    lines.push('');
  }
  if (c.technicalSkills.length) {
    lines.push('TECHNICAL SKILLS');
    lines.push(c.technicalSkills.join(', '));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, safeFileName(resume.title, 'txt'));
}

export function exportCoverLetterToPdf(title: string, content: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(content, 174) as string[];
  let y = 20;
  for (const line of lines) {
    if (y > 277) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 18, y);
    y += 5.5;
  }
  doc.save(safeFileName(title, 'pdf'));
}

export async function exportCoverLetterToDocx(title: string, content: string): Promise<void> {
  const paragraphs = content.split(/\n\n+/).map(
    (para) =>
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: para.trim(), size: 22 })],
      })
  );
  const doc = new Document({
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 } } }, children: paragraphs }],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, safeFileName(title, 'docx'));
}
