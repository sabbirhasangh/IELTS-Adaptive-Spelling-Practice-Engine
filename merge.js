const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const CSV_DIR = path.join(__dirname, 'csv-files');
const OUTPUT_FILE = path.join(__dirname, 'data', 'words.json');

async function mergeCSVFiles() {
  if (!fs.existsSync(CSV_DIR)) {
    fs.mkdirSync(CSV_DIR);
    console.log(`Created directory: ${CSV_DIR}. Place your CSV files there!`);
    return;
  }

  const files = fs.readdirSync(CSV_DIR).filter(file => file.endsWith('.csv'));
  if (files.length === 0) {
    console.log('❌ No CSV files found inside the csv-files/ folder.');
    return;
  }

  const combinedWordsMap = new Map();

  for (const file of files) {
    const filePath = path.join(CSV_DIR, file);
    await new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Extract word
          const word = row['word'] || row['Word'] || row['Correct Answer'] || '';
          const trimmedWord = word.trim();

          if (!trimmedWord) return;

          // Extract attributes based on your Google Sheet columns
          const bPron = row['bangla_pronunciation'] || row['Bangla Pronunciation (Hint)'] || '';
          const bMeaning = row['bangla_meaning'] || row['Bangla Meaning'] || row['Category'] || '';
          const memoryTrick = row['memory_trick'] || row['Memory Trick / Syllable Breakdown'] || trimmedWord;
          const mistakeCount = parseInt(row['mistake_count'] || row['Mistake Count'] || 0, 10);
          const totalTries = parseInt(row['total_tries'] || row['Total Tries'] || 0, 10);

          // Deduplicate by word name (case-insensitive)
          const lowerKey = trimmedWord.toLowerCase();
          if (!combinedWordsMap.has(lowerKey)) {
            combinedWordsMap.set(lowerKey, {
              word: trimmedWord,
              bangla_pronunciation: bPron.trim(),
              bangla_meaning: bMeaning.trim(),
              memory_trick: memoryTrick.trim(),
              mistake_count: mistakeCount,
              total_tries: totalTries
            });
          }
        })
        .on('end', resolve);
    });
  }

  // Format array with sequential IDs (1, 2, 3...)
  const finalWordsList = Array.from(combinedWordsMap.values()).map((item, index) => ({
    id: index + 1,
    ...item
  }));

  // Ensure output directory (data/) exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalWordsList, null, 2), 'utf-8');
  console.log(`✅ Success! Combined ${files.length} CSV file(s) into ${finalWordsList.length} words in data/words.json.`);
}

mergeCSVFiles();