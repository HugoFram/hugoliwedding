import { questions, chooseAnswer, getDodgePosition } from './rsvp-game.mjs';

export function initRsvp() {
  const opener = document.getElementById('rsvp-open');
  const dialog = document.getElementById('rsvp-dialog');
  if (!opener || !dialog || typeof dialog.showModal !== 'function') return;
  const title = document.getElementById('rsvp-title');
  const hint = document.getElementById('rsvp-hint');
  const symbol = document.getElementById('rsvp-symbol');
  const answers = document.getElementById('rsvp-answers');
  const feedback = document.getElementById('rsvp-feedback');
  const progress = document.getElementById('rsvp-progress');
  const step = document.getElementById('rsvp-step');
  const stage = document.getElementById('rsvp-stage');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let questionIndex = 0;

  function button(text, onClick, primary = false) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = primary ? 'rsvp-answer rsvp-answer-primary' : 'rsvp-answer';
    element.textContent = text;
    element.addEventListener('click', onClick);
    return element;
  }

  function focusTitle() {
    if (dialog.open) title.focus({ preventScroll: true });
  }

  function clearStage() {
    answers.replaceChildren();
    answers.classList.remove('rsvp-answers-intro');
    stage.querySelector('.rsvp-confetti')?.remove();
    dialog.classList.remove('rsvp-result-success', 'rsvp-result-retry');
    feedback.textContent = '';
  }

  function addRunawayBehavior(element) {
    let attempts = 0;
    const messages = ['Oups, ce bouton a d’autres projets.', 'Il n’a vraiment pas envie de dire non.', 'Bon, on te laisse cliquer. À tes risques et périls.'];
    function dodge(event) {
      // Keyboard users and reduced-motion users can activate every answer normally.
      if (reducedMotion.matches || attempts >= 3 || (event.type === 'pointerenter' && event.pointerType !== 'mouse')) return;
      event.preventDefault();
      attempts += 1;
      const position = getDodgePosition(attempts, answers.clientWidth, answers.clientHeight, element.offsetWidth, element.offsetHeight);
      element.style.left = `${position.x}px`;
      element.style.top = `${position.y}px`;
      element.style.transform = 'none';
      feedback.textContent = messages[attempts - 1];
    }
    element.classList.add('rsvp-runaway');
    element.addEventListener('pointerenter', dodge);
    element.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse') dodge(event);
    });
    element.addEventListener('click', event => {
      if (event.detail > 0 && !reducedMotion.matches && attempts < 3) {
        event.stopImmediatePropagation();
        dodge(event);
      }
    }, { capture: true });
  }

  function renderQuestion(message = '') {
    clearStage();
    const question = questions[questionIndex];
    step.textContent = `Question ${questionIndex + 1} sur ${questions.length}`;
    progress.value = questionIndex + 1;
    symbol.textContent = question.symbol;
    title.textContent = question.title;
    hint.textContent = question.hint;
    answers.classList.toggle('rsvp-answers-intro', questionIndex === 0);
    question.answers.forEach((answer, answerIndex) => {
      const element = button(answer.text, () => {
        const result = chooseAnswer(questionIndex, answerIndex);
        if (result.outcome === 'next') {
          questionIndex = result.nextQuestion;
          renderQuestion(result.feedback);
        } else renderResult(result.outcome);
      }, questionIndex === 0 && answerIndex === 0);
      if (answer.dodge) addRunawayBehavior(element);
      answers.append(element);
    });
    feedback.textContent = message;
    focusTitle();
  }

  function confetti() {
    if (reducedMotion.matches) return;
    const container = document.createElement('div');
    container.className = 'rsvp-confetti';
    container.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 24; i += 1) {
      const piece = document.createElement('span');
      piece.style.setProperty('--x', `${(i * 37) % 100}%`);
      piece.style.setProperty('--delay', `${(i % 6) * 0.07}s`);
      piece.style.setProperty('--spin', `${i % 2 ? 220 : -220}deg`);
      container.append(piece);
    }
    stage.append(container);
  }

  function renderResult(outcome) {
    clearStage();
    const success = outcome === 'celebrate';
    dialog.classList.add(success ? 'rsvp-result-success' : 'rsvp-result-retry');
    step.textContent = success ? 'Le verdict des mariés' : 'Petit incident diplomatique';
    symbol.textContent = success ? '♡' : '…';
    title.textContent = success ? 'Invité·e modèle !' : 'Tu es… désinvité·e !';
    hint.textContent = success
      ? 'Ton enthousiasme fait l’unanimité. La piste de danse n’a qu’à bien se tenir !'
      : 'On plaisante, évidemment. Change ta réponse, on ne dira rien.';
    answers.append(button(success ? 'Rejouer' : 'Je me rattrape', () => {
      if (success) questionIndex = 0;
      renderQuestion();
    }, true), button('Terminer le jeu', () => dialog.close()));
    if (success) confetti();
    focusTitle();
  }

  opener.hidden = false;
  opener.addEventListener('click', () => {
    questionIndex = 0;
    dialog.showModal();
    document.body.classList.add('rsvp-is-open');
    renderQuestion();
  });
  document.getElementById('rsvp-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('rsvp-is-open');
    stage.querySelector('.rsvp-confetti')?.remove();
    opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
