const IMAGE_BACKGROUND_COLOR = '#ffffff';

/**
 * テキストメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#text-message
 * @param token チャネルトークン
 * @param replyToken リプライトークン
 * @param message メッセージ
 * @param emojis メッセージ用絵文字配列
 * @return HTTPレスポンスデータ
 */
function replyText(token, replyToken, message, emojis = []) {
  return reply(token, replyToken, getTextData(message, emojis));
}
/**
 * テキストメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#text-message
 * @param token チャネルトークン
 * @param userId ユーザID
 * @param message メッセージ
 * @param emojis メッセージ用絵文字配列
 * @return HTTPレスポンスデータ
 */
function postText(token, userId, message, emojis = []) {
  return push(token, userId, getTextData(message, emojis));
}
/**
 * テキストメッセージ（クイックリプライあり）を送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#text-message
 * @param token チャネルトークン
 * @param replyToken リプライトークン
 * @param message メッセージ
 * @param actions クイックリプライアクション配列
 * @param emojis メッセージ用絵文字配列
 * @return HTTPレスポンスデータ
 */
function replyQuickText(token, replyToken, message, actions, emojis = []) {
  return reply(token, replyToken, getTextData(message, emojis, actions));
}
/**
 * テキストメッセージ（クイックリプライあり）を送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#text-message
 * @param token チャネルトークン
 * @param userId ユーザID
 * @param message メッセージ
 * @param actions クイックリプライアクション配列
 * @param emojis メッセージ用絵文字配列
 * @return HTTPレスポンスデータ
 */
function postQuickText(token, userId, message, actions, emojis = []) {
  return push(token, userId, getTextData(message, emojis, actions));
}
/**
 * 送信するテキストメッセージデータを生成します。
 * @param message メッセージ
 * @param emojis メッセージ用絵文字配列
 * @param actions クイックリプライアクション配列
 * @return メッセージデータ
 */
function getTextData(message, emojis, actions = []) {
  message = getMessage(message);
  const postData = {
    'messages': [
      {
        'type': 'text',
        'text': message,
      }
    ]
  };
  if (!Array.isArray(emojis)) {
    if (emojis == null) {
      emojis = [];
    } else {
      emojis = [emojis];
    }
  }
  if (emojis.length) {
    postData.messages[0].emojis = getEmojis(message, emojis);
  }
  if (actions.length) {
    postData.messages[0].quickReply = {
      'items': actions,
    }
  }
  return postData;
}

/**
 * スタンプメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#sticker-message
 * @param token チャネルトークン
 * @param replyToken リプライトークン
 * @param packageId スタンプセットのパッケージID
 * @param stickerId スタンプID
 * @return HTTPレスポンスデータ
 */
function replyStamp(token, replyToken, packageId, stickerId) {
  return reply(token, replyToken, getStampData(packageId, stickerId));
}
/**
 * スタンプメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#sticker-message
 * @param token チャネルトークン
 * @param userId ユーザID
 * @param packageId スタンプセットのパッケージID
 * @param stickerId スタンプID
 * @return HTTPレスポンスデータ
 */
function postStamp(token, userId, packageId, stickerId) {
  return push(token, userId, getStampData(packageId, stickerId));
}
/**
 * 送信するスタンプメッセージデータを生成します。
 * @param packageId スタンプセットのパッケージID
 * @param stickerId スタンプID
 * @return メッセージデータ
 */
function getStampData(packageId, stickerId) {
  return {
    'messages': [
      {
        'type': 'sticker',
        'packageId': packageId,
        'stickerId': stickerId,
      }
    ]
  };
}

/**
 * 確認テンプレートメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#template-messages
 * @param token チャネルトークン
 * @param replyToken リプライトークン
 * @param altText 代替テキスト
 * @param text メッセージテキスト
 * @param actions アクションオブジェクト配列（最大アクション数：2）
 * @return HTTPレスポンスデータ
 */
function replyConfirm(token, replyToken, altText, text, actions) {
  return reply(token, replyToken, getConfirmData(altText, text, actions));
}
/**
 * 確認テンプレートメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#template-messages
 * @param token チャネルトークン
 * @param userId ユーザID
 * @param altText 代替テキスト
 * @param text メッセージテキスト
 * @param actions アクションオブジェクト配列（最大アクション数：2）
 * @return HTTPレスポンスデータ
 */
function postConfirm(token, userId, altText, text, actions) {
  return push(token, userId, getConfirmData(altText, text, actions));
}
/**
 * 送信する確認テンプレートメッセージデータを生成します。
 * @param altText 代替テキスト
 * @param text メッセージテキスト
 * @param actions アクションオブジェクト配列（最大アクション数：2）
 * @return メッセージデータ
 */
function getConfirmData(altText, text, actions) {
  return {
    'messages': [
      {
        'type': 'template',
        'altText': altText,
        'template': {
          'type': 'confirm',
          'text': text,
          'actions': actions
        },
      }
    ]
  };
}

/**
 * ボタンテンプレートメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#buttons
 * @param token チャネルトークン
 * @param replyToken リプライトークン
 * @param altText 代替テキスト
 * @param thumbnailImageUrl 画像URL
 * @param title タイトル
 * @param text メッセージテキスト
 * @param actions アクションオブジェクト配列（最大アクション数：4）
 * @return HTTPレスポンスデータ
 */
