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
    } else {
      console.log('Authenticated successfully with payload:', result.auth);
      console.log('Auth expires at:', new Date(result.expires * 1000));
    }
  });

  var fetch = {
      'youtube': function(id, cb) {
      },
      'ustream': function(id, cb){
      },
      'ustream_user': function(id, cb){
      }
  }


  var query = new Live.Query(Channel);
  var parser = function (cb){
      now = new time.Date().setTimezone('Asia/Taipei');

      query.find({
          success: function(channel) {
              async.parallel({
                  'database': function(cb){
                      db_firebase.child('live').once('value', function(live) {
                          var db = live.val();
                          for (key in db)
                          {
                              db[key].status = 'offlive';
                          }
                          cb(null, db || {});
                      })
                  },
                  'live': function(cb){
                      async.map(channel, function(item, cb){
                          if ( fetch[item.attributes.type] ) {
                              fetch[item.attributes.type](item.attributes.uid, cb);
                          }else{
                              cb(null, []);
                          }
                      }, function (err, results) {
                          cb(null, results);
                      });
                  }
              }, function (err, results) {
                  var count = 0;
                  var updated_at = Math.floor(Date.now() / 1000);
                  var live = results['database'] || {};
                  var new_live = [];


                  results['live'].forEach(function(source, index){
                      source.forEach(function(active){
                          var name = (active.type=='youtube' ? 'y_' : 'u_')+active.vid;
                          if ( !live[name] ) {
                              live[name] = {
                                  'vuid': uuid.v4()
                              };
                              new_live.push(active);
                          }
                          for (key in active) {
                              live[name][key] = active[key];
                          }
                          live[name]['logo'] = active.thumb || channel[index].attributes.logo;
                          live[name]['status'] = 'live';
                          live[name].updated_at = updated_at;
                          count += 1;
                      });
                  });
                  for (key in live)
                  {
                      if ( (live[key].updated_at + 15 * 60) < updated_at ) {
                          delete live[key];
                      }
                  }
                  db_firebase.child('live').set(live, function(){
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
      exec('echo ' + new time.Date().setTimezone('Asia/Taipei').toLocaleTimeString() + ' Live Run! ' + count + ' >> /var/log/serv_live.log')
      process.exit(0);
  });

}
catch(err) {
    exec('echo ERROR( ' + new time.Date().setTimezone('Asia/Taipei').toLocaleTimeString() + ' ): ' + err + ' >> /var/log/serv_live.log')
    console.log('ERROR( ' + new time.Date().setTimezone('Asia/Taipei').toLocaleTimeString() + ' ): ' + err)
}