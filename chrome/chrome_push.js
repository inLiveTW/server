var async = require('async');
var https = require('https');

try {

  var DataBase = require('../class/initial.js');
  var Live = DataBase.Live;

  var Push = Live.Object.extend("push");
  var Chrome_Token = Live.Object.extend("chrome_token");

  var push_type = {
    'message': '即時訊息',
    'event': '事件提醒',
    'reporter': '公民記者',
    'live': '節目開播',
  }

  var queRequest = function(task, cb) {
    var message = JSON.stringify({
      'channelId': task.token,
      'subchannelId': '0',
      'payload': new Buffer(JSON.stringify({
        'type': task.type || 'message',
        'link': task.link || '',
        'title': '『' + (push_type[task.type] || '其他通知') + '』',
        'message': (task.message || '') + "\n- " + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'')
      })).toString('base64')
    });

    var request = https.request({
      hostname: 'www.googleapis.com',
      path: '/gcm_for_chrome/v1/messages',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Content-Length': message.length,
          'Authorization': 'Bearer ' + task.access,
      }
    }, function(res){
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        cb && cb(null, task);
      });
    });

    request.on('error', function(e) {
      cb && cb(e, task);
    });

    request.write(message);
    request.end();
  }

  var queMessage = function(msg, cb) {
    var qToken = new Live.Query(Chrome_Token);

    qToken.equalTo("channel", msg.type+'');
    qToken.limit(10000);
    qToken.find({
      success: function(tokens) {
        var len = tokens.length;
        if (len < 1) {
          console.log('No device: ', msg.message);
        }else{
          console.log('Push start: ', msg.message, 'device:', len);

          var queue = [];

          for (var i=0; i<len; i+=10) {
            var que = [];
            for (var j=0; j<10; j++) {
              tokens[i+j] && que.push(tokens[i+j].get('token'));
            }
            queue.push(que);
          };

          async.eachSeries(queue, function(tokens, cb) {
            async.each(tokens, function(token, cb) {
              queRequest({
                'access': access,
                'token': token,
                'message': msg.message,
                'link': msg.link,
                'type': msg.type,
              }, function (err, task) {
                console.log('completed!', task.token);
                cb(null);
              });
            }, cb);
          }, function () {
            console.log('Push end: ', msg.message);
            cb();
          });
        }
      },
      error: function(error) {
        console.log('Get Chrome Token Error: ', error.code, ' ', error.message);
        cb();
      }
    });
  }

  DataBase.getGoogleAccess(function(err, access){
    if (err) {
      throw 'Get Access Token Error:' + err;
    }else{
      var query = new Live.Query(Push);
      query.lessThanOrEqualTo('start', new Date());
      query.equalTo('chrome', undefined);
      query.find({
        success: function(pushs) {
          async.eachSeries(pushs, function (push, cb) {
            queMessage({
              "access": access,
              "type": push.get("type"),
              "link": push.get("link"),
              "message": push.get("message"),
            }, function (err, task){
              push.set('chrome', new Date());
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
  });
}
catch(err) {
  console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err);
}

// // JSON.parse(decodeURIComponent(escape(atob('eyJ0eXBlIjoibGl2ZSIsInVybCI6InVybCIsInRpdGxlIjoi5oiR5oSb5Y+w54GjIn0='))))