function replyButton(token, replyToken, altText, thumbnailImageUrl, title, text, actions) {
  return reply(token, replyToken, getButtonData(altText, thumbnailImageUrl, title, text, actions));
}
/**
 * ボタンテンプレートメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#buttons
 * @param token チャネルトークン
 * @param userId ユーザID
 * @param altText 代替テキスト
 * @param thumbnailImageUrl 画像URL
 * @param title タイトル
 * @param text メッセージテキスト
 * @param actions アクションオブジェクト配列（最大アクション数：4）
 * @return HTTPレスポンスデータ
 */
function postButton(token, userId, altText, thumbnailImageUrl, title, text, actions) {
  return push(token, userId, getButtonData(altText, thumbnailImageUrl, title, text, actions));
}
/**
 * 送信するボタンテンプレートメッセージデータを生成します。
 * @param altText 代替テキスト
 * @param thumbnailImageUrl 画像URL
 * @param title タイトル
 * @param text メッセージテキスト
 * @param actions アクションオブジェクト配列（最大アクション数：4）
 * @return メッセージデータ
 */
function getButtonData(altText, thumbnailImageUrl, title, text, actions) {
  const postData = {
    'messages': [
      {
        'type': 'template',
        'altText': altText,
        'template': {
          'type': 'buttons',
          'thumbnailImageUrl': thumbnailImageUrl,
          'imageBackgroundColor': IMAGE_BACKGROUND_COLOR,
          'text': text,
          'actions': actions,
        },
      }
    ]
  };
  if (title) {
    postData.messages[0].template.title = title;
  }
  return postData;
}

/**
 * カルーセルテンプレートメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#carousel
 * @param token チャネルトークン
 * @param replyToken リプライトークン
 * @param altText 代替テキスト
 * @param columns カラムオブジェクト配列（最大カラム数：10）
 * @return HTTPレスポンスデータ
 */
function replyCarousel(token, replyToken, altText, columns) {
  return reply(token, replyToken, getCarouselData(altText, columns));
}
/**
 * カルーセルテンプレートメッセージを送信します。
 * https://developers.line.biz/ja/reference/messaging-api/#carousel
 * @param token チャネルトークン
 * @param userId ユーザID
 * @param altText 代替テキスト
 * @param columns カラムオブジェクト配列（最大カラム数：10）
 * @return HTTPレスポンスデータ
 */
function postCarousel(token, userId, altText, columns) {
  return push(token, userId, getCarouselData(altText, columns));
}
/**
 * カラムオブジェクトを生成します。
 * @param thumbnailImageUrl 画像URL
 * @param title タイトル
 * @param text メッセージテキスト
 * @param actions アクションオブジェクト配列（最大アクション数：3）
 * @return カラムオブジェクト
 */
function getCarouselColumn(thumbnailImageUrl, title, text, actions) {
  const columnData = {
    'thumbnailImageUrl': thumbnailImageUrl,
    'imageBackgroundColor': IMAGE_BACKGROUND_COLOR,
    'text': text,
    'actions': actions,
  };
  if (title) {
    columnData.title = title;
  }
  return columnData;
}
/**
 * 送信するカルーセルテンプレートメッセージデータを生成します。
 * @param altText 代替テキスト
 * @param columns カラムオブジェクト配列（最大カラム数：10）
 * @return メッセージデータ
 */
function getCarouselData(altText, columns) {
  return {
    'messages': [
      {
        'type': 'template',
        'altText': altText,
        'template': {
          'type': 'carousel',
          'columns': columns,
        },
      }
    ]
  };
}

/**
 * 絵文字用JSONを取得します。
 * @param productId プロダクトID
 * @param emojiId 絵文字ID
 * @return 絵文字オブジェクト
 */
function getEmojiJson(productId, emojiId) {
  return {
    'productId': productId,
    'emojiId': emojiId,
  };
}

/**
 * クイックリプライ要素を生成します。
 * @param action アクション
 * @param imageUrl アイコンURL
 * @return クイックリプライアイテム
 */
function makeQuickReply(action, imageUrl = '') {
  const item = {
    'type': 'action',
    'action': action,
  };
  if (imageUrl) {
    item.imageUrl = imageUrl;
  }
  return item;
}

/**
 * メッセージテキストを取得します。
 * @param msg メッセージオブジェクト
 * @return メッセージテキスト
 */
function getMessage(msg) {
  if (typeof msg === 'string') return msg;
  return msg.join('\n');
}

function getEmojis(msg, emojis) {
  let idx = 0;
  for (let i = 0; i < emojis.length; i++) {
    idx = msg.indexOf('$', idx);
    if (idx === -1) throw new Error(`絵文字プレースホルダー "$" が不足しています（${i + 1}個目が見つかりません）`);
    emojis[i].index = idx++;
  }
  return emojis;
}

function reply(token, replyToken, postData) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  postData.replyToken = replyToken;
  return post(url, token, postData);
}

function push(token, userId, postData) {
  const url = 'https://api.line.me/v2/bot/message/push';
  postData.to = userId;
  return post(url, token, postData);
}

function post(url, token, postData) {
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': `Bearer ${token}`,
  };
  const options = {
    'method': 'post',
    'headers': headers,
    'payload': JSON.stringify(postData),
    'muteHttpExceptions': true,
  };
  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  if (code !== 200) {
    throw new Error(`LINE API Error: ${code} - ${res.getContentText()}`);
  }
  return res;
}
