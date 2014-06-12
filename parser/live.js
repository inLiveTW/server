var http = require('http');
var async = require('async');
var uuid = require('node-uuid');
var time = require('time');
var exec = require('child_process').exec;
var GSpreadsheet = require('gspreadsheet');

var radix62 = [
  '0','1','2','3','4','5','6','7','8','9',
  'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
]

var color = {
  '1': '16A085',
  '認證': '27AE60',
  '攝護線': '2980B9',
  '2': '8E44AD',
  '3': 'F39C12',
  'NGO': 'D35400',
  '4': 'C0392B',
  'other': '2C3E50',
}

try {

  var gspreadsheet = new GSpreadsheet('1LN0qN4NmaRYByW-VMywEneVYovCIt8ExpinZRhJDuKw', '0');

  var DataBase = require('../class/initial.js');
  var Live = DataBase.Live;
  var Mobile = DataBase.Mobile;
  var Release = DataBase.Release;

  var Channel = Live.Object.extend("channel");
  var Open = Live.Object.extend("open");
  var Live_Location = Live.Object.extend("live_location");
  var Mobile_Location = Mobile.Object.extend("live_location");

  var parse62 = function(num){
    var remain = num % 62;
    if ( num <= 0 ) {
      return '';
    }else{
      return parse62( (num-remain) / 62 ) + radix62[remain];
    }
  }

  var fetch = {
      'youtube': function(id, cb) {
          http.get('http://gdata.youtube.com/feeds/api/users/' + id + '/live/events?v=2&status=active&alt=json', function(res) {
            var body = '';
            var active = [];
            res.on('data', function(chunk) {
              body += chunk;
            });
            res.on('end', function() {
              body = JSON.parse(body);
              if (body.feed.entry) {
                  // youtube-dl --get-url VTPUaMojM1o
                  for (var i = 0, len = body.feed.entry.length; i < len; i++) {
                      var vid = /videos\/([\w-_]+)/.exec(body.feed.entry[i].content.src)[1];
                      active.push({
                          type: 'youtube',
                          title: body.feed.entry[i].title.$t,
                          cid: id,
                          vid: 'y_' + vid,
                          user: id,
                          url: 'https://www.youtube.com/watch?v=' + vid,
                          embed: 'http://www.youtube.com/embed/' + vid + '?autoplay=1',
                          shorten: 'http://youtu.be/' + vid,
                      });
                  };
              }

              cb(null, active);
            });
          }).on('error', function(e) {
              cb(null, []);
          });
      },
      'ustream': function(id, cb){
          http.get('http://api.ustream.tv/json?subject=user&uid=' + id + '&command=listAllChannels', function(res) {
            var body = '';
            var live = [];
            res.on('data', function(chunk) {
              body += chunk;
            });
            res.on('end', function() {
              body = JSON.parse(body);
              body.results.forEach(function(channel){
                  if (channel.status == 'live') {
                      live.push({
                          type: 'ustream',
                          title: channel.title,
                          cid: id,
                          vid: 'u_' + channel.id,
                          user: id,
                          url: 'http://www.ustream.tv/channel/' + channel.id,
                          embed: 'http://www.ustream.tv/embed/' + channel.id + '?wmode=direct&autoplay=true',
                          thumb: channel.imageUrl.small,
                          shorten: 'http://ustre.am/' + parse62(channel.id),
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

  var getHighest = function (list, deft){
    var win = null, vote = 0;
    for (name in list) {
      if ( list[name] > vote ) {
        win = name;
        vote = list[name];
      }else if ( list[name] == vote && deft != name ){
        win = deft;
      }
    };
    return win;
  }

  gspreadsheet.getJSON(function (res) {
    if (res && res.result && res.result.length ) {
      var channel = res.result;
      async.parallel({
          // 取得使用者回饋的位置資訊
          'location': function(cb){
            var temp = {};
            var query = new Mobile.Query(Mobile_Location);
            query.find({
              success: function(results) {
                async.each(results, function(obj, cb){
                  if ( ! temp[obj.get('vuid')] ) {
                    temp[obj.get('vuid')] = {};
                  }
                  temp[obj.get('vuid')][obj.get('location')] = (temp[obj.get('vuid')][obj.get('location')] || 0) + 1;
                  obj.destroy({
                    'success': function(){ cb(); },
                    'error': function(){ cb(); }
                  });
                }, function(){
                  cb && cb(null, temp);
                });
              },
              error: function(error) {
                console.log("Fetch Mobile Location Error: " + error.code + " " + error.message);
              }
            });
          },
          // 取得已知的直播清單
          'database': function(cb){
              Release.child('live').once('value', function(live) {
                  var db = live.val();
                  for (key in db)
                  {
                      db[key].status = 'offlive';
                  }
                  cb(null, db || {});
              })
          },
          // 掃描正在直播的清單
          'live': function(cb){
              async.map(channel, function(item, cb){
                  if ( fetch[item.content.type] ) {
                      fetch[item.content.type](item.content.uid, cb);
                  }else{
                      cb(null, []);
                  }
              }, function (err, results) {
                  cb(null, results);
              });
          }
      }, function (err, results) {
        // 初始統計筆數
        var count = 0;
        // 資料更新的日期
        var updated_at = Math.floor(Date.now() / 1000);

        /**
         *  更新直播清單
         */

        // 已知清單
        var live = results['database'] || {};
        // 掃描到的清單
        var liveScan = results['live'];
        // 新的清單
        var liveNew = [];

        liveScan.forEach(function(src, index){
          var cnote = channel[index].content;
          src.forEach(function(active){
            // 新增新的直播
            if ( !live[active.vid] ) {
                live[active.vid] = {
                    'vuid': uuid.v4()
                };
                liveNew.push(live[active.vid]);
            }
            // 更新直播屬性
            for (key in active) {
                live[active.vid][key] = active[key];
            }
            live[active.vid]['logo'] = active.thumb || cnote.logo;
            live[active.vid]['tag'] = {};
            tags = (cnote.tag || '').split(",");
            tags.length && tags[0] && tags.forEach(function(tag){
              live[active.vid]['tag'][tag] = color[tag] || color['other'];
            });
            live[active.vid]['status'] = 'live';
            live[active.vid].updated_at = updated_at;
            // 增加筆數
          });
        });

        // 刪除已過期或停播的清單
        for (key in live)
        {
          if ( (live[key].updated_at + 5 * 60) < updated_at ) {
            delete live[key];
          }else{
            count += 1;
          }
        }

        async.parallel([
          function (cb) {
            /**
             *  更新直播位置
             */
            async.each(Object.keys(live), function(key, cb){
              var vuid = live[key]['vuid'];

              async.waterfall([
                // 取得已知的位置
                function (cb) {
                  var qLocation = new Live.Query(Live_Location);
                  qLocation.equalTo("vuid", vuid);

                  qLocation.first({
                    success: function(object) {
                      if ( object ) {
                        cb(true, object);
                      }else{
                        cb(null);
                      }
                    },
                    error: function(error) {
                      console.log("Location by vuid Error: " + error.code + " " + error.message);
                      cb(null);
                    }
                  });
                },
                // 建立新的位置
                function (cb) {
                  var object = new Live_Location();

                  // 參考之前位置
                  var query = new Live.Query(Live_Location);
                  query.equalTo("name", (live[key]['type']=='youtube' ? 'y_' : 'u_')+live[key]['vid']);

                  query.first({
                    success: function(parent) {
                      if ( parent ) {
                        parent = getHighest(parent.get('location'));
                        if ( parent ) {
                          var location = {};
                          location[parent] = 1;
                          object.set('location', location);
                        }
                      }
                      cb(null, object);
                    },
                    error: function(error) {
                      console.log("Location by name Error: " + error.code + " " + error.message);
                      cb(null, object);
                    }
                  });
                }], function (err, object) {
                  
                  var location = object.get('location') || {};

                  for (name in results['location'][vuid]){
                    location[name] = (location[name] || 0) + results['location'][vuid][name];
                  }

                  object.set('vuid', vuid);
                  object.set('name', (live[key]['type']=='youtube' ? 'y_' : 'u_')+live[key]['vid']);
                  object.set('location', location);

                  live[key]['location'] = getHighest(location);

                  object.save(null, {
                    'success': function(){ cb && cb(); },
                    'error': function(){ cb && cb(); }
                  });
                });
              }, cb);
          },
          function (cb) {
            async.each(Object.keys(live), function(key, cb){
              /**
               *  Get Stream URL
               */
              var video = live[key];

              if (!video['stream']) {
                switch(video['type']){
                  case 'youtube':
                    exec('youtube-dl --get-url ' + video['vid'].replace(/^y_/i,''), function (error, stream) {
                      video['stream'] = stream;
                      cb();
                    });
                    break;
                  case 'ustream':
                    video['stream'] = 'http://iphone-streaming.ustream.tv/uhls/' + video['vid'].replace(/^u_/i,'') + '/streams/live/iphone/playlist.m3u8';
                    cb();
                    break;
                  default:
                    cb();
                };
              }else{
                cb();
              }

            }, cb);
          }
        ], function(){
            Release.child('live').set(live, function(){
              async.each(liveNew, function(active, cb){
                var open = new Open();
                open.set('title', active.title);
                open.set('url', active.url);
                open.set('vuid', active.vuid);
                open.save(null, {
                  'success': function(){ cb && cb(); },
                  'error': function(){ cb && cb(); }
                })
              }, function () {
                console.log(new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' Live Run! ' + count);
                process.exit(0);
              });
            });
          });
      });
    } else {
      throw "Fetch Channel Error";
    }
  });

}
catch(err) {
    console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err)
}
