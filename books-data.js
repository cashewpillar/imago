// Starter catalog for books.html. The page only draws what is in here, so edit the books in this file.
//
// - key: a short readable name, used by `tensions` below. Keep it unique and don't rename it once used.
// - id: the permanent ID (a UUID). Never change it; it is how a book in the browser is matched to this entry.
// - tensions: keys of the books this one pulls against. List it on one side only; the page shows it on both.
// - scale: self | pair | group | society | nature        kind: lasting | current
// - ctype: fact | theory | lens        action and shift: 1 to 5        year: negative for BC
//
// Starter books are added to the browser when they are missing. A book you have edited in the page keeps your
// edits, so changing its entry here does not overwrite it. `updatedAt` is the time given to every starter row.
window.BOOKS_DATA = {
  updatedAt: 1793059200000,
  books: [
    {
      key: 'the-art-of-war', id: 'f10874a7-d679-49a4-a28f-c63ae7d27d5e',
      title: 'The Art of War', author: 'Sun Tzu',
      domain: 'Strategy', era: 'Ancient (c. 500 BC)', year: -500, kind: 'lasting',
      scale: 'group', mechanisms: ['leverage', 'adaptation'], tensions: [],
      action: 3, shift: 3, ctype: 'lens',
      claim: 'Win by position and preparation before the fight starts.'
    },
    {
      key: 'meditations', id: 'ed03cd10-4d8e-49d1-8043-5d58070a407e',
      title: 'Meditations', author: 'Marcus Aurelius',
      domain: 'Philosophy', era: 'Ancient (c. 170 AD)', year: 170, kind: 'lasting',
      scale: 'self', mechanisms: ['control', 'framing'], tensions: ['the-prince', 'the-art-of-war'],
      action: 4, shift: 4, ctype: 'lens',
      claim: 'You control your judgments, not events.'
    },
    {
      key: 'the-prince', id: '1594301f-7812-44b6-be80-3280b65780b1',
      title: 'The Prince', author: 'Niccolò Machiavelli',
      domain: 'Politics', era: 'Renaissance (1513)', year: 1513, kind: 'lasting',
      scale: 'society', mechanisms: ['leverage', 'incentive'], tensions: [],
      action: 3, shift: 3, ctype: 'theory',
      claim: 'Power is kept by judging outcomes and seeing people as they are.'
    },
    {
      key: 'the-wealth-of-nations', id: '945bbccf-6499-4172-b610-9295da532a7c',
      title: 'The Wealth of Nations', author: 'Adam Smith',
      domain: 'Economics', era: 'Enlightenment (1776)', year: 1776, kind: 'lasting',
      scale: 'society', mechanisms: ['specialization', 'incentive'], tensions: [],
      action: 2, shift: 4, ctype: 'theory',
      claim: 'Specialization and free exchange drive a nation\'s wealth.'
    },
    {
      key: 'how-to-win-friends-and-influence-people', id: '612742df-b4e5-48b3-9c26-bde49f47123c',
      title: 'How to Win Friends and Influence People', author: 'Dale Carnegie',
      domain: 'Communication', era: '1930s', year: 1936, kind: 'lasting',
      scale: 'pair', mechanisms: ['reciprocity', 'framing'], tensions: [],
      action: 5, shift: 2, ctype: 'theory',
      claim: 'Genuine interest in other people is the root of influence.'
    },
    {
      key: 'man-s-search-for-meaning', id: '3a8e92ef-be91-424a-90ca-0fd78b0697d1',
      title: 'Man\'s Search for Meaning', author: 'Viktor Frankl',
      domain: 'Psychology', era: '1940s', year: 1946, kind: 'lasting',
      scale: 'self', mechanisms: ['framing', 'control'], tensions: [],
      action: 4, shift: 5, ctype: 'lens',
      claim: 'Whoever has a why can bear almost any how.'
    },
    {
      key: 'the-structure-of-scientific-revolutions', id: 'fcff6970-4bb3-482c-b5f3-ba070dc3e3de',
      title: 'The Structure of Scientific Revolutions', author: 'Thomas Kuhn',
      domain: 'Science', era: '1960s', year: 1962, kind: 'lasting',
      scale: 'society', mechanisms: ['paradigm shift', 'bias'], tensions: [],
      action: 2, shift: 5, ctype: 'theory',
      claim: 'Science advances by paradigm shifts, not steady accumulation.'
    },
    {
      key: 'the-selfish-gene', id: '8cdecea2-e240-4550-ab2e-00555b453a63',
      title: 'The Selfish Gene', author: 'Richard Dawkins',
      domain: 'Biology', era: '1970s', year: 1976, kind: 'lasting',
      scale: 'nature', mechanisms: ['selection', 'feedback loop'], tensions: [],
      action: 2, shift: 5, ctype: 'theory',
      claim: 'Genes, not organisms, are what natural selection acts on.'
    },
    {
      key: 'influence', id: '3355ae01-32e6-4027-8704-88d350c2d6b5',
      title: 'Influence', author: 'Robert Cialdini',
      domain: 'Psychology', era: '1980s', year: 1984, kind: 'lasting',
      scale: 'pair', mechanisms: ['reciprocity', 'bias'], tensions: ['how-to-win-friends-and-influence-people'],
      action: 5, shift: 3, ctype: 'fact',
      claim: 'A few levers, like reciprocity and scarcity, drive most yes decisions.'
    },
    {
      key: 'guns-germs-and-steel', id: '8cc4589d-5a0e-4f23-8fc3-124dc6777197',
      title: 'Guns, Germs, and Steel', author: 'Jared Diamond',
      domain: 'History', era: '1990s', year: 1997, kind: 'lasting',
      scale: 'society', mechanisms: ['compounding', 'adaptation'], tensions: ['man-s-search-for-meaning'],
      action: 2, shift: 4, ctype: 'theory',
      claim: 'Geography and environment, not ability, shaped how societies fared.'
    },
    {
      key: 'getting-things-done', id: '15746e66-f011-4b5f-bc80-079d040b2dc4',
      title: 'Getting Things Done', author: 'David Allen',
      domain: 'Productivity', era: '2000s', year: 2001, kind: 'lasting',
      scale: 'self', mechanisms: ['control', 'feedback loop'], tensions: [],
      action: 5, shift: 2, ctype: 'theory',
      claim: 'Capture every open loop in a trusted system to clear your head.'
    },
    {
      key: 'the-black-swan', id: '50740541-f25a-4c5f-95fb-06d98e7a5f2c',
      title: 'The Black Swan', author: 'Nassim Taleb',
      domain: 'Risk', era: '2000s', year: 2007, kind: 'lasting',
      scale: 'society', mechanisms: ['power law', 'bias'], tensions: ['getting-things-done'],
      action: 3, shift: 5, ctype: 'lens',
      claim: 'Rare, unpredictable events drive most outcomes, so build for them.'
    },
    {
      key: 'thinking-fast-and-slow', id: '686fba77-eec8-4ab7-9cd5-0c04182459e9',
      title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman',
      domain: 'Psychology', era: '2010s', year: 2011, kind: 'lasting',
      scale: 'self', mechanisms: ['bias', 'framing'], tensions: [],
      action: 3, shift: 5, ctype: 'fact',
      claim: 'Fast intuition and slow reasoning both mislead us in predictable ways.'
    },
    {
      key: 'sapiens', id: '11ac3b17-fb93-4006-ba20-8c9b04d3fc8e',
      title: 'Sapiens', author: 'Yuval Noah Harari',
      domain: 'History', era: '2010s', year: 2011, kind: 'current',
      scale: 'society', mechanisms: ['narrative', 'adaptation'], tensions: [],
      action: 2, shift: 4, ctype: 'theory',
      claim: 'Shared fictions let humans cooperate in huge numbers.'
    },
    {
      key: 'never-split-the-difference', id: '9ef7a64c-002b-4afc-b439-cc56f2b8c34c',
      title: 'Never Split the Difference', author: 'Chris Voss',
      domain: 'Negotiation', era: '2010s', year: 2016, kind: 'current',
      scale: 'pair', mechanisms: ['reciprocity', 'framing'], tensions: [],
      action: 5, shift: 3, ctype: 'theory',
      claim: 'Tactical empathy and calibrated questions beat compromise.'
    },
    {
      key: 'deep-work', id: '49dda5e7-79d3-4957-be34-08327170f5ab',
      title: 'Deep Work', author: 'Cal Newport',
      domain: 'Productivity', era: '2010s', year: 2016, kind: 'current',
      scale: 'self', mechanisms: ['tradeoff', 'leverage'], tensions: [],
      action: 5, shift: 2, ctype: 'theory',
      claim: 'Distraction-free focus is increasingly rare and valuable.'
    },
    {
      key: 'atomic-habits', id: 'd99dc179-0da9-4ab0-b136-f51bb910f301',
      title: 'Atomic Habits', author: 'James Clear',
      domain: 'Self-improvement', era: '2010s', year: 2018, kind: 'current',
      scale: 'self', mechanisms: ['compounding', 'feedback loop'], tensions: [],
      action: 5, shift: 2, ctype: 'theory',
      claim: 'Tiny habits compound into big results.'
    },
    {
      key: 'the-psychology-of-money', id: '78c95d44-aeaa-4530-82aa-4a01dfcc2b92',
      title: 'The Psychology of Money', author: 'Morgan Housel',
      domain: 'Personal finance', era: '2020s', year: 2020, kind: 'current',
      scale: 'self', mechanisms: ['compounding', 'bias'], tensions: ['the-wealth-of-nations'],
      action: 5, shift: 3, ctype: 'lens',
      claim: 'Behavior matters more than knowledge in building wealth.'
    },
    {
      key: 'the-scout-mindset', id: 'b22826ee-1afb-486c-8d16-90cb3e921af0',
      title: 'The Scout Mindset', author: 'Julia Galef',
      domain: 'Decision-making', era: '2020s', year: 2021, kind: 'current',
      scale: 'self', mechanisms: ['bias', 'feedback loop'], tensions: [],
      action: 4, shift: 4, ctype: 'lens',
      claim: 'Aim to see things as they are, not to defend what you already believe.'
    },
    {
      key: 'outlive', id: 'ae10db0f-953e-4bc8-a0e8-99080e405811',
      title: 'Outlive', author: 'Peter Attia',
      domain: 'Health', era: '2020s', year: 2023, kind: 'current',
      scale: 'self', mechanisms: ['compounding', 'tradeoff'], tensions: [],
      action: 4, shift: 3, ctype: 'fact',
      claim: 'Prevent chronic disease early by training for a long healthspan.'
    },
  ]
};
