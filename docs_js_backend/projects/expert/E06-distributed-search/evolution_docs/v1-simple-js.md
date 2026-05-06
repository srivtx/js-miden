# v1 — The Naive Document Search (Pure JS)

You want to search documents by keyword. You build a quick in-memory index.

```js
const express = require('express');
const app = express();

const documents = [];
let idCounter = 1;

app.use(express.json());

app.post('/documents', (req, res) => {
  const doc = { id: idCounter++, ...req.body };
  documents.push(doc);
  res.status(201).json(doc);
});

app.get('/search', (req, res) => {
  const { q } = req.query;
  const query = q.toLowerCase();
  
  const results = documents.filter(doc => {
    const text = (doc.title + ' ' + doc.content).toLowerCase();
    return text.includes(query);
  });
  
  res.json({ results, count: results.length });
});

app.listen(3000, () => console.log('Search engine on 3000'));
```

Add documents. Search by substring. Done.

## Then the Pain Hits

**O(n) scans.** With 10,000 documents, every search scans all 10,000. At 100,000, searches take seconds. Users abandon the search bar.

**No ranking.** Every match has equal weight. A document with the query word in the title ranks the same as one with it buried in footnote #47. Results are noise.

**No boolean logic.** A user searches for "apple AND banana". You return documents with "pineapple banana" because "apple" is a substring. Precision is terrible.

**No phrase matching.** A user searches for "machine learning". You return "learning machine" and "machine for learning". Relevance is random.

**No scale.** All documents live on one server. You can't shard. You can't replicate. One disk failure and the index is gone.

## The Realization

Substring search is fine for 100 documents. For a real search engine, you need:
1. **Inverted index** — map terms to documents, not scan linearly
2. **Sharding** — distribute the index across machines
3. **Replication** — survive node failures
4. **Query parsing** — boolean, phrase, fuzzy matching
5. **Ranking** — TF-IDF, BM25, relevance scoring
6. **ACL filtering** — users only see documents they own

This is where the evolution starts.
