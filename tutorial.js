const tutorialOverlay = document.getElementById("tutorial-overlay");
const tutorialPopover = document.getElementById("tutorial-popover");
const tutorialTitle = document.getElementById("tutorial-title");
const tutorialContent = document.getElementById("tutorial-content");
const tutorialPrevBtn = document.getElementById("tutorial-prev");
const tutorialNextBtn = document.getElementById("tutorial-next");
const tutorialEndBtn = document.getElementById("tutorial-end");
const tutorialCounter = document.getElementById("tutorial-counter");

let currentTutorialSteps = [];
let currentStepIndex = 0;
let highlightedElement = null;
let currentOnEndAction = null;

const loginTutorialSteps = [
  {
    element: "#username",
    title: "Добро пожаловать!",
    content:
      "Это ваше имя, которое увидят другие участники. Придумайте что-нибудь уникальное!",
  },
  {
    element: "#role-selection-container",
    title: "Выберите вашу роль",
    content:
      'Ваша роль определяет ваш основной "костюм" в комнате. Роль PM (Project Manager) дает особые права на управление сессией.',
  },
  {
    element: "#observer-mode-label",
    title: "Режим наблюдателя",
    content:
      "Если вы не планируете голосовать, а хотите только наблюдать за процессом, включите этот режим. Ваша карточка будет отмечена иконкой глаза 👁️.",
  },
  {
    element: '[onclick="joinGame()"]',
    title: "Присоединиться к комнате",
    content:
      "Когда все будет готово, нажмите эту кнопку, чтобы войти в комнату и начать покер!",
  },
  {
    element: "#new-room-btn",
    title: "Создать новую комнату",
    content:
      "Если вы хотите создать отдельную комнату для своей команды, нажмите сюда. Будет сгенерирована новая уникальная ссылка.",
  },
];

const voterTutorialSteps = [
  {
    element: "#players-grid",
    title: "Игровое поле",
    content:
      "Здесь вы видите всех участников комнаты. Когда игрок голосует, его карточка переворачивается, показывая, что выбор сделан.",
  },
  {
    element: "#hand-panel",
    title: "Ваши карты",
    content:
      "Это ваша рука. Выберите карту, которая, по вашему мнению, соответствует сложности задачи. Повторное нажатие на карту отменит ваш голос.",
  },
  {
    element: "#user-badge",
    title: "Ваш профиль",
    content:
      'Здесь отображается ваше имя и роль. Кнопка "Выйти" позволит вам вернуться на экран входа, чтобы сменить имя или роль.',
  },
  {
    element: "#btn-reveal",
    title: "Вскрытие карт",
    content:
      "Когда PM нажмет эту кнопку, все карты на столе перевернутся, и вы увидите оценки каждого участника.",
  },
  {
    element: "#stats-panel",
    title: "Статистика раунда",
    content:
      "После вскрытия карт здесь появится статистика: среднее значение, медиана и самая популярная оценка. Это помогает прийти к консенсусу.",
  },
];

const pmTutorialSteps = [
  {
    element: "#players-grid",
    title: "Игровое поле",
    content:
      "Вы видите всех участников. Как PM, вы не голосуете, а управляете процессом. Ваша карта отмечена короной 👑.",
  },
  {
    element: "#voter-role-controls",
    title: "Управление голосующими",
    content:
      "Вы можете разрешать или запрещать голосование для определенных ролей. Это полезно, если вы хотите услышать мнение только разработчиков или только QA.",
  },
  {
    element: "#pm-controls",
    title: "Инструменты PM",
    content:
      "Здесь вы можете запустить таймер для автоматического вскрытия карт. Это помогает держать обсуждение в тонусе.",
  },
  {
    element: "#btn-reveal",
    title: "Вскрыть карты",
    content:
      "Когда все проголосуют или обсуждение завершится, нажмите эту кнопку, чтобы показать все оценки.",
  },
  {
    element: "#btn-reset",
    title: "Сброс раунда",
    content:
      "Эта кнопка сбрасывает все голоса и очищает поле, подготавливая всех к следующему раунду оценки.",
  },
  {
    element: "#stats-panel",
    title: "Статистика раунда",
    content:
      "После вскрытия карт здесь появится статистика, которая поможет вам и команде быстрее прийти к общему решению.",
  },
];

