var http = require('http'),
    async = require('async'),
    uuid = require('node-uuid'),
    time = require('time');

try {

  var DataBase = require('../class/initial.js');
  var Live    = DataBase.Live,
      Chrome  = DataBase.Chrome,
      Mobile  = DataBase.Mobile,
      Release = DataBase.Release;

  var MobileToken  = Mobile.Object.extend("mobile_token");
  var Token = {
    'ios':      Live.Object.extend("ios_token"),
    'android':  Live.Object.extend("android_token")
  }

  var tokens = {};

  var query = new Mobile.Query(MobileToken);
  var Table = {
    'ios':      new Live.Query(Token['ios']),
    'android':  new Live.Query(Token['android'])
  }

  var save = function(type, data, cb) {
    var DB = Table[type];
    var Obj = Token[type];
    var token;
    var now = new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'');
    DB.equalTo("uuid", data['uuid']);
    DB.first({
      success: function(token) {
        if ( token ) {
          token.save({
            'uuid': data['uuid'],
            'token': data['token'],
            'channel': (data['channel'] + '').split(','),
            'device': data['device'],
            'responseAt': data['responseAt']
          },{
            success: function() {
              console.log(now ,'success update', '['+type+']', data['uuid']);
              cb();
            },
            error: function() {
              console.log(now ,'failed update', '['+type+']', data['uuid']);
              cb();
            }
          });
        }else{
          token = new Obj();
          token.save({
            'uuid': data['uuid'],
            'token': data['token'],
            'channel': (data['channel'] + '').split(','),
            'device': data['device'],
            'responseAt': data['responseAt']
          },{
            success: function() {
              console.log(now ,'success create', '['+type+']', data['uuid']);
              cb();
            },
            error: function() {
              console.log(now ,'failed create', '['+type+']', data['uuid']);
              cb();
            }
          });
        }
      },
      error: function(error) {
        console.log(now ,'failed', data['uuid']);
        cb();
      }
    });
  }

  query.find({
    success: function(results) {
      tokens['ios'] = {};
      tokens['android'] = {};

      results.forEach(function(item){
        var type = item.get('type').toLowerCase();
        var uuid = item.get('uuid');
        var token = item.get('token');
        var updateAt = new Date(item.createdAt).getTime();
        if ( /[\w-]+/i.exec(uuid) && /[\w]+/i.exec(token)) {
          if ( tokens[type] ) {
            if ( !tokens[type][uuid] || tokens[type][uuid]['responseAt'] < updateAt) {
              tokens[type][uuid] = {
                'token': token,
                'channel': item.get('channel'),
                'device': item.get('device'),
                'uuid': uuid,
                'responseAt': updateAt
              }
            }
          }
        }
      });

      async.parallel([
          function (cb) {
            async.each(results, function (obj, cb) {
              obj.destroy({
                'success': function(){ cb(); },
                'error': function(){ cb(); }
              });
            }, cb);
          },
          function(cb){
            async.eachSeries(Object.keys(tokens['ios']), function (uuid, cb) {
              save('ios', tokens['ios'][uuid], cb);
            }, cb);
          },
          function(cb){
            async.eachSeries(Object.keys(tokens['android']), function (uuid, cb) {
              save('android', tokens['android'][uuid], cb);
            }, cb);
          }
      ], function () {
        process.exit(0);
      });
    },
    error: function(error) {
      console.log(error);
    }
  });

}
catch(err) {
    console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err)
}