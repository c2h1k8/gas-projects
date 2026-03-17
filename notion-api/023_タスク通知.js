const MainProcNotification = (function () {
  const isAfternoon = (date) => {
    return date.getHours() > 11;
  }

  const getTodoMessage = (todoList) => {
    const msgList = [];
    todoList.forEach(x => {
      msgList.push(`$${x.title}`);
    });
    return msgList;
  }

  const getEmoji = (emojiId, productId = '5ac1bfd5040ab15980c9b435') => {
    return LineUtil.getEmojiJson(productId, emojiId);
  }

  return {
    send: () => {
      const now = new Date();
      
      const { overdue, dueToday } = ProjectIssueDueService.getDueSummary();
      if (!overdue.length && !dueToday.length) {
        const emojis = [];
        emojis.push(getEmoji('140', '5ac21fda040ab15980c9b446'));
        emojis.push(getEmoji('002'));
        let msg = '未完了タスクなし';
        if (isAfternoon(now)) {
          msg = '本日もお疲れ様でした';
        }
        LocalUtils.postText(`$ ${msg} $`, emojis);
        return;
      }

      const msgList = [];
      const emojis = [];
      // 期限切れタスク
      if (overdue.length) {
        msgList.push('$ 期限切れタスク $');
        Array.prototype.push.apply(msgList, getTodoMessage(overdue));
        emojis.push(getEmoji('210', '5ac218e3040ab15980c9b43c'));
        emojis.push(getEmoji('006'));
        overdue.forEach(() => {
          emojis.push(getEmoji('006', '5ac21a18040ab15980c9b43e'));
        });
      }
      // 当日タスク
      if (dueToday.length) {
        if (msgList.length) {
          // 空行用に要素追加
          msgList.push('');
        }
        msgList.push('$ 本日未完了タスク $');
        Array.prototype.push.apply(msgList, getTodoMessage(dueToday));
        let emojiId1 = '212';
        let emojiId2 = '022';
        if (isAfternoon(now)) {
          // 警告絵文字に切り替え
          emojiId1 = '211';
          emojiId2 = '004';
        }
        emojis.push(getEmoji(emojiId1, '5ac218e3040ab15980c9b43c'));
        emojis.push(getEmoji(emojiId2));
        dueToday.forEach(() => {
          emojis.push(getEmoji('007', '5ac21a18040ab15980c9b43e'));
        });
      }
      LocalUtils.postText(msgList.join('\n'), emojis);
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