const observerTutorialSteps = [
  {
    element: "#players-grid",
    title: "Игровое поле",
    content:
      "Как наблюдатель, вы видите всех участников и их статус голосования. Ваша карта отмечена иконкой глаза 👁️.",
  },
  {
    element: "#hand-panel",
    title: "Панель карт",
    content:
      "В режиме наблюдателя панель с картами для голосования для вас скрыта.",
  },
  {
    element: "#stats-panel",
    title: "Статистика раунда",
    content:
      "После того как PM вскроет карты, вы сможете увидеть всю статистику по раунду, чтобы быть в курсе процесса оценки.",
  },
];

function closeTutorialUI() {
  if (highlightedElement) {
    highlightedElement.classList.remove("tutorial-highlight");
    highlightedElement.style.borderRadius = "";
  }
  tutorialOverlay.classList.add("hidden");
  tutorialPopover.classList.add("hidden");
  document.body.style.overflow = "";
}

function finishTutorial() {
  closeTutorialUI();
  try {
    localStorage.setItem("tutorialCompleted_v1", "true");
  } catch (e) {
    console.error(
      "Failed to save tutorial completion status to localStorage.",
      e,
    );
  }
}

function startTutorial(steps, isFinalPart = false) {
  if (!steps || steps.length === 0) {
    closeTutorialUI();
    return;
  }

  currentTutorialSteps = steps;
  currentStepIndex = 0;
  currentOnEndAction = isFinalPart ? finishTutorial : closeTutorialUI;

  tutorialOverlay.classList.remove("hidden");
  tutorialPopover.classList.remove("hidden");

  document.body.style.overflow = "hidden";

  tutorialEndBtn.removeEventListener("click", closeTutorialUI);
  tutorialEndBtn.removeEventListener("click", finishTutorial);
  tutorialOverlay.removeEventListener("click", closeTutorialUI);
  tutorialOverlay.removeEventListener("click", finishTutorial);

  tutorialEndBtn.addEventListener("click", currentOnEndAction);
  tutorialOverlay.addEventListener("click", currentOnEndAction);

  showStep(currentStepIndex);
}

function showStep(stepIndex) {
  if (highlightedElement) {
    highlightedElement.classList.remove("tutorial-highlight");
    highlightedElement.style.borderRadius = "";
  }

  const step = currentTutorialSteps[stepIndex];
  if (!step) {
    currentOnEndAction();
    return;
  }

  const element = document.querySelector(step.element);
  if (!element) {
    console.warn(`Tutorial element not found: ${step.element}. Skipping.`);
    currentStepIndex++;
    showStep(currentStepIndex);
    return;
  }

  highlightedElement = element;

  const computedStyle = window.getComputedStyle(element);
  const borderRadius = computedStyle.getPropertyValue("border-radius");
  highlightedElement.style.borderRadius = borderRadius;

  highlightedElement.classList.add("tutorial-highlight");
  highlightedElement.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });

  tutorialTitle.textContent = step.title;
  tutorialContent.textContent = step.content;
  tutorialCounter.textContent = `${stepIndex + 1} / ${currentTutorialSteps.length}`;

  updatePopoverPosition();

  tutorialPrevBtn.style.display = stepIndex === 0 ? "none" : "inline-block";
  tutorialNextBtn.style.display =
    stepIndex === currentTutorialSteps.length - 1 ? "none" : "inline-block";
  tutorialEndBtn.style.display =
    stepIndex === currentTutorialSteps.length - 1 ? "inline-block" : "none";
}

function updatePopoverPosition() {
  if (!highlightedElement) return;

  const elementRect = highlightedElement.getBoundingClientRect();
  const popoverRect = tutorialPopover.getBoundingClientRect();
  const spaceAbove = elementRect.top;
  const spaceBelow = window.innerHeight - elementRect.bottom;

  let top, left;

  if (spaceBelow > popoverRect.height + 20) {
    top = elementRect.bottom + 15;
  } else if (spaceAbove > popoverRect.height + 20) {
    top = elementRect.top - popoverRect.height - 15;
  } else {
    top = window.innerHeight / 2 - popoverRect.height / 2;
  }

  left = elementRect.left + elementRect.width / 2 - popoverRect.width / 2;

  if (left < 10) left = 10;
  if (left + popoverRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popoverRect.width - 10;
  }

  tutorialPopover.style.top = `${top}px`;
  tutorialPopover.style.left = `${left}px`;
}

tutorialNextBtn.addEventListener("click", () => {
  if (currentStepIndex < currentTutorialSteps.length - 1) {
    currentStepIndex++;
    showStep(currentStepIndex);
  } else {
    currentOnEndAction();
  }
});

tutorialPrevBtn.addEventListener("click", () => {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    showStep(currentStepIndex);
  }
});

window.addEventListener("resize", updatePopoverPosition);
