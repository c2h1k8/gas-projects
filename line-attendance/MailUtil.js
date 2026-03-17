/**
 * メール送信ユーティリティ
 */
const MailUtil = (() => {
  /**
   * メール送信処理を行います。
   * @param {string} to 送信先
   * @param {string} subject 件名
   * @param {string} body 本文（署名なし）
   * @param {Blob} [attachments] 添付ファイル（省略可）
   * @return {boolean} 送信成功: true / 失敗: false
   */
  const send = (to, subject, body, attachments) => {
    const props = {
      from: Props.getValue(PKeys.ADDRESS_FROM),
      companyName: Props.getValue(PKeys.COMPANY_NAME),
      nameLast: Props.getValue(PKeys.NAME_LAST),
      nameFirst: Props.getValue(PKeys.NAME_FIRST),
      nameAlpha: Props.getValue(PKeys.NAME_ALPHA),
      postCd: Props.getValue(PKeys.COMPANY_POST_CD),
      address: Props.getValue(PKeys.COMPANY_ADDRESS),
      tel: Props.getValue(PKeys.COMPANY_TEL),
      url: Props.getValue(PKeys.COMPANY_URL),
    };

    const mailOptions = {
      from: props.from,
      name: `${props.companyName} ${props.nameLast} ${props.nameFirst}`,
      bcc: props.from,
    };

    if (attachments) {
      mailOptions.attachments = attachments;
    }

    const recipient = JSON.parse(to).join(',');
    const fullBody = body + buildSignature(props);

    try {
      GmailApp.sendEmail(recipient, subject, fullBody, mailOptions);
      return true;
    } catch (e) {
      console.error('メール送信失敗:', e);
      return false;
    }
  };

  /**
   * メール署名を生成します。
   * @param {Object} p プロパティ情報オブジェクト
   * @return {string} 署名文字列
   */
  const buildSignature = (p) => {
    return [
      '',
      '╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋',
      `╋┿╋┿　　${p.companyName}`,
      `╋┿╋　　　${p.nameLast} ${p.nameFirst} / ${p.nameAlpha}`,
      `╋┿　　　　${p.postCd}`,
      `╋　　　　　${p.address}`,
      `╋　　　　　TEL: ${p.tel}`,
      `╋　　　　　Email: ${p.from}`,
      `╋　　　　　URL: ${p.url}`,
      '╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋'
    ].join('\n');
  };

  return { send };
})();
