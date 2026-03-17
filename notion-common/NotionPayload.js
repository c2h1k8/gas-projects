// ---- ヘルパー関数 ----

const toDateString_ = (value) => {
  switch (Object.prototype.toString.call(value)) {
    case '[object Date]': return Utilities.formatDate(value, "JST", "yyyy-MM-dd");
    case '[object String]': return value;
    default: return null;
  }
};

const mapChildrenToJson_ = (children) => children.map(obj => obj.toJson());

const buildRichText_ = (text) => [{ 'text': { 'content': text } }];

const buildRichTextBlock_ = (text) => [{ 'type': 'text', 'text': { 'content': text, 'link': null } }];

// ---- ページ・フィルター ----

class NotionPage {
  constructor(dabaSourceId, propertyItems = new Map(), icon = '', children = []) {
    this.dabaSourceId = dabaSourceId;
    this.icon = icon;
    this.propertyItems = propertyItems;
    this.children = children;
  }

  toJson() {
    const json = {
      'properties': {},
      'children': mapChildrenToJson_(this.children),
    };
    if (this.dabaSourceId) {
      json.parent = { 'data_source_id': this.dabaSourceId };
    }
    if (this.icon) {
      json.icon = { 'type': 'emoji', 'emoji': this.icon };
    }
    for (const [key, value] of this.propertyItems) {
      if (value.isEmpty) continue;
      json.properties[key] = value.toJson();
    }
    return json;
  }
}

class NotionFilter {
  constructor(filterItem, sortMap, condition = 'and') {
    this.condition = condition;
    this.filterItem = filterItem;
    this.sortMap = sortMap;
  }

  toJson() {
    const json = {
      'filter': {
        [this.condition]: this.filterItem.map(item => item.toJson()),
      },
    };
    if (this.sortMap) {
      json.sorts = [];
      for (const [key, value] of this.sortMap) {
        json.sorts.push({
          'property': key,
          'direction': value ? 'descending' : 'ascending',
        });
      }
    }
    return json;
  }
}

class NotionFilterItem {
  constructor(item, type, condition, value) {
    this.item = item;
    this.type = type;
    this.condition = condition;
    this.value = toDateString_(value) ?? value;
  }

  toJson() {
    return {
      'property': this.item,
      [this.type]: {
        [this.condition]: this.value,
      },
    };
  }
}

// ---- プロパティクラス ----

class NotionPropTitle {
  constructor(text = '') {
    this.text = text;
    this.isEmpty = !text;
  }

  toJson() {
    return { 'title': buildRichText_(this.text) };
  }
}

class NotionPropText {
  constructor(text) {
    this.text = text;
    this.isEmpty = !text;
  }

  toJson() {
    return { 'rich_text': buildRichText_(this.text) };
  }
}

class NotionPropSelect {
  constructor(text) {
    this.text = text;
    this.isEmpty = !text;
  }

  toJson() {
    return { 'select': { 'name': this.text } };
  }
}

class NotionPropNumber {
  constructor(num) {
    this.num = num;
    this.isEmpty = (num == null || num === '' || !isFinite(num));
  }

  toJson() {
    return { 'number': this.num };
  }
}

class NotionPropUrl {
  constructor(url) {
    this.url = url;
    this.isEmpty = !url;
  }

  toJson() {
    return { 'url': this.url };
  }
}

class NotionPropCheckBox {
  constructor(check) {
    this.check = check;
  }

  toJson() {
    return { 'checkbox': this.check };
  }
}

class NotionPropDate {
  constructor(start = null, useTimeZone = true, end = null) {
    this.start = toDateString_(start);
    this.end = toDateString_(end);
    this.useTimeZone = useTimeZone;
    this.isEmpty = !start;
  }

  toJson() {
    const json = {
      'type': 'date',
      'date': {
        'start': this.start,
        'end': this.end,
      }
    };
    if (this.useTimeZone) {
      json.date.time_zone = 'Asia/Tokyo';
    }
    return json;
  }
}

class NotionPropRelation {
  constructor(ids = []) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    this.ids = ids;
    this.isEmpty = !ids.length;
  }

  toJson() {
    return {
      'relation': this.ids.map(id => ({ 'id': id })),
    };
  }
}

// ---- ブロッククラス ----

class NotionHeading {
  constructor(type, text = '', blockColor = 'default', children = []) {
    this.type = type;
    this.text = text;
    this.blockColor = blockColor;
    this.children = children;
  }

  toJson() {
    const h = `heading_${this.type}`;
    return {
      'type': h,
      [h]: {
        'rich_text': buildRichText_(this.text),
        'color': this.blockColor,
        'children': mapChildrenToJson_(this.children),
      },
    };
  }
}

class NotionCheckBox {
  constructor(text = '', blockColor = 'default') {
    this.text = text;
    this.blockColor = blockColor;
  }

  toJson() {
    return {
      'type': 'to_do',
      'to_do': {
        'rich_text': buildRichTextBlock_(this.text),
        'color': this.blockColor,
      }
    };
  }
}

class NotionBulletedList {
  constructor(text = '', textColor = 'default') {
    this.text = text;
    this.textColor = textColor;
  }

  toJson() {
    return {
      'type': 'bulleted_list_item',
      'bulleted_list_item': {
        'rich_text': buildRichTextBlock_(this.text),
        'color': this.textColor,
      }
    };
  }
}

class NotionParagraph {
  constructor(text = '', textColor = 'default') {
    this.text = text;
    this.textColor = textColor;
  }

  toJson() {
    return {
      'type': 'paragraph',
      'paragraph': {
        'rich_text': buildRichTextBlock_(this.text),
        'color': this.textColor,
      }
    };
  }
}
