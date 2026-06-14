const MainProcNotification = (function () {
  const isAfternoon = (date) => {
    return date.getHours() > 11;
  }

  return {
    send: () => {
      const now = new Date();
      const afternoon = isAfternoon(now);
      const { overdue, dueToday } = ProjectIssueDueService.getDueSummary();

      if (!overdue.length && !dueToday.length) {
        LocalUtils.postFlex('タスク', NotifyCards.tasks({ allDone: true, afternoon }));
        return;
      }
      LocalUtils.postFlex('タスク', NotifyCards.tasks({
        overdue: overdue.map((x) => x.title),
        dueToday: dueToday.map((x) => x.title),
        afternoon,
      }));
    },
    error: (e) => {
      if (e instanceof DbNotFoundException) {
        LocalUtils.postText(e.message);
        return;
      }
      throw e;
    },
  };
})();

const sendLine = () => {
  try {
    MainProcNotification.send();
  } catch (e) {
    MainProcNotification.error(e);
  }
}

