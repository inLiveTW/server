var async = require('async');
var https = require('https');

try {

  var DataBase = require('../class/initial.js');
  var Live = DataBase.Live;

  var Push = Live.Object.extend("push");
  var Chrome_Token = Live.Object.extend("chrome_token");

  var sendNotify = function(task, cb) {
    var access = task.access;
    var token = task.token;
    var message = JSON.stringify({
      'channelId': token,
      'subchannelId': '0',
      'payload': new Buffer(JSON.stringify({
        'type': task.type || 'message',
        'link': task.link || '',
        'title': task.title || '',
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

  var queue = async.queue(function (task, callback) {
    sendNotify(task, callback);
  }, 5);

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
            var qToekn = new Live.Query(Chrome_Token);
                qToekn.equalTo("channel", push.get('type')+'');
                qToken.limit(10000);
                qToekn.find({
                  success: function(tokens) {
                    var count = tokens.length;
                    if (count < 1) {
                      console.log('No device: ', push.get('title'), push.get('message'));
                      push.set('chrome', new Date());
                      push.save().then(cb, cb);
                    }else{
                      console.log('Push start: ', push.get('title'), push.get('message'));
                      tokens.forEach(function(token){
                        queue.push({
                            'access': access,
                            'token': token.get('token'),
                            'title': push.get('title'),
                            'message': push.get('message'),
                            'link': push.get('link'),
                            'type': push.get('type')
                          }, function (err, task) {
                            console.log('completed!', task.token);
                            count -= 1;
                            if ( count < 1 ) {
                              console.log('Push end: ', push.get('title'), push.get('message'));
                              push.set('chrome', new Date());
                              push.save().then(cb, cb);
                            }
                        });
                      });
                    }
                  },
                  error: function(error) {
                    console.log('Get Chrome Token Error: ', error.code, ' ', error.message);
                    cb();
                  }
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