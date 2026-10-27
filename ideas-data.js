// Key ideas per book, for the Ideas tab in books.html. One idea per row, in the order the book presents them.
//
// - The key is a book's `key` from books-data.js (only starter books can have ideas for now).
// - type: fact | theory | model
//     fact   = an observation or established finding
//     theory = an explanation or claim that could be wrong
//     model  = a mental model: a lens judged by how useful it is, not by whether it is true
// - validated: true once the idea has been checked against an EPUB of the book; false until then.
// - Columns shown: the idea, its type, and whether it is validated.
window.IDEAS_DATA = {
  'the-wealth-of-nations': [
    { idea: 'Ten workers splitting pin-making into separate tasks made about 48,000 pins a day; alone, each might make fewer than 20.', type: 'fact', validated: false },
    { idea: 'Dividing work into specialized tasks raises output per worker, through skill, saved time and machines.', type: 'theory', validated: false },
    { idea: 'How far work can be divided is limited by the size of the market.', type: 'theory', validated: false },
    { idea: 'We get dinner from the butcher, brewer and baker through their self-interest, not their kindness.', type: 'model', validated: false },
    { idea: 'The real cost of anything is the toil and trouble of getting it, so labor is the true measure of value.', type: 'theory', validated: false },
    { idea: 'Market prices gravitate toward a natural price that covers wages, profit and rent.', type: 'theory', validated: false },
    { idea: 'Jobs that are unpleasant, risky or costly to learn pay more.', type: 'theory', validated: false },
    { idea: 'Employers quietly act together to hold wages down, while workers who combine get the blame.', type: 'fact', validated: false },
    { idea: 'Saving and investing, not spending, grows a nation\'s capital and its output.', type: 'theory', validated: false },
    { idea: 'A nation\'s wealth is its yearly output of useful goods, not its stock of gold and silver.', type: 'theory', validated: false },
    { idea: 'Limiting imports to hoard gold makes a nation poorer; trade benefits both sides.', type: 'theory', validated: false },
    { idea: 'Each person pursuing their own gain is led, as by an invisible hand, to serve the public good they never intended.', type: 'model', validated: false },
    { idea: 'Government\'s proper jobs are defense, justice, and public works the market will not build.', type: 'model', validated: false }
  ]
};
