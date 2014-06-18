var async = require('async');
var apn = require('apn');

try {

  var DataBase = require('../class/initial.js');
  var Live = DataBase.Live;

  var Push = Live.Object.extend("push");
  var Ios_Token = Live.Object.extend("ios_token");

  var push_type = {
    'message': '即時訊息',
    'event': '事件提醒',
    'reporter': '公民記者',
    'live': '節目開播',
  }

  var pwd = process.argv[1];
  pwd = pwd.substr(0, pwd.lastIndexOf('/'));

  var queRequest = function (task, cb) {
    // 預設成功與失敗筆數皆為零
    task.success = 0;
    task.error = 0;
    var completed = null;

    var service = new apn.Connection({
      address: 'gateway.push.apple.com',
      // gateway: 'gateway.sandbox.push.apple.com',
      cert: '../config/apns_production.pem',
      key: '../config/apns_production.pem'
    });

    service
    .on('connected', function() {
      console.log("APNS Service Connected");
    })
    .on('timeout', console.error)
    .on('disconnected', console.error)
    .on('socketError', console.error);

    service
    .on('transmitted', function(notification, device) {
        if ( completed ) {
            clearTimeout(completed);
        }
        task.success += 1;
        completed = setTimeout(function(){
            cb(null, task);
        }, 1000);
    })
    .on('transmissionError', function(errCode, notification, device) {
        if ( completed ) {
            clearTimeout(completed);
        }
        task.succes -= 1;
        task.error += 1;
        completed = setTimeout(function(){
            cb(null, task);
        }, 1000);
    });

    var note = new apn.notification();

    note.expiry = Math.floor(Date.now() / 1000) + 3600;
    note.alert = task.title + "\n" + task.message;
    note.payload = {'link': task.link};

    service.pushNotification(note, task.token);
  };


  var queMessage = function (task, cb) {
    var qToken = new Live.Query(Ios_Token);
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
            for (var j=0; j<1000; j++){
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
        cb();
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
  qPush.equalTo('ios', undefined);
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
          push.set('ios', new Date());
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
