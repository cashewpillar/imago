// Books for books-v2.html (experimental). The page only draws what is in here.
//
// - key: short readable name, used in the page address (#key). Keep it unique.
// - year: shown as given, so a string like "c. 170 AD" is fine.
// - claim: the book's one key claim. Shown in the table and as the top line of the outline.
// - outline: markdown, skimmable. A nested list, two spaces per level.
//     - chapter title
//       - that chapter's one key claim
//   Only `-` bullets, **bold** and *italic* are understood.
window.BOOKS_V2 = [
  {
    key: 'amusing-ourselves-to-death',
    title: 'Amusing Ourselves to Death',
    author: 'Neil Postman',
    year: 1985,
    claim: 'Television turns all public discourse into entertainment, so we are being ruined by what we love: Huxley, not Orwell, was right.',
    outline: `
- **Television turns public discourse into entertainment, and a culture that loves its distractions loses the ability to think.**
  - **1. The Medium Is the Metaphor**
    - Each medium shapes what a culture can think and say, and ours has made entertainment the metaphor for everything.
  - **2. Media as Epistemology**
    - What counts as truth depends on the medium it travels in, so television quietly redefines truth as what entertains.
  - **3. Typographic America**
    - Early America was a print culture: its politics, religion and commerce all ran on the written word.
  - **4. The Typographic Mind**
    - Print rewarded sequential, rational argument, so public talk could be long, serious and coherent.
  - **5. The Peek-a-Boo World**
    - The telegraph and the photograph cut information loose from context, making news irrelevant, impotent and incoherent.
  - **6. The Age of Show Business**
    - Television cannot carry serious ideas, because it presents everything as entertainment.
  - **7. "Now ... This"**
    - TV news is a stream of unconnected fragments, built to be watched and forgotten, not understood.
  - **8. Shuffle Off to Bethlehem**
    - Religion on television becomes show business, and the real danger is television shows becoming the content of religion.
  - **9. Reach Out and Elect Someone**
    - Politics on television is image-making, so voters judge style instead of ideas.
  - **10. Teaching as an Amusing Activity**
    - Television teaches that learning should be fun, which undermines the school as a place of effort and language.
  - **11. The Huxleyan Warning**
    - The defence is to teach people how media shape thought, so they can see the culture they are in.
`
  },
  {
    key: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    year: 'c. 170 AD',
    claim: 'You control your judgments, not events, so do your duty as a social, rational being and accept what nature brings, death included.',
    // The twelve books are loose notes to himself, not argued chapters, so each claim below is that book's dominant theme.
    outline: `
- **Events can't harm a mind that judges well: do your duty to others, accept what nature brings, and keep death in view.**
  - **Book I**
    - Your character is borrowed from the people who shaped you, so name what you owe each of them.
  - **Book II**
    - Expect difficult people each morning, since they err from ignorance and are kin made to cooperate, and life is too brief to waste on anger.
  - **Book III**
    - Time is short and the mind may fail before the body, so act now and keep the divinity within you untroubled.
  - **Book IV**
    - You can retreat into your own mind at any time, and it turns whatever opposes it into fuel.
  - **Book V**
    - Rise to the work of a human being and ignore blame, since only your own wrongdoing can harm you.
  - **Book VI**
    - Your opinion disturbs you, not the thing itself, and whether the universe is order or chance your duty is the same.
  - **Book VII**
    - Nothing is new and externals can't touch your mind, so keep your principles alive and do good without wanting a return.
  - **Book VIII**
    - Drop the wish for reputation and do what your nature requires, teaching others or bearing with them.
  - **Book IX**
    - Injustice and lying go against nature, and doing good is its own reward, as seeing is for the eye.
  - **Book X**
    - Bear what you are formed to bear, and meet death as a natural, kindly separation.
  - **Book XI**
    - The rational soul governs itself: break things into parts to see what they are worth, and stay ready to leave.
  - **Book XII**
    - Everything you seek is available now through your own ruling mind, and leaving life is like stepping off a stage you did not build.
`
  }
];
