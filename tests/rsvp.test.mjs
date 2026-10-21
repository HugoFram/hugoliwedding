import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, chooseAnswer, getDodgePosition } from '../public/assets/rsvp-game.mjs';

test('le parcours positif atteint la célébration après les quatre questions', () => {
  let step = 0;
  for (let i = 0; i < questions.length - 1; i += 1) {
    const result = chooseAnswer(step, 0);
    assert.equal(result.outcome, 'next');
    step = result.nextQuestion;
  }
  assert.equal(chooseAnswer(step, 0).outcome, 'celebrate');
});

test('une réponse taquine permet de reprendre la même question sans perdre sa place', () => {
  questions.forEach((question, index) => {
    const retry = question.answers.findIndex(answer => answer.outcome === 'retry');
    const result = chooseAnswer(index, retry);
    assert.equal(result.outcome, 'retry');
    assert.equal(result.nextQuestion, index);
  });
});

test('les réponses inexistantes sont refusées', () => {
  for (const [question, answer] of [[-1, 0], [4, 0], [0, 2], [0, -1], ['0', 0], [0, NaN]]) {
    assert.throws(() => chooseAnswer(question, answer), RangeError);
  }
});

test('le bouton fuyant reste dans sa zone sur mobile et ordinateur', () => {
  for (const width of [230, 280, 430]) {
    const positions = [1, 2, 3].map(attempt => getDodgePosition(attempt, width, 200, 190, 50));
    for (const position of positions) {
      assert.ok(position.x >= 0 && position.x + 190 <= width);
      assert.ok(position.y >= 68 && position.y + 50 <= 200);
    }
    assert.notDeepEqual(positions[0], positions[1]);
    assert.ok(positions[0].y - positions[1].y > 50);
  }
});
