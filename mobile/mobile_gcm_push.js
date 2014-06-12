var async = require('async');
var gcm = require('node-gcm');

try {

  var DataBase = require('../class/initial.js');
  var Live = DataBase.Live;

  var Push = Live.Object.extend("push");
  var Android_Token = Live.Object.extend("android_token");

  var push_type = {
    'message': '即時訊息',
    'event': '事件提醒',
    'reporter': '公民記者',
    'live': '節目開播',
  }

  /**
   *  發送 GCM Request
   *  使用 Queue 機制, 每次只做1個Request, 每次間隔200ms
   */
  var queRequest = function (task, callback) {
    // 預設成功與失敗筆數皆為零
    task.success = 0;
    task.error = 0;

    try {
      var sender = new gcm.Sender(DataBase.Config.push.android);

      var message = new gcm.Message({
        collapseKey: task.type,
        data: {
          "title": task.title || '',
          "link": task.link || '',
          "message": task.message,
        }
      });

      // Token 為 Array, 每個token只重試3次
      sender.send(message, task.token, 3, function (err, result) {
        if (err) { 
          console.error('[GCM] Service send sender err', err);
        }else{
          var results = result.results;
          for (var i = 0, len = results.length; i < len; i++) {
            if( results[i].error ) {
              task.error += 1;
            }else{
              task.success += 1;
            }
          }
        };
        setTimeout(function(){
          callback(null, task);
        }, 200);
      });
    }
    catch(err){
      console.error('[GCM] Service send sender err', err);
      setTimeout(function(){
        callback(null, task);
      }, 200);
    }
  };

  /**
   *  發送 GCM Message
   *  使用 Queue 機制, 每次只做1個Message, 每次間隔500ms
   */
  var queMessage = function (task, cb) {
    var qToken = new Live.Query(Android_Token);
    qToken.equalTo("channel", task.type + '');
    qToken.limit(10000);
    qToken.find({
      success: function (tokens) {
        var count = tokens.length;
        if (count < 1) {
          console.log('No device: ', task.title, task.message);
          cb();
        }else{
          var queue = [];
          for (var i=0, len=tokens.length; i<len; i+=800) {
            var que = [];
            for (var j=0; j<800; j++){
              if ( tokens[i+j] ) {
                que.push(tokens[i+j].get('token'));
              }else{
                break;                
              }
            }
            queue.push(que);
          }

          async.eachSeries(queue, function (que, cb) {
            queRequest({
              'token': que,
              'title': '『' + (push_type[task.type] || '其他通知') + '』',
              'type': task.type,
              'message': task.message,
              'link': task.link,
            }, function (err, task) {
              console.log('Completed! Success:', task.success, 'Error:', task.error, 'Type:', task.type, 'Title:', task.title);
              cb();
            });
          }, function (err) {
            cb(null, task);
          });
        }
      },
      error: function (error) {
        console.log('Get Android Token Error: ', error.code, ' ', error.message);
        cb(null, task);
      }
    });
  };

  /**
   *  取得等待發送的Push Message
   */
  var qPush = new Live.Query(Push);
  // start datetime 必須大於 now
  qPush.lessThanOrEqualTo('start', new Date());
  // android 必須是空白未發送
  qPush.equalTo('android', undefined);
  qPush.find({
    success: function(pushs) {
      async.eachSeries(pushs, function (push, cb) {
        queMessage({
          'title': push.get('title'),
          'type': push.get('type'),
          'message': push.get('message'),
          'link': push.get('link'),
        }, function (err, task) {
          console.log('Push end: ', task.title, task.message);
          push.set('android', new Date());
          push.save(null, {
            success: function() {
              cb();
            },
            error: function(push, error) {
              console.log("Save push error:", error);
              cb();
            }
          });
        });
      }, function () {
        process.exit(0);
      });
    },
    error: function(error) {
      throw "Fetch Push Error: " + error.code + " " + error.message;
    }
  });

}
catch(err) {
  console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err);
}