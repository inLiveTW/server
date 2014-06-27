var async = require('async');
var https = require('https');

try {

  var DataBase = require('../class/initial.js');
  var Live = DataBase.Live;

  var Open = Live.Object.extend("open");
  var Chrome_Token = Live.Object.extend("chrome_token");

  var queRequest = function(task, cb) {
    var access = task.access;
    var token = task.token;
    var message = JSON.stringify({
      'channelId': token,
      'subchannelId': '0',
      'payload': new Buffer(JSON.stringify({
        'count': task.count || 0,
        'type': 'open'
      })).toString('base64')
    });

    var request = https.request({
      hostname: 'www.googleapis.com',
      path: '/gcm_for_chrome/v1/messages',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Content-Length': message.length,
          'Authorization': 'Bearer ' + access
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

  DataBase.getGoogleAccess(function(err, access){
    if (err) {
      throw 'Get Access Token Error:' + err;
    }else{
      var qOpen = new Live.Query(Open);
      qOpen.find({
        success: function(opens) {
          var count = opens.length;
          
          if (count < 1) {
            console.log('No new live! ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,''));
            process.exit(0);
          }

          async.eachSeries(opens, function (open, cb) {
            open.destroy({
              success: cb,
              error: cb
            });
          }, function () {
            var queue = [];
            var qToken = new Live.Query(Chrome_Token);
            qToken.limit(10000);
            qToken.find({
              success: function(tokens) {
                var len = tokens.length;
                if (len < 1) {
                  console.log('No device for push open:', count);
                }else{
                  console.log('Push start for open:', count, 'device:', len);
                  for (var i=0, len=tokens.length; i<len; i+=10) {
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
                        'count': count
                      }, function (err, task) {
                        console.log('completed!', task.token);
                        cb();
                      });
                    }, function () {
                      cb();
                    });
                  }, function () {
                    console.log('Push new live!', count, '>', new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,''));
                    process.exit(0);
                  });
                }
              },
              error: function(error) {
                console.log('Get Chrome Token Error: ', error.code, ' ', error.message);
                process.exit(0);
              }
            });
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