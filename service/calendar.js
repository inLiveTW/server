var https = require('https'),
    async = require('async'),
    fs = require('fs'),
    exec = require('child_process').exec,
    uuid = require('node-uuid'),
    time = require('time');
    
var graph = require('fbgraph');

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
  var Fbevent = Live.Object.extend("fbevent");
  var query = new Live.Query(Fbevent);

  graph.setAccessToken(cfg.fbevent.fbtoken);

  var liveDB = new Firebase(cfg.release.host);
  liveDB.auth(cfg.release.token, function(error, result) {
    if(error) {
      console.log("Login Failed!", error);
    } else {
      console.log('Authenticated successfully with payload:', result.auth);
      console.log('Auth expires at:', new Date(result.expires * 1000));
    }
  });

  var parser = function (cb){
    var now = new time.Date().setTimezone('Asia/Taipei');
    var date = new Date().toISOString().replace(/T.*/gi, '');

    var source = [
      'https://www.googleapis.com/calendar/v3/calendars/9dvlo755f8c5lbcs9eu9hfd1g0%40group.calendar.google.com/events?key=AIzaSyBqSFbeQLYKQl80FblMuj682zvpbpPVG_o&timeZone=Asia/Taipei&timeMin=' + date + 'T00:00:00.000Z',
      'https://www.googleapis.com/calendar/v3/calendars/s6jage479tquhj3mr7abhecs48%40group.calendar.google.com/events?key=AIzaSyBqSFbeQLYKQl80FblMuj682zvpbpPVG_o&timeZone=Asia/Taipei&timeMin=' + date + 'T00:00:00.000Z'
    ];

    async.parallel({
        'google': function(cb){
          async.map(source, function (url, cb) {
            https.get(url, function(res) {
              var body = '';
              res.on('data', function(chunk) {
                body += chunk;
              });
              res.on('end', function() {
                var list = JSON.parse(body).items || [];
                cb(null, list);
              });
            }).on('error', function(e) {
              cb(null, []);
            });
          }, cb);
        },
        'facebook': function(cb){
          query.find({
            success: function(results) {
              var data = [];
              async.each(results, function(item, cb){
                graph.get(item.attributes.eid, function(err, res) {
                  if (new Date(res.start_time).getTime() > new Date().getTime() + ( 16 * 60 * 60 * 1000 )) {
                    data.push(res);
                  }
                  cb(null);
                });
              }, function () {
                cb(null, data);
              });
            },
            error: function(error) {
              console.log(error);
              cb(null, []);
            }
          });
        }
    }, function (err, results) {
      var events = {};
      results['google'].forEach(function(list){
        list.forEach(function(item){
          events['google_' + item.id] = {
            'type': 'google',
            'day': item.start.date ? true : false,
            'start': (item.start.date ? item.start.date + 'T00:00:00+08:00' : item.start.dateTime) || '',
            'end': (item.start.date ? item.end.date + 'T00:00:00+08:00' : item.end.dateTime) || '',
            'title': item.summary || '',
            'location': item.location || '',
            'link': item.htmlLink
          };
        });
      });
      results['facebook'].forEach(function(item){
        events['facebook_' + item.id] = {
          'type': 'facebook',
          'day': item.is_date_only,
          'start': (item.is_date_only ? item.start_time + 'T00:00:00+08:00' : (item.start_time+'').replace(/\+0800$/,'+08:00')) || '',
          'end': (item.is_date_only ? item.end_time + 'T00:00:00+08:00' : (item.end_time+'').replace(/\+0800$/,'+08:00')) || '',
          'title': item.name || '',
          'location': item.location || '',
          'link': 'https://www.facebook.com/' + item.id + '/'
        };
      });
      liveDB.child('event').set(events, cb);
    });
  };

  parser(function () {
      exec('echo ' + new time.Date().setTimezone('Asia/Taipei').toLocaleTimeString() + 'Calendar Run! >> /var/log/serv_calendar.log')
      process.exit(0);
  });

}
catch(err) {
    exec('echo ERROR( ' + new time.Date().setTimezone('Asia/Taipei').toLocaleTimeString() + ' ): ' + err + ' >> /var/log/serv_calendar.log')
    console.log('ERROR( ' + new time.Date().setTimezone('Asia/Taipei').toLocaleTimeString() + ' ): ' + err)
}
