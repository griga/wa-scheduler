function waitTime(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWAMessage(message) {
  const tb = document.querySelector('[data-testid=compose-box] [role=textbox]');
  tb.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: message,
      inputType: 'insertText',
    }),
  );
  await waitTime(1000);
  const sb = document.querySelector("footer button[aria-label='Send']");
  sb.click();
}

function launch(msg) {
  sendWAMessage(msg);
  setInterval(() => sendWAMessage(msg), 60 * 60 * 1000); // every hour
}

setTimeout(() => launch('Манчестер 7.8.3'), 33 * 60 * 1000); // 33 minutes
