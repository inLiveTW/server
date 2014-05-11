var http = require('http'),
    async = require('async'),
    fs = require('fs'),
    exec = require('child_process').exec,
    uuid = require('node-uuid'),
    time = require('time');

var Live = require('parse').Parse;
var Firebase = require('firebase');
try {

  var pwd = process.argv[1];
  pwd = pwd.substr(0, pwd.lastIndexOf('/'));

  if ( !fs.existsSync(pwd + '/database.json') ) {
      fs.linkSync(pwd + '/database-sample.json', pwd + '/database.json');
  }

  var cfg = require(pwd + '/database.json');

  Live.initialize(cfg.live.appid, cfg.live.key, cfg.live.master);
  Live.Cloud.useMasterKey();

  var Channel = Live.Object.extend("channel");

  var db_firebase = new Firebase(cfg.release.host);
  db_firebase.auth(cfg.release.token, function(error, result) {
    if(error) {
      throw "Login Failed!" + error;
    }
  });

  var fetch = {
      'youtube': function(id, cb) {
          http.get('http://gdata.youtube.com/feeds/api/users/' + id + '?v=2&status=active&alt=json', function(res) {
            var body = '';
            var active = [];
            res.on('data', function(chunk) {
              body += chunk;
            });
            res.on('end', function() {
              body = JSON.parse(body);
              if ( body.entry ) {
                var cid = /user:(\w+)/.exec(body.entry.id.$t);
                cb(null, [{
                  'type': 'youtube',
                  'title': body.entry.title.$t,
                  'cid': cid && cid[1],
                  'logo': body.entry.media$thumbnail.url,
                  'url': body.entry.link[0].href
                }]);
              }else{
                cb(null, []);
              }
            });
          }).on('error', function(e) {
              cb(null, []);
          });
      },
      'ustream': function(id, cb){
          http.get('http://api.ustream.tv/json?subject=channel&uid=' + id + '&command=getInfo', function(res) {
            var body = '';
            var live = [];
            res.on('data', function(chunk) {
              body += chunk;
            });
            res.on('end', function() {
              body = JSON.parse(body);
              if (body.results.status == 'live') {
                  live.push({
                      'type': 'ustream',
                      'title': body.results.title,
                      'cid': body.results.id,
                      'url': 'http://www.ustream.tv/channel/' + body.results.id,
                      'logo': body.results.imageUrl && body.results.imageUrl.small
                  });
              }

              cb(null, live);
            });
          }).on('error', function(e) {
              cb(null, []);
          });
      },
      'ustream_user': function(id, cb){
          http.get('http://api.ustream.tv/json?subject=user&uid=' + id + '&command=listAllChannels', function(res) {
            var body = '';
            var live = [];
            res.on('data', function(chunk) {
              body += chunk;
            });
            res.on('end', function() {
              body = JSON.parse(body);
              body.results.forEach(function(channel){
                  if (channel.isProtected == false) {
                      live.push({
                          'type': 'ustream',
                          'title': channel.title,
                          'cid': channel.id,
                          'url': 'http://www.ustream.tv/channel/' + channel.id,
                          'logo': channel.imageUrl && channel.imageUrl.small
                      });
                  }
              });

              cb(null, live);
            });
          }).on('error', function(e) {
              cb(null, []);
          });
      }
  }


  var query = new Live.Query(Channel);
  var parser = function (cb){
      now = new time.Date().setTimezone('Asia/Taipei');

      query.find({
          success: function(channel) {
              async.map(channel, function(item, cb){
                  if ( fetch[item.attributes.type] ) {
                      fetch[item.attributes.type](item.attributes.uid, cb);
                  }else{
                      cb(null, []);
                  }
              }, function (err, results) {
                  var count = 0;
                  var public_channel = [];

                  results.forEach(function(source, index){
                      source.forEach(function(item){
                          var name = (item.type=='youtube' ? 'y_' : 'u_')+item.cid;
                          public_channel[name] = {};
                          for (key in item) {
                              public_channel[name][key] = item[key];
                          }
                          public_channel[name]['logo'] = item.logo || channel[index].attributes.logo;
                          count += 1;
                      });
                  });
                  db_firebase.child('channel').set(public_channel, function(){
                    cb && cb(count);
                  });
              });
          },
          error: function(error) {
              throw "Fetch Channel Error: " + error.code + " " + error.message;
          }
      });
  }

  parser(function (count) {
      console.log(new time.Date().setTimezone('Asia/Taipei').toLocaleTimeString() + ' Channel Run! ' + count);
      process.exit(0);
  });

}
catch(err) {
    console.log('ERROR( ' + new time.Date().setTimezone('Asia/Taipei').toLocaleTimeString() + ' ): ' + err);
}