const timerButton = document.querySelector("#timerButton");
const timerStatus = document.querySelector("#timerStatus");

let timerId = null;
let remainingSeconds = 25 * 60;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function renderTimer() {
  timerStatus.textContent = `正在计时：${formatTime(remainingSeconds)}`;
}

timerButton.addEventListener("click", () => {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
    timerButton.textContent = "继续计时";
    timerStatus.textContent = `已暂停：${formatTime(remainingSeconds)}`;
    return;
  }

  timerButton.textContent = "暂停计时";
  renderTimer();

  timerId = window.setInterval(() => {
    remainingSeconds -= 1;

    if (remainingSeconds <= 0) {
      window.clearInterval(timerId);
      timerId = null;
      remainingSeconds = 25 * 60;
      timerButton.textContent = "重新开始 25 分钟计时";
      timerStatus.textContent = "完成一个 25 分钟专注时间。";
      return;
    }

    renderTimer();
  }, 1000);
});
