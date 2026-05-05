import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
} from '../storage/storage-provider.interface.js';

export class GeminiException extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'GeminiException';
  }
}

export interface GeneratedCaption {
  caption: string;
  hashtags: string[];
  language: string;
  topic: string;
  newsHook?: string;
  dominantEmotion?: string;
}

export interface GeneratedImage {
  imageUrl: string;
  r2Key: string;
  prompt: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI!: GoogleGenerativeAI;
  private readonly apiKey: string;
  private readonly textModel: string;
  private readonly imageModel: string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: IStorageProvider,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.textModel = this.configService.get<string>(
      'GEMINI_TEXT_MODEL',
      'gemini-2.5-flash',
    );
    this.imageModel = this.configService.get<string>(
      'GEMINI_IMAGE_MODEL',
      'gemini-2.5-flash-image',
    );
    this.enabled =
      this.configService.get<string>('GEMINI_ENABLED', 'true') === 'true';

    if (this.enabled && !this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY must be configured when GEMINI_ENABLED=true',
      );
    }

    if (this.enabled) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  async generateCaption(params: {
    languageCode: string;
    languageLabel: string;
    topicCode: string;
    topicLabel: string;
    geminiPromptHint: string;
    distributorName: string;
    joinLink: string;
    postsPerDay: number;
  }): Promise<GeneratedCaption> {
    if (!this.enabled) {
      throw new Error('Gemini is disabled');
    }

    const prompt = this.buildCaptionPrompt(params);

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.textModel,
        // googleSearch tool — newer Gemini 2 grounding API; not in SDK v0.24 types
        tools: [{ googleSearch: {} }] as unknown as Parameters<
          typeof this.genAI.getGenerativeModel
        >[0]['tools'],
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return this.parseCaptionResponse(text, params.languageCode, params.topicCode);
    } catch (err) {
      if (err instanceof GeminiException) throw err;
      throw new GeminiException(
        `Caption generation failed: ${(err as Error).message}`,
        err,
      );
    }
  }

  async generateImage(params: {
    topicCode: string;
    topicLabel: string;
    geminiPromptHint: string;
    languageCode: string;
    distributorUuid: string;
    generatedFor: string;
    newsHook?: string;
    dominantEmotion?: string;
    caption?: string;
  }): Promise<GeneratedImage> {
    if (!this.enabled) {
      throw new Error('Gemini is disabled');
    }

    const imagePrompt = this.buildImagePrompt({
      topicCode: params.topicCode,
      topicLabel: params.topicLabel,
      geminiPromptHint: params.geminiPromptHint,
      languageCode: params.languageCode,
      newsHook: params.newsHook,
      dominantEmotion: params.dominantEmotion,
      caption: params.caption,
    });

    try {
      const imageBuffer = await this.callImagenApi(imagePrompt);

      const filename = `${params.topicCode}-${uuidv4()}.png`;
      const folder = `social-posts/${params.distributorUuid}/${params.generatedFor}`;

      const uploadResult = await this.storageProvider.uploadFile(
        imageBuffer,
        folder,
        filename,
        'image/png',
      );

      this.logger.log(
        `Generated image uploaded to R2: ${uploadResult.url}`,
      );

      return {
        imageUrl: uploadResult.url,
        r2Key: uploadResult.publicId,
        prompt: imagePrompt,
      };
    } catch (err) {
      if (err instanceof GeminiException) throw err;
      throw new GeminiException(
        `Image generation failed: ${(err as Error).message}`,
        err,
      );
    }
  }

  async callImagenApi(prompt: string): Promise<Buffer> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.imageModel}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new GeminiException(
        `Image API error ${response.status} (model: ${this.imageModel}): ${body}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const parts = (
      data as {
        candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
      }
    )?.candidates?.[0]?.content?.parts;

    const imagePart = parts?.find((p) => p['inlineData']);
    const base64Image = (
      imagePart?.['inlineData'] as Record<string, string> | undefined
    )?.['data'];

    if (!base64Image) {
      throw new GeminiException('Image generation returned no image data');
    }

    return Buffer.from(base64Image, 'base64');
  }

  private buildCaptionPrompt(params: {
    languageCode: string;
    languageLabel: string;
    topicCode: string;
    topicLabel: string;
    geminiPromptHint: string;
    distributorName: string;
    joinLink: string;
    postsPerDay: number;
  }): string {
    const today = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (params.topicCode === 'HEALTH') {
      return `You are an elite Indian social media strategist creating viral health content.

TODAY IS: ${today}

STEP 1 — Search Google right now for ONE of these:
- "drinking water contamination India ${today}"
- "water pollution health India news today"
- "tap water unsafe India 2026"
- "groundwater crisis India ${today}"
Pick the most shocking, recent, credible news story you find.

STEP 2 — Write a viral Instagram caption in ${params.languageLabel} using that news.

STRICT FORMAT:
Line 1: Shocking question or fact from today's news (make someone stop scrolling)
Line 2: The specific news detail (city/state/statistic if available)
Line 3: Connect it to reader's daily life ("Aap bhi peete hain yahi paani...")
Line 4: The consequence ("Iska matlab hai...")
Line 5: "Ek safe solution hai — alkaline ionized water"
Line 6: "Jano kaise: ${params.joinLink}"
Line 7: "👇 Comment 'PAANI' aur main personally guide karunga"

RULES:
- ${params.languageLabel} ONLY
- 100-130 words total
- NO brand names (Kangen/Enagic)
- Hook must be news-based and verifiable
- Tone: concerned friend, not salesman

After caption, new line:
HASHTAGS: (10 hashtags, no #, mix Hindi/English, trending)
NEWS_HOOK: (one line — the news fact you used)
DOMINANT_EMOTION: (fear/urgency/concern/shock — pick one)`;
    }

    return `You are an elite Indian social media strategist creating viral business content.

TODAY IS: ${today}

STEP 1 — Search Google right now for ONE of these:
- "India layoffs job cuts ${today}"
- "salary inflation India 2026 news"
- "India unemployment rate ${today}"
- "India startup funding jobs 2026"
- "Indian middle class financial crisis ${today}"
Pick the most relevant, shocking business/income news story today.

STEP 2 — Write a viral Instagram caption in ${params.languageLabel} using that news.

STRICT FORMAT:
Line 1: Shocking hook from today's business news
Line 2: The specific data point (company/number/city if available)
Line 3: Connect to reader ("Kya aap bhi isi situation mein hain?")
Line 4: The hard truth ("9-5 ki naukri ab safe nahi...")
Line 5: "Ek system hai jisme income time se independent hoti hai"
Line 6: "Dekho kaise: ${params.joinLink}"
Line 7: "👇 Comment 'FREEDOM' — main personally bataunga"

RULES:
- ${params.languageLabel} ONLY
- 100-130 words total
- NO income guarantees
- Hook must be news-based
- Tone: mentor revealing hard truth, not MLM pitch

After caption, new line:
HASHTAGS: (10 hashtags, no #, mix Hindi/English, trending)
NEWS_HOOK: (one line — the news fact you used)
DOMINANT_EMOTION: (urgency/fomo/concern/aspiration — pick one)`;
  }

  buildImagePrompt(params: {
    topicCode: string;
    topicLabel: string;
    geminiPromptHint: string;
    languageCode: string;
    newsHook?: string;
    dominantEmotion?: string;
    caption?: string;
  }): string {
    // Rotate visual themes based on current date for variety
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        86400000,
    );

    const HEALTH_THEMES = [
      {
        bg: 'pure black (#000000) background',
        accent: 'electric orange (#FF5733)',
        style: 'dark minimalist with orange typography',
        layout:
          'full dark background, large bold white text left-aligned, key words in orange',
      },
      {
        bg: 'deep navy blue (#0A1628) background',
        accent: 'gold (#C9A84C)',
        style: 'luxury dark navy with gold accents',
        layout:
          'split — dark left panel with text, cinematic photo right side',
      },
      {
        bg: 'dark charcoal (#111111) background',
        accent: 'crimson red (#E84545)',
        style: 'urgent editorial with red highlights',
        layout: 'headline-style with large stat number prominent',
      },
    ];

    const BUSINESS_THEMES = [
      {
        bg: 'obsidian black (#0D0D0D) background',
        accent: 'warm gold (#C9A84C)',
        style: 'luxury black and gold',
        layout:
          'split composition — stressed man left, successful man right, gold divider',
      },
      {
        bg: 'dark midnight (#080E1A) background',
        accent: 'sapphire blue (#4DA6FF)',
        style: 'premium dark blue with blue accents',
        layout: 'full dark with large bold Hinglish text overlay',
      },
      {
        bg: 'deep charcoal (#1A1A1A) background',
        accent: 'platinum white (#E5E5E5)',
        style: 'ultra premium minimal dark',
        layout: 'editorial style with large typography dominant',
      },
    ];

    const themes =
      params.topicCode === 'HEALTH' ? HEALTH_THEMES : BUSINESS_THEMES;
    const theme = themes[dayOfYear % themes.length];

    const newsContext = params.newsHook
      ? `Based on today's news: "${params.newsHook}"`
      : params.geminiPromptHint;

    if (params.topicCode === 'HEALTH') {
      return `Create a PREMIUM viral Indian Instagram post image. 1080x1080px square format.

DESIGN STYLE: ${theme.style}
BACKGROUND: ${theme.bg}
ACCENT COLOR: ${theme.accent}
LAYOUT: ${theme.layout}

NEWS CONTEXT FOR CONTENT: ${newsContext}

MANDATORY TEXT TO INCLUDE ON IMAGE (render exactly, no spelling errors):
━━━ TOP SECTION (large, bold, impactful) ━━━
Line 1 (white, very large): "Kya aapka PAANI"
Line 2 (${theme.accent}, very large bold): "aapko BEEMAR kar raha hai? ⚠️"

━━━ DIVIDER ━━━
Thin horizontal line in ${theme.accent}

━━━ MIDDLE SECTION ━━━
Stat (${theme.accent}, huge number): "72%"
Label (white, medium): "Indians peete hain contaminated water"
News line (grey, small): "${params.newsHook ? params.newsHook.slice(0, 80) : '500+ chemicals found in India tap water'}"

━━━ BOTTOM CTA BUTTON ━━━
Dark pill button with ${theme.accent} border:
"→ Comment 'PAANI' for FREE guide"

━━━ FOOTER ICONS ROW ━━━
"💧 PURE   🧬 HEALTHY   ⚡ ENERGY"

TYPOGRAPHY RULES:
- Font style: bold sans-serif, similar to Bebas Neue or Montserrat Black
- ALL text must be razor-sharp and readable at thumbnail size
- Key words (PAANI, BEEMAR, 72%) must be 2x larger than surrounding text
- Perfect letter spacing, no kerning issues

PHOTO ELEMENT:
Include a dark cinematic photo of a stressed Indian professional man (30s)
holding his head at a desk, moody city lights in background.
The photo should be DARKENED (70% dark overlay) so text remains readable.
Photo occupies right 40% of image OR blended into background.

QUALITY STANDARDS:
- Must look like it was designed by a professional Indian digital marketing agency
- Premium, luxury feel — NOT cheap or AI-generated looking
- Similar to viral Indian motivational content (Nageshwar Shukla style)
- High contrast, no muddy colors
- Every element perfectly aligned
- NO random objects, NO watermarks from other brands
- Zero spelling mistakes on any text`;
    }

    return `Create a PREMIUM viral Indian Instagram post image. 1080x1080px square format.

DESIGN STYLE: ${theme.style}
BACKGROUND: ${theme.bg}
ACCENT COLOR: ${theme.accent}
LAYOUT: ${theme.layout}

NEWS CONTEXT FOR CONTENT: ${newsContext}

MANDATORY TEXT TO INCLUDE ON IMAGE (render exactly, no spelling errors):
━━━ TOP SECTION (large, bold, impactful) ━━━
Line 1 (white, very large): "Salary ke liye"
Line 2 (${theme.accent}, very large bold): "LIFE BECH RAHE HO?"

━━━ DIVIDER ━━━
Thin horizontal line in ${theme.accent}

━━━ MIDDLE SECTION ━━━
Hook text (white, medium): "9-5 se bills pay hote hain..."
Key line (${theme.accent}, large bold): "Par DREAMS? ✗"
News line (grey, small): "${params.newsHook ? params.newsHook.slice(0, 80) : 'India records highest job losses in 5 years'}"

━━━ THREE ICONS ROW ━━━
"⏰ TIME   💰 MONEY   🌍 FREEDOM"
(icons in ${theme.accent}, labels in white)

━━━ BOTTOM CTA BUTTON ━━━
Dark pill button with ${theme.accent} border and arrow:
"→ DM 'FREEDOM'"
Subtitle below: "Work Less. Live More."

PHOTO ELEMENTS:
LEFT HALF: Dark cinematic scene — exhausted Indian professional man at cluttered desk late night, grey desaturated tones, city skyline visible through window behind him
RIGHT HALF: Confident successful Indian man in white shirt, standing in front of luxury villa with sports car at golden sunset hour
CENTER: Thin vertical dividing line in ${theme.accent}

TYPOGRAPHY RULES:
- Font style: bold sans-serif, similar to Bebas Neue or Montserrat Black
- ALL text must be razor-sharp and readable at thumbnail size
- Key words (LIFE BECH, FREEDOM, DREAMS) must be 2x larger than surrounding text
- Perfect letter spacing, no kerning issues

QUALITY STANDARDS:
- Must look like it was designed by a professional Indian digital marketing agency
- Premium, luxury feel — NOT cheap or AI-generated looking
- Similar to viral Indian motivational content style
- High contrast, no muddy colors
- Every element perfectly aligned on a grid
- Zero spelling mistakes on any text
- NO random objects, NO other brand watermarks`;
  }

  private parseCaptionResponse(
    text: string,
    languageCode: string,
    topicCode: string,
  ): GeneratedCaption {
    const hashtagsMarker = 'HASHTAGS:';
    const newsHookMarker = 'NEWS_HOOK:';
    const emotionMarker = 'DOMINANT_EMOTION:';

    const markerIndex = text.indexOf(hashtagsMarker);
    if (markerIndex === -1) {
      return {
        caption: text.trim(),
        hashtags: [],
        language: languageCode,
        topic: topicCode,
      };
    }

    const caption = text.slice(0, markerIndex).trim();
    const afterCaption = text.slice(markerIndex);
    const hashtagsLine = afterCaption
      .slice(hashtagsMarker.length)
      .split('\n')[0]
      .trim();
    const hashtags = hashtagsLine
      .split(',')
      .map((h) => h.trim().replace(/^#/, ''))
      .filter(Boolean);

    const newsHookIdx = text.indexOf(newsHookMarker);
    const newsHook =
      newsHookIdx !== -1
        ? text.slice(newsHookIdx + newsHookMarker.length).split('\n')[0].trim()
        : undefined;

    const emotionIdx = text.indexOf(emotionMarker);
    const dominantEmotion =
      emotionIdx !== -1
        ? text.slice(emotionIdx + emotionMarker.length).split('\n')[0].trim()
        : undefined;

    return {
      caption,
      hashtags,
      language: languageCode,
      topic: topicCode,
      newsHook,
      dominantEmotion,
    };
  }
}
