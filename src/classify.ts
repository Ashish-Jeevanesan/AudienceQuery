/**
 * @file src/classify.ts
 * @description Provides a function to classify a question into a category using the Gemini API.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { logger } from './logger.js';
import type { Category } from './types';

/**
 * Given a question and a list of available categories, uses Gemini to return
 * the most appropriate category ID.
 * @param questionText The text of the question to classify.
 * @param categories The list of possible categories.
 * @returns The ID of the best-matching category, or null if none match well.
 */
export async function classifyQuestion(questionText: string, categories: Category[]): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('Gemini API key not found, skipping classification.');
    return null;
  }
  if (categories.length === 0) {
    logger.warn('No categories available for classification.');
    return null;
  }

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  const categoryIds = categories.map(c => c.id);
  const categoryDescriptions = categories.map(c => `- ${c.id}: ${c.name}`).join('\n');

  const prompt = `
    Based on the following question, classify it into one of the provided categories by returning its ID.
    If no category is a good fit, use "null".

    Question: "${questionText}"

    Available Categories:
    ${categoryDescriptions}
  `;

  try {
    const result = await genAI.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categoryId: { type: Type.STRING, enum: [...categoryIds, 'null'] },
            },
            required: ['categoryId'],
          },
          temperature: 0.1,
          abortSignal: AbortSignal.timeout(3000),
        },
      });


    const jsonText = result.text;
    if (!jsonText) {
        logger.warn('Gemini returned no text, skipping classification.');
        return null;
    }
    const parsed = JSON.parse(jsonText);

    const chosenId = parsed.categoryId && parsed.categoryId !== 'null' ? parsed.categoryId : null;

    if (chosenId && !categoryIds.includes(chosenId)) {
      logger.warn('Gemini returned a categoryId that does not exist', {
        returnedId: chosenId,
        question: questionText,
      });
      return null;
    }
    
    return chosenId;

  } catch (error: any) {
    logger.error('Error classifying question with Gemini', {
      error: (error as any).message,
      isTimeout: (error as any).name === 'AbortError',
    });
    // Fail-open: if classification fails, don't block the submission.
    return null;
  }
}
