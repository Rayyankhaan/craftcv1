import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { AuthenticatedRequest, requireAuth } from '../services/auth.ts';
import { aiProvider, ANTI_FABRICATION_SYSTEM_RULE, Type } from '../services/ai.ts';

export const uploadRouter = Router();

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const ext = file.originalname.toLowerCase();
    if (allowedMimes.includes(file.mimetype) || ext.endsWith('.pdf') || ext.endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files under 5MB are supported.'));
    }
  },
});

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => (typeof item === 'object' && item !== null && 'str' in item ? String((item as { str: string }).str) : ''))
      .join(' ');
    parts.push(pageText);
  }
  return parts.join('\n').trim();
}

function deterministicFallbackParse(rawText: string) {
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/(\+?\d[\d\s\-()]{7,16}\d)/);
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    personal: {
      fullName: lines[0]?.slice(0, 60) || '',
      targetRole: '',
      email: emailMatch ? emailMatch[0] : '',
      phone: phoneMatch ? phoneMatch[0].trim() : '',
      location: '',
      linkedin: rawText.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/)?.[0] || '',
      github: rawText.match(/github\.com\/[a-zA-Z0-9_-]+/)?.[0] || '',
      portfolio: '',
    },
    summary: '',
    experience: [],
    education: [],
    technicalSkills: [],
    projects: [],
    certifications: [],
    achievements: [],
    languages: [],
    rawExtractedText: rawText,
  };
}

uploadRouter.post('/parse-resume', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Please select a PDF or DOCX resume file.' });
    return;
  }

  try {
    const isPdf =
      req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
    let rawText = '';

    if (isPdf) {
      rawText = await extractPdfText(req.file.buffer);
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      rawText = (result.value || '').trim();
    }

    if (!rawText || rawText.length < 30) {
      res.status(422).json({
        error: 'Could not extract readable text from this file. Scanned image-only PDFs are not supported—please upload a text-based PDF or DOCX.',
      });
      return;
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      res.json({
        extracted: deterministicFallbackParse(rawText),
        rawText,
        aiParsed: false,
        notice: 'Basic contact extraction completed. Configure GEMINI_API_KEY for full structured section extraction.',
      });
      return;
    }

    const structured = await aiProvider.generateJson<Record<string, unknown>>({
      systemInstruction: `${ANTI_FABRICATION_SYSTEM_RULE}
You are an accurate resume parser. Extract ONLY information explicitly present in the provided resume text. Leave fields empty strings or empty arrays if not present. NEVER invent or infer unstated facts.`,
      prompt: `Extract structured resume fields from this uploaded resume text:\n\n${rawText.slice(0, 14000)}`,
      schema: {
        type: Type.OBJECT,
        properties: {
          personal: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              targetRole: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              location: { type: Type.STRING },
              linkedin: { type: Type.STRING },
              github: { type: Type.STRING },
              portfolio: { type: Type.STRING },
            },
          },
          summary: { type: Type.STRING },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                role: { type: Type.STRING },
                location: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                institution: { type: Type.STRING },
                degree: { type: Type.STRING },
                specialization: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                score: { type: Type.STRING },
              },
            },
          },
          technicalSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING },
                bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          certifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                issuer: { type: Type.STRING },
                date: { type: Type.STRING },
              },
            },
          },
          achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
          languages: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    });

    res.json({
      extracted: structured,
      rawText,
      aiParsed: true,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to parse resume file.',
    });
  }
});
