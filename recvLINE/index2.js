'use strict';
const AWS = require("aws-sdk");
const line = require('@line/bot-sdk');
const crypto = require('crypto');
const client = new line.Client({channelAccessToken: process.env.ACCESSTOKEN});
const WebSocket = require('ws');

const dynamo_tableName = 'LINEMessageForGoogleHome';

const dynamo = new AWS.DynamoDB({
    region: 'ap-northeast-1',
    apiVersion: '2012-08-10',
    accessKeyId: process.env.DYNAMO_API_ACCESS_KEY,
    secretAccessKey: process.env.DYNAMO_USER_SECRET_ACCESS_KEY
});

exports.handler = function (event, context) {
 let signature = crypto.createHmac('sha256', process.env.CHANNELSECRET).update(event.body).digest('base64');
 let checkHeader = (event.headers || {})['X-Line-Signature'];
 let body = JSON.parse(event.body);
 let messageData = event.events && event.events[0];
 //let source = messageData.source;

 if (signature === checkHeader) {
  if (body.events[0].replyToken === '00000000000000000000000000000000') { //接続確認エラー回避
   let lambdaResponse = {
    statusCode: 200,
    headers: { "X-Line-Status" : "OK"},
    body: '{"result":"connect check"}'
   };
   context.succeed(lambdaResponse);
  } else {
   let text = body.events[0].message.text;
   var message = {
    'type': 'text',
    'text': text
   };
   // スタンプの場合はメッセージを応答
   if (body.events[0].message.type != 'text') {
     message.text = 'スタンプや絵文字には対応してませんよ'
   }

   // DynamoDBへのメッセージデータ追加
   //const userId = source.userId;
   var insert_params = {
     TableName: dynamo_tableName,
     Item: {
       message_id: {
            S: '_' + Date.now(),
       },
       type: {
            S: body.events[0].message.type
       },
       text: {
            S: text
       }
     }
   };
   //Dynamo DBへのデータ追加
   dynamo.putItem(insert_params, function(err, data) {
    if (err) {
        console.error("Error occured", err);
    }
    console.error(data);
   });

   //websocket へのメッセージ送信
   const ws = new WebSocket('wss://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/stg');
  
   ws.on('open', () => {
    ws.send('{"action":"sendmessage", "data":"' + text + '"}');
   });


   client.replyMessage(body.events[0].replyToken, message)
   .then((response) => { 
    let lambdaResponse = {
     statusCode: 200,
     headers: { "X-Line-Status" : "OK"},
     body: '{"result":"completed"}'
    };
    context.succeed(lambdaResponse);
   }).catch((err) => console.log(err));
  }
 }else{
  console.log('署名認証エラー');
 }
};