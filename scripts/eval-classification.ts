/**
 * @file scripts/eval-classification.ts
 * @description A standalone script to evaluate the accuracy of the `classifyQuestion` function.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { classifyQuestion } from '../src/classify.js';
import type { Category } from '../src/types';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const TEST_DATA = {
  'Biblical Studies': [
    "Can you explain the meaning of the parable of the prodigal son?",
    "What does Paul mean in Romans 8 about being more than conquerors?",
    "How should we interpret the book of Revelation in a modern context?",
    "What is the significance of the Ten Commandments for Christians today?",
  ],
  'Health and Healing': [
    "How can we pray for someone battling cancer?",
    "What does the Bible say about physical healing and faith?",
    "How do we support a family member struggling with chronic illness spiritually?",
    "Is it okay to seek medical treatment while also praying for healing?",
  ],
  'Marriage & Spirituality': [
    "How can couples grow spiritually together in marriage?",
    "What does the Bible teach about resolving conflict between husband and wife?",
    "How do we keep Christ at the center of our marriage after having kids?",
    "What role does forgiveness play in a healthy Christian marriage?",
  ],
  'Parenting & Faith': [
    "How should Christian parents disciple their teenage children at home?",
    "What's the best way to teach young children to pray?",
    "How do we raise kids with strong faith in a secular school environment?",
    "At what age should we start reading the Bible with our children?",
  ],
  'Youth & Purpose': [
    "How can young adults discover God's calling for their career?",
    "What advice do you have for teenagers struggling with identity in Christ?",
    "How should young people handle peer pressure while staying faithful?",
    "What does it mean for a young person to find their purpose in Christ?",
  ],
  'Open Discussion': [
    "What time does the conference end today?",
    "What's your favorite worship song?",
    "How do I get a copy of today's sermon notes?",
    "How can I get more involved in volunteering at church?",
  ],
};

const AMBIGUOUS_TEST_DATA = [
    {
        question: "How do I disciple my teenage son who just gave his life to Christ?",
        expected: ["Parenting & Faith", "Biblical Studies"]
    },
    {
        question: "My spouse and I disagree on how to discipline our kids, any biblical advice?",
        expected: ["Marriage & Spirituality", "Parenting & Faith"]
    }
]

async function runEval() {
  console.log('Fetching categories from Supabase...');
  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, description');

  if (error) {
    console.error('Error fetching categories:', error);
    process.exit(1);
  }
  console.log(`Found ${categories.length} categories.`);

  let correct = 0;
  let total = 0;
  const mismatches = [];
  const perCategory: Record<string, { correct: number; total: number }> = {};

  for (const [categoryName, questions] of Object.entries(TEST_DATA)) {
    perCategory[categoryName] = { correct: 0, total: 0 };
    for (const question of questions) {
      total++;
      perCategory[categoryName].total++;
      const actualCategoryId = await classifyQuestion(question, categories as Category[]);
      const actualCategoryName = categories.find(c => c.id === actualCategoryId)?.name || 'None';
      
      if (actualCategoryName === categoryName) {
        correct++;
        perCategory[categoryName].correct++;
      } else {
        mismatches.push({
          question,
          expected: categoryName,
          actual: actualCategoryName,
        });
      }
    }
  }

  let ambiguousCorrect = 0;
  let ambiguousTotal = 0;
  const ambiguousMismatches = [];

    for (const {question, expected} of AMBIGUOUS_TEST_DATA) {
        ambiguousTotal++;
        const actualCategoryId = await classifyQuestion(question, categories as Category[]);
        const actualCategoryName = categories.find(c => c.id === actualCategoryId)?.name || 'None';

        if(expected.includes(actualCategoryName)){
            ambiguousCorrect++;
        }
        else{
            ambiguousMismatches.push({
                question,
                expected: expected.join(' or '),
                actual: actualCategoryName
            })
        }
    }

  const accuracy = total > 0 ? (correct / total) * 100 : 0;
  const ambiguousAccuracy = ambiguousTotal > 0 ? (ambiguousCorrect / ambiguousTotal) * 100 : 0;

  console.log('\n--- Classification Accuracy Report ---');
  console.log(`\nOverall Strict Accuracy: ${accuracy.toFixed(2)}% (${correct}/${total})`);
  console.log(`Ambiguous Accuracy: ${ambiguousAccuracy.toFixed(2)}% (${ambiguousCorrect}/${ambiguousTotal})`);

  console.log('\nPer-Category Accuracy:');
  for (const [categoryName, stats] of Object.entries(perCategory)) {
    const catAccuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    console.log(`- ${categoryName}: ${catAccuracy.toFixed(2)}% (${stats.correct}/${stats.total})`);
  }

  if (mismatches.length > 0) {
    console.log('\n--- Mismatches (Strict) ---');
    console.table(mismatches);
  }

  if(ambiguousMismatches.length > 0){
      console.log('\n--- Mismatches (Ambiguous) ---');
      console.table(ambiguousMismatches)
  }

  const results = {
    strictAccuracy: accuracy,
    ambiguousAccuracy: ambiguousAccuracy,
    perCategory,
    mismatches,
    ambiguousMismatches
  };

  fs.writeFileSync('scripts/classification-eval-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to scripts/classification-eval-results.json');
}

runEval();
