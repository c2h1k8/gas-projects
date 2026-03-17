class NotionPage {
  constructor(dabaSourceId, propertyItems = new Map(), icon = '', children = []) {
    this.dabaSourceId = dabaSourceId;
    this.icon = icon;
    this.propertyItems = propertyItems;
    this.children = children;
  }

  toJson() {
    const childJsons = [];
    this.children.forEach(obj => {
      childJsons.push(obj.toJson());
    });
    const json = {
      'properties': {},
      'children': childJsons,
    };
    if (this.dabaSourceId) {
      json.parent = { 'data_source_id': this.dabaSourceId };
    }
    if (this.icon) {
      json.icon = {
        'type': 'emoji',
        'emoji': this.icon,
      }
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
        [this.condition]: [],
      },
    };
    this.filterItem.forEach(item => {
      json.filter[this.condition].push(item.toJson());
    })
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
    switch (Object.prototype.toString.call(value)) {
      case '[object Date]':
        this.value = Utilities.formatDate(value, "JST", "yyyy-MM-dd");
        break;
      default:
        this.value = value;
        break;
    }
  }

  toJson() {
    return {
      'property': this.item,
      [this.type]: {
        [this.condition]: this.value,
      },
    }
  }
}

class NotionPropTitle {
  constructor(text = '') {
    this.text = text;
    this.isEmpty = !text;
  }

  toJson() {
    return {
      'title': [
        {
          'text': {
            'content': this.text,
          }
        }
      ]
    };
  }
}

class NotionPropText {
  constructor(text) {
    this.text = text;
    this.isEmpty = !text;
  }
  toJson() {
    return {
      'rich_text':[
        {
          'text':{
            "content": this.text,
          },
        },
      ]
    };
  }
}

class NotionPropSelect {
  constructor(text) {
    this.text = text;
    this.isEmpty = !text;
  }

  toJson() {
    return {
      'select': {
        'name': this.text,
      }
    };
  }
}

class NotionPropNumber {
  constructor(num) {
    this.num = num;
    this.isEmpty = (num == null || num === '' || !isFinite(num));
  }

  toJson() {
    return {
      'number': this.num,
    };
  }
}

class NotionPropUrl {
  constructor(url) {
    this.url = url;
    this.isEmpty = !url;
  }

  toJson() {
    return {
      'url': this.url,
    };
  }
}

class NotionPropCheckBox {
  constructor(check) {
    this.check = check;
  }

  toJson() {
    return {
      'checkbox': this.check,
    };
  }
}

class NotionPropDate {
  constructor(start = null, useTimeZone = true, end = null) {
    switch (Object.prototype.toString.call(start)) {
      case '[object Date]':
        this.start = Utilities.formatDate(start, "JST", "yyyy-MM-dd");
        break;
      case '[object String]':
        this.start = start;
        break;
    }
    this.useTimeZone = useTimeZone;
    switch (Object.prototype.toString.call(end)) {
      case '[object Date]':
        this.end = Utilities.formatDate(end, "JST", "yyyy-MM-dd");
        break;
      case '[object String]':
        this.end = end;
        break;
    }
    this.isEmpty = !start;
  }

  toJson() {
    const json =  {
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
    const json = {
      'relation': [],
    }
    for (const id of this.ids) {
      json.relation.push({'id': id});
    }
    return json;
  }
}

class NotionHeading {
  constructor(type, text = '', blockColor = 'default', children = []) {
    this.type = type;
    this.text = text;
    this.blockColor = blockColor;
    this.children = children;
  }

  toJson() {
    const childJsons = [];
    this.children.forEach(obj => {
      childJsons.push(obj.toJson());
    });
    const h = `heading_${this.type}`;
    return {
      'type': h,
      [h]: {
        'rich_text': [
        {
          'text': {
            'content': this.text,
          }
        }
      ],
      'color': this.blockColor,
      'children': childJsons,
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
      "type": "to_do",
      "to_do": {
        "rich_text": [{
          "type": "text",
          "text": {
            "content": this.text,
          }
        }],
        'color': this.blockColor,
      }
    }
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
        'rich_text': [{
          'type': 'text',
          'text': {
            'content': this.text,
            'link': null
          }
        }],
        'color': this.textColor,
      }
    }
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
        'rich_text': [{
          'type': 'text',
          'text': {
            'content': this.text,
            'link': null
          }
        }],
        'color': this.textColor,
      }
    }
  }
}
