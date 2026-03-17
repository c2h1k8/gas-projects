/**
 * 手動実行用
 */
function getIcon() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const filterItems = [];
  filterItems.push(new FilterItem('支出', 'title', 'equals', '固定資産税'));
  const resultArray = LocalUtils.getPages(props.DATABASE_ID_SPENDING, new Filter(filterItems));
  let iconList = [];
  resultArray.forEach(t => {
    const icon = t['icon'];
    if (icon !== null && (iconList.length === 0 || iconList.indexOf(icon.emoji) < 0)) {
      iconList.push(icon.emoji);
    }
  });
  Logger.log(iconList);
}

/**
 * 手動実行用
 */
function getColumns() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const result = LocalUtils.getDbColumns(props.DATABASE_ID_SPENDING, ['支払方法', 'お店']);
  for (const shop of result.get('お店').select.options) {
    Logger.log(shop.name);
  }
  for (const shop of result.get('支払方法').select.options) {
    Logger.log(shop.name);
  }
}

/**
 * 手動実行用
 */
function getDiaryIcon() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const resultArray = LocalUtils.getDbColumns(props.DATABASE_ID_DIARY);
  const iconList = [];
  resultArray.forEach(t => {
    const icon = t['icon'];
    if (icon !== null && (iconList.length === 0 || iconList.indexOf(icon.emoji) < 0)) {
      iconList.push(icon.emoji);
    }
  });
  Logger.log(iconList);
}

function getDiaryMealMenu() {

  const mealMenuList = LocalUtils.getPages('fd89942bd6ef49e48af26834c0aa2732');
  const mealMenuMap = new Map();
  for (const mealMenu of mealMenuList) {
    mealMenuMap.set(mealMenu.properties['名前'].title[0].plain_text, mealMenu.id);
  }
  // const resultArray = LocalUtils.getPages('fd89942bd6ef49e48af26834c0aa2732');
  const props = PropertiesService.getScriptProperties().getProperties();
  const filterItems = [];
  filterItems.push(new FilterItem('日付', 'date', 'before', new Date(2022, 5, 15)));
  const resultArray = LocalUtils.getPages(props.DATABASE_ID_DIARY, new Filter(filterItems));
  for (const page of resultArray) {
    const meals = page.properties['食事'].multi_select;
    if (!meals.length) continue;
    const mealList = [];
    for (const meal of meals) {
        mealList.push(mealMenuMap.get(meal.name));
    }
    const propItem = new Map();
    propItem.set(' 食事メニュー', new PropRelation(mealList));
    LocalUtils.updatePage(page.id, new Page('', propItem));
  }
  // Logger.log(mealList);
      
}