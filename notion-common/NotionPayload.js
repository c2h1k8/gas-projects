// ---- ヘルパー関数 ----

const toDateString_ = (value) => {
  switch (Object.prototype.toString.call(value)) {
    case '[object Date]': return Utilities.formatDate(value, 'JST', 'yyyy-MM-dd');
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

// ---- プロパティ基底クラス ----

class NotionPropSimple_ {
  constructor(value) {
    this.value = value;
    this.isEmpty = !value;
  }
}

// ---- プロパティクラス ----

class NotionPropTitle extends NotionPropSimple_ {
  constructor(text = '') { super(text); }
  toJson() { return { 'title': buildRichText_(this.value) }; }
}

class NotionPropText extends NotionPropSimple_ {
  constructor(text) { super(text); }
  toJson() { return { 'rich_text': buildRichText_(this.value) }; }
}

class NotionPropSelect extends NotionPropSimple_ {
  constructor(text) { super(text); }
  toJson() { return { 'select': { 'name': this.value } }; }
}

class NotionPropUrl extends NotionPropSimple_ {
  constructor(url) { super(url); }
  toJson() { return { 'url': this.value }; }
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

class NotionPropCheckBox {
  constructor(check) {
    this.check = check;
    this.isEmpty = false;
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

// ---- ブロック基底クラス ----

class NotionBlockItem_ {
  constructor(type, text = '', color = 'default') {
    this.type = type;
    this.text = text;
    this.color = color;
  }

  toJson() {
    return {
      'type': this.type,
      [this.type]: {
        'rich_text': buildRichTextBlock_(this.text),
        'color': this.color,
      },
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

class NotionCheckBox extends NotionBlockItem_ {
  constructor(text = '', blockColor = 'default') { super('to_do', text, blockColor); }
}

class NotionBulletedList extends NotionBlockItem_ {
  constructor(text = '', textColor = 'default') { super('bulleted_list_item', text, textColor); }
}

class NotionParagraph extends NotionBlockItem_ {
  constructor(text = '', textColor = 'default') { super('paragraph', text, textColor); }
}
