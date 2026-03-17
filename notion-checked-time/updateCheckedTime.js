function UpdateCheckedTime() {
  const strDate = new Date();
  const list = Props.getJson(PKeys.CHECK_ITEM_LIST);

  for (const item of list) {
    const dbID = item['DATABASE_ID'];
    const checkboxProperty = item['CHECKBOX_PROPERTY'];
    const dateProperty = item['DATE_PROPERTY'];

    // チェックボックス=true で日付が空のものを取得
    const pages = NotionApi.getPages(dbID, new NotionFilter([
      new NotionFilterItem(checkboxProperty, 'checkbox', 'equals', true),
      new NotionFilterItem(dateProperty, 'date', 'is_empty', true),
    ]));

    if (pages.length === 0) {
      Logger.log('更新対象なし');
      continue;
    }

    // 更新処理
    for (const page of pages) {
      const properties = page.properties;
      if (!properties[checkboxProperty].checkbox) continue;
      if (properties[dateProperty].date != null) continue;
      Logger.log(properties['タスク'].title[0].plain_text);

      const propertyItems = new Map([[dateProperty, new NotionPropDate(strDate)]]);
      NotionApi.updatePage(page['id'], new NotionPage(null, propertyItems));
    }
  }
}
