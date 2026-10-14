const stageCards = document.querySelectorAll('[data-stage]');
const stageProgress = document.querySelector('.stage-progress');

stageCards.forEach((card) => {
  card.addEventListener('click', () => {
    stageCards.forEach((item) => item.classList.remove('is-active'));
    card.classList.add('is-active');
    stageProgress.textContent = `${card.dataset.stage} selected · open activity workspace`;
    document.querySelector('#activities').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.querySelector('#newActivity')?.addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.textContent = 'Activity draft started';
  button.classList.add('is-created');
  setTimeout(() => { button.textContent = '+ New activity'; button.classList.remove('is-created'); }, 1800);
});
