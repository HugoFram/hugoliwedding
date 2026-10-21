// A joke questionnaire only: no guest data, network requests or persistence.
export const questions = [
  {
    title: 'Tu viens faire la fête avec nous ?',
    hint: 'Réfléchis bien. Le comité des mariés observe.',
    symbol: '♡',
    answers: [
      { text: 'Oui, avec joie !', outcome: 'next' },
      { text: 'Non, je passe mon tour', outcome: 'retry', dodge: true },
    ],
  },
  {
    title: 'Ton niveau d’enthousiasme ?',
    hint: 'Toute ressemblance avec un interrogatoire est purement fortuite.',
    symbol: '✧',
    answers: [
      { text: 'Trop hâte, je compte les jours !', outcome: 'next' },
      { text: 'J’ai déjà préparé ma tenue.', outcome: 'next' },
      { text: 'Je viens surtout pour le dessert.', outcome: 'next', feedback: 'Le gâteau apprécie cette déclaration d’amour.' },
      { text: 'Attends… c’est quand, déjà ?', outcome: 'retry' },
    ],
  },
  {
    title: 'Tu nous offres quoi ?',
    hint: 'Aucun cadeau exigé. Un petit effort de diplomatie, en revanche…',
    symbol: '✉',
    answers: [
      { text: 'Un mot doux et beaucoup d’amour.', outcome: 'next' },
      { text: 'Une surprise !', outcome: 'next' },
      { text: 'Une chorégraphie inoubliable.', outcome: 'next', feedback: 'On espère que quelqu’un filmera ça.' },
      { text: 'Ma présence. C’est déjà pas mal.', outcome: 'retry' },
    ],
  },
  {
    title: 'Et sur la piste de danse ?',
    hint: 'Dernière question. Ta réputation est en jeu.',
    symbol: '♪',
    answers: [
      { text: 'Jusqu’à la dernière chanson !', outcome: 'celebrate' },
      { text: 'Jusqu’à ce que mes pieds négocient.', outcome: 'celebrate' },
      { text: 'Je motive toute la table.', outcome: 'celebrate' },
      { text: 'Je pars juste après le dessert.', outcome: 'retry' },
    ],
  },
];

export function chooseAnswer(questionIndex, answerIndex) {
  if (!Number.isInteger(questionIndex) || !Number.isInteger(answerIndex)) throw new RangeError('Réponse inconnue.');
  const answer = questions[questionIndex]?.answers[answerIndex];
  if (!answer) throw new RangeError('Réponse inconnue.');
  return { outcome: answer.outcome, nextQuestion: answer.outcome === 'next' ? questionIndex + 1 : questionIndex,
    feedback: answer.feedback ?? '' };
}

// Stay in the answer area and alternate rows, including on narrow touch screens.
export function getDodgePosition(attempt, width, height, buttonWidth, buttonHeight) {
  const right = Math.max(0, width - buttonWidth - 6);
  const bottom = Math.max(0, height - buttonHeight - 6);
  return { x: attempt % 2 ? Math.min(6, right) : right, y: attempt % 2 ? bottom : Math.min(68, bottom) };
}
