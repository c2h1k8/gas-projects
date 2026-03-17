const MainProcDiary = (function () {
  /**
   * 天気アイコンを取得します。
   * @return 天気アイコン
   */
  const getWeatherIcon = () => {
    try {
      const html = UrlFetchApp.fetch('https://tenki.jp/forecast/3/16/4410/13209/').getContentText("UTF-8");
      const todayBlock = Utils.getHtmlElement(html, '<section class="today-weather">', '</section>');
      const weather = Utils.getHtmlElement(todayBlock, '<p class="weather-telop">', '</p>');
      const iconMap = Props.getMap(PKeys.CALENDAR_ICON);
      Logger.log(weather);
      return iconMap[weather] || '';
    } catch (e) {
      Logger.log(e);
      return '';
    }
  }

  /**
   * DBから中長期目標情報を取得します。
   * @param date 日付
   * @return 中長期目標配列
   */
  const getLongTermGoalData = (date) => {
    const targetYear = date.getFullYear();
    // 検索条件
    const filterItems = [
      new FilterItem('完了', 'checkbox', 'equals', false),
      new FilterItem('タグ', 'select', 'equals', '目標'),
      new FilterItem('期日', 'date', 'before', new Date(targetYear + 1, date.getMonth(), date.getDate())),
    ];
    // ソート条件
    const sortMap = new Map([
      ['期日', 'asc'],
      ['タスク', 'asc'],
    ]);
    // DB検索
    const results = [];
    const dbMap = LocalUtils.getDatabaseIdMap(Constants.DATABASE_ID.TODO);
    for (const [year, dbId] of dbMap) {
      if (year < targetYear) continue;
      const pages = LocalUtils.getPages(dbId, new Filter(filterItems, sortMap));
      // 検索結果格納
      pages.forEach(p => {
        results.push({
          text: p.properties['タスク'].title[0].plain_text,
          date: p.properties['期日'].date.start,
        });
      });
    }
    return results;
  }

  const createTaskSection = (title, color, tasks) => {
    if (!tasks.length) return null;
    const items = tasks.map(task => new CheckBox(task));
    return new Heading(3, title, color, items);
  }

  const createEventSection = (title, color, eventList) => {
    if (!(eventList?.length)) return null;
    const items = eventList.map(ev => {
      const location = ev.location ? `@${ev.location}` : '';
      return new BulletedList(`${ev.day} ${ev.time} ${ev.title} ${location}`);
    });
    return new Heading(3, title, color, items);
  }

  /**
   * ページオブジェクト生成
   * @param dateInfo 日付情報
   * @param fxPageId FXページID
   * @return Pageオブジェクト
   */
  const makePageDiary = (dateInfo, fxPageId) => {
    // プロパティ要素設定
    const propItem = new Map([
      ['名前', new PropTitle(dateInfo.YMDA)],
      ['就寝時間', new PropDate(dateInfo.YMDHM)],
      ['起床時間', new PropDate(dateInfo.YMDHM)],
      ['日付', new PropDate(dateInfo.YMD, false)],
      ['FX集計月', new PropRelation(fxPageId)],
    ]);
    
    // ブロック要素設定
    const blockItems = [];
    // Todo セクション
    const todoData = {
      '期限切れ': { data: LocalUtils.getToDoData(dateInfo.YMD, { before: true }), color: 'red'},
      '本日期限': { data: LocalUtils.getToDoData(dateInfo.YMD, { equals: true }), color: 'blue'},
      '今週期限': { data: LocalUtils.getToDoData(dateInfo.YMD, { after: true }), color: 'green'},
    }

    const hasTodos = Object.values(todoData).some(d => d.data.length);
    if (hasTodos) {
      blockItems.push(new Heading(2, 'Todo', 'blue_background'));
      for (const [title, { data, color }] of Object.entries(todoData)) {
        const section = createTaskSection(title, color, data);
        if (section) blockItems.push(section);
      }
    }

    // カレンダー予定
    blockItems.push(new Heading(2, '予定', 'green_background'));
    const todayEvents = LocalUtils.getCalendarEvents(Props.getValue(PKeys.CALENDAR_ID_PRIVATE), dateInfo.ORIGIN);
    const nextDate = new Date(dateInfo.ORIGIN);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextMonthLast = new Date(dateInfo.ORIGIN.getFullYear(), dateInfo.ORIGIN.getMonth() + 2, 0);
    const futureEvents = LocalUtils.getCalendarEvents(Props.getValue(PKeys.CALENDAR_ID_PRIVATE), nextDate, nextMonthLast);

    const getMonthKey = date => DateUtils.formatDate(date, 'yyyyMM');

    const months = [
      { label: '今日', color: 'yellow', key: getMonthKey(dateInfo.ORIGIN), events: todayEvents },
      { label: '今月', color: 'default', key: getMonthKey(dateInfo.ORIGIN), events: futureEvents },
      { label: '来月', color: 'default', key: getMonthKey(nextMonthLast), events: futureEvents },
    ];

    months.forEach(({ label, color, key, events }) => {
      const list = events?.get(key);
      const section = createEventSection(label, color, list);
      if (section) blockItems.push(section);
    });
    
    // 振り返り
    blockItems.push(new Heading(2, '振り返り', 'pink_background'));
    const goals = getLongTermGoalData(dateInfo.ORIGIN);
    if (goals.length) {
      blockItems.push(new Heading(3, '中・長期目標', 'yellow'));
      const after3Date = new Date(dateInfo.ORIGIN);
      const after6Date = new Date(dateInfo.ORIGIN);
      after3Date.setMonth(after3Date.getMonth() + 3);
      after6Date.setMonth(after6Date.getMonth() + 6);
      const after3 = DateUtils.formatDate(after3Date, "yyyy-MM-dd");
      const after6 = DateUtils.formatDate(after6Date, "yyyy-MM-dd");

      goals.forEach(goal => {
        let color = 'gray';
        switch (true) {
          case goal.date < dateInfo.YMD:
          // 期限切れのものは赤文字
            color = 'red';
            break;
          case goal.date < after3:
            color = 'blue';
            break;
          case goal.date < after6:
            color = 'default';
            break;
        }
        blockItems.push(new CheckBox(goal.text, color));
      });
    }
    blockItems.push(new Heading(3, '行動記録', 'yellow'));
    blockItems.push(new Heading(3, '学び', 'yellow'));
    blockItems.push(new Heading(2, 'メモ', 'orange_background'));
    const weatherIcon = getWeatherIcon()
    if (!weatherIcon) {
      blockItems.push(new Paragraph(Utils.getLog(false)));
    }
    return new Page(LocalUtils.getDatabaseId(dateInfo.ORIGIN.getFullYear(), Constants.DATABASE_ID.DIARY), propItem, weatherIcon, blockItems);
  }
  return {
    create: () => {
      // 作成対象の日付取得
      const now = new Date();
      // 日付フォーマット情報取得
      const dateInfo = {
        'M'    : DateUtils.formatDate(now, "MM月"),
        'YMD'  : DateUtils.formatDate(now, "yyyy-MM-dd"),
        'YMDA' : DateUtils.formatDate(now, "yyyy年MM月dd日(aaa)"),
        'YMDHM': DateUtils.formatDate(now, "yyyy-MM-ddT00:00"),
        'ORIGIN': now,
      }
      // FX月別集計テーブルから対象月のページIDを取得
      const fxPageId = LocalUtils.getPageIdFromTitle(LocalUtils.getDatabaseId(now.getFullYear(), Constants.DATABASE_ID.FX), Constants.PROPERTY_FX, dateInfo.M);
      // ページ作成
      LocalUtils.createPage(makePageDiary(dateInfo, fxPageId));
    },
    error: (e) => {
      // if (e instanceof DbNotFoundException) {
      //   LineUtil.postText(props.LINE_CHANNEL_TOKEN, props.LINE_USER_ID, e.message);
      //   return;
      // }
      LineUtil.postText(Props.getValue(PKeys.LINE_CHANNEL_TOKEN), Props.getValue(PKeys.LINE_USER_ID), '日記の作成に失敗しました');
      throw e;
    },
  };
})();

/**
 * 日記作成
 */
function CreateDiary() {
  try {
    MainProcDiary.create();
  } catch (e) {
    MainProcDiary.error(e);
  }
}