/**
 * Simple Porter Stemmer implementation for English
 * Covers the most common suffix rules
 */

const step2List: Record<string, string> = {
  ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance', izer: 'ize',
  bli: 'ble', alli: 'al', entli: 'ent', eli: 'e', ousli: 'ous',
  ization: 'ize', ation: 'ate', ator: 'ate', alism: 'al', iveness: 'ive',
  fulness: 'ful', ousness: 'ous', aliti: 'al', iviti: 'ive', biliti: 'ble',
};

const step3List: Record<string, string> = {
  icate: 'ic', ative: '', alize: 'al', iciti: 'ic', ical: 'ic',
  ful: '', ness: '',
};

const c = '[^aeiou]';
const v = '[aeiouy]';
const C = c + '[^aeiouy]*';
const V = v + '[aeiou]*';

const mgr0 = '^(' + C + ')?' + V + C;
const meq1 = '^(' + C + ')?' + V + C + '(' + V + ')?$';
const mgr1 = '^(' + C + ')?' + V + C + V + C;
const sV = '^(' + C + ')?' + v;

function stemWord(w: string): string {
  let stem = w.toLowerCase();
  if (stem.length < 3) return stem;

  let firstCh = stem[0];
  if (firstCh === 'y') {
    stem = firstCh.toUpperCase() + stem.slice(1);
  }

  // Step 1a
  const re = /^(.+?)(ss|i)es$/;
  const re2 = /^(.+?)([^s])s$/;
  if (re.test(stem)) {
    stem = stem.replace(re, '$1$2');
  } else if (re2.test(stem)) {
    stem = stem.replace(re2, '$1$2');
  }

  // Step 1b
  const re3 = /^(.+?)eed$/;
  const re4 = /^(.+?)(ed|ing)$/;
  if (re3.test(stem)) {
    const fp = re3.exec(stem);
    if (fp && new RegExp(mgr0).test(fp[1])) {
      stem = stem.replace(re3, '$1ee');
    }
  } else if (re4.test(stem)) {
    const fp = re4.exec(stem);
    if (fp && new RegExp(sV).test(fp[1])) {
      stem = fp[1];
      const re5 = /(at|bl|iz)$/;
      const re6 = new RegExp('([^aeiouylsz])\\1$');
      const re7 = new RegExp('^' + C + v + '[^aeiouwxy]$');
      if (re5.test(stem)) {
        stem += 'e';
      } else if (re6.test(stem)) {
        stem = stem.slice(0, -1);
      } else if (re7.test(stem)) {
        stem += 'e';
      }
    }
  }

  // Step 1c
  const re8 = /^(.+?)y$/;
  if (re8.test(stem) && new RegExp(sV).test(stem.slice(0, -1))) {
    stem = stem.slice(0, -1) + 'i';
  }

  // Step 2
  const re9 = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti)$/;
  const fp2 = re9.exec(stem);
  if (fp2 && new RegExp(mgr0).test(fp2[1])) {
    stem = fp2[1] + step2List[fp2[2]];
  }

  // Step 3
  const re10 = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
  const fp3 = re10.exec(stem);
  if (fp3 && new RegExp(mgr0).test(fp3[1])) {
    stem = fp3[1] + step3List[fp3[2]];
  }

  // Step 4
  const re11 = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
  const fp4 = re11.exec(stem);
  if (fp4 && new RegExp(mgr1).test(fp4[1])) {
    stem = fp4[1];
  }

  // Step 5a
  const re12 = /^(.+?)e$/;
  const fp5 = re12.exec(stem);
  if (fp5) {
    const w2 = fp5[1];
    if (new RegExp(mgr1).test(w2) || (new RegExp(meq1).test(w2) && !new RegExp('^' + C + v + '[^aeiouwxy]$').test(w2))) {
      stem = w2;
    }
  }

  // Step 5b
  if (new RegExp('ll$').test(stem) && new RegExp(mgr1).test(stem)) {
    stem = stem.slice(0, -1);
  }

  if (firstCh === 'y') {
    stem = firstCh.toLowerCase() + stem.slice(1);
  }

  return stem;
}

export function stem(token: string): string {
  return stemWord(token);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function tokenizeWithPositions(text: string): Array<{ token: string; position: number }> {
  const tokens: Array<{ token: string; position: number }> = [];
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  let position = 0;
  for (const word of words) {
    if (word.length > 1) {
      tokens.push({ token: stem(word), position });
    }
    position++;
  }
  return tokens;
}
