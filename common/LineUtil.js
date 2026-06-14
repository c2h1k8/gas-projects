const LineUtil = (function () {
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
   * Flexメッセージを送信します（リプライ）。
   * https://developers.line.biz/ja/reference/messaging-api/#flex-message
   * @param token チャネルトークン
   * @param replyToken リプライトークン
   * @param altText 代替テキスト
   * @param contents Flexコンテンツ（bubble または carousel）
   * @return HTTPレスポンスデータ
   */
  function replyFlex(token, replyToken, altText, contents) {
    return reply(token, replyToken, getFlexData(altText, contents));
  }
  /**
   * Flexメッセージを送信します（プッシュ）。
   * @param token チャネルトークン
   * @param userId ユーザID
   * @param altText 代替テキスト
   * @param contents Flexコンテンツ（bubble または carousel）
   * @return HTTPレスポンスデータ
   */
  function postFlex(token, userId, altText, contents) {
    return push(token, userId, getFlexData(altText, contents));
  }
  /**
   * 送信するFlexメッセージデータを生成します。
   * @param altText 代替テキスト
   * @param contents Flexコンテンツ
   * @return メッセージデータ
   */
  function getFlexData(altText, contents) {
    return {
      'messages': [
        {
          'type': 'flex',
          'altText': altText,
          'contents': contents,
        }
      ]
    };
  }
  /**
   * postbackアクションを生成します。
   * @param label ボタンラベル（最大20文字）
   * @param data postbackデータ（最大300文字）
   * @param displayText タップ時にトークに表示するテキスト（任意）
   * @return アクションオブジェクト
   */
  function makePostbackAction(label, data, displayText = '') {
    const action = {
      'type': 'postback',
      'label': label,
      'data': data,
    };
    if (displayText) action.displayText = displayText;
    return action;
  }
  /**
   * ボタンをグリッド配置したFlex bubbleを生成します。
   * @param title 見出しテキスト
   * @param buttons ボタン配列 [{ label, data, displayText }]
   * @param columns 1行あたりのボタン数（既定3）
   * @return Flex bubble
   */
  function getFlexButtonGrid(title, buttons, columns = 3) {
    const rows = [];
    for (let i = 0; i < buttons.length; i += columns) {
      const rowContents = buttons.slice(i, i + columns).map((b) => ({
        'type': 'button',
        'style': 'secondary',
        'height': 'sm',
        'action': makePostbackAction(b.label, b.data, b.displayText),
      }));
      while (rowContents.length < columns) {
        rowContents.push({ 'type': 'filler' });
      }
      rows.push({ 'type': 'box', 'layout': 'horizontal', 'spacing': 'sm', 'contents': rowContents });
    }
    return {
      'type': 'bubble',
      'body': {
        'type': 'box',
        'layout': 'vertical',
        'spacing': 'md',
        'contents': [
          { 'type': 'text', 'text': title, 'weight': 'bold', 'size': 'md', 'wrap': true },
          { 'type': 'box', 'layout': 'vertical', 'spacing': 'sm', 'contents': rows },
        ],
      },
    };
  }

  /**
   * リッチメニュー一覧を取得します。
   */
  function getRichMenuList(token) {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/richmenu/list', {
      'method': 'get',
      'headers': { 'Authorization': `Bearer ${token}` },
      'muteHttpExceptions': true,
    });
    return JSON.parse(res.getContentText()).richmenus || [];
  }
  /**
   * リッチメニューを作成し richMenuId を返します。
   */
  function createRichMenu(token, richMenu) {
    const res = post('https://api.line.me/v2/bot/richmenu', token, richMenu);
    return JSON.parse(res.getContentText()).richMenuId;
  }
  /**
   * リッチメニューを削除します。
   */
  function deleteRichMenu(token, richMenuId) {
    return UrlFetchApp.fetch(`https://api.line.me/v2/bot/richmenu/${richMenuId}`, {
      'method': 'delete',
      'headers': { 'Authorization': `Bearer ${token}` },
      'muteHttpExceptions': true,
    });
  }
  /**
   * リッチメニューに画像を設定します。
   * @param blob 画像Blob（image/png または image/jpeg、サイズはメニューと一致）
   */
  function uploadRichMenuImage(token, richMenuId, blob) {
    const url = `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`;
    const res = UrlFetchApp.fetch(url, {
      'method': 'post',
      'headers': { 'Authorization': `Bearer ${token}` },
      'contentType': blob.getContentType(),
      'payload': blob.getBytes(),
      'muteHttpExceptions': true,
    });
    if (res.getResponseCode() !== 200) {
      throw new Error(`uploadRichMenuImage: ${res.getResponseCode()} - ${res.getContentText()}`);
    }
    return res;
  }
  /**
   * リッチメニューエイリアスを作成します。
   */
  function createRichMenuAlias(token, aliasId, richMenuId) {
    return post('https://api.line.me/v2/bot/richmenu/alias', token, {
      'richMenuAliasId': aliasId,
      'richMenuId': richMenuId,
    });
  }
  /**
   * リッチメニューエイリアスを削除します。
   */
  function deleteRichMenuAlias(token, aliasId) {
    return UrlFetchApp.fetch(`https://api.line.me/v2/bot/richmenu/alias/${aliasId}`, {
      'method': 'delete',
      'headers': { 'Authorization': `Bearer ${token}` },
      'muteHttpExceptions': true,
    });
  }
  /**
   * 全ユーザーのデフォルトリッチメニューを設定します。
   */
  function setDefaultRichMenu(token, richMenuId) {
    const res = UrlFetchApp.fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
      'method': 'post',
      'headers': { 'Authorization': `Bearer ${token}` },
      'muteHttpExceptions': true,
    });
    if (res.getResponseCode() !== 200) {
      throw new Error(`setDefaultRichMenu: ${res.getResponseCode()} - ${res.getContentText()}`);
    }
    return res;
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

  return {
    replyText,
    postText,
    replyQuickText,
    postQuickText,
    getTextData,
    replyStamp,
    postStamp,
    getStampData,
    replyConfirm,
    postConfirm,
    getConfirmData,
    replyButton,
    postButton,
    getButtonData,
    replyCarousel,
    postCarousel,
    getCarouselColumn,
    getCarouselData,
    getEmojiJson,
    makeQuickReply,
    replyFlex,
    postFlex,
    getFlexData,
    makePostbackAction,
    getFlexButtonGrid,
    getRichMenuList,
    createRichMenu,
    deleteRichMenu,
    uploadRichMenuImage,
    createRichMenuAlias,
    deleteRichMenuAlias,
    setDefaultRichMenu,
  };
})();
