var http = require('http'),
    async = require('async'),
    uuid = require('node-uuid'),
    time = require('time');

try {

  var DataBase = require('./class/initial.js');
  var Live = DataBase.Live,
      Chrome = DataBase.Chrome,
      Mobile = DataBase.Mobile,
      Release = DataBase.Release;

  var Channel = Live.Object.extend("channel");
  var Live_Location = Live.Object.extend("live_location");
  var Chrome_Location = Chrome.Object.extend("live_location");
  var Mobile_Location = Mobile.Object.extend("live_location");

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
                  for (var i = 0, len = body.feed.entry.length; i < len; i++) {
                      var vid = /videos\/([\w-_]+)/.exec(body.feed.entry[i].content.src)[1];
                      active.push({
                          type: 'youtube',
                          title: body.feed.entry[i].title.$t,
                          cid: id,
                          vid: vid,
                          user: id,
                          url: 'http://youtu.be/' + vid,
                          embed: 'http://www.youtube.com/embed/' + vid + '?autoplay=1'
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
                      type: 'ustream',
                      title: body.results.title,
                      cid: id,
                      vid: body.results.id,
                      url: 'http://www.ustream.tv/channel/' + body.results.id,
                      embed: 'http://www.ustream.tv/embed/' + body.results.id + '?wmode=direct&autoplay=true'
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
                  if (channel.status == 'live') {
                      live.push({
                          type: 'ustream',
                          title: channel.title,
                          cid: id,
                          vid: channel.id,
                          user: id,
                          url: 'http://www.ustream.tv/channel/' + channel.id,
                          embed: 'http://www.ustream.tv/embed/' + channel.id + '?wmode=direct&autoplay=true'
                          thumb: channel.imageUrl.small
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

  var query = new Live.Query(Channel);
  var parser = function (cb){
      query.find({
          success: function(channel) {
              async.parallel({
                  'mobile_location': function(cb){
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
                  'chrome_location': function(cb){
                    var temp = {};
                    var query = new Chrome.Query(Chrome_Location);
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
                        console.log("Fetch Chrome Location Error: " + error.code + " " + error.message);
                      }
                    });
                  },
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

                  async.each(Object.keys(live), function(key, cb){
                    var vuid = live[key]['vuid'];

                    async.waterfall([
                      function (cb) {
                        var query = new Live.Query(Live_Location);
                        query.equalTo("vuid", vuid);

                        query.first({
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
                      function (cb) {
                        var object = new Live_Location();

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
                      }
                    ], function (err, object) {
                      
                      var location = object.get('location') || {};

                      for (name in results['chrome_location'][vuid]){
                        location[name] = (location[name] || 0) + results['chrome_location'][vuid][name];
                      }

                      for (name in results['mobile_location'][vuid]){
                        location[name] = (location[name] || 0) + results['mobile_location'][vuid][name];
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
                  }, function(){
                    Release.child('live').set(live, function(){
                      cb && cb(count);
                    });
                  });
              });
          },
          error: function(error) {
              throw "Fetch Channel Error: " + error.code + " " + error.message;
          }
      });
  }

  parser(function (count) {
      console.log(new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' Live Run! ' + count);
      process.exit(0);
  });

}
catch(err) {
    console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err)
}
