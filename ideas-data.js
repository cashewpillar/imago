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
  'the-art-of-war': [
    { idea: 'The supreme art of war is to subdue the enemy without fighting.', type: 'model', validated: false },
    { idea: 'Know the enemy and know yourself, and you need not fear the result of a hundred battles.', type: 'model', validated: false },
    { idea: 'The five factors that decide a war are the moral law, heaven, earth, the commander, and method and discipline.', type: 'model', validated: false },
    { idea: 'All warfare is based on deception: appear weak when strong, and far when near.', type: 'model', validated: false },
    { idea: 'The victorious army wins first and then seeks battle; the defeated fights first and then looks for victory.', type: 'theory', validated: false },
    { idea: 'A long war drains a state; no country has benefited from prolonged warfare.', type: 'theory', validated: false },
    { idea: 'Avoid the enemy\'s strength and strike where he is weak, as water flows downhill.', type: 'model', validated: false },
    { idea: 'Have no fixed tactics: adapt to the enemy as water adapts to the ground.', type: 'model', validated: false },
    { idea: 'Foreknowledge comes from people who know the enemy\'s situation, not from spirits or omens, so use spies.', type: 'theory', validated: false },
    { idea: 'Troops who are treated like one\'s own children will follow a commander into the deepest valley.', type: 'theory', validated: false }
  ],
  'meditations': [
    { idea: 'You have power over your own mind, not over outside events; realize this and you will find strength.', type: 'model', validated: false },
    { idea: 'What disturbs us is not the thing itself but our judgment about it.', type: 'theory', validated: false },
    { idea: 'The obstacle in the path becomes the path: what stands in the way of action advances it.', type: 'model', validated: false },
    { idea: 'Everything is fleeting, fame and possessions included, so keep the long view of time and the whole world.', type: 'model', validated: false },
    { idea: 'People are made to cooperate, like hands, feet and eyelids, so act for the common good.', type: 'theory', validated: false },
    { idea: 'Begin each day expecting difficult people and meet them without anger.', type: 'model', validated: false },
    { idea: 'Do what is in front of you now, as if it were your last act, and stop putting off being good.', type: 'model', validated: false },
    { idea: 'Live in accordance with nature and reason; everything is connected in one living whole.', type: 'theory', validated: false },
    { idea: 'Death is as natural as birth, so fearing it rests on a false judgment.', type: 'theory', validated: false }
  ],
  'the-prince': [
    { idea: 'It is safer for a prince to be feared than loved, if he cannot be both.', type: 'theory', validated: false },
    { idea: 'A ruler must sometimes act against conventional virtue when the state\'s survival demands it, and is judged by results.', type: 'model', validated: false },
    { idea: 'Fortune rules about half of what happens; skill and boldness (virtu) shape the rest, like building dikes before a flood.', type: 'model', validated: false },
    { idea: 'Mercenary and borrowed troops are useless and dangerous; a prince must have his own arms.', type: 'theory', validated: false },
    { idea: 'Newly won states are hardest to hold; inherited ones are easiest.', type: 'theory', validated: false },
    { idea: 'Do all the harm at once so it is tasted less; give benefits little by little so they are savored.', type: 'theory', validated: false },
    { idea: 'The people\'s goodwill is a prince\'s best fortress; avoid being hated or despised.', type: 'theory', validated: false },
    { idea: 'Be both lion and fox: strength to frighten wolves, cunning to spot traps.', type: 'model', validated: false },
    { idea: 'Everyone sees what you appear to be; few touch what you are, so appearances carry the weight of results.', type: 'theory', validated: false },
    { idea: 'Choose wise advisers and let them speak frankly, but only when asked.', type: 'model', validated: false }
  ],
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
  ],
  'how-to-win-friends-and-influence-people': [
    { idea: 'Don\'t criticize, condemn or complain: people defend themselves and resent being blamed.', type: 'theory', validated: false },
    { idea: 'Give honest, sincere appreciation.', type: 'model', validated: false },
    { idea: 'Talk in terms of what the other person wants, and show how to get it.', type: 'model', validated: false },
    { idea: 'Become genuinely interested in other people.', type: 'model', validated: false },
    { idea: 'Smile, and remember a person\'s name: it is the sweetest sound to them.', type: 'model', validated: false },
    { idea: 'Be a good listener and encourage others to talk about themselves.', type: 'model', validated: false },
    { idea: 'The only way to get the best of an argument is to avoid it; a person convinced against their will keeps their opinion.', type: 'theory', validated: false },
    { idea: 'Show respect for other opinions and never say \'you\'re wrong\'.', type: 'model', validated: false },
    { idea: 'Begin with praise and call attention to mistakes indirectly.', type: 'model', validated: false },
    { idea: 'Let the other person feel the idea is theirs.', type: 'model', validated: false }
  ],
  'man-s-search-for-meaning': [
    { idea: 'Prisoners in the camps reacted differently to the same conditions: some kept their dignity, others collapsed.', type: 'fact', validated: false },
    { idea: 'Camp prisoners passed through phases: shock on arrival, apathy, and disillusionment after liberation.', type: 'fact', validated: false },
    { idea: 'Those with a purpose to live for tended to endure the camp better.', type: 'theory', validated: false },
    { idea: 'The main human drive is the will to meaning, not pleasure or power.', type: 'theory', validated: false },
    { idea: 'Everything can be taken from a person but the last freedom: to choose one\'s attitude in any circumstances.', type: 'model', validated: false },
    { idea: 'Meaning can be found through work, through love, and through the stance taken toward unavoidable suffering.', type: 'model', validated: false },
    { idea: 'Suffering ceases to be suffering at the moment it finds a meaning.', type: 'theory', validated: false },
    { idea: 'Boredom and emptiness (the existential vacuum) spread when people have no sense of meaning.', type: 'theory', validated: false },
    { idea: 'Paradoxical intention: wishing for what you fear can defuse the anxiety of expecting it.', type: 'theory', validated: false },
    { idea: 'Tragic optimism: affirm life in spite of pain, guilt and death.', type: 'model', validated: false }
  ],
  'the-structure-of-scientific-revolutions': [
    { idea: 'Normal science is puzzle-solving within a shared paradigm that the community takes for granted.', type: 'theory', validated: false },
    { idea: 'Anomalies pile up until a crisis, and a new paradigm replaces the old one in a revolution.', type: 'theory', validated: false },
    { idea: 'Successive paradigms are often incommensurable: they differ in terms, problems and standards of evidence.', type: 'theory', validated: false },
    { idea: 'What scientists observe is shaped by their paradigm, so after a shift they see the world differently.', type: 'theory', validated: false },
    { idea: 'Choosing between paradigms is not settled by logic and experiment alone; persuasion and the community decide.', type: 'theory', validated: false },
    { idea: 'Textbooks hide revolutions and present science as a steady, linear accumulation.', type: 'theory', validated: false },
    { idea: 'Science advances by its power to solve puzzles, not by moving toward a final truth.', type: 'theory', validated: false },
    { idea: 'A paradigm is a set of shared examples, methods and commitments that defines a scientific community.', type: 'model', validated: false }
  ],
  'the-selfish-gene': [
    { idea: 'Evolution is best seen from the gene\'s point of view: bodies are survival machines built by genes.', type: 'model', validated: false },
    { idea: 'Replicators that copy accurately but occasionally err will evolve by natural selection.', type: 'theory', validated: false },
    { idea: 'Genes are selfish in effect, yet this does not make individuals selfish: cooperation can evolve.', type: 'theory', validated: false },
    { idea: 'Kin selection: genes can spread by helping relatives, in proportion to how closely they are related.', type: 'theory', validated: false },
    { idea: 'An evolutionarily stable strategy is one that cannot be beaten by any rival once most of the population uses it.', type: 'model', validated: false },
    { idea: 'Reciprocal altruism: cooperation can evolve among unrelated individuals who meet repeatedly, as in tit-for-tat.', type: 'theory', validated: false },
    { idea: 'Parents and children share half their genes, so their interests partly conflict.', type: 'theory', validated: false },
    { idea: 'Memes: ideas replicate, mutate and compete in culture like genes do.', type: 'model', validated: false },
    { idea: 'Humans alone can rebel against the selfish replicators.', type: 'model', validated: false }
  ],
  'influence': [
    { idea: 'People given a free can of soda were more likely to buy raffle tickets from the giver (Regan\'s study).', type: 'fact', validated: false },
    { idea: 'In Milgram\'s experiments, most participants gave what they thought were severe shocks when an experimenter told them to.', type: 'fact', validated: false },
    { idea: 'Reciprocity: we feel obliged to repay what we are given, even a favor we did not ask for.', type: 'theory', validated: false },
    { idea: 'Commitment and consistency: once we take a stand, especially in writing, we act to stay consistent with it.', type: 'theory', validated: false },
    { idea: 'Social proof: we decide what is right by seeing what others, especially similar others, do.', type: 'theory', validated: false },
    { idea: 'Liking: we say yes to people we like, and we like those who are similar, praise us and cooperate with us.', type: 'theory', validated: false },
    { idea: 'Authority: we defer to experts and the symbols of authority, often without thinking.', type: 'theory', validated: false },
    { idea: 'Scarcity: things seem more valuable when they are less available.', type: 'theory', validated: false },
    { idea: 'Contrast: after a big first request, a smaller second request seems more reasonable.', type: 'theory', validated: false },
    { idea: 'We run on automatic mental shortcuts, so a single trigger feature can set off a response that others exploit.', type: 'model', validated: false }
  ],
  'guns-germs-and-steel': [
    { idea: 'Differences in the fortunes of societies come from environment and geography, not from biological differences between peoples.', type: 'theory', validated: false },
    { idea: 'Of the 14 major large domesticated mammals, 13 came from Eurasia.', type: 'fact', validated: false },
    { idea: 'Food production creates surpluses that support dense populations, specialists, writing, armies and states.', type: 'theory', validated: false },
    { idea: 'Eurasia\'s east-west axis let crops and technology spread across similar climates; the Americas and Africa run north-south.', type: 'theory', validated: false },
    { idea: 'Epidemic diseases from livestock gave Europeans immunity and killed vast numbers of Native Americans.', type: 'fact', validated: false },
    { idea: 'In 1532 Pizarro captured the Inca emperor Atahualpa with a force of about 168 Spaniards.', type: 'fact', validated: false },
    { idea: 'Bigger, better-connected landmasses had more societies to invent, compete and copy from one another.', type: 'theory', validated: false },
    { idea: 'The immediate causes of conquest were guns, germs and steel; the deeper causes were geography and resources.', type: 'model', validated: false }
  ],
  'getting-things-done': [
    { idea: 'Your mind is for having ideas, not holding them: capture everything in a trusted system outside your head.', type: 'model', validated: false },
    { idea: 'Unfinished commitments sitting in your head (open loops) drain attention and cause stress.', type: 'theory', validated: false },
    { idea: 'Stress comes mostly from unclear commitments, not from having too much to do.', type: 'theory', validated: false },
    { idea: 'Decide the very next physical action for every project.', type: 'model', validated: false },
    { idea: 'If a task takes under two minutes, do it now.', type: 'model', validated: false },
    { idea: 'The workflow has five steps: capture, clarify, organize, reflect and engage.', type: 'model', validated: false },
    { idea: 'Organize actions by context (at home, at the computer, on the phone) so you can act when you are there.', type: 'model', validated: false },
    { idea: 'A weekly review keeps the system current and trustworthy.', type: 'model', validated: false },
    { idea: 'Aim for a mind like water: respond to things in proportion, with a clear head.', type: 'model', validated: false }
  ],
  'the-black-swan': [
    { idea: 'A few rare, high-impact, unpredictable events explain most of history, markets and science.', type: 'theory', validated: false },
    { idea: 'After such events we invent explanations that make them look predictable (the narrative fallacy).', type: 'theory', validated: false },
    { idea: 'Mediocristan is bounded (height); Extremistan is dominated by extremes (wealth, book sales).', type: 'model', validated: false },
    { idea: 'A turkey fed daily for 1,000 days has no warning of Thanksgiving: past calm says little about what comes.', type: 'model', validated: false },
    { idea: 'No number of white swans proves that all swans are white; one black swan disproves it.', type: 'model', validated: false },
    { idea: 'Experts\' forecasts in economics and politics are barely better than chance.', type: 'fact', validated: false },
    { idea: 'The ludic fallacy: casino-style probability models mislead in real-life uncertainty.', type: 'model', validated: false },
    { idea: 'We see the survivors and ignore the silent evidence of those who failed.', type: 'theory', validated: false },
    { idea: 'Be robust to negative black swans and keep exposure to positive ones, for example with a barbell strategy.', type: 'model', validated: false }
  ],
  'thinking-fast-and-slow': [
    { idea: 'The mind has a fast, automatic mode (System 1) and a slow, effortful one (System 2).', type: 'model', validated: false },
    { idea: 'Anchoring: an arbitrary number shifts later estimates toward it.', type: 'fact', validated: false },
    { idea: 'Availability: we judge how common something is by how easily examples come to mind.', type: 'fact', validated: false },
    { idea: 'Loss aversion: a loss hurts about twice as much as an equal gain pleases.', type: 'fact', validated: false },
    { idea: 'Framing: the same choice described differently, such as 90% survival or 10% mortality, changes decisions.', type: 'fact', validated: false },
    { idea: 'Planning fallacy: we underestimate the time and cost of our own projects.', type: 'fact', validated: false },
    { idea: 'Prospect theory: we judge gains and losses against a reference point, not final wealth.', type: 'theory', validated: false },
    { idea: 'What you see is all there is: we build a coherent story from the little we know and ignore what is missing.', type: 'theory', validated: false },
    { idea: 'We remember an experience by its peak and its end, not its length.', type: 'fact', validated: false },
    { idea: 'The experiencing self and the remembering self want different things, and the remembering self makes the choices.', type: 'model', validated: false }
  ],
  'sapiens': [
    { idea: 'Several human species, including Neanderthals, lived at the same time as Homo sapiens.', type: 'fact', validated: false },
    { idea: 'Large animals disappeared in Australia and the Americas soon after humans arrived.', type: 'fact', validated: false },
    { idea: 'The Cognitive Revolution gave sapiens language able to talk about things that do not exist.', type: 'theory', validated: false },
    { idea: 'Shared fictions such as money, nations, corporations and human rights let strangers cooperate in huge numbers.', type: 'model', validated: false },
    { idea: 'The Agricultural Revolution was history\'s biggest fraud: more food, but harder lives for most individuals.', type: 'theory', validated: false },
    { idea: 'Money is the most universal and efficient system of mutual trust ever devised.', type: 'theory', validated: false },
    { idea: 'Empires, money and religions are the three forces that unified humankind.', type: 'theory', validated: false },
    { idea: 'The Scientific Revolution began with admitting ignorance, and was fueled by empire and capital.', type: 'theory', validated: false },
    { idea: 'Progress has not necessarily made people happier, since happiness depends on expectations and biology.', type: 'theory', validated: false }
  ],
  'never-split-the-difference': [
    { idea: 'People decide emotionally and justify with logic, so negotiation starts with emotion.', type: 'theory', validated: false },
    { idea: 'Tactical empathy: understand and say out loud the other side\'s feelings and perspective.', type: 'model', validated: false },
    { idea: 'Mirroring: repeat the last one to three words they said to get them to say more.', type: 'model', validated: false },
    { idea: 'Labeling: name the emotion you hear (\'it seems like you\'re worried\') to defuse it.', type: 'model', validated: false },
    { idea: 'Calibrated questions: ask \'how\' and \'what\' questions so the other side solves your problem.', type: 'model', validated: false },
    { idea: 'Aim for \'that\'s right\', not \'you\'re right\': a summary that makes them feel understood.', type: 'model', validated: false },
    { idea: '\'No\' is the start of a negotiation: it gives people safety and control, while a quick \'yes\' can be hollow.', type: 'model', validated: false },
    { idea: 'The Ackerman model: offer in steps of 65, 85 and 95 percent of your target, ending on an odd number.', type: 'model', validated: false },
    { idea: 'Deadlines are mostly flexible, and time pressure is largely an illusion.', type: 'theory', validated: false },
    { idea: 'Uncover the unknown unknowns, hidden facts that can change the whole deal.', type: 'model', validated: false }
  ],
  'deep-work': [
    { idea: 'Deep work, focused effort on hard tasks free of distraction, creates value and is hard to replicate.', type: 'theory', validated: false },
    { idea: 'Switching tasks leaves attention residue that hurts performance on the next task.', type: 'fact', validated: false },
    { idea: 'Deliberate practice, which builds skill, requires intense and undistracted focus.', type: 'theory', validated: false },
    { idea: 'Busyness has become a proxy for productivity, which makes shallow work look valuable.', type: 'theory', validated: false },
    { idea: 'Pick a deep work rhythm: monastic, bimodal, rhythmic or journalistic.', type: 'model', validated: false },
    { idea: 'Ritualize it: a set place, time and rules for each deep session.', type: 'model', validated: false },
    { idea: 'Embrace boredom: train focus by resisting constant stimulation.', type: 'model', validated: false },
    { idea: 'Judge each tool by its benefits to what matters, not by any benefit at all (the craftsman approach).', type: 'model', validated: false },
    { idea: 'Drain the shallows: budget shallow work and schedule every minute of the day.', type: 'model', validated: false }
  ],
  'atomic-habits': [
    { idea: 'Small improvements of 1% compound over time, like interest.', type: 'model', validated: false },
    { idea: 'Focus on systems, not goals: you fall to the level of your systems.', type: 'model', validated: false },
    { idea: 'Lasting change comes from identity: become the type of person who does the habit.', type: 'model', validated: false },
    { idea: 'A habit runs on a loop of cue, craving, response and reward.', type: 'theory', validated: false },
    { idea: 'The four laws: make it obvious, attractive, easy and satisfying; invert them to break a habit.', type: 'model', validated: false },
    { idea: 'Habit stacking: attach a new habit to one you already have.', type: 'model', validated: false },
    { idea: 'Implementation intentions (\'I will do X at time Y in place Z\') raise follow-through.', type: 'fact', validated: false },
    { idea: 'Your environment cues behavior, so make good cues visible and bad ones hard to see.', type: 'theory', validated: false },
    { idea: 'The two-minute rule: scale a habit down to something that takes under two minutes.', type: 'model', validated: false },
    { idea: 'Never miss twice: one slip is fine, a second starts a new pattern.', type: 'model', validated: false }
  ],
  'the-psychology-of-money': [
    { idea: 'How you behave with money matters more than how much you know.', type: 'theory', validated: false },
    { idea: 'Luck and risk shape outcomes far more than we admit, so be careful praising or blaming.', type: 'theory', validated: false },
    { idea: 'Almost all of Warren Buffett\'s wealth came after he turned 50, because compounding needs time.', type: 'fact', validated: false },
    { idea: 'Getting wealthy and staying wealthy are different skills, and survival comes first.', type: 'model', validated: false },
    { idea: 'Knowing what is enough protects you from risking what you have for what you don\'t need.', type: 'model', validated: false },
    { idea: 'A few tail events or investments drive most of the results.', type: 'theory', validated: false },
    { idea: 'Wealth is the money you do not spend; what you see people buy is not what they own.', type: 'model', validated: false },
    { idea: 'Save without a specific goal: savings buy flexibility and control over your time.', type: 'model', validated: false },
    { idea: 'People\'s views on money are shaped by the era and place they grew up in.', type: 'theory', validated: false },
    { idea: 'Leave room for error: a margin of safety beats a precise forecast.', type: 'model', validated: false }
  ],
  'the-scout-mindset': [
    { idea: 'Soldier mindset defends your beliefs; scout mindset tries to see things as they are.', type: 'model', validated: false },
    { idea: 'Motivated reasoning: for things we like we ask \'can I believe this?\', for things we dislike \'must I?\'.', type: 'theory', validated: false },
    { idea: 'Calibration: state confidence as probabilities and check them against outcomes.', type: 'model', validated: false },
    { idea: 'Test your thinking with the double standard, outsider, selective skeptic, status quo and conformity tests.', type: 'model', validated: false },
    { idea: 'Being wrong is information: update without shame and ask how surprised you would be.', type: 'model', validated: false },
    { idea: 'You can get the comfort that self-deception offers without paying its price.', type: 'theory', validated: false },
    { idea: 'Seek out disconfirming evidence and people who disagree.', type: 'model', validated: false },
    { idea: 'Hold your identity lightly, so you are not defending beliefs that are part of it.', type: 'model', validated: false },
    { idea: 'Forecasters who seek other views and update often make better predictions (Tetlock\'s superforecasters).', type: 'fact', validated: false }
  ],
  'outlive': [
    { idea: 'Medicine 3.0 shifts from treating disease late to preventing it early.', type: 'model', validated: false },
    { idea: 'Heart disease, cancer, neurodegeneration and type 2 diabetes (the Four Horsemen) cause most deaths in older adults.', type: 'fact', validated: false },
    { idea: 'People with low cardiorespiratory fitness (VO2 max) have a much higher risk of death than those with high fitness.', type: 'fact', validated: false },
    { idea: 'Chronic sleep loss raises the risk of disease and harms thinking.', type: 'fact', validated: false },
    { idea: 'Aim for healthspan, staying capable and independent, not just a long lifespan.', type: 'model', validated: false },
    { idea: 'Train today for the physical tasks you want to do at 100 (the centenarian decathlon).', type: 'model', validated: false },
    { idea: 'Insulin resistance and poor metabolic health sit underneath many chronic diseases.', type: 'theory', validated: false },
    { idea: 'Emotional health matters as much as physical health for a good late life.', type: 'theory', validated: false },
    { idea: 'Chronic diseases develop over decades, so prevention must start long before symptoms.', type: 'theory', validated: false },
    { idea: 'Measure risk precisely, for example with ApoB for heart disease, instead of relying on standard panels.', type: 'theory', validated: false }
  ]
};